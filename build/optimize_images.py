"""Reduce el peso de sprites/ para el móvil sin pérdida visible.
Convierte cada PNG/JPG de sprites/ a WebP (con transparencia) y actualiza sprites/manifest.js.
Los originales se guardan en tools/sprites_full/ (la primera vez) y se usan siempre como fuente.

Orden al regenerar gráficos:
  python tools/build_manifest.py   (necesita los PNG: restaura con --restore si hace falta)
  python build/optimize_images.py
  python build/make_precache.py
Uso: python build/optimize_images.py [--restore]
"""
import os, re, shutil, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, "sprites")
BACKUP = os.path.join(ROOT, "tools", "sprites_full")
MANIFEST = os.path.join(SPR, "manifest.js")
APP_ICONS = ("app_icon_192.png", "app_icon_512.png")  # el manifiesto PWA los pide en PNG


def restore():
    for dirpath, _d, files in os.walk(BACKUP):
        for name in files:
            src = os.path.join(dirpath, name)
            rel = os.path.relpath(src, BACKUP)
            dst = os.path.join(SPR, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(src, dst)
            webp = os.path.splitext(dst)[0] + ".webp"
            if os.path.exists(webp):
                os.remove(webp)
    print("originales restaurados en sprites/")


def main():
    before = after = 0
    converted = {}
    for dirpath, _d, files in os.walk(SPR):
        for name in files:
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(path, SPR).replace("\\", "/")
            ext = os.path.splitext(name)[1].lower()
            if ext not in (".png", ".jpg", ".jpeg") or name in APP_ICONS:
                continue
            bk = os.path.join(BACKUP, rel)
            if not os.path.exists(bk):
                os.makedirs(os.path.dirname(bk), exist_ok=True)
                shutil.copy2(path, bk)
            before += os.path.getsize(bk)
            img = Image.open(bk)
            out = os.path.splitext(path)[0] + ".webp"
            if ext == ".png":
                img.convert("RGBA").save(out, "WEBP", quality=88, method=6, alpha_quality=95)
            else:
                img.convert("RGB").save(out, "WEBP", quality=84, method=6)
            after += os.path.getsize(out)
            os.remove(path)
            converted["sprites/" + rel] = "sprites/" + os.path.splitext(rel)[0] + ".webp"
    if os.path.exists(MANIFEST):
        txt = open(MANIFEST, encoding="utf-8").read()
        for a, b in converted.items():
            txt = txt.replace('"' + a + '"', '"' + b + '"')
        open(MANIFEST, "w", encoding="utf-8").write(txt)
    print(f"{len(converted)} imágenes a WebP: {before/1e6:.1f} MB -> {after/1e6:.1f} MB")


if __name__ == "__main__":
    restore() if "--restore" in sys.argv else main()
