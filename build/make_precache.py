"""Genera precache-list.js con todos los archivos del juego para el service worker (PWA).

Uso:  python build/make_precache.py
Se ejecuta antes de publicar (GitHub Pages) o de empaquetar el APK.
"""
import hashlib
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INCLUDE_DIRS = ["css", "js", "sprites"]
INCLUDE_FILES = ["index.html", "manifest.webmanifest"]
EXTS = {".html", ".css", ".js", ".png", ".jpg", ".jpeg", ".webp", ".webmanifest", ".json", ".svg"}


def main():
    files = []
    for f in INCLUDE_FILES:
        if os.path.exists(os.path.join(ROOT, f)):
            files.append(f)
    for d in INCLUDE_DIRS:
        base = os.path.join(ROOT, d)
        for dirpath, _dirs, names in os.walk(base):
            for name in sorted(names):
                if os.path.splitext(name)[1].lower() not in EXTS:
                    continue
                rel = os.path.relpath(os.path.join(dirpath, name), ROOT).replace("\\", "/")
                files.append(rel)
    files = sorted(set(files))
    h = hashlib.sha1()
    for rel in files:
        st = os.stat(os.path.join(ROOT, rel))
        h.update(f"{rel}:{st.st_size}:{int(st.st_mtime)}".encode())
    version = h.hexdigest()[:10]
    out = ["./"] + files
    js = ("/* Generado por build/make_precache.py */\n"
          f"self.PRECACHE_VERSION = {json.dumps(version)};\n"
          f"self.PRECACHE_LIST = {json.dumps(out, ensure_ascii=False, indent=0)};\n")
    with open(os.path.join(ROOT, "precache-list.js"), "w", encoding="utf-8") as fh:
        fh.write(js)
    print(f"precache-list.js: {len(out)} archivos, versión {version}")


if __name__ == "__main__":
    main()
