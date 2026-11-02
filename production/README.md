# 16:9 Production: "Don't Switch Your Medicare Plan Until You Watch This" (2027)

This folder builds the finished 1920×1080 explainer from the two green-screen avatar clips in the repo root
(`Avatar Video_1080p.mp4` covers shots 1–35 and `Avatar Video_1080p (1).mp4` covers shots 36–54). The graphics
follow the USAFacts-style graphic stage blueprint.

**Output:** `output/Dont-Switch-Your-Medicare-Plan_2027_16x9.mp4` (H.264 + AAC, 25 fps, about 7:14, stored with Git LFS)

## Design system

| Element | Spec |
|---|---|
| 50/50 split stage | Arric keyed on the left half. A 2px `#00B140` divider separates him from the `#F9FAF8` canvas on the right, which uses `#0A2540` navy type |
| Full-screen data stage | `#0B192C` slate grid with emerald and blue glow accents. Wipes in from the right with a green leading edge |
| Full-screen speaker | Shots 1 (first 2 s) and 9 (with the "One Wrong Move Can Be Permanent" lower third) |
| Chapter pill (top-left) | `INTRO`, then `1 \| Medigap Rules & Underwriting`, `2 \| Plan G vs. Plan N vs. HD-G`, `3 \| How to Safely Switch Medigap`, `4 \| Medicare Advantage Disruptions`, `5 \| Part D & The Rate Increase Hack` |
| Agency bar (bottom-left) | `ALLEN & ASSOCIATES \| MAKING MEDICARE EASY` |
| Type | Archivo (display, variable width) and Inter (body). Both are vendored in `assets/fonts` |

## How it's built

1. **`timing/align.py`** reads the word-level transcripts in `timing/transcript_clip*.json` (ElevenLabs Scribe)
   and finds each shot's opening words and every on-screen cue phrase listed in `script/shots.json`. It writes
   `timing/timeline.json` and `timing/timeline.js`, so every graphic lands on the spoken word.
2. **`composition/`** is the graphic stage: HTML/CSS plus one GSAP master timeline (`timeline.js`).
   `renderAt(t)` seeks the timeline deterministically and returns where the avatar should sit (`cx`, `top`, `scale`).
3. **`render/render_frames.cjs`** uses headless Chromium to render the graphics layer as RGBA PNG frames, plus a
   one-time backdrop plate.
4. **`render/composite.py`** decodes both clips (BT.709) and chroma-keys the green screen with despill and soft
   source edges. It places Arric on the panned backdrop, lays the graphics on top, and encodes the result with the
   original audio. A 5-second tail holds the outro card.

```bash
./production/build.sh
```

Review frames without a full render:

```bash
node render/render_frames.cjs stills build/stills 19.0,181.5,426.3
python3 render/composite.py stills --out build/review
```

## Editing

- **On-screen text:** edit `composition/index.html`. Animation timing is in `composition/timeline.js`.
- **Retiming:** change a cue phrase in `script/shots.json`, then re-run `timing/align.py`.
- **Logo:** put the agency logo at `production/assets/logo.png`. It replaces the "A&A" monogram on the brand card and the outro.
- **Preview in a browser:** serve `production/` and open `composition/index.html?preview&t=<seconds>`.

## Deliberate deviations from the blueprint

- **Shot 43:** the full-detail plan document is labeled **Evidence of Coverage (EOC)**. An Explanation of Benefits
  (EOB) is a claims statement. To restore the blueprint wording, edit `#doc2` in `index.html`.
- **Shot 21:** `$283` is footnoted as the 2026 Part B deductible, because CMS had not published the 2027 figure when this was built.
- **Shot 49:** the premium term reads `Monthly Premium × 12`, so the equation adds annual amounts.
- **Shot 17:** WV is shown in amber alongside IL and KY. It is not in the shot 16 green list, which matches the blueprint.
- **Shot 2:** a scale bar contrasts `≈ $480 a year saved` with `+$4,000+`.
