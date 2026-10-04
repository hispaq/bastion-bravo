/* Bastión Bravo · escenario y castillo dibujados (estilo dibujo animado, contorno de tinta).
   - buildBack(g, B, P, box): capas fijas del fondo (cielo, montañas, colinas con árboles, suelo).
   - drawSky(ctx, B, P, box, t): nubes que se desplazan (cada fotograma).
   - drawFront(ctx, B, P, box, t): hierba en primer plano que se mece con el viento.
   - castle(ctx, B, t) / wall(ctx, B, t): castillo vectorial en 5 etapas y muralla en 3. */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const TAU = Math.PI * 2;
  const INK = '#2a1c16';
  const W = () => BB.WORLD;

  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) {
    if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return a;
    const A = hexRgb(a), Bc = hexRgb(b);
    const c = A.map((v, i) => Math.round(v + (Bc[i] - v) * t));
    return '#' + ((1 << 24) + (c[0] << 16) + (c[1] << 8) + c[2]).toString(16).slice(1);
  }
  const darker = (h, k) => mix(h, '#10080a', k);
  const lighter = (h, k) => mix(h, '#ffffff', k);
  function ink(g, w) { g.lineWidth = w || 3; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
  function fillInk(g, color, w) { g.fillStyle = color; g.fill(); if (w !== 0) ink(g, w); }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  // ------------------------------------------------------------------ árboles y adornos
  function leafyTree(g, x, y, s, c) {
    g.beginPath(); g.moveTo(x - 6 * s, y); g.quadraticCurveTo(x - 4 * s, y - 30 * s, x - 7 * s, y - 52 * s); g.lineTo(x + 7 * s, y - 52 * s); g.quadraticCurveTo(x + 4 * s, y - 30 * s, x + 6 * s, y); g.closePath(); fillInk(g, c.trunk, 2.5);
    const blobs = [[0, -72, 30], [-24, -60, 22], [24, -60, 22], [-12, -88, 22], [14, -86, 20]];
    for (const [bx, by, r] of blobs) { g.beginPath(); g.arc(x + bx * s, y + by * s, r * s, 0, TAU); fillInk(g, c.leaf, 2.5); }
    for (const [bx, by, r] of blobs) { g.beginPath(); g.arc(x + bx * s, y + by * s, r * s - 1.5, 0, TAU); g.fillStyle = c.leaf; g.fill(); }
    for (const [bx, by, r] of blobs.slice(0, 4)) { g.beginPath(); g.arc(x + (bx - r * 0.3) * s, y + (by - r * 0.3) * s, r * 0.45 * s, 0, TAU); g.fillStyle = c.leafHi; g.fill(); }
    g.beginPath(); g.arc(x + 10 * s, y - 58 * s, 12 * s, 0, TAU); g.fillStyle = c.leafLo; g.fill();
  }
  function pine(g, x, y, s, c, snow) {
    g.fillStyle = c.trunk; g.fillRect(x - 4 * s, y - 16 * s, 8 * s, 16 * s);
    for (let i = 0; i < 3; i++) {
      const by = y - 12 * s - i * 22 * s, w = (34 - i * 8) * s;
      g.beginPath(); g.moveTo(x - w, by); g.lineTo(x, by - 38 * s); g.lineTo(x + w, by); g.closePath(); fillInk(g, i % 2 ? c.leaf : c.leafLo, 2.5);
      if (snow) { g.beginPath(); g.moveTo(x - w * 0.45, by - 21 * s); g.lineTo(x, by - 38 * s); g.lineTo(x + w * 0.45, by - 21 * s); g.quadraticCurveTo(x, by - 16 * s, x - w * 0.45, by - 21 * s); g.fillStyle = '#ffffff'; g.fill(); }
    }
  }
  function deadTree(g, x, y, s, color) {
    g.strokeStyle = INK; g.lineCap = 'round';
    const br = (x0, y0, a, len, w, d) => {
      const x1 = x0 + Math.sin(a) * len, y1 = y0 - Math.cos(a) * len;
      g.lineWidth = w + 3; g.strokeStyle = INK; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.lineWidth = w; g.strokeStyle = color; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      if (d > 0) { br(x1, y1, a - 0.55, len * 0.7, w * 0.65, d - 1); br(x1, y1, a + 0.45, len * 0.65, w * 0.6, d - 1); }
    };
    br(x, y, 0.05, 40 * s, 10 * s, 3);
  }
  function cactus(g, x, y, s, color) {
    rr(g, x - 7 * s, y - 58 * s, 14 * s, 58 * s, 7 * s); fillInk(g, color, 2.5);
    rr(g, x - 22 * s, y - 40 * s, 10 * s, 22 * s, 5 * s); fillInk(g, color, 2.5);
    rr(g, x - 22 * s, y - 24 * s, 18 * s, 8 * s, 4 * s); fillInk(g, color, 0);
    rr(g, x + 12 * s, y - 48 * s, 10 * s, 26 * s, 5 * s); fillInk(g, color, 2.5);
    rr(g, x + 4 * s, y - 28 * s, 16 * s, 8 * s, 4 * s); fillInk(g, color, 0);
    g.fillStyle = lighter(color, 0.3); g.fillRect(x - 3 * s, y - 52 * s, 3 * s, 46 * s);
  }
  function rock(g, x, y, s, color) {
    g.beginPath(); g.moveTo(x - 26 * s, y); g.lineTo(x - 20 * s, y - 18 * s); g.lineTo(x - 4 * s, y - 28 * s); g.lineTo(x + 16 * s, y - 22 * s); g.lineTo(x + 26 * s, y); g.closePath(); fillInk(g, color, 2.5);
    g.beginPath(); g.moveTo(x - 16 * s, y - 16 * s); g.lineTo(x - 4 * s, y - 24 * s); g.lineTo(x + 6 * s, y - 20 * s); g.lineTo(x - 6 * s, y - 12 * s); g.closePath(); g.fillStyle = lighter(color, 0.25); g.fill();
  }
  function column(g, x, y, s, color, broken) {
    const h = (broken ? 50 : 90) * s;
    g.beginPath(); g.rect(x - 10 * s, y - h, 20 * s, h); fillInk(g, color, 2.5);
    g.fillStyle = darker(color, 0.15); for (let i = -1; i <= 1; i++) g.fillRect(x + i * 6 * s - 1, y - h + 4, 2, h - 8);
    g.beginPath(); g.rect(x - 14 * s, y - h - 7 * s, 28 * s, 8 * s); fillInk(g, color, 2.5);
    if (broken) { g.beginPath(); g.moveTo(x - 10 * s, y - h); g.lineTo(x - 2 * s, y - h - 10 * s); g.lineTo(x + 4 * s, y - h - 4 * s); g.lineTo(x + 10 * s, y - h - 12 * s); g.lineTo(x + 10 * s, y - h); g.closePath(); fillInk(g, color, 2.5); }
  }
  function chimney(g, x, y, s, color) {
    g.beginPath(); g.rect(x - 12 * s, y - 110 * s, 24 * s, 110 * s); fillInk(g, color, 2.5);
    g.beginPath(); g.rect(x - 16 * s, y - 118 * s, 32 * s, 10 * s); fillInk(g, darker(color, 0.2), 2.5);
    g.fillStyle = 'rgba(255,140,40,0.5)'; g.fillRect(x - 6 * s, y - 60 * s, 12 * s, 14 * s);
  }

  // ------------------------------------------------------------------ fondo fijo
  function ridge(g, L, R, base, amp, freq, seed, color, outline) {
    g.beginPath(); g.moveTo(L, base + 300);
    for (let x = L; x <= R + 20; x += 20) {
      const y = base - amp * (0.55 + 0.45 * Math.sin(x * freq + seed)) * (0.7 + 0.3 * Math.sin(x * freq * 2.7 + seed * 3));
      g.lineTo(x, y);
    }
    g.lineTo(R + 20, base + 300); g.closePath();
    g.fillStyle = color; g.fill();
    if (outline) ink(g, outline);
  }
  function peaks(g, L, R, base, h, seed, color, snow) {
    const rng = BB.util.mulberry32(seed);
    for (let x = L - 100; x < R + 100;) {
      const w = 160 + rng() * 160, ph = h * (0.6 + rng() * 0.5);
      g.beginPath(); g.moveTo(x, base); g.lineTo(x + w * 0.5, base - ph); g.lineTo(x + w, base); g.closePath(); g.fillStyle = color; g.fill();
      g.beginPath(); g.moveTo(x + w * 0.5, base - ph); g.lineTo(x + w, base); g.lineTo(x + w * 0.62, base); g.closePath(); g.fillStyle = 'rgba(0,0,0,0.08)'; g.fill();
      if (snow) { g.beginPath(); g.moveTo(x + w * 0.5, base - ph); g.lineTo(x + w * 0.5 + ph * 0.22, base - ph * 0.72); g.lineTo(x + w * 0.52, base - ph * 0.78); g.lineTo(x + w * 0.44, base - ph * 0.7); g.lineTo(x + w * 0.5 - ph * 0.22, base - ph * 0.72); g.closePath(); g.fillStyle = '#f4fbff'; g.fill(); }
      x += w * (0.55 + rng() * 0.3);
    }
  }

  function buildBack(g, B, P, box) {
    const { L, T, R, Bt } = box;
    const GR = W().GROUND;
    const z = (B.zone && B.zone.id) || 'bosque';
    const kind = (B.zone && B.zone.decor) || 'grass';
    // cielo
    const sky = g.createLinearGradient(0, T, 0, GR);
    sky.addColorStop(0, P.sky); sky.addColorStop(1, P.skyLow || P.sky);
    g.fillStyle = sky; g.fillRect(L, T, R - L, GR - T + 20);
    // sol / luna
    const sunX = L + (R - L) * 0.22, sunY = T + 110;
    const night = z === 'ruinas' || z === 'oscuras';
    const gl = g.createRadialGradient(sunX, sunY, 10, sunX, sunY, 180);
    gl.addColorStop(0, night ? 'rgba(220,255,230,0.5)' : 'rgba(255,250,210,0.75)'); gl.addColorStop(1, 'rgba(255,250,210,0)');
    g.fillStyle = gl; g.fillRect(sunX - 200, sunY - 200, 400, 400);
    g.beginPath(); g.arc(sunX, sunY, 42, 0, TAU); g.fillStyle = night ? '#e9f7e6' : (z === 'volcan' || z === 'dragon' ? '#ffb15a' : '#fff6c4'); g.fill();
    // montañas lejanas
    const far = mix(P.skyLow || P.sky, P.groundDark, 0.28);
    const snowy = z === 'montanas' || z === 'hielo' || z === 'bosque';
    peaks(g, L, R, GR - 130, 220, BB.util.hashStr(z), far, snowy);
    // colinas medias
    const hillC = mix(P.groundTop, P.skyLow || P.sky, 0.38);
    ridge(g, L, R, GR - 95, 60, 0.0045, 1.3, hillC, 0);
    const c = {
      trunk: '#7a4b26', leaf: mix(P.groundTop, '#1f6b2a', 0.35), leafLo: mix(P.groundTop, '#164d22', 0.55),
      leafHi: lighter(P.groundTop, 0.35),
    };
    const rng = BB.util.mulberry32(BB.util.hashStr(z + 'trees'));
    // árboles medios (más pequeños y aclarados = lejanía)
    g.save(); g.globalAlpha = 0.9;
    for (let x = L - 40; x < R + 40; x += 70 + rng() * 90) {
      const y = GR - 70 - rng() * 30, s = 0.55 + rng() * 0.25;
      drawDecor(g, kind, x, y, s, c, P, rng, true);
    }
    g.restore();
    // colina cercana con contorno
    const nearC = mix(P.groundTop, '#2e6b22', 0.12);
    ridge(g, L, R, GR - 38, 26, 0.008, 4.1, nearC, 2.5);
    // árboles cercanos
    for (let x = L - 30; x < R + 30; x += 110 + rng() * 160) {
      if (x > W().WALL_X - 120) continue;  // no tapar el castillo
      drawDecor(g, kind, x, GR - 28 - rng() * 10, 0.85 + rng() * 0.3, c, P, rng, false);
    }
    if (P.fog) { g.fillStyle = P.fog; g.fillRect(L, T, R - L, GR - T); }
    // suelo: tierra con textura
    const gy = GR - 18;
    const grd = g.createLinearGradient(0, gy, 0, Bt);
    grd.addColorStop(0, P.ground); grd.addColorStop(0.5, mix(P.ground, P.groundDark, 0.35)); grd.addColorStop(1, P.groundDark);
    g.fillStyle = grd; g.fillRect(L, gy, R - L, Bt - gy);
    const r2 = BB.util.mulberry32(BB.util.hashStr(z + 'ground'));
    for (let i = 0; i < 160; i++) {
      const x = L + r2() * (R - L), y = gy + 30 + r2() * (Bt - gy - 30), s = 2 + r2() * 5;
      g.beginPath(); g.ellipse(x, y, s * 1.6, s, 0, 0, TAU); g.fillStyle = r2() < 0.5 ? darker(P.ground, 0.18) : lighter(P.ground, 0.12); g.fill();
    }
    for (let i = 0; i < 26; i++) { // grietas
      const x = L + r2() * (R - L), y = gy + 50 + r2() * (Bt - gy - 60);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10, y + 4); g.lineTo(x + 18, y + 1); g.lineWidth = 2; g.strokeStyle = darker(P.ground, 0.3); g.stroke();
    }
    // camino pisado
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(L, GR - 6, R - L, 22);
    // borde de hierba festoneado con contorno
    g.beginPath(); g.moveTo(L, gy + 14);
    for (let x = L; x <= R; x += 18) {
      g.quadraticCurveTo(x + 9, gy - 8 + Math.sin(x * 0.13) * 3, x + 18, gy + 4 + Math.sin(x * 0.07) * 4);
    }
    g.lineTo(R, gy - 30); g.lineTo(L, gy - 30); g.closePath();
    g.fillStyle = P.groundTop; g.fill();
    g.beginPath();
    for (let x = L; x <= R; x += 18) {
      if (x === L) g.moveTo(x, gy + 4 + Math.sin(x * 0.07) * 4);
      g.quadraticCurveTo(x + 9, gy + 16 + Math.sin(x * 0.13) * 3, x + 18, gy + 4 + Math.sin((x + 18) * 0.07) * 4);
    }
    g.lineWidth = 3; g.strokeStyle = darker(P.groundTop, 0.45); g.stroke();
    // marcas de los huecos de trampas
    g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 3; g.setLineDash([10, 8]);
    for (const sl of W().TRAP_SLOTS) { g.beginPath(); g.ellipse(sl.x, GR + 8, 44, 12, 0, 0, TAU); g.stroke(); }
    g.setLineDash([]);
  }

  function drawDecor(g, kind, x, y, s, c, P, rng, far) {
    switch (kind) {
      case 'reeds': if (rng() < 0.6) deadTree(g, x, y, s, '#5a4a36'); else leafyTree(g, x, y, s * 0.9, { trunk: '#4e3a26', leaf: '#5d7a3a', leafLo: '#3f5a28', leafHi: '#8aa65a' }); break;
      case 'rocks': if (rng() < 0.65) pine(g, x, y, s, c, false); else rock(g, x, y, s * 1.4, '#8a8f97'); break;
      case 'sand': if (rng() < 0.5) cactus(g, x, y, s, '#4f9a3c'); else rock(g, x, y, s * 1.6, '#c98f4a'); break;
      case 'lava': if (rng() < 0.6) deadTree(g, x, y, s, '#2e2220'); else rock(g, x, y, s * 1.5, '#4a3532'); break;
      case 'ash': deadTree(g, x, y, s, '#3a2550'); break;
      case 'snow': pine(g, x, y, s, { trunk: '#6b4a30', leaf: '#3f7a5a', leafLo: '#2e5f46' }, true); break;
      case 'bones': if (rng() < 0.5) column(g, x, y, s, '#b9b4a6', rng() < 0.6); else deadTree(g, x, y, s, '#4a4a3a'); break;
      case 'gears': if (rng() < 0.5) chimney(g, x, y, s, '#6b5a4f'); else rock(g, x, y, s * 1.3, '#5c5a58'); break;
      case 'embers': rock(g, x, y, s * 1.8, '#5a2e28'); break;
      default: if (rng() < 0.62) leafyTree(g, x, y, s, c); else pine(g, x, y, s, c, false);
    }
  }

  // ------------------------------------------------------------------ cielo animado
  const CLOUD = [[0, 0, 26], [26, -18, 24], [60, -16, 30], [92, -2, 24], [46, 6, 26], [18, 8, 20], [76, 8, 20]];
  function cloud(ctx, x, y, s, color) {
    // contorno: círculos algo mayores en color tinta; relleno: los mismos círculos encima
    ctx.fillStyle = 'rgba(42,28,22,0.32)';
    for (const [dx, dy, r] of CLOUD) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s + 2.5, 0, TAU); ctx.fill(); }
    ctx.fillStyle = color;
    for (const [dx, dy, r] of CLOUD) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(120,140,190,0.16)';
    ctx.beginPath(); ctx.ellipse(x + 46 * s, y + 18 * s, 56 * s, 9 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(x + 54 * s, y - 28 * s, 10 * s, 0, TAU); ctx.fill();
  }
  function drawSky(ctx, B, P, box, t) {
    const z = (B.zone && B.zone.id) || '';
    const col = z === 'volcan' || z === 'dragon' ? '#e9b0a0' : z === 'oscuras' || z === 'ruinas' ? '#b8a8cc' : '#ffffff';
    const span = box.R - box.L + 400;
    for (let i = 0; i < 6; i++) {
      const sp = 6 + i * 2.5;
      const x = box.L - 200 + ((i * 397 + t * sp) % span);
      const y = box.T + 60 + (i % 3) * 55 + (i * 37 % 20);
      cloud(ctx, x, y, 0.7 + (i % 3) * 0.25, col);
    }
  }

  // ------------------------------------------------------------------ hierba en primer plano
  function drawFront(ctx, B, P, box, t) {
    const GR = W().GROUND;
    const kind = (B.zone && B.zone.decor) || 'grass';
    if (kind === 'lava' || kind === 'ash' || kind === 'gears' || kind === 'embers') return;
    const c1 = darker(P.groundTop, 0.15), c2 = lighter(P.groundTop, 0.12);
    const snow = kind === 'snow';
    ctx.save();
    ctx.lineCap = 'round';
    const rng = BB.util.mulberry32(77);
    for (let i = 0; i < 70; i++) {
      const x = box.L + rng() * (box.R - box.L);
      const y = GR + 26 + rng() * Math.max(30, box.Bt - GR - 50);
      const h = 9 + rng() * 12, n = 3 + (rng() * 3 | 0);
      const sway = Math.sin(t * 1.8 + x * 0.02) * 0.25;
      for (let k = 0; k < n; k++) {
        const a = (k - (n - 1) / 2) * 0.32 + sway;
        const bx = x + k * 3;
        ctx.beginPath(); ctx.moveTo(bx, y); ctx.quadraticCurveTo(bx + Math.sin(a) * h * 0.4, y - h * 0.6, bx + Math.sin(a) * h, y - h * Math.cos(a));
        ctx.lineWidth = 4.5; ctx.strokeStyle = INK; ctx.stroke();
        ctx.lineWidth = 2.5; ctx.strokeStyle = snow ? '#e9f6ff' : (k % 2 ? c1 : c2); ctx.stroke();
      }
      if (!snow && rng() < 0.18) {
        ctx.beginPath(); ctx.arc(x + 4, y - h - 2, 3.2, 0, TAU);
        ctx.fillStyle = ['#ffffff', '#ffe066', '#ff8ad0'][(rng() * 3) | 0]; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ castillo
  const TIERS = [
    null,
    { mat: 'wood', wall: '#a5703c', wallD: '#7b4e26', roof: '#c9973a', roofD: '#9a6f22', banner: '#3a6fd0', trim: '#5c3a1a' },
    { mat: 'stone', wall: '#a7a49c', wallD: '#7d7a73', roof: '#c0473a', roofD: '#8f2f25', banner: '#3a6fd0', trim: '#6b6a64' },
    { mat: 'stone', wall: '#b9b4a8', wallD: '#8c877c', roof: '#3a6fd0', roofD: '#244c9a', banner: '#3a6fd0', trim: '#ffd34a' },
    { mat: 'stone', wall: '#cfc6b2', wallD: '#a39a86', roof: '#2f5fc4', roofD: '#1e3f8a', banner: '#e8463c', trim: '#ffd34a', gold: true },
    { mat: 'white', wall: '#eef0f2', wallD: '#c4c9d0', roof: '#f0b93a', roofD: '#c08a1a', banner: '#3a6fd0', trim: '#ffd34a', gold: true, crystal: true },
  ];

  function blocks(g, x, y, w, h, base, dark, mat) {
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.fillStyle = base; g.fillRect(x, y, w, h);
    if (mat === 'wood') {
      for (let px = x; px < x + w; px += 16) {
        g.fillStyle = ((px - x) / 16 | 0) % 2 ? dark : mix(base, dark, 0.35); g.fillRect(px, y, 16, h);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px, y, 2, h);
        g.beginPath(); g.ellipse(px + 8, y + ((px * 7) % h), 3, 2, 0, 0, TAU); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fill();
      }
    } else {
      const bh = 18;
      for (let r = 0, yy = y; yy < y + h; r++, yy += bh) {
        const off = r % 2 ? 0 : 20;
        for (let xx = x - off; xx < x + w; xx += 40) {
          rr(g, xx + 1.5, yy + 1.5, 37, bh - 3, 4);
          g.fillStyle = ((r * 3 + xx / 40) | 0) % 3 === 0 ? mix(base, dark, 0.3) : base; g.fill();
          g.lineWidth = 1.6; g.strokeStyle = dark; g.stroke();
          g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(xx + 4, yy + 3, 30, 2.5);
        }
      }
    }
    g.restore();
    g.beginPath(); g.rect(x, y, w, h); ink(g, 3);
  }
  function battlements(g, x, y, w, base, dark, mat) {
    const n = Math.max(2, Math.round(w / 26));
    const cw = w / n;
    for (let i = 0; i < n; i++) {
      if (mat === 'wood') {
        g.beginPath(); g.moveTo(x + i * cw + 2, y); g.lineTo(x + i * cw + 2, y - 14); g.lineTo(x + i * cw + cw / 2, y - 24); g.lineTo(x + i * cw + cw - 2, y - 14); g.lineTo(x + i * cw + cw - 2, y); g.closePath(); fillInk(g, i % 2 ? base : dark, 2.5);
      } else if (i % 2 === 0) {
        rr(g, x + i * cw, y - 18, cw, 20, 3); fillInk(g, base, 2.5);
        g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(x + i * cw + 3, y - 15, cw - 6, 3);
      }
    }
    g.beginPath(); g.rect(x - 4, y - 2, w + 8, 10); fillInk(g, dark, 2.5);
  }
  function coneRoof(g, x, y, w, h, base, dark) {
    g.beginPath(); g.moveTo(x - w / 2 - 6, y); g.lineTo(x, y - h); g.lineTo(x + w / 2 + 6, y); g.closePath(); fillInk(g, base, 3);
    g.save(); g.beginPath(); g.moveTo(x - w / 2 - 6, y); g.lineTo(x, y - h); g.lineTo(x + w / 2 + 6, y); g.closePath(); g.clip();
    g.fillStyle = dark; g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + w / 2 + 6, y); g.lineTo(x + w * 0.12, y); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 2;
    for (let k = 1; k < 5; k++) { const yy = y - h + h * k / 5; g.beginPath(); g.moveTo(x - w, yy); g.lineTo(x + w, yy); g.stroke(); }
    g.restore();
  }
  function flag(g, x, y, color, t, ph, big) {
    const s = big ? 1.4 : 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 46 * s); g.lineWidth = 5; g.strokeStyle = INK; g.stroke(); g.lineWidth = 2.5; g.strokeStyle = '#8a6a44'; g.stroke();
    const w1 = Math.sin(t * 5 + ph) * 4, w2 = Math.sin(t * 5 + ph + 1.4) * 5;
    g.beginPath(); g.moveTo(x, y - 46 * s);
    g.quadraticCurveTo(x + 14 * s, y - 50 * s + w1, x + 30 * s, y - 44 * s + w2);
    g.lineTo(x + 24 * s, y - 36 * s + w2 * 0.6);
    g.lineTo(x + 30 * s, y - 28 * s + w2);
    g.quadraticCurveTo(x + 14 * s, y - 32 * s + w1, x, y - 28 * s);
    g.closePath(); fillInk(g, color, 2.5);
  }
  function windowArch(g, x, y, w, h, lit) {
    g.beginPath(); g.moveTo(x - w / 2, y + h); g.lineTo(x - w / 2, y + w / 2); g.arc(x, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w / 2, y + h); g.closePath();
    fillInk(g, lit ? '#ffcf6a' : '#2a1c16', 2.5);
    if (lit) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x - w / 2 + 2, y + w / 2, 3, h - w / 2 - 2); }
  }
  function torch(g, x, y, t) {
    g.fillStyle = '#5c3a1a'; g.fillRect(x - 2, y, 4, 14);
    const f = Math.sin(t * 13) * 2 + Math.sin(t * 7.3) * 1.5;
    const gr = g.createRadialGradient(x, y - 6, 1, x, y - 6, 26);
    gr.addColorStop(0, 'rgba(255,200,90,0.55)'); gr.addColorStop(1, 'rgba(255,200,90,0)');
    g.fillStyle = gr; g.fillRect(x - 26, y - 32, 52, 52);
    g.beginPath(); g.moveTo(x - 5, y); g.quadraticCurveTo(x - 7, y - 10, x + f * 0.5, y - 18 - f); g.quadraticCurveTo(x + 7, y - 10, x + 5, y); g.closePath(); g.fillStyle = '#ff8a2a'; g.fill();
    g.beginPath(); g.moveTo(x - 2.5, y); g.quadraticCurveTo(x - 3, y - 6, x, y - 11 - f * 0.5); g.quadraticCurveTo(x + 3, y - 6, x + 2.5, y); g.closePath(); g.fillStyle = '#fff2a0'; g.fill();
  }

  function castle(ctx, B, t) {
    const tier = Math.max(1, Math.min(5, (B.castle && B.castle.tier) || 1));
    const S = TIERS[tier];
    const GR = W().GROUND, base = GR + 26;
    const keepX = 1440, keepW = 200, keepTop = 140;
    const frontX = 1292, frontW = 150, frontTop = 172;
    const hit = B.castle && B.castle.hitT > 0 ? B.castle.hitT / 0.18 : 0;
    ctx.save();
    if (hit) ctx.translate((Math.random() - 0.5) * 4 * hit, 0);
    // torreón principal (detrás)
    blocks(ctx, keepX, keepTop, keepW, base - keepTop, S.wall, S.wallD, S.mat);
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(keepX + keepW - 50, keepTop, 50, base - keepTop);
    battlements(ctx, keepX - 6, keepTop, keepW + 12, S.wall, S.wallD, S.mat);
    // galería de madera a media altura (para tropas)
    const galY = 318;
    ctx.beginPath(); ctx.rect(keepX - 18, galY, keepW + 30, 12); fillInk(ctx, '#8a5a30', 3);
    for (let px = keepX - 14; px < keepX + keepW + 10; px += 18) { ctx.beginPath(); ctx.moveTo(px, galY + 12); ctx.lineTo(px + 8, galY + 30); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = '#6b4423'; ctx.stroke(); }
    ctx.beginPath(); ctx.rect(keepX - 18, galY - 22, keepW + 30, 4); fillInk(ctx, '#8a5a30', 2);
    for (let px = keepX - 16; px < keepX + keepW + 14; px += 26) { ctx.beginPath(); ctx.rect(px, galY - 22, 4, 22); fillInk(ctx, '#8a5a30', 1.5); }
    windowArch(ctx, keepX + 60, 200, 22, 40, true);
    windowArch(ctx, keepX + 130, 200, 22, 40, tier >= 2);
    windowArch(ctx, keepX + 95, 380, 24, 44, true);
    if (tier >= 3) coneRoof(ctx, keepX + keepW - 30, keepTop - 20, 50, 70, S.roof, S.roofD);
    // torre delantera (detrás de los balcones de los héroes)
    blocks(ctx, frontX, frontTop, frontW, base - frontTop, mix(S.wall, '#ffffff', 0.06), S.wallD, S.mat);
    ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(frontX + frontW - 30, frontTop, 30, base - frontTop);
    if (S.mat === 'wood') battlements(ctx, frontX - 4, frontTop, frontW + 8, S.wall, S.wallD, 'wood');
    else coneRoof(ctx, frontX + frontW / 2, frontTop, frontW, tier >= 4 ? 130 : 105, S.roof, S.roofD);
    if (S.gold) { ctx.beginPath(); ctx.rect(frontX - 8, frontTop - 6, frontW + 16, 9); fillInk(ctx, S.trim, 2.5); }
    // puerta
    const gx = frontX + frontW / 2, gw = 58;
    ctx.beginPath(); ctx.moveTo(gx - gw / 2, base); ctx.lineTo(gx - gw / 2, base - 62); ctx.arc(gx, base - 62, gw / 2, Math.PI, 0); ctx.lineTo(gx + gw / 2, base); ctx.closePath(); fillInk(ctx, '#5a3a1e', 3);
    ctx.save(); ctx.clip();
    for (let k = -2; k <= 2; k++) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(gx + k * 12 - 1, base - 100, 2, 100); }
    ctx.fillStyle = '#3c3f46'; ctx.fillRect(gx - gw / 2, base - 52, gw, 5); ctx.fillRect(gx - gw / 2, base - 24, gw, 5);
    ctx.restore();
    torch(ctx, gx - gw / 2 - 12, base - 74, t); torch(ctx, gx + gw / 2 + 12, base - 74, t + 1.3);
    // banderas y estandartes
    flag(ctx, frontX + frontW / 2, S.mat === 'wood' ? frontTop - 20 : frontTop - (tier >= 4 ? 128 : 103), S.banner, t, 0, tier >= 4);
    flag(ctx, keepX + 20, keepTop - 18, S.banner, t, 1.7);
    if (tier >= 3) flag(ctx, keepX + keepW - 30, keepTop - 88, S.banner, t, 2.6);
    // estandarte colgante del torreón
    const bx = keepX + 95, by = 230;
    const wv = Math.sin(t * 2.5) * 2;
    ctx.beginPath(); ctx.moveTo(bx - 22, by); ctx.lineTo(bx + 22, by); ctx.lineTo(bx + 22 + wv, by + 64); ctx.lineTo(bx + wv, by + 52); ctx.lineTo(bx - 22 + wv, by + 64); ctx.closePath(); fillInk(ctx, S.banner, 3);
    ctx.beginPath(); ctx.arc(bx + wv * 0.5, by + 24, 9, 0, TAU); fillInk(ctx, '#ffd34a', 2);
    if (S.crystal) {
      const cy = frontTop - 150 + Math.sin(t * 2) * 5;
      const gr = ctx.createRadialGradient(gx, cy, 2, gx, cy, 50);
      gr.addColorStop(0, 'rgba(140,220,255,0.75)'); gr.addColorStop(1, 'rgba(140,220,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(gx - 50, cy - 50, 100, 100);
      ctx.beginPath(); ctx.moveTo(gx, cy - 22); ctx.lineTo(gx + 11, cy); ctx.lineTo(gx, cy + 22); ctx.lineTo(gx - 11, cy); ctx.closePath(); fillInk(ctx, '#8fe0ff', 2.5);
      ctx.beginPath(); ctx.moveTo(gx, cy - 22); ctx.lineTo(gx + 4, cy); ctx.lineTo(gx, cy + 22); ctx.closePath(); ctx.fillStyle = '#e8fbff'; ctx.fill();
    }
    // daño: grietas y fuego
    const frac = B.castle ? B.castle.hp / B.castle.maxHp : 1;
    if (frac < 0.66) {
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(30,18,14,0.8)';
      ctx.beginPath(); ctx.moveTo(keepX + 40, 260); ctx.lineTo(keepX + 52, 290); ctx.lineTo(keepX + 44, 312); ctx.stroke();
      if (frac < 0.33) { ctx.beginPath(); ctx.moveTo(frontX + 30, 420); ctx.lineTo(frontX + 22, 450); ctx.lineTo(frontX + 34, 480); ctx.stroke(); }
    }
    ctx.restore();
  }

  function wall(ctx, B, t) {
    const c = B.castle;
    const x = W().WALL_X, w = 56, base = W().GROUND + 22, top = 400;
    const frac = c.wallMax > 0 ? c.wallHp / c.wallMax : 0;
    const tier = c.wallTier || 1;
    if (c.wallHp <= 0) {
      for (let i = 0; i < 8; i++) {
        ctx.beginPath(); ctx.ellipse(x + 6 + i * 7, base - 6 - (i % 3) * 8, 15, 10, i, 0, TAU);
        fillInk(ctx, tier === 1 ? '#8a5a30' : '#9a978f', 2.5);
      }
      return;
    }
    const mat = tier === 1 ? 'wood' : 'stone';
    const baseC = tier === 1 ? '#a5703c' : tier === 2 ? '#aaa69e' : '#8f949e';
    const darkC = tier === 1 ? '#7b4e26' : tier === 2 ? '#7d7a73' : '#5f646e';
    const shakeX = c.wallHitT > 0 ? (Math.random() - 0.5) * 3 : 0;
    ctx.save(); ctx.translate(shakeX, 0);
    blocks(ctx, x, top, w, base - top, baseC, darkC, mat);
    battlements(ctx, x - 4, top, w + 8, baseC, darkC, mat);
    if (tier >= 3) {
      ctx.beginPath(); ctx.rect(x - 4, top + 40, w + 8, 9); fillInk(ctx, '#4a4f5a', 2.5);
      ctx.beginPath(); ctx.rect(x - 4, top + 100, w + 8, 9); fillInk(ctx, '#4a4f5a', 2.5);
      for (let k = 0; k < 3; k++) { const sy = top + 30 + k * 45; ctx.beginPath(); ctx.moveTo(x, sy - 6); ctx.lineTo(x - 18, sy); ctx.lineTo(x, sy + 6); ctx.closePath(); fillInk(ctx, '#dfe6ee', 2); }
    }
    if (frac < 0.66) {
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(30,18,14,0.85)';
      ctx.beginPath(); ctx.moveTo(x + 12, top + 18); ctx.lineTo(x + 24, top + 46); ctx.lineTo(x + 15, top + 70); ctx.stroke();
      if (frac < 0.33) { ctx.beginPath(); ctx.moveTo(x + 42, base - 30); ctx.lineTo(x + 30, base - 66); ctx.lineTo(x + 40, base - 96); ctx.stroke(); }
    }
    if (c.wallHitT > 0) { ctx.globalAlpha = c.wallHitT / 0.15 * 0.4; ctx.fillStyle = '#fff'; ctx.fillRect(x - 4, top - 24, w + 8, base - top + 24); }
    ctx.restore();
  }

  // Imagen del castillo para la interfaz (menú, tienda, ejército)
  const castleImgs = {};
  function castleImage(tier) {
    if (castleImgs[tier]) return castleImgs[tier];
    const c = document.createElement('canvas');
    c.width = 400; c.height = 560;
    const g = c.getContext('2d');
    g.translate(-1255, -40);
    castle(g, { castle: { tier, hp: 1, maxHp: 1, hitT: 0 } }, 0.6);
    c.naturalWidth = c.width; c.naturalHeight = c.height;
    castleImgs[tier] = c;
    return c;
  }

  BB.scenery = { buildBack, drawSky, drawFront, castle, wall, mix, castleImage };
})();
