#!/usr/bin/env bash
# Full rebuild of the 16:9 video from the two avatar clips in the repo root.
#   ./production/build.sh            -> output/Dont-Switch-Your-Medicare-Plan_2027_16x9.mp4
# Requires: ffmpeg, node + playwright (Chromium), python3 + numpy + opencv-python-headless.
set -euo pipefail
cd "$(dirname "$0")"

OUT="${1:-../output/Dont-Switch-Your-Medicare-Plan_2027_16x9.mp4}"
WORKERS="${WORKERS:-3}"

python3 timing/align.py                                   # shot + cue times from the transcripts
node render/render_frames.cjs bg build/bg.png             # speaker backdrop plate
node render/render_frames.cjs frames build/frames --workers "$WORKERS"   # graphics layer (RGBA) + avatar placement
python3 render/composite.py video --out "$OUT"            # key avatar, composite, encode with original audio
echo "done: $OUT"
