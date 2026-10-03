# -*- coding: utf-8 -*-
"""
Genera sprites/manifest.js a partir de los archivos que existen de verdad en sprites/.

  python tools/build_manifest.py

Formato (docs/DISENO.md 4.4):
  window.BB = window.BB || {};
  BB.SPRITES = { "hero_arquera": { "src": "sprites/heroes/arquera.png", "w": 300, "h": 384, "facing": "left" }, ... };
w/h = tamano real del archivo; "facing" solo en sprites con orientacion (heroes, enemigos, jefes,
castillo y algunas torres). Los recursos que aun no existen no aparecen (BB.assets.get -> null).
"""
import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from assets import ASSETS, ROOT, SPRITES_DIR  # noqa: E402

MANIFEST = SPRITES_DIR / "manifest.js"


def main():
    entries = []
    missing = []
    for a in ASSETS:
        p = ROOT / a["out"]
        if not p.exists():
            missing.append(a["key"])
            continue
        with Image.open(p) as im:
            w, h = im.size
        e = {"src": a["out"].replace("\\", "/"), "w": w, "h": h}
        if a.get("facing"):
            e["facing"] = a["facing"]
        for extra, _ in a.get("extra_out", []):
            ep = ROOT / extra
            if ep.exists():
                with Image.open(ep) as im:
                    e[f"src{im.size[0]}"] = extra.replace("\\", "/")
        entries.append((a["key"], e))
    lines = ["/* Generado por tools/build_manifest.py - no editar a mano */",
             "window.BB = window.BB || {};",
             "BB.SPRITES = {"]
    for i, (k, e) in enumerate(entries):
        comma = "," if i < len(entries) - 1 else ""
        lines.append(f"  {json.dumps(k)}: {json.dumps(e, ensure_ascii=False)}{comma}")
    lines.append("};")
    MANIFEST.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"{MANIFEST.relative_to(ROOT)}: {len(entries)} sprites, faltan {len(missing)}")
    if missing:
        print("  faltan: " + ", ".join(missing))
    return 0


if __name__ == "__main__":
    sys.exit(main())
