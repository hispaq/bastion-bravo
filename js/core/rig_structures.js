/* Bastión Bravo · torres y trampas dibujadas (estilo dibujo animado). Base en (0,0), 100 unidades de alto.
   pose: { t, windup, strike, hit } */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const K = BB.rig.kit;
  const { circle, oval, poly, line, bone, hl, col, INK } = K;
  const TAU = Math.PI * 2;
  const reg = BB.rig.register;
  const wood = '#a8733f', woodD = '#7b4e26', woodL = '#c99a5f', stone = '#a7a49c', stoneD = '#7d7a73', iron = '#7d8590';

  function plank(ctx, x, y, w, h, c) { poly(ctx, [x, y, x + w, y, x + w, y + h, x, y + h], c || wood, 3); line(ctx, x + 3, y + h * 0.5, x + w - 3, y + h * 0.5, 1.5, 'rgba(0,0,0,0.25)'); }
  function stones(ctx, x, y, w, h) {
    poly(ctx, [x, y, x + w, y, x + w, y + h, x, y + h], stone, 3.5);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    for (let r = 0; r * 12 < h; r++) for (let c = -1; c * 22 < w; c++) {
      const bx = x + c * 22 + (r % 2) * 11, by = y + r * 12;
      ctx.beginPath(); ctx.rect(bx + 1, by + 1, 20, 10); ctx.lineWidth = 1.5; ctx.strokeStyle = col(stoneD); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(bx + 3, by + 2, 15, 2);
    }
    ctx.restore();
  }
  function glow(ctx, x, y, r, rgba) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
  }

  // Trampa de pinchos (baja): tablón con pinchos que asoman y se esconden
  reg('tower_pinchos', (ctx, p) => {
    const up = 0.75 + Math.sin((p.t || 0) * 3) * 0.1 + (p.strike || 0) * 0.3;
    plank(ctx, -50, -10, 100, 10, woodD);
    for (let i = 0; i < 8; i++) {
      const x = -44 + i * 12.5, h = 22 * up;
      poly(ctx, [x - 5, -10, x, -10 - h, x + 5, -10], '#dfe6ee', 2.5);
      line(ctx, x - 1, -12, x - 1, -8 - h * 0.8, 1.2, 'rgba(255,255,255,0.8)');
    }
    for (const x of [-46, 46]) circle(ctx, x, -5, 3, iron, 1.5);
  });

  // Catapulta: el brazo se carga hacia atrás y lanza hacia delante (a la izquierda, hacia los enemigos)
  reg('tower_catapulta', (ctx, p) => {
    const w = p.windup || 0, s = p.strike || 0;
    for (const x of [-30, 30]) { circle(ctx, x, -14, 14, woodD); circle(ctx, x, -14, 5, iron, 2); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4; line(ctx, x - Math.cos(a) * 10, -14 - Math.sin(a) * 10, x + Math.cos(a) * 10, -14 + Math.sin(a) * 10, 2.5, INK); } }
    plank(ctx, -48, -32, 96, 10, wood);
    poly(ctx, [-6, -32, 4, -78, 12, -78, 16, -32], woodD, 3);
    poly(ctx, [24, -32, 10, -78, 2, -78, 34, -32], woodD, 3);
    plank(ctx, -4, -84, 22, 8, woodL);
    // brazo: en reposo apunta atrás-abajo (+x), al disparar gira hacia delante-arriba (-x)
    const ang = 0.35 + w * 0.35 - s * 2.3;
    const px = 8, py = -60, L = 62;
    const ex = px + Math.cos(ang) * L, ey = py + Math.sin(ang) * L;
    bone(ctx, px - Math.cos(ang) * 14, py - Math.sin(ang) * 14, ex, ey, 7, woodL);
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang + Math.PI / 2);
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI); ctx.closePath(); ctx.fillStyle = col(woodD); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    if (s < 0.3) { circle(ctx, 0, 4, 9, '#9a9ea6', 2.5); hl(ctx, -3, 1, 3, 2, 0.4); }
    ctx.restore();
    circle(ctx, px, py, 5, iron, 2);
    // banderín
    line(ctx, 40, -32, 40, -92, 5, INK); line(ctx, 40, -32, 40, -92, 2.5, col('#8a6a44'));
    const wv = Math.sin((p.t || 0) * 5) * 3;
    poly(ctx, [40, -92, 62, -86 + wv, 40, -78], '#3a6fd0', 2.5);
  });

  // Torre de rayos: torre de piedra con un cristal que flota y chisporrotea
  reg('tower_rayos', (ctx, p) => {
    const t = p.t || 0, w = (p.windup || 0) + (p.strike || 0);
    stones(ctx, -22, -78, 44, 78);
    poly(ctx, [-30, -78, 30, -78, 26, -90, -26, -90], stoneD, 3);
    for (let i = 0; i < 3; i++) poly(ctx, [-26 + i * 21, -90, -26 + i * 21, -100, -14 + i * 21, -100, -14 + i * 21, -90], stone, 2.5);
    const cy = -128 + Math.sin(t * 2.4) * 5;
    glow(ctx, 0, cy, 34 + w * 22, 'rgba(120,210,255,0.8)');
    poly(ctx, [0, cy - 22, 12, cy, 0, cy + 22, -12, cy], '#8fe0ff', 3);
    poly(ctx, [0, cy - 22, 4, cy, 0, cy + 22], '#e8fbff', 0);
    if (w > 0.2 || Math.sin(t * 9) > 0.7) {
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(10, cy - 14); ctx.lineTo(4, cy - 20); ctx.lineTo(16, cy - 32);
      ctx.moveTo(0, cy); ctx.lineTo(-12, cy + 10); ctx.lineTo(-6, cy + 16); ctx.lineTo(-18, cy + 26);
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#e8fbff'; ctx.stroke();
    }
  });

  // Torre de flechas: torre de madera con una balista que se tensa
  reg('tower_flechas', (ctx, p) => {
    const w = p.windup || 0, s = p.strike || 0;
    for (const x of [-24, 18]) poly(ctx, [x, 0, x + 6, 0, x + 6, -70, x, -70], woodD, 3);
    for (let i = 0; i < 3; i++) { line(ctx, -21, -10 - i * 20, 21, -26 - i * 20, 5, INK); line(ctx, -21, -10 - i * 20, 21, -26 - i * 20, 2.5, col(wood)); }
    plank(ctx, -34, -82, 68, 12, wood);
    for (let i = 0; i < 5; i++) poly(ctx, [-34 + i * 14, -82, -34 + i * 14, -96, -24 + i * 14, -96, -24 + i * 14, -82], woodL, 2.5);
    // balista mirando a la derecha (el renderizador la voltea hacia los enemigos)
    ctx.save(); ctx.translate(0, -104);
    poly(ctx, [-20, -4, 24, -4, 24, 4, -20, 4], woodD, 2.5);
    ctx.beginPath(); ctx.moveTo(16, -22); ctx.quadraticCurveTo(26, 0, 16, 22); ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = col(woodL); ctx.stroke();
    const sx = 16 - 18 * w;
    ctx.beginPath(); ctx.moveTo(16, -22); ctx.lineTo(sx, 0); ctx.lineTo(16, 22); ctx.lineWidth = 1.6; ctx.strokeStyle = '#efe6cf'; ctx.stroke();
    if (s < 0.3) { line(ctx, sx, 0, 34, 0, 5, INK); line(ctx, sx, 0, 34, 0, 2.5, col('#d9b27a')); poly(ctx, [32, -4, 42, 0, 32, 4], '#dfe6ee', 2); }
    ctx.restore();
  });

  // Pozo de brea: charco negro que burbujea
  reg('tower_brea', (ctx, p) => {
    const t = p.t || 0;
    plank(ctx, -54, -12, 12, 12, woodD); plank(ctx, 42, -12, 12, 12, woodD);
    oval(ctx, 0, -6, 48, 10, '#1b1612', 0, 3.5);
    oval(ctx, -8, -9, 30, 4, 'rgba(255,255,255,0.12)', 0, 0);
    for (let i = 0; i < 4; i++) { const k = ((t * 0.7 + i / 4) % 1); const x = -30 + i * 20; circle(ctx, x, -8 - k * 6, 2 + k * 4, 'rgba(60,50,45,' + (1 - k).toFixed(2) + ')', 0); }
  });

  // Barricada: estacas afiladas cruzadas y atadas
  reg('tower_barricada', (ctx, p) => {
    const sh = (p.hit || 0) * (Math.random() - 0.5) * 3;
    ctx.save(); ctx.translate(sh, 0);
    for (let i = 0; i < 5; i++) {
      const x = -44 + i * 22, a = i % 2 ? 0.45 : -0.45;
      ctx.save(); ctx.translate(x, -4); ctx.rotate(a);
      poly(ctx, [-5, 0, -5, -62, 0, -76, 5, -62, 5, 0], i % 2 ? wood : woodL, 3);
      ctx.restore();
    }
    plank(ctx, -56, -36, 112, 8, woodD);
    for (const x of [-34, 0, 34]) { line(ctx, x - 4, -40, x + 4, -26, 3, col('#d8c08a')); line(ctx, x + 4, -40, x - 4, -26, 3, col('#d8c08a')); }
    ctx.restore();
  });
})();
