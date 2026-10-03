# -*- coding: utf-8 -*-
"""
Hojas de contacto para revisar los graficos a ojo.

  python tools/contact_sheet.py                  # una hoja por categoria -> tools/review/<categoria>.png
  python tools/contact_sheet.py --category heroes
  python tools/contact_sheet.py --raw            # originales de tools/raw/ -> tools/review/raw_<categoria>.png
  python tools/contact_sheet.py --variants enemy_troll   # alternativas -> tools/review/variants_<clave>.png

Cada sprite se dibuja sobre cuadros grises (deja ver halos blancos y bordes), con su id, su tamano,
una flecha con la orientacion que DEBE tener y avisos del procesado (en rojo).
"""
import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from assets import ASSETS, BY_KEY, CATEGORY_ORDER, RAW_DIR, REVIEW_DIR, TOOLS, out_path, raw_path  # noqa: E402

REPORT_FILE = TOOLS / "process_report.json"


def font(size):
    for name in ("arialbd.ttf", "arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def checker(w, h, s=12, c1=(150, 150, 150), c2=(112, 112, 112)):
    im = Image.new("RGB", (w, h), c1)
    d = ImageDraw.Draw(im)
    for y in range(0, h, s):
        for x in range((y // s) % 2 * s, w, 2 * s):
            d.rectangle([x, y, x + s - 1, y + s - 1], fill=c2)
    return im


def arrow(d, x, y, direction, color=(30, 110, 255)):
    """Flecha de 34x16 px con la punta hacia 'left' o 'right'."""
    if direction == "left":
        d.polygon([(x, y + 8), (x + 14, y), (x + 14, y + 5), (x + 34, y + 5), (x + 34, y + 11), (x + 14, y + 11), (x + 14, y + 16)], fill=color)
    else:
        d.polygon([(x + 34, y + 8), (x + 20, y), (x + 20, y + 5), (x, y + 5), (x, y + 11), (x + 20, y + 11), (x + 20, y + 16)], fill=color)


def flags_for(asset, rep):
    f = []
    if not rep:
        return f
    if rep.get("touches"):
        f.append("borde:" + ",".join(t[0] for t in rep["touches"]))
    if rep.get("big_parts", 1) > 1 and not asset.get("group"):
        f.append(f"{rep['big_parts']} piezas")
    if rep.get("method") == "rembg":
        f.append("rembg")
    if rep.get("rembg_disagree", 0) > 0.25:
        f.append(f"disc {rep['rembg_disagree']:.0%}")
    return f


def grid(cells, cols, cell_w, cell_h, title):
    rows = max(1, (len(cells) + cols - 1) // cols)
    head = 44
    sheet = Image.new("RGB", (cols * cell_w, head + rows * cell_h), (34, 34, 40))
    d = ImageDraw.Draw(sheet)
    d.text((10, 10), title, fill=(255, 255, 255), font=font(22))
    for i, cell in enumerate(cells):
        x, y = (i % cols) * cell_w, head + (i // cols) * cell_h
        sheet.paste(cell, (x, y))
    return sheet


def make_cell(img, label, sub, warn, facing, cell_w, cell_h, opaque=False, reviewed=None):
    pad, text_h = 6, 46
    box_w, box_h = cell_w - 2 * pad, cell_h - 2 * pad - text_h
    cell = Image.new("RGB", (cell_w, cell_h), (34, 34, 40))
    bg = checker(box_w, box_h) if not opaque else Image.new("RGB", (box_w, box_h), (60, 60, 66))
    if img is not None:
        im = img.copy()
        im.thumbnail((box_w, box_h), Image.LANCZOS)
        ox, oy = (box_w - im.size[0]) // 2, box_h - im.size[1] if not opaque else (box_h - im.size[1]) // 2
        if im.mode == "RGBA":
            bg.paste(im, (ox, oy), im)
        else:
            bg.paste(im.convert("RGB"), (ox, oy))
    cell.paste(bg, (pad, pad))
    d = ImageDraw.Draw(cell)
    if img is None:
        d.text((pad + 10, pad + box_h // 2), "FALTA", fill=(255, 80, 80), font=font(22))
    d.text((pad, cell_h - text_h + 2), label, fill=(255, 255, 255), font=font(15))
    d.text((pad, cell_h - text_h + 22), sub, fill=(170, 170, 180), font=font(12))
    if warn:
        d.text((pad + 2, pad + 2), " ".join(warn), fill=(255, 70, 70), font=font(13))
    if facing:
        arrow(d, cell_w - pad - 40, cell_h - text_h + 4, facing)
        if reviewed is not None:
            d.text((cell_w - pad - 58, cell_h - text_h + 2), "ok" if reviewed else "?",
                   fill=(90, 220, 90) if reviewed else (255, 200, 0), font=font(15))
    return cell


def sheet_final(cat, report):
    items = [a for a in ASSETS if a["cat"] == cat]
    if not items:
        return None
    opaque = not items[0]["transparent"]
    if cat in ("bg", "map", "ui"):
        cols, cw, ch = 3, 520, 300
    elif cat in ("bosses", "castle"):
        cols, cw, ch = 4, 330, 380
    else:
        cols, cw, ch = 5, 250, 300
    cells = []
    for a in items:
        p = out_path(a)
        img = Image.open(p) if p.exists() else None
        if img is not None:
            img.load()
        rep = report.get(a["key"], {})
        size = f"{img.size[0]}x{img.size[1]}" if img else "-"
        sub = f"{size} {rep.get('method', '')}" + (" flip" if rep.get("flip") else "")
        reviewed = rep.get("facing_reviewed") if a["facing"] else None
        cells.append(make_cell(img, a["key"], sub, flags_for(a, rep), a["facing"], cw, ch,
                               opaque=opaque, reviewed=reviewed))
    return grid(cells, cols, cw, ch, f"{cat} - {len(items)} recursos (flecha = orientacion correcta)")


def sheet_raw(cat):
    items = [a for a in ASSETS if a["cat"] == cat]
    cols, cw, ch = (3, 520, 300) if cat in ("bg", "map", "ui") else (5, 250, 300)
    cells = []
    for a in items:
        p = raw_path(a)
        img = Image.open(p).convert("RGB") if p else None
        meta = json.loads((RAW_DIR / f"{a['key']}.json").read_text(encoding="utf-8")) if p and (RAW_DIR / f"{a['key']}.json").exists() else {}
        sub = f"{meta.get('model', '')} s{meta.get('seed', '')}"
        cells.append(make_cell(img, a["key"], sub, [], a["facing"], cw, ch, opaque=True))
    return grid(cells, cols, cw, ch, f"RAW {cat}")


def sheet_variants(key):
    a = BY_KEY[key]
    vdir = RAW_DIR / "variants" / key
    files = sorted(p for p in vdir.glob("s*.*") if p.suffix != ".json")
    cells = []
    cw, ch = (520, 300) if a["cat"] in ("bg", "map", "ui") else (300, 340)
    for p in files:
        img = Image.open(p).convert("RGB")
        cells.append(make_cell(img, p.stem, key, [], a["facing"], cw, ch, opaque=True))
    cur = raw_path(a)
    if cur:
        cells.insert(0, make_cell(Image.open(cur).convert("RGB"), "ACTUAL", key, [], a["facing"], cw, ch, opaque=True))
    return grid(cells, 4 if cw < 400 else 3, cw, ch, f"variantes de {key} (--pick {key}=SEMILLA)")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--category")
    ap.add_argument("--raw", action="store_true")
    ap.add_argument("--variants")
    args = ap.parse_args()
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    report = json.loads(REPORT_FILE.read_text(encoding="utf-8")) if REPORT_FILE.exists() else {}
    if args.variants:
        for key in args.variants.split(","):
            s = sheet_variants(key.strip())
            p = REVIEW_DIR / f"variants_{key.strip()}.png"
            s.save(p)
            print(p)
        return 0
    cats = args.category.split(",") if args.category else CATEGORY_ORDER
    for cat in cats:
        s = sheet_raw(cat) if args.raw else sheet_final(cat, report)
        if s is None:
            continue
        p = REVIEW_DIR / (f"raw_{cat}.png" if args.raw else f"{cat}.png")
        s.save(p)
        print(p)
    return 0


if __name__ == "__main__":
    sys.exit(main())
