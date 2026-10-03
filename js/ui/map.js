/* Bastión Bravo · mapa de progresión (pantalla 'map').
   Lienzo horizontal desplazable (arrastre con inercia, rueda, flechas) que recorre las 10 zonas con un camino de
   100 nodos. Fondos: imagen map_<zona> si existe; si no, un paisaje ilustrado procedural con la paleta de la zona
   (cacheado por zona). Solo se dibuja lo visible. Al tocar un nodo se abre el panel del nivel. */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};

  const ZW = 1280, ZH = 720, NZ = 10, TOTAL_W = ZW * NZ, LEVELS = 100;
  const TAU = Math.PI * 2;
  const OUT = '#2a1a0e';
  const FONT_T = "'Lilita One', 'Arial Rounded MT Bold', 'Arial Black', system-ui, sans-serif";
  const BOSS_FALLBACK = {
    rey_goblin: ['Rey Grikko', 'El Rey Goblin', '#ffcf3d'], chaman_gigante: ["Mog'Rath", 'El Gran Chamán', '#8fe05a'],
    troll_piedra: ['Gorrumbo', 'El Troll de Piedra', '#a9b0a8'], escorpion: ['Khazrak', 'El Jinete del Escorpión', '#ffae3d'],
    senor_fuego: ['Ignarok', 'Señor del Magma', '#ff6a1f'], senor_guerra: ['Thargrim', 'Señor de la Guerra', '#c75cff'],
    gigante_escarcha: ['Hrimgor', 'El Ogro de Escarcha', '#7fd8ff'], nigromante: ['Vorlath', 'El Nigromante', '#7dffb2'],
    golem: ['Gran Gólem de Tuerca', 'Máquina de Guerra Goblin', '#ffb347'], dragon: ['Skarnoth', 'El Dragón de los Orcos', '#ff4a2a'],
  };
  const ZONE_FALLBACK = ['bosque', 'pantano', 'montanas', 'desierto', 'volcan', 'oscuras', 'hielo', 'ruinas', 'forja', 'dragon'];

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const fmt = v => (BB.util && BB.util.fmt ? BB.util.fmt(v) : String(Math.floor(v || 0)));
  function el(tag, attrs, kids) {
    if (BB.util && BB.util.el) return BB.util.el(tag, attrs, kids);
    const n = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v); else n.setAttribute(k, v);
    }
    for (const c of [].concat(kids || [])) if (c != null && c !== false) n.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    return n;
  }
  function rngOf(str) {
    const U = BB.util;
    if (U && U.mulberry32 && U.hashStr) return U.mulberry32(U.hashStr(str));
    let s = 0; for (let i = 0; i < str.length; i++) s = (s * 31 + str.charCodeAt(i)) >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  const zones = () => (BB.data && BB.data.zones) || ZONE_FALLBACK.map((id, i) => ({ id, index: i, name: id, boss: Object.keys(BOSS_FALLBACK)[i], map: 'map_' + id, palette: {}, mapStyle: {} }));
  const save = () => (BB.save && BB.save.data) || { gold: 0, gems: 0, maxLevel: 1, levels: {}, heroes: {}, lineup: [], castle: {} };
  function asset(key) { try { return BB.assets && BB.assets.get ? BB.assets.get(key) : null; } catch (err) { return null; } }
  function sfx(name) { try { if (BB.audio && BB.audio.sfx) BB.audio.sfx(name); } catch (err) { /* nada */ } }
  function toast(t, o) { try { if (BB.ui && BB.ui.toast) BB.ui.toast(t, o); } catch (err) { /* nada */ } }
  function bossInfo(id) {
    const b = BB.data && BB.data.bosses && BB.data.bosses[id];
    const f = BOSS_FALLBACK[id] || [id, '', '#ff5a3a'];
    return { name: (b && b.name) || f[0], title: (b && b.title) || f[1], color: (b && b.color) || f[2] };
  }
  function enemyName(id) {
    if (BB.levels && BB.levels.enemyName) return BB.levels.enemyName(id);
    const d = BB.data && BB.data.enemies && BB.data.enemies[id];
    return (d && d.name) || id;
  }
  function levelState(s, n) {
    const L = (s.levels && s.levels[n]) || null;
    const max = clamp(s.maxLevel || 1, 1, LEVELS);
    const stars = L ? (L.stars || 0) : 0;
    const cleared = !!(L && ((L.clears || 0) > 0 || stars > 0));
    return { stars, cleared, locked: n > max, current: n === max && !cleared, max };
  }

  // ---------------------------------------------------------------- iconos SVG propios (si BB.ui no los da)
  const SVG = {
    gold: '<svg viewBox="0 0 64 64"><ellipse cx="32" cy="35" rx="25" ry="24" fill="#c98712" stroke="#2b1708" stroke-width="4"/><circle cx="32" cy="31" r="24" fill="#ffd23f" stroke="#2b1708" stroke-width="4"/><circle cx="32" cy="31" r="15" fill="none" stroke="#e7a516" stroke-width="4"/></svg>',
    gem: '<svg viewBox="0 0 64 64"><path d="M12 25 L22 12 H42 L52 25 L32 55 Z" fill="#b35cff" stroke="#2b1708" stroke-width="4" stroke-linejoin="round"/><path d="M22 12 L27 25 H12 Z" fill="#dcaeff"/><path d="M27 25 H37 L32 55 Z" fill="#9440e6"/></svg>',
    star: '<svg viewBox="0 0 64 64"><path d="M32 5 L40 23 L59 25 L45 38 L49 57 L32 47 L15 57 L19 38 L5 25 L24 23 Z" fill="#ffd23f" stroke="#2b1708" stroke-width="4" stroke-linejoin="round"/></svg>',
    back: '<svg viewBox="0 0 64 64"><path d="M29 9 L7 32 L29 55 V43 H56 V21 H29 Z" fill="#fff" stroke="#2b1708" stroke-width="4" stroke-linejoin="round"/></svg>',
    shop: '<svg viewBox="0 0 64 64"><path d="M11 23 H53 L48 58 H16 Z" fill="#c9843f" stroke="#2b1708" stroke-width="4" stroke-linejoin="round"/><path d="M22 23 V17 a10 10 0 0 1 20 0 V23" fill="none" stroke="#2b1708" stroke-width="4"/></svg>',
    sword: '<svg viewBox="0 0 64 64"><g transform="rotate(45 32 32)"><path d="M28 42 V11 L32 3 L36 11 V42 Z" fill="#e3e9f0" stroke="#2b1708" stroke-width="4"/><rect x="20" y="41" width="24" height="6" rx="3" fill="#c98712" stroke="#2b1708" stroke-width="3"/><rect x="29" y="47" width="6" height="12" fill="#7a4a22" stroke="#2b1708" stroke-width="3"/></g></svg>',
    target: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="24" fill="#fff" stroke="#2b1708" stroke-width="4"/><circle cx="32" cy="32" r="15" fill="#ff6a52" stroke="#2b1708" stroke-width="4"/><circle cx="32" cy="32" r="6" fill="#fff" stroke="#2b1708" stroke-width="3"/></svg>',
    lock: '<svg viewBox="0 0 64 64"><path d="M20 29 V20 a12 12 0 0 1 24 0 V29" fill="none" stroke="#2b1708" stroke-width="8"/><rect x="13" y="28" width="38" height="30" rx="6" fill="#ffc83a" stroke="#2b1708" stroke-width="4"/></svg>',
    skull: '<svg viewBox="0 0 64 64"><path d="M32 6 C16 6 8 17 8 30 C8 38 13 42 17 44 V55 H47 V44 C51 42 56 38 56 30 C56 17 48 6 32 6 Z" fill="#f4efe2" stroke="#2b1708" stroke-width="4"/><circle cx="22" cy="30" r="7" fill="#2b1708"/><circle cx="42" cy="30" r="7" fill="#2b1708"/></svg>',
  };
  function icon(name, cls) {
    if (BB.ui && BB.ui.icon) { try { return BB.ui.icon(name, cls); } catch (err) { /* sigue */ } }
    return el('span', { class: 'ico' + (cls ? ' ' + cls : ''), html: SVG[name] || SVG.star });
  }
  function button(label, fn, o) {
    o = o || {};
    if (BB.ui && BB.ui.button) { try { return BB.ui.button(label, fn, o); } catch (err) { /* sigue */ } }
    let cls = 'bb-btn' + (o.kind && o.kind !== 'green' ? ' btn-' + o.kind : '') + (o.big ? ' btn-big' : '') + (o.round ? ' btn-round' : '') + (o.small ? ' btn-small' : '') + (o.cls ? ' ' + o.cls : '');
    const b = el('button', { class: cls, type: 'button', title: o.title || null, 'aria-label': o.title || label || null });
    if (o.icon) b.appendChild(icon(o.icon));
    if (label) b.appendChild(el('span', { class: 'btn-lbl', text: label }));
    b.addEventListener('click', e => { e.stopPropagation(); sfx(o.sound || 'click'); fn && fn(e); });
    return b;
  }

  // ---------------------------------------------------------------- disposición de los 100 nodos
  const nodes = [];       // índice 0 = salida (castillo); 1..100 = niveles
  let segs = [];          // segs[k] = curva de nodes[k] a nodes[k+1]
  function buildLayout() {
    nodes.length = 0;
    nodes.push({ n: 0, x: 92, y: 440, boss: false, z: 0 });
    for (let z = 0; z < NZ; z++) {
      const rng = rngOf('BB/mapa/zona/' + z);
      const x0 = z * ZW;
      const start = z === 0 ? 245 : 125;
      const end = 1005;
      const ph = rng() * TAU;
      for (let i = 0; i < 9; i++) {
        const x = x0 + start + (end - start) * i / 8 + (rng() - 0.5) * 16;
        const y = clamp(428 + 152 * Math.sin(ph + i * 0.95) + (rng() - 0.5) * 34, 238, 612);
        nodes.push({ n: z * 10 + i + 1, x, y, boss: false, z });
      }
      nodes.push({ n: z * 10 + 10, x: x0 + 1150, y: 405 + (rng() - 0.5) * 50, boss: true, z });
    }
    segs = [];
    for (let k = 0; k < nodes.length - 1; k++) {
      const p0 = nodes[Math.max(0, k - 1)], p1 = nodes[k], p2 = nodes[k + 1], p3 = nodes[Math.min(nodes.length - 1, k + 2)];
      const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
      const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
      segs.push({ a: p1, c1, c2, b: p2, minX: Math.min(p1.x, c1.x, c2.x, p2.x), maxX: Math.max(p1.x, c1.x, c2.x, p2.x) });
    }
  }
  function bez(s, t) {
    const u = 1 - t;
    return {
      x: u * u * u * s.a.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.b.x,
      y: u * u * u * s.a.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.b.y,
    };
  }
  // Muestras del camino (para no tapar el camino con decoración)
  let pathSamples = [];
  function samplePath() {
    pathSamples = [];
    for (const s of segs) for (let i = 0; i < 12; i++) pathSamples.push(bez(s, i / 12));
    pathSamples.push(nodes[nodes.length - 1]);
  }
  function distToPath(x, y) {
    let best = 1e9;
    for (const p of pathSamples) {
      const dx = p.x - x;
      if (dx > 400 || dx < -400) continue;
      const d = dx * dx + (p.y - y) * (p.y - y);
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  // ---------------------------------------------------------------- pintores de decoración (vista "mapa ilustrado")
  function shade(hex, amt) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return hex;
    const v = parseInt(m[1], 16);
    const f = c => Math.max(0, Math.min(255, Math.round(c + (amt > 0 ? (255 - c) * amt : c * amt))));
    return 'rgb(' + f(v >> 16) + ',' + f((v >> 8) & 255) + ',' + f(v & 255) + ')';
  }
  function blob(g, x, y, rx, ry, rng, wob, pts) {
    pts = pts || 11; wob = wob == null ? 0.2 : wob;
    const P = [];
    for (let i = 0; i < pts; i++) {
      const a = i / pts * TAU, r = 1 + (rng() - 0.5) * 2 * wob;
      P.push([x + Math.cos(a) * rx * r, y + Math.sin(a) * ry * r]);
    }
    g.beginPath();
    for (let i = 0; i <= pts; i++) {
      const p = P[i % pts], q = P[(i + 1) % pts];
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      if (i === 0) g.moveTo(mx, my); else g.quadraticCurveTo(p[0], p[1], mx, my);
    }
    g.closePath();
  }
  function fs(g, fill, stroke, lw) {
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 3; g.lineJoin = 'round'; g.stroke(); }
  }
  function shadow(g, x, y, w, h) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(x, y, w, h, 0, 0, TAU); g.fill(); }

  function tree(g, x, y, s, c1, c2, trunk) {
    shadow(g, x + 6 * s, y + 2 * s, 24 * s, 8 * s);
    g.fillStyle = trunk; g.beginPath(); g.rect(x - 4 * s, y - 16 * s, 8 * s, 18 * s); fs(g, trunk, OUT, 2.5);
    g.beginPath(); g.arc(x - 10 * s, y - 24 * s, 14 * s, 0, TAU); g.arc(x + 10 * s, y - 24 * s, 14 * s, 0, TAU); g.arc(x, y - 38 * s, 17 * s, 0, TAU);
    fs(g, c1, OUT, 3);
    g.beginPath(); g.arc(x - 10 * s, y - 24 * s, 14 * s, 0, TAU); g.arc(x + 10 * s, y - 24 * s, 14 * s, 0, TAU); g.arc(x, y - 38 * s, 17 * s, 0, TAU); g.fillStyle = c1; g.fill();
    g.fillStyle = c2; g.beginPath(); g.arc(x - 5 * s, y - 43 * s, 7 * s, 0, TAU); g.arc(x - 13 * s, y - 28 * s, 5 * s, 0, TAU); g.fill();
  }
  function pine(g, x, y, s, c1, c2, trunk, snow) {
    shadow(g, x + 5 * s, y + 2 * s, 18 * s, 6 * s);
    g.beginPath(); g.rect(x - 3.5 * s, y - 10 * s, 7 * s, 12 * s); fs(g, trunk, OUT, 2.5);
    for (let k = 0; k < 3; k++) {
      const yy = y - 8 * s - k * 15 * s, w = (22 - k * 5) * s;
      g.beginPath(); g.moveTo(x - w, yy); g.lineTo(x, yy - 26 * s); g.lineTo(x + w, yy); g.closePath(); fs(g, k === 2 ? c2 : c1, OUT, 3);
      if (snow) { g.beginPath(); g.moveTo(x - w * 0.42, yy - 15 * s); g.lineTo(x, yy - 26 * s); g.lineTo(x + w * 0.42, yy - 15 * s); g.closePath(); g.fillStyle = '#ffffff'; g.fill(); }
    }
  }
  function deadTree(g, x, y, s, col) {
    g.strokeStyle = OUT; g.lineCap = 'round';
    const br = (lw, pts) => { g.lineWidth = lw; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke(); };
    for (const pass of [0, 1]) {
      g.strokeStyle = pass ? col : OUT;
      const k = pass ? 0 : 3;
      br(7 * s + k, [x, y, x, y - 30 * s]);
      br(4.5 * s + k, [x, y - 20 * s, x - 13 * s, y - 34 * s, x - 18 * s, y - 33 * s]);
      br(4.5 * s + k, [x, y - 26 * s, x + 12 * s, y - 40 * s]);
      br(3.5 * s + k, [x, y - 30 * s, x - 2 * s, y - 44 * s]);
    }
  }
  function rock(g, x, y, s, c, rng) {
    shadow(g, x + 4 * s, y + 3 * s, 16 * s, 6 * s);
    g.beginPath(); g.moveTo(x - 16 * s, y); g.lineTo(x - 12 * s, y - 13 * s); g.lineTo(x - 2 * s, y - 19 * s - rng() * 5 * s); g.lineTo(x + 11 * s, y - 13 * s); g.lineTo(x + 16 * s, y); g.closePath();
    fs(g, c, OUT, 3);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.moveTo(x - 11 * s, y - 12 * s); g.lineTo(x - 2 * s, y - 17 * s); g.lineTo(x - 4 * s, y - 6 * s); g.closePath(); g.fill();
  }
  function mountain(g, x, y, w, h, c, snow) {
    g.beginPath(); g.moveTo(x - w, y); g.lineTo(x - w * 0.15, y - h); g.lineTo(x + w * 0.1, y - h * 0.92); g.lineTo(x + w, y); g.closePath(); fs(g, c, OUT, 3.5);
    g.beginPath(); g.moveTo(x - w * 0.15, y - h); g.lineTo(x + w * 0.1, y - h * 0.92); g.lineTo(x + w, y); g.lineTo(x + w * 0.05, y); g.closePath(); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fill();
    if (snow) {
      g.beginPath(); g.moveTo(x - w * 0.15 - w * 0.32, y - h * 0.62); g.lineTo(x - w * 0.15, y - h); g.lineTo(x + w * 0.1, y - h * 0.92); g.lineTo(x + w * 0.36, y - h * 0.6);
      g.lineTo(x + w * 0.12, y - h * 0.68); g.lineTo(x - w * 0.05, y - h * 0.58); g.lineTo(x - w * 0.22, y - h * 0.7); g.closePath(); fs(g, '#ffffff', OUT, 2.5);
    }
  }
  function pool(g, x, y, rx, ry, rng, water, rim) {
    blob(g, x, y, rx + 9, ry + 7, rng, 0.12); fs(g, rim, null);
    blob(g, x, y, rx, ry, rng, 0.14); fs(g, water, OUT, 3);
    g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 3; g.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const yy = y - ry * 0.4 + i * ry * 0.35; g.beginPath(); g.moveTo(x - rx * 0.35 + i * 8, yy); g.lineTo(x - rx * 0.05 + i * 8, yy); g.stroke(); }
  }
  function crystal(g, x, y, s, c) {
    shadow(g, x + 3 * s, y + 2 * s, 14 * s, 5 * s);
    const sh = [[-8, 0, -11, -22, -4, -30, 0, 0], [0, 0, -3, -38, 5, -46, 8, 0], [5, 0, 9, -20, 15, -24, 13, 0]];
    for (const p of sh) {
      g.beginPath(); g.moveTo(x + p[0] * s, y); g.lineTo(x + p[2] * s, y + p[3] * s); g.lineTo(x + p[4] * s, y + p[5] * s); g.lineTo(x + p[6] * s, y); g.closePath();
      fs(g, c, OUT, 2.5);
    }
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.moveTo(x - 1 * s, y - 4 * s); g.lineTo(x - 2.5 * s, y - 34 * s); g.lineTo(x + 1 * s, y - 36 * s); g.closePath(); g.fill();
  }
  function cactus(g, x, y, s) {
    shadow(g, x + 4 * s, y + 2 * s, 14 * s, 5 * s);
    const c = '#4f9a3c';
    const rr = (a, b, w, h) => { g.beginPath(); if (g.roundRect) g.roundRect(a, b, w, h, w / 2); else g.rect(a, b, w, h); fs(g, c, OUT, 2.5); };
    rr(x - 13 * s, y - 30 * s, 7 * s, 16 * s); rr(x + 6 * s, y - 36 * s, 7 * s, 18 * s); rr(x - 5 * s, y - 44 * s, 10 * s, 46 * s);
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 1 * s, y - 38 * s); g.lineTo(x - 1 * s, y - 4 * s); g.stroke();
  }
  function palm(g, x, y, s) {
    shadow(g, x + 6 * s, y + 2 * s, 18 * s, 6 * s);
    g.strokeStyle = OUT; g.lineWidth = 8 * s + 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6 * s, y - 25 * s, x + 2 * s, y - 46 * s); g.stroke();
    g.strokeStyle = '#a0703a'; g.lineWidth = 8 * s; g.stroke();
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k - 2) * 0.62;
      g.beginPath(); g.moveTo(x + 2 * s, y - 46 * s);
      g.quadraticCurveTo(x + 2 * s + Math.cos(a) * 16 * s, y - 46 * s + Math.sin(a) * 16 * s - 6 * s, x + 2 * s + Math.cos(a) * 30 * s, y - 46 * s + Math.sin(a) * 30 * s + 10 * s);
      g.lineWidth = 9 * s + 3; g.strokeStyle = OUT; g.stroke(); g.lineWidth = 9 * s; g.strokeStyle = '#4fae3c'; g.stroke();
    }
  }
  function volcano(g, x, y, w, h, c, lava) {
    g.beginPath(); g.moveTo(x - w, y); g.lineTo(x - w * 0.25, y - h); g.lineTo(x + w * 0.25, y - h); g.lineTo(x + w, y); g.closePath(); fs(g, c, OUT, 3.5);
    g.beginPath(); g.ellipse(x, y - h, w * 0.25, h * 0.08, 0, 0, TAU); fs(g, lava, OUT, 3);
    g.beginPath(); g.moveTo(x - w * 0.08, y - h); g.quadraticCurveTo(x - w * 0.2, y - h * 0.6, x - w * 0.12, y - h * 0.35); g.quadraticCurveTo(x - w * 0.02, y - h * 0.6, x + w * 0.06, y - h);
    g.closePath(); g.fillStyle = lava; g.fill();
    for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(x - 6 + k * 14, y - h - 22 - k * 20, 14 + k * 6, 0, TAU); g.fillStyle = 'rgba(70,60,60,' + (0.55 - k * 0.12) + ')'; g.fill(); }
  }
  function lavaRiver(g, pts, w, col) {
    const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length - 1; i++) g.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2); g.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); };
    g.lineCap = 'round'; g.lineJoin = 'round';
    path(); g.strokeStyle = 'rgba(255,120,40,0.35)'; g.lineWidth = w + 26; g.stroke();
    path(); g.strokeStyle = OUT; g.lineWidth = w + 6; g.stroke();
    path(); g.strokeStyle = col; g.lineWidth = w; g.stroke();
    path(); g.strokeStyle = 'rgba(255,240,150,0.85)'; g.lineWidth = w * 0.3; g.stroke();
  }
  function tomb(g, x, y, s) {
    shadow(g, x + 3 * s, y + 2 * s, 13 * s, 4 * s);
    g.beginPath(); g.moveTo(x - 10 * s, y); g.lineTo(x - 10 * s, y - 18 * s); g.arc(x, y - 18 * s, 10 * s, Math.PI, 0); g.lineTo(x + 10 * s, y); g.closePath(); fs(g, '#9c9a8c', OUT, 2.5);
    g.strokeStyle = 'rgba(40,40,30,0.6)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, y - 22 * s); g.lineTo(x, y - 10 * s); g.moveTo(x - 4 * s, y - 17 * s); g.lineTo(x + 4 * s, y - 17 * s); g.stroke();
  }
  function column(g, x, y, s, broken) {
    shadow(g, x + 4 * s, y + 2 * s, 14 * s, 5 * s);
    const h = (broken ? 26 : 46) * s;
    g.beginPath(); g.rect(x - 7 * s, y - h, 14 * s, h); fs(g, '#c9c3ae', OUT, 2.5);
    g.beginPath(); g.rect(x - 10 * s, y - 5 * s, 20 * s, 5 * s); fs(g, '#b5af99', OUT, 2.5);
    if (!broken) { g.beginPath(); g.rect(x - 10 * s, y - h - 5 * s, 20 * s, 6 * s); fs(g, '#b5af99', OUT, 2.5); }
    else { g.beginPath(); g.moveTo(x - 7 * s, y - h); g.lineTo(x - 2 * s, y - h - 6 * s); g.lineTo(x + 3 * s, y - h + 2 * s); g.lineTo(x + 7 * s, y - h - 4 * s); g.lineTo(x + 7 * s, y - h); fs(g, '#c9c3ae', OUT, 2.5); }
    g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 2 * s, y - h + 4 * s); g.lineTo(x - 2 * s, y - 6 * s); g.stroke();
  }
  function bones(g, x, y, s) {
    g.lineCap = 'round';
    for (const pass of [0, 1]) {
      g.strokeStyle = pass ? '#efe7cf' : OUT; g.lineWidth = (pass ? 4 : 7) * s;
      g.beginPath(); g.moveTo(x - 10 * s, y); g.lineTo(x + 10 * s, y - 4 * s); g.moveTo(x - 6 * s, y - 8 * s); g.lineTo(x + 6 * s, y + 3 * s); g.stroke();
    }
  }
  function skull(g, x, y, s) {
    g.beginPath(); g.arc(x, y - 8 * s, 8 * s, Math.PI, 0); g.lineTo(x + 6 * s, y); g.lineTo(x - 6 * s, y); g.closePath(); fs(g, '#efe7cf', OUT, 2.5);
    g.fillStyle = OUT; g.beginPath(); g.arc(x - 3 * s, y - 7 * s, 2 * s, 0, TAU); g.arc(x + 3 * s, y - 7 * s, 2 * s, 0, TAU); g.fill();
  }
  function ribcage(g, x, y, s) {
    g.lineCap = 'round';
    for (const pass of [0, 1]) {
      g.strokeStyle = pass ? '#efe7cf' : OUT; g.lineWidth = (pass ? 5 : 9) * s;
      g.beginPath(); g.moveTo(x - 40 * s, y); g.lineTo(x + 40 * s, y - 4 * s); g.stroke();
      for (let k = 0; k < 5; k++) { const xx = x - 28 * s + k * 14 * s; g.beginPath(); g.moveTo(xx, y - 1 * s); g.quadraticCurveTo(xx - 14 * s, y - 30 * s, xx + 4 * s, y - 46 * s + k * 3 * s); g.stroke(); }
    }
  }
  function goldPile(g, x, y, s, rng) {
    shadow(g, x + 3 * s, y + 2 * s, 22 * s, 6 * s);
    g.beginPath(); g.moveTo(x - 22 * s, y); g.quadraticCurveTo(x, y - 30 * s, x + 22 * s, y); g.closePath(); fs(g, '#ffcf3d', OUT, 3);
    for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(x + (rng() - 0.5) * 30 * s, y - 4 * s - rng() * 14 * s, 3.5 * s, 0, TAU); fs(g, '#ffe680', '#b07107', 1.5); }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 4 * s, y - 16 * s, 2 * s, 0, TAU); g.fill();
  }
  function gear(g, x, y, r, c, teeth) {
    teeth = teeth || 9;
    g.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const a0 = i / (teeth * 2) * TAU, a1 = (i + 1) / (teeth * 2) * TAU, rr = i % 2 ? r * 0.8 : r;
      g.lineTo(x + Math.cos(a0) * rr, y + Math.sin(a0) * rr); g.lineTo(x + Math.cos(a1) * rr, y + Math.sin(a1) * rr);
    }
    g.closePath(); fs(g, c, OUT, 3);
    g.beginPath(); g.arc(x, y, r * 0.35, 0, TAU); fs(g, shade(c, -0.35), OUT, 3);
  }
  function chimney(g, x, y, s) {
    shadow(g, x + 4 * s, y + 2 * s, 16 * s, 5 * s);
    g.beginPath(); g.rect(x - 9 * s, y - 52 * s, 18 * s, 52 * s); fs(g, '#7a5a44', OUT, 3);
    g.beginPath(); g.rect(x - 12 * s, y - 58 * s, 24 * s, 8 * s); fs(g, '#5d4434', OUT, 3);
    for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(x + 6 * s + k * 10 * s, y - 70 * s - k * 16 * s, (9 + k * 4) * s, 0, TAU); g.fillStyle = 'rgba(80,72,70,' + (0.6 - k * 0.15) + ')'; g.fill(); }
    g.fillStyle = 'rgba(255,170,60,0.9)'; g.beginPath(); g.rect(x - 4 * s, y - 20 * s, 8 * s, 8 * s); g.fill();
  }
  function banner(g, x, y, s, col) {
    g.strokeStyle = OUT; g.lineWidth = 5 * s + 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 52 * s); g.stroke();
    g.strokeStyle = '#6b4a2b'; g.lineWidth = 5 * s; g.stroke();
    g.beginPath(); g.moveTo(x, y - 50 * s); g.lineTo(x + 22 * s, y - 46 * s); g.lineTo(x + 18 * s, y - 36 * s); g.lineTo(x + 24 * s, y - 26 * s); g.lineTo(x, y - 28 * s); g.closePath(); fs(g, col, OUT, 2.5);
    skull(g, x + 10 * s, y - 33 * s, 0.55 * s);
  }
  function tent(g, x, y, s, col) {
    shadow(g, x + 4 * s, y + 2 * s, 24 * s, 6 * s);
    g.beginPath(); g.moveTo(x - 24 * s, y); g.lineTo(x, y - 34 * s); g.lineTo(x + 24 * s, y); g.closePath(); fs(g, col, OUT, 3);
    g.beginPath(); g.moveTo(x - 6 * s, y); g.lineTo(x, y - 18 * s); g.lineTo(x + 6 * s, y); g.closePath(); fs(g, '#2a1a10', null);
    g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 4 * s, y - 40 * s); g.lineTo(x + 4 * s, y - 28 * s); g.moveTo(x + 4 * s, y - 40 * s); g.lineTo(x - 4 * s, y - 28 * s); g.stroke();
  }
  function reeds(g, x, y, s) {
    g.lineCap = 'round';
    for (let k = -1; k <= 1; k++) {
      g.strokeStyle = '#3d5a26'; g.lineWidth = 3 * s;
      g.beginPath(); g.moveTo(x + k * 5 * s, y); g.quadraticCurveTo(x + k * 7 * s, y - 14 * s, x + k * 9 * s, y - 26 * s); g.stroke();
      g.strokeStyle = '#6b3f1d'; g.lineWidth = 5 * s; g.beginPath(); g.moveTo(x + k * 8.6 * s, y - 22 * s); g.lineTo(x + k * 9.4 * s, y - 30 * s); g.stroke();
    }
  }
  function flower(g, x, y, c) {
    g.fillStyle = c; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; g.beginPath(); g.arc(x + Math.cos(a) * 3, y + Math.sin(a) * 3, 2.6, 0, TAU); g.fill(); }
    g.fillStyle = '#ffe14a'; g.beginPath(); g.arc(x, y, 2, 0, TAU); g.fill();
  }

  // Pinta una zona entera (coordenadas locales 0..1280 × 0..720) en el contexto dado
  function paintZone(g, zi) {
    const Z = zones()[zi] || {};
    const M = Object.assign({ base: '#6cbf48', light: '#9adf66', dark: '#3f8a30', water: '#48b6e6', prop: '#2f7a2b', prop2: '#57a83a', trunk: '#7a4b22' }, Z.mapStyle || {});
    const P = Z.palette || {};
    const rng = rngOf('BB/mapa/fondo/' + (Z.id || zi));
    const x0 = zi * ZW;
    const free = (x, y, r) => distToPath(x + x0, y) > r + 46 && !nodes.some(nd => Math.abs(nd.x - x0 - x) < r + 60 && Math.abs(nd.y - y) < r + 60);
    // base
    const bg = g.createLinearGradient(0, 0, 0, ZH);
    bg.addColorStop(0, shade(M.base, 0.06)); bg.addColorStop(1, shade(M.base, -0.12));
    g.fillStyle = bg; g.fillRect(0, 0, ZW, ZH);
    for (let i = 0; i < 16; i++) {
      const x = rng() * ZW, y = rng() * ZH, r = 90 + rng() * 170;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const c = i % 2 ? M.light : M.dark;
      gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.35; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
    // textura menuda
    for (let i = 0; i < 260; i++) {
      const x = rng() * ZW, y = rng() * ZH;
      g.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
      g.beginPath(); g.ellipse(x, y, 3 + rng() * 6, 1.5 + rng() * 2.5, 0, 0, TAU); g.fill();
    }
    const decor = Z.decor || 'grass';
    const props = [];
    const place = (count, r, fn, yMin, yMax) => {
      let tries = 0, k = 0;
      while (k < count && tries++ < count * 8) {
        const x = 20 + rng() * (ZW - 40), y = (yMin || 30) + rng() * ((yMax || ZH - 10) - (yMin || 30));
        if (!free(x, y, r)) continue;
        props.push({ y, fn: fn.bind(null, x, y) }); k++;
      }
    };
    const lakes = (n, rx, water, rim) => {
      let tries = 0, k = 0;
      while (k < n && tries++ < 60) {
        const x = 80 + rng() * (ZW - 160), y = 60 + rng() * (ZH - 120), r = rx * (0.7 + rng() * 0.6);
        if (!free(x, y, r)) continue;
        pool(g, x, y, r, r * 0.55, rng, water, rim); k++;
      }
    };
    switch (decor) {
      case 'reeds':
        lakes(6, 70, M.water, shade(M.base, -0.25));
        for (let i = 0; i < 26; i++) { const x = rng() * ZW, y = rng() * ZH; if (free(x, y, 10)) { g.beginPath(); g.ellipse(x, y, 9, 6, 0, 0, TAU); fs(g, '#6fae46', OUT, 2); } }
        place(26, 14, (x, y) => reeds(g, x, y, 1 + rng() * 0.4));
        place(9, 26, (x, y) => deadTree(g, x, y, 1.1 + rng() * 0.4, '#5a4632'));
        place(12, 30, (x, y) => tree(g, x, y, 0.9 + rng() * 0.3, M.prop2, shade(M.prop2, 0.25), M.trunk));
        break;
      case 'rocks':
        for (let i = 0; i < 9; i++) props.push({ y: 150 + i * 0.01, fn: ((x) => () => mountain(g, x, 175 + rng() * 25, 120 + rng() * 60, 140 + rng() * 60, M.prop2, true))(i * 150 + rng() * 60) });
        place(18, 30, (x, y) => pine(g, x, y, 0.9 + rng() * 0.35, M.prop, shade(M.prop, 0.2), M.trunk, false), 230, 715);
        place(22, 18, (x, y) => rock(g, x, y, 0.9 + rng() * 0.8, '#9aa09a', rng), 220, 715);
        lakes(1, 70, M.water, shade(M.base, -0.2));
        break;
      case 'sand':
        for (let i = 0; i < 14; i++) {
          const x = rng() * ZW, y = rng() * ZH, w = 80 + rng() * 90;
          if (!free(x, y, 30)) continue;
          g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x, y - 34, x + w, y); g.quadraticCurveTo(x, y - 12, x - w, y); fs(g, M.light, 'rgba(120,70,20,0.5)', 3);
        }
        lakes(1, 60, M.water, '#7fc75a');
        place(16, 22, (x, y) => cactus(g, x, y, 0.9 + rng() * 0.4));
        place(6, 30, (x, y) => palm(g, x, y, 0.9 + rng() * 0.3));
        place(12, 16, (x, y) => rock(g, x, y, 0.8 + rng() * 0.7, '#c08a50', rng));
        place(6, 10, (x, y) => skull(g, x, y, 1.2));
        break;
      case 'lava': {
        for (let r = 0; r < 2; r++) {
          const pts = []; const yb = r ? 670 : 110;
          for (let x = -40; x <= ZW + 40; x += 160) pts.push([x, yb + (rng() - 0.5) * 70]);
          lavaRiver(g, pts, 20, M.water);
        }
        for (let i = 0; i < 4; i++) props.push({ y: 160, fn: ((x) => () => volcano(g, x, 200, 110 + rng() * 40, 120 + rng() * 40, M.prop2, '#ff7a1f'))(80 + i * 340 + rng() * 80) });
        place(26, 18, (x, y) => rock(g, x, y, 0.8 + rng() * 0.8, '#3b2b28', rng), 230, 650);
        for (let i = 0; i < 30; i++) { const x = rng() * ZW, y = 240 + rng() * 400; if (free(x, y, 12)) { g.strokeStyle = 'rgba(255,120,30,0.75)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 12, y + 4); g.lineTo(x + 22, y - 3); g.stroke(); } }
        break;
      }
      case 'ash':
        for (let i = 0; i < 10; i++) { const x = rng() * ZW, y = rng() * ZH; if (free(x, y, 40)) { blob(g, x, y, 60, 30, rng, 0.2); fs(g, 'rgba(30,25,40,0.35)', null); } }
        place(14, 26, (x, y) => deadTree(g, x, y, 1 + rng() * 0.5, '#4a4055'));
        place(16, 18, (x, y) => crystal(g, x, y, 0.8 + rng() * 0.6, '#b98cff'));
        place(7, 26, (x, y) => tent(g, x, y, 1, '#7a2a24'));
        place(7, 16, (x, y) => banner(g, x, y, 1, '#c8302a'));
        break;
      case 'snow':
        lakes(4, 75, '#9fe0ff', '#ffffff');
        for (let i = 0; i < 6; i++) props.push({ y: 150, fn: ((x) => () => mountain(g, x, 170, 120 + rng() * 50, 120 + rng() * 50, '#b7d3e6', true))(i * 230 + rng() * 80) });
        place(30, 26, (x, y) => pine(g, x, y, 0.9 + rng() * 0.4, M.prop, shade(M.prop, 0.25), M.trunk, true), 220, 715);
        place(12, 16, (x, y) => crystal(g, x, y, 0.7 + rng() * 0.5, '#8fe3ff'));
        break;
      case 'bones':
        for (let i = 0; i < 12; i++) {
          const x = rng() * ZW, y = rng() * ZH;
          if (!free(x, y, 40)) continue;
          for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { if (rng() < 0.35) continue; g.beginPath(); g.rect(x + a * 22, y + b * 16, 20, 14); fs(g, 'rgba(160,160,140,0.5)', 'rgba(40,40,30,0.4)', 2); }
        }
        place(16, 18, (x, y) => column(g, x, y, 0.9 + rng() * 0.4, rng() < 0.6));
        place(18, 14, (x, y) => tomb(g, x, y, 0.9 + rng() * 0.4));
        place(14, 12, (x, y) => bones(g, x, y, 1 + rng() * 0.4));
        place(10, 24, (x, y) => deadTree(g, x, y, 1 + rng() * 0.4, '#4d4636'));
        for (let i = 0; i < 18; i++) { const x = rng() * ZW, y = rng() * ZH; const gr = g.createRadialGradient(x, y, 0, x, y, 26); gr.addColorStop(0, 'rgba(125,255,178,0.45)'); gr.addColorStop(1, 'rgba(125,255,178,0)'); g.fillStyle = gr; g.fillRect(x - 26, y - 26, 52, 52); }
        break;
      case 'gears': {
        for (let i = 0; i < 14; i++) {
          const x = rng() * ZW, y = rng() * ZH, w = 70 + rng() * 80, h = 50 + rng() * 50;
          if (!free(x, y, 40)) continue;
          g.beginPath(); g.rect(x - w / 2, y - h / 2, w, h); fs(g, 'rgba(120,124,132,0.55)', 'rgba(30,25,20,0.6)', 3);
          g.fillStyle = 'rgba(30,25,20,0.6)'; for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.beginPath(); g.arc(x + a * (w / 2 - 7), y + b * (h / 2 - 7), 3, 0, TAU); g.fill(); }
        }
        const pts = []; for (let x = -40; x <= ZW + 40; x += 180) pts.push([x, 680 + (rng() - 0.5) * 40]);
        lavaRiver(g, pts, 16, M.water);
        place(14, 30, (x, y) => gear(g, x, y - 20, 20 + rng() * 16, rng() < 0.5 ? '#8d929c' : '#b08a4a', 8 + ((rng() * 4) | 0)));
        place(8, 22, (x, y) => chimney(g, x, y, 1 + rng() * 0.3));
        place(10, 16, (x, y) => rock(g, x, y, 0.8 + rng() * 0.5, '#6b625a', rng));
        break;
      }
      case 'embers': {
        for (let r = 0; r < 3; r++) {
          const pts = []; const yb = [95, 690, 380][r];
          for (let x = -40; x <= ZW + 40; x += 140) pts.push([x, yb + (rng() - 0.5) * 60]);
          if (r === 2) { for (let i = 0; i < 9; i++) { const x = rng() * ZW, y = 240 + rng() * 380; if (free(x, y, 30)) lavaRiver(g, [[x - 30, y], [x, y + 8], [x + 30, y - 4]], 6, M.water); } }
          else lavaRiver(g, pts, 18, M.water);
        }
        place(5, 50, (x, y) => ribcage(g, x, y, 1 + rng() * 0.4));
        place(9, 26, (x, y) => goldPile(g, x, y, 0.9 + rng() * 0.5, rng));
        place(18, 18, (x, y) => rock(g, x, y, 0.9 + rng() * 0.8, '#3a2420', rng));
        place(10, 12, (x, y) => skull(g, x, y, 1.3));
        break;
      }
      default: // bosque
        lakes(2, 80, M.water, '#d9c48a');
        for (let i = 0; i < 70; i++) { const x = rng() * ZW, y = rng() * ZH; if (free(x, y, 6)) flower(g, x, y, ['#ffffff', '#ff8ad0', '#ffe14a', '#ff6a52'][(rng() * 4) | 0]); }
        place(48, 28, (x, y) => tree(g, x, y, 0.85 + rng() * 0.45, rng() < 0.5 ? M.prop : M.prop2, shade(M.prop2, 0.35), M.trunk));
        place(14, 14, (x, y) => { g.beginPath(); g.arc(x - 7, y - 6, 9, 0, TAU); g.arc(x + 6, y - 6, 9, 0, TAU); g.arc(x, y - 12, 10, 0, TAU); fs(g, M.prop2, OUT, 2.5); g.beginPath(); g.arc(x - 7, y - 6, 9, 0, TAU); g.arc(x + 6, y - 6, 9, 0, TAU); g.arc(x, y - 12, 10, 0, TAU); g.fillStyle = M.prop2; g.fill(); });
        place(8, 16, (x, y) => rock(g, x, y, 0.8 + rng() * 0.4, '#a7a69a', rng));
    }
    props.sort((a, b) => a.y - b.y);
    for (const p of props) p.fn();
    // viñeta suave arriba y abajo
    const vg = g.createLinearGradient(0, 0, 0, ZH);
    vg.addColorStop(0, 'rgba(0,0,0,0.28)'); vg.addColorStop(0.18, 'rgba(0,0,0,0)'); vg.addColorStop(0.85, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.fillStyle = vg; g.fillRect(0, 0, ZW, ZH);
    if (P.fog) { g.fillStyle = P.fog; g.fillRect(0, 0, ZW, ZH); }
  }

  // Caché de fondos procedurales (LRU de 5)
  const bgCache = new Map();
  let bgRes = 1;
  function zoneCanvas(zi) {
    const key = zi + '@' + bgRes;
    if (bgCache.has(key)) { const c = bgCache.get(key); bgCache.delete(key); bgCache.set(key, c); return c; }
    const c = document.createElement('canvas');
    c.width = Math.round(ZW * bgRes); c.height = Math.round(ZH * bgRes);
    const g = c.getContext('2d');
    g.scale(bgRes, bgRes);
    try { paintZone(g, zi); } catch (err) { console.error('[mapa] fondo', err); g.fillStyle = '#4a7a3a'; g.fillRect(0, 0, ZW, ZH); }
    bgCache.set(key, c);
    while (bgCache.size > 5) bgCache.delete(bgCache.keys().next().value);
    return c;
  }

  // ---------------------------------------------------------------- estado de la pantalla
  let root, canvas, ctx, topEl, titleEl, starsEl, bottomEl, dotsEl, gotoBtn, panelBack;
  let ownCurs = null;
  let vw = 0, vh = 0, dpr = 1, scale = 1, uiS = 1, topPx = 50;
  let viewX = 0, vel = 0, anim = null;
  let visible = false, rafId = 0, lastFrame = 0, lastTickCall = 0, time = 0;
  let drag = null;
  const nodeFx = {};          // n → { kind, t }
  const parts = [];           // partículas (coordenadas de mapa)
  let snapshot = null;        // estado al ocultar (para animar lo nuevo al volver)
  let shakeNode = 0, shakeT = 0;
  let curZone = -1;

  function maxView() { return Math.max(0, TOTAL_W - vw / scale); }
  function nodeOf(n) { return nodes[clamp(n, 1, LEVELS)]; }
  function centerX(n) { return nodeOf(n).x - vw / scale / 2; }

  function build() {
    if (root) return root;
    buildLayout();
    samplePath();
    root = el('div', { class: 'bbm', 'data-screen-inner': 'map' });
    canvas = el('canvas', { class: 'bbm-canvas', 'aria-label': 'Mapa de niveles' });
    ctx = canvas.getContext('2d');
    root.appendChild(canvas);
    // barra superior
    const backFn = () => { if (BB.app && BB.app.goMenu) BB.app.goMenu(); else if (BB.ui && BB.ui.show) BB.ui.show('menu'); };
    let bar = null;
    if (BB.ui && typeof BB.ui.topBar === 'function') {
      try { bar = BB.ui.topBar({ back: backFn, title: ' ', currencies: ['gold', 'gems', 'stars'] }); } catch (err) { bar = null; }
    }
    if (!bar) {
      bar = el('div', { class: 'ui-topbar' });
      bar.appendChild(button(null, backFn, { kind: 'wood', round: true, icon: 'back', title: 'Volver al menú', sound: 'close' }));
      bar.appendChild(el('div', { class: 'tb-title', text: ' ' }));
      bar.appendChild(el('div', { class: 'tb-spacer' }));
      const curs = el('div', { class: 'tb-curs' });
      ownCurs = {};
      for (const k of ['gold', 'gems', 'stars']) {
        const v = el('span', { class: 'cur-val', text: '0' });
        curs.appendChild(el('div', { class: 'cur cur-' + k, 'data-cur-own': k }, [icon(k === 'gems' ? 'gem' : k === 'stars' ? 'star' : 'gold'), v]));
        ownCurs[k] = v;
      }
      bar.appendChild(curs);
    }
    topEl = el('div', { class: 'bbm-top' }, [bar]);
    titleEl = bar.querySelector('.tb-title');
    starsEl = bar.querySelector('[data-cur="stars"] .cur-val, [data-cur-own="stars"] .cur-val');
    root.appendChild(topEl);
    // abajo: indicador de zonas y botones
    dotsEl = el('div', { class: 'bbm-dots' });
    zones().forEach((z, i) => {
      const d = el('button', { class: 'bbm-dot', type: 'button', title: z.name || ('Zona ' + (i + 1)), 'aria-label': 'Ir a la zona ' + (i + 1) });
      d.textContent = String(i + 1);
      d.addEventListener('click', e => { e.stopPropagation(); sfx('click'); scrollTo(i * ZW + ZW / 2 - vw / scale / 2, 0.7); });
      dotsEl.appendChild(d);
    });
    bottomEl = el('div', { class: 'bbm-bottom' }, [
      dotsEl,
      el('div', { class: 'bbm-actions' }, [
        button('Ejército', () => { if (BB.ui && BB.ui.show) BB.ui.show('army'); }, { kind: 'blue', icon: 'sword', cls: 'bbm-army', title: 'Colocar héroes y trampas' }),
        button('Tienda', () => { if (BB.ui && BB.ui.show) BB.ui.show('shop'); }, { kind: 'gold', icon: 'shop', cls: 'bbm-shop', title: 'Mejorar castillo, héroes y torres' }),
      ]),
    ]);
    root.appendChild(bottomEl);
    gotoBtn = el('button', { class: 'bbm-goto', type: 'button' });
    gotoBtn.addEventListener('click', e => { e.stopPropagation(); sfx('click'); scrollTo(centerX(save().maxLevel || 1), 0.8); });
    root.appendChild(gotoBtn);
    panelBack = el('div', { class: 'bbm-panel-back', hidden: true });
    panelBack.addEventListener('click', e => { if (e.target === panelBack) closePanel(); });
    root.appendChild(panelBack);
    // entrada
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', checkSize);
    if (typeof ResizeObserver === 'function') { try { new ResizeObserver(checkSize).observe(root); } catch (err) { /* nada */ } }
    return root;
  }

  let lastSize = '';
  function checkSize() {
    if (!visible || !root) return;
    const k = root.clientWidth + 'x' + root.clientHeight + '@' + (window.devicePixelRatio || 1);
    if (k !== lastSize) { lastSize = k; layout(); render(); }
  }
  function layout() {
    // clientWidth/Height: no les afecta el transform de la animación de entrada; se conserva el centro
    const centerU = vw > 1 ? viewX + vw / scale / 2 : null;
    vw = Math.max(1, root.clientWidth || window.innerWidth);
    vh = Math.max(1, root.clientHeight || window.innerHeight);
    lastSize = root.clientWidth + 'x' + root.clientHeight + '@' + (window.devicePixelRatio || 1);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    scale = vh / ZH;
    uiS = clamp(scale, 0.62, 1.25);
    const newRes = clamp(Math.ceil(scale * dpr * 4) / 4, 0.5, 1);
    if (newRes !== bgRes) { bgRes = newRes; bgCache.clear(); }
    topPx = topEl.offsetHeight ? topEl.offsetTop + topEl.offsetHeight - 6 : 50;
    if (centerU != null && visible) viewX = centerU - vw / scale / 2;
    viewX = clamp(viewX, 0, maxView());
  }

  // ---------------------------------------------------------------- dibujo
  function render() {
    if (!ctx || !vw) return;
    const s = save();
    const max = clamp(s.maxLevel || 1, 1, LEVELS);
    const g = ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#20140a'; g.fillRect(0, 0, vw, vh);
    const vx0 = viewX, vx1 = viewX + vw / scale;
    // fondos
    g.save();
    g.scale(scale, scale);
    g.translate(-viewX, 0);
    for (let z = Math.max(0, Math.floor(vx0 / ZW)); z <= Math.min(NZ - 1, Math.floor(vx1 / ZW)); z++) {
      const Z = zones()[z] || {};
      const img = asset(Z.map || ('map_' + Z.id));
      if (img) g.drawImage(img, z * ZW, 0, ZW, ZH);
      else g.drawImage(zoneCanvas(z), z * ZW, 0, ZW, ZH);
      if (z * 10 + 1 > max) { g.fillStyle = 'rgba(16,14,34,0.38)'; g.fillRect(z * ZW, 0, ZW, ZH); }
    }
    // nubes en las fronteras entre zonas (tapan la costura)
    for (let b = 1; b < NZ; b++) {
      const bx = b * ZW;
      if (bx < vx0 - 160 || bx > vx1 + 160) continue;
      const rng = rngOf('BB/mapa/nubes/' + b);
      const pathY = nodes[b * 10].y * 0.5 + nodes[b * 10 + 1].y * 0.5;
      for (let i = 0; i < 12; i++) {
        const y = i * 64 + rng() * 30 - 10;
        if (Math.abs(y - pathY) < 80) continue;
        const r = 40 + rng() * 34, x = bx + (rng() - 0.5) * 60 + Math.sin(time * 0.4 + i) * 4;
        g.fillStyle = 'rgba(70,80,110,0.25)'; g.beginPath(); g.arc(x + 4, y + 8, r, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.92)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        g.fillStyle = 'rgba(220,232,245,0.95)'; g.beginPath(); g.arc(x + r * 0.25, y + r * 0.3, r * 0.6, 0, TAU); g.fill();
      }
    }
    // camino
    const roadW = 30 * uiS / scale;
    const drawSegs = (from, to, style) => {
      g.beginPath();
      for (let k = from; k < to; k++) {
        const sg = segs[k];
        if (!sg || sg.maxX < vx0 - 50 || sg.minX > vx1 + 50) continue;
        g.moveTo(sg.a.x, sg.a.y); g.bezierCurveTo(sg.c1.x, sg.c1.y, sg.c2.x, sg.c2.y, sg.b.x, sg.b.y);
      }
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const [col, w, dash] of style) { g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash || []); g.stroke(); }
      g.setLineDash([]);
    };
    const doneTo = Math.min(segs.length, max);   // segmentos 0..max-1 llevan hasta el nivel actual
    drawSegs(0, doneTo, [['rgba(0,0,0,0.25)', roadW * 1.25], [OUT, roadW * 1.08], ['#f1d79a', roadW * 0.82], ['#fff6cf', roadW * 0.16, [roadW * 0.5, roadW * 0.55]]]);
    drawSegs(doneTo, segs.length, [['rgba(0,0,0,0.22)', roadW * 1.2], ['#3b2a1c', roadW * 1.02], ['#a99475', roadW * 0.74], ['rgba(70,55,40,0.55)', roadW * 0.12, [roadW * 0.3, roadW * 0.6]]]);
    // partículas en coordenadas de mapa
    for (const p of parts) { g.globalAlpha = clamp(p.life / p.max, 0, 1); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r / scale * uiS, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
    g.restore();
    // castillo de salida
    drawStart(g);
    // nodos (espacio de pantalla)
    const zs = zones();
    for (let n = 1; n <= LEVELS; n++) {
      const nd = nodes[n];
      if (nd.x < vx0 - 120 / scale || nd.x > vx1 + 120 / scale) continue;
      drawNode(g, nd, levelState(s, n), zs[nd.z]);
    }
    // carteles de zona
    for (let z = 0; z < NZ; z++) {
      const cx = (z * ZW + ZW / 2 - viewX) * scale;
      if (cx < -300 || cx > vw + 300) continue;
      drawZoneSign(g, z, cx, s, max);
    }
  }

  function drawStart(g) {
    const sx = (nodes[0].x - viewX) * scale, sy = nodes[0].y * scale;
    if (sx < -150 || sx > vw + 150) return;
    const img = asset('castle_' + clamp(((BB.castleStats && (() => { try { return BB.castleStats(save()).tier; } catch (e) { return 1; } })()) || 1), 1, 5));
    const h = 120 * uiS;
    if (img) {
      const w = img.naturalWidth * h / img.naturalHeight;
      g.drawImage(img, sx - w / 2, sy + 30 * uiS - h, w, h);
    } else {
      g.save(); g.translate(sx, sy + 26 * uiS); g.scale(uiS, uiS);
      g.lineWidth = 4; g.strokeStyle = OUT;
      g.fillStyle = '#c2c6cd'; g.fillRect(-46, -70, 92, 70); g.strokeRect(-46, -70, 92, 70);
      for (const tx of [-58, 30]) { g.fillStyle = '#d0d4da'; g.fillRect(tx, -100, 28, 100); g.strokeRect(tx, -100, 28, 100); g.fillStyle = '#3f7fd1'; g.beginPath(); g.moveTo(tx - 6, -100); g.lineTo(tx + 14, -132); g.lineTo(tx + 34, -100); g.closePath(); g.fill(); g.stroke(); }
      g.fillStyle = '#7a4a22'; g.beginPath(); g.moveTo(-14, 0); g.lineTo(-14, -26); g.arc(0, -26, 14, Math.PI, 0); g.lineTo(14, 0); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
    label(g, 'Bastión Bravo', sx, sy + 46 * uiS, 15 * uiS, '#fff', OUT);
  }

  function label(g, text, x, y, size, fill, stroke) {
    g.font = Math.round(size) + 'px ' + FONT_T;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.strokeStyle = stroke || OUT; g.lineWidth = Math.max(2, size * 0.28); g.strokeText(text, x, y);
    g.fillStyle = fill; g.fillText(text, x, y);
  }
  function starPath(g, x, y, r) {
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.48 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath();
  }
  function drawStars(g, x, y, n, r) {
    for (let i = 0; i < 3; i++) {
      const sx = x + (i - 1) * r * 2.05, sy = y + (i === 1 ? r * 0.35 : 0);
      starPath(g, sx, sy, r);
      g.fillStyle = i < n ? '#ffd23f' : 'rgba(40,30,20,0.55)'; g.fill();
      g.strokeStyle = OUT; g.lineWidth = Math.max(1.5, r * 0.28); g.lineJoin = 'round'; g.stroke();
      if (i < n) { g.fillStyle = 'rgba(255,255,220,0.8)'; g.beginPath(); g.arc(sx - r * 0.2, sy - r * 0.25, r * 0.22, 0, TAU); g.fill(); }
    }
  }
  function drawLock(g, x, y, s) {
    g.lineWidth = 3.2 * s; g.strokeStyle = OUT;
    g.beginPath(); g.arc(x, y - 3 * s, 5.5 * s, Math.PI, 0); g.stroke();
    g.fillStyle = '#ffc83a'; g.beginPath(); if (g.roundRect) g.roundRect(x - 8 * s, y - 3 * s, 16 * s, 12 * s, 2.5 * s); else g.rect(x - 8 * s, y - 3 * s, 16 * s, 12 * s);
    g.fill(); g.lineWidth = 2 * s; g.stroke();
    g.fillStyle = OUT; g.beginPath(); g.arc(x, y + 2.5 * s, 1.8 * s, 0, TAU); g.fill();
  }
  function drawSkull(g, x, y, r) {
    g.beginPath(); g.arc(x, y - r * 0.1, r * 0.62, Math.PI * 0.9, Math.PI * 0.1); g.lineTo(x + r * 0.42, y + r * 0.55); g.lineTo(x - r * 0.42, y + r * 0.55); g.closePath();
    g.fillStyle = '#f4efe2'; g.fill(); g.strokeStyle = OUT; g.lineWidth = Math.max(2, r * 0.1); g.stroke();
    g.fillStyle = OUT; g.beginPath(); g.arc(x - r * 0.24, y, r * 0.16, 0, TAU); g.arc(x + r * 0.24, y, r * 0.16, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(x, y + r * 0.12); g.lineTo(x - r * 0.07, y + r * 0.28); g.lineTo(x + r * 0.07, y + r * 0.28); g.closePath(); g.fill();
  }

  function drawNode(g, nd, st, Z) {
    let sx = (nd.x - viewX) * scale, sy = nd.y * scale;
    const fx = nodeFx[nd.n];
    let pop = 1;
    if (fx) {
      const k = (time - fx.t) / 0.7;
      if (k >= 1) delete nodeFx[nd.n];
      else if (fx.kind === 'unlock') pop = (BB.util && BB.util.easeOutBack ? BB.util.easeOutBack(clamp(k, 0, 1)) : k) * 0.5 + 0.5;
    }
    if (shakeNode === nd.n && shakeT > 0) sx += Math.sin(time * 60) * 5 * shakeT;
    const R = (nd.boss ? 46 : 24) * uiS * pop;
    // sombra
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(sx + R * 0.1, sy + R * 0.75, R * 1.05, R * 0.42, 0, 0, TAU); g.fill();
    if (st.current) {
      const k = (time % 1.3) / 1.3;
      g.strokeStyle = 'rgba(255,255,255,' + (0.75 * (1 - k)) + ')'; g.lineWidth = 4 * uiS;
      g.beginPath(); g.arc(sx, sy, R * (1.1 + k * 0.9), 0, TAU); g.stroke();
      const glow = g.createRadialGradient(sx, sy, R * 0.6, sx, sy, R * 1.9);
      glow.addColorStop(0, nd.boss ? 'rgba(255,90,60,0.55)' : 'rgba(255,240,150,0.6)'); glow.addColorStop(1, 'rgba(255,240,150,0)');
      g.fillStyle = glow; g.beginPath(); g.arc(sx, sy, R * 1.9, 0, TAU); g.fill();
    }
    const face = st.locked ? ['#c9c3ba', '#8f8a83', '#5d5853'] : st.current ? ['#8fe6ff', '#2f9fe0', '#1a5f96'] : ['#ffe680', '#f2b21f', '#9c6406'];
    if (nd.boss) {
      const bi = bossInfo(Z && Z.boss);
      const ring = st.locked ? '#6d6660' : st.cleared ? '#ffcf3d' : '#e8412c';
      // pinchos de corona
      g.fillStyle = ring; g.strokeStyle = OUT; g.lineWidth = 3 * uiS;
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (i - 4) * 0.33;
        g.beginPath(); g.moveTo(sx + Math.cos(a - 0.12) * R * 0.95, sy + Math.sin(a - 0.12) * R * 0.95);
        g.lineTo(sx + Math.cos(a) * R * 1.32, sy + Math.sin(a) * R * 1.32); g.lineTo(sx + Math.cos(a + 0.12) * R * 0.95, sy + Math.sin(a + 0.12) * R * 0.95); g.closePath(); g.fill(); g.stroke();
      }
      g.beginPath(); g.arc(sx, sy + R * 0.1, R, 0, TAU); g.fillStyle = shade(ring, -0.45); g.fill();
      g.beginPath(); g.arc(sx, sy, R, 0, TAU); g.fillStyle = ring; g.fill(); g.lineWidth = 3.5 * uiS; g.strokeStyle = OUT; g.stroke();
      // retrato
      const ir = R * 0.8;
      g.save(); g.beginPath(); g.arc(sx, sy, ir, 0, TAU); g.clip();
      const bgc = g.createRadialGradient(sx, sy - ir * 0.3, ir * 0.1, sx, sy, ir);
      bgc.addColorStop(0, '#fff3cf'); bgc.addColorStop(1, bi.color || '#c8302a');
      g.fillStyle = bgc; g.fillRect(sx - ir, sy - ir, ir * 2, ir * 2);
      const img = asset('boss_' + (Z && Z.boss));
      if (img) {
        const w = img.naturalWidth, h = img.naturalHeight, side = Math.min(w * 0.8, h * 0.62);
        g.drawImage(img, (w - side) / 2, 0, side, side, sx - ir, sy - ir, ir * 2, ir * 2);
      } else drawSkull(g, sx, sy, ir * 0.95);
      if (st.locked) { g.fillStyle = 'rgba(20,16,30,0.6)'; g.fillRect(sx - ir, sy - ir, ir * 2, ir * 2); }
      g.restore();
      g.beginPath(); g.arc(sx, sy, ir, 0, TAU); g.strokeStyle = OUT; g.lineWidth = 3 * uiS; g.stroke();
      if (st.locked) drawLock(g, sx + R * 0.62, sy + R * 0.55, 1.5 * uiS);
      // cinta con el nombre
      const ry = sy + R * 1.12;
      g.font = Math.round(14 * uiS) + 'px ' + FONT_T;
      const tw = g.measureText(bi.name).width + 26 * uiS, th = 22 * uiS;
      g.fillStyle = st.locked ? '#5d5853' : '#b5352a';
      g.beginPath(); g.moveTo(sx - tw / 2 - 10 * uiS, ry - th / 2 + 4 * uiS); g.lineTo(sx - tw / 2, ry - th / 2 + 4 * uiS); g.lineTo(sx - tw / 2, ry + th / 2 + 4 * uiS); g.lineTo(sx - tw / 2 - 10 * uiS, ry + th / 2 + 4 * uiS); g.lineTo(sx - tw / 2 - 5 * uiS, ry + 4 * uiS); g.closePath();
      g.moveTo(sx + tw / 2 + 10 * uiS, ry - th / 2 + 4 * uiS); g.lineTo(sx + tw / 2, ry - th / 2 + 4 * uiS); g.lineTo(sx + tw / 2, ry + th / 2 + 4 * uiS); g.lineTo(sx + tw / 2 + 10 * uiS, ry + th / 2 + 4 * uiS); g.lineTo(sx + tw / 2 + 5 * uiS, ry + 4 * uiS); g.closePath();
      g.fillStyle = st.locked ? '#45403c' : '#8e2219'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 2.5 * uiS; g.stroke();
      g.beginPath(); if (g.roundRect) g.roundRect(sx - tw / 2, ry - th / 2, tw, th, 4 * uiS); else g.rect(sx - tw / 2, ry - th / 2, tw, th);
      g.fillStyle = st.locked ? '#7a746d' : '#d8473a'; g.fill(); g.stroke();
      label(g, bi.name, sx, ry + 1, 14 * uiS, '#fff', OUT);
      label(g, String(nd.n), sx, sy - R * 1.02, 15 * uiS, '#fff', OUT);
      if (st.cleared) drawStars(g, sx, ry + th * 0.95, st.stars, 9 * uiS);
      return;
    }
    // nodo normal (moneda con relieve)
    g.beginPath(); g.arc(sx, sy + R * 0.18, R, 0, TAU); g.fillStyle = face[2]; g.fill(); g.strokeStyle = OUT; g.lineWidth = 3 * uiS; g.stroke();
    const grd = g.createLinearGradient(0, sy - R, 0, sy + R);
    grd.addColorStop(0, face[0]); grd.addColorStop(1, face[1]);
    g.beginPath(); g.arc(sx, sy, R, 0, TAU); g.fillStyle = grd; g.fill(); g.stroke();
    g.beginPath(); g.ellipse(sx - R * 0.15, sy - R * 0.45, R * 0.55, R * 0.25, -0.2, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.45)'; g.fill();
    if (st.locked) drawLock(g, sx, sy, 1.15 * uiS * pop);
    else label(g, String(nd.n), sx, sy + 1, (nd.n >= 100 ? 15 : 18) * uiS, '#fff', OUT);
    if (st.cleared) drawStars(g, sx, sy + R + 8 * uiS, st.stars, 7.5 * uiS);
    if (st.current) drawFlag(g, sx, sy - R, R);
  }

  function drawFlag(g, x, y, R) {
    const bob = Math.sin(time * 3) * 3 * uiS;
    const top = y - 40 * uiS + bob, px = x + R * 0.15;
    g.strokeStyle = OUT; g.lineWidth = 5 * uiS; g.lineCap = 'round';
    g.beginPath(); g.moveTo(px, y + 2); g.lineTo(px, top); g.stroke();
    g.strokeStyle = '#8a5530'; g.lineWidth = 2.5 * uiS; g.stroke();
    g.beginPath(); g.moveTo(px, top);
    const w = 26 * uiS, h = 17 * uiS;
    for (let i = 0; i <= 6; i++) g.lineTo(px + w * i / 6, top + Math.sin(time * 6 + i) * 2 * uiS);
    g.lineTo(px + w * 0.82, top + h * 0.5 + Math.sin(time * 6 + 5) * 2 * uiS);
    for (let i = 6; i >= 0; i--) g.lineTo(px + w * i / 6, top + h + Math.sin(time * 6 + i) * 2 * uiS);
    g.closePath(); g.fillStyle = '#e8412c'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 2.5 * uiS; g.lineJoin = 'round'; g.stroke();
    starPath(g, px + w * 0.38, top + h * 0.5, 5 * uiS); g.fillStyle = '#ffd23f'; g.fill();
    g.beginPath(); g.arc(px, top, 3.5 * uiS, 0, TAU); g.fillStyle = '#ffd23f'; g.fill(); g.lineWidth = 2 * uiS; g.stroke();
  }

  function drawZoneSign(g, z, cx, s, max) {
    const Z = zones()[z] || {};
    let got = 0;
    for (let n = z * 10 + 1; n <= z * 10 + 10; n++) got += (s.levels && s.levels[n] && s.levels[n].stars) || 0;
    const locked = z * 10 + 1 > max;
    const text = 'Zona ' + (z + 1) + ' · ' + (Z.name || Z.id || '');
    const fsz = 17 * uiS;
    g.font = Math.round(fsz) + 'px ' + FONT_T;
    const tw = g.measureText(text).width;
    const w = tw + 44 * uiS + (locked ? 18 * uiS : 0), h = 34 * uiS;
    const cy = Math.max(topPx + 8 + h / 2, 160 * scale - h);
    const sub = locked ? 'Bloqueada' : got + ' / 30';
    // tablón de madera con postes
    g.save();
    g.strokeStyle = OUT; g.lineWidth = 3 * uiS;
    g.fillStyle = '#5b3418';
    g.fillRect(cx - w * 0.32 - 4 * uiS, cy, 8 * uiS, h * 0.9); g.strokeRect(cx - w * 0.32 - 4 * uiS, cy, 8 * uiS, h * 0.9);
    g.fillRect(cx + w * 0.32 - 4 * uiS, cy, 8 * uiS, h * 0.9); g.strokeRect(cx + w * 0.32 - 4 * uiS, cy, 8 * uiS, h * 0.9);
    g.beginPath(); if (g.roundRect) g.roundRect(cx - w / 2, cy - h / 2, w, h, 7 * uiS); else g.rect(cx - w / 2, cy - h / 2, w, h);
    const wg = g.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
    wg.addColorStop(0, locked ? '#8c857b' : '#b5793f'); wg.addColorStop(1, locked ? '#5f5952' : '#7f4c27');
    g.fillStyle = wg; g.fill(); g.lineWidth = 3.5 * uiS; g.stroke();
    g.strokeStyle = 'rgba(255,220,160,0.3)'; g.lineWidth = 1.5 * uiS; g.beginPath(); g.moveTo(cx - w / 2 + 6 * uiS, cy - h / 2 + 5 * uiS); g.lineTo(cx + w / 2 - 6 * uiS, cy - h / 2 + 5 * uiS); g.stroke();
    label(g, text, cx + (locked ? 9 * uiS : 0), cy + 1, fsz, locked ? '#e9e4dc' : '#fff1c4', OUT);
    if (locked) drawLock(g, cx - tw / 2 - 4 * uiS, cy, 0.95 * uiS);
    // placa con estrellas
    const pw = 76 * uiS, ph = 20 * uiS, py = cy + h / 2 + ph / 2 + 2 * uiS;
    g.beginPath(); if (g.roundRect) g.roundRect(cx - pw / 2, py - ph / 2, pw, ph, 10 * uiS); else g.rect(cx - pw / 2, py - ph / 2, pw, ph);
    g.fillStyle = 'rgba(30,16,6,0.82)'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 2 * uiS; g.stroke();
    if (!locked) { starPath(g, cx - pw / 2 + 12 * uiS, py, 7 * uiS); g.fillStyle = '#ffd23f'; g.fill(); g.lineWidth = 1.6 * uiS; g.stroke(); }
    label(g, sub, cx + (locked ? 0 : 7 * uiS), py + 1, 12.5 * uiS, '#fff', OUT);
    g.restore();
  }

  // ---------------------------------------------------------------- animación y entrada
  function step(dt) {
    time += dt;
    checkSize();
    if (anim) {
      anim.t += dt;
      const k = clamp(anim.t / anim.dur, 0, 1);
      const e = BB.util && BB.util.easeInOutSine ? BB.util.easeInOutSine(k) : k;
      viewX = anim.from + (anim.to - anim.from) * e;
      if (k >= 1) { const cb = anim.done; anim = null; if (cb) cb(); }
    } else if (!drag && Math.abs(vel) > 4) {
      viewX += vel * dt;
      vel *= Math.exp(-dt * 3.2);
      if (viewX < 0 || viewX > maxView()) { viewX = clamp(viewX, 0, maxView()); vel = 0; }
    } else if (!drag) {
      vel = 0;
      const m = maxView();
      if (viewX < 0) viewX = Math.min(0, viewX + Math.max(1, -viewX) * dt * 10);
      else if (viewX > m) viewX = Math.max(m, viewX - Math.max(1, viewX - m) * dt * 10);
    }
    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt * 2.5);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt;
      if (p.life <= 0) parts.splice(i, 1);
    }
    updateHud();
  }

  function frame(now) {
    rafId = 0;
    if (!visible) return;
    rafId = requestAnimationFrame(frame);
    const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0.016;
    lastFrame = now;
    if (now - lastTickCall < 120) return;     // ya nos mueve BB.ui.tick
    step(dt); render();
  }
  function tick(dt) {
    if (!visible) return;
    lastTickCall = performance.now();
    step(Math.min(0.05, dt || 0.016)); render();
  }

  function scrollTo(x, dur, done) {
    vel = 0;
    const to = clamp(x, 0, maxView());
    if (!dur) { viewX = to; anim = null; if (done) done(); return; }
    anim = { from: viewX, to, t: 0, dur: clamp(dur * (0.6 + Math.min(1, Math.abs(to - viewX) / 3000)), 0.2, 1.4), done };
  }

  function onDown(e) {
    if (e.button != null && e.button > 0) return;
    anim = null; vel = 0;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, v0: viewX, moved: false, samples: [[performance.now(), e.clientX]] };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0;
    if (!drag.moved && Math.abs(dx) + Math.abs(e.clientY - drag.y0) > 9) drag.moved = true;
    if (!drag.moved) return;
    let x = drag.v0 - dx / scale;
    const m = maxView();
    if (x < 0) x *= 0.35; else if (x > m) x = m + (x - m) * 0.35;
    viewX = x;
    drag.samples.push([performance.now(), e.clientX]);
    if (drag.samples.length > 6) drag.samples.shift();
    if (!rafId && visible) render();
  }
  function onUp(e) {
    if (!drag || (e.pointerId != null && e.pointerId !== drag.id)) return;
    const d = drag;
    drag = null;
    if (!d.moved) { tapAt(e.clientX, e.clientY); return; }
    const now = performance.now();
    const old = d.samples.find(s => now - s[0] < 110) || d.samples[0];
    const dtS = Math.max(0.016, (now - old[0]) / 1000);
    vel = clamp(-(e.clientX - old[1]) / dtS / scale, -6000, 6000);
  }
  function onWheel(e) {
    e.preventDefault();
    anim = null;
    const mul = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? vw : 1;
    const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * mul;
    viewX = clamp(viewX + d / scale * 1.2, 0, maxView());
    vel = 0;
    if (!rafId) render();
  }
  function onKey(e) {
    if (!visible || !panelBack.hidden) { if (visible && e.key === 'Escape' && !panelBack.hidden) closePanel(); return; }
    if (e.key === 'ArrowRight') { scrollTo(viewX + vw / scale * 0.6, 0.4); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { scrollTo(viewX - vw / scale * 0.6, 0.4); e.preventDefault(); }
    else if (e.key === 'Enter') openPanel(clamp(save().maxLevel || 1, 1, LEVELS));
  }
  function tapAt(cx, cy) {
    const r = canvas.getBoundingClientRect();
    const px = cx - r.left, py = cy - r.top;
    let best = null, bd = 1e9;
    for (let n = 1; n <= LEVELS; n++) {
      const nd = nodes[n];
      const sx = (nd.x - viewX) * scale, sy = nd.y * scale;
      const R = Math.max((nd.boss ? 50 : 26) * uiS + 8, 24);
      const d = Math.hypot(sx - px, sy - py);
      if (d < R && d < bd) { bd = d; best = n; }
    }
    if (!best) return;
    const st = levelState(save(), best);
    if (st.locked) {
      sfx('deny');
      shakeNode = best; shakeT = 1;
      toast('Supera el nivel ' + (st.max) + ' para llegar aquí', { type: 'bad', icon: 'lock' });
      return;
    }
    sfx('click');
    openPanel(best);
  }

  function burst(n, colors, count) {
    const nd = nodeOf(n);
    for (let i = 0; i < (count || 22); i++) {
      const a = Math.random() * TAU, sp = 80 + Math.random() * 220;
      parts.push({ x: nd.x, y: nd.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 140, r: 3 + Math.random() * 4, c: colors[i % colors.length], life: 0.7 + Math.random() * 0.5, max: 1.2 });
    }
  }

  // ---------------------------------------------------------------- HUD (barra, puntos de zona, botón "ir")
  let hudAcc = 0;
  function updateHud(force) {
    hudAcc += 1;
    if (!force && hudAcc % 6) return;
    const s = save();
    const z = clamp(Math.floor((viewX + vw / scale / 2) / ZW), 0, NZ - 1);
    if (z !== curZone || force) {
      curZone = z;
      const Z = zones()[z] || {};
      if (titleEl) titleEl.textContent = Z.name || '';
      const max = clamp(s.maxLevel || 1, 1, LEVELS);
      Array.prototype.forEach.call(dotsEl.children, (d, i) => {
        d.classList.toggle('is-on', i === z);
        d.classList.toggle('is-locked', i * 10 + 1 > max);
        d.classList.toggle('is-done', i * 10 + 10 < max || !!(s.levels && s.levels[i * 10 + 10] && s.levels[i * 10 + 10].stars));
      });
    }
    // botón para volver al nivel actual cuando no se ve
    const max = clamp(s.maxLevel || 1, 1, LEVELS);
    const sx = (nodeOf(max).x - viewX) * scale;
    const off = sx < -20 ? 'left' : sx > vw + 20 ? 'right' : '';
    gotoBtn.hidden = !off;
    if (off) {
      gotoBtn.className = 'bbm-goto is-' + off;
      const txt = (off === 'left' ? '◀ ' : '') + 'Nivel ' + max + (off === 'right' ? ' ▶' : '');
      if (gotoBtn.textContent !== txt) gotoBtn.textContent = txt;
    }
    if (force || hudAcc % 30 === 0) refreshCurrencies();
  }
  function refreshCurrencies() {
    const s = save();
    if (BB.ui && BB.ui.refreshTop) { try { BB.ui.refreshTop(); } catch (err) { /* nada */ } }
    if (ownCurs) {
      ownCurs.gold.textContent = fmt(s.gold || 0);
      ownCurs.gems.textContent = fmt(s.gems || 0);
    }
    let stars = 0;
    for (const k in s.levels || {}) stars += (s.levels[k] && s.levels[k].stars) || 0;
    if (starsEl) starsEl.textContent = fmt(stars) + ' / 300';
  }

  // ---------------------------------------------------------------- panel del nivel
  function thumb(key, cls) {
    if (BB.ui && BB.ui.sprite) { try { return BB.ui.sprite(key, cls); } catch (err) { /* sigue */ } }
    const img = asset(key);
    if (img && img.src) return el('img', { class: 'spr' + (cls ? ' ' + cls : ''), src: img.src, alt: '' });
    return el('div', { class: 'bbm-ph', html: SVG.skull });
  }
  function armyLevel(s) {
    let slots = 3;
    try { if (BB.castleStats) slots = BB.castleStats(s).slots || 3; } catch (err) { /* nada */ }
    const ids = (s.lineup || []).slice(0, slots).filter(id => id && s.heroes && s.heroes[id] && s.heroes[id].owned);
    if (!ids.length) return { avg: 0, count: 0 };
    let t = 0;
    for (const id of ids) t += s.heroes[id].level || 1;
    return { avg: Math.round(t / ids.length), count: ids.length };
  }
  const KIND_TAG = { jefe: ['¡Jefe!', 'is-boss'], nuevo: ['¡Enemigo nuevo!', 'is-new'], descanso: ['Nivel tranquilo', 'is-rest'], reto: ['Desafío', 'is-hard'], normal: null };

  function openPanel(n) {
    n = clamp(n | 0, 1, LEVELS);
    const s = save();
    const st = levelState(s, n);
    if (st.locked) return;
    let def;
    try { def = BB.levelDef(n); } catch (err) { console.error('[mapa] levelDef', err); return; }
    const Z = (BB.levels && BB.levels.zoneOf ? BB.levels.zoneOf(n) : zones()[Math.floor((n - 1) / 10)]) || {};
    const pv = BB.rewards && BB.rewards.preview ? BB.rewards.preview(n, s) : { cleared: st.cleared, gold: def.rewards.gold, replayGold: Math.round(def.rewards.gold * 0.6), firstGems: st.cleared ? 0 : def.rewards.firstGems, starGemsLeft: 0 };
    const replay = st.cleared;
    const boss = !!def.boss;
    const panel = el('div', { class: 'bb-panel bbm-panel' + (boss ? ' is-boss' : ''), role: 'dialog', 'aria-label': 'Nivel ' + n });
    panel.appendChild(el('div', { class: 'panel-head' }, [el('div', { class: 'ribbon ' + (boss ? '' : 'rb-gold'), text: 'Nivel ' + n })]));
    const x = button(null, closePanel, { kind: 'red', round: true, icon: 'close', cls: 'bbm-x', title: 'Cerrar', sound: 'close' });
    if (!x.querySelector('svg, img')) x.textContent = '✕';
    panel.appendChild(x);
    // columna izquierda
    const left = el('div', { class: 'bbm-col bbm-left' });
    const tag = KIND_TAG[def.kind];
    left.appendChild(el('div', { class: 'bbm-zone' }, [
      el('span', { class: 'bbm-zone-name', text: 'Zona ' + (def.zoneIndex + 1) + ' · ' + (Z.name || def.zoneName) }),
      tag ? el('span', { class: 'bbm-tag ' + tag[1], text: tag[0] }) : null,
    ]));
    const stars = el('div', { class: 'bbm-stars' });
    for (let i = 0; i < 3; i++) stars.appendChild(el('span', { class: 'bbm-star' + (i < st.stars ? ' is-on' : '') }, [icon('star')]));
    left.appendChild(stars);
    if (boss) {
      const bi = bossInfo(def.boss);
      left.appendChild(el('div', { class: 'bbm-boss' }, [
        el('div', { class: 'bbm-boss-art' }, [thumb('boss_' + def.boss)]),
        el('div', { class: 'bbm-boss-txt' }, [el('div', { class: 'bbm-boss-name', text: bi.name }), el('div', { class: 'bbm-boss-title', text: bi.title })]),
      ]));
    }
    left.appendChild(el('div', { class: 'bbm-sec', text: boss ? 'Escoltas' : 'Enemigos' }));
    const grid = el('div', { class: 'bbm-enemies' });
    for (const id of def.types) {
      const isNew = def.newEnemies.indexOf(id) >= 0;
      grid.appendChild(el('div', { class: 'bbm-enemy' + (isNew ? ' is-new' : ''), title: enemyName(id) }, [
        el('div', { class: 'bbm-enemy-art' }, [thumb('enemy_' + id)]),
        el('div', { class: 'bbm-enemy-name', text: enemyName(id) }),
        isNew ? el('span', { class: 'bbm-new', text: '¡Nuevo!' }) : null,
      ]));
    }
    left.appendChild(grid);
    // columna derecha
    const right = el('div', { class: 'bbm-col bbm-right' });
    const facts = el('div', { class: 'bbm-facts' }, [
      el('div', { class: 'bbm-fact' }, [el('b', { text: String(def.waves.length) }), boss ? ' oleadas (con jefe)' : ' oleadas']),
      el('div', { class: 'bbm-fact' }, [el('b', { text: String(def.total) }), ' enemigos']),
      def.elites ? el('div', { class: 'bbm-fact is-elite' }, [el('b', { text: String(def.elites) }), def.elites === 1 ? ' élite' : ' élites']) : null,
      el('div', { class: 'bbm-fact' }, ['≈ ', el('b', { text: String(Math.round(def.duration / 5) * 5) }), ' s']),
    ]);
    right.appendChild(facts);
    const army = armyLevel(s);
    const diff = army.avg - def.recommended;
    const cls = diff >= 0 ? 'is-good' : diff >= -3 ? 'is-warn' : 'is-bad';
    const powerKids = [
      el('div', { class: 'bbm-rec' }, ['Nivel recomendado: ', el('b', { text: 'Nv. ' + def.recommended })]),
      el('div', { class: 'bbm-mine ' + cls }, ['Tus héroes: ', el('b', { text: army.count ? 'Nv. ' + army.avg : '—' }),
        el('span', { class: 'bbm-verdict', text: diff >= 0 ? ' · ¡Preparado!' : diff >= -3 ? ' · Algo justo' : ' · Mejora tu ejército' })]),
    ];
    if (typeof BB.armyPower === 'function') {
      try {
        const p = BB.armyPower(s, n);
        const v = typeof p === 'number' ? p : p && (p.power || p.value);
        if (typeof v === 'number' && isFinite(v)) powerKids.push(el('div', { class: 'bbm-rec' }, ['Poder del ejército: ', el('b', { text: fmt(v) })]));
      } catch (err) { /* nada */ }
    }
    right.appendChild(el('div', { class: 'bbm-power' }, powerKids));
    const rew = el('div', { class: 'bbm-rewards' }, [el('div', { class: 'bbm-sec', text: 'Recompensas' })]);
    rew.appendChild(el('div', { class: 'bbm-rew' }, [icon('gold'), el('b', { text: fmt(replay ? pv.replayGold : pv.gold) }), el('span', { text: replay ? ' oro (repetición: 60 %)' : ' oro + lo que suelten los enemigos' })]));
    if (pv.firstGems) rew.appendChild(el('div', { class: 'bbm-rew' }, [icon('gem'), el('b', { text: String(pv.firstGems) }), el('span', { text: ' por la primera victoria' })]));
    if (pv.starGemsLeft) rew.appendChild(el('div', { class: 'bbm-rew' }, [icon('gem'), el('b', { text: '+' + pv.starGemsLeft }), el('span', { text: st.stars ? ' si consigues las 3 estrellas' : ' por las estrellas (sobre todo la 3.ª)' })]));
    right.appendChild(rew);
    const play = button(replay ? 'Repetir' : (boss ? '¡Al jefe!' : 'Jugar'), () => start(n, replay), { kind: replay ? 'blue' : (boss ? 'red' : 'green'), big: true, cls: 'bbm-play', icon: replay ? null : 'sword' });
    const acts = el('div', { class: 'bbm-panel-btns' }, [
      button('Ejército', () => { closePanel(true); if (BB.ui && BB.ui.show) BB.ui.show('army'); }, { kind: 'wood', small: true, icon: 'sword' }),
      play,
    ]);
    if (replay) acts.appendChild(el('div', { class: 'bbm-replay-note', text: 'Repetir da menos oro, ¡pero sirve para mejorar!' }));
    right.appendChild(acts);
    panel.appendChild(el('div', { class: 'bbm-panel-body' }, [left, right]));
    panelBack.innerHTML = '';
    panelBack.appendChild(panel);
    panelBack.hidden = false;
    sfx('open');
    panelBack.dataset.level = String(n);
  }
  function closePanel(silent) {
    if (!panelBack || panelBack.hidden) return;
    panelBack.hidden = true;
    panelBack.innerHTML = '';
    if (silent !== true) sfx('close');
  }
  function start(n, replay) {
    closePanel(true);
    if (BB.app && typeof BB.app.startLevel === 'function') BB.app.startLevel(n, { replay: !!replay });
    else toast('El juego aún no está listo');
  }

  // ---------------------------------------------------------------- mostrar / ocultar
  function takeSnapshot() {
    const s = save();
    const stars = {};
    for (const k in s.levels || {}) stars[k] = (s.levels[k] && s.levels[k].stars) || 0;
    return { max: s.maxLevel || 1, stars };
  }
  function show(params) {
    params = params || {};
    build();
    if (!root.parentNode) {
      const host = document.getElementById('ui') || document.body;
      host.appendChild(root);
    }
    visible = true;
    closePanel(true);
    layout();
    const s = save();
    const max = clamp(s.maxLevel || 1, 1, LEVELS);
    // novedades desde la última vez: estrellas nuevas y nivel desbloqueado
    let animFrom = null;
    if (snapshot) {
      for (const k in s.levels || {}) {
        const now = (s.levels[k] && s.levels[k].stars) || 0;
        if (now > (snapshot.stars[k] || 0)) { nodeFx[k] = { kind: 'stars', t: time }; burst(+k, ['#ffd23f', '#fff3a0', '#ffffff'], 18); }
      }
      if (max > snapshot.max) { animFrom = snapshot.max; nodeFx[max] = { kind: 'unlock', t: time + 0.6 }; }
    }
    const focus = params.focus || params.level || null;
    if (animFrom && !focus) {
      viewX = clamp(centerX(animFrom), 0, maxView());
      scrollTo(centerX(max), 0.9, () => { burst(max, ['#ffc83a', '#ffffff', '#8fe6ff'], 26); sfx('unlock'); });
    } else viewX = clamp(centerX(focus || max), 0, maxView());
    curZone = -1;
    updateHud(true);
    render();
    if (!rafId) { lastFrame = 0; rafId = requestAnimationFrame(frame); }
    if (params.open) openPanel(params.open);
  }
  function hide() {
    visible = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    drag = null; anim = null; vel = 0;
    closePanel(true);
    snapshot = takeSnapshot();
  }

  // API de la pantalla (también útil para pruebas)
  const screen = {
    id: 'map',
    music: 'mapa',
    get el() { return build(); },
    show, hide, tick,
    onEscape() { if (panelBack && !panelBack.hidden) closePanel(); else if (BB.app && BB.app.goMenu) BB.app.goMenu(); },
  };
  BB.mapScreen = {
    screen, show, hide, render, step, openPanel, closePanel, scrollTo,
    centerOn(n) { scrollTo(centerX(n), 0); render(); },
    get viewX() { return viewX; },
    get nodes() { return nodes; },
    nodeScreen(n) { const nd = nodeOf(n); return { x: (nd.x - viewX) * scale, y: nd.y * scale }; },
    tapAt,
    paintZone(g, zi) { if (!nodes.length) { buildLayout(); samplePath(); } paintZone(g, zi); },
  };

  // Registro (si BB.ui aún no existe, se reintenta sin romper la carga)
  let registered = false;
  function tryRegister() {
    if (registered) return true;
    if (!BB.ui || typeof BB.ui.register !== 'function') return false;
    try {
      BB.ui.register({ id: 'map', el: build(), show, hide, tick, music: 'mapa', onEscape: screen.onEscape });
      registered = true;
    } catch (err) { console.error('[mapa] register', err); }
    return registered;
  }
  if (!tryRegister()) {
    let tries = 0;
    const retry = () => { if (!tryRegister() && tries++ < 100) setTimeout(retry, 100); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', retry);
    else setTimeout(retry, 0);
  }
})();
