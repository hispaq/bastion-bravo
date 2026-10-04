/* Bastión Bravo · héroes y tropas dibujados por piezas (estilo dibujo animado). Ver rig.js.
   Todos se dibujan mirando a la derecha; el renderizador los voltea (miran a los enemigos). */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const K = BB.rig.kit;
  const { humanoid, humanHead, orcHead, ironCap, sword, axe, staff, bowAt, circle, oval, poly, line, bone, hl, shade, col, INK, SK } = K;
  const TAU = Math.PI * 2;
  const reg = BB.rig.register;

  // ------------------------------------------------------------------ piezas
  function wizardHat(color, band, star) {
    return (ctx, x, y, r) => {
      ctx.beginPath(); ctx.moveTo(x - r * 0.9, y - r * 0.45);
      ctx.quadraticCurveTo(x - r * 0.3, y - r * 1.6, x - r * 1.05, y - r * 2.55);
      ctx.quadraticCurveTo(x + r * 0.35, y - r * 1.7, x + r * 0.9, y - r * 0.45); ctx.closePath();
      ctx.fillStyle = col(color); ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
      oval(ctx, x, y - r * 0.45, r * 1.42, r * 0.3, shade(color, -0.25));
      if (band) poly(ctx, [x - r * 0.82, y - r * 0.82, x + r * 0.82, y - r * 0.82, x + r * 0.86, y - r * 0.6, x - r * 0.86, y - r * 0.6], band, 2);
      if (star) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.12 : r * 0.26; const a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(x - r * 0.2 + Math.cos(a) * rr, y - r * 1.3 + Math.sin(a) * rr); } ctx.closePath(); ctx.fillStyle = col(star); ctx.fill(); }
    };
  }
  function beard(color, long) {
    return (ctx, x, y, r) => {
      ctx.beginPath(); ctx.moveTo(x - r * 0.4, y + r * 0.15);
      ctx.quadraticCurveTo(x - r * 0.3, y + r * (long ? 1.7 : 1.25), x + r * 0.45, y + r * (long ? 1.8 : 1.3));
      ctx.quadraticCurveTo(x + r * 1.05, y + r * 1.05, x + r * 1.0, y + r * 0.28);
      ctx.quadraticCurveTo(x + r * 0.6, y + r * 0.55, x + r * 0.35, y + r * 0.42); ctx.quadraticCurveTo(x, y + r * 0.5, x - r * 0.4, y + r * 0.15);
      ctx.closePath(); ctx.fillStyle = col(color); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      line(ctx, x + r * 0.32, y + r * 0.46, x + r * 0.82, y + r * 0.42, r * 0.11, col(shade(color, -0.3)));
    };
  }
  const both = (...fns) => (ctx, x, y, r, p) => { for (const f of fns) if (f) f(ctx, x, y, r, p); };
  function crossbowAt(ctx, fh, loaded, recoil, metal) {
    ctx.save(); ctx.translate(fh.x - recoil * 5, fh.y);
    poly(ctx, [-22, -3.5, 22, -3.5, 22, 3.5, -22, 3.5], '#6f4723', 2.5);
    ctx.beginPath(); ctx.moveTo(16, -18); ctx.quadraticCurveTo(9, 0, 16, 18); ctx.lineWidth = 6.5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3.5; ctx.strokeStyle = col(metal || '#9aa3ad'); ctx.stroke();
    const sx = loaded ? -5 : 9;
    ctx.beginPath(); ctx.moveTo(16, -18); ctx.lineTo(sx, 0); ctx.lineTo(16, 18); ctx.lineWidth = 1.4; ctx.strokeStyle = '#efe6cf'; ctx.stroke();
    if (loaded) { line(ctx, sx, -1, 26, -1, 4, INK); line(ctx, sx, -1, 26, -1, 2, col('#d9b27a')); poly(ctx, [25, -4, 32, -1, 25, 2], '#e3e8ef', 1.5); }
    ctx.restore();
  }
  function gunAt(ctx, fh, recoil, len, wood, metal) {
    ctx.save(); ctx.translate(fh.x - recoil * 7, fh.y);
    poly(ctx, [-18, -2, 4, -4, 4, 5, -20, 7], wood || '#7a4a26', 2.5);
    poly(ctx, [2, -4, len, -3, len, 2, 2, 3], metal || '#5d6470', 2.5);
    circle(ctx, len, -0.5, 3.2, metal || '#5d6470', 2);
    if (recoil > 0.6) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; circle(ctx, len + 10, -0.5, 9 * recoil, 'rgba(255,200,90,0.8)', 0); ctx.restore(); }
    ctx.restore();
  }
  function book(ctx, x, y, c) {
    poly(ctx, [x - 12, y - 8, x + 12, y - 10, x + 12, y + 6, x - 12, y + 8], c || '#8a2b2b', 2.5);
    poly(ctx, [x - 10, y - 6, x, y - 7, x, y + 5, x - 10, y + 6], '#f6ecd6', 1.5);
    poly(ctx, [x, y - 7, x + 10, y - 8, x + 10, y + 4, x, y + 5], '#fff8e6', 1.5);
  }
  function glowOrb(ctx, x, y, r, inner, glow, t) {
    const pulse = 1 + Math.sin((t || 0) * 6) * 0.1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 1, x, y, r * 2.4 * pulse); g.addColorStop(0, glow); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.4 * pulse, 0, TAU); ctx.fill(); ctx.restore();
    circle(ctx, x, y, r * pulse, inner, 2.2); hl(ctx, x - r * 0.3, y - r * 0.35, r * 0.3, r * 0.2, 0.85);
  }
  function capeBack(color) {
    return (ctx, p, b) => { const sway = Math.sin((p.t || 0) * 3) * 2; poly(ctx, [b.shX - 10, b.shY, b.shX + 6, b.shY, b.shX - 6 - sway, b.hipY + 22, b.shX - 26 - sway * 1.6, b.hipY + 16], color); };
  }
  function robeDeco(trim) {
    return (ctx, p, o) => { ctx.fillStyle = col(trim); ctx.fillRect(o.hipX - 3, o.shY - 4, 7, 70); };
  }
  // Brazo de lanzamiento genérico (sube hacia atrás y lanza hacia delante)
  const throwArm = (p, s) => ({ a1: 1.9 - (p.windup || 0) * 3.3 + (p.strike || 0) * 1.6 - s.sw * 0.2, a2: -0.5 });
  const castArm = (p, s) => ({ a1: 2.0 - (p.windup || 0) * 1.1 - (p.strike || 0) * 0.35, a2: -0.55 });
  const aimArm = () => ({ a1: 1.5, a2: 0.04 });
  const supportArm = (dx) => (p) => ({ a1: 1.25 + (dx || 0), a2: -0.15 });
  const skinH = SK.human, skinD = '#c98d5f', skinP = '#f6d6b8';
  const dwarf = (o) => Object.assign({ bulk: 1.15, leg: 0.68, legW: 1.1, torsoW: 1.15, headR: 17 }, o);

  // ------------------------------------------------------------------ héroes
  reg('hero_mago_fuego', (ctx, p) => humanoid(ctx, p, {
    skin: skinH, cloth: '#b8322a', pants: '#7a1f1a', boots: '#3e2a1a', belt: '#ffd34a', headR: 16.5, slash: false,
    head: humanHead(skinH, { hat: both(beard('#e9e3d6', true), wizardHat('#c0392b', '#ffd34a', '#ffd34a')) }),
    torsoDeco: robeDeco('#ff9a3d'), frontArm: castArm,
    weapon: staff('#ff8a2a', 'rgba(255,150,40,0.9)'),
  }));
  reg('hero_maga_hielo', (ctx, p) => humanoid(ctx, p, {
    skin: skinP, cloth: '#7fc6ee', pants: '#4f8fc0', boots: '#2f5f8a', belt: '#e9fbff', headR: 16.5, slash: false,
    head: humanHead(skinP, { hood: '#5aa8dc', hair: '#e9f6ff' }), back: capeBack('#9fd8f6'),
    torsoDeco: robeDeco('#ffffff'), frontArm: castArm,
    weapon: staff('#bff0ff', 'rgba(150,230,255,0.9)'),
  }));
  reg('hero_ballestero', (ctx, p) => humanoid(ctx, p, {
    skin: skinH, cloth: '#9aa3ad', pants: '#4b4f5c', boots: '#3e2a1a', belt: '#5c3a1a', headR: 16, slash: false, bulk: 1.08,
    head: humanHead(skinH, { hair: '#6b4024', hat: (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y - r * 0.25, r * 0.95, Math.PI, 0); ctx.closePath(); ctx.fillStyle = col('#c9d0d8'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); oval(ctx, x, y - r * 0.25, r * 1.5, r * 0.28, '#8a93a1'); } }),
    torsoDeco: (ctx, p, o) => { ctx.fillStyle = col('#3a6fd0'); ctx.fillRect(o.hipX - 6, o.shY - 2, 13, 60); },
    frontArm: aimArm, backArm: supportArm(-0.2),
    weapon: (ctx, p, fh) => crossbowAt(ctx, fh, (p.strike || 0) < 0.3, p.strike || 0),
  }));
  reg('hero_sacerdote', (ctx, p) => humanoid(ctx, p, {
    skin: skinH, cloth: '#f6f1e4', pants: '#d8cdb4', boots: '#8a6a44', belt: '#ffd34a', headR: 16.5, slash: false,
    head: humanHead(skinH, { hat: beard('#efe9df', true) }),
    torsoDeco: (ctx, p, o) => { ctx.fillStyle = col('#ffd34a'); ctx.fillRect(o.hipX - 4, o.shY - 2, 9, 70); ctx.fillRect(o.hipX - 11, o.shY + 12, 23, 7); },
    frontArm: (p) => ({ a1: 1.7 - (p.windup || 0) * 0.6, a2: -1.1 }),
    weapon: (ctx, p, fh) => { book(ctx, fh.x + 6, fh.y - 4); if ((p.windup || 0) > 0.2 || (p.strike || 0) > 0) glowOrb(ctx, fh.x + 6, fh.y - 22, 5, '#fff6c0', 'rgba(255,230,120,0.8)', p.t); },
  }));
  reg('hero_ingeniero', (ctx, p) => {
    // cañoncito a su lado
    const rec = (p.strike || 0);
    ctx.save(); ctx.translate(30 - rec * 6, 0);
    circle(ctx, -10, -12, 12, '#7a4a26', 3); circle(ctx, -10, -12, 4, '#5d6470', 2);
    poly(ctx, [-24, -20, 4, -26, 28, -30, 30, -18, 6, -14, -22, -12], '#c9973a', 3);
    circle(ctx, 30, -24, 6, '#3a3c42', 2.5);
    if (rec > 0.5) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; circle(ctx, 42, -26, 14 * rec, 'rgba(255,190,90,0.85)', 0); ctx.restore(); }
    ctx.restore();
    ctx.save(); ctx.translate(-12, 0);
    humanoid(ctx, p, dwarf({
      skin: skinH, cloth: '#8a5a30', pants: '#4b4f5c', boots: '#3e2a1a', belt: '#5c3a1a', slash: false,
      head: humanHead(skinH, { hat: both(beard('#b85a22'), (ctx, x, y, r) => { line(ctx, x - r, y - r * 0.45, x + r, y - r * 0.5, r * 0.22, INK); circle(ctx, x + r * 0.35, y - r * 0.48, r * 0.24, '#c38f10', 2); circle(ctx, x + r * 0.35, y - r * 0.48, r * 0.14, '#9be3ff', 0); ctx.beginPath(); ctx.arc(x, y - r * 0.2, r, Math.PI * 1.05, Math.PI * 1.95); ctx.lineWidth = r * 0.3; ctx.strokeStyle = col('#3a6fd0'); ctx.stroke(); }) }),
      frontArm: (p) => ({ a1: 1.9 - (p.windup || 0) * 0.5, a2: 0.4 }),
      weapon: (ctx, p, fh) => { line(ctx, fh.x, fh.y, fh.x + 12, fh.y - 14, 6, INK); line(ctx, fh.x, fh.y, fh.x + 12, fh.y - 14, 3, col('#7a4a26')); if ((p.windup || 0) > 0.6) circle(ctx, fh.x + 13, fh.y - 16, 3.5, '#ffb03a', 0); },
    }));
    ctx.restore();
  });
  reg('hero_hechicera_rayo', (ctx, p) => humanoid(ctx, p, {
    skin: skinP, cloth: '#7a3fc0', pants: '#4a2a80', boots: '#2a1a40', belt: '#ffd34a', headR: 16.5, slash: false,
    head: humanHead(skinP, { hair: '#f2f2ff', pony: true }), back: capeBack('#5a2a9a'),
    torsoDeco: robeDeco('#b98cff'), frontArm: castArm,
    backArm: (p) => ({ a1: 1.2 - (p.windup || 0) * 0.9, a2: -0.5 }),
    weapon: (ctx, p, fh) => { const w = (p.windup || 0) + (p.strike || 0); glowOrb(ctx, fh.x + 6, fh.y - 4, 4 + w * 3, '#e8fbff', 'rgba(120,200,255,0.9)', p.t); if (w > 0.2) { ctx.beginPath(); ctx.moveTo(fh.x + 6, fh.y - 4); for (let i = 1; i < 5; i++) ctx.lineTo(fh.x + 6 + i * 6, fh.y - 4 + (i % 2 ? -7 : 7)); ctx.lineWidth = 2.5; ctx.strokeStyle = '#bfefff'; ctx.stroke(); } },
  }));
  reg('hero_druida', (ctx, p) => humanoid(ctx, p, {
    skin: skinH, cloth: '#4f8a3a', pants: '#5a4030', boots: '#3e2a1a', belt: '#8a5a30', headR: 16.5, slash: false,
    head: humanHead(skinH, { hat: both(beard('#e7e2d6', true), (ctx, x, y, r) => { for (const s of [-1, 1]) { const bx = x + s * r * 0.5; line(ctx, bx, y - r * 0.8, bx + s * r * 0.5, y - r * 1.8, 6, INK); line(ctx, bx, y - r * 0.8, bx + s * r * 0.5, y - r * 1.8, 3.5, col('#9a6a3a')); line(ctx, bx + s * r * 0.25, y - r * 1.3, bx + s * r * 0.85, y - r * 1.45, 5, INK); line(ctx, bx + s * r * 0.25, y - r * 1.3, bx + s * r * 0.85, y - r * 1.45, 2.8, col('#9a6a3a')); } }) }),
    back: capeBack('#3f7a2a'), frontArm: castArm,
    weapon: (ctx, p, fh) => { staff('#8fe06a', 'rgba(140,240,100,0.7)')(ctx, p, fh); for (let i = 0; i < 3; i++) oval(ctx, fh.x - 6 + i * 4, fh.y - 30 + i * 10, 5, 3, '#5fb83a', 0.6, 1.5); },
  }));
  reg('hero_alquimista', (ctx, p) => humanoid(ctx, p, {
    skin: skinH, cloth: '#6b5a3a', pants: '#4b3a28', boots: '#3e2a1a', belt: '#5c3a1a', headR: 16.5, slash: false,
    head: humanHead(skinH, { hair: '#d9773a', hat: (ctx, x, y, r) => { line(ctx, x - r, y - r * 0.4, x + r, y - r * 0.45, r * 0.2, INK); circle(ctx, x + r * 0.32, y - r * 0.44, r * 0.22, '#c38f10', 2); circle(ctx, x + r * 0.32, y - r * 0.44, r * 0.13, '#b8ff9a', 0); } }),
    torsoDeco: (ctx, p, o) => { ctx.fillStyle = col('#c9b48a'); ctx.fillRect(o.hipX - 14, o.shY + 8, 28, 50); for (let i = 0; i < 3; i++) { circle(ctx, o.hipX - 8 + i * 8, o.hipY - 6, 3.4, ['#7ddb4a', '#ff6a6a', '#6ab8ff'][i], 1.5); } },
    frontArm: throwArm,
    weapon: (ctx, p, fh) => { if ((p.strike || 0) < 0.4) { circle(ctx, fh.x + 2, fh.y - 6, 7, '#7ddb4a', 2.5); poly(ctx, [fh.x - 2, fh.y - 18, fh.x + 6, fh.y - 18, fh.x + 5, fh.y - 12, fh.x - 1, fh.y - 12], '#d9d2c5', 2); hl(ctx, fh.x, fh.y - 8, 2, 1.5, 0.8); } },
  }));
  reg('hero_martillo', (ctx, p) => humanoid(ctx, p, dwarf({
    skin: skinH, cloth: '#8a3a2a', pants: '#4b4f5c', boots: '#3e2a1a', belt: '#5c3a1a', slashR: 30,
    head: humanHead(skinH, { hat: both(beard('#c0561a', true), ironCap('#9aa3ad')) }),
    torsoDeco: (ctx, p, o) => { ctx.fillStyle = col('#9aa3ad'); ctx.fillRect(o.hipX - 22, o.shY - 2, 44, 12); },
    frontArm: throwArm,
    weapon: (ctx, p, fh) => { if ((p.strike || 0) < 0.4) { ctx.save(); ctx.translate(fh.x, fh.y); ctx.rotate(-fh.ang - 1.2); line(ctx, 0, -6, 0, 22, 6, INK); line(ctx, 0, -6, 0, 22, 3.2, col('#8a5a30')); poly(ctx, [-10, 18, 10, 18, 10, 32, -10, 32], '#9aa3ad', 3); ctx.restore(); } },
  })));
  reg('hero_bardo', (ctx, p) => humanoid(ctx, p, {
    skin: skinH, cloth: '#2e8a8a', pants: '#a8423a', boots: '#3e2a1a', belt: '#ffd34a', headR: 16.5, slash: false,
    head: humanHead(skinH, { hair: '#6b4024', hat: (ctx, x, y, r, p) => { oval(ctx, x, y - r * 0.5, r * 1.4, r * 0.35, '#a8423a'); ctx.beginPath(); ctx.arc(x, y - r * 0.55, r * 0.85, Math.PI, 0); ctx.closePath(); ctx.fillStyle = col('#a8423a'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.save(); ctx.translate(x - r * 0.6, y - r * 1.1); ctx.rotate(-0.7 + Math.sin((p.t || 0) * 4) * 0.1); oval(ctx, 0, -r * 0.6, r * 0.18, r * 0.75, '#ffd34a', 0, 2); ctx.restore(); } }),
    frontArm: (p) => ({ a1: 1.45 + Math.sin((p.t || 0) * 10) * 0.12, a2: -0.6 }),
    backArm: (p) => ({ a1: 1.1, a2: -0.2 }),
    weapon: (ctx, p, fh) => { ctx.save(); ctx.translate(fh.x - 8, fh.y + 4); ctx.rotate(-0.5); oval(ctx, 0, 0, 13, 11, '#c9873a'); circle(ctx, 0, 0, 3.5, '#3a2414', 0); poly(ctx, [6, -4, 32, -12, 33, -8, 7, 2], '#8a5a30', 2.5); ctx.restore(); },
  }));
  reg('hero_brujo', (ctx, p) => humanoid(ctx, p, {
    skin: '#bfb2c9', cloth: '#3b2a55', pants: '#2a1d3d', boots: '#1a1224', belt: '#9a7bd0', headR: 16.5, slash: false,
    head: humanHead('#bfb2c9', { hood: '#3b2a55' }), back: capeBack('#2a1d3d'), torsoDeco: robeDeco('#7a5ab0'), frontArm: castArm,
    weapon: (ctx, p, fh) => { staff('#c58cff', 'rgba(180,110,255,0.85)')(ctx, p, fh); circle(ctx, fh.x - 3, fh.y - 58, 7, '#efe8d3', 2); },
  }));
  reg('hero_halconera', (ctx, p) => {
    const pull = p.windup || 0, gone = (p.strike || 0) > 0.05;
    humanoid(ctx, p, {
      skin: skinH, cloth: '#8a6a3a', pants: '#5a4030', boots: '#3e2a1a', belt: '#5c3a1a', headR: 16.5, slash: false,
      head: humanHead(skinH, { hair: '#5a3018', pony: true }), back: capeBack('#7a5030'),
      frontArm: (p) => ({ a1: 1.6 - pull * 0.8, a2: -0.9 + pull * 0.6 }),
      weapon: (ctx, p, fh) => {
        poly(ctx, [fh.x - 6, fh.y - 2, fh.x + 6, fh.y - 2, fh.x + 6, fh.y + 8, fh.x - 6, fh.y + 8], '#6b4423', 2);
        if (!gone) { // halcón posado
          const fl = Math.sin((p.t || 0) * 3) * 0.1;
          oval(ctx, fh.x + 2, fh.y - 14, 9, 11, '#8a5a30');
          poly(ctx, [fh.x - 6, fh.y - 16, fh.x - 22, fh.y - 30 - fl * 20, fh.x - 2, fh.y - 8], '#6b4423', 2.5);
          circle(ctx, fh.x + 6, fh.y - 26, 6.5, '#efe8d3'); poly(ctx, [fh.x + 11, fh.y - 27, fh.x + 17, fh.y - 24, fh.x + 11, fh.y - 22], '#ffd34a', 1.5); circle(ctx, fh.x + 8, fh.y - 28, 1.6, INK, 0);
        }
      },
    });
  });
  reg('hero_arcano', (ctx, p) => {
    const t = p.t || 0;
    humanoid(ctx, p, {
      skin: skinH, cloth: '#2f3f9a', pants: '#232f74', boots: '#1a2050', belt: '#ffd34a', headR: 16.5, slash: false,
      head: humanHead(skinH, { hat: both(beard('#b9b2c9', true), wizardHat('#2f3f9a', '#ffd34a', '#ffffff')) }),
      torsoDeco: (ctx, p, o) => { for (let i = 0; i < 6; i++) circle(ctx, o.hipX - 14 + (i * 13) % 28, o.shY + 6 + i * 8, 1.6, '#fff6c0', 0); },
      frontArm: castArm,
      weapon: (ctx, p, fh) => { glowOrb(ctx, fh.x + 8, fh.y - 6, 5 + (p.windup || 0) * 3, '#e2c7ff', 'rgba(170,120,255,0.85)', t); },
      front: (ctx, p, o) => { for (let i = 0; i < 3; i++) { const a = t * 2 + i * TAU / 3; glowOrb(ctx, o.shX + Math.cos(a) * 26, o.shY - 10 + Math.sin(a) * 10, 3.5, '#bfe6ff', 'rgba(120,180,255,0.7)', t); } },
    });
  });
  reg('hero_granadero', (ctx, p) => humanoid(ctx, p, dwarf({
    skin: skinH, cloth: '#5a6b3a', pants: '#4b3a28', boots: '#3e2a1a', belt: '#5c3a1a', slash: false,
    head: humanHead(skinH, { hat: both(beard('#c0561a'), (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y - r * 0.15, r * 1.05, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fillStyle = col('#3a4a2a'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); }) }),
    torsoDeco: (ctx, p, o) => { line(ctx, o.shX - 16, o.shY + 2, o.hipX + 16, o.hipY - 4, 6, col('#5c3a1a')); for (let i = 0; i < 3; i++) circle(ctx, o.shX - 10 + i * 9, o.shY + 8 + i * 9, 4, '#2b2d38', 1.5); },
    frontArm: throwArm,
    weapon: (ctx, p, fh) => { if ((p.strike || 0) < 0.4) { circle(ctx, fh.x + 2, fh.y - 6, 8, '#2b2d38', 2.5); hl(ctx, fh.x - 1, fh.y - 9, 2.5, 1.6, 0.5); circle(ctx, fh.x + 6, fh.y - 16, 2.5 + Math.random(), '#ffd34a', 0); } },
  })));
  reg('hero_cazadora', (ctx, p) => humanoid(ctx, p, {
    skin: skinD, cloth: '#7a5a3a', pants: '#4b3a28', boots: '#3e2a1a', belt: '#5c3a1a', headR: 16.5, slash: false,
    head: humanHead(skinD, { hair: '#2a1a14', pony: true }), back: capeBack('#9a8a6a'),
    torsoDeco: (ctx, p, o) => { ctx.fillStyle = col('#c9b48a'); for (let i = 0; i < 4; i++) ctx.fillRect(o.hipX - 22, o.shY + i * 5, 44, 2.5); },
    frontArm: aimArm, backArm: supportArm(-0.25),
    weapon: (ctx, p, fh) => { gunAt(ctx, fh, p.strike || 0, 34, '#6f4723', '#8a93a1'); if ((p.strike || 0) < 0.3) poly(ctx, [fh.x + 34, fh.y - 6, fh.x + 46, fh.y - 0.5, fh.x + 34, fh.y + 5], '#dfe6ee', 2); },
  }));
  reg('hero_monje_viento', (ctx, p) => humanoid(ctx, p, {
    skin: skinH, cloth: '#e8892a', pants: '#2e9a8a', boots: '#8a6a44', belt: '#2e9a8a', headR: 16.5, slash: false,
    head: humanHead(skinH, { hat: beard('#efe9df', true) }),
    frontArm: (p, s) => ({ a1: 1.4 - (p.windup || 0) * 0.4 + (p.strike || 0) * 0.3, a2: -0.2 }),
    backArm: (p) => ({ a1: 1.0 + (p.windup || 0) * 0.5, a2: -0.6 }),
    front: (ctx, p, o) => { const w = 0.4 + (p.windup || 0) * 0.6; ctx.save(); ctx.globalAlpha = 0.7; for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(o.fh.x + 8, o.fh.y - 4, 8 + i * 7 + w * 4, (p.t || 0) * 6 + i, (p.t || 0) * 6 + i + 4); ctx.lineWidth = 2.5; ctx.strokeStyle = '#bff8ef'; ctx.stroke(); } ctx.restore(); },
  }));
  reg('hero_envenenadora', (ctx, p) => humanoid(ctx, p, {
    skin: skinP, cloth: '#2f5a2a', pants: '#1f3a1c', boots: '#1a1a14', belt: '#7ddb4a', headR: 16.5, slash: false,
    head: humanHead(skinP, { hood: '#2f6a2a' }), back: capeBack('#1f4a1c'),
    frontArm: (p) => ({ a1: 1.75 - (p.windup || 0) * 0.3, a2: -1.5 }),
    weapon: (ctx, p, fh) => { line(ctx, fh.x, fh.y, fh.x + 26, fh.y - 6, 6, INK); line(ctx, fh.x, fh.y, fh.x + 26, fh.y - 6, 3.2, col('#8a6a3a')); if ((p.strike || 0) > 0.5) { ctx.save(); ctx.globalAlpha = 0.6; circle(ctx, fh.x + 32, fh.y - 7, 5 * p.strike, '#9dff6a', 0); ctx.restore(); } },
  }));
  reg('hero_sacerdotisa_sol', (ctx, p) => humanoid(ctx, p, {
    skin: skinD, cloth: '#f2c94a', pants: '#f6f1e4', boots: '#c08a1a', belt: '#c08a1a', headR: 16.5, slash: false,
    head: humanHead(skinD, { hair: '#2a1a14', hat: (ctx, x, y, r, p) => { for (let i = 0; i < 7; i++) { const a = Math.PI * (1.1 + i * 0.13); poly(ctx, [x + Math.cos(a) * r * 1.0, y + Math.sin(a) * r * 1.0, x + Math.cos(a + 0.06) * r * 1.6, y + Math.sin(a + 0.06) * r * 1.6, x + Math.cos(a + 0.12) * r * 1.0, y + Math.sin(a + 0.12) * r * 1.0], '#ffd34a', 2); } } }),
    torsoDeco: (ctx, p, o) => { ctx.fillStyle = col('#ffffff'); ctx.fillRect(o.hipX - 4, o.shY - 2, 9, 70); },
    frontArm: castArm,
    weapon: (ctx, p, fh) => { staff('#fff2a0', 'rgba(255,220,90,0.95)')(ctx, p, fh); for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + (p.t || 0); line(ctx, fh.x - 3 + Math.cos(a) * 10, fh.y - 46 + Math.sin(a) * 10, fh.x - 3 + Math.cos(a) * 15, fh.y - 46 + Math.sin(a) * 15, 2, '#ffd34a'); } },
  }));
  reg('hero_mosquetera', (ctx, p) => humanoid(ctx, p, {
    skin: skinH, cloth: '#c0392b', pants: '#f6f1e4', boots: '#3e2a1a', belt: '#5c3a1a', headR: 16.5, slash: false,
    head: humanHead(skinH, { hair: '#2a1a14', pony: true, hat: (ctx, x, y, r, p) => { oval(ctx, x, y - r * 0.55, r * 1.55, r * 0.35, '#7a1f1a'); ctx.beginPath(); ctx.arc(x, y - r * 0.6, r * 0.8, Math.PI, 0); ctx.closePath(); ctx.fillStyle = col('#7a1f1a'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.save(); ctx.translate(x - r * 0.5, y - r * 1.1); ctx.rotate(-1.1 + Math.sin((p.t || 0) * 4) * 0.1); oval(ctx, 0, -r * 0.6, r * 0.2, r * 0.8, '#ffffff', 0, 2); ctx.restore(); } }),
    torsoDeco: (ctx, p, o) => { for (let i = 0; i < 4; i++) circle(ctx, o.hipX + 4, o.shY + 6 + i * 9, 2, '#ffd34a', 1); },
    frontArm: aimArm, backArm: supportArm(-0.25),
    weapon: (ctx, p, fh) => gunAt(ctx, fh, p.strike || 0, 44, '#7a4a26', '#5d6470'),
  }));

  // ------------------------------------------------------------------ tropas
  reg('troop_ballestero', (ctx, p) => humanoid(ctx, p, {
    skin: skinH, cloth: '#8a93a1', pants: '#4b4f5c', boots: '#3e2a1a', belt: '#5c3a1a', headR: 16, slash: false,
    head: humanHead(skinH, { hair: '#6b4024', hat: ironCap('#9aa3ad') }),
    torsoDeco: (ctx, p, o) => { ctx.fillStyle = col('#3a6fd0'); ctx.fillRect(o.hipX - 6, o.shY - 2, 13, 60); },
    frontArm: aimArm, backArm: supportArm(-0.2),
    weapon: (ctx, p, fh) => crossbowAt(ctx, fh, (p.strike || 0) < 0.3, p.strike || 0),
  }));
  reg('troop_aprendiz', (ctx, p) => humanoid(ctx, p, {
    skin: skinH, cloth: '#5a3fa0', pants: '#3a2a6a', boots: '#2a1a40', belt: '#ffd34a', headR: 16.5, slash: false,
    head: humanHead(skinH, { hair: '#e0a040', hat: wizardHat('#3a6fd0', '#ffd34a', null) }), frontArm: castArm,
    weapon: (ctx, p, fh) => glowOrb(ctx, fh.x + 7, fh.y - 5, 4 + (p.windup || 0) * 3, '#e2c7ff', 'rgba(180,120,255,0.85)', p.t),
  }));
  reg('troop_lanzapiedras', (ctx, p) => humanoid(ctx, p, {
    skin: skinD, cloth: '#7a6a4a', pants: '#4b3a28', boots: '#3e2a1a', belt: '#5c3a1a', headR: 16.5, slash: false,
    head: humanHead(skinD, { hair: '#3a2414', hat: (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y - r * 0.05, r * 1.03, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fillStyle = col('#3a6fd0'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); } }),
    frontArm: throwArm,
    weapon: (ctx, p, fh) => { if ((p.strike || 0) < 0.4) { ctx.beginPath(); ctx.moveTo(fh.x - 9, fh.y - 2); ctx.lineTo(fh.x - 4, fh.y - 13); ctx.lineTo(fh.x + 8, fh.y - 12); ctx.lineTo(fh.x + 10, fh.y); ctx.closePath(); ctx.fillStyle = col('#9a9ea6'); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); } },
  }));
})();
