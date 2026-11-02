/* ==========================================================================
   Master timeline. Every animation is keyed to shot/cue times produced by
   timing/align.py from the avatar's word-level transcript, so graphics land
   on the spoken words. The page is driven frame-by-frame via renderAt(t).
   ========================================================================== */
(function () {
  const params = new URLSearchParams(location.search);
  const LAYER = params.get('layer') || 'fg';
  if (LAYER === 'bg') { document.body.classList.add('layer-bg'); window.__ready = Promise.resolve(true); return; }
  if (params.has('preview')) document.body.classList.add('preview');

  const T = window.TIMELINE;
  const shot = (n) => { const v = T.shots[String(n)]; if (v == null) throw new Error('shot ' + n); return v; };
  const cue = (id) => { const v = T.cues[id]; if (v == null) throw new Error('cue ' + id); return v; };
  const q = (s) => document.querySelector(s);
  const qa = (s, root) => Array.from((root || document).querySelectorAll(s));

  const AV_SPEAKER = { cx: 960, top: 4, scale: 1.2 };
  const AV_SPLIT = { cx: 480, top: 60, scale: 0.8889 };
  const LEAD = 0.25;   // graphics transition starts slightly before the words

  window.__ready = (async () => {
    await document.fonts.ready;
    await Promise.all(['400 20px Inter', '800 20px Archivo'].map((f) => document.fonts.load(f)));
    applyIcons();
    buildDynamic();
    build();
    return true;
  })();

  /* ------------------------------------------------------------------ */
  function buildDynamic() {
    // US tile grid map
    const layout = [
      ['AK', 0, 0], ['ME', 0, 10],
      ['WI', 1, 5], ['VT', 1, 9], ['NH', 1, 10],
      ['WA', 2, 0], ['ID', 2, 1], ['MT', 2, 2], ['ND', 2, 3], ['MN', 2, 4], ['IL', 2, 5], ['MI', 2, 6], ['NY', 2, 8], ['MA', 2, 9],
      ['OR', 3, 0], ['NV', 3, 1], ['WY', 3, 2], ['SD', 3, 3], ['IA', 3, 4], ['IN', 3, 5], ['OH', 3, 6], ['PA', 3, 7], ['NJ', 3, 8], ['CT', 3, 9], ['RI', 3, 10],
      ['CA', 4, 0], ['UT', 4, 1], ['CO', 4, 2], ['NE', 4, 3], ['MO', 4, 4], ['KY', 4, 5], ['WV', 4, 6], ['VA', 4, 7], ['MD', 4, 8], ['DE', 4, 9],
      ['AZ', 5, 1], ['NM', 5, 2], ['KS', 5, 3], ['AR', 5, 4], ['TN', 5, 5], ['NC', 5, 6], ['SC', 5, 7], ['DC', 5, 8],
      ['OK', 6, 3], ['LA', 6, 4], ['MS', 6, 5], ['AL', 6, 6], ['GA', 6, 7],
      ['HI', 7, 0], ['TX', 7, 3], ['FL', 7, 8],
    ];
    const mb = q('#mapbox');
    const pitch = 68, ox = (784 - (11 * pitch - 6)) / 2;
    layout.forEach(([st, r, c]) => {
      const d = document.createElement('div');
      d.className = 'tile'; d.textContent = st; d.dataset.st = st; d.dataset.r = r; d.dataset.c = c;
      d.style.left = (ox + c * pitch) + 'px'; d.style.top = (r * pitch) + 'px';
      mb.appendChild(d);
    });

    // OE timeline ticks (months 1-6)
    const tk = q('#ticks');
    for (let m = 1; m <= 6; m++) {
      const s = document.createElement('span'); s.textContent = 'MO ' + m; s.style.left = ((m - 0.5) * 110) + 'px'; tk.appendChild(s);
    }
    q('#nd-r').style.left = (40 + 6.5 * 110 - 24) + 'px';
    q('#tlab-r').style.left = '790px';
    q('#tlab-r').style.width = '800px';
    [870, 1164, 1458].forEach((x, i) => { const l = q('#obl' + (i + 1)); l.style.left = x + 'px'; l.style.top = '266px'; l.style.height = '114px'; });
    const same = q('#same'); same.style.left = '754px'; same.style.top = '139px';

    // Anniversary month strip
    const months = ['JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY'];
    const ms = q('#mstrip');
    months.forEach((m, i) => {
      const d = document.createElement('div'); d.className = 'm' + (i === 0 ? ' ann' : '') + (m === 'JAN' ? ' jan' : '');
      d.textContent = m; ms.appendChild(d);
    });

    // Unit chart (30 x 100,000)
    const un = q('#units');
    for (let i = 0; i < 30; i++) { const u = document.createElement('div'); u.className = 'u'; u.innerHTML = '<i data-i="user"></i>'; un.appendChild(u); }
    applyIcons(un);

    // Year strip for MA OEP
    const yr = q('#year');
    ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].forEach((m, i) => {
      const d = document.createElement('div');
      d.className = 'm' + (i < 3 ? ' oep' : '') + (i >= 9 ? ' aep' : '');
      d.innerHTML = '<div class="f"></div><span>' + m + '</span>';
      yr.appendChild(d);
    });
    q('#yl-aep').style.left = (9 * ((784 - 66) / 12 + 6)) + 'px';

    // Rate chart
    const y = (v) => 400 - (v / 20) * 370;
    const g = q('#ch-grid');
    [0, 5, 10, 15, 20].forEach((v) => {
      g.insertAdjacentHTML('beforeend', `<line x1="70" x2="760" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0 ? '#0A2540' : '#DFE5EC'}" stroke-width="${v === 0 ? 2 : 1.5}"/>` +
        `<text x="58" y="${y(v) + 6}" text-anchor="end">${v}%</text>`);
    });
    const bp = q('#ch-band-past'); bp.setAttribute('y', y(8)); bp.setAttribute('height', y(5) - y(8));
    const bn = q('#ch-band-now'); bn.setAttribute('y', y(18)); bn.setAttribute('height', y(10) - y(18));
    const past = [6.2, 6.9, 5.8, 7.2, 6.3, 7.5, 6.5, 7.0];
    const pd = past.map((v, i) => `${i ? 'L' : 'M'}${70 + i * 60},${y(v).toFixed(1)}`).join(' ');
    q('#ch-past').setAttribute('d', pd);
    q('#ch-now').setAttribute('d', `M490,${y(7.0)} C560,${y(7.6)} 650,${y(10.5)} 740,${y(18.6)}`);
    const dot = q('#ch-dot'); dot.setAttribute('cx', 740); dot.setAttribute('cy', y(18.6));
    ['#ch-past', '#ch-now'].forEach((s) => { const p = q(s); const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; p.dataset.len = L; });

    // Roadmap rail spans item 1 to item 4
    const n1 = q('#ri1 .num'), n4 = q('#ri4 .num');
    const r1 = n1.getBoundingClientRect(), r4 = n4.getBoundingClientRect(), rl = q('.road-list').getBoundingClientRect();
    const rail = q('.road-rail');
    rail.style.top = (r1.top - rl.top + r1.height / 2) + 'px';
    rail.style.left = (r1.left - rl.left + r1.width / 2 - 1) + 'px';
    rail.style.height = (r4.top - r1.top) + 'px';

    // Move wipe edges out of the clipped layers
    const lt = q('#lowerThird');
    lt.parentNode.insertBefore(q('#dsEdge'), lt);
    lt.parentNode.insertBefore(q('#oEdge'), lt);
  }

  /* ------------------------------------------------------------------ */
  const av = { ...AV_SPEAKER };
  const cv = { x: 960 };
  const ds = { L: 100, R: 0 };
  const oc = { L: 100 };
  const pill = { nw: 0, lw: 0 };
  const counters = [];
  let tl;

  function build() {
    tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out', lazy: false, immediateRender: false } });

    // ---------- helpers ----------
    const hide = (targets, vars) => gsap.set(targets, Object.assign({ opacity: 0 }, vars || {}));
    // Fade/slide an element in at time t (initial state applied now, outside the timeline).
    const IN = (targets, t, from, to) => {
      from = Object.assign({ opacity: 0 }, from || {});
      gsap.set(targets, from);
      const toVars = Object.assign({ duration: 0.6 }, to || {});
      const ONE = ['opacity', 'scale', 'scaleX', 'scaleY'];
      const ZERO = ['x', 'y', 'xPercent', 'yPercent', 'rotation'];
      Object.keys(from).forEach((k) => {
        if (k in toVars) return;
        if (ONE.includes(k)) toVars[k] = 1;
        else if (ZERO.includes(k)) toVars[k] = 0;
      });
      tl.fromTo(targets, from, toVars, t);
    };
    const up = (targets, t, extra) => IN(targets, t, { y: 34 }, extra);
    const left = (targets, t, extra) => IN(targets, t, { x: 46 }, extra);
    const pop = (targets, t, extra) => IN(targets, t, { scale: 0.6 }, Object.assign({ ease: 'back.out(2)', duration: 0.55 }, extra || {}));
    const lit = (targets, t, dur) => { gsap.set(targets, { '--lit': 0 }); tl.to(targets, { '--lit': 1, duration: dur || 0.6, ease: 'power2.out' }, t); };
    const counter = (el, t, to, dur, fmt) => {
      const o = { v: 0 }; counters.push({ el, o, fmt });
      tl.fromTo(o, { v: 0 }, { v: to, duration: dur || 1.4, ease: 'power2.out' }, t);
    };
    const comma = (n) => Math.round(n).toLocaleString('en-US');

    // ---------- scene schedule ----------
    const scenes = [
      { id: 'r-title', mode: 'split', t: 2.0 },
      { id: 'r-cost', mode: 'split', t: shot(2) - LEAD },
      { id: 'r-brand', mode: 'split', t: shot(4) - LEAD },
      { id: 'd-landscape', mode: 'data', t: shot(5) - LEAD },
      { id: 'r-roadmap', mode: 'split', t: shot(7) - LEAD },
      { id: null, mode: 'speaker', t: shot(9) - LEAD },
      { id: 'r-myth', mode: 'split', t: shot(10) - LEAD },
      { id: 'd-timeline', mode: 'data', t: shot(13) - LEAD },
      { id: 'r-map', mode: 'split', t: shot(16) - LEAD },
      { id: 'r-irony', mode: 'split', t: shot(18) - LEAD },
      { id: 'r-chart', mode: 'split', t: shot(19) - LEAD },
      { id: 'd-table', mode: 'data', t: shot(21) - LEAD },
      { id: 'r-bar', mode: 'split', t: shot(25) - LEAD },
      { id: 'r-shield', mode: 'split', t: shot(26) - LEAD },
      { id: 'r-profiles', mode: 'split', t: shot(27) - LEAD },
      { id: 'r-calendar', mode: 'split', t: shot(29) - LEAD },
      { id: 'r-carriers', mode: 'split', t: shot(30) - LEAD },
      { id: 'd-protocol', mode: 'data', t: shot(32) - LEAD },
      { id: 'r-counter', mode: 'split', t: shot(36) - LEAD },
      { id: 'r-shifts', mode: 'split', t: shot(37) - LEAD },
      { id: 'r-verify', mode: 'split', t: shot(38) - LEAD },
      { id: 'd-matrix', mode: 'data', t: shot(39) - LEAD },
      { id: 'r-fineprint', mode: 'split', t: shot(43) - LEAD },
      { id: 'r-leaving', mode: 'split', t: shot(44) - LEAD },
      { id: 'd-flow', mode: 'data', t: shot(46) - LEAD },
      { id: 'r-oep', mode: 'split', t: shot(47) - LEAD },
      { id: 'r-partd', mode: 'split', t: shot(48) - LEAD },
      { id: 'r-equation', mode: 'split', t: shot(49) - LEAD },
      { id: 'd-hack', mode: 'data', t: shot(50) - LEAD },
      { id: 'r-cta', mode: 'split', t: shot(54) - LEAD },
      { id: 'outro', mode: 'outro', t: cue('s54_outro') - 0.35 },
    ];
    const B = {};   // build-start time per scene id
    let prevMode = 'speaker';
    scenes.forEach((s, i) => {
      const next = scenes[i + 1];
      const end = next ? next.t : T.duration + 1;
      transition(prevMode, s.mode, s.t);
      const b = s.t + (prevMode === 'speaker' ? 0.55 : prevMode === 'data' ? 0.3 : s.mode === 'data' ? 0.45 : 0.3);
      if (s.id) B[s.id] = b;
      if (s.id && s.mode !== 'outro') {
        const el = q('#' + s.id);
        tl.set(el, { visibility: 'visible' }, s.t);
        if (next && next.mode === 'split' && s.mode === 'split') {
          tl.to(el, { opacity: 0, y: -26, duration: 0.3, ease: 'power2.in' }, end);
          tl.set(el, { visibility: 'hidden' }, end + 0.32);
        } else {
          tl.set(el, { visibility: 'hidden' }, end + 1.0);
        }
      }
      prevMode = s.mode;
    });

    function transition(from, to, t) {
      if (from === to) return;
      const io = { duration: 1.0, ease: 'power3.inOut' };
      if (from === 'speaker' && to === 'split') {
        tl.fromTo(av, { ...AV_SPEAKER }, { ...AV_SPLIT, ...io }, t);
        tl.fromTo(cv, { x: 960 }, { x: 0, ...io }, t);
      } else if (from === 'split' && to === 'speaker') {
        tl.fromTo(av, { ...AV_SPLIT }, { ...AV_SPEAKER, ...io, duration: 0.9 }, t);
        tl.fromTo(cv, { x: 0 }, { x: 960, ...io, duration: 0.9 }, t);
      } else if (from === 'split' && to === 'data') {
        tl.fromTo(ds, { L: 100, R: 0 }, { L: 0, ...io, duration: 0.8 }, t);
      } else if (from === 'data' && to === 'split') {
        tl.fromTo(ds, { L: 0, R: 0 }, { R: 100, ...io, duration: 0.8 }, t);
        tl.set(ds, { L: 100, R: 0 }, t + 0.82);
      } else if (from === 'split' && to === 'outro') {
        tl.fromTo(oc, { L: 100 }, { L: 0, ...io, duration: 0.9 }, t);
      } else {
        throw new Error('no transition ' + from + '->' + to);
      }
    }

    // ---------- persistent UI ----------
    IN('#agencyBar', 0.5, { x: -560, opacity: 1 }, { x: 0, duration: 0.9, ease: 'power3.out' });

    const chapters = [
      { t: 2.6, num: 'INTRO', label: 'The 2027 Medicare Landscape' },
      { t: shot(9) - 0.1, num: '1', label: 'Medigap Rules & Underwriting' },
      { t: shot(19) - 0.1, num: '2', label: 'Plan G vs. Plan N vs. HD-G' },
      { t: shot(29) - 0.1, num: '3', label: 'How to Safely Switch Medigap' },
      { t: shot(36) - 0.1, num: '4', label: 'Medicare Advantage Disruptions' },
      { t: shot(48) - 0.1, num: '5', label: 'Part D & The Rate Increase Hack' },
    ];
    const pn = q('#pill-num'), pl = q('#pill-lbl');
    const meas = document.createElement('span');
    meas.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-family:Archivo;font-weight:750;font-size:22px;letter-spacing:0.01em';
    document.body.appendChild(meas);
    const measNum = document.createElement('span');
    measNum.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-family:Archivo;font-weight:850;font-size:22px;letter-spacing:0.04em';
    document.body.appendChild(measNum);
    chapters.forEach((c, i) => {
      const ns = document.createElement('span'); ns.textContent = c.num; pn.appendChild(ns);
      const ls = document.createElement('span'); ls.textContent = c.label; pl.appendChild(ls);
      meas.textContent = c.label; c.lw = Math.ceil(meas.getBoundingClientRect().width) + 2;
      measNum.textContent = c.num; c.nw = Math.max(44, Math.ceil(measNum.getBoundingClientRect().width) + 30);
      c.ns = ns; c.ls = ls;
      gsap.set([ns, ls], { yPercent: 110, opacity: 0 });
    });
    pill.nw = chapters[0].nw; pill.lw = chapters[0].lw;
    gsap.set(chapters[0].ns, { yPercent: 0, opacity: 1 }); gsap.set(chapters[0].ls, { yPercent: 0, opacity: 1 });
    IN('#pill', chapters[0].t, { x: -40 }, { duration: 0.7 });
    chapters.slice(1).forEach((c, i) => {
      const p = chapters[i];
      tl.to([p.ns, p.ls], { yPercent: -110, opacity: 0, duration: 0.35, ease: 'power2.in' }, c.t);
      tl.fromTo([c.ns, c.ls], { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: 'back.out(1.6)' }, c.t + 0.25);
      tl.fromTo(pill, { nw: p.nw, lw: p.lw }, { nw: c.nw, lw: c.lw, duration: 0.5, ease: 'power3.inOut' }, c.t + 0.1);
      tl.fromTo('#pill', { scale: 1 }, { scale: 1.08, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out', transformOrigin: '0% 50%' }, c.t + 0.25);
    });

    // Lower third (shot 9)
    const ltT = cue('s9_lower') - 0.35;
    IN('#lowerThird', ltT, { x: -80 }, { duration: 0.6 });
    IN('#lowerThird .lt-icon', ltT + 0.1, { scale: 0.3 }, { ease: 'back.out(2.2)', duration: 0.5 });
    IN('#lt-kick', ltT + 0.35, { y: 16 }, { duration: 0.4 });
    gsap.set('#lowerThird .lt-text', { '--ul': 0 });
    tl.to('#lowerThird .lt-text', { '--ul': 1, duration: 0.8, ease: 'power3.inOut' }, ltT + 0.4);
    tl.to('#lowerThird', { opacity: 0, x: -60, duration: 0.35, ease: 'power2.in' }, shot(10) - LEAD - 0.4);

    // Outro: pill + bar leave
    const oT = cue('s54_outro') - 0.35;
    tl.to(['#pill', '#agencyBar'], { opacity: 0, duration: 0.4, ease: 'power2.in' }, oT + 0.3);

    // ================= SCENES =================
    // --- r-title
    {
      const b = 2.3;
      IN('#r-title .label-blue', b, { x: -50 }, { duration: 0.5 });
      const words = qa('#r-title .w');
      gsap.set(words, { yPercent: 115 });
      words.forEach((w, i) => tl.fromTo(w, { yPercent: 115 }, { yPercent: 0, duration: 0.7, ease: 'power4.out' }, b + 0.15 + i * 0.09));
      IN('#r-title .title-rule', b + 0.85, { scaleX: 0, transformOrigin: '0% 50%', opacity: 1 }, { duration: 0.8, ease: 'power3.inOut' });
      up('#r-title .title-meta', b + 1.1);
    }

    // --- r-cost
    {
      const b = B['r-cost'];
      up('#r-cost .kicker', b);
      const g = cue('s2_green') - 0.35, r = cue('s2_red') - 0.3;
      left('#cost-g .metric-top', g);
      IN('#cost-g .m-fill', g + 0.2, { scaleX: 0, opacity: 1 }, { duration: 0.8 });
      up('#cost-g .m-scale', g + 0.5);
      IN('#cost-vs', r - 0.25, {}, { duration: 0.4 });
      IN('#cost-r .m-block', r, { scale: 0.7 }, { ease: 'back.out(2)', duration: 0.55 });
      left('#cost-r .m-label', r + 0.1);
      IN('#cost-r .m-fill', r + 0.2, { scaleX: 0, opacity: 1 }, { duration: 1.4, ease: 'power2.out' });
      const lk = shot(3) - 0.1;
      up('#cost-lock', lk, { duration: 0.55 });
      tl.to('#cost-lock .lk', { keyframes: [{ rotation: -12, duration: 0.08 }, { rotation: 10, duration: 0.08 }, { rotation: -6, duration: 0.08 }, { rotation: 0, duration: 0.08 }] }, lk + 0.5);
    }

    // --- r-brand
    {
      const b = B['r-brand'];
      up('#r-brand .brand-card', b, { duration: 0.7 });
      IN('#r-brand .logo-official', b + 0.25, { scale: 0.85, transformOrigin: '0% 50%' }, { ease: 'back.out(1.8)', duration: 0.6 });
      up('#r-brand .brand-name', b + 0.5);
      left('#r-brand .brand-chip', b + 0.9);
      IN('#r-brand .brand-rule', b + 1.2, { scaleX: 0, transformOrigin: '0% 50%', opacity: 1 }, { duration: 0.7 });
      up('#r-brand .brand-tag', b + 1.4);
    }

    // --- d-landscape
    {
      const b = B['d-landscape'];
      up('#d-landscape .dkicker', b);
      up('#d-landscape .dtitle', b + 0.12);
      IN('#st3', b + 0.4, { y: 40 }, { opacity: 0.28 });
      const c1 = cue('s5_card1') - 0.3, c2 = cue('s5_card2') - 0.3, c3 = cue('s6_card3') - 0.6;
      up('#st1', c1, { duration: 0.7 }); lit('#st1', c1 + 0.3);
      qa('#st1 .s-bars i').forEach((el, i) => IN(el, c1 + 0.35 + i * 0.07, { scaleY: 0, opacity: 1, transformOrigin: '50% 100%' }, { duration: 0.5 }));
      up('#st2', c2, { duration: 0.7 }); lit('#st2', c2 + 0.3);
      counter(q('#st2-val'), c2 + 0.1, 3000000, 1.6, (v) => comma(v) + (v >= 2999999 ? '+' : ''));
      gsap.set(['#st1', '#st2', '#st3'], { '--lit': 0 });
      tl.fromTo('#st3', { opacity: 0.28, scale: 1 }, { opacity: 1, scale: 1.03, duration: 0.35, ease: 'power2.out' }, c3);
      tl.to('#st3', { scale: 1, duration: 0.4, ease: 'power2.inOut' }, c3 + 0.35);
      tl.to('#st3', { '--lit': 1, duration: 0.6 }, c3 + 0.1);
    }

    // --- r-roadmap
    {
      const b = B['r-roadmap'];
      up('#r-roadmap .kicker', b);
      IN('#r-roadmap .road-rail', b + 0.2, { scaleY: 0, transformOrigin: '50% 0%', opacity: 1 }, { duration: 6.0, ease: 'none' });
      [['#ri1', 's7_item1'], ['#ri2', 's7_item2'], ['#ri3', 's7_item3']].forEach(([s, c]) => {
        const t = cue(c) - 0.3;
        left(s + ' .txt', t);
        pop(s + ' .num', t - 0.05);
      });
      const t4 = cue('s8_item4') - 0.45;
      IN('#ri4', t4, { y: 30, scale: 0.95 }, { duration: 0.6, ease: 'back.out(1.6)' });
      tl.fromTo('#ri4', { boxShadow: '0 0 0 0 rgba(0,177,64,0.0)' }, { boxShadow: '0 0 0 14px rgba(0,177,64,0.18)', duration: 0.5, yoyo: true, repeat: 1, ease: 'power2.out' }, t4 + 0.6);
    }

    // --- r-myth
    {
      const b = B['r-myth'];
      up('#r-myth .kicker', b);
      left('#mf-myth', b + 0.1);
      pop('#mf-myth .mf-icon', b + 0.3);
      const f = shot(11) - 0.15;
      left('#mf-fact', f);
      pop('#mf-fact .mf-icon', f + 0.2);
      tl.fromTo('#mf-myth .strike', { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: 'power2.inOut', transformOrigin: '0% 50%' }, f + 0.5);
      tl.to('#mf-myth', { opacity: 0.6, duration: 0.4 }, f + 0.8);
      IN('#mf-strip', cue('s12_strip') - 0.5, { y: 30, scale: 0.97 }, { duration: 0.6 });
    }

    // --- d-timeline
    {
      const b = B['d-timeline'];
      up('#d-timeline .dkicker', b);
      up('#d-timeline .dtitle', b + 0.12);
      IN('#tz-g', b + 0.3, {}, { duration: 0.6 });
      pop('#nd-g', b + 0.35);
      left('#tl-start', b + 0.5);
      const n = cue('s13_node') - 0.4;
      IN('#ax-g', n, { scaleX: 0, opacity: 1, transformOrigin: '0% 50%' }, { duration: 1.6, ease: 'power2.inOut' });
      qa('#ticks span').forEach((s, i) => up(s, n + 0.2 + i * 0.2, { duration: 0.35 }));
      up('#tlab-g', n + 0.1);
      IN('#tlab-g .gi-chip', n + 1.4, { scale: 0.85 }, { ease: 'back.out(2)', duration: 0.5 });
      const r = shot(14) - 0.1;
      IN('#tz-r', r + 0.2, {}, { duration: 0.6 });
      IN('#ax-r', r, { scaleX: 0, opacity: 1, transformOrigin: '0% 50%' }, { duration: 1.4, ease: 'power2.inOut' });
      pop('#nd-r', r + 0.35);
      up('#tlab-r', r + 0.6);
      [['#ob1', '#obl1', 's15_b1'], ['#ob2', '#obl2', 's15_b2'], ['#ob3', '#obl3', 's15_b3']].forEach(([o, l, c]) => {
        const t = cue(c) - 0.3;
        IN(l, t, { scaleY: 0, opacity: 1, transformOrigin: '50% 0%' }, { duration: 0.3 });
        IN(o, t + 0.15, { scale: 0.6, y: -10 }, { ease: 'back.out(2.2)', duration: 0.5 });
      });
    }

    // --- r-map
    {
      const b = B['r-map'];
      up('#r-map .map-head', b);
      const tiles = qa('#mapbox .tile');
      tiles.forEach((el) => {
        const d = (+el.dataset.r + +el.dataset.c) * 0.03;
        IN(el, b + 0.25 + d, { scale: 0.4 }, { duration: 0.4, ease: 'back.out(1.8)' });
      });
      up('#map-legend', b + 1.0);
      const on = ['CA', 'OR', 'NV', 'ID', 'IL', 'KY', 'LA', 'MD', 'OK', 'WY', 'NY', 'CT', 'MA', 'ME', 'MO', 'WA'];
      const h = Math.max(cue('s16_hl') - 0.3, b + 1.2);
      tiles.filter((el) => on.includes(el.dataset.st)).forEach((el) => {
        tl.fromTo(el, { backgroundColor: '#E3E8EE', color: 'rgba(10,37,64,0.55)' }, { backgroundColor: '#00B140', color: '#FFFFFF', duration: 0.35, ease: 'power2.out' }, h + (+el.dataset.c) * 0.06);
      });
      const z = shot(17) - 0.2;
      tl.fromTo('#mapbox', { scale: 1, x: 0, y: 0 }, { scale: 0.6, x: 157, y: -22, duration: 0.9, ease: 'power3.inOut' }, z);
      tl.to('#map-legend', { opacity: 0, duration: 0.3 }, z);
      left('#fp1', z + 0.6);
      const w = cue('s17_fp2') - 0.3;
      tiles.filter((el) => ['IL', 'KY', 'WV'].includes(el.dataset.st)).forEach((el, i) => {
        tl.to(el, { backgroundColor: '#F5A524', color: '#0A2540', duration: 0.3 }, w + i * 0.12);
        tl.fromTo(el, { boxShadow: '0 0 0 0px #F9FAF8, 0 0 0 0px #F5A524' }, { boxShadow: '0 0 0 4px #F9FAF8, 0 0 0 9px #F5A524', duration: 0.3 }, w + i * 0.12);
      });
      left('#fp2', w + 0.2);
    }

    // --- r-irony
    {
      const b = B['r-irony'];
      up('#r-irony .kicker', b);
      left('#ce1', b + 0.2); pop('#ce1 .ic-b', b + 0.35);
      IN('#cea1', b + 1.1, { y: -14 }, { duration: 0.35 });
      left('#ce2', b + 1.4); pop('#ce2 .ic-b', b + 1.55);
      IN('#cea2', b + 2.3, { y: -14 }, { duration: 0.35 });
      IN('#ce3', b + 2.6, { x: 46, scale: 0.97 }, { duration: 0.6 }); pop('#ce3 .ic-b', b + 2.8);
      tl.fromTo('#ce3', { boxShadow: '0 0 0 0 rgba(217,45,32,0)' }, { boxShadow: '0 0 0 12px rgba(217,45,32,0.18)', duration: 0.45, yoyo: true, repeat: 1 }, b + 3.4);
    }

    // --- r-chart
    {
      const b = B['r-chart'];
      up('#r-chart .kicker', b);
      IN('#chart', b + 0.1, {}, { duration: 0.5 });
      IN('#ch-band-past', b + 0.5, {}, { duration: 0.6 });
      const pp = q('#ch-past');
      tl.fromTo(pp, { strokeDashoffset: +pp.dataset.len }, { strokeDashoffset: 0, duration: 1.8, ease: 'power1.inOut' }, b + 0.4);
      left('#chip-past', b + 1.2);
      const s = shot(20) - 0.1;
      const pn2 = q('#ch-now');
      gsap.set('#ch-band-now', { opacity: 0 });
      tl.fromTo(pn2, { strokeDashoffset: +pn2.dataset.len }, { strokeDashoffset: 0, duration: 1.3, ease: 'power2.in' }, s);
      tl.fromTo('#ch-band-now', { opacity: 0 }, { opacity: 1, duration: 0.6 }, s + 0.6);
      IN('#ch-dot', s + 1.25, { scale: 0, transformOrigin: '50% 50%', opacity: 1 }, { ease: 'back.out(3)', duration: 0.45 });
      left('#chip-now', s + 0.9);
      left('#chip-to', cue('s20_arrow') - 0.2);
    }

    // --- d-table
    {
      const b = B['d-table'];
      up('#d-table .dkicker', b);
      up('#d-table .dtitle', b + 0.12);
      IN(['#h1', '#h2'], b + 0.4, { y: -24 }, { duration: 0.55, stagger: 0.12 });
      left('#rl1', b + 0.7);
      up(['#c11', '#c12'], b + 0.9, { stagger: 0.15 });
      pop('#same', b + 1.6);
      up('#tbl-foot', b + 2.0);
      const d = cue('s22_doc') - 0.5, e = cue('s22_er') - 0.5;
      left('#rl2', d); up('#c21', d + 0.1); IN('#c22', d + 0.25, { scale: 0.8, y: 10 }, { ease: 'back.out(2)', duration: 0.5 });
      left('#rl3', e); up('#c31', e + 0.1); IN('#c32', e + 0.25, { scale: 0.8, y: 10 }, { ease: 'back.out(2)', duration: 0.5 });
      const x = shot(23) - 0.1;
      left('#rl4', x); up('#c41', x + 0.1); IN('#c42', x + 0.25, { scale: 0.85, y: 10 }, { ease: 'back.out(2)', duration: 0.5 });
      const c3 = shot(24) + 0.2;
      IN('#h3', c3, { x: 80 }, { duration: 0.6 });
      IN(['#c13', '#c23', '#c33', '#c43'], c3 + 0.15, { x: 80 }, { duration: 0.6, stagger: 0.1 });
      const cv3 = cue('s24_col3') - 0.1;
      counter(q('#c13 .v'), cv3, 3050, 1.2, (v) => '$' + comma(v));
      tl.fromTo('#h3', { boxShadow: '0 0 0px -8px rgba(25,230,140,0)' }, { boxShadow: '0 0 60px 0px rgba(25,230,140,0.9)', duration: 0.5, yoyo: true, repeat: 1 }, cv3 + 1.0);
    }

    // --- r-bar
    {
      const b = B['r-bar'];
      up('#r-bar .kicker', b);
      up('#r-bar .h-lg', b + 0.1);
      up('#r-bar .bill-lbl', b + 0.4);
      gsap.set('#r-bar .sbar', { clipPath: 'inset(0% 100% 0% 0%)' });
      tl.fromTo('#r-bar .sbar', { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 20% 0% 0%)', duration: 1.0, ease: 'power3.out' }, b + 0.7);
      const sh = cue('s25_share') - 0.4;
      tl.fromTo('#r-bar .sbar', { clipPath: 'inset(0% 20% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.6, ease: 'power3.out' }, sh);
      up('#sb-leg', sh + 0.4);
      up('#sb-meter', sh + 0.7);
      IN('#sb-fill', sh + 1.0, { scaleX: 0, opacity: 1, transformOrigin: '0% 50%' }, { scaleX: 0.38, duration: 1.8, ease: 'steps(6)' });
    }

    // --- r-shield
    {
      const b = B['r-shield'];
      up('#r-shield .kicker', b);
      pop('#sh-icon', b + 0.15);
      left('#sh-t1', b + 0.4);
      up(['#sh-meter', '#r-shield .meter-lbls'], b + 0.8);
      const f = cue('s26_full') - 0.3;
      IN('#sh-fill', b + 1.0, { scaleX: 0, opacity: 1, transformOrigin: '0% 50%' }, { scaleX: 1, duration: Math.max(0.8, f - b - 1.0), ease: 'power1.inOut' });
      IN('#sh-cov', f, { scale: 0.7 }, { ease: 'back.out(2.2)', duration: 0.5 });
      tl.fromTo('#sh-icon', { scale: 1 }, { scale: 1.06, duration: 0.25, yoyo: true, repeat: 1 }, f + 0.1);
    }

    // --- r-profiles
    {
      const b = B['r-profiles'];
      up('#r-profiles .kicker', b);
      IN('#pf1', b + 0.15, { y: 40 }, { duration: 0.6 });
      IN('#pf2', b + 0.35, { y: 40 }, { duration: 0.6 });
      qa('#pf1 li').forEach((li, i) => left(li, b + 0.6 + i * 0.15, { duration: 0.4 }));
      qa('#pf2 li').forEach((li, i) => left(li, b + 0.8 + i * 0.15, { duration: 0.4 }));
      const g = cue('s27_g') - 0.2;
      tl.fromTo('#pf2', { y: 0, boxShadow: '0 0 0 0 rgba(10,37,64,0)' }, { y: -8, boxShadow: '0 22px 40px -20px rgba(10,37,64,0.55)', duration: 0.5 }, g);
      const c = shot(28) - 0.15;
      up('#pf-caution', c, { duration: 0.5 });
      tl.fromTo('#pf-caution', { backgroundColor: '#F5A524' }, { backgroundColor: '#FFD27A', duration: 0.18, yoyo: true, repeat: 3, ease: 'none' }, c + 0.55);
    }

    // --- r-calendar
    {
      const b = B['r-calendar'];
      up('#r-calendar .kicker', b);
      up('#r-calendar .h-lg', b + 0.1);
      pop('#cal1', b + 0.45);
      IN('#cal-mid .ln', b + 0.75, { scaleX: 0, opacity: 1, transformOrigin: '0% 50%' }, { duration: 0.9, ease: 'power2.inOut' });
      pop('#cal-mid .lk', b + 0.85);
      up('#cal-mid .tx', b + 1.0);
      pop('#cal2', b + 1.45);
      qa('#mstrip .m').forEach((m, i) => up(m, b + 1.6 + i * 0.06, { duration: 0.35 }));
      const a = cue('s29_adj') - 0.3;
      up('#ann-note', a);
      tl.fromTo(['#mstrip .m.ann', '#cal2'], { scale: 1 }, { scale: 1.08, duration: 0.25, yoyo: true, repeat: 1 }, a + 0.3);
    }

    // --- r-carriers
    {
      const b = B['r-carriers'];
      up('#r-carriers .kicker', b);
      ['#car1', '#car2', '#car3'].forEach((s, i) => up(s, b + 0.15 + i * 0.15));
      const e = cue('s30_eq') - 0.3;
      pop(['#eq1', '#eq2'], e, { stagger: 0.15 });
      up('#ident', e + 0.3);
      up('#uw-note', shot(31) + 0.2);
      const a = cue('s31_a') - 0.2, ap = cue('s31_b') - 0.2;
      tl.to('#car1', { borderColor: '#D92D20', duration: 0.3 }, a);
      tl.fromTo('#car1 .verdict', { height: 0 }, { height: 54, duration: 0.4, ease: 'back.out(1.6)' }, a);
      tl.to('#car3', { opacity: 0.35, duration: 0.4 }, a);
      tl.to(['#eq1', '#eq2'], { opacity: 0.2, duration: 0.4 }, a);
      tl.to('#car2', { borderColor: '#00B140', duration: 0.3 }, ap);
      tl.fromTo('#car2 .verdict', { height: 0 }, { height: 54, duration: 0.4, ease: 'back.out(1.6)' }, ap);
      tl.fromTo('#car2', { scale: 1 }, { scale: 1.05, duration: 0.25, yoyo: true, repeat: 1 }, ap + 0.2);
    }

    // --- d-protocol
    {
      const b = B['d-protocol'];
      up('#d-protocol .dkicker', b);
      up('#d-protocol .dtitle', b + 0.12);
      gsap.set(['#p1', '#p2', '#p3'], { '--lit': 0 });
      IN('#p1', b + 0.45, { x: -60 }, { duration: 0.7 }); lit('#p1', b + 0.8);
      pop('#p1 .ck', b + 1.2);
      const s2 = shot(33) - 0.2;
      IN('#p2', s2, { x: -60 }, { duration: 0.7 }); lit('#p2', s2 + 0.35); tl.to('#p1', { '--lit': 0.25, duration: 0.5 }, s2 + 0.35);
      pop('#p2 .ck', s2 + 0.7);
      const w = shot(34) - 0.2;
      IN('#pw', w, { x: -60, scale: 0.97 }, { duration: 0.6 });
      tl.fromTo('#pw', { backgroundColor: 'rgba(255,90,78,0.14)' }, { backgroundColor: 'rgba(255,90,78,0.32)', duration: 0.2, yoyo: true, repeat: 3, ease: 'none' }, w + 0.6);
      const s3 = shot(35) - 0.2;
      IN('#p3', s3, { x: -60 }, { duration: 0.7 }); lit('#p3', s3 + 0.35); tl.to('#p2', { '--lit': 0.25, duration: 0.5 }, s3 + 0.35);
      pop('#p3 .ck', s3 + 0.7);
    }

    // --- r-counter
    {
      const b = B['r-counter'];
      up('#r-counter .kicker', b);
      up('#cnt-big', b + 0.1);
      counter(q('#cnt-big'), b + 0.15, 3000000, 2.0, (v) => comma(v) + (v >= 2999999 ? '+' : ''));
      up('#r-counter .h-md', b + 0.5);
      qa('#units .u').forEach((u, i) => IN(u, b + 0.9 + i * 0.045, { scale: 0.3, y: 10 }, { duration: 0.35, ease: 'back.out(2)' }));
      up('#r-counter .units-note', b + 2.4);
    }

    // --- r-shifts
    {
      const b = B['r-shifts'];
      up('#r-shifts .kicker', b);
      up('#r-shifts .h-lg', b + 0.1);
      const i1 = Math.max(cue('s37_i1') - 0.3, b + 0.5), i2 = cue('s37_i2') - 0.3;
      left('#sh1', i1); pop('#sh1 .down', i1 + 0.3);
      left('#sh2', i2); pop('#sh2 .down', i2 + 0.3);
      left('#sh3', i2 + 0.9); pop('#sh3 .down', i2 + 1.2);
    }

    // --- r-verify
    {
      const b = B['r-verify'];
      up('#r-verify .kicker', b);
      up('#r-verify .h-lg', b + 0.1);
      IN('#vc1', b + 0.3, { y: 40 }, { duration: 0.6 });
      tl.fromTo('#vc1 .booklet', { rotation: -8, y: -20 }, { rotation: 0, y: 0, duration: 0.7, ease: 'bounce.out' }, b + 0.45);
      const p = cue('s38_portal') - 0.35;
      IN('#vc2', p, { y: 40 }, { duration: 0.6 });
      pop('#vc2 .ok', p + 0.6);
    }

    // --- d-matrix
    {
      const b = B['d-matrix'];
      up('#d-matrix .dkicker', b);
      up('#d-matrix .dtitle', b + 0.12);
      const cols = ['#sc1', '#sc2', '#sc3'];
      gsap.set(cols, { '--lit': 0 });
      cols.forEach((c, i) => IN(c, b + 0.35 + i * 0.12, { y: 40 }, { opacity: 0.35, duration: 0.6 }));
      cols.forEach((c) => hide([c + ' .ttl', c + ' .tx']));
      const litCol = (c, t) => {
        tl.to(c, { opacity: 1, duration: 0.4 }, t);
        lit(c, t);
        tl.fromTo(c, { scale: 1 }, { scale: 1.025, duration: 0.3, yoyo: true, repeat: 1 }, t);
        up(c + ' .ttl', t + 0.15);
        up(c + ' .tx', t + 0.4);
      };
      litCol('#sc1', Math.max(shot(39) + 0.2, b + 0.9));
      IN('#sc1b', shot(40) - 0.1, { y: 30, scale: 0.9 }, { ease: 'back.out(1.8)', duration: 0.6 });
      litCol('#sc2', shot(41) - 0.1);
      up('#sc2 .note-sm', shot(41) + 1.4);
      litCol('#sc3', shot(42) - 0.1);
      [['#sc1', shot(41) - 0.1], ['#sc2', shot(42) - 0.1]].forEach(([c, t]) => tl.to(c, { '--lit': 0.3, duration: 0.5 }, t));
    }

    // --- r-fineprint
    {
      const b = B['r-fineprint'];
      up('#r-fineprint .kicker', b);
      IN('#doc1', b + 0.2, { y: 40, rotation: -3 }, { rotation: 0, duration: 0.6 });
      IN('#r-fineprint .vs-tag', b + 0.45, {}, { duration: 0.4 });
      IN('#doc2', b + 0.55, { y: 40, rotation: 3 }, { rotation: 0, duration: 0.6 });
      const m = cue('s43_mag') - 0.7;
      IN('#mag', m, { x: 240, y: 140, rotation: 20 }, { rotation: 0, duration: 0.9, ease: 'power3.out' });
      tl.to('#mag', { x: -20, y: 26, duration: 3.0, ease: 'sine.inOut' }, m + 0.9);
      up('#fp-line', m + 0.5);
    }

    // --- r-leaving
    {
      const b = B['r-leaving'];
      up('#r-leaving .kicker', b);
      left('#lv-rule', b + 0.15);
      up('#lv-head', shot(45) - 0.2);
      [['#lv1', 's45_e1'], ['#lv2', 's45_e2'], ['#lv3', 's45_e3']].forEach(([s, c]) => {
        const t = cue(c) - 0.3;
        left(s, t); pop(s + ' .n', t + 0.1);
      });
    }

    // --- d-flow
    {
      const b = B['d-flow'];
      up('#d-flow .dkicker', b);
      up('#d-flow .dtitle', b + 0.12);
      gsap.set(['#fl1', '#fl2', '#fl3'], { '--lit': 0 });
      IN('#fl1', b + 0.45, { y: 40 }, { duration: 0.6 }); lit('#fl1', b + 0.8);
      const f2 = cue('s46_f2') - 0.4, f3 = cue('s46_f3') - 0.5;
      IN('#fa1', f2 - 0.2, { x: -30 }, { duration: 0.4 });
      IN('#fl2', f2, { y: 40 }, { duration: 0.6 }); lit('#fl2', f2 + 0.3);
      IN('#fa2', f3 - 0.2, { x: -30 }, { duration: 0.4 });
      IN('#fl3', f3, { y: 40 }, { duration: 0.6 }); lit('#fl3', f3 + 0.3);
    }

    // --- r-oep
    {
      const b = B['r-oep'];
      up('#r-oep .kicker', b);
      qa('#year .m').forEach((m, i) => up(m, b + 0.15 + i * 0.05, { duration: 0.35 }));
      qa('#year .m.oep .f').forEach((f, i) => IN(f, b + 0.9 + i * 0.12, { scaleY: 0, opacity: 1, transformOrigin: '50% 100%' }, { duration: 0.5 }));
      qa('#year .m.aep .f').forEach((f, i) => IN(f, b + 1.4 + i * 0.12, { scaleY: 0, opacity: 1, transformOrigin: '50% 100%' }, { opacity: 0.85, duration: 0.5 }));
      up('#yl-oep', b + 1.2); up('#yl-aep', b + 1.7);
      IN('#oep-card', b + 2.0, { y: 40, scale: 0.97 }, { duration: 0.6 });
    }

    // --- r-partd
    {
      const b = B['r-partd'];
      up('#r-partd .kicker', b);
      up('#r-partd .h-lg', b + 0.1);
      left('#pd1', b + 0.4);
      left('#pd2', b + 1.4);
      left('#pd3', Math.max(cue('s48_budget') - 0.3, b + 2.2));
    }

    // --- r-equation
    {
      const b = B['r-equation'];
      up('#r-equation .kicker', b);
      left('#eq-a', b + 0.2); IN('#op1', b + 0.6, { scale: 0.4 }, { ease: 'back.out(2)', duration: 0.4 });
      left('#eq-b', b + 0.8); IN('#op2', b + 1.2, { scale: 0.4 }, { ease: 'back.out(2)', duration: 0.4 });
      left('#eq-c', b + 1.4);
      const r = cue('s49_eq') - 0.3;
      IN('#op3', r, { scale: 0.4 }, { ease: 'back.out(2)', duration: 0.4 });
      IN('#eq-d', r + 0.2, { scale: 0.85, y: 20 }, { ease: 'back.out(1.8)', duration: 0.6 });
    }

    // --- d-hack
    {
      const b = B['d-hack'];
      up('#d-hack .dkicker', b);
      up('#d-hack .dtitle', b + 0.12);
      gsap.set(['#hb1', '#hb2'], { '--lit': 0 });
      const b1 = Math.max(cue('s50_box1') - 0.3, b + 0.5);
      IN('#hb1', b1, { x: -60 }, { duration: 0.7 }); lit('#hb1', b1 + 0.3);
      const b2 = shot(51) - 0.1;
      IN('#hplus', b2, { scale: 0, rotation: -90 }, { rotation: 0, ease: 'back.out(2)', duration: 0.5 });
      IN('#hb2', b2 + 0.3, { x: 60 }, { duration: 0.7 }); lit('#hb2', b2 + 0.6);
      IN('#hr1', shot(52) - 0.1, { y: 30 }, { duration: 0.6 });
      IN('#hr2', shot(53) - 0.1, { y: 30 }, { duration: 0.6 });
    }

    // --- r-cta
    {
      const b = B['r-cta'];
      IN('#cta-card', b, { y: 40 }, { duration: 0.7 });
      const g = cue('s54_guide') - 0.3;
      IN('#cta-bubble', g, { scale: 0.6, y: 30, transformOrigin: '0% 100%' }, { ease: 'back.out(2)', duration: 0.6 });
      tl.to('#cta-bubble', { keyframes: [{ rotation: -3, duration: 0.1 }, { rotation: 3, duration: 0.1 }, { rotation: 0, duration: 0.1 }] }, g + 0.7);
    }

    // --- outro card
    {
      const b = oT + 0.5;
      IN('#o-logo', b, { scale: 0.8, y: 30 }, { ease: 'back.out(1.6)', duration: 0.8 });
      IN('#o-rule', b + 0.7, { scaleX: 0, opacity: 1 }, { duration: 0.8, ease: 'power3.inOut' });
      up('#o-guide', b + 0.9);
      up('#o-contact', b + 1.15);
      up('#o-legal', b + 1.4);
    }

    tl.set({}, {}, T.duration);   // pad timeline to full length
    window.__tl = tl;
  }

  /* ------------------------------------------------------------------ */
  function apply() {
    const cR = q('#canvasR'), dv = q('#divider');
    cR.style.transform = `translateX(${cv.x}px)`;
    dv.style.transform = `translateX(${cv.x}px)`;
    const dsEl = q('#dataStage'), dsEdge = q('#dsEdge');
    dsEl.style.clipPath = `inset(0 ${ds.R}% 0 ${ds.L}%)`;
    const dsMoving = (ds.L > 0 && ds.L < 100) || (ds.R > 0 && ds.R < 100);
    dsEdge.style.display = dsMoving ? 'block' : 'none';
    if (dsMoving) dsEdge.style.left = ((ds.L > 0 ? ds.L : 100 - ds.R) * 19.2 - 2) + 'px';
    const oEl = q('#outro'), oEdge = q('#oEdge');
    oEl.style.clipPath = `inset(0 0 0 ${oc.L}%)`;
    const oMoving = oc.L > 0 && oc.L < 100;
    oEdge.style.display = oMoving ? 'block' : 'none';
    if (oMoving) oEdge.style.left = (oc.L * 19.2 - 2) + 'px';
    q('#pill-num').style.width = pill.nw + 'px';
    q('#pill-lbl').style.width = pill.lw + 'px';
    counters.forEach((c) => { c.el.textContent = c.fmt(c.o.v); });
  }

  window.renderAt = function (t) {
    tl.time(t, false);
    apply();
    const covered = (ds.L <= 0.01 && ds.R <= 0.01) || oc.L <= 0.01;
    return { cx: +av.cx.toFixed(2), top: +av.top.toFixed(2), scale: +av.scale.toFixed(5), hidden: covered };
  };

  // Simple scrub preview: index.html?preview&t=12.3
  window.__ready.then(() => {
    if (params.has('t')) window.renderAt(parseFloat(params.get('t')));
  });
})();
