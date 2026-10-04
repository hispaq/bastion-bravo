/* Bastión Bravo · personajes dibujados por piezas y animados por código (estilo dibujo animado).
   Cada personaje se dibuja en un espacio de 100 unidades de alto, con los pies en (0,0) y mirando
   a la derecha (+x). El renderizador escala, voltea y coloca.
   Pose: { phase (ciclo de andar, rad), moving, windup 0..1, strike 0..1, t, flash 0..1, frozen, dead 0..1 } */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const TAU = Math.PI * 2;
  const INK = '#24161a';
  const LW = 4.2;

  // ------------------------------------------------------------------ color
  const cache = new Map();
  function hexRgb(h) {
    let c = cache.get(h);
    if (!c) { const n = parseInt(h.slice(1), 16); c = [n >> 16, (n >> 8) & 255, n & 255]; cache.set(h, c); }
    return c;
  }
  let FLASH = 0, FROZEN = false;
  function col(h) {
    if (!FLASH && !FROZEN) return h;
    let [r, g, b] = hexRgb(h);
    if (FROZEN) { const m = (r + g + b) / 3; r = m * 0.55 + 90; g = m * 0.7 + 110; b = m * 0.6 + 160; }
    if (FLASH) { r += (255 - r) * FLASH * 0.5; g += (255 - g) * FLASH * 0.45; b += (255 - b) * FLASH * 0.45; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }
  function shade(h, k) { // k<0 oscurece, k>0 aclara
    const [r, g, b] = hexRgb(h);
    const f = c => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)));
    return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
  }

  // ------------------------------------------------------------------ primitivas
  function fillStroke(ctx, fill, lw) {
    if (fill) { ctx.fillStyle = col(fill); ctx.fill(); }
    if (lw !== 0) { ctx.lineWidth = lw || LW; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
  }
  function circle(ctx, x, y, r, fill, lw) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, TAU); fillStroke(ctx, fill, lw); }
  function oval(ctx, x, y, rx, ry, fill, rot, lw) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); fillStroke(ctx, fill, lw); }
  function poly(ctx, pts, fill, lw) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); fillStroke(ctx, fill, lw); }
  function line(ctx, x1, y1, x2, y2, w, color) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineCap = 'round'; ctx.lineWidth = w; ctx.strokeStyle = color; ctx.stroke(); }
  // Segmento grueso con contorno (para extremidades)
  function bone(ctx, x1, y1, x2, y2, w, color) { line(ctx, x1, y1, x2, y2, w + LW * 2, INK); line(ctx, x1, y1, x2, y2, w, col(color)); }
  function hl(ctx, x, y, rx, ry, a) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, -0.4, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,' + (a || 0.35) + ')'; ctx.fill(); }
  // Mancha de sombra recortada dentro del último trazado
  function shadeIn(ctx, pathFn, color, x, y, w, h) {
    ctx.save(); pathFn(); ctx.clip(); ctx.fillStyle = col(color); ctx.fillRect(x, y, w, h); ctx.restore();
  }
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // ------------------------------------------------------------------ cuerpo humanoide
  // cfg: { skin, skin2, cloth, cloth2, pants, boots, belt, scale:{body,head,leg}, head(ctx,x,y,r,p), weapon, offhand, back, front, armStyle }
  function limbs2(ctx, x, y, a1, a2, l1, l2, w, color, endColor, endR) {
    const kx = x + Math.sin(a1) * l1, ky = y + Math.cos(a1) * l1;
    const fx = kx + Math.sin(a1 + a2) * l2, fy = ky + Math.cos(a1 + a2) * l2;
    bone(ctx, x, y, kx, ky, w, color);
    bone(ctx, kx, ky, fx, fy, w * 0.92, color);
    if (endColor) circle(ctx, fx, fy, endR || w * 0.6, endColor);
    return { x: fx, y: fy, kx, ky, ang: a1 + a2 };
  }

  function humanoid(ctx, p, c) {
    const B = c.bulk || 1, L = c.leg || 1;
    const moving = p.moving && !p.dead;
    const ph = p.phase || 0;
    const sw = moving ? Math.sin(ph) : 0;
    const bob = moving ? Math.abs(Math.cos(ph)) * 3.2 : Math.sin((p.t || 0) * 2.6) * 0.8;
    const lean = moving ? 0.06 * (c.lean || 1) : 0;
    const hipY = -30 * L - bob, hipX = 0;
    const shY = hipY - 26 * B, shX = 2 + lean * 20;
    const headY = shY - (c.headR || 17) * 0.95 - 4;
    const legW = 9 * B * (c.legW || 1), armW = 7.5 * B * (c.armW || 1);
    const l1 = 16 * L, l2 = 15 * L;

    // Ataque: brazo delantero
    const wind = p.windup || 0, strike = p.strike || 0;

    if (c.back) c.back(ctx, p, { hipY, shY, shX, B });

    // pierna trasera
    const k1 = moving ? Math.max(0, -Math.cos(ph)) * 0.9 : 0.1;
    limbs2(ctx, hipX - 3 * B, hipY, -sw * 0.55, k1 * -1 + 0.05 + sw * 0.1, l1, l2, legW, shade(c.pants, -0.15));
    const f1x = hipX - 3 * B + Math.sin(-sw * 0.55) * l1 + Math.sin(-sw * 0.55 - k1 + 0.05 + sw * 0.1) * l2;
    const f1y = hipY + Math.cos(-sw * 0.55) * l1 + Math.cos(-sw * 0.55 - k1 + 0.05 + sw * 0.1) * l2;
    oval(ctx, f1x + 4, f1y - 1, 8 * B, 4.5, shade(c.boots, -0.15));

    // brazo trasero
    const bArm = c.backArm ? c.backArm(p, { sw, wind, strike }) : { a1: 0.25 + sw * 0.5, a2: -0.5 };
    const bh = limbs2(ctx, shX - 9 * B, shY + 3, bArm.a1, bArm.a2, 12 * B, 11 * B, armW, shade(c.sleeve || c.skin, -0.15), shade(c.skin, -0.1), 4.8 * B);
    if (c.offhand) c.offhand(ctx, p, bh);

    // pierna delantera
    const k2 = moving ? Math.max(0, Math.cos(ph)) * 0.9 : 0.1;
    limbs2(ctx, hipX + 3 * B, hipY, sw * 0.55, -k2 + 0.05 - sw * 0.1, l1, l2, legW, c.pants);
    const f2x = hipX + 3 * B + Math.sin(sw * 0.55) * l1 + Math.sin(sw * 0.55 - k2 + 0.05 - sw * 0.1) * l2;
    const f2y = hipY + Math.cos(sw * 0.55) * l1 + Math.cos(sw * 0.55 - k2 + 0.05 - sw * 0.1) * l2;
    oval(ctx, f2x + 4, f2y - 1, 8 * B, 4.5, c.boots);

    // torso
    ctx.save();
    ctx.translate(hipX, hipY); ctx.rotate(lean); ctx.translate(-hipX, -hipY);
    const tw = 14 * B * (c.torsoW || 1);
    const torso = () => {
      ctx.beginPath();
      ctx.moveTo(hipX - tw * 0.95, hipY + 4);
      ctx.quadraticCurveTo(hipX - tw * 1.25, (hipY + shY) / 2, shX - tw * 0.9, shY - 2);
      ctx.quadraticCurveTo(shX, shY - 7, shX + tw * 0.9, shY - 2);
      ctx.quadraticCurveTo(hipX + tw * 1.3, (hipY + shY) / 2, hipX + tw * 0.95, hipY + 4);
      ctx.closePath();
    };
    torso(); fillStroke(ctx, c.cloth, 0);
    shadeIn(ctx, torso, shade(c.cloth, -0.22), hipX - tw * 1.5, shY - 10, tw * 0.75, 60);
    if (c.torsoDeco) { ctx.save(); torso(); ctx.clip(); c.torsoDeco(ctx, p, { hipX, hipY, shX, shY, tw }); ctx.restore(); }
    torso(); fillStroke(ctx, null);
    if (c.belt) {
      ctx.beginPath(); ctx.moveTo(hipX - tw * 1.02, hipY - 1); ctx.lineTo(hipX + tw * 1.02, hipY - 1);
      ctx.lineWidth = 5.5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = col(c.belt); ctx.stroke();
      oval(ctx, hipX + 3, hipY - 1, 3.4, 3, '#ffd34a', 0, 2);
    }
    if (c.mid) c.mid(ctx, p, { hipX, hipY, shX, shY, tw, B });

    // cabeza
    const hr = c.headR || 17;
    const hx = shX + 3 + lean * 12, hy = headY + (moving ? -Math.abs(Math.sin(ph)) * 0.8 : 0);
    c.head(ctx, hx, hy, hr, p);
    ctx.restore();

    // brazo delantero + arma
    const fArm = c.frontArm ? c.frontArm(p, { sw, wind, strike }) : { a1: -sw * 0.5 + 0.2 - wind * 2.6 + strike * 1.2, a2: -0.6 + wind * 0.3 };
    const sx = shX + 8 * B + lean * 14, sy = shY + 3;
    if (c.weaponBehind && c.weapon) c.weapon(ctx, p, null, { sx, sy, fArm });
    const fh = limbs2(ctx, sx, sy, fArm.a1, fArm.a2, 12 * B, 11 * B, armW, c.sleeve || c.skin, null);
    if (c.weapon && !c.weaponBehind) c.weapon(ctx, p, fh, { sx, sy, fArm });
    circle(ctx, fh.x, fh.y, 5 * B, c.skin);
    if (c.front) c.front(ctx, p, { hipX, hipY, shX, shY, B, fh, bh });
    // estela del golpe
    if (strike > 0.25 && c.slash !== false) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.85, (strike - 0.25) * 1.4);
      ctx.beginPath(); ctx.arc(sx, sy, (c.slashR || 34) * B, -1.9, 1.0);
      ctx.lineWidth = 7 * strike; ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round'; ctx.stroke();
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ armas (dibujadas en la mano)
  function atHand(ctx, fh, angOff, fn) {
    ctx.save(); ctx.translate(fh.x, fh.y); ctx.rotate(-fh.ang + (angOff || 0)); fn(ctx); ctx.restore();
  }
  // la hoja apunta hacia +y local (sale de la mano siguiendo el antebrazo)
  function sword(len, color, guard) {
    return (ctx, p, fh) => atHand(ctx, fh, -1.2, g => {
      poly(g, [-3.2, 4, -3.4, 4 + len, 0, 9 + len, 3.4, 4 + len, 3.2, 4], color || '#dfe6ee', 3);
      line(g, 0.8, 6, 0.8, 2 + len, 1.6, 'rgba(255,255,255,0.8)');
      poly(g, [-9, 2, 9, 2, 9, 6, -9, 6], guard || '#d8a43a', 3);
      poly(g, [-2.6, -9, 2.6, -9, 2.6, 2, -2.6, 2], '#6a4024', 2.5);
    });
  }
  function dagger() { return sword(16, '#cfd6de', '#8a5a30'); }
  function axe(len, big) {
    return (ctx, p, fh) => atHand(ctx, fh, -1.25, g => {
      poly(g, [-2.6, -10, 2.6, -10, 2.6, len, -2.6, len], '#8a5a30', 3);
      const s = big ? 1.5 : 1;
      g.beginPath(); g.moveTo(2, len - 18 * s); g.quadraticCurveTo(22 * s, len - 22 * s, 20 * s, len + 2 * s);
      g.quadraticCurveTo(12 * s, len - 4 * s, 2, len - 2); g.closePath(); fillStroke(g, '#d9e0e8', 3);
      line(g, 17 * s, len - 18 * s, 18 * s, len - 1, 2, 'rgba(255,255,255,0.85)');
    });
  }
  function club(len) {
    return (ctx, p, fh) => atHand(ctx, fh, -1.25, g => {
      g.beginPath(); g.moveTo(-3, -8); g.lineTo(-7, len); g.quadraticCurveTo(0, len + 10, 9, len); g.lineTo(3, -8); g.closePath(); fillStroke(g, '#9a6a3a', 3);
      for (const [x, y] of [[-6, len - 6], [7, len - 9], [-2, len - 18]]) poly(g, [x - 3, y, x, y + (x < 0 ? -7 : 7) * 0, x + 3, y, x, y + 5], '#cfd3d8', 2);
    });
  }
  function spear(len) {
    return (ctx, p, fh) => atHand(ctx, fh, -1.4, g => {
      line(g, 0, -20, 0, len, 7.5, INK); line(g, 0, -20, 0, len, 4, col('#b07f45'));
      poly(g, [-5, len, 0, len + 16, 5, len], '#dfe6ee', 3);
    });
  }
  function staff(orb, glow) {
    return (ctx, p, fh) => {
      line(ctx, fh.x + 2, fh.y + 30, fh.x - 3, fh.y - 40, 8, INK); line(ctx, fh.x + 2, fh.y + 30, fh.x - 3, fh.y - 40, 4.5, col('#7a4a26'));
      const pulse = 1 + Math.sin((p.t || 0) * 6) * 0.08 + (p.windup || 0) * 0.35;
      if (glow) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gr = ctx.createRadialGradient(fh.x - 3, fh.y - 46, 1, fh.x - 3, fh.y - 46, 18 * pulse); gr.addColorStop(0, glow); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(fh.x - 3, fh.y - 46, 18 * pulse, 0, TAU); ctx.fill(); ctx.restore(); }
      circle(ctx, fh.x - 3, fh.y - 46, 7 * pulse, orb);
      hl(ctx, fh.x - 5, fh.y - 48, 2.5, 1.6, 0.8);
    };
  }
  // Arco: se sujeta con la mano delantera; tensa con la trasera
  function bowAt(ctx, fh, pull, nocked, wood) {
    const R = 26, cx = fh.x - R * 0.42;
    ctx.beginPath(); ctx.arc(cx, fh.y, R, -1.15, 1.15);
    ctx.lineCap = 'round'; ctx.lineWidth = 8.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 5; ctx.strokeStyle = col(wood || '#a8733f'); ctx.stroke();
    const tx = cx + Math.cos(1.15) * R, ty = Math.sin(1.15) * R;
    const sx = tx - pull * 17;
    ctx.beginPath(); ctx.moveTo(tx, fh.y - ty); ctx.lineTo(sx, fh.y); ctx.lineTo(tx, fh.y + ty);
    ctx.lineWidth = 1.6; ctx.strokeStyle = '#f2ead6'; ctx.stroke();
    if (nocked) {
      line(ctx, sx, fh.y, fh.x + 15, fh.y, 4.5, INK); line(ctx, sx, fh.y, fh.x + 15, fh.y, 2.3, col('#d9b27a'));
      poly(ctx, [fh.x + 13, fh.y - 3.5, fh.x + 22, fh.y, fh.x + 13, fh.y + 3.5], '#e3e8ef', 1.8);
    }
    return { x: sx, y: fh.y };
  }

  // ------------------------------------------------------------------ cabezas
  function eyes(ctx, x, y, r, color, angry, pupil) {
    oval(ctx, x + r * 0.32, y, r * 0.17, r * 0.2, color || '#fff', 0, 2.2);
    oval(ctx, x + r * 0.78, y - r * 0.02, r * 0.14, r * 0.18, color || '#fff', 0, 2.2);
    circle(ctx, x + r * 0.38, y + r * 0.03, r * 0.075, pupil || INK, 0);
    circle(ctx, x + r * 0.82, y + r * 0.02, r * 0.065, pupil || INK, 0);
    if (angry) {
      line(ctx, x + r * 0.08, y - r * 0.3, x + r * 0.52, y - r * 0.12, r * 0.14, INK);
      line(ctx, x + r * 0.62, y - r * 0.14, x + r * 1.0, y - r * 0.3, r * 0.12, INK);
    }
  }
  function goblinHead(skin, opt) {
    opt = opt || {};
    return (ctx, x, y, r, p) => {
      const ear = Math.sin((p.t || 0) * 3 + (p.seed || 0)) * 0.06;
      ctx.save(); ctx.translate(x - r * 0.55, y - r * 0.1); ctx.rotate(-0.35 + ear);
      poly(ctx, [0, -r * 0.25, -r * 1.25, -r * 0.55, 0, r * 0.35], skin);
      poly(ctx, [-r * 0.15, -r * 0.12, -r * 0.9, -r * 0.38, -r * 0.15, r * 0.15], '#e8a3a0', 0);
      ctx.restore();
      const head = () => { ctx.beginPath(); ctx.ellipse(x, y, r * 1.02, r * 0.92, 0, 0, TAU); };
      head(); fillStroke(ctx, skin, 0);
      shadeIn(ctx, head, shade(skin, -0.2), x - r * 1.1, y + r * 0.25, r * 2.2, r);
      head(); fillStroke(ctx, null);
      hl(ctx, x - r * 0.35, y - r * 0.5, r * 0.32, r * 0.16, 0.3);
      ctx.save(); ctx.translate(x + r * 0.55, y - r * 0.55); ctx.rotate(-0.5 - ear);
      poly(ctx, [0, -r * 0.1, r * 0.95, -r * 0.62, r * 0.3, r * 0.25], skin);
      ctx.restore();
      eyes(ctx, x, y - r * 0.12, r, opt.eye || '#fff6a8', true, '#2a1a10');
      oval(ctx, x + r * 1.0, y + r * 0.15, r * 0.26, r * 0.18, skin, 0.35);
      ctx.beginPath(); ctx.moveTo(x + r * 0.2, y + r * 0.42); ctx.quadraticCurveTo(x + r * 0.55, y + r * 0.82, x + r * 0.92, y + r * 0.45); ctx.closePath(); fillStroke(ctx, '#5a1b1b', 2.4);
      poly(ctx, [x + r * 0.33, y + r * 0.47, x + r * 0.41, y + r * 0.64, x + r * 0.49, y + r * 0.49], '#fff', 0);
      poly(ctx, [x + r * 0.62, y + r * 0.51, x + r * 0.7, y + r * 0.66, x + r * 0.78, y + r * 0.5], '#fff', 0);
      if (opt.hat) opt.hat(ctx, x, y, r, p);
    };
  }
  function orcHead(skin, opt) {
    opt = opt || {};
    return (ctx, x, y, r, p) => {
      poly(ctx, [x - r * 0.7, y - r * 0.05, x - r * 1.3, y - r * 0.45, x - r * 0.75, y + r * 0.32], skin);
      const head = () => {
        ctx.beginPath();
        ctx.arc(x, y - r * 0.05, r, Math.PI * 0.9, Math.PI * 2.1);
        ctx.quadraticCurveTo(x + r * 1.15, y + r * 0.9, x + r * 0.2, y + r * 0.95);
        ctx.quadraticCurveTo(x - r * 0.8, y + r * 0.9, x - r * 0.98, y + r * 0.26);
        ctx.closePath();
      };
      head(); fillStroke(ctx, skin, 0);
      shadeIn(ctx, head, shade(skin, -0.22), x - r * 1.2, y + r * 0.35, r * 2.4, r);
      head(); fillStroke(ctx, null);
      hl(ctx, x - r * 0.3, y - r * 0.5, r * 0.36, r * 0.18, 0.28);
      eyes(ctx, x, y - r * 0.08, r, opt.eye || '#ffe25a', true);
      oval(ctx, x + r * 0.66, y + r * 0.25, r * 0.16, r * 0.11, shade(skin, -0.3), 0, 0);
      line(ctx, x + r * 0.16, y + r * 0.62, x + r * 0.94, y + r * 0.56, r * 0.09, INK);
      poly(ctx, [x + r * 0.22, y + r * 0.64, x + r * 0.32, y + r * 0.2, x + r * 0.44, y + r * 0.62], '#fffbe6', 2);
      poly(ctx, [x + r * 0.72, y + r * 0.6, x + r * 0.81, y + r * 0.18, x + r * 0.92, y + r * 0.58], '#fffbe6', 2);
      if (opt.hat) opt.hat(ctx, x, y, r, p);
    };
  }
  function humanHead(skin, opt) {
    opt = opt || {};
    return (ctx, x, y, r, p) => {
      if (opt.hood) {
        ctx.beginPath(); ctx.moveTo(x - r * 1.0, y + r * 0.95);
        ctx.quadraticCurveTo(x - r * 1.55, y - r * 0.4, x - r * 0.55, y - r * 1.2);
        ctx.quadraticCurveTo(x + r * 0.6, y - r * 1.42, x + r * 1.15, y - r * 0.15);
        ctx.lineTo(x + r * 0.75, y + r * 0.95); ctx.closePath(); fillStroke(ctx, opt.hood);
      } else if (opt.hair) {
        oval(ctx, x - r * 0.25, y - r * 0.2, r * 1.05, r * 0.95, opt.hair);
        if (opt.pony) oval(ctx, x - r * 1.0, y + r * 0.3, r * 0.3, r * 0.6, opt.hair, 0.4);
      }
      const head = () => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); };
      head(); fillStroke(ctx, skin, 0);
      shadeIn(ctx, head, shade(skin, -0.14), x - r * 1.1, y + r * 0.35, r * 2.2, r);
      head(); fillStroke(ctx, null);
      oval(ctx, x - r * 0.42, y + r * 0.12, r * 0.14, r * 0.2, skin, 0, 2.2);
      eyes(ctx, x, y - r * 0.02, r, '#fff', false);
      oval(ctx, x + r * 0.95, y + r * 0.2, r * 0.12, r * 0.1, shade(skin, -0.18), 0, 0);
      oval(ctx, x + r * 0.6, y + r * 0.42, r * 0.15, r * 0.08, 'rgba(255,120,120,0.4)', 0, 0);
      line(ctx, x + r * 0.45, y + r * 0.6, x + r * 0.78, y + r * 0.56, r * 0.08, '#8a3b2b');
      if (opt.hair && !opt.hood) {
        ctx.beginPath(); ctx.arc(x, y - r * 0.05, r * 1.04, Math.PI * 1.0, Math.PI * 1.85);
        ctx.quadraticCurveTo(x + r * 0.2, y - r * 0.5, x - r * 0.95, y + r * 0.05); ctx.closePath(); fillStroke(ctx, opt.hair);
      }
      if (opt.hood) {
        ctx.beginPath(); ctx.arc(x, y - r * 0.02, r * 1.0, Math.PI * 1.05, Math.PI * 1.9);
        ctx.lineCap = 'round'; ctx.lineWidth = r * 0.45; ctx.strokeStyle = INK; ctx.stroke();
        ctx.lineWidth = r * 0.33; ctx.strokeStyle = col(opt.hood); ctx.stroke();
      }
      if (opt.hat) opt.hat(ctx, x, y, r, p);
    };
  }
  // sombreros / cascos
  function ironCap(color) {
    return (ctx, x, y, r) => {
      ctx.beginPath(); ctx.arc(x, y - r * 0.1, r * 1.08, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); fillStroke(ctx, color || '#8d96a3');
      poly(ctx, [x - r * 1.12, y - r * 0.24, x + r * 1.12, y - r * 0.24, x + r * 1.12, y - r * 0.02, x - r * 1.12, y - r * 0.02], shade(color || '#8d96a3', -0.25), 3);
      poly(ctx, [x + r * 0.42, y - r * 0.2, x + r * 0.56, y - r * 0.2, x + r * 0.56, y + r * 0.35, x + r * 0.42, y + r * 0.35], shade(color || '#8d96a3', -0.25), 2.5);
      hl(ctx, x - r * 0.25, y - r * 0.78, r * 0.38, r * 0.13, 0.45);
    };
  }
  function bandana(color) {
    return (ctx, x, y, r) => {
      ctx.beginPath(); ctx.arc(x, y - r * 0.05, r * 1.03, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); fillStroke(ctx, color);
      poly(ctx, [x - r * 0.95, y - r * 0.35, x - r * 1.5, y - r * 0.05, x - r * 1.32, y + r * 0.25, x - r * 0.85, y - r * 0.05], color);
      circle(ctx, x + r * 0.2, y - r * 0.62, r * 0.09, '#fff', 0);
    };
  }

  // ------------------------------------------------------------------ catálogo de personajes
  const SK = { goblin: '#8fce45', orc: '#6eae3e', human: '#f3c79d', troll: '#7f9db3' };
  const R = {};

  // Goblin Saltarín
  R.enemy_goblin_veloz = (ctx, p) => humanoid(ctx, p, {
    bulk: 0.85, leg: 0.8, lean: 2.2, skin: SK.goblin, cloth: '#8a5f34', pants: '#6b4a2b', boots: '#3f2a16', belt: '#4a2e16',
    headR: 19, head: goblinHead(SK.goblin, { hat: bandana('#c0392b') }), weapon: dagger(), slashR: 26,
    torsoDeco: (ctx, p, o) => { for (let i = -2; i <= 2; i++) poly(ctx, [o.hipX + i * 7 - 3, o.hipY + 4, o.hipX + i * 7, o.hipY + 11, o.hipX + i * 7 + 3, o.hipY + 4], '#8a5f34', 0); },
  });

  // Orco Escudero
  R.enemy_orco_escudo = (ctx, p) => humanoid(ctx, p, {
    bulk: 1.15, skin: SK.orc, cloth: '#7d8794', pants: '#5b4532', boots: '#3e2a1a', belt: '#4a2e16', headR: 17,
    head: orcHead(SK.orc, { hat: ironCap('#8d96a3') }), weapon: sword(30),
    torsoDeco: (ctx, p, o) => { ctx.fillStyle = col('#a8423a'); ctx.fillRect(o.hipX - 4, o.shY - 6, 9, 60); for (let r = 0; r < 5; r++) line(ctx, o.hipX - 20, o.shY + r * 6, o.hipX + 20, o.shY + r * 6, 1.2, 'rgba(0,0,0,0.25)'); },
    mid: (ctx, p, o) => {
      // escudo redondo delante del cuerpo (lo lleva el brazo trasero)
      const x = o.shX + 4, y = (o.hipY + o.shY) / 2 + 2, r = 19 * o.B;
      circle(ctx, x, y, r, '#a8733f');
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
      for (let i = -2; i <= 2; i++) line(ctx, x + i * r * 0.42, y - r, x + i * r * 0.42, y + r, 1.6, col('#6f4723'));
      ctx.restore();
      ctx.beginPath(); ctx.arc(x, y, r * 0.93, 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = col('#8a93a1'); ctx.stroke();
      circle(ctx, x, y, r * 0.3, '#c9d0d8', 3);
      hl(ctx, x - r * 0.4, y - r * 0.45, r * 0.25, r * 0.12, 0.4);
    },
  });

  // Arquera (héroe)
  R.hero_arquera = (ctx, p) => archerBody(ctx, p, { hood: '#3f8a35', cloth: '#5f8a3c', pants: '#5a4a3a', hair: '#e07a35', cape: '#2f6f2a' });
  // Arquero reclutado (tropa)
  R.troop_arquero = (ctx, p) => archerBody(ctx, p, { hood: '#3a6fd0', cloth: '#7a5a3a', pants: '#4b4f5c', hair: '#6b4024' });

  function archerBody(ctx, p, o) {
    const pull = p.windup || 0;
    humanoid(ctx, p, {
      skin: SK.human, cloth: o.cloth, pants: o.pants, boots: '#4a2e16', belt: '#5c3a1a', headR: 16.5,
      head: humanHead(SK.human, { hood: o.hood, hair: o.hair, pony: true }),
      back: (ctx, p, b) => {
        if (o.cape) {
          const sway = Math.sin((p.t || 0) * 3) * 2 + (p.moving ? 5 : 0);
          poly(ctx, [b.shX - 10, b.shY, b.shX + 6, b.shY, b.shX - 8 - sway, b.hipY + 18, b.shX - 26 - sway * 1.6, b.hipY + 12], o.cape);
        }
        ctx.save(); ctx.translate(b.shX - 12, b.shY + 6); ctx.rotate(-0.45);
        for (let i = 0; i < 3; i++) { line(ctx, -3 + i * 3, 0, -3 + i * 3, -16, 1.6, col('#d9b27a')); poly(ctx, [-5 + i * 3, -14, -3 + i * 3, -21, -1 + i * 3, -14], '#e8463c', 1); }
        poly(ctx, [-6, -2, 6, -2, 5, 28, -5, 28], '#8f5d2e', 3);
        ctx.restore();
      },
      frontArm: (p2) => ({ a1: 1.5 - (p2.strike || 0) * 0.08, a2: 0.04 }),
      backArm: () => ({ a1: 0.55 + pull * 0.78, a2: -0.45 * (1 - pull) }),
      weapon: (ctx, p2, fh) => bowAt(ctx, fh, pull, pull > 0.05 || (p2.strike || 0) < 0.1, '#a8733f'),
      slash: false,
    });
  }

  // ------------------------------------------------------------------ medidas y retratos
  const boundsCache = {}, imgCache = {};
  const REST = { t: 0.4, moving: false, windup: 0, strike: 0 };
  function measure(key) {
    if (boundsCache[key]) return boundsCache[key];
    let b = { x0: -40, x1: 40, y0: -100, y1: 0, h: 100 };
    try {
      const c = document.createElement('canvas'); c.width = 600; c.height = 600;
      const g = c.getContext('2d');
      g.translate(300, 420);
      R[key](g, REST);
      const d = g.getImageData(0, 0, 600, 600).data;
      let x0 = 600, x1 = -1, y0 = 600, y1 = -1;
      for (let y = 0; y < 600; y += 2) for (let x = 0; x < 600; x += 2) {
        if (d[(y * 600 + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 > x0) b = { x0: x0 - 300, x1: x1 - 300, y0: y0 - 420, y1: y1 - 420, h: Math.max(20, Math.min(420, 420 - y0)) };
    } catch (err) { /* sin canvas: valores por defecto */ }
    boundsCache[key] = b;
    return b;
  }
  // Imagen recortada del personaje (para la interfaz: retratos, tienda, presentaciones)
  function image(key, h) {
    h = h || 256;
    const ck = key + '|' + h;
    if (imgCache[ck]) return imgCache[ck];
    const b = measure(key);
    const s = h / (b.y1 - b.y0 + 8);
    const c = document.createElement('canvas');
    c.width = Math.max(8, Math.round((b.x1 - b.x0 + 8) * s)); c.height = h;
    const g = c.getContext('2d');
    g.scale(s, s); g.translate(-b.x0 + 4, -b.y0 + 4);
    R[key](g, REST);
    c.naturalWidth = c.width; c.naturalHeight = c.height;
    imgCache[ck] = c;
    return c;
  }

  // ------------------------------------------------------------------ API
  BB.rig = {
    has(key) { return !!R[key]; },
    keys() { return Object.keys(R); },
    measure, image,
    // Factor para que la altura dibujada coincida con `size` (los dibujos miden distinto)
    norm(key) { return 100 / measure(key).h; },
    // Dibuja el personaje con los pies en (x, y) y alto `size` (unidades del mundo). face: 1 derecha, -1 izquierda
    draw(ctx, key, x, y, size, face, pose) {
      const fn = R[key];
      if (!fn) return false;
      const s = size / 100;
      FLASH = Math.max(0, Math.min(1, pose.flash || 0));
      FROZEN = !!pose.frozen;
      ctx.save();
      ctx.translate(x, y);
      if (pose.rot) ctx.rotate(pose.rot);
      ctx.scale(s * face * (pose.sx || 1), s * (pose.sy || 1));
      if (pose.alpha != null) ctx.globalAlpha = pose.alpha;
      try { fn(ctx, pose); } catch (err) { console.error('[rig ' + key + ']', err); }
      ctx.restore();
      FLASH = 0; FROZEN = false;
      return true;
    },
    register(key, fn) { R[key] = fn; },
    kit: { humanoid, humanHead, orcHead, goblinHead, ironCap, bandana, sword, dagger, axe, club, spear, staff, bowAt, circle, oval, poly, line, bone, hl, shade, col, INK, SK, smooth },
  };
})();
