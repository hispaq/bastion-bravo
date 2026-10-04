/* Bastión Bravo · dibujos de la IA local (estilo garabato) animados por código.
   Si existe la imagen generada (BB.assets.raw), se usa en vez del dibujo vectorial de BB.rig:
   - personajes: la imagen se corta en franjas horizontales que se desplazan (pasos, balanceo,
     inclinación al atacar), respiración, saltitos, destello blanco al recibir daño, tinte de hielo.
   - escenario: fondo de la zona, camino de tierra, torre del castillo, empalizada y estructuras
     del campamento detrás de la torre. */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const TAU = Math.PI * 2;
  const W = () => BB.WORLD;
  const raw = (k) => (BB.assets && BB.assets.raw ? BB.assets.raw(k) : null);
  const now = () => performance.now() / 1000;

  // ------------------------------------------------------------------ tintes (destello / hielo / furia)
  const tintCache = {};
  function tinted(key, img, color) {
    const ck = key + '|' + color;
    if (tintCache[ck] !== undefined) return tintCache[ck];
    let c = null;
    try {
      c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    } catch (err) { c = null; }
    tintCache[ck] = c;
    return c;
  }

  function kindOf(key) {
    if (/^(enemy|boss)_/.test(key)) return 'walker';
    if (/^(hero|troop)_/.test(key)) return 'shooter';
    return 'object';
  }
  function fileFacing(key) {
    const m = (BB.SPRITES || {})[key];
    if (m && m.facing) return m.facing;
    return /^(hero|troop)_/.test(key) ? 'left' : 'right';
  }
  // Algunos personajes vuelan o flotan: se balancean en vez de andar
  const FLOATERS = { enemy_goblin_planeador: 1, boss_nigromante: 1, boss_dragon: 1 };
  const QUADS = { enemy_jinete_lobo: 1, boss_escorpion: 1, boss_golem: 1, enemy_orco_ariete: 1, boss_rey_goblin: 1 };

  const STRIPS = 16;
  // Dibuja la imagen en franjas con desplazamiento horizontal f(v) (v: 0 arriba … 1 pies)
  function stripDraw(ctx, img, w, h, shiftFn) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const sh = ih / STRIPS, dh = h / STRIPS;
    for (let i = 0; i < STRIPS; i++) {
      const v = (i + 0.5) / STRIPS;
      const dx = shiftFn(v);
      ctx.drawImage(img, 0, i * sh, iw, Math.min(sh + 1, ih - i * sh), -w / 2 + dx, -h + i * dh, w, dh + 0.8);
    }
  }

  // Unidad: pies en (0,0), alto 100, mirando a la derecha (BB.rig.draw ya aplica escala y giro)
  function drawUnit(ctx, key, img, pose) {
    const kind = kindOf(key);
    const t = pose.t != null ? pose.t : now();
    const seed = pose.seed || 0;
    const h = 100, w = h * img.naturalWidth / img.naturalHeight;
    const strike = Math.max(0, Math.min(1, pose.strike || 0));
    const windup = Math.max(0, Math.min(1, pose.windup || 0));
    let top = 0, legs = 0, bob = 0, sx = 1, sy = 1, rot = 0;
    if (kind === 'walker') {
      const ph = pose.phase != null ? pose.phase : t * 6;
      if (FLOATERS[key]) {
        bob = Math.sin(t * 3 + seed) * 5 + 4; rot = Math.sin(t * 2.2 + seed) * 0.05;
      } else if (pose.moving !== false) {
        bob = Math.abs(Math.sin(ph)) * (QUADS[key] ? 3 : 6);
        legs = Math.sin(ph) * (QUADS[key] ? 0.05 : 0.11) * w;
        rot = Math.sin(ph) * 0.045;
        sy = 1 + Math.cos(ph * 2) * 0.025; sx = 2 - sy;
      } else {
        sy = 1 + Math.sin(t * 2.6 + seed) * 0.025; sx = 2 - sy;
      }
      // ataque: se echa atrás y luego embiste
      top = (-windup * 0.08 + strike * 0.2) * w;
      if (strike > 0) { sx *= 1 + strike * 0.06; sy *= 1 - strike * 0.05; }
    } else if (kind === 'shooter') {
      sy = 1 + Math.sin(t * 2.4 + seed) * 0.03; sx = 2 - sy;
      top = (-windup * 0.07 + strike * 0.1) * w;
      bob = strike * 3;
      rot = -windup * 0.04 + strike * 0.05;
    } else {
      sy = 1 - strike * 0.08; sx = 1 + strike * 0.06;
    }
    ctx.save();
    ctx.translate(0, -bob);
    if (rot) ctx.rotate(rot);
    ctx.scale(sx, sy);
    if (fileFacing(key) === 'left') ctx.scale(-1, 1);
    const flip = fileFacing(key) === 'left' ? -1 : 1;
    const shift = (v) => flip * (top * Math.pow(Math.max(0, 1 - v / 0.75), 1.4) + legs * Math.max(0, (v - 0.62) / 0.38) * (v > 0.8 ? 1 : 0.6));
    stripDraw(ctx, img, w, h, shift);
    // capas de tinte
    const overlay = (color, a) => {
      const c = tinted(key, img, color);
      if (!c || a <= 0) return;
      ctx.globalAlpha = a;
      stripDraw(ctx, c, w, h, shift);
      ctx.globalAlpha = 1;
    };
    if (pose.frozen) overlay('#8fdcff', 0.45);
    if (pose.rage) overlay('#ff3a1c', 0.18 + Math.sin(t * 10) * 0.1);
    if (pose.flash) overlay('#ffffff', Math.min(1, pose.flash) * 0.85);
    ctx.restore();
  }

  // ------------------------------------------------------------------ integración con BB.rig
  function hook() {
    const rig = BB.rig;
    if (!rig || rig._doodle) return;
    rig._doodle = true;
    const origDraw = rig.draw, origHas = rig.has, origNorm = rig.norm, origImage = rig.image, origMeasure = rig.measure;
    rig.draw = function (ctx, key, x, y, size, face, pose) {
      const img = raw(key);
      if (!img) return origDraw.call(rig, ctx, key, x, y, size, face, pose);
      pose = pose || {};
      const s = size / 100;
      ctx.save();
      ctx.translate(x, y);
      if (pose.rot) ctx.rotate(pose.rot);
      ctx.scale(s * face * (pose.sx || 1), s * (pose.sy || 1));
      if (pose.alpha != null) ctx.globalAlpha = pose.alpha;
      try { drawUnit(ctx, key, img, pose); } catch (err) { console.error('[doodle ' + key + ']', err); }
      ctx.restore();
      return true;
    };
    rig.has = (key) => !!raw(key) || origHas.call(rig, key);
    rig.norm = (key) => (raw(key) ? 1 : origNorm.call(rig, key));
    rig.measure = function (key) {
      const img = raw(key);
      if (!img) return origMeasure.call(rig, key);
      const w = 100 * img.naturalWidth / img.naturalHeight;
      return { x0: -w / 2, x1: w / 2, y0: -100, y1: 0, h: 100 };
    };
    rig.image = function (key, h) {
      const img = raw(key);
      if (!img) return origImage.call(rig, key, h);
      if (fileFacing(key) === 'right' || !/^(hero|troop)_/.test(key)) return img;
      // los héroes miran a la izquierda en el archivo; para retratos se dejan así (miran al enemigo)
      return img;
    };
  }

  // ------------------------------------------------------------------ escenario
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) {
    if (!/^#[0-9a-f]{6}$/i.test(a || '') || !/^#[0-9a-f]{6}$/i.test(b || '')) return a;
    const A = hexRgb(a), B2 = hexRgb(b);
    return '#' + A.map((v, i) => Math.round(v + (B2[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  const INK = '#3b2a1e';
  function wobblyLine(g, pts, w) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      g.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
    }
    g.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    g.lineWidth = w; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke();
  }
  function drawImg(g, key, cx, footY, h, opts) {
    const img = raw(key);
    if (!img) return false;
    opts = opts || {};
    const w = h * img.naturalWidth / img.naturalHeight;
    g.save();
    g.translate(cx, footY);
    if (opts.flip) g.scale(-1, 1);
    if (opts.alpha != null) g.globalAlpha = opts.alpha;
    g.drawImage(img, -w / 2, -h, w, h);
    g.restore();
    return true;
  }
  // Camino de tierra serpenteante con contorno a mano alzada
  const ROAD = { bosque: '#e2c48a', pantano: '#9c8a5c', montanas: '#cdbb9a', desierto: '#f0d29a', volcan: '#7a5246',
                 oscuras: '#8b7a86', hielo: '#e8f1f6', ruinas: '#a89f88', forja: '#9a8676', dragon: '#8a5a46' };
  function ground(g, B, P, box) {
    const { L, R, Bt } = box;
    const GR = W().GROUND;
    const z = (B.zone && B.zone.id) || 'bosque';
    const grass = P.groundTop || '#8cc152';
    const road = ROAD[z] || '#e2c48a';
    // hierba delantera
    g.fillStyle = grass;
    g.fillRect(L, GR - 40, R - L, Bt - GR + 40);
    const rng = BB.util.mulberry32(BB.util.hashStr(z + 'road'));
    // ramal que se aleja hacia las colinas (profundidad)
    g.save();
    const bx = L + (R - L) * 0.18;
    g.beginPath();
    g.moveTo(bx - 70, GR - 14);
    g.bezierCurveTo(bx - 40, GR - 50, bx + 90, GR - 60, bx + 40, GR - 92);
    g.bezierCurveTo(bx + 20, GR - 104, bx + 70, GR - 112, bx + 96, GR - 118);
    g.lineTo(bx + 112, GR - 116);
    g.bezierCurveTo(bx + 92, GR - 108, bx + 60, GR - 100, bx + 82, GR - 88);
    g.bezierCurveTo(bx + 140, GR - 60, bx + 60, GR - 30, bx + 70, GR - 14);
    g.closePath();
    g.fillStyle = road; g.fill();
    g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke();
    g.restore();
    // camino principal por donde vienen los enemigos
    const top = [], bot = [];
    for (let x = L - 20; x <= R + 40; x += 40) {
      top.push([x, GR - 18 + Math.sin(x * 0.006 + 1) * 6 + (rng() - 0.5) * 3]);
      bot.push([x, GR + 46 + Math.sin(x * 0.0045 + 2) * 9 + (rng() - 0.5) * 3]);
    }
    g.beginPath();
    g.moveTo(top[0][0], top[0][1]);
    for (const p of top) g.lineTo(p[0], p[1]);
    for (let i = bot.length - 1; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1]);
    g.closePath();
    g.fillStyle = road; g.fill();
    // huellas y piedrecitas
    for (let i = 0; i < 90; i++) {
      const x = L + rng() * (R - L), y = GR - 8 + rng() * 48;
      g.beginPath(); g.ellipse(x, y, 4 + rng() * 6, 2 + rng() * 2, 0, 0, TAU);
      g.fillStyle = mix(road, '#5a3a20', 0.22 + rng() * 0.1); g.fill();
    }
    wobblyLine(g, top, 3.5);
    wobblyLine(g, bot, 3.5);
    // plaza de tierra detrás de la torre, donde forman héroes y tropas
    if (W().PLAZA) {
      const px = W().CASTLE_X + 60;
      const left = W().CASTLE_X + 70, right = R + 80;
      const pcx = (left + right) / 2, rx = (right - left) / 2, ry = 88;
      const pts = [];
      const N = 26;
      for (let i = 0; i <= N; i++) {
        const a = Math.PI + (i / N) * Math.PI;           // semicírculo superior
        pts.push([pcx + Math.cos(a) * rx + (rng() - 0.5) * 8, GR + 46 + Math.sin(a) * ry + (rng() - 0.5) * 6]);
      }
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts) g.lineTo(p[0], p[1]);
      g.lineTo(R + 40, Bt + 10); g.lineTo(px - 60, Bt + 10); g.closePath();
      g.fillStyle = mix(road, '#ffffff', 0.08); g.fill();
      wobblyLine(g, pts, 3.5);
      for (let i = 0; i < 40; i++) {
        const x = px + rng() * (R - px), y = GR - 20 + rng() * (Bt - GR + 10);
        g.beginPath(); g.ellipse(x, y, 4 + rng() * 6, 2 + rng() * 2, 0, 0, TAU);
        g.fillStyle = mix(road, '#5a3a20', 0.2); g.fill();
      }
      // matas de hierba sobre la arena
      for (let i = 0; i < 6; i++) {
        const x = px + 60 + rng() * (R - px - 80), y = GR + 20 + rng() * (Bt - GR - 30);
        g.beginPath(); g.ellipse(x, y, 22 + rng() * 14, 8, 0, 0, TAU);
        g.fillStyle = grass; g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
      }
    }
    // matas de hierba en el borde del camino
    g.strokeStyle = mix(grass, '#1d3d12', 0.45); g.lineWidth = 2.5; g.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const x = L + rng() * (R - L), y = rng() < 0.5 ? GR - 22 - rng() * 14 : GR + 54 + rng() * (Bt - GR - 60);
      g.beginPath(); g.moveTo(x - 5, y - 8); g.lineTo(x, y); g.lineTo(x + 2, y - 11); g.moveTo(x, y); g.lineTo(x + 6, y - 7); g.stroke();
    }
    // huecos de trampas
    g.strokeStyle = 'rgba(80,50,30,0.45)'; g.lineWidth = 3; g.setLineDash([10, 8]);
    for (const sl of W().TRAP_SLOTS) { g.beginPath(); g.ellipse(sl.x, GR + 8, 44, 12, 0, 0, TAU); g.stroke(); }
    g.setLineDash([]);
  }

  function hookScenery() {
    const S = BB.scenery;
    if (!S || S._doodle) return;
    S._doodle = true;
    const origBack = S.buildBack, origCastle = S.castle, origWall = S.wall;

    S.buildBack = function (g, B, P, box) {
      const bg = B.zone ? raw(B.zone.bg) : null;
      if (!bg) { origBack(g, B, P, box); ground(g, B, P, box); return; }
      const { L, T, R, Bt } = box;
      const GR = W().GROUND;
      // fondo dibujado por la IA: cubre del techo hasta el suelo
      const areaW = R - L, areaH = GR + 30 - T;
      const sc = Math.max(areaW / bg.naturalWidth, areaH / bg.naturalHeight);
      const dw = bg.naturalWidth * sc, dh = bg.naturalHeight * sc;
      g.fillStyle = P.sky || '#bfe3f5'; g.fillRect(L, T, areaW, Bt - T);
      g.drawImage(bg, L + (areaW - dw) / 2, GR + 30 - dh, dw, dh);
      // tinte por zona (la IA tiende a pintar todo verde)
      const TINT = { hielo: ['screen', 'rgba(170,215,255,0.55)'], volcan: ['multiply', 'rgba(255,140,100,0.55)'],
                     dragon: ['multiply', 'rgba(255,120,90,0.5)'], oscuras: ['multiply', 'rgba(150,120,190,0.6)'],
                     ruinas: ['multiply', 'rgba(140,170,160,0.55)'], pantano: ['multiply', 'rgba(170,190,140,0.45)'] };
      const tz = TINT[(B.zone && B.zone.id) || ''];
      if (tz) { g.save(); g.globalCompositeOperation = tz[0]; g.fillStyle = tz[1]; g.fillRect(L, T, areaW, GR + 30 - T); g.restore(); }
      if (P.fog) { g.fillStyle = P.fog; g.fillRect(L, T, areaW, GR - T); }
      ground(g, B, P, box);
      // estructuras del campamento detrás de la torre y algo de decoración
      const rng = BB.util.mulberry32(BB.util.hashStr((B.zone && B.zone.id) + 'deco'));
      drawImg(g, 'deco_arbol', L + 120 + rng() * 80, GR - 34, 120);
      drawImg(g, 'deco_arbusto', L + 420 + rng() * 120, GR - 26, 46);
      drawImg(g, 'deco_roca', L + 700 + rng() * 120, GR - 24, 40);
      drawImg(g, 'deco_arbusto', 980 + rng() * 60, GR - 26, 40, { flip: true });
      drawImg(g, 'deco_atalaya', 1555, GR - 36, 230);
      drawImg(g, 'deco_tienda', 1490, GR - 40, 92);
      drawImg(g, 'deco_estandarte', 1460, GR - 30, 150);
      drawImg(g, 'deco_carro', 1590, GR - 18, 64, { flip: true });
      drawImg(g, 'deco_barriles', 1200, GR - 6, 56);
    };

    S.castle = function (ctx, B, t) {
      const c = B.castle || {};
      const tier = Math.max(1, Math.min(5, c.tier || 1));
      const img = raw('castle_' + tier);
      if (!img) return origCastle(ctx, B, t);
      const GR = W().GROUND;
      const h = 400 + tier * 22;
      const hit = c.hitT > 0 ? Math.min(1, c.hitT / 0.15) : 0;
      const frac = c.maxHp > 0 ? c.hp / c.maxHp : 1;
      const cx = W().CASTLE_X + 92;
      ctx.save();
      if (hit) ctx.translate((Math.random() - 0.5) * 5 * hit, 0);
      // la torre "respira" con el viento en la bandera: leve oscilación del tejado no; sólo golpe
      const sq = 1 - hit * 0.015;
      const w = h * img.naturalWidth / img.naturalHeight;
      ctx.translate(cx, GR + 34);
      ctx.scale(2 - sq, sq);
      ctx.drawImage(img, -w / 2, -h, w, h);
      if (hit) {
        const wc = tinted('castle_' + tier, img, '#ffffff');
        if (wc) { ctx.globalAlpha = hit * 0.4; ctx.drawImage(wc, -w / 2, -h, w, h); ctx.globalAlpha = 1; }
      }
      if (frac < 0.5) {
        const red = tinted('castle_' + tier, img, '#3a1c10');
        if (red) { ctx.globalAlpha = (0.5 - frac) * 0.5; ctx.drawImage(red, -w / 2, -h, w, h); ctx.globalAlpha = 1; }
      }
      ctx.restore();
      // humo y fuego cuando está muy dañada
      if (B.fx && frac < 0.6 && Math.random() < 0.08) B.fx.particles(cx - w * 0.3 + Math.random() * w * 0.6, GR - h * (0.3 + Math.random() * 0.5), { n: 1, kind: 'smoke', color: ['#4e4744', '#6a625e'], speed: 20, up: 60, gravity: -40, life: 1.4, size: 14, shrink: false });
      if (B.fx && frac < 0.3 && Math.random() < 0.1) B.fx.particles(cx - w * 0.25 + Math.random() * w * 0.5, GR - h * (0.2 + Math.random() * 0.5), { n: 1, kind: 'fire', color: ['#ffa02e', '#ff6a1c'], speed: 30, up: 50, gravity: -80, life: 0.5, size: 9, add: true });
    };

    S.wall = function (ctx, B, t) {
      const c = B.castle || {};
      const img = raw('deco_empalizada');
      if (!img || c.wallHp <= 0) return origWall(ctx, B, t);
      const GR = W().GROUND;
      const frac = c.wallMax > 0 ? c.wallHp / c.wallMax : 0;
      const h = (120 + (c.wallTier || 1) * 14) * (0.6 + 0.4 * Math.min(1, frac * 1.4));
      const w = Math.min(h * img.naturalWidth / img.naturalHeight, 120);
      const hit = c.wallHitT > 0 ? c.wallHitT / 0.15 : 0;
      ctx.save();
      ctx.translate(W().WALL_X + 26 + (hit ? (Math.random() - 0.5) * 4 : 0), GR + 22);
      ctx.drawImage(img, -w / 2, -h, w, h);
      if (hit) { const wc = tinted('deco_empalizada', img, '#ffffff'); if (wc) { ctx.globalAlpha = hit * 0.5; ctx.drawImage(wc, -w / 2, -h, w, h); } }
      ctx.restore();
    };
  }

  BB.doodle = { hook, hookScenery, drawImg, tinted };
  hook();
  hookScenery();
})();
