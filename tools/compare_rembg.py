# -*- coding: utf-8 -*-
"""
Compara modelos de rembg (y el metodo combinado de process.py) sobre varias imagenes.

  python tools/compare_rembg.py                      # usa algunos originales de tools/raw/
  python tools/compare_rembg.py img1.jpg img2.png    # imagenes concretas
  python tools/compare_rembg.py --keys hero_sacerdote,enemy_troll

Resultado: tools/review/rembg_compare.png (una fila por imagen: original | modelos | combinado).
"""
import truststore
truststore.inject_into_ssl()

import argparse
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from assets import BY_KEY, RAW_DIR, REVIEW_DIR, raw_path  # noqa: E402
from contact_sheet import checker, font  # noqa: E402
import process  # noqa: E402

MODELS = ["isnet-anime", "u2net", "isnet-general-use", "birefnet-general-lite"]


def cutout(rgb_img, alpha):
    arr = np.dstack([np.asarray(rgb_img, dtype=np.uint8), (np.clip(alpha, 0, 1) * 255).astype(np.uint8)])
    return Image.fromarray(arr, "RGBA")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="*")
    ap.add_argument("--keys")
    ap.add_argument("--models", default=",".join(MODELS))
    ap.add_argument("--out", default=str(REVIEW_DIR / "rembg_compare.png"))
    args = ap.parse_args()
    paths = [Path(f) for f in args.files]
    if args.keys:
        paths += [raw_path(BY_KEY[k]) for k in args.keys.split(",")]
    if not paths:
        paths = sorted(p for p in RAW_DIR.glob("*.*") if p.suffix in (".png", ".jpg", ".webp"))[:6]
    models = args.models.split(",")
    from rembg import new_session, remove
    sessions = {m: new_session(m) for m in models}
    cell = 260
    cols = 2 + len(models)
    sheet = Image.new("RGB", (cols * cell, 30 + len(paths) * (cell + 22)), (34, 34, 40))
    d = ImageDraw.Draw(sheet)
    for j, name in enumerate(["original"] + models + ["combinado"]):
        d.text((j * cell + 6, 6), name, fill=(255, 255, 255), font=font(15))
    times = {m: [] for m in models}
    for i, p in enumerate(paths):
        rgb_img = Image.open(p).convert("RGB")
        rgb = np.asarray(rgb_img, dtype=np.float32) / 255.0
        y = 30 + i * (cell + 22)
        tiles = [rgb_img.convert("RGBA")]
        masks = {}
        for m in models:
            t0 = time.time()
            mk = remove(rgb_img, session=sessions[m], only_mask=True, post_process_mask=False).convert("L")
            times[m].append(time.time() - t0)
            masks[m] = np.asarray(mk.resize(rgb_img.size), dtype=np.float32) / 255.0
            tiles.append(cutout(rgb_img, masks[m]))
        rep = {}
        alpha, bg = process.matte_combo(rgb, masks[models[0]], dict(process.DEFAULTS), rep)
        alpha = process.clean_islands(alpha, process.DEFAULTS, rep, False)
        rgb2 = process.decontaminate(rgb, alpha, bg)
        tiles.append(cutout(Image.fromarray((rgb2 * 255).astype(np.uint8)), alpha))
        for j, t in enumerate(tiles):
            bgc = checker(cell - 8, cell - 8)
            t = t.copy()
            t.thumbnail((cell - 8, cell - 8), Image.LANCZOS)
            bgc.paste(t, ((cell - 8 - t.size[0]) // 2, (cell - 8 - t.size[1]) // 2), t)
            sheet.paste(bgc, (j * cell + 4, y))
        d.text((6, y + cell - 4), p.name, fill=(200, 200, 200), font=font(13))
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    sheet.save(args.out)
    print(args.out)
    for m in models:
        print(f"{m}: {np.mean(times[m]):.1f} s/imagen")


if __name__ == "__main__":
    main()
