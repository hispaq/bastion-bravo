# Bastión Bravo

Tower defense para móvil (horizontal) hecho con HTML5 y JavaScript. Defiende tu castillo de las hordas de orcos y goblins.

## Jugar en el PC
- Doble clic en el acceso directo **Bastión Bravo** del Escritorio (o en `index.html`). Funciona sin servidor ni conexión.
- Controles: toca/clic en el campo para disparar la ballesta del castillo; botones de habilidad abajo (o teclas 1–0); P, Espacio o Esc para pausar.

## Pasarlo al móvil
1. **Enlace web (GitHub Pages)**: al subir el proyecto a GitHub, el flujo `.github/workflows/pages.yml` lo publica solo.
   Ábrelo en Chrome del móvil → menú ⋮ → «Instalar aplicación». Queda como una app y funciona sin conexión.
2. **APK de Android**: el flujo `.github/workflows/android.yml` compila un APK con Capacitor en cada subida
   y lo deja en la pestaña *Releases* del repositorio (`apk-latest`). Descárgalo en el móvil e instálalo
   (permite «instalar apps de origen desconocido»).
   Para compilarlo en tu PC necesitarías Node.js 22, JDK 21 y Android Studio:
   `npm install`, `node build/copy-web.js`, `npx cap add android`, `npx cap open android` y en Android Studio *Build → Build APK*.

## Gráficos (IA local, gratis, sin marca de agua)
Generados con Stable Diffusion XL en tu GPU y fondos quitados con `rembg`. Ver `tools/LEEME.md`.
Después de regenerar imágenes:
```
python build/optimize_images.py --restore   # vuelve a los PNG originales
python tools/build_manifest.py
python build/optimize_images.py             # convierte a WebP (6,8 MB en vez de 21 MB)
python build/make_precache.py               # lista para el modo sin conexión (PWA)
```

## Pruebas
- `python tests/recorrido.py SALIDA 1600x720` — recorre portada, menú, mapa, batallas, jefe, tienda, héroe y ejército con capturas y errores de consola.
- `python tests/run_page.py campana.html` — simula la campaña completa de 100 niveles con la economía real.
- `tests/enemigos.html`, `tests/heroes.html`, `tests/mapa.html`, `tests/ui.html` — bancos de prueba de cada parte.
