#!/usr/bin/env python3
"""Key the green-screen avatar, place it on the stage, overlay the rendered graphics, encode.

  python3 render/composite.py video  --frames build/frames --out ../output/video.mp4
  python3 render/composite.py stills --stills build/stills  --out build/review

Layer order per frame:  backdrop plate (panned with the avatar)  ->  keyed avatar  ->  graphics (RGBA).
Avatar placement (cx, top, scale) comes from the composition's own timeline (states_*.json).
"""
import argparse
import glob
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
REPO = ROOT.parent
W, H = 1920, 1080
SRC_W, SRC_H = 1080, 1920

# Chroma key thresholds on (G - max(R, B)), 8-bit units. Background ~ +110..+125, subject <= ~0.
KEY_LO, KEY_HI = 18, 70
FEATHER = 22  # px soft edge where the source frame's left/right border falls inside the picture


def load_timeline():
    return json.loads((ROOT / "timing/timeline.json").read_text())


def bt709_decode_cmd(tl, start_frame=0):
    files = [str(REPO / c["file"]) for c in tl["clips"]]
    cmd = ["ffmpeg", "-v", "error"]
    for f in files:
        cmd += ["-i", f]
    chain = "".join(f"[{i}:v]" for i in range(len(files)))
    flt = (f"{chain}concat=n={len(files)}:v=1:a=0,"
           "scale=in_color_matrix=bt709:in_range=tv:out_range=full,format=bgr24")
    if start_frame:
        flt += f",trim=start_frame={start_frame},setpts=PTS-STARTPTS"
    cmd += ["-filter_complex", flt, "-f", "rawvideo", "-pix_fmt", "bgr24", "-"]
    return cmd


def key_and_place(src_bgr, st):
    """Warp the source frame into stage space and return (bgr, alpha[0..1], x0, x1) for the covered columns."""
    s, cx, top = st["scale"], st["cx"], st["top"]
    left = cx - SRC_W * s / 2.0
    x0 = max(0, int(np.floor(left)))
    x1 = min(W, int(np.ceil(left + SRC_W * s)))
    if x1 <= x0:
        return None
    M = np.float32([[s, 0, left - x0], [0, s, top]])
    warped = cv2.warpAffine(src_bgr, M, (x1 - x0, H), flags=cv2.INTER_LINEAR,
                            borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 255, 0))
    b, g, r = [warped[..., i].astype(np.int16) for i in range(3)]
    mx = np.maximum(r, b)
    spill = g - mx
    alpha = np.clip((KEY_HI - spill) / float(KEY_HI - KEY_LO), 0.0, 1.0).astype(np.float32)
    # despill: clamp green to the stronger of red/blue
    warped[..., 1] = np.minimum(g, mx).astype(np.uint8)
    # soften the hard vertical border of the source frame where it falls inside the picture
    cols = np.arange(x0, x1, dtype=np.float32) + 0.5
    ramp = np.ones_like(cols)
    if left > 2:
        ramp = np.minimum(ramp, np.clip((cols - left) / FEATHER, 0, 1))
    right = left + SRC_W * s
    if right < W - 2:
        ramp = np.minimum(ramp, np.clip((right - cols) / FEATHER, 0, 1))
    alpha *= ramp[None, :]
    return warped, alpha, x0, x1


def compose(bg_plate, src_bgr, fg_rgba, st):
    cx = st["cx"]
    off = int(round(min(max(1200 - cx, 0), bg_plate.shape[1] - W)))
    out = bg_plate[:, off:off + W].astype(np.float32)
    if src_bgr is not None and not st.get("hidden"):
        placed = key_and_place(src_bgr, st)
        if placed is not None:
            av, a, x0, x1 = placed
            a3 = a[..., None]
            out[:, x0:x1] = out[:, x0:x1] * (1.0 - a3) + av.astype(np.float32) * a3
    if fg_rgba is not None:
        fa = fg_rgba[..., 3:4].astype(np.float32) / 255.0
        out = out * (1.0 - fa) + fg_rgba[..., :3].astype(np.float32) * fa
    return np.clip(out + 0.5, 0, 255).astype(np.uint8)


def read_fg(path):
    im = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if im is None:
        raise FileNotFoundError(path)
    if im.shape[2] == 3:
        im = np.dstack([im, np.full(im.shape[:2], 255, np.uint8)])
    return im


def load_states(frames_dir, total):
    states = [None] * total
    for f in sorted(glob.glob(str(Path(frames_dir) / "states_*.json"))):
        d = json.loads(Path(f).read_text())
        for i, s in enumerate(d["states"]):
            if s is not None:
                states[d["from"] + i] = s
    missing = [i for i, s in enumerate(states) if s is None]
    if missing:
        raise SystemExit(f"missing avatar states for {len(missing)} frames (first {missing[0]})")
    return states


def build_audio(tl, out_wav):
    files = [str(REPO / c["file"]) for c in tl["clips"]]
    cmd = ["ffmpeg", "-v", "error", "-y"]
    for f in files:
        cmd += ["-i", f]
    parts = []
    for i, c in enumerate(tl["clips"]):
        dur = c["frames"] / tl["fps"]
        parts.append(f"[{i}:a]atrim=0:{dur:.3f},asetpts=PTS-STARTPTS[a{i}]")
    chain = "".join(f"[a{i}]" for i in range(len(files)))
    flt = ";".join(parts) + f";{chain}concat=n={len(files)}:v=0:a=1,apad=whole_dur={tl['duration']:.3f}[a]"
    cmd += ["-filter_complex", flt, "-map", "[a]", "-ar", "48000", "-ac", "2", out_wav]
    subprocess.check_call(cmd)


def run_video(args):
    tl = load_timeline()
    total = tl["totalFrames"]
    avatar_frames = sum(c["frames"] for c in tl["clips"])
    states = load_states(args.frames, total)
    bg_plate = cv2.imread(str(args.bg), cv2.IMREAD_COLOR)

    wav = Path(args.frames) / "audio.wav"
    build_audio(tl, str(wav))

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    enc = subprocess.Popen([
        "ffmpeg", "-v", "error", "-y",
        "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(tl["fps"]), "-i", "-",
        "-i", str(wav),
        "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
        "-c:v", "libx264", "-preset", args.preset, "-crf", str(args.crf), "-tune", "film",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
        "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", args.out,
    ], stdin=subprocess.PIPE)
    dec = subprocess.Popen(bt709_decode_cmd(tl), stdout=subprocess.PIPE, bufsize=SRC_W * SRC_H * 3 * 2)

    frame_bytes = SRC_W * SRC_H * 3
    t0 = time.time()
    for f in range(total):
        src = None
        if f < avatar_frames:
            buf = dec.stdout.read(frame_bytes)
            if len(buf) == frame_bytes:
                src = np.frombuffer(buf, np.uint8).reshape(SRC_H, SRC_W, 3).copy()
        fg = read_fg(Path(args.frames) / f"fg_{f:06d}.png")
        enc.stdin.write(compose(bg_plate, src, fg, states[f]).tobytes())
        if f % 250 == 0 and f:
            el = time.time() - t0
            print(f"{f}/{total} frames  {f / el:.1f} fps  eta {(total - f) / (f / el) / 60:.1f} min", flush=True)
    enc.stdin.close()
    dec.stdout.close()
    dec.wait()
    if enc.wait() != 0:
        sys.exit("encoder failed")
    print("wrote", args.out)


def run_stills(args):
    tl = load_timeline()
    bg_plate = cv2.imread(str(args.bg), cv2.IMREAD_COLOR)
    states = json.loads((Path(args.stills) / "states.json").read_text())
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    avatar_frames = sum(c["frames"] for c in tl["clips"])
    tiles = []
    for t_str, st in sorted(states.items(), key=lambda kv: float(kv[0])):
        t = float(t_str)
        f = int(round(t * tl["fps"]))
        src = None
        if f < avatar_frames:
            clip = [c for c in tl["clips"] if c["offset"] * tl["fps"] <= f + 0.5][-1]
            local = (f - round(clip["offset"] * tl["fps"])) / tl["fps"]
            raw = subprocess.check_output([
                "ffmpeg", "-v", "error", "-ss", f"{local:.3f}", "-i", str(REPO / clip["file"]),
                "-frames:v", "1", "-vf", "scale=in_color_matrix=bt709:in_range=tv:out_range=full,format=bgr24",
                "-f", "rawvideo", "-pix_fmt", "bgr24", "-"])
            src = np.frombuffer(raw[:SRC_W * SRC_H * 3], np.uint8).reshape(SRC_H, SRC_W, 3).copy()
        fg = read_fg(Path(args.stills) / f"still_{t:.2f}.png")
        img = compose(bg_plate, src, fg, st)
        cv2.imwrite(str(out / f"review_{t:07.2f}.jpg"), img, [cv2.IMWRITE_JPEG_QUALITY, 90])
        tiles.append(cv2.resize(img, (480, 270), interpolation=cv2.INTER_AREA))
    cols = 4
    while len(tiles) % cols:
        tiles.append(np.zeros_like(tiles[0]))
    rows = [np.hstack(tiles[i:i + cols]) for i in range(0, len(tiles), cols)]
    cv2.imwrite(str(out / "contact_sheet.jpg"), np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 88])
    print("wrote", len(states), "review frames to", out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["video", "stills"])
    ap.add_argument("--frames", default=str(ROOT / "build/frames"))
    ap.add_argument("--stills", default=str(ROOT / "build/stills"))
    ap.add_argument("--bg", default=str(ROOT / "build/bg.png"))
    ap.add_argument("--out", required=True)
    ap.add_argument("--crf", type=int, default=18)
    ap.add_argument("--preset", default="medium")
    args = ap.parse_args()
    (run_video if args.mode == "video" else run_stills)(args)


if __name__ == "__main__":
    main()
