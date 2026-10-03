# -*- coding: utf-8 -*-
"""
Procesa los originales de tools/raw/ y deja los sprites finales en sprites/.

  python tools/process.py                       # procesa lo que haya cambiado
  python tools/process.py --force               # reprocesa todo
  python tools/process.py --only troll,arquera  # recursos concretos (clave o id corto)
  python tools/process.py --category heroes
  python tools/process.py --flip arquera,troll  # invierte el volteo de esos recursos y reprocesa
  python tools/process.py --ok arquera          # marca la orientacion como revisada (sin cambiarla)
  python tools/process.py --method flood --only sacerdote   # fuerza un metodo de fondo (se guarda)

Sprites con transparencia (fondo blanco liso):
  1. Fondo exterior: relleno desde los bordes de los pixeles parecidos al color del fondo.
  2. Huecos interiores del color del fondo: se quitan si rembg (modelo u2net) dice que son fondo;
     si rembg dice que son personaje (ropa blanca, barba...) se conservan.
  3. Sombras grises pegadas al fondo que rembg considera fondo -> fuera.
  4. Borde: "color a alfa" contra el color del fondo en una franja de 2 px (sin halo blanco).
  5. Islas pequenas fuera; recorte al contenido; volteo si toca; reduccion con alfa premultiplicado.
  Si el fondo no es uniforme se usa la mascara de rembg directamente (metodo "rembg").
Fondos, mapa y portada: recorte tipo "cover" al tamano exacto y JPG.
"""
import truststore
truststore.inject_into_ssl()

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

sys.path.insert(0, str(Path(__file__).resolve().parent))
from assets import BY_KEY, RAW_DIR, REVIEW_DIR, ROOT, TOOLS, out_path, raw_path, select  # noqa: E402

OVERRIDES_FILE = TOOLS / "overrides.json"
REPORT_FILE = TOOLS / "process_report.json"
MASK_DIR = RAW_DIR / "masks"
DEFAULT_REMBG = "u2net"  # el mejor en la prueba con transparencia real (combo+u2net IoU 0.98)
VERSION = 6  # subir al cambiar el algoritmo (invalida la cache)

DEFAULTS = {
    "method": "auto",       # auto | combo | flood | rembg | alpha
    "rembg_model": DEFAULT_REMBG,
    "thr": 0.11,            # distancia (0..1) al color del fondo para considerarlo fondo
    "hole_vote": 0.5,       # huecos interiores: se quitan si la media de rembg < esto
    "shadow": True,         # quitar sombras grises que rembg marca como fondo
    "island_frac": 0.002,   # islas menores que esta fraccion del primer plano -> fuera
    "island_min": 150,      # ... o menores que estos pixeles (a resolucion original)
    "band": 2,              # ancho de la franja de borde con "color a alfa"
}


# ---------------------------------------------------------------------------
def load_json(path, default):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return default


def save_json(path, data):
    Path(path).write_text(json.dumps(data, indent=1, ensure_ascii=False, sort_keys=True), encoding="utf-8")


def sha1_file(p):
    return hashlib.sha1(Path(p).read_bytes()).hexdigest()


_sessions = {}


def rembg_mask(img_rgb, model, raw_sha, key):
    """Mascara suave de rembg (0..1). Se cachea en raw/masks/ por sha del original."""
    MASK_DIR.mkdir(parents=True, exist_ok=True)
    cache = MASK_DIR / f"{key}__{model}__{raw_sha[:10]}.png"
    if cache.exists():
        return np.asarray(Image.open(cache).convert("L"), dtype=np.float32) / 255.0
    from rembg import new_session, remove
    if model not in _sessions:
        _sessions[model] = new_session(model)
    m = remove(img_rgb, session=_sessions[model], only_mask=True, post_process_mask=False)
    m = m.convert("L")
    if m.size != img_rgb.size:
        m = m.resize(img_rgb.size, Image.BILINEAR)
    for old in MASK_DIR.glob(f"{key}__{model}__*.png"):
        old.unlink()
    m.save(cache)
    return np.asarray(m, dtype=np.float32) / 255.0


def estimate_bg(rgb, frame=6):
    """Color del fondo (mediana del marco exterior) y fraccion del marco parecida a el."""
    h, w, _ = rgb.shape
    border = np.concatenate([rgb[:frame].reshape(-1, 3), rgb[-frame:].reshape(-1, 3),
                             rgb[:, :frame].reshape(-1, 3), rgb[:, -frame:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    d = np.abs(border - bg).max(axis=1)
    return bg, float((d < 0.08).mean())


def touches_border(lab_mask):
    return np.unique(np.concatenate([lab_mask[0], lab_mask[-1], lab_mask[:, 0], lab_mask[:, -1]]))


def color_to_alpha(rgb, bg):
    """Alfa minimo para que rgb = a*F + (1-a)*bg con F en [0,1] (como 'Color a alfa' de GIMP)."""
    eps = 1e-6
    lo = (bg - rgb) / np.maximum(bg, eps)            # canal mas oscuro que el fondo
    hi = (rgb - bg) / np.maximum(1.0 - bg, eps)      # canal mas claro que el fondo
    a = np.where(rgb < bg, lo, hi)
    return np.clip(a.max(axis=-1), 0.0, 1.0)


def matte_combo(rgb, m, opt, report):
    """Fondo exterior por relleno + votacion de rembg para huecos interiores y sombras."""
    bg, uniform = estimate_bg(rgb)
    report["bg_color"] = [round(float(c) * 255) for c in bg]
    report["bg_uniform"] = round(uniform, 3)
    dist = np.abs(rgb - bg).max(axis=-1)
    near = dist < opt["thr"]
    # blanco casi puro distinto del fondo (circulos tipo pegatina, degradados): fondo si rembg lo dice
    chroma0 = rgb.max(axis=-1) - rgb.min(axis=-1)
    near |= (rgb.min(axis=-1) > 0.86) & (chroma0 < 0.08) & (m < 0.5)
    near |= (rgb.min(axis=-1) > 0.95) & (chroma0 < 0.04)
    lab, n = ndi.label(near)  # conectividad 4
    border_ids = touches_border(lab)
    border_ids = border_ids[border_ids > 0]
    outer = np.isin(lab, border_ids)

    inner = near & ~outer
    holes = np.zeros_like(near)
    lab2, n2 = ndi.label(inner)
    if n2:
        means = ndi.mean(m, lab2, index=np.arange(1, n2 + 1))
        bad = set((np.nonzero(np.asarray(means) < opt["hole_vote"])[0] + 1).tolist())
        if opt.get("flat_white", True) and opt["hole_vote"] >= 0:
            # huecos grandes de blanco plano (sin sombreado) -> fondo aunque rembg no lo vea
            mn = rgb.min(axis=-1)
            area = ndi.sum(inner, lab2, index=np.arange(1, n2 + 1))
            avg = ndi.mean(mn, lab2, index=np.arange(1, n2 + 1))
            sd = ndi.standard_deviation(mn, lab2, index=np.arange(1, n2 + 1))
            for i in range(n2):
                if area[i] > 0.002 * mn.size and avg[i] > 0.96 and sd[i] < 0.015:
                    bad.add(i + 1)
        holes = np.isin(lab2, sorted(bad))
    fg = ~(outer | holes)

    if opt["shadow"]:
        lum = rgb.mean(axis=-1)
        chroma = rgb.max(axis=-1) - rgb.min(axis=-1)
        shadowish = fg & (m < 0.3) & (chroma < 0.18) & (lum > 0.3)
        if shadowish.any():
            lab3, n3 = ndi.label(shadowish)
            adj = np.unique(lab3[ndi.binary_dilation(outer | holes, iterations=2) & shadowish])
            adj = adj[adj > 0]
            removed = np.isin(lab3, adj)
            report["shadow_px"] = int(removed.sum())
            fg &= ~removed

    alpha = fg.astype(np.float32)
    bgmask = ~fg
    band = fg & ndi.binary_dilation(bgmask, iterations=opt["band"])
    a2 = color_to_alpha(rgb, bg)
    alpha[band] = a2[band]
    report["holes_px"] = int(holes.sum())
    return alpha, bg


def decontaminate(rgb, alpha, bg):
    """Quita el color del fondo mezclado en los pixeles semitransparentes."""
    a = alpha[..., None]
    out = rgb.copy()
    semi = (alpha > 0.01) & (alpha < 0.999)
    if semi.any():
        fixed = bg + (rgb - bg) / np.maximum(a, 0.01)
        out[semi] = np.clip(fixed[semi], 0, 1)
    return out


def clean_islands(alpha, opt, report, group):
    solid = alpha > 0.5
    lab, n = ndi.label(solid, structure=np.ones((3, 3)))
    if n == 0:
        report["empty"] = True
        return alpha
    sizes = ndi.sum(solid, lab, index=np.arange(1, n + 1))
    total = float(sizes.sum())
    big = float(sizes.max())
    keep_ids = [i + 1 for i, s in enumerate(sizes)
                if s >= max(opt["island_min"], opt["island_frac"] * total)]
    keep = np.isin(lab, keep_ids)
    # componentes grandes (para avisar de "varios personajes")
    report["big_parts"] = int(sum(1 for s in sizes if s >= 0.15 * big))
    report["islands_removed"] = int(n - len(keep_ids))
    near_keep = ndi.binary_dilation(keep, iterations=3)
    alpha = np.where(near_keep, alpha, 0.0)
    # rellenar agujeritos (< 0.02 % del area) dentro de las piezas conservadas
    filled = ndi.binary_fill_holes(keep)
    tiny_holes = filled & ~keep
    if tiny_holes.any():
        lab_h, nh = ndi.label(tiny_holes)
        hs = ndi.sum(tiny_holes, lab_h, index=np.arange(1, nh + 1))
        small = [i + 1 for i, s in enumerate(hs) if s < 0.0002 * total]
        if small:
            sel = np.isin(lab_h, small)
            alpha[sel] = np.maximum(alpha[sel], 1.0)
    return alpha


def bbox(alpha, thr=0.03):
    ys, xs = np.nonzero(alpha > thr)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def resize_rgba(img, size):
    if img.size == size:
        return img
    pm = img.convert("RGBa").resize(size, Image.LANCZOS)
    return pm.convert("RGBA")


def cover(img, size):
    W, H = size
    w, h = img.size
    s = max(W / w, H / h)
    nw, nh = max(W, round(w * s)), max(H, round(h * s))
    img = img.resize((nw, nh), Image.LANCZOS)
    x0 = (nw - W) // 2
    y0 = (nh - H) // 2
    return img.crop((x0, y0, x0 + W, y0 + H))


# ---------------------------------------------------------------------------
def process_sprite(asset, src, opt, flip, report):
    im = Image.open(src)
    raw_sha = report["raw_sha"]
    has_alpha = im.mode in ("RGBA", "LA", "PA") or (im.mode == "P" and "transparency" in im.info)
    rgba = im.convert("RGBA")
    rgb_img = rgba.convert("RGB")
    rgb = np.asarray(rgb_img, dtype=np.float32) / 255.0
    native = np.asarray(rgba, dtype=np.float32)[..., 3] / 255.0
    method = opt["method"]
    if method == "auto":
        if has_alpha and native.min() < 0.9:
            method = "alpha"
        else:
            _, uniform = estimate_bg(rgb)
            method = "combo" if uniform >= 0.5 else "rembg"
    report["method"] = method

    bg = np.array([1.0, 1.0, 1.0], dtype=np.float32)
    if method == "alpha":
        alpha = native
    else:
        m = rembg_mask(rgb_img, opt["rembg_model"], raw_sha, asset["key"])
        report["rembg_model"] = opt["rembg_model"]
        if method in ("combo", "flood"):
            o = dict(opt)
            if method == "flood":
                o["hole_vote"] = -1.0   # nunca quita huecos interiores
                o["shadow"] = False
                m = np.ones_like(m)
            alpha, bg = matte_combo(rgb, m, o, report)
            if method == "combo":
                fg_c, fg_r = float((alpha > 0.5).sum()), float((m > 0.5).sum())
                report["rembg_disagree"] = round(abs(fg_c - fg_r) / max(fg_c, 1.0), 3)
        else:  # rembg puro
            alpha = np.where(m < 0.04, 0.0, m)
            bg, _ = estimate_bg(rgb)
    alpha = clean_islands(alpha, opt, report, asset.get("group"))
    rgb2 = decontaminate(rgb, alpha, bg) if method != "alpha" else rgb

    solid = alpha > 0.5
    h, w = solid.shape
    report["fg_frac"] = round(float(solid.mean()), 3)
    edges = {"top": solid[:2].any(), "bottom": solid[-2:].any(), "left": solid[:, :2].any(), "right": solid[:, -2:].any()}
    report["touches"] = [k for k, v in edges.items() if v]

    box = bbox(alpha)
    if box is None:
        raise RuntimeError("imagen vacia tras quitar el fondo")
    arr = np.dstack([rgb2, alpha])
    arr = (np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8)
    out = Image.fromarray(arr, "RGBA").crop(box)
    if flip:
        out = out.transpose(Image.FLIP_LEFT_RIGHT)
    kind, maxside = asset["fit"]
    s = min(1.0, maxside / max(out.size))
    if s < 1.0:
        out = resize_rgba(out, (max(1, round(out.size[0] * s)), max(1, round(out.size[1] * s))))
    # pixeles totalmente transparentes -> negro (comprime mejor, sin colores basura)
    a = np.asarray(out)
    a = a.copy()
    a[a[..., 3] == 0, :3] = 0
    out = Image.fromarray(a, "RGBA")
    dest = out_path(asset)
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest, optimize=True)
    report["out_size"] = list(out.size)
    return dest


def process_opaque(asset, src, flip, report):
    im = Image.open(src).convert("RGB")
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    _, size = asset["fit"]
    out = cover(im, size)
    dest = out_path(asset)
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.suffix.lower() == ".jpg":
        out.save(dest, quality=86, optimize=True, progressive=True)
    else:
        out.save(dest, optimize=True)
    report["method"] = "cover"
    report["out_size"] = list(out.size)
    for extra, esize in asset.get("extra_out", []):
        p = ROOT / extra
        cover(im, esize).save(p, optimize=True)
    return dest


# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only")
    ap.add_argument("--category")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--flip", help="invierte el volteo de estos recursos (orientacion revisada)")
    ap.add_argument("--ok", help="marca la orientacion de estos recursos como revisada")
    ap.add_argument("--method", help="auto|combo|flood|rembg|alpha (se guarda en overrides.json)")
    ap.add_argument("--rembg-model", help="modelo de rembg (se guarda en overrides.json)")
    ap.add_argument("--set", action="append", default=[], help="param=valor en overrides (thr, shadow, ...)")
    args = ap.parse_args()

    overrides = load_json(OVERRIDES_FILE, {})
    report_all = load_json(REPORT_FILE, {})

    def tokens(s):
        return [t for t in (s or "").split(",") if t.strip()]

    changed_keys = set()
    for flag, toggle in ((args.flip, True), (args.ok, False)):
        for a in select(tokens(flag)) if flag else []:
            src = raw_path(a)
            if not src:
                print(f"{a['key']}: no hay original")
                continue
            sha = sha1_file(src)[:12]
            ov = overrides.setdefault(a["key"], {})
            cur = ov.get("flip", False) if ov.get("sha") == sha else False
            ov["flip"] = (not cur) if toggle else cur
            ov["sha"] = sha
            changed_keys.add(a["key"])
            print(f"{a['key']}: volteo={'si' if ov['flip'] else 'no'} (revisado)")

    only = tokens(args.only) or None
    cats = tokens(args.category) or None
    if (args.method or args.rembg_model or args.set) and not only:
        raise SystemExit("--method/--rembg-model/--set necesitan --only")
    items = select(only, cats)
    if changed_keys and not only and not cats:
        items = [a for a in items if a["key"] in changed_keys]
    for a in items if (args.method or args.rembg_model or args.set) else []:
        ov = overrides.setdefault(a["key"], {})
        if args.method:
            ov["method"] = args.method
        if args.rembg_model:
            ov["rembg_model"] = args.rembg_model
        for kv in args.set:
            k, v = kv.split("=", 1)
            ov[k] = json.loads(v) if v not in ("auto", "combo", "flood", "rembg", "alpha") else v
        changed_keys.add(a["key"])
    save_json(OVERRIDES_FILE, overrides)

    n_ok = n_skip = n_err = 0
    for a in items:
        k = a["key"]
        src = raw_path(a)
        if not src:
            continue
        sha = sha1_file(src)
        ov = overrides.get(k, {})
        flip_ok = ov.get("sha") == sha[:12]
        flip = bool(ov.get("flip")) and flip_ok
        opt = dict(DEFAULTS)
        opt.update({kk: vv for kk, vv in ov.items() if kk in DEFAULTS})
        sig = hashlib.sha1(json.dumps([VERSION, sha, opt, flip, a["fit"], a["out"]], sort_keys=True).encode()).hexdigest()
        dest = out_path(a)
        prev = report_all.get(k, {})
        if not args.force and k not in changed_keys and prev.get("sig") == sig and dest.exists():
            n_skip += 1
            continue
        t0 = time.time()
        rep = {"raw": src.name, "raw_sha": sha, "flip": flip, "facing_reviewed": flip_ok, "sig": sig}
        try:
            if a["transparent"]:
                process_sprite(a, src, opt, flip, rep)
            else:
                process_opaque(a, src, flip, rep)
        except Exception as e:  # sigue con el resto
            n_err += 1
            print(f"[{k}] ERROR: {e}")
            continue
        rep["secs"] = round(time.time() - t0, 1)
        report_all[k] = rep
        n_ok += 1
        flags = []
        if rep.get("touches"):
            flags.append("toca borde: " + ",".join(rep["touches"]))
        if rep.get("big_parts", 1) > 1 and not a.get("group"):
            flags.append(f"{rep['big_parts']} piezas grandes")
        if rep.get("method") == "rembg":
            flags.append("fondo no uniforme -> rembg")
        if rep.get("rembg_disagree", 0) > 0.25:
            flags.append(f"rembg discrepa {rep['rembg_disagree']:.0%}")
        print(f"[{k}] {rep.get('method')} {rep.get('out_size')} {rep['secs']} s"
              + (" volteado" if flip else "") + (f"  AVISO: {'; '.join(flags)}" if flags else ""))
    save_json(REPORT_FILE, report_all)
    print(f"Procesados {n_ok}, sin cambios {n_skip}, errores {n_err}.")
    return 1 if n_err else 0


if __name__ == "__main__":
    sys.exit(main())
