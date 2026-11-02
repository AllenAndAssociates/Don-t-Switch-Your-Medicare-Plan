---
name: allen-associates-brand
description: Official Allen & Associates Insurance Agency logo and brand rules. Use whenever creating or editing anything branded for Allen & Associates / Arric Allen — videos, thumbnails, slides, social graphics, web pages, PDFs, end cards — or when a design calls for "the logo", "our logo", or agency branding.
---

# Allen & Associates — Official Logo & Brand

## Logo files (in `assets/`)

| File | Use |
|---|---|
| `assets/logo.png` | Official logo, 577×181, on white. Use as-is on white or very light backgrounds. |
| `assets/logo-transparent.png` | White removed (RGBA). Use on light backgrounds (off-white `#F9FAF8`, light gray). |

The logo is: a blue/green four-part cross mark + **ALLEN &** (green) / **ASSOCIATES** (blue) /
**INSURANCE AGENCY** (green, spaced) / **MAKING MEDICARE EASY** (dark gray, spaced).

## Rules

- Always use the official file — never redraw, retype, recolor, stretch, or crop the logo, and never substitute a monogram when this file is available.
- **Dark backgrounds** (navy, slate, video data stages): place the logo on a white rounded card with padding (≥ 24px). The dark-gray tagline disappears on dark backgrounds otherwise.
- Keep clear space around the logo of at least the height of the "A" in ALLEN.
- Minimum width: 240px on screen so "MAKING MEDICARE EASY" stays legible.
- Scale proportionally only (aspect ratio 577:181 ≈ 3.19:1).

## Brand colors (sampled from the logo)

| Role | Hex |
|---|---|
| Logo blue | `#0A8CD4` |
| Logo green | `#5DB02A` |
| Tagline gray | `#313232` |

Video/graphic system used in the 2027 Medicare explainer (complements the logo):
navy `#0A2540`, accent green `#00B140`, paper `#F9FAF8`, data-stage slate `#0B192C`.

## Required text on Medicare marketing

- Agency name: **Allen & Associates Insurance Agency** · Tagline: **Making Medicare Easy**
- Contact: **800-324-9986** · **allenandassociates.agency**
- Compliance footer: *Not affiliated with or endorsed by the U.S. government or the federal Medicare program.*

## In this repo

The video pipeline auto-uses `production/assets/logo.png` in place of its placeholder monogram.
Copy `assets/logo.png` there and run `production/build.sh` to re-render with the official logo.
