# -*- coding: utf-8 -*-
"""
Genera las imagenes originales en tools/raw/.

Backend por defecto: IA LOCAL con diffusers (Stable Diffusion XL en la GPU, gratis, sin marca de agua).
Backend alternativo (desactivado): API de Pollinations (--backend pollinations, necesita saldo).

  python tools/generate.py                         # genera todo lo que falte (orden de prioridad)
  python tools/generate.py --category enemies      # solo categorias (separadas por comas)
  python tools/generate.py --only arquera,troll    # recursos concretos (clave o id corto)
  python tools/generate.py --only troll --reroll   # otra semilla al azar (el original pasa a raw/old/)
  python tools/generate.py --only troll --seed 77  # semilla concreta
  python tools/generate.py --only troll --variants 4   # 4 alternativas en raw/variants/<clave>/
  python tools/generate.py --pick enemy_troll=12345    # usa una variante como original
  python tools/generate.py --dry-run               # muestra prompts sin generar

Se salta lo ya generado (salvo --force/--seed/--reroll). Cada imagen deja un .json al lado
(modelo, semilla, prompt) y una linea en tools/raw/generate_log.jsonl; las semillas elegidas
quedan en tools/seeds.json para poder reproducir el resultado.
"""
import truststore
truststore.inject_into_ssl()

import argparse
import datetime as dt
import hashlib
import io
import json
import os
import random
import shutil
import sys
import time
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from assets import BY_KEY, RAW_DIR, TOOLS, select  # noqa: E402

SEEDS_FILE = TOOLS / "seeds.json"
LOG_FILE = RAW_DIR / "generate_log.jsonl"
OLD_DIR = RAW_DIR / "old"
VAR_DIR = RAW_DIR / "variants"

# --- backend local (diffusers) ----------------------------------------------
LOCAL_MODEL = "stabilityai/stable-diffusion-xl-base-1.0"
LOCAL_VAE = "madebyollin/sdxl-vae-fp16-fix"     # el VAE original de SDXL da NaN en fp16
LOCAL_STEPS = 30
LOCAL_CFG = 7.0
# Imagen de referencia de estilo (no se publica; solo guía el trazo y los colores)
# (tools/style_ref.png = recorte sin cielo de la captura; está en .gitignore)
STYLE_REF = os.environ.get("BB_STYLE_REF", str(TOOLS / "style_ref.png"))
if not Path(STYLE_REF).exists():
    STYLE_REF = ""
STYLE_SCALE = float(os.environ.get("BB_STYLE_SCALE", "0.8"))
LOCAL_SIZES = {"square": (1024, 1024), "wide": (1216, 832), "tall": (832, 1216),
               "bg": (1536, 640), "map": (1344, 768), "title": (1344, 768)}

# --- backend Pollinations (alternativa, desactivada) -------------------------
API_BASE = "https://gen.pollinations.ai"
KEY_FILE = TOOLS / ".pollinations_key"
API_MODEL = "flux"
API_SIZES = {"square": (1024, 1024), "wide": (1216, 832), "tall": (832, 1216),
             "bg": (1600, 720), "map": (1280, 720), "title": (1600, 896)}
RETRY_STATUS = {408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524}


class Fatal(Exception):
    """Error que obliga a parar (sin saldo, clave invalida, sin GPU...)."""


class AssetError(Exception):
    """Error de un recurso concreto (se salta y se sigue)."""


def load_json(path, default):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return default


def save_json(path, data):
    Path(path).write_text(json.dumps(data, indent=1, ensure_ascii=False, sort_keys=True), encoding="utf-8")


def log(entry):
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def image_ext(data):
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


# ---------------------------------------------------------------------------
class LocalBackend:
    name = "local"

    def __init__(self, model, steps, cfg):
        self.model, self.steps, self.cfg = model, steps, cfg
        self.pipe = None

    def load(self):
        import torch
        if not torch.cuda.is_available():
            raise Fatal("torch no ve la GPU (torch.cuda.is_available() == False)")
        from diffusers import AutoencoderKL, DPMSolverMultistepScheduler, StableDiffusionXLPipeline
        t0 = time.time()
        vae = AutoencoderKL.from_pretrained(LOCAL_VAE, torch_dtype=torch.float16)
        pipe = StableDiffusionXLPipeline.from_pretrained(
            self.model, vae=vae, torch_dtype=torch.float16, variant="fp16", use_safetensors=True)
        pipe.scheduler = DPMSolverMultistepScheduler.from_config(
            pipe.scheduler.config, use_karras_sigmas=True, algorithm_type="dpmsolver++")
        if STYLE_REF:
            # Estilo copiado de una imagen de referencia (IP-Adapter, solo bloque de estilo = InstantStyle)
            from transformers import CLIPVisionModelWithProjection
            from PIL import Image
            pipe.image_encoder = CLIPVisionModelWithProjection.from_pretrained(
                "h94/IP-Adapter", subfolder="sdxl_models/image_encoder", torch_dtype=torch.float16)
            pipe.load_ip_adapter("h94/IP-Adapter", subfolder="sdxl_models", weight_name="ip-adapter_sdxl.safetensors")
            pipe.set_ip_adapter_scale({"up": {"block_0": [0.0, STYLE_SCALE, 0.0]}})
            self.ref = Image.open(STYLE_REF).convert("RGB")
            # SDXL + codificador de imagen no caben juntos en 12 GB: descarga por módulos (≈30 s/imagen)
            pipe.enable_model_cpu_offload()
        else:
            pipe.to("cuda")
        try:
            pipe.vae.enable_tiling()
        except Exception:
            pass
        pipe.set_progress_bar_config(disable=True)
        self.pipe = pipe
        print(f"  modelo local cargado en {time.time() - t0:.0f} s: {self.model}")

    def size(self, asset):
        return LOCAL_SIZES[asset["aspect"]]

    def generate(self, asset, seed):
        import torch
        if self.pipe is None:
            self.load()
        w, h = self.size(asset)
        g = torch.Generator("cpu" if STYLE_REF else "cuda").manual_seed(int(seed))
        extra = {"ip_adapter_image": self.ref} if STYLE_REF else {}
        try:
            img = self.pipe(prompt=asset["sd_prompt"], negative_prompt=asset["negative"],
                            width=w, height=h, num_inference_steps=self.steps,
                            guidance_scale=self.cfg, generator=g, **extra).images[0]
        except torch.cuda.OutOfMemoryError:
            torch.cuda.empty_cache()
            raise AssetError("sin memoria de GPU")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        params = {"model": self.model, "vae": LOCAL_VAE, "steps": self.steps, "cfg": self.cfg,
                  "scheduler": "DPM++ 2M Karras", "width": w, "height": h,
                  "prompt": asset["sd_prompt"], "negative": asset["negative"]}
        return buf.getvalue(), "png", params


class PollinationsBackend:
    """Alternativa por API. Solo modelos no 'paid_only'. Clave en tools/.pollinations_key."""
    name = "pollinations"

    def __init__(self, model):
        import requests
        self.requests = requests
        self.model = model
        self.key = KEY_FILE.read_text(encoding="utf-8-sig").strip() if KEY_FILE.exists() else ""
        if not self.key:
            raise Fatal(f"No existe {KEY_FILE.name}")

    def size(self, asset):
        return API_SIZES[asset["aspect"]]

    def redact(self, text):
        return str(text).replace(self.key, "***") if self.key else str(text)

    def generate(self, asset, seed):
        w, h = self.size(asset)
        url = f"{API_BASE}/image/" + urllib.parse.quote(asset["prompt"], safe="")
        params = {"model": self.model, "width": w, "height": h, "seed": seed}
        headers = {"Authorization": f"Bearer {self.key}", "User-Agent": "BastionBravo-assets/1.0"}
        wait = 5.0
        for attempt in range(1, 8):
            try:
                r = self.requests.get(url, params=params, headers=headers, timeout=(20, 300))
            except (self.requests.Timeout, self.requests.ConnectionError) as e:
                print(f"    intento {attempt}: {e.__class__.__name__}; espero {wait:.0f} s")
                time.sleep(wait)
                wait = min(wait * 2, 120)
                continue
            if r.status_code == 200 and image_ext(r.content):
                return r.content, image_ext(r.content), dict(params, prompt=asset["prompt"])
            body = self.redact(r.text[:300])
            if r.status_code == 402:
                raise Fatal(f"402 sin saldo de pollen: {body}")
            if r.status_code in (401, 403):
                raise Fatal(f"{r.status_code} clave invalida o modelo no permitido: {body}")
            if r.status_code in RETRY_STATUS or r.status_code == 200:
                ra = r.headers.get("Retry-After")
                pause = float(ra) if ra and ra.replace(".", "").isdigit() else wait
                print(f"    intento {attempt}: HTTP {r.status_code}; espero {pause:.0f} s")
                time.sleep(min(pause, 300))
                wait = min(wait * 2, 120)
                continue
            raise AssetError(f"HTTP {r.status_code}: {body}")
        raise AssetError("sin exito tras 7 intentos")


# ---------------------------------------------------------------------------
def existing_raw(key, folder=RAW_DIR):
    for e in ("png", "jpg", "webp"):
        p = folder / f"{key}.{e}"
        if p.exists():
            return p
    return None


def archive_raw(key):
    p = existing_raw(key)
    if not p:
        return
    OLD_DIR.mkdir(parents=True, exist_ok=True)
    meta = load_json(RAW_DIR / f"{key}.json", {})
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    tag = f"{key}__s{meta.get('seed', 'x')}_{stamp}"
    shutil.move(str(p), str(OLD_DIR / f"{tag}{p.suffix}"))
    mj = RAW_DIR / f"{key}.json"
    if mj.exists():
        shutil.move(str(mj), str(OLD_DIR / f"{tag}.json"))


def write_raw(dest_noext, data, ext, meta):
    dest_noext.parent.mkdir(parents=True, exist_ok=True)
    for e in ("png", "jpg", "webp"):
        old = dest_noext.with_name(f"{dest_noext.name}.{e}")
        if old.exists():
            old.unlink()
    path = dest_noext.with_name(f"{dest_noext.name}.{ext}")
    path.write_bytes(data)
    meta = dict(meta, file=path.name, sha1=hashlib.sha1(data).hexdigest(), bytes=len(data))
    save_json(dest_noext.with_name(f"{dest_noext.name}.json"), meta)
    return path


def clean_score(path, opaque=False):
    """Puntua lo 'limpio' que es un original para recortarlo: marco blanco liso, nada tocando el
    borde y un sujeto de tamano razonable. Mas alto = mejor."""
    import numpy as np
    from PIL import Image
    a = np.asarray(Image.open(path).convert("RGB").resize((256, 256)), dtype=np.float32) / 255.0
    white = (a.min(axis=-1) > 0.9) & ((a.max(axis=-1) - a.min(axis=-1)) < 0.06)
    f = 6
    frame = np.concatenate([white[:f].ravel(), white[-f:].ravel(), white[:, :f].ravel(), white[:, -f:].ravel()])
    if opaque:  # fondos/mapas: cuanto menos marco blanco, mejor
        return 1.0 - float(frame.mean())
    fg = 1.0 - white.mean()
    size_pen = 0.0 if 0.12 <= fg <= 0.6 else min(abs(fg - 0.12), abs(fg - 0.6)) * 2
    return float(frame.mean()) - size_pen


def auto_pick(key, seeds, include_current=True):
    """Elige entre el original actual y sus variantes el de mejor clean_score."""
    cands = [p for p in (VAR_DIR / key).glob("s*.*") if p.suffix != ".json"]
    cur = existing_raw(key) if include_current else None
    opaque = not BY_KEY[key]["transparent"]
    best = max(cands + ([cur] if cur else []), key=lambda p: clean_score(p, opaque), default=None)
    if best is None or best == cur:
        print(f"  {key}: se queda el actual ({clean_score(cur, opaque):.2f})" if cur else f"  {key}: sin candidatos")
        return
    meta = load_json(best.with_suffix(".json"), {})
    archive_raw(key)
    write_raw(RAW_DIR / key, best.read_bytes(), best.suffix[1:], dict(meta, picked_from=best.name))
    seeds[key] = {"seed": meta.get("seed"), "model": meta.get("model")}
    save_json(SEEDS_FILE, seeds)
    print(f"  {key}: elegida {best.name} ({clean_score(RAW_DIR / (key + best.suffix), opaque):.2f})")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", help="claves o ids separados por comas")
    ap.add_argument("--category", help="categorias separadas por comas")
    ap.add_argument("--force", action="store_true", help="regenera aunque exista (misma semilla)")
    ap.add_argument("--seed", type=int, help="semilla concreta (implica --force)")
    ap.add_argument("--reroll", action="store_true", help="semilla nueva al azar (implica --force)")
    ap.add_argument("--variants", type=int, default=0, help="genera N alternativas en raw/variants/<clave>/")
    ap.add_argument("--pick", help="clave=semilla: usa esa variante como original")
    ap.add_argument("--auto-pick", action="store_true",
                    help="con --variants: se queda con la variante de fondo mas limpio")
    ap.add_argument("--fresh", action="store_true", help="con --auto-pick: descarta el original actual (prompt cambiado)")
    ap.add_argument("--backend", default="local", choices=["local", "pollinations"])
    ap.add_argument("--model", help=f"modelo (local: {LOCAL_MODEL}; pollinations: {API_MODEL})")
    ap.add_argument("--steps", type=int, default=LOCAL_STEPS)
    ap.add_argument("--cfg", type=float, default=LOCAL_CFG)
    ap.add_argument("--delay", type=float, default=None, help="pausa entre imagenes (API: 3 s)")
    ap.add_argument("--max", type=int, default=0, help="maximo de imagenes en esta ejecucion")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    seeds = load_json(SEEDS_FILE, {})

    if args.pick:
        k, s = [x.strip() for x in args.pick.split("=")]
        if k not in BY_KEY:
            raise SystemExit(f"Clave desconocida: {k}")
        src = existing_raw(f"s{s}", VAR_DIR / k)
        if not src:
            raise SystemExit(f"No hay variante {VAR_DIR / k}/s{s}.*")
        meta = load_json(src.with_suffix(".json"), {})
        archive_raw(k)
        write_raw(RAW_DIR / k, src.read_bytes(), src.suffix[1:], dict(meta, picked_from=src.name))
        seeds[k] = {"seed": int(s), "model": meta.get("model")}
        save_json(SEEDS_FILE, seeds)
        log({"time": dt.datetime.now().isoformat(timespec="seconds"), "id": k, "action": "pick", "seed": int(s)})
        print(f"{k}: variante s{s} -> raw/{k}{src.suffix}")
        return 0

    only = args.only.split(",") if args.only else None
    cats = args.category.split(",") if args.category else None
    items = select(only, cats)
    force = args.force or args.seed is not None or args.reroll
    if args.backend == "local":
        backend = LocalBackend(args.model or LOCAL_MODEL, args.steps, args.cfg)
        delay = args.delay or 0.0
    else:
        backend = PollinationsBackend(args.model or API_MODEL)
        delay = args.delay if args.delay is not None else 3.0

    jobs = []
    skipped = 0
    for asset in items:
        k = asset["key"]
        if args.variants:
            if args.seed is not None:
                base = args.seed
            elif args.reroll:
                base = random.randint(1, 2_000_000_000)
            else:
                base = seeds.get(k, {}).get("seed") or asset["seed"]
            for i in range(args.variants):
                s = base + 1 + i * 7919
                dest = VAR_DIR / k / f"s{s}"
                if not args.force and existing_raw(dest.name, dest.parent):
                    continue
                jobs.append((asset, s, dest, False))
        else:
            if existing_raw(k) and not force:
                skipped += 1
                continue
            if args.seed is not None:
                s = args.seed
            elif args.reroll:
                s = random.randint(1, 2_000_000_000)
            else:
                s = seeds.get(k, {}).get("seed") or asset["seed"]
            jobs.append((asset, s, RAW_DIR / k, True))
    if args.max:
        jobs = jobs[:args.max]

    done = failed = 0
    times = []
    for n, (asset, s, dest, is_main) in enumerate(jobs, 1):
        k = asset["key"]
        w, h = backend.size(asset)
        print(f"[{n}/{len(jobs)}] {k} semilla={s} {w}x{h}" + ("" if is_main else " (variante)"), flush=True)
        if args.dry_run:
            print(f"    + {asset['sd_prompt'] if backend.name == 'local' else asset['prompt']}")
            continue
        t0 = time.time()
        entry = {"time": dt.datetime.now().isoformat(timespec="seconds"), "id": k, "backend": backend.name,
                 "seed": s, "w": w, "h": h, "variant": not is_main}
        try:
            data, ext, params = backend.generate(asset, s)
        except Fatal as e:
            entry.update(status="fatal", error=str(e))
            log(entry)
            print(f"    PARADA: {e}")
            return 3
        except AssetError as e:
            failed += 1
            entry.update(status="error", error=str(e))
            log(entry)
            print(f"    ERROR: {e}")
            continue
        el = time.time() - t0
        times.append(el)
        meta = dict(params, key=k, seed=s, backend=backend.name, time=entry["time"], elapsed=round(el, 1))
        if is_main:
            archive_raw(k)
            path = write_raw(dest, data, ext, meta)
            seeds[k] = {"seed": s, "model": params.get("model")}
            save_json(SEEDS_FILE, seeds)
        else:
            path = write_raw(dest, data, ext, meta)
        entry.update(status="ok", elapsed=round(el, 1), bytes=len(data), file=str(path.relative_to(RAW_DIR)))
        log(entry)
        done += 1
        print(f"    ok {path.name} ({len(data) // 1024} KB, {el:.1f} s)", flush=True)
        if delay:
            time.sleep(delay)

    if args.auto_pick and args.variants and not args.dry_run:
        print("Eleccion automatica (fondo mas limpio):")
        for asset in items:
            auto_pick(asset["key"], seeds, include_current=not args.fresh)

    avg = (sum(times) / len(times)) if times else 0
    print(f"Resumen: {done} generadas, {skipped} ya existian, {failed} fallidas. Media {avg:.1f} s/imagen.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
