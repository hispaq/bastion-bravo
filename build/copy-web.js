// Copia los archivos del juego a www/ (carpeta que Capacitor mete dentro del APK).
// Uso: node build/copy-web.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'www');
const ITEMS = ['index.html', 'manifest.webmanifest', 'sw.js', 'precache-list.js', 'css', 'js', 'sprites'];

function copy(src, dst) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) copy(path.join(src, name), path.join(dst, name));
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
for (const item of ITEMS) {
  const src = path.join(ROOT, item);
  if (fs.existsSync(src)) copy(src, path.join(OUT, item));
}
console.log('Juego copiado a', OUT);
