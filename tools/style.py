"""Generación con el ESTILO de una imagen de referencia (IP-Adapter SDXL, en local).
Uso:
  python tools/style.py --ref C:/ruta/juego.png --out tools/style_test --scale 0.7 \
      --item "nombre|prompt|ancho|alto|semilla" [--item ...]
Guarda PNG en --out. Sin marca de agua, todo en tu GPU.
"""
import argparse, os, sys, time
import truststore; truststore.inject_into_ssl()
import torch
from PIL import Image
from diffusers import StableDiffusionXLPipeline
from transformers import CLIPVisionModelWithProjection

BASE = "stabilityai/stable-diffusion-xl-base-1.0"
NEG = ("photo, realistic, 3d render, detailed shading, gradient, text, watermark, signature, logo, blurry, "
       "noisy, jpeg artifacts, frame, border, ui, multiple panels")

_pipe = None


def pipe(scale):
    global _pipe
    if _pipe is None:
        enc = CLIPVisionModelWithProjection.from_pretrained("h94/IP-Adapter", subfolder="sdxl_models/image_encoder", torch_dtype=torch.float16)
        _pipe = StableDiffusionXLPipeline.from_pretrained(BASE, image_encoder=enc, torch_dtype=torch.float16, variant="fp16", use_safetensors=True)
        _pipe.load_ip_adapter("h94/IP-Adapter", subfolder="sdxl_models", weight_name="ip-adapter_sdxl.safetensors")
        _pipe.enable_model_cpu_offload()
        try:
            _pipe.vae.enable_slicing()
        except Exception:
            pass
    if STYLE_ONLY:
        # InstantStyle: la referencia solo aporta estilo (no composición)
        _pipe.set_ip_adapter_scale({"up": {"block_0": [0.0, scale, 0.0]}})
    else:
        _pipe.set_ip_adapter_scale(scale)
    return _pipe


STYLE_ONLY = True


def generate(ref, items, out, scale, steps=30, cfg=6.5):
    os.makedirs(out, exist_ok=True)
    refimg = Image.open(ref).convert("RGB")
    p = pipe(scale)
    for it in items:
        name, prompt, w, h, seed = it
        t0 = time.time()
        g = torch.Generator("cpu").manual_seed(int(seed))
        img = p(prompt=prompt, negative_prompt=NEG, ip_adapter_image=refimg, width=int(w), height=int(h),
                num_inference_steps=steps, guidance_scale=cfg, generator=g).images[0]
        img.save(os.path.join(out, name + ".png"))
        print(f"ok {name} {w}x{h} semilla={seed} {time.time() - t0:.1f}s", flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--ref", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--scale", type=float, default=0.7)
    ap.add_argument("--steps", type=int, default=30)
    ap.add_argument("--item", action="append", default=[])
    ap.add_argument("--layout", action="store_true", help="la referencia también influye en la composición")
    a = ap.parse_args()
    STYLE_ONLY = not a.layout
    items = []
    for s in a.item:
        parts = s.split("|")
        items.append((parts[0], parts[1], parts[2] if len(parts) > 2 else 1024, parts[3] if len(parts) > 3 else 1024, parts[4] if len(parts) > 4 else 1))
    generate(a.ref, items, a.out, a.scale, a.steps)
