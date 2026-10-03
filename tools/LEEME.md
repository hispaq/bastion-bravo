# Gráficos de Bastión Bravo (tools/)

Imágenes generadas con IA **local** (Stable Diffusion XL con diffusers en la GPU; gratis y sin marca de agua).
Requisitos: Python 3.11 con torch (CUDA), diffusers, transformers, accelerate, rembg[cpu], pillow, numpy, scipy y truststore.
La primera ejecución descarga el modelo de Hugging Face (~7 GB) y el de rembg (u2net).

## Regenerar todo
```
python tools/generate.py          # crea en tools/raw/ lo que falte (enemigos, héroes, jefes, castillo, torres, fondos, mapa, iconos, portada, icono app)
python tools/process.py           # quita el fondo, recorta, voltea, redimensiona -> sprites/
python tools/contact_sheet.py     # hojas de revisión -> tools/review/<categoria>.png
python tools/build_manifest.py    # escribe sprites/manifest.js
```
Las semillas elegidas están en `tools/seeds.json`, así que se reproduce el mismo resultado.

## Rehacer una imagen concreta
```
python tools/generate.py --only troll --variants 4      # 4 alternativas en tools/raw/variants/enemy_troll/
python tools/contact_sheet.py --variants enemy_troll    # verlas en tools/review/variants_enemy_troll.png
python tools/generate.py --pick enemy_troll=12345       # quedarse con una (la anterior pasa a raw/old/)
python tools/generate.py --only troll --reroll          # o directamente otra semilla al azar
python tools/process.py --only troll
python tools/build_manifest.py
```
- Los prompts están en `tools/assets.py` (`sd_prompt` y `negative` para el modelo local; `prompt` para la API).
- Orientación: héroes miran a la izquierda; enemigos y jefes, a la derecha. Si un sprite final mira al lado
  equivocado: `python tools/process.py --flip id` (se guarda en `tools/overrides.json` ligado a ese original).
- Quitar fondo: por defecto relleno del blanco desde los bordes + votación de rembg (u2net) para huecos y sombras.
  Para forzar otro método: `python tools/process.py --only id --method rembg|flood|combo`.
- `python tools/compare_rembg.py --keys hero_x,enemy_y` compara los modelos de rembg.

## Alternativa: API de Pollinations (desactivada)
`python tools/generate.py --backend pollinations` usa gen.pollinations.ai con la clave de `tools/.pollinations_key`
(cabecera `Authorization: Bearer`, nunca se guarda en otro sitio). Necesita saldo de pollen; con saldo 0 no sirve.
