/* Bastión Bravo · los 10 jefes dibujados por piezas y animados por código. Ver rig.js.
   pose.phase (0,1,2) cambia detalles visuales (furia, escudos...). */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const K = BB.rig.kit;
  const { humanoid, goblinHead, orcHead, ironCap, sword, axe, club, staff, circle, oval, poly, line, bone, hl, shade, col, INK, SK } = K;
  const TAU = Math.PI * 2;
  const reg = BB.rig.register;

  function glow(ctx, x, y, r, rgba) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
  }
  function flameBlob(ctx, x, y, s, t) {
    const f = Math.sin(t * 13) * 0.15 + Math.sin(t * 7.3) * 0.1;
    ctx.beginPath(); ctx.moveTo(x - s * 0.7, y); ctx.quadraticCurveTo(x - s * 0.9, y - s, x + f * s, y - s * (2 + f)); ctx.quadraticCurveTo(x + s * 0.9, y - s, x + s * 0.7, y); ctx.closePath(); ctx.fillStyle = '#ff6a1c'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - s * 0.4, y); ctx.quadraticCurveTo(x - s * 0.5, y - s * 0.7, x + f * s * 0.6, y - s * (1.4 + f)); ctx.quadraticCurveTo(x + s * 0.5, y - s * 0.7, x + s * 0.4, y); ctx.closePath(); ctx.fillStyle = '#ffd84a'; ctx.fill();
  }
  function crown(ctx, x, y, r) {
    poly(ctx, [x - r, y, x - r * 1.1, y - r * 1.1, x - r * 0.5, y - r * 0.55, x, y - r * 1.35, x + r * 0.5, y - r * 0.55, x + r * 1.1, y - r * 1.1, x + r, y], '#ffd34a', 3);
    poly(ctx, [x - r * 1.05, y - r * 0.2, x + r * 1.05, y - r * 0.2, x + r * 1.02, y + r * 0.15, x - r * 1.02, y + r * 0.15], '#c38f10', 2.5);
    circle(ctx, x, y - r * 0.05, r * 0.16, '#e3263a', 1.5); circle(ctx, x - r * 0.55, y - r * 0.05, r * 0.12, '#3a8dff', 1.5); circle(ctx, x + r * 0.55, y - r * 0.05, r * 0.12, '#3a8dff', 1.5);
  }
  function hornHelmBig(color, horn) {
    return (ctx, x, y, r) => {
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(x + s * r * 0.6, y - r * 0.5);
        ctx.quadraticCurveTo(x + s * r * 1.9, y - r * 0.6, x + s * r * 1.5, y - r * 2.0);
        ctx.quadraticCurveTo(x + s * r * 1.2, y - r * 0.9, x + s * r * 0.4, y - r * 0.85); ctx.closePath();
        ctx.fillStyle = col(horn || '#efe2c0'); ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(x - r * 1.05, y + r * 0.7); ctx.lineTo(x - r * 1.1, y - r * 0.35); ctx.quadraticCurveTo(x, y - r * 1.5, x + r * 1.12, y - r * 0.35); ctx.lineTo(x + r * 1.18, y + r * 0.55); ctx.quadraticCurveTo(x + r * 0.3, y + r * 0.9, x - r * 1.05, y + r * 0.7); ctx.closePath();
      ctx.fillStyle = col(color); ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
      poly(ctx, [x - r * 0.05, y - r * 0.18, x + r * 1.1, y - r * 0.18, x + r * 1.1, y + r * 0.04, x - r * 0.05, y + r * 0.04], '#140f16', 0);
      oval(ctx, x + r * 0.35, y - r * 0.07, r * 0.15, r * 0.06, '#ff3b2a', 0, 0); oval(ctx, x + r * 0.8, y - r * 0.08, r * 0.13, r * 0.05, '#ff3b2a', 0, 0);
      hl(ctx, x - r * 0.4, y - r * 0.7, r * 0.4, r * 0.14, 0.25);
    };
  }

  // ------------------------------------------------------------------ 1 · Rey Grikko (trono con ruedas)
  reg('boss_rey_goblin', (ctx, p) => {
    const t = p.t || 0, roll = (p.bp || 0) >= 1;
    const ang = p.moving ? (p.phase || 0) : 0;
    // ruedas
    for (const wx of [-26, 28]) {
      circle(ctx, wx, -14, 14, '#7a4a26');
      ctx.save(); ctx.translate(wx, -14); ctx.rotate(ang);
      for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 4); line(ctx, -11, 0, 11, 0, 3, INK); }
      ctx.restore(); circle(ctx, wx, -14, 4, '#c9a24a', 2);
    }
    // trono
    poly(ctx, [-44, -24, 42, -24, 40, -40, -40, -40], '#8a5a30', 3.5);
    poly(ctx, [-44, -40, -34, -40, -30, -118, -44, -112], '#9a6a3a', 3.5);
    circle(ctx, -38, -120, 7, '#ffd34a', 3);
    poly(ctx, [-36, -44, 30, -44, 30, -54, -36, -54], '#c0392b', 3);
    // rey sentado (cuerpo gordo)
    const bob = Math.sin(t * 3) * 1.5;
    oval(ctx, -2, -70 + bob, 34, 30, '#c0392b');
    oval(ctx, 6, -64 + bob, 24, 22, '#8fce45');
    oval(ctx, 6, -58 + bob, 16, 12, '#a8dd60', 0, 0);
    poly(ctx, [-30, -92 + bob, 26, -92 + bob, 30, -82 + bob, -34, -82 + bob], '#ffd34a', 2.5);
    // brazo lanzador
    const w = p.windup || 0, s = p.strike || 0;
    const a1 = 2.2 - w * 3.2 + s * 1.5;
    const sx = 20, sy = -80 + bob;
    const hx = sx + Math.sin(a1) * 28, hy = sy + Math.cos(a1) * 28;
    bone(ctx, sx, sy, hx, hy, 11, '#8fce45');
    if (s < 0.4) { circle(ctx, hx + 2, hy - 8, 10, '#ffd34a'); hl(ctx, hx - 1, hy - 11, 3, 2, 0.8); } else circle(ctx, hx, hy, 6, '#8fce45');
    bone(ctx, -24, -78 + bob, -12, -54 + bob, 11, '#8fce45');
    goblinHead('#8fce45', { eye: '#ffef7a', hat: (ctx, x, y, r) => crown(ctx, x, y - r * 0.85, r * 0.7) })(ctx, 8, -112 + bob, 26, p);
    if (roll) glow(ctx, 0, -60, 70, 'rgba(255,90,60,0.25)');
  });

  // ------------------------------------------------------------------ 2 · Mog'Rath, el Gran Chamán
  reg('boss_chaman_gigante', (ctx, p) => humanoid(ctx, p, {
    bulk: 1.55, leg: 0.95, legW: 1.15, armW: 1.2, skin: '#5f9a36', cloth: '#6b4a2e', pants: '#4d3a28', boots: '#3e2a1a', belt: '#efe8d3', headR: 19,
    head: (ctx, x, y, r, pp) => {
      orcHead('#5f9a36', { eye: '#9dff6a' })(ctx, x, y, r, pp);
      for (let i = 0; i < 7; i++) { ctx.save(); ctx.translate(x, y - r * 0.6); ctx.rotate(-1.4 + i * 0.47); oval(ctx, 0, -r * 1.2, r * 0.2, r * 0.7, ['#e8463c', '#ffd34a', '#3a8dff', '#9dff6a'][i % 4], 0, 2.5); ctx.restore(); }
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * r * 0.6, y - r * 0.6); ctx.quadraticCurveTo(x + s * r * 1.7, y - r * 0.9, x + s * r * 1.4, y - r * 2.0); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3.5; ctx.strokeStyle = col('#efe2c0'); ctx.stroke(); }
      glow(ctx, x + r * 0.55, y - r * 0.08, r * 0.9, 'rgba(150,255,100,0.35)');
    },
    torsoDeco: (ctx, p, o) => { for (let i = 0; i < 7; i++) { const a = Math.PI * (0.15 + i * 0.12); circle(ctx, o.shX + Math.cos(a) * 20, o.shY + Math.sin(a) * 14, i % 3 === 1 ? 5 : 3.5, '#efe8d3', 1.5); } ctx.fillStyle = col('#8a6a3a'); ctx.fillRect(o.hipX - 30, o.hipY - 6, 60, 10); },
    frontArm: (p, s) => ({ a1: 2.3 - (p.windup || 0) * 1.4 - s.sw * 0.2, a2: -0.6 }),
    weapon: (ctx, p, fh) => { staff('#9dff6a', 'rgba(140,255,90,0.9)')(ctx, p, fh); circle(ctx, fh.x - 3, fh.y - 64, 10, '#efe8d3', 2.5); circle(ctx, fh.x - 6, fh.y - 66, 2.5, '#9dff6a', 0); circle(ctx, fh.x, fh.y - 66, 2.5, '#9dff6a', 0); },
    slash: false,
  }));

  // ------------------------------------------------------------------ 3 · Gorrumbo, el Troll de Piedra
  reg('boss_troll_piedra', (ctx, p) => {
    const lava = (p.bp || 0) >= 1 ? 1 : 0.55;
    humanoid(ctx, p, {
      bulk: 1.9, leg: 1.0, legW: 1.35, armW: 1.55, torsoW: 1.2, lean: 1.2, skin: '#8a8f97', cloth: '#7d8088', pants: '#6f737b', boots: '#5a5e66', headR: 15,
      head: (ctx, x, y, r, pp) => {
        poly(ctx, [x - r, y + r * 0.6, x - r * 1.1, y - r * 0.4, x - r * 0.3, y - r * 1.1, x + r * 0.8, y - r * 0.9, x + r * 1.3, y, x + r * 1.0, y + r * 0.8], '#8a8f97', 4);
        poly(ctx, [x - r * 0.2, y - r * 1.0, x + r * 0.2, y - r * 1.6, x + r * 0.5, y - r * 0.9], '#ff8a2a', 2.5);
        circle(ctx, x + r * 0.35, y - r * 0.15, r * 0.16, '#ffb03a', 0); circle(ctx, x + r * 0.85, y - r * 0.15, r * 0.14, '#ffb03a', 0);
        glow(ctx, x + r * 0.6, y - r * 0.15, r, 'rgba(255,150,40,0.4)');
        poly(ctx, [x + r * 0.1, y + r * 0.5, x + r * 1.0, y + r * 0.45, x + r * 0.9, y + r * 0.7, x + r * 0.2, y + r * 0.72], '#3a2a24', 0);
      },
      torsoDeco: (ctx, p, o) => {
        for (const [mx, my, s] of [[-18, -48, 1], [8, -40, 1.2], [-6, -20, 0.9], [16, -60, 0.8]]) poly(ctx, [o.hipX + mx - 10 * s, o.hipY + my, o.hipX + mx - 4 * s, o.hipY + my - 9 * s, o.hipX + mx + 9 * s, o.hipY + my - 7 * s, o.hipX + mx + 11 * s, o.hipY + my + 4 * s], '#9da2aa', 2.5);
        ctx.strokeStyle = 'rgba(255,140,40,' + lava + ')'; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(o.hipX - 10, o.shY + 6); ctx.lineTo(o.hipX + 2, o.shY + 22); ctx.lineTo(o.hipX - 4, o.shY + 36); ctx.lineTo(o.hipX + 10, o.hipY - 6); ctx.stroke();
        glow(ctx, o.hipX + 2, o.hipY - 26, 26, 'rgba(255,150,40,' + 0.35 * lava + ')');
      },
      weapon: (ctx, p, fh) => { ctx.save(); ctx.translate(fh.x, fh.y); ctx.rotate(-fh.ang - 1.2); poly(ctx, [-14, 6, 14, 2, 18, 26, -10, 30], '#7d8088', 3.5); ctx.restore(); },
      slashR: 48,
    });
  });

  // ------------------------------------------------------------------ 4 · Khazrak y su escorpión
  reg('boss_escorpion', (ctx, p) => {
    const t = p.t || 0, ph = p.moving ? (p.phase || 0) * 1.6 : t * 0.5;
    const gold = '#d9a43a', goldD = '#a8761f', goldL = '#f2cf72';
    // patas (4 por lado; las lejanas más oscuras)
    for (let side = 0; side < 2; side++) for (let i = 0; i < 4; i++) {
      const lx = -36 + i * 18, a = Math.sin(ph + i * 1.3 + side * Math.PI) * 0.35 * (p.moving ? 1 : 0.2);
      const kx = lx + 8 + Math.sin(a) * 10, ky = -44;
      bone(ctx, lx, -30, kx, ky, 6, side ? goldD : shade(goldD, -0.2));
      bone(ctx, kx, ky, kx + 10 + Math.sin(a) * 6, -2, 5, side ? goldD : shade(goldD, -0.2));
    }
    // cola segmentada que se arquea sobre el lomo
    const strike = (p.strike || 0), wind = (p.windup || 0);
    const segs = 6;
    let tx = -40, ty = -34;
    for (let i = 0; i < segs; i++) {
      const a = -0.9 - i * 0.42 + wind * 0.3 - strike * 0.5 + Math.sin(t * 2 + i) * 0.04;
      const nx = tx + Math.cos(a) * 15 * (1 - i * 0.04), ny = ty + Math.sin(a) * 15;
      oval(ctx, (tx + nx) / 2, (ty + ny) / 2, 11 - i * 0.8, 8.5 - i * 0.6, i % 2 ? gold : goldL, a);
      tx = nx; ty = ny;
    }
    poly(ctx, [tx - 6, ty - 4, tx + 8, ty - 10, tx + 22 + strike * 8, ty + 6 + strike * 10, tx + 4, ty + 6], '#3a2a20', 3);
    glow(ctx, tx + 20 + strike * 8, ty + 6 + strike * 10, 12, 'rgba(140,255,90,0.7)');
    // cuerpo
    oval(ctx, -6, -36, 44, 18, gold);
    for (let i = 0; i < 4; i++) line(ctx, -32 + i * 16, -50, -28 + i * 16, -22, 2.5, col(goldD));
    oval(ctx, 2, -44, 30, 6, goldL, 0, 0);
    // pinzas
    for (const [dy, sc] of [[-6, 0.85], [6, 1]]) {
      const open = Math.sin(t * 4) * 0.15 + wind * 0.3;
      ctx.save(); ctx.translate(36, -36 + dy); ctx.scale(sc, sc);
      bone(ctx, 0, 0, 20, -6, 8, goldD);
      poly(ctx, [18, -14, 44, -18 - open * 20, 30, -6], gold, 3);
      poly(ctx, [18, 0, 44, 6 + open * 20, 30, -4], goldL, 3);
      ctx.restore();
    }
    // cabeza y ojos
    oval(ctx, 34, -38, 12, 10, gold); circle(ctx, 40, -42, 3, '#ff3a2a', 0); circle(ctx, 36, -44, 2.5, '#ff3a2a', 0);
    // jinete goblin
    ctx.save(); ctx.translate(-8, -52); ctx.scale(0.62, 0.62);
    humanoid(ctx, Object.assign({}, p, { moving: false, windup: 0, strike: 0 }), {
      bulk: 0.9, leg: 0.01, legW: 0.01, skin: '#8fce45', cloth: '#a8423a', pants: '#6b4a2b', boots: '#6b4a2b', headR: 20,
      head: goblinHead('#8fce45', { hat: (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y - r * 0.2, r * 1.05, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fillStyle = col('#ffd34a'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); poly(ctx, [x - r * 0.2, y - r * 1.2, x, y - r * 1.8, x + r * 0.25, y - r * 1.2], '#e8463c', 2.5); } }),
      weapon: (ctx, p, fh) => { line(ctx, fh.x, fh.y + 10, fh.x + 4, fh.y - 50, 6, INK); line(ctx, fh.x, fh.y + 10, fh.x + 4, fh.y - 50, 3.5, col('#8a5a30')); poly(ctx, [fh.x - 1, fh.y - 50, fh.x + 4, fh.y - 66, fh.x + 9, fh.y - 50], '#dfe6ee', 2); },
      slash: false,
    });
    ctx.restore();
  });

  // ------------------------------------------------------------------ 5 · Ignarok, Señor del Magma
  reg('boss_senor_fuego', (ctx, p) => {
    const t = p.t || 0, shield = (p.bp || 0) >= 1;
    humanoid(ctx, p, {
      bulk: 1.45, legW: 1.1, armW: 1.15, skin: '#5f9a36', cloth: '#2e2424', pants: '#2a2020', boots: '#1e1616', belt: '#ff8a2a', headR: 18,
      head: orcHead('#5f9a36', { eye: '#ffb03a', hat: (ctx, x, y, r) => { for (let i = 0; i < 4; i++) flameBlob(ctx, x - r * 0.6 + i * r * 0.45, y - r * 0.75, r * 0.32, t + i); ironCap('#3a3030')(ctx, x, y, r); } }),
      torsoDeco: (ctx, p, o) => { ctx.strokeStyle = '#ff8a2a'; ctx.lineWidth = 3; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(o.hipX - 18 + i * 10, o.shY + 4); ctx.lineTo(o.hipX - 12 + i * 10, o.shY + 22); ctx.lineTo(o.hipX - 18 + i * 10, o.hipY - 4); ctx.stroke(); } glow(ctx, o.hipX, o.hipY - 26, 30, 'rgba(255,120,30,0.35)'); },
      mid: (ctx, p, o) => { for (const s of [-1, 1]) { oval(ctx, o.shX + s * 16, o.shY + 2, 13, 9, '#3a3030'); poly(ctx, [o.shX + s * 16 - 4, o.shY - 5, o.shX + s * 16, o.shY - 18, o.shX + s * 16 + 4, o.shY - 5], '#ff8a2a', 2); } },
      weapon: (ctx, p, fh) => { sword(46, '#ff9a3a', '#3a3030')(ctx, p, fh); glow(ctx, fh.x + 10, fh.y - 30, 36, 'rgba(255,140,40,0.45)'); },
      slashR: 46,
    });
    if (shield) { ctx.save(); ctx.globalAlpha = 0.25 + Math.sin(t * 5) * 0.08; oval(ctx, 0, -60, 52, 70, '#ff6a1c', 0, 4); ctx.restore(); }
  });

  // ------------------------------------------------------------------ 6 · Thargrim, Señor de la Guerra
  reg('boss_senor_guerra', (ctx, p) => {
    const t = p.t || 0, fury = (p.bp || 0) >= 2;
    if (fury) glow(ctx, 0, -60, 90, 'rgba(255,40,30,0.35)');
    humanoid(ctx, p, {
      bulk: 1.6, legW: 1.15, armW: 1.2, torsoW: 1.1, skin: '#5f9a36', cloth: '#2f2b33', pants: '#25222a', boots: '#18161c', belt: '#c0392b', headR: 18,
      back: (ctx, p, b) => { const sway = Math.sin(t * 3) * 3; poly(ctx, [b.shX - 18, b.shY, b.shX + 8, b.shY, b.shX - 10 - sway, b.hipY + 34, b.shX - 42 - sway * 1.5, b.hipY + 28], '#9a1d15'); },
      head: (ctx, x, y, r, pp) => hornHelmBig('#3f4350')(ctx, x, y, r, pp),
      torsoDeco: (ctx, p, o) => { for (let i = 1; i < 5; i++) line(ctx, o.hipX - 26, o.shY + i * 10, o.hipX + 26, o.shY + i * 10, 2, 'rgba(0,0,0,0.35)'); circle(ctx, o.hipX + 2, o.shY + 22, 7, '#c0392b', 2.5); },
      mid: (ctx, p, o) => { for (const s of [-1, 1]) { oval(ctx, o.shX + s * 18, o.shY + 2, 15, 11, '#3f4350'); for (let k = -1; k <= 1; k++) poly(ctx, [o.shX + s * 18 + k * 7 - 3, o.shY - 6, o.shX + s * 18 + k * 7, o.shY - 20, o.shX + s * 18 + k * 7 + 3, o.shY - 6], '#d6dde7', 1.8); } },
      weapon: axe(44, true), slashR: 52,
    });
  });

  // ------------------------------------------------------------------ 7 · Hrimgor, el Ogro de Escarcha
  reg('boss_gigante_escarcha', (ctx, p) => {
    const t = p.t || 0, armor = (p.bp || 0) >= 1;
    humanoid(ctx, p, {
      bulk: 1.75, leg: 1.0, legW: 1.25, armW: 1.45, torsoW: 1.15, skin: '#7fb3d9', cloth: '#7fb3d9', pants: '#5a7a9a', boots: '#3f5a7a', belt: '#8a5a30', headR: 17,
      head: (ctx, x, y, r, pp) => {
        orcHead('#7fb3d9', { eye: '#e9fbff' })(ctx, x, y, r, pp);
        ctx.beginPath(); ctx.moveTo(x - r * 0.5, y + r * 0.3); ctx.quadraticCurveTo(x - r * 0.2, y + r * 1.9, x + r * 0.6, y + r * 2.0); ctx.quadraticCurveTo(x + r * 1.2, y + r * 1.0, x + r * 1.1, y + r * 0.35); ctx.closePath(); ctx.fillStyle = col('#f4fbff'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
        for (let i = 0; i < 3; i++) poly(ctx, [x - r * 0.6 + i * r * 0.55, y - r * 0.8, x - r * 0.4 + i * r * 0.55, y - r * 1.55, x - r * 0.2 + i * r * 0.55, y - r * 0.8], '#bfefff', 2.5);
      },
      torsoDeco: (ctx, p, o) => { ctx.fillStyle = col('#8a5a30'); ctx.fillRect(o.hipX - 30, o.hipY - 6, 60, 12); oval(ctx, o.hipX + 4, o.hipY - 26, 18, 12, '#a6cdea', 0, 0); },
      mid: (ctx, p, o) => { for (const s of [-1, 1]) for (let k = 0; k < 3; k++) poly(ctx, [o.shX + s * 18 - 6 + k * 5, o.shY + 2, o.shX + s * 18 - 2 + k * 5, o.shY - 16 - k * 4, o.shX + s * 18 + 2 + k * 5, o.shY + 2], '#d6f4ff', 2); },
      weapon: (ctx, p, fh) => { ctx.save(); ctx.translate(fh.x, fh.y); ctx.rotate(-fh.ang - 1.2); poly(ctx, [-5, -6, 5, -6, 14, 44, -12, 44], '#bfefff', 3.5); line(ctx, -2, 4, 2, 38, 2.5, 'rgba(255,255,255,0.8)'); ctx.restore(); },
      slashR: 50,
    });
    if (armor) { ctx.save(); ctx.globalAlpha = 0.3 + Math.sin(t * 4) * 0.06; for (const [x, y, r] of [[-10, -70, 30], [12, -96, 24], [-4, -40, 26]]) poly(ctx, [x - r, y, x, y - r, x + r, y, x, y + r], '#d6f4ff', 3); ctx.restore(); }
  });

  // ------------------------------------------------------------------ 8 · Vorlath, el Nigromante (flota)
  reg('boss_nigromante', (ctx, p) => {
    const t = p.t || 0, spectral = (p.bp || 0) >= 1;
    if (spectral) ctx.globalAlpha *= 0.75;
    const fl = Math.sin(t * 2.2) * 5;
    ctx.save(); ctx.translate(0, -16 + fl);
    // falda harapienta
    ctx.beginPath(); ctx.moveTo(-26, -60);
    for (let i = 0; i <= 6; i++) ctx.lineTo(-30 + i * 10, -8 + (i % 2 ? -10 : 0) + Math.sin(t * 4 + i) * 4);
    ctx.lineTo(28, -60); ctx.closePath(); ctx.fillStyle = col('#2f2340'); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    humanoid(ctx, Object.assign({}, p, { moving: false }), {
      bulk: 1.3, leg: 0.01, legW: 0.01, skin: '#5f9a36', cloth: '#3b2a55', pants: '#2f2340', boots: '#2f2340', belt: '#9a7bd0', headR: 17,
      head: (ctx, x, y, r) => {
        ctx.beginPath(); ctx.moveTo(x - r * 1.1, y + r * 1.0); ctx.quadraticCurveTo(x - r * 1.5, y - r * 0.6, x - r * 0.4, y - r * 1.35); ctx.quadraticCurveTo(x + r * 0.9, y - r * 1.35, x + r * 1.2, y - r * 0.1); ctx.lineTo(x + r * 1.0, y + r * 1.0); ctx.closePath(); ctx.fillStyle = col('#3b2a55'); ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
        oval(ctx, x + r * 0.42, y + r * 0.1, r * 0.66, r * 0.72, '#130c1c', 0, 0);
        oval(ctx, x + r * 0.25, y, r * 0.14, r * 0.08, '#c58cff', 0, 0); oval(ctx, x + r * 0.7, y - r * 0.02, r * 0.12, r * 0.07, '#c58cff', 0, 0);
        glow(ctx, x + r * 0.45, y, r * 0.8, 'rgba(190,120,255,0.4)');
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * r * 0.4, y - r * 1.1); ctx.quadraticCurveTo(x + s * r * 1.3, y - r * 1.4, x + s * r * 1.1, y - r * 2.2); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3.5; ctx.strokeStyle = col('#3b3050'); ctx.stroke(); }
      },
      frontArm: (p) => ({ a1: 2.1 - (p.windup || 0) * 1.4, a2: -0.6 }),
      weapon: (ctx, p, fh) => { staff('#c58cff', 'rgba(180,110,255,0.95)')(ctx, p, fh); for (let i = 0; i < 3; i++) { const a = t * 3 + i * TAU / 3; circle(ctx, fh.x - 3 + Math.cos(a) * 16, fh.y - 46 + Math.sin(a) * 8, 3, '#e2c7ff', 0); } },
      slash: false,
    });
    ctx.restore();
    for (let i = 0; i < 3; i++) { const a = t * 1.5 + i * 2; glow(ctx, Math.cos(a) * 40, -60 + Math.sin(a * 1.3) * 30, 14, 'rgba(160,255,200,0.35)'); }
  });

  // ------------------------------------------------------------------ 9 · Gran Gólem de Tuerca
  reg('boss_golem', (ctx, p) => {
    const t = p.t || 0, ph = p.moving ? (p.phase || 0) : 0;
    const brass = '#c9973a', brassD = '#8a6420', iron = '#6b717c', shieldOn = (p.bp || 0) === 1;
    // piernas de pistón
    for (const [lx, o, c] of [[-16, Math.PI, shade(iron, -0.2)], [16, 0, iron]]) {
      const a = Math.sin(ph + o) * 0.35;
      const kx = lx + Math.sin(a) * 18, ky = -38 + Math.cos(a) * 0;
      bone(ctx, lx, -50, kx, ky, 13, c);
      bone(ctx, kx, ky, kx + Math.sin(a * 0.5) * 6, -6, 11, brassD);
      poly(ctx, [kx - 14, -8, kx + 18, -8, kx + 20, 2, kx - 16, 2], iron, 3);
    }
    // cuerpo
    poly(ctx, [-38, -50, 38, -50, 44, -112, -44, -112], brass, 4);
    for (let i = 0; i < 6; i++) circle(ctx, -36 + i * 14.5, -58, 2.5, brassD, 0);
    for (let i = 0; i < 6; i++) circle(ctx, -38 + i * 15.5, -106, 2.5, brassD, 0);
    // cabina con piloto goblin
    circle(ctx, 4, -84, 18, '#9be3ff');
    ctx.save(); ctx.beginPath(); ctx.arc(4, -84, 17, 0, TAU); ctx.clip();
    goblinHead('#8fce45', { hat: (ctx, x, y, r) => { line(ctx, x - r, y - r * 0.45, x + r, y - r * 0.5, r * 0.22, INK); circle(ctx, x + r * 0.35, y - r * 0.48, r * 0.24, '#c38f10', 2); } })(ctx, 2, -80, 12, p);
    ctx.restore();
    hl(ctx, -4, -94, 6, 3, 0.6);
    // chimenea con humo
    poly(ctx, [-34, -112, -22, -112, -22, -134, -34, -134], iron, 3);
    for (let i = 0; i < 3; i++) { const k = ((t * 0.8 + i / 3) % 1); circle(ctx, -28 + k * 8, -140 - k * 30, 5 + k * 8, 'rgba(120,115,110,' + (0.55 * (1 - k)).toFixed(2) + ')', 0); }
    // brazos: cañón delante, garra atrás
    const w = p.windup || 0, s = p.strike || 0;
    bone(ctx, -40, -100, -54, -70, 12, iron);
    poly(ctx, [-62, -72, -46, -72, -50, -56, -60, -56], brassD, 3);
    ctx.save(); ctx.translate(40, -96); ctx.rotate(0.35 - w * 0.25 + s * 0.15);
    bone(ctx, 0, 0, 10, 20, 12, iron);
    poly(ctx, [4, 14, 46, 10, 46, 30, 4, 34], '#3a3c42', 3.5);
    circle(ctx, 46, 20, 9, '#2a2c32', 3);
    if (s > 0.5) glow(ctx, 56, 20, 24 * s, 'rgba(255,180,80,0.9)');
    ctx.restore();
    if (shieldOn) { ctx.save(); ctx.globalAlpha = 0.25 + Math.sin(t * 6) * 0.08; oval(ctx, 0, -70, 62, 80, '#9be3ff', 0, 4); ctx.restore(); }
  });

  // ------------------------------------------------------------------ 10 · Skarnoth, el Dragón de los Orcos (vuela)
  reg('boss_dragon', (ctx, p) => {
    const t = p.t || 0, landed = (p.bp || 0) === 1;
    const flap = landed ? Math.sin(t * 2) * 0.15 : Math.sin(t * 4.5);
    const red = '#c8372a', redD = '#8a1f18', belly = '#f2c46a';
    ctx.save(); ctx.translate(0, landed ? 0 : -30 + Math.sin(t * 2) * 6);
    const wing = (dx, dy, c, s) => {
      ctx.save(); ctx.translate(dx, dy); ctx.rotate(-0.3 + flap * 0.6); ctx.scale(s, s);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-24, -70); ctx.lineTo(-96, -62); ctx.quadraticCurveTo(-74, -36, -78, -18); ctx.quadraticCurveTo(-52, -16, -48, 0); ctx.quadraticCurveTo(-24, -4, 2, 10); ctx.closePath();
      ctx.fillStyle = col(c); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
      line(ctx, -24, -70, -78, -18, 3, INK); line(ctx, -24, -70, -48, 0, 3, INK);
      ctx.restore();
    };
    wing(-6, -70, redD, 1);
    // cola
    ctx.beginPath(); ctx.moveTo(-40, -50); ctx.quadraticCurveTo(-90, -30 + Math.sin(t * 3) * 10, -120, -58); ctx.lineWidth = 16; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 11; ctx.strokeStyle = col(red); ctx.stroke();
    poly(ctx, [-120, -58, -138, -74, -134, -48], redD, 3);
    // patas
    if (landed) { bone(ctx, -20, -40, -24, -2, 10, redD); bone(ctx, 22, -40, 24, -2, 10, red); }
    else { bone(ctx, -20, -40, -28, -18, 9, redD); bone(ctx, 22, -40, 18, -18, 9, red); }
    // cuerpo
    oval(ctx, 0, -56, 52, 30, red);
    oval(ctx, 6, -46, 36, 14, belly, 0, 0);
    for (let i = 0; i < 6; i++) poly(ctx, [-36 + i * 13, -82, -31 + i * 13, -96, -26 + i * 13, -84], redD, 2.5);
    // cuello y cabeza
    const open = Math.max(p.windup || 0, p.strike || 0);
    ctx.beginPath(); ctx.moveTo(30, -70); ctx.quadraticCurveTo(58, -86, 64, -112); ctx.lineWidth = 26; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 20; ctx.strokeStyle = col(red); ctx.stroke();
    ctx.save(); ctx.translate(72, -118);
    poly(ctx, [-6, -12, -26, -36, -2, -18], '#efe2c0', 3); poly(ctx, [4, -14, -6, -42, 12, -16], '#efe2c0', 3);
    oval(ctx, 0, 0, 22, 17, red);
    ctx.save(); ctx.rotate(open * 0.45); oval(ctx, 22, 9, 18, 7, redD); ctx.restore();
    oval(ctx, 24, -2, 20, 9, red, -0.1);
    circle(ctx, 40, -6, 2.5, INK, 0);
    circle(ctx, 6, -6, 5.5, '#ffd34a', 2); circle(ctx, 7, -6, 2.4, INK, 0);
    if (open > 0.3) glow(ctx, 44, 8, 30 * open, 'rgba(255,140,40,0.9)');
    ctx.restore();
    // jinete orco
    ctx.save(); ctx.translate(-4, -82); ctx.scale(0.55, 0.55);
    humanoid(ctx, Object.assign({}, p, { moving: false, windup: 0, strike: 0 }), {
      bulk: 1.1, leg: 0.01, legW: 0.01, skin: '#5f9a36', cloth: '#3f4350', pants: '#2f2b33', boots: '#2f2b33', headR: 18,
      head: hornHelmBig('#3f4350'), weapon: (ctx, p, fh) => { line(ctx, fh.x, fh.y + 20, fh.x + 6, fh.y - 60, 7, INK); line(ctx, fh.x, fh.y + 20, fh.x + 6, fh.y - 60, 4, col('#8a5a30')); poly(ctx, [fh.x, fh.y - 60, fh.x + 7, fh.y - 82, fh.x + 13, fh.y - 60], '#dfe6ee', 2.5); }, slash: false,
    });
    ctx.restore();
    wing(4, -74, red, 1.08);
    ctx.restore();
  });
})();
