/* Bastión Bravo · renderizador de la batalla (Canvas 2D)
   Dibuja el mundo fijo de 1600×720 escalado a la pantalla, con animación por código de los sprites. */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const W = BB.WORLD;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);

  let canvas = null, ctx = null, dpr = 1;
  const cam = { s: 1, ox: 0, oy: 0, vw: 1, vh: 1, left: 0, top: 0, bottom: 720 };
  let staticLayer = null, staticKey = '';
  let time = 0;

  const DEFAULT_PAL = { sky: '#8fd3ff', skyLow: '#d9f2ff', groundTop: '#6fbf3a', ground: '#8a6a44', groundDark: '#5a3f24', accent: '#ffd23f', fog: 'rgba(255,255,255,0.08)' };

  function pal(B) { return Object.assign({}, DEFAULT_PAL, (B && B.zone && B.zone.palette) || {}); }

  // ------------------------------------------------------------------ cámara
  function computeCamera() {
    const vw = Math.max(1, canvas.clientWidth), vh = Math.max(1, canvas.clientHeight);
    const s = Math.min(vw / W.W, vh / W.H);
    const extraY = vh - W.H * s;
    cam.s = s; cam.vw = vw; cam.vh = vh;
    cam.ox = vw - W.W * s;
    cam.oy = extraY * 0.62;
    cam.left = -cam.ox / s;
    cam.top = -cam.oy / s;
    cam.bottom = (vh - cam.oy) / s;
  }
  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    computeCamera();
    staticKey = '';
  }

  // ------------------------------------------------------------------ sprites
  function smoothstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function spriteFacing(key) { const m = BB.assets.meta(key); return (m && m.facing) || null; }
  // Dibuja un sprite anclado por los pies (abajo-centro) con alto h. want: 'left'|'right'
  function drawSprite(key, x, y, h, o) {
    const img = BB.assets.get(key);
    if (!img) return false;
    o = o || {};
    const sc = h / img.naturalHeight;
    const w = img.naturalWidth * sc;
    const facing = spriteFacing(key);
    const flip = o.want && facing && facing !== o.want ? -1 : 1;
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(flip * (o.sx || 1), o.sy || 1);
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    ctx.drawImage(img, -w / 2, -h, w, h);
    if (o.flash > 0) {
      const sil = BB.assets.silhouette(key);
      if (sil) { ctx.globalAlpha = (o.alpha != null ? o.alpha : 1) * Math.min(1, o.flash) * 0.55; ctx.drawImage(sil, -w / 2, -h, w, h); }
    }
    if (o.tint) {
      const sil = BB.assets.silhouette(key);
      if (sil) {
        ctx.globalAlpha = o.tintAlpha || 0.35;
        ctx.globalCompositeOperation = 'source-atop';
        ctx.drawImage(sil, -w / 2, -h, w, h);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.restore();
    return true;
  }
  function spriteWidth(key, h) {
    const img = BB.assets.get(key);
    return img ? img.naturalWidth * h / img.naturalHeight : h * 0.8;
  }

  // Personaje de reserva (si aún no hay sprite)
  function hashColor(str, sat, light) {
    let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
    return 'hsl(' + h + ',' + (sat || 55) + '%,' + (light || 45) + '%)';
  }
  function drawFallbackUnit(x, y, h, o) {
    o = o || {};
    const face = o.face || 1;
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(o.sx || 1, o.sy || 1);
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    const bodyC = o.color || '#6fae3d';
    const w = h * 0.55;
    ctx.lineWidth = Math.max(2, h * 0.035); ctx.strokeStyle = '#1e1527';
    ctx.fillStyle = 'rgba(0,0,0,0.0)';
    // piernas
    ctx.fillStyle = '#5b4532';
    ctx.fillRect(-w * 0.28, -h * 0.25, w * 0.18, h * 0.25); ctx.fillRect(w * 0.1, -h * 0.25, w * 0.18, h * 0.25);
    // cuerpo
    ctx.fillStyle = o.cloth || '#8a6239';
    ctx.beginPath(); ctx.ellipse(0, -h * 0.42, w * 0.48, h * 0.24, 0, 0, TAU); ctx.fill(); ctx.stroke();
    // cabeza
    ctx.fillStyle = bodyC;
    ctx.beginPath(); ctx.arc(face * w * 0.06, -h * 0.76, h * 0.2, 0, TAU); ctx.fill(); ctx.stroke();
    // ojos
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(face * h * 0.1, -h * 0.79, h * 0.045, 0, TAU); ctx.arc(face * h * 0.18, -h * 0.79, h * 0.04, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1e1527';
    ctx.beginPath(); ctx.arc(face * h * 0.11, -h * 0.79, h * 0.02, 0, TAU); ctx.arc(face * h * 0.19, -h * 0.79, h * 0.018, 0, TAU); ctx.fill();
    if (o.flash > 0) { ctx.globalAlpha = Math.min(1, o.flash) * 0.8; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, -h * 0.5, w * 0.55, h * 0.5, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  // ------------------------------------------------------------------ capa estática
  function buildStatic(B) {
    const key = (B.zone ? B.zone.id : 'none') + '|' + canvas.width + 'x' + canvas.height + '|' + (BB.assets.get(B.zone ? B.zone.bg : '') ? 1 : 0);
    if (staticKey === key && staticLayer) return;
    staticKey = key;
    staticLayer = staticLayer || document.createElement('canvas');
    staticLayer.width = canvas.width; staticLayer.height = canvas.height;
    const g = staticLayer.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.translate(cam.ox, cam.oy);
    g.scale(cam.s, cam.s);
    const P = pal(B);
    const L = cam.left - 4, Tp = cam.top - 4, R = W.W + 4, Bt = cam.bottom + 4;
    if (BB.scenery) { BB.scenery.buildBack(g, B, P, { L, T: Tp, R, Bt }); return; }
    // cielo
    const sky = g.createLinearGradient(0, Tp, 0, W.GROUND);
    sky.addColorStop(0, P.sky); sky.addColorStop(1, P.skyLow || P.sky);
    g.fillStyle = sky; g.fillRect(L, Tp, R - L, W.GROUND - Tp + 10);
    // fondo de la zona (imagen IA) en modo "cubrir" sobre la parte alta
    const bg = B.zone ? BB.assets.get(B.zone.bg) : null;
    if (bg) {
      const areaW = R - L, areaH = W.GROUND + 40 - Tp;
      const sc = Math.max(areaW / bg.naturalWidth, areaH / bg.naturalHeight);
      const dw = bg.naturalWidth * sc, dh = bg.naturalHeight * sc;
      g.drawImage(bg, L + (areaW - dw) / 2, W.GROUND + 40 - dh, dw, dh);
    } else {
      // colinas procedurales
      const rng = BB.util.mulberry32(BB.util.hashStr(B.zone ? B.zone.id : 'x'));
      for (let layer = 0; layer < 3; layer++) {
        const baseY = W.GROUND - 140 + layer * 45;
        g.fillStyle = shade(P.groundTop, -0.25 - layer * 0.1 + 0.35, layer);
        g.globalAlpha = 0.55 + layer * 0.15;
        g.beginPath(); g.moveTo(L, W.GROUND);
        for (let x = L; x <= R; x += 40) g.lineTo(x, baseY - Math.sin(x * 0.004 + layer * 2 + rng() * 0.3) * (50 - layer * 12) - rng() * 10);
        g.lineTo(R, W.GROUND); g.closePath(); g.fill();
      }
      g.globalAlpha = 1;
    }
    // niebla ligera de ambiente
    if (P.fog) { g.fillStyle = P.fog; g.fillRect(L, Tp, R - L, W.GROUND - Tp); }
    // suelo
    const gy = W.GROUND - 22;
    const grd = g.createLinearGradient(0, gy, 0, Bt);
    grd.addColorStop(0, P.ground); grd.addColorStop(0.55, P.ground); grd.addColorStop(1, P.groundDark);
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(L, gy);
    for (let x = L; x <= R; x += 24) g.lineTo(x, gy + Math.sin(x * 0.05) * 3);
    g.lineTo(R, Bt); g.lineTo(L, Bt); g.closePath(); g.fill();
    // borde superior (hierba / arena / nieve)
    g.fillStyle = P.groundTop;
    g.beginPath(); g.moveTo(L, gy - 6);
    for (let x = L; x <= R; x += 14) g.lineTo(x, gy - 4 + Math.sin(x * 0.11) * 4 + Math.sin(x * 0.031) * 3);
    for (let x = R; x >= L; x -= 14) g.lineTo(x, gy + 10 + Math.sin(x * 0.07) * 3);
    g.closePath(); g.fill();
    // camino por donde andan
    g.fillStyle = 'rgba(255,255,255,0.07)';
    g.fillRect(L, W.GROUND - 10, R - L, 30);
    g.fillStyle = 'rgba(0,0,0,0.08)';
    g.fillRect(L, W.GROUND + 22, R - L, 6);
    decorate(g, B, P, L, R, Bt);
    // huecos del suelo para trampas (marcas)
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 3; g.setLineDash([10, 8]);
    for (const sl of W.TRAP_SLOTS) { g.beginPath(); g.ellipse(sl.x, W.GROUND + 8, 44, 12, 0, 0, TAU); g.stroke(); }
    g.setLineDash([]);
  }

  function shade(hex, amt) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const f = c => Math.max(0, Math.min(255, Math.round(c + (amt > 0 ? (255 - c) * amt : c * amt))));
    return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
  }

  function decorate(g, B, P, L, R, Bt) {
    const kind = (B.zone && B.zone.decor) || 'grass';
    const rng = BB.util.mulberry32(BB.util.hashStr((B.zone ? B.zone.id : 'z') + kind));
    const n = 70;
    for (let i = 0; i < n; i++) {
      const x = L + rng() * (R - L);
      const y = W.GROUND + 28 + rng() * Math.max(20, Bt - W.GROUND - 40);
      const s = 0.7 + rng() * 0.8;
      switch (kind) {
        case 'reeds':
          g.strokeStyle = shade(P.groundTop, -0.2); g.lineWidth = 2.5;
          for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x + k * 4, y); g.quadraticCurveTo(x + k * 6, y - 14 * s, x + k * 9, y - 26 * s); g.stroke(); }
          if (rng() < 0.3) { g.fillStyle = 'rgba(60,90,70,0.55)'; g.beginPath(); g.ellipse(x + 20, y + 4, 22 * s, 6 * s, 0, 0, TAU); g.fill(); }
          break;
        case 'rocks': case 'sand': case 'ash':
          g.fillStyle = kind === 'sand' ? shade(P.ground, 0.25) : kind === 'ash' ? '#4a4545' : '#8b8f97';
          g.beginPath(); g.ellipse(x, y, 9 * s, 6 * s, 0, 0, TAU); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(x - 3 * s, y - 2 * s, 4 * s, 2 * s, 0, 0, TAU); g.fill();
          if (kind === 'sand' && rng() < 0.15) { g.fillStyle = '#4f8a3a'; g.fillRect(x + 15, y - 22 * s, 6 * s, 22 * s); g.fillRect(x + 10, y - 14 * s, 5 * s, 4 * s); }
          break;
        case 'lava': case 'embers':
          if (rng() < 0.5) { g.strokeStyle = 'rgba(255,120,30,0.7)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 12 * s, y + 4); g.lineTo(x + 20 * s, y - 2); g.stroke(); }
          else { g.fillStyle = '#3a2a28'; g.beginPath(); g.ellipse(x, y, 8 * s, 5 * s, 0, 0, TAU); g.fill(); }
          break;
        case 'snow':
          g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.ellipse(x, y, 16 * s, 6 * s, 0, 0, TAU); g.fill();
          break;
        case 'bones':
          g.strokeStyle = '#e9e2cc'; g.lineWidth = 3 * s; g.lineCap = 'round';
          g.beginPath(); g.moveTo(x - 8 * s, y); g.lineTo(x + 8 * s, y - 3 * s); g.stroke();
          if (rng() < 0.2) { g.fillStyle = '#e9e2cc'; g.beginPath(); g.arc(x + 14, y - 4, 5 * s, 0, TAU); g.fill(); }
          break;
        case 'gears':
          g.strokeStyle = '#6b6f78'; g.lineWidth = 3;
          g.beginPath(); g.arc(x, y, 7 * s, 0, TAU); g.stroke();
          for (let k = 0; k < 6; k++) { const a = k * TAU / 6; g.beginPath(); g.moveTo(x + Math.cos(a) * 7 * s, y + Math.sin(a) * 7 * s); g.lineTo(x + Math.cos(a) * 10 * s, y + Math.sin(a) * 10 * s); g.stroke(); }
          break;
        default: // hierba y flores
          g.strokeStyle = shade(P.groundTop, -0.15); g.lineWidth = 2; g.lineCap = 'round';
          for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x + k * 3, y); g.lineTo(x + k * 5, y - (7 + rng() * 6) * s); g.stroke(); }
          if (rng() < 0.3) { g.fillStyle = ['#ffffff', '#ffe66b', '#ff9ad5'][(rng() * 3) | 0]; g.beginPath(); g.arc(x + 9, y - 3, 2.6, 0, TAU); g.fill(); }
      }
    }
  }

  // ------------------------------------------------------------------ castillo y muralla
  function drawCastle(B) {
    if (BB.scenery) { BB.scenery.castle(ctx, B, time); return; }
    const c = B.castle;
    const key = 'castle_' + Math.max(1, Math.min(5, c.tier || 1));
    const img = BB.assets.get(key);
    const baseY = W.GROUND + 26;
    const hitA = c.hitT > 0 ? c.hitT / 0.18 : 0;
    if (img) {
      const targetW = 340;
      let h = img.naturalHeight * targetW / img.naturalWidth;
      h = Math.min(h, 540);
      const w = img.naturalWidth * h / img.naturalHeight;
      const x = W.CASTLE_X - 20 + w / 2;
      drawSprite(key, Math.min(x, W.W - w / 2 + 40), baseY, h, { flash: hitA * 0.5 });
    } else drawFallbackCastle(c, baseY, hitA);
    // daño visible: humo y fuego
    const frac = c.hp / c.maxHp;
    if (!B.headless && frac < 0.5 && Math.random() < (frac < 0.25 ? 0.5 : 0.2)) {
      B.fx.particles(W.CASTLE_X + 60 + Math.random() * 180, W.GROUND - 160 - Math.random() * 180, { n: 1, kind: 'smoke', color: ['#4e4744', '#6a625e'], speed: 20, up: 60, gravity: -40, life: 1.4, size: 14, shrink: false });
      if (frac < 0.25) B.fx.particles(W.CASTLE_X + 60 + Math.random() * 180, W.GROUND - 120 - Math.random() * 160, { n: 1, kind: 'fire', color: ['#ffa02e', '#ff6a1c'], speed: 30, up: 50, gravity: -80, life: 0.5, size: 9, add: true });
    }
    if (c.shield > 0) {
      ctx.save();
      ctx.globalAlpha = 0.25 + Math.sin(time * 4) * 0.08;
      ctx.strokeStyle = '#8fd3ff'; ctx.lineWidth = 8;
      ctx.fillStyle = 'rgba(140,210,255,0.12)';
      ctx.beginPath(); ctx.ellipse(W.CASTLE_X + 130, W.GROUND - 200, 210, 280, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
  function drawFallbackCastle(c, baseY, hitA) {
    const x0 = W.CASTLE_X - 10, x1 = W.W + 20, top = baseY - 330;
    ctx.save();
    ctx.lineWidth = 4; ctx.strokeStyle = '#1e1527';
    ctx.fillStyle = '#9aa0a8';
    ctx.fillRect(x0, top + 90, x1 - x0, baseY - top - 90); ctx.strokeRect(x0, top + 90, x1 - x0, baseY - top - 90);
    for (const tx of [x0 + 10, x0 + 150]) {
      ctx.fillStyle = '#a9adb5'; ctx.fillRect(tx, top, 90, baseY - top); ctx.strokeRect(tx, top, 90, baseY - top);
      ctx.fillStyle = '#2f6fd6'; ctx.beginPath(); ctx.moveTo(tx - 10, top); ctx.lineTo(tx + 45, top - 70); ctx.lineTo(tx + 100, top); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#4a3020'; ctx.beginPath(); ctx.moveTo(x0 + 110, baseY); ctx.lineTo(x0 + 110, baseY - 80); ctx.arc(x0 + 140, baseY - 80, 30, Math.PI, 0); ctx.lineTo(x0 + 170, baseY); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (hitA > 0) { ctx.globalAlpha = hitA * 0.35; ctx.fillStyle = '#fff'; ctx.fillRect(x0, top - 70, x1 - x0, baseY - top + 70); }
    ctx.restore();
  }
  function drawTroop(B, u) {
    const iv = (u.attack && u.attack.interval) || 1.2;
    const prog = 1 - Math.max(0, Math.min(iv, u.atkTimer)) / iv;
    const key = (u.def && u.def.rig) || 'troop_' + u.id;
    const pose = { t: time + u.slot * 0.7, moving: false, windup: smoothstep(0.35, 1, prog), strike: u.atkAnim > 0 ? u.atkAnim / 0.22 : 0, seed: u.slot };
    if (!BB.rig || !BB.rig.draw(ctx, BB.rig.has(key) ? key : 'troop_arquero', u.x, u.y, (u.def && u.def.size) || 52, -1, pose)) {
      drawFallbackUnit(u.x, u.y, 46, { face: -1, color: '#f3c79e', cloth: '#3a6fd0' });
    }
  }
  function drawWall(B) {
    if (BB.scenery) { BB.scenery.wall(ctx, B, time); return; }
    const c = B.castle;
    const x = W.WALL_X, w = 52, base = W.GROUND + 16, h = 176;
    const frac = c.wallMax > 0 ? c.wallHp / c.wallMax : 0;
    ctx.save();
    ctx.lineWidth = 3; ctx.strokeStyle = '#1e1527';
    if (c.wallHp <= 0) {
      // escombros
      ctx.fillStyle = c.wallTier === 1 ? '#6f4723' : '#7d8088';
      for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(x + 8 + i * 7, base - 8 - (i % 3) * 7, 14, 9, i, 0, TAU); ctx.fill(); ctx.stroke(); }
      ctx.restore();
      return;
    }
    const hh = h * (0.55 + 0.45 * Math.min(1, frac * 1.4));
    if (c.wallTier <= 1) {
      // empalizada de troncos afilados
      for (let i = 0; i < 4; i++) {
        const lx = x + i * 13;
        const top = base - hh + (i % 2) * 10;
        ctx.fillStyle = i % 2 ? '#9a6a3b' : '#a8733f';
        ctx.beginPath(); ctx.moveTo(lx, base); ctx.lineTo(lx, top + 12); ctx.lineTo(lx + 6.5, top); ctx.lineTo(lx + 13, top + 12); ctx.lineTo(lx + 13, base); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = '#5c3a1a'; ctx.fillRect(x - 2, base - hh * 0.35, w + 4, 8); ctx.fillRect(x - 2, base - hh * 0.75, w + 4, 8);
    } else {
      const stone = c.wallTier === 2 ? '#a9adb5' : '#8f949e';
      ctx.fillStyle = stone;
      ctx.fillRect(x, base - hh, w, hh); ctx.strokeRect(x, base - hh, w, hh);
      // almenas
      for (let i = 0; i < 3; i++) { ctx.fillRect(x + i * 19 - 2, base - hh - 16, 14, 18); ctx.strokeRect(x + i * 19 - 2, base - hh - 16, 14, 18); }
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2;
      for (let r = 0; r < 8; r++) {
        const yy = base - r * 22;
        if (yy < base - hh) break;
        ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke();
        const off = r % 2 ? 13 : 0;
        for (let k = off; k < w; k += 26) { ctx.beginPath(); ctx.moveTo(x + k, yy); ctx.lineTo(x + k, yy - 22); ctx.stroke(); }
      }
      if (c.wallTier >= 3) {
        ctx.fillStyle = '#4a4f5a';
        ctx.fillRect(x - 3, base - hh * 0.4, w + 6, 10); ctx.fillRect(x - 3, base - hh * 0.8, w + 6, 10);
        ctx.fillStyle = '#d6dde7';
        for (let k = 0; k < 4; k++) { const sy = base - 20 - k * 38; ctx.beginPath(); ctx.moveTo(x, sy - 6); ctx.lineTo(x - 18, sy); ctx.lineTo(x, sy + 6); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      }
    }
    // grietas según el daño
    if (frac < 0.66) {
      ctx.strokeStyle = 'rgba(30,20,20,0.75)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x + 10, base - hh + 20); ctx.lineTo(x + 22, base - hh + 48); ctx.lineTo(x + 14, base - hh + 70); ctx.stroke();
      if (frac < 0.33) { ctx.beginPath(); ctx.moveTo(x + 40, base - 30); ctx.lineTo(x + 30, base - 62); ctx.lineTo(x + 38, base - 90); ctx.stroke(); }
    }
    if (c.wallHitT > 0) { ctx.globalAlpha = c.wallHitT / 0.15 * 0.45; ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, base - hh - 18, w + 4, hh + 18); }
    ctx.restore();
  }

  // ------------------------------------------------------------------ héroes y torres
  function drawBalconies(B) {
    const slots = Math.min(W.HERO_SLOTS.length, (B.castleStats && B.castleStats.slots) || 3);
    ctx.save();
    for (let i = 0; i < slots; i++) {
      const s = W.HERO_SLOTS[i];
      // ménsulas
      ctx.fillStyle = '#5c3a1a'; ctx.strokeStyle = '#1e1527'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(s.x - 30, s.y + 4); ctx.lineTo(s.x + 30, s.y + 4); ctx.lineTo(s.x + 24, s.y + 22); ctx.lineTo(s.x - 6, s.y + 10); ctx.closePath(); ctx.fill(); ctx.stroke();
      // tablón
      ctx.fillStyle = '#a8733f';
      ctx.fillRect(s.x - 36, s.y - 2, 72, 10); ctx.strokeRect(s.x - 36, s.y - 2, 72, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(s.x - 34, s.y - 1, 68, 3);
      if (!B.heroes.some(h => h.slot === i)) {
        ctx.globalAlpha = 0.35; ctx.strokeStyle = '#ffffff'; ctx.setLineDash([6, 6]);
        ctx.strokeRect(s.x - 20, s.y - 60, 40, 56); ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }
  function drawHero(B, h) {
    const size = h.def.size || 76;
    const breath = 1 + Math.sin(time * 2.2 + h.slot) * 0.015;
    const recoil = h.atkAnim > 0 ? (h.atkAnim / 0.22) * 7 : 0;
    const lift = h.castAnim > 0 ? Math.sin((1 - h.castAnim / 0.7) * Math.PI) * 12 : 0;
    const x = h.x + recoil, y = h.y - lift;
    if (h.castAnim > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y - size * 0.5, 4, x, y - size * 0.5, size * 0.9);
      g.addColorStop(0, 'rgba(255,240,150,' + (0.7 * h.castAnim / 0.7) + ')'); g.addColorStop(1, 'rgba(255,240,150,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - size * 0.5, size * 0.9, 0, TAU); ctx.fill();
      ctx.restore();
    }
    let ok = false;
    if (BB.rig && BB.rig.has('hero_' + h.id)) {
      const iv = (h.stats && h.stats.attack && h.stats.attack.interval) || 1;
      const prog = 1 - Math.max(0, Math.min(iv, h.atkTimer)) / iv;
      ok = BB.rig.draw(ctx, 'hero_' + h.id, h.x, y, size * 1.12 * BB.rig.norm('hero_' + h.id), -1, {
        t: time + h.slot, moving: false, windup: h.disabled > 0 ? 0 : smoothstep(0.35, 1, prog),
        strike: h.atkAnim > 0 ? h.atkAnim / 0.22 : 0, frozen: h.disabled > 0, seed: h.slot,
      });
    }
    if (!ok) ok = drawSprite('hero_' + h.id, x, y, size, { want: 'left', sx: breath, sy: 2 - breath, rot: h.atkAnim > 0 ? 0.05 * (h.atkAnim / 0.22) : 0 });
    if (!ok) drawFallbackUnit(x, y, size * 0.9, { face: -1, color: '#f3c79e', cloth: hashColor(h.id, 60, 45), sx: breath, sy: 2 - breath });
    if (h.disabled > 0) {
      ctx.save();
      ctx.globalAlpha = 0.55; ctx.fillStyle = '#bfeaff'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
      roundRect(x - 26, y - size - 4, 52, size + 6, 8); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    if (h.readyFlash > 0) {
      ctx.save(); ctx.globalAlpha = h.readyFlash / 0.6; ctx.strokeStyle = '#ffe66b'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y - size * 0.5, size * 0.55 * (1.4 - h.readyFlash / 0.6 * 0.4), 0, TAU); ctx.stroke(); ctx.restore();
    }
    // nivel
    ctx.save();
    if (B.isDemo) { ctx.restore(); return; }
    ctx.font = '12px "Lilita One", "Arial Black", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff6df'; ctx.strokeStyle = '#3b2a1e'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x + 20, y - 4, 9, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3b2a1e'; ctx.fillText(String(h.level), x + 20, y - 3);
    ctx.restore();
  }
  function drawTower(B, tw) {
    const def = tw.def;
    const size = def.size || (tw.kind === 'trap' ? 50 : 120);
    const key = def.sprite || ('tower_' + tw.id);
    if (tw.kind === 'block' && tw.broken) {
      ctx.save(); ctx.fillStyle = '#6f4723'; ctx.strokeStyle = '#1e1527'; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(tw.x - 26 + i * 13, W.GROUND + 4 - (i % 2) * 5, 13, 6, 0.3 * i, 0, TAU); ctx.fill(); ctx.stroke(); }
      ctx.restore();
      return;
    }
    const squash = tw.atkAnim > 0 ? 1 - (tw.atkAnim / 0.3) * 0.06 : 1;
    const flash = tw.hitT > 0 ? tw.hitT / 0.15 : 0;
    const rk = 'tower_' + tw.id;
    if (BB.rig && BB.rig.has(rk)) {
      const iv = (tw.stats && tw.stats.attack && tw.stats.attack.interval) || 1.5;
      const prog = 1 - Math.max(0, Math.min(iv, tw.atkTimer)) / iv;
      const low = tw.kind === 'trap';
      BB.rig.draw(ctx, rk, tw.x, W.GROUND + (low ? 12 : 10), low ? 100 * 0.95 : size * BB.rig.norm(rk), -1, {
        t: time + tw.slot, windup: tw.kind === 'tower' ? smoothstep(0.4, 1, prog) : 0, strike: tw.atkAnim > 0 ? tw.atkAnim / 0.3 : 0,
        flash, hit: flash, seed: tw.slot,
      });
      if (tw.kind === 'block' && tw.maxHp > 0 && tw.hp < tw.maxHp) hpBar(tw.x, W.GROUND - size - 8, 60, tw.hp / tw.maxHp, '#ffcf3d');
      return;
    }
    if (tw.kind === 'trap') {
      if (tw.id === 'brea' && !BB.assets.get(key)) {
        ctx.save(); ctx.fillStyle = '#1b1612'; ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(tw.x, W.GROUND + 8, 48, 13, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        for (let i = 0; i < 3; i++) { const bx = tw.x - 25 + ((time * 13 + i * 19) % 50); ctx.beginPath(); ctx.arc(bx, W.GROUND + 6, 3 + (i % 2) * 2, 0, TAU); ctx.fill(); }
        ctx.restore();
        return;
      }
      if (!drawSprite(key, tw.x, W.GROUND + 16, size, { flash })) {
        ctx.save(); ctx.fillStyle = '#6b4423'; ctx.fillRect(tw.x - 42, W.GROUND + 2, 84, 10);
        ctx.fillStyle = '#d6dde7'; ctx.strokeStyle = '#1e1527'; ctx.lineWidth = 2;
        for (let i = 0; i < 7; i++) { const sx = tw.x - 36 + i * 12; ctx.beginPath(); ctx.moveTo(sx - 5, W.GROUND + 4); ctx.lineTo(sx, W.GROUND - 16); ctx.lineTo(sx + 5, W.GROUND + 4); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        ctx.restore();
      }
      return;
    }
    if (!drawSprite(key, tw.x, W.GROUND + 14, size, { want: 'left', sy: squash, sx: 2 - squash, flash })) {
      ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = '#1e1527';
      if (tw.kind === 'block') {
        ctx.fillStyle = '#9a6a3b';
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(tw.x - 30 + i * 12, W.GROUND + 10); ctx.lineTo(tw.x - 38 + i * 12, W.GROUND - 60); ctx.lineTo(tw.x - 26 + i * 12, W.GROUND - 70); ctx.lineTo(tw.x - 20 + i * 12, W.GROUND + 10); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      } else {
        ctx.fillStyle = '#9aa0a8'; ctx.fillRect(tw.x - 26, W.GROUND - size * 0.8, 52, size * 0.8 + 10); ctx.strokeRect(tw.x - 26, W.GROUND - size * 0.8, 52, size * 0.8 + 10);
        ctx.fillStyle = hashColor(tw.id, 70, 55); ctx.beginPath(); ctx.arc(tw.x, W.GROUND - size * 0.85, 16, 0, TAU); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
    if (tw.kind === 'block' && tw.maxHp > 0 && tw.hp < tw.maxHp) hpBar(tw.x, W.GROUND - size - 8, 60, tw.hp / tw.maxHp, '#ffcf3d');
  }

  // ------------------------------------------------------------------ enemigos
  function drawEnemy(B, e) {
    const def = e.def;
    const size = (e.size || 70) * (e.scale || 1);
    const key = (e.boss ? 'boss_' : 'enemy_') + e.type;
    const sprite = def.sprite || key;
    const anim = def.anim || (e.air ? 'fly' : e.boss ? 'heavy' : 'walk');
    let x = e.x, y = e.y, rot = 0, sx = 1, sy = 1, alpha = 1;
    const walking = e.state === 'walk' && !e.status.freeze && !e.status.stun && !(e.status.root && !e.air);
    const spd = Math.max(20, e.speed);
    const ph = e.age * (spd / 11) + e.id;
    if (e.dead) {
      const k = Math.min(1, e.dying / 0.45);
      rot = -k * 1.35 * (e.air ? 0.4 : 1);
      alpha = e.dying > 0.55 ? Math.max(0, 1 - (e.dying - 0.55) / 0.5) : 1;
      if (e.air) y += k * k * (W.GROUND - e.y);
      y += k * 6;
      if (!e._deathFx) {
        e._deathFx = true;
        const bp = B.bodyPoint(e);
        B.fx.particles(bp.x, bp.y, { n: e.boss ? 30 : 10, kind: 'smoke', color: ['#efe9df', '#cfc8bd', '#b9b2a8'], speed: 90, up: 30, gravity: -20, life: 0.7, size: e.boss ? 26 : 12, shrink: false, drag: 2 });
        B.fx.particles(bp.x, bp.y, { n: e.boss ? 20 : 6, kind: 'star', color: ['#ffe66b', '#ffffff'], speed: 160, life: 0.5, size: 6, gravity: 200 });
      }
    } else if (anim === 'fly') {
      y += Math.sin(e.age * 3 + e.id) * 8;
      const flap = Math.sin(e.age * 14 + e.id);
      sy = 1 + flap * 0.05; sx = 1 - flap * 0.03;
      rot = Math.sin(e.age * 2 + e.id) * 0.06;
    } else if (walking) {
      if (anim === 'heavy') {
        const b = Math.abs(Math.sin(ph * 0.6));
        y -= b * size * 0.025; rot = Math.sin(ph * 0.6) * 0.04;
        sy = 1 - b * 0.03; sx = 1 + b * 0.02;
      } else if (anim === 'hop') {
        const b = Math.abs(Math.sin(ph * 0.9));
        y -= b * size * 0.14; sy = 1 + b * 0.06; sx = 1 - b * 0.04; rot = Math.sin(ph * 0.9) * 0.08;
      } else if (anim === 'roll') {
        y -= Math.abs(Math.sin(ph * 1.6)) * 3; rot = Math.sin(ph * 1.6) * 0.02;
      } else {
        const b = Math.abs(Math.sin(ph));
        y -= b * size * 0.06; rot = Math.sin(ph) * 0.07; sy = 1 - b * 0.04; sx = 1 + b * 0.03;
      }
    } else {
      // respiración en reposo
      const b = Math.sin(e.age * 3 + e.id);
      sy = 1 + b * 0.02; sx = 1 - b * 0.012;
    }
    if (!e.dead && e.atkAnim > 0) {
      const k = 1 - e.atkAnim / 0.35;
      const lunge = Math.sin(k * Math.PI);
      x += lunge * size * 0.14 * (e.range > 0 ? -0.4 : 1);
      rot += lunge * 0.18 * (e.range > 0 ? -0.5 : 1);
    }
    if (e.kbLeft > 0) rot -= 0.15;
    // enterrado: montículo de tierra
    if (e.burrowed && !e.dead) {
      ctx.save();
      ctx.fillStyle = '#6b4a2b'; ctx.strokeStyle = '#1e1527'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(x, W.GROUND + 4, 26, 12 + Math.abs(Math.sin(e.age * 9)) * 3, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
      ctx.restore();
      if (Math.random() < 0.25) B.fx.particles(x - 10, W.GROUND - 2, { n: 1, kind: 'debris', color: ['#6b4a2b', '#8a6a44'], speed: 80, up: 120, gravity: 600, life: 0.5, size: 3 });
      return;
    }
    // sombra
    if (!e.dead || e.dying < 0.6) {
      ctx.save();
      ctx.globalAlpha = 0.28 * alpha * (e.air ? 0.6 : 1);
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(e.x, W.GROUND + (e.air ? 10 : 4), size * (e.air ? 0.28 : 0.34), size * 0.08, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // auras
    if (!e.dead) {
      if (e.boss) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const bp = { x: e.x, y: e.air ? y : y - size * 0.45 };
        const g = ctx.createRadialGradient(bp.x, bp.y, size * 0.1, bp.x, bp.y, size * 0.75);
        const col = e.def.color || '#ff5a4a';
        g.addColorStop(0, hexA(col, 0.12 + e.phase * 0.08)); g.addColorStop(1, hexA(col, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bp.x, bp.y, size * 0.75, 0, TAU); ctx.fill();
        ctx.restore();
      }
      if (e.elite) {
        ctx.save(); ctx.globalAlpha = 0.5 + Math.sin(time * 5) * 0.15;
        ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(e.x, W.GROUND + (e.air ? 10 : 4), size * 0.4, size * 0.1, 0, 0, TAU); ctx.stroke();
        ctx.restore();
      }
      if (e.buff) {
        ctx.save(); ctx.globalAlpha = 0.35; ctx.strokeStyle = '#ff7a3d'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(e.x, W.GROUND + 4, size * 0.38 + Math.sin(time * 8) * 4, size * 0.1, 0, 0, TAU); ctx.stroke(); ctx.restore();
      }
      if (e.status.curse) {
        ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = '#7a2bd6';
        ctx.beginPath(); ctx.ellipse(e.x, y - size * 0.45, size * 0.42, size * 0.55, 0, 0, TAU); ctx.fill(); ctx.restore();
      }
    }
    const footY = e.air ? y + size * 0.5 : y;
    const flash = e.hitFlash > 0 ? e.hitFlash / 0.12 : 0;
    const frozen = !e.dead && e.status.freeze;
    let ok = false;
    if (BB.rig && BB.rig.has(key)) {
      // Personaje por piezas: las piernas y brazos se animan solos; el paso va ligado a la distancia (sin patinar)
      const stride = size * 0.62;
      const prog = e.state === 'attack' && e.atkInterval ? 1 - Math.max(0, e.atkTimer) / e.atkInterval : 0;
      const rp = {
        phase: (e.x / stride) * Math.PI + e.id, moving: walking && !e.dead, t: time + e.id * 0.37, seed: e.id,
        windup: e.dead ? 0 : smoothstep(0.45, 1, prog), strike: e.atkAnim > 0 ? e.atkAnim / 0.35 : 0,
        flash: frozen ? 0 : flash, frozen, alpha, dead: e.dead ? Math.min(1, e.dying / 0.45) : 0,
        rot: e.dead ? rot : (e.kbLeft > 0 ? -0.15 : 0), bp: e.phase || 0, rage: e.data && e.data.rage ? 1 : 0,
      };
      ok = BB.rig.draw(ctx, key, e.dead ? x : e.x, footY, size * BB.rig.norm(key), 1, rp);
    }
    if (!ok) ok = drawSprite(sprite, x, footY, size, { want: 'right', rot, sx, sy, alpha, flash: frozen ? 0.45 : flash });
    if (!ok) drawFallbackUnit(x, footY, size, { face: 1, color: e.boss ? '#c0392b' : e.type.indexOf('goblin') >= 0 ? '#8fcf3c' : e.type === 'troll' ? '#6f9a5a' : '#6fae3d', cloth: hashColor(e.type, 45, 38), rot, sx, sy, alpha, flash });
    if (e.dead) return;
    // estados
    const headY = footY - size * 1.02;
    if (frozen) {
      ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = '#bfeaff'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      roundRect(x - size * 0.36, footY - size * 0.98, size * 0.72, size, 10); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    if (e.status.stun) {
      ctx.save(); ctx.fillStyle = '#ffe14a';
      for (let i = 0; i < 3; i++) { const a = time * 6 + i * TAU / 3; star(x + Math.cos(a) * size * 0.25, headY + Math.sin(a) * 5, 6); }
      ctx.restore();
    }
    if (e.status.root && !e.air) {
      ctx.save(); ctx.strokeStyle = '#4f8a2a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + i * 10, W.GROUND + 4); ctx.quadraticCurveTo(x + i * 22, W.GROUND - 18, x + i * 4, W.GROUND - 30); ctx.stroke(); }
      ctx.restore();
    }
    if (e.status.slow && !frozen) {
      ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#9fe7ff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x, W.GROUND + 4, size * 0.3, size * 0.07, 0, 0, TAU); ctx.stroke(); ctx.restore();
    }
    if (!B.headless) {
      if (e.status.burn && Math.random() < 0.35) B.fx.particles(x + rnd(-size * 0.2, size * 0.2), footY - size * rnd(0.2, 0.8), { n: 1, kind: 'fire', color: ['#ffe46b', '#ffa02e', '#ff6a1c'], speed: 20, up: 70, gravity: -60, life: 0.45, size: 7, add: true });
      if (e.status.poison && Math.random() < 0.25) B.fx.particles(x + rnd(-size * 0.2, size * 0.2), footY - size * rnd(0.3, 0.8), { n: 1, kind: 'bubble', color: '#9dff6a', speed: 10, up: 40, gravity: -30, life: 0.8, size: 4 });
    }
    // barra de vida
    if (e.hp < e.maxHp && !e.boss) {
      const bw = Math.max(34, Math.min(90, size * 0.7));
      hpBar(e.x, headY - 6, bw, e.hp / e.maxHp, e.elite ? '#ffcf3d' : '#ff4a3d');
    }
    if (e.elite) { ctx.save(); ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#1e1527'; ctx.lineWidth = 2; star(e.x, headY - 18, 7, true); ctx.restore(); }
  }

  function hexA(hex, a) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return 'rgba(255,90,74,' + a + ')';
    const n = parseInt(m[1], 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function star(x, y, r, strokeIt) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r; const a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill(); if (strokeIt) ctx.stroke();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function hpBar(cx, y, w, frac, color) {
    frac = Math.max(0, Math.min(1, frac));
    ctx.save();
    ctx.fillStyle = 'rgba(20,12,24,0.85)';
    roundRect(cx - w / 2 - 2, y - 2, w + 4, 9, 4); ctx.fill();
    ctx.fillStyle = color;
    if (frac > 0) { roundRect(cx - w / 2, y, Math.max(4, w * frac), 5, 2.5); ctx.fill(); }
    ctx.restore();
  }

  // ------------------------------------------------------------------ proyectiles
  function drawProjectile(B, p) {
    const x = p.x, y = p.y - (p.lift || 0);
    const a = p.angle || 0;
    ctx.save();
    switch (p.kind) {
      case 'arrow': case 'spear': case 'dart': {
        const len = p.kind === 'spear' ? 40 : p.kind === 'dart' ? 14 : 26;
        ctx.translate(x, y); ctx.rotate(a);
        ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2, 0); ctx.stroke();
        ctx.strokeStyle = p.kind === 'dart' ? '#5a9e3a' : '#d9b27a'; ctx.lineWidth = 2.2; ctx.stroke();
        ctx.fillStyle = '#e3e8ef'; ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(len / 2 + 7, 0); ctx.lineTo(len / 2 - 2, -4); ctx.lineTo(len / 2 - 2, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
        if (p.kind === 'arrow') { ctx.fillStyle = p.team === 'enemy' ? '#5a3a1a' : '#e8463c'; ctx.fillRect(-len / 2 - 3, -3, 6, 6); }
        break;
      }
      case 'bolt': case 'bullet': {
        const tap = p.source === 'tap';
        ctx.translate(x, y); ctx.rotate(a);
        if (tap || p.kind === 'bullet') {
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = tap ? 'rgba(255,230,140,0.6)' : 'rgba(255,255,220,0.7)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(10, 0); ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(14, 0); ctx.stroke();
        ctx.strokeStyle = tap ? '#ffd36b' : '#8a5a30'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#cfd6df'; ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(12, -5); ctx.lineTo(12, 5); ctx.closePath(); ctx.fill();
        break;
      }
      case 'fireball': case 'magic': case 'holy': case 'spit': {
        const col = p.color || (p.kind === 'fireball' ? '#ff8a2a' : p.kind === 'magic' ? '#b56cff' : p.kind === 'holy' ? '#ffe58a' : '#8bff5a');
        const r = p.size || (p.kind === 'fireball' ? 12 : 9);
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, col); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, TAU); ctx.fill();
        if (!B.headless && Math.random() < 0.8) B.fx.trail(x, y, col, r * 0.8, true);
        break;
      }
      case 'ice': {
        ctx.translate(x, y); ctx.rotate(a);
        ctx.fillStyle = '#bfeaff'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(0, -6); ctx.lineTo(-14, 0); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
        if (!B.headless && Math.random() < 0.6) B.fx.trail(x, y, '#9fe7ff', 4, true);
        break;
      }
      case 'cannon': case 'rock': case 'bomb': {
        const r = p.size || (p.kind === 'rock' ? 11 : p.kind === 'bomb' ? 9 : 8);
        ctx.translate(x, y); ctx.rotate(p.age * 9);
        ctx.fillStyle = p.kind === 'rock' ? '#8d8f97' : '#2b2d38'; ctx.strokeStyle = '#120c16'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.35, r * 0.3, 0, TAU); ctx.fill();
        if (p.kind === 'bomb') { ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(r * 0.6, -r, 3 + Math.random() * 2, 0, TAU); ctx.fill(); }
        break;
      }
      case 'hammer': {
        ctx.translate(x, y); ctx.rotate(p.age * 16);
        ctx.fillStyle = '#8a5a30'; ctx.fillRect(-2, -12, 4, 22);
        ctx.fillStyle = '#9aa0a8'; ctx.strokeStyle = '#1e1527'; ctx.lineWidth = 2;
        ctx.fillRect(-9, -16, 18, 9); ctx.strokeRect(-9, -16, 18, 9);
        break;
      }
      case 'potion': {
        ctx.translate(x, y); ctx.rotate(p.age * 10);
        ctx.fillStyle = p.color || '#7ddb4a'; ctx.strokeStyle = '#1e1527'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 3, 7, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#d9d2c5'; ctx.fillRect(-2.5, -8, 5, 6);
        break;
      }
      case 'feather': {
        ctx.translate(x, y); ctx.scale(-1, 1);
        const fl = Math.sin(p.age * 30) * 6;
        ctx.fillStyle = '#8a5a30'; ctx.strokeStyle = '#1e1527'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, 0, 10, 5, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-12, -10 - fl); ctx.lineTo(6, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(15, 2); ctx.lineTo(10, 3); ctx.fill();
        break;
      }
      case 'wind': {
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = '#e8f7ff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + i * 8, y - i * 10, 22 + i * 6, Math.PI * 0.6, Math.PI * 1.5); ctx.stroke(); }
        break;
      }
      case 'custom':
        if (typeof p.draw === 'function') { try { p.draw(ctx, p, B); } catch (err) { /* nada */ } }
        break;
      default: {
        ctx.fillStyle = p.color || '#ffffff';
        ctx.beginPath(); ctx.arc(x, y, p.size || 6, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ superposiciones en pantalla
  function drawBanners(B) {
    const fx = B.fx;
    if (!fx.banners) return;
    for (const b of fx.banners) {
      if (b.delay > 0) continue;
      const k = 1 - b.life / b.max;
      let sc = 1, al = 1;
      if (k < 0.12) sc = 0.5 + (k / 0.12) * 0.6; else if (k < 0.2) sc = 1.1 - (k - 0.12) / 0.08 * 0.1;
      if (k > 0.8) { al = 1 - (k - 0.8) / 0.2; }
      const size = Math.max(28, Math.min(72, cam.vh * 0.11));
      ctx.save();
      ctx.translate(cam.vw / 2, cam.vh * 0.3);
      ctx.scale(sc, sc);
      ctx.globalAlpha = Math.max(0, al);
      ctx.font = size + 'px "Lilita One", "Arial Black", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.lineWidth = size * 0.22; ctx.strokeStyle = '#1e1527'; ctx.strokeText(b.str, 0, 0);
      ctx.fillStyle = b.color; ctx.fillText(b.str, 0, 0);
      if (b.sub) {
        ctx.font = Math.round(size * 0.4) + 'px "Lilita One", "Arial Black", sans-serif';
        ctx.lineWidth = size * 0.1; ctx.strokeText(b.sub, 0, size * 0.75);
        ctx.fillStyle = '#fff6e0'; ctx.fillText(b.sub, 0, size * 0.75);
      }
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ fotograma
  function draw(B, dt) {
    if (!canvas || !B) return;
    time += dt || 0;
    if (canvas.clientWidth !== cam.vw || canvas.clientHeight !== cam.vh) resize();
    buildStatic(B);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    const sh = B.fx.shakeOffset ? B.fx.shakeOffset() : { x: 0, y: 0 };
    ctx.fillStyle = '#1e1208';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(staticLayer, Math.round(sh.x * dpr * cam.s), Math.round(sh.y * dpr * cam.s));
    ctx.setTransform(dpr * cam.s, 0, 0, dpr * cam.s, dpr * (cam.ox + sh.x * cam.s), dpr * (cam.oy + sh.y * cam.s));
    const box = { L: cam.left - 4, T: cam.top - 4, R: W.W + 4, Bt: cam.bottom + 4 };
    if (BB.scenery) BB.scenery.drawSky(ctx, B, pal(B), box, time);
    if (B.fx.drawGround) B.fx.drawGround(ctx, time);
    for (const tw of B.towers) if (tw.kind === 'trap') drawTower(B, tw);
    drawCastle(B);
    drawWall(B);
    if (!W.PLAZA) drawBalconies(B);
    // héroes y tropas en la plaza: los de delante tapan a los de detrás
    const crew = [];
    for (const h of B.heroes) crew.push([h.y, 0, h]);
    if (B.troops) for (const u of B.troops) crew.push([u.y, 1, u]);
    crew.sort((a, b) => a[0] - b[0]);
    for (const [, k, u] of crew) { if (k) drawTroop(B, u); else drawHero(B, u); }
    for (const tw of B.towers) if (tw.kind !== 'trap') drawTower(B, tw);
    const ground = [], air = [];
    for (const e of B.corpses) (e.air ? air : ground).push(e);
    for (const e of B.enemies) (e.air ? air : ground).push(e);
    ground.sort((a, b) => a.y - b.y || a.x - b.x);
    for (const e of ground) drawEnemy(B, e);
    if (BB.scenery) BB.scenery.drawFront(ctx, B, pal(B), box, time);
    for (const e of air) drawEnemy(B, e);
    for (const p of B.projectiles) drawProjectile(B, p);
    if (B.fx.draw) B.fx.draw(ctx, time);
    // capa de pantalla
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBanners(B);
    if (B.fx.flashT > 0) {
      ctx.globalAlpha = Math.max(0, B.fx.flashT / B.fx.flashMax);
      ctx.fillStyle = B.fx.flashColor || '#fff';
      ctx.fillRect(0, 0, cam.vw, cam.vh);
      ctx.globalAlpha = 1;
    }
  }

  BB.render = {
    init(el) {
      canvas = el;
      ctx = canvas.getContext('2d');
      resize();
      window.addEventListener('resize', () => setTimeout(resize, 50));
    },
    resize,
    draw,
    invalidate() { staticKey = ''; },
    camera() { return cam; },
    worldToScreen(x, y) { return { x: cam.ox + x * cam.s, y: cam.oy + y * cam.s }; },
    screenToWorld(px, py) { return { x: (px - cam.ox) / cam.s, y: (py - cam.oy) / cam.s }; },
    drawSprite: (key, x, y, h, o) => drawSprite(key, x, y, h, o),
  };
})();
