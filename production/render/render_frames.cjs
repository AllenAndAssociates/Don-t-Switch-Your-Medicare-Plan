#!/usr/bin/env node
/*
 * Renders the graphic stage (composition/index.html) frame-by-frame with headless Chromium.
 *
 *   node render/render_frames.cjs bg <out.png>                       backdrop plate (2640x1080)
 *   node render/render_frames.cjs frames <outDir> [--from N] [--to N] [--workers 3]
 *        -> <outDir>/fg_000000.png ... (RGBA) + <outDir>/states.json (avatar placement per frame)
 *   node render/render_frames.cjs stills <outDir> t1,t2,...          single frames (+ states) for review
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TL = JSON.parse(fs.readFileSync(path.join(ROOT, 'timing/timeline.json'), 'utf8'));
const FPS = TL.fps;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

async function openPage(browser, base, layer, width) {
  const page = await browser.newPage({ viewport: { width: width || 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => { console.error('[pageerror]', e.message); process.exitCode = 1; });
  await page.goto(`${base}/composition/index.html?layer=${layer}`, { waitUntil: 'load' });
  await page.evaluate(() => window.__ready);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  return { page, cdp };
}

async function grab(cdp, file) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, captureBeyondViewport: false });
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
}

async function main() {
  const [mode, out, ...rest] = process.argv.slice(2);
  const opt = (k, d) => { const i = rest.indexOf('--' + k); return i >= 0 ? rest[i + 1] : d; };
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb'] });
  try {
    if (mode === 'bg') {
      const { page } = await openPage(browser, base, 'bg', 2640);
      await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 2640, height: 1080 } });
      console.log('wrote', out);
    } else if (mode === 'stills') {
      fs.mkdirSync(out, { recursive: true });
      const { page, cdp } = await openPage(browser, base, 'fg');
      const times = rest[0].split(',').map(Number);
      const states = {};
      for (const t of times) {
        states[t] = await page.evaluate((tt) => window.renderAt(tt), t);
        await grab(cdp, path.join(out, `still_${t.toFixed(2)}.png`));
      }
      fs.writeFileSync(path.join(out, 'states.json'), JSON.stringify(states));
      console.log('wrote', times.length, 'stills');
    } else if (mode === 'frames') {
      fs.mkdirSync(out, { recursive: true });
      const from = +opt('from', 0), to = +opt('to', TL.totalFrames), workers = +opt('workers', 3);
      const n = to - from, chunk = Math.ceil(n / workers);
      const states = new Array(n);
      let done = 0; const t0 = Date.now();
      await Promise.all(Array.from({ length: workers }, async (_, w) => {
        const a = from + w * chunk, b = Math.min(to, a + chunk);
        if (a >= b) return;
        const { page, cdp } = await openPage(browser, base, 'fg');
        for (let f = a; f < b; f++) {
          const file = path.join(out, `fg_${String(f).padStart(6, '0')}.png`);
          states[f - from] = await page.evaluate((tt) => window.renderAt(tt), f / FPS);
          if (!fs.existsSync(file)) await grab(cdp, file);
          if (++done % 250 === 0) {
            const el = (Date.now() - t0) / 1000;
            console.log(`${done}/${n} frames  ${(done / el).toFixed(1)} fps  eta ${((n - done) / (done / el) / 60).toFixed(1)} min`);
          }
        }
        await page.close();
      }));
      const sfile = path.join(out, `states_${from}_${to}.json`);
      fs.writeFileSync(sfile, JSON.stringify({ from, to, states }));
      console.log('wrote', n, 'frames +', sfile);
    } else {
      throw new Error('usage: bg|frames|stills');
    }
  } finally {
    await browser.close();
    srv.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
