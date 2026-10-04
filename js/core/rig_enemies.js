/* Bastión Bravo · enemigos dibujados por piezas (estilo dibujo animado). Ver rig.js. */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const K = BB.rig.kit;
  const { humanoid, goblinHead, orcHead, humanHead, ironCap, bandana, sword, axe, club, staff, bowAt, circle, oval, poly, line, bone, hl, shade, col, INK, SK, smooth } = K;
  const TAU = Math.PI * 2;
  const reg = BB.rig.register;

  // ------------------------------------------------------------------ piezas extra
  function bomb(ctx, x, y, r, t) {
    circle(ctx, x, y, r, '#2b2d38');
    hl(ctx, x - r * 0.35, y - r * 0.35, r * 0.3, r * 0.18, 0.45);
    poly(ctx, [x - r * 0.25, y - r * 1.05, x + r * 0.25, y - r * 1.05, x + r * 0.25, y - r * 0.8, x - r * 0.25, y - r * 0.8], '#6b6f78', 2);
    ctx.beginPath(); ctx.moveTo(x, y - r * 1.05); ctx.quadraticCurveTo(x + r * 0.6, y - r * 1.5, x + r * 0.4, y - r * 1.9); ctx.lineWidth = 2; ctx.strokeStyle = '#c9a46a'; ctx.stroke();
    const sp = 3 + Math.sin((t || 0) * 30) * 1.5;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    circle(ctx, x + r * 0.4, y - r * 1.9, sp + 2, 'rgba(255,170,40,0.6)', 0); circle(ctx, x + r * 0.4, y - r * 1.9, sp * 0.6, '#fff8c0', 0);
    ctx.restore();
  }
  function hornHelm(color) {
    return (ctx, x, y, r, p) => {
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(x + s * r * 0.55, y - r * 0.55);
        ctx.quadraticCurveTo(x + s * r * 1.45, y - r * 0.7, x + s * r * 1.25, y - r * 1.6);
        ctx.quadraticCurveTo(x + s * r * 1.0, y - r * 0.95, x + s * r * 0.35, y - r * 0.85); ctx.closePath();
        ctx.fillStyle = col('#f1e6c8'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      }
      ironCap(color)(ctx, x, y, r, p);
    };
  }
  function mohawk(color) {
    return (ctx, x, y, r) => {
      ctx.beginPath(); ctx.moveTo(x - r * 0.8, y - r * 0.45);
      for (let i = 0; i <= 5; i++) {
        const a = Math.PI * (1.08 + i * 0.165);
        ctx.lineTo(x + Math.cos(a) * r * 1.6, y + Math.sin(a) * r * 1.6);
        const a2 = Math.PI * (1.16 + i * 0.165);
        if (i < 5) ctx.lineTo(x + Math.cos(a2) * r * 1.0, y + Math.sin(a2) * r * 1.0);
      }
      ctx.lineTo(x + r * 0.6, y - r * 0.8); ctx.closePath();
      ctx.fillStyle = col(color); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    };
  }
  function skullMask(ctx, x, y, r, p) {
    // máscara de calavera con plumas
    const cols = ['#e8463c', '#ffd34a', '#3a8dff', '#e8463c', '#ffd34a'];
    for (let i = 0; i < 5; i++) {
      ctx.save(); ctx.translate(x - r * 0.1, y - r * 0.55); ctx.rotate(-1.1 + i * 0.28);
      oval(ctx, 0, -r * 1.05, r * 0.2, r * 0.6, cols[i], 0, 2.5); line(ctx, 0, -r * 0.5, 0, -r * 1.55, 1.2, 'rgba(0,0,0,0.35)');
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(x + r * 0.15, y - r * 0.15, r * 0.95, Math.PI * 1.0, Math.PI * 2.05); ctx.quadraticCurveTo(x + r * 1.1, y + r * 0.45, x + r * 0.55, y + r * 0.5); ctx.lineTo(x - r * 0.3, y + r * 0.2); ctx.closePath();
    ctx.fillStyle = col('#efe8d3'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    oval(ctx, x + r * 0.35, y - r * 0.15, r * 0.2, r * 0.22, '#1e1416', 0, 0);
    oval(ctx, x + r * 0.82, y - r * 0.18, r * 0.16, r * 0.2, '#1e1416', 0, 0);
    circle(ctx, x + r * 0.37, y - r * 0.13, r * 0.08, '#8bff5a', 0); circle(ctx, x + r * 0.83, y - r * 0.16, r * 0.07, '#8bff5a', 0);
  }
  function miningHelmet(ctx, x, y, r, p) {
    ctx.beginPath(); ctx.arc(x, y - r * 0.12, r * 1.06, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fillStyle = col('#e0a21e'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    poly(ctx, [x - r * 1.15, y - r * 0.2, x + r * 1.2, y - r * 0.2, x + r * 1.2, y + r * 0.02, x - r * 1.15, y + r * 0.02], '#b47d12', 2.5);
    circle(ctx, x + r * 0.45, y - r * 0.6, r * 0.24, '#fff6a0', 2.5);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.16;
    ctx.beginPath(); ctx.moveTo(x + r * 0.55, y - r * 0.72); ctx.lineTo(x + r * 2.2, y - r * 1.0); ctx.lineTo(x + r * 2.2, y - r * 0.15); ctx.closePath(); ctx.fillStyle = '#fff6a0'; ctx.fill(); ctx.restore();
  }
  function goggles(ctx, x, y, r) {
    line(ctx, x - r * 0.9, y - r * 0.45, x + r * 0.95, y - r * 0.5, r * 0.22, INK);
    circle(ctx, x + r * 0.3, y - r * 0.48, r * 0.26, '#c38f10', 2.5); circle(ctx, x + r * 0.3, y - r * 0.48, r * 0.16, '#9be3ff', 0);
    circle(ctx, x + r * 0.78, y - r * 0.5, r * 0.22, '#c38f10', 2.5); circle(ctx, x + r * 0.78, y - r * 0.5, r * 0.13, '#9be3ff', 0);
  }

  // ------------------------------------------------------------------ Goblin Petardo
  reg('enemy_goblin_bombardero', (ctx, p) => humanoid(ctx, p, {
    bulk: 0.85, leg: 0.8, lean: 2.4, skin: SK.goblin, cloth: '#4b5563', pants: '#5a4a3a', boots: '#3f2a16', belt: '#4a2e16', headR: 19,
    head: goblinHead(SK.goblin, { hat: goggles }),
    back: (ctx, p, b) => { oval(ctx, b.shX - 16, b.shY + 14, 13, 17, '#8f5d2e'); bomb(ctx, b.shX - 18, b.shY - 2, 10, p.t); bomb(ctx, b.shX - 8, b.shY + 2, 8, p.t + 1); },
    frontArm: (p, s) => ({ a1: 2.6 - (p.windup || 0) * 3.4 + (p.strike || 0) * 1.6 - s.sw * 0.3, a2: -0.5 }),
    weapon: (ctx, p, fh) => { if ((p.strike || 0) < 0.4) bomb(ctx, fh.x + 4, fh.y - 6, 11, p.t); },
    slash: false,
  }));

  // ------------------------------------------------------------------ Goblin Planeador (volador)
  reg('enemy_goblin_planeador', (ctx, p) => {
    const t = p.t || 0, flap = Math.sin(t * 9 + (p.seed || 0));
    ctx.save(); ctx.translate(0, -34);
    // alas de cuero
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(-4, -54); ctx.scale(s === -1 ? 1 : 1, 1); ctx.rotate(s * (0.15 + flap * 0.12));
      const tip = s * 68;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(tip * 0.5, -26 - flap * 10, tip, -10 - flap * 14);
      ctx.quadraticCurveTo(tip * 0.82, 6, tip * 0.66, 2); ctx.quadraticCurveTo(tip * 0.5, 12, tip * 0.33, 4); ctx.quadraticCurveTo(tip * 0.18, 12, 0, 6); ctx.closePath();
      ctx.fillStyle = col(s < 0 ? '#7a4f2f' : '#9a6a3f'); ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
      line(ctx, 0, 0, tip * 0.66, -6 - flap * 8, 2.5, INK); line(ctx, 0, 0, tip * 0.33, -2, 2, INK);
      ctx.restore();
    }
    humanoid(ctx, Object.assign({}, p, { moving: false }), {
      bulk: 0.8, leg: 0.75, skin: SK.goblin, cloth: '#6b4a2b', pants: '#4d3a28', boots: '#3f2a16', belt: '#4a2e16', headR: 18,
      head: goblinHead(SK.goblin, { hat: bandana('#8a2be2') }),
      frontArm: () => ({ a1: Math.PI - 0.4, a2: 0.2 }), backArm: () => ({ a1: Math.PI + 0.4, a2: -0.2 }),
      weapon: null, slash: false,
    });
    ctx.restore();
  });

  // ------------------------------------------------------------------ Jinete de Lobo
  reg('enemy_jinete_lobo', (ctx, p) => {
    const ph = p.moving ? p.phase * 1.4 : 0, gallop = p.moving ? 1 : 0;
    const bob = Math.abs(Math.sin(ph)) * 5 * gallop;
    const fur = '#8a8f99', furD = '#5f646e', furL = '#b7bcc6';
    ctx.save(); ctx.translate(0, -bob);
    // cola
    ctx.beginPath(); ctx.moveTo(-40, -52); ctx.quadraticCurveTo(-66, -60 + Math.sin(ph) * 8, -70, -40 + Math.sin(ph + 1) * 6); ctx.quadraticCurveTo(-58, -48, -40, -44); ctx.closePath(); ctx.fillStyle = col(fur); ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
    // patas traseras/delanteras (galope)
    const legs = [[-30, 0, furD], [26, Math.PI * 0.6, furD], [-22, Math.PI, fur], [34, Math.PI * 1.6, fur]];
    for (const [lx, o, c] of legs) {
      const a = Math.sin(ph + o) * 0.6 * gallop;
      const kx = lx + Math.sin(a) * 18, ky = -36 + Math.cos(a) * 18;
      bone(ctx, lx, -44, kx, ky, 10, c);
      bone(ctx, kx, ky, kx + Math.sin(a * 0.4 - 0.3) * 17, ky + 17, 8, c);
      oval(ctx, kx + Math.sin(a * 0.4 - 0.3) * 17 + 3, ky + 17, 6, 3.5, '#3a3c42', 0, 2.5);
    }
    // cuerpo
    oval(ctx, 0, -50, 46, 21, fur);
    oval(ctx, 4, -40, 32, 9, furL, 0, 0);
    for (let i = 0; i < 6; i++) poly(ctx, [-30 + i * 11, -66, -26 + i * 11, -76, -20 + i * 11, -67], furD, 2.5);
    // cabeza
    ctx.save(); ctx.translate(46, -62 + Math.sin(ph) * 2);
    poly(ctx, [-6, -14, -2, -30, 8, -14], fur, 3);
    oval(ctx, 0, 0, 18, 15, fur);
    poly(ctx, [10, -6, 34, 2, 30, 10, 10, 10], fur, 3);
    circle(ctx, 33, 4, 3.5, '#1e1416', 0);
    poly(ctx, [14, 9, 30, 10, 14, 14], '#fff', 2);
    circle(ctx, 6, -4, 4, '#ffd83a', 2); circle(ctx, 7, -4, 1.8, INK, 0);
    ctx.restore();
    // jinete goblin (medio cuerpo)
    ctx.save(); ctx.translate(-6, -64);
    bone(ctx, 4, -2, 14, 12, 8, '#6b4a2b');
    const rp = Object.assign({}, p, { moving: false });
    humanoid(ctx, rp, {
      bulk: 0.8, leg: 0.01, legW: 0.01, skin: SK.goblin, cloth: '#7a3a2a', pants: '#6b4a2b', boots: '#6b4a2b', headR: 17,
      head: goblinHead(SK.goblin, { hat: hornHelm('#7d8794') }), weapon: sword(24), slashR: 30,
    });
    ctx.restore();
    ctx.restore();
  });

  // ------------------------------------------------------------------ Chamán Curandero
  reg('enemy_chaman', (ctx, p) => humanoid(ctx, p, {
    skin: SK.orc, cloth: '#7a5a3a', pants: '#5a4030', boots: '#3e2a1a', belt: '#efe8d3', headR: 17,
    head: (ctx, x, y, r, pp) => { orcHead(SK.orc)(ctx, x, y, r, pp); skullMask(ctx, x, y, r, pp); },
    torsoDeco: (ctx, p, o) => { for (let i = 0; i < 5; i++) circle(ctx, o.shX - 10 + i * 6, o.shY + 6 + Math.sin(i) * 2, 3, '#efe8d3', 1.5); ctx.fillStyle = col('#4f8a2a'); ctx.fillRect(o.hipX - 20, o.hipY - 10, 40, 6); },
    frontArm: (p, s) => ({ a1: 2.2 - (p.windup || 0) * 1.0 - s.sw * 0.2, a2: -0.6 }),
    weapon: staff('#8bff5a', 'rgba(140,255,90,0.85)'), slash: false,
  }));

  // ------------------------------------------------------------------ Goblin Arquero
  reg('enemy_goblin_arquero', (ctx, p) => {
    const pull = p.windup || 0;
    humanoid(ctx, p, {
      bulk: 0.85, leg: 0.8, skin: SK.goblin, cloth: '#5a6b34', pants: '#4d3a28', boots: '#3f2a16', belt: '#4a2e16', headR: 18,
      head: goblinHead(SK.goblin, { hat: (ctx, x, y, r) => { ctx.beginPath(); ctx.moveTo(x - r * 1.1, y - r * 0.2); ctx.quadraticCurveTo(x - r * 0.2, y - r * 1.6, x + r * 1.0, y - r * 0.4); ctx.closePath(); ctx.fillStyle = col('#3f5a28'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); } }),
      frontArm: (p2) => ({ a1: 1.45 + (p2.strike || 0) * 0.05, a2: 0.04 }),
      backArm: () => ({ a1: 0.55 + pull * 0.78, a2: -0.45 * (1 - pull) }),
      weapon: (ctx, p2, fh) => bowAt(ctx, fh, pull, pull > 0.05, '#7a5a30'), slash: false,
    });
  });

  // ------------------------------------------------------------------ Orco Berserker
  reg('enemy_orco_berserker', (ctx, p) => {
    const rage = p.rage || 0;
    humanoid(ctx, p, {
      bulk: 1.15, lean: 1.6, skin: '#b8503a', cloth: '#b8503a', pants: '#5a3a22', boots: '#3e2a1a', belt: '#4a2e16', headR: 17,
      head: orcHead('#b8503a', { hat: mohawk('#ff8a2a'), eye: rage ? '#ff3a2a' : '#ffe25a' }),
      torsoDeco: (ctx, p, o) => { for (let i = 0; i < 3; i++) line(ctx, o.hipX - 14, o.shY + 10 + i * 8, o.hipX + 16, o.shY + 5 + i * 8, 3, col('#3a1a14')); line(ctx, o.shX - 16, o.shY + 2, o.hipX + 16, o.hipY - 4, 5, col('#5c3a1a')); },
      offhand: (ctx, p, bh) => axe(26)(ctx, p, Object.assign({}, bh, { ang: bh.ang + 0.6 })),
      backArm: (p, s) => ({ a1: 0.2 + s.sw * 0.5 - (p.windup || 0) * 2.2 + (p.strike || 0) * 1.0, a2: -0.6 }),
      weapon: axe(28), slashR: 38,
    });
  });

  // ------------------------------------------------------------------ Orco Tamborilero
  reg('enemy_orco_tambor', (ctx, p) => {
    const t = p.t || 0, beat = Math.max(0, Math.sin(t * 9));
    humanoid(ctx, p, {
      bulk: 1.3, skin: SK.orc, cloth: '#6b4a2e', pants: '#4d3a28', boots: '#3e2a1a', headR: 18,
      head: orcHead(SK.orc, { hat: hornHelm('#6b5038') }),
      mid: (ctx, p, o) => {
        const dx = o.shX + 14, dy = (o.hipY + o.shY) / 2 + 4;
        oval(ctx, dx, dy, 15, 22, '#a8423a');
        oval(ctx, dx + 13, dy, 6, 22, '#efe2c0');
        for (let i = -2; i <= 2; i++) line(ctx, dx - 12, dy + i * 8, dx + 10, dy + i * 8 - 4, 1.6, col('#d8b46a'));
      },
      frontArm: (p, s) => ({ a1: 1.6 - beat * 0.9, a2: -0.9 + beat * 0.4 }),
      backArm: (p, s) => ({ a1: 1.2 - Math.max(0, Math.sin(t * 9 + Math.PI)) * 0.9, a2: -0.6 }),
      weapon: (ctx, p, fh) => { line(ctx, fh.x, fh.y, fh.x + 16, fh.y - 10, 5, INK); line(ctx, fh.x, fh.y, fh.x + 16, fh.y - 10, 2.5, col('#d8b46a')); circle(ctx, fh.x + 17, fh.y - 11, 3.5, '#efe2c0', 2); },
      slash: false,
    });
  });

  // ------------------------------------------------------------------ Goblin Topo
  reg('enemy_goblin_topo', (ctx, p) => humanoid(ctx, p, {
    bulk: 0.85, leg: 0.8, lean: 1.8, skin: SK.goblin, cloth: '#7a6a4a', pants: '#5a4a3a', boots: '#3f2a16', belt: '#4a2e16', headR: 18,
    head: goblinHead(SK.goblin, { hat: miningHelmet }),
    weapon: (ctx, p, fh) => {
      ctx.save(); ctx.translate(fh.x, fh.y); ctx.rotate(-fh.ang - 1.2);
      line(ctx, 0, -12, 0, 30, 7, INK); line(ctx, 0, -12, 0, 30, 4, col('#a8733f'));
      ctx.beginPath(); ctx.moveTo(-9, 28); ctx.quadraticCurveTo(0, 46, 9, 28); ctx.lineTo(7, 26); ctx.lineTo(-7, 26); ctx.closePath(); ctx.fillStyle = col('#9aa3ad'); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      ctx.restore();
    },
    slashR: 28,
  }));

  // ------------------------------------------------------------------ Troll del Musgo
  reg('enemy_troll', (ctx, p) => humanoid(ctx, p, {
    bulk: 1.75, leg: 1.05, legW: 1.25, armW: 1.4, torsoW: 1.15, lean: 1.4,
    skin: '#6f9a5a', cloth: '#6f9a5a', pants: '#6f9a5a', boots: '#4f7040', belt: '#5c3a1a', headR: 15,
    head: (ctx, x, y, r, pp) => {
      const head = () => { ctx.beginPath(); ctx.ellipse(x + r * 0.2, y, r * 1.15, r * 1.0, 0, 0, TAU); };
      head(); ctx.fillStyle = col('#6f9a5a'); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
      oval(ctx, x + r * 1.15, y + r * 0.2, r * 0.42, r * 0.34, '#6f9a5a', 0.2);
      oval(ctx, x + r * 0.5, y - r * 0.32, r * 0.75, r * 0.22, '#4f7040', 0, 0);
      circle(ctx, x + r * 0.42, y - r * 0.12, r * 0.15, '#ffe25a', 2); circle(ctx, x + r * 0.85, y - r * 0.12, r * 0.13, '#ffe25a', 2);
      oval(ctx, x + r * 0.5, y + r * 0.65, r * 0.75, r * 0.38, '#6f9a5a');
      poly(ctx, [x + r * 0.1, y + r * 0.55, x + r * 0.22, y + r * 0.15, x + r * 0.34, y + r * 0.55], '#f6efd9', 2);
      poly(ctx, [x + r * 0.7, y + r * 0.55, x + r * 0.82, y + r * 0.12, x + r * 0.94, y + r * 0.55], '#f6efd9', 2);
      for (let i = 0; i < 4; i++) oval(ctx, x - r * 0.5 + i * r * 0.35, y - r * 0.9, r * 0.25, r * 0.14, '#4a8a2a', 0, 2);
    },
    torsoDeco: (ctx, p, o) => { oval(ctx, o.hipX + 4, o.hipY - 14, o.tw * 0.7, 12, '#8fb877', 0, 0); for (const [mx, my] of [[-14, -40], [6, -46], [-4, -24]]) oval(ctx, o.hipX + mx, o.hipY + my, 6, 4, '#3f7a2a', 0, 0); ctx.fillStyle = col('#7a5a3a'); ctx.fillRect(o.hipX - 30, o.hipY - 4, 60, 14); },
    weapon: club(40), slashR: 44,
  }));

  // ------------------------------------------------------------------ Ariete de Guerra
  reg('enemy_orco_ariete', (ctx, p) => {
    const carrier = (dx, dy, s, phOff) => {
      ctx.save(); ctx.translate(dx, dy); ctx.scale(s, s);
      humanoid(ctx, Object.assign({}, p, { phase: (p.phase || 0) + phOff, windup: 0, strike: 0 }), {
        bulk: 1.05, skin: SK.orc, cloth: '#7a5a3a', pants: '#5b4532', boots: '#3e2a1a', belt: '#4a2e16', headR: 16,
        head: orcHead(SK.orc, { hat: ironCap('#8d96a3') }), frontArm: () => ({ a1: 2.1, a2: 0.4 }), backArm: () => ({ a1: 1.8, a2: 0.6 }), slash: false,
      });
      ctx.restore();
    };
    const push = (p.windup || 0) * -10 + (p.strike || 0) * 16;
    carrier(-30, -6, 0.86, Math.PI);
    // tronco con cabeza de carnero de hierro
    ctx.save(); ctx.translate(push, 0);
    const ly = -60;
    ctx.beginPath(); ctx.moveTo(-74, ly - 12); ctx.lineTo(56, ly - 12); ctx.quadraticCurveTo(62, ly, 56, ly + 12); ctx.lineTo(-74, ly + 12); ctx.quadraticCurveTo(-80, ly, -74, ly - 12); ctx.closePath();
    ctx.fillStyle = col('#9a6a3a'); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    for (let i = 0; i < 5; i++) line(ctx, -62 + i * 24, ly - 6, -48 + i * 24, ly - 6, 2, col('#6f4723'));
    oval(ctx, -74, ly, 6, 12, '#c49a62');
    for (const bx of [-40, 10]) poly(ctx, [bx, ly - 14, bx + 7, ly - 14, bx + 7, ly + 14, bx, ly + 14], '#4a4f5a', 2.5);
    oval(ctx, 66, ly, 18, 16, '#6b717c');
    ctx.beginPath(); ctx.arc(62, ly - 2, 13, -2.6, 0.6); ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 5.5; ctx.strokeStyle = col('#d9cfb3'); ctx.stroke();
    circle(ctx, 74, ly - 3, 2.5, '#ff4a3a', 0);
    ctx.restore();
    carrier(8, 2, 0.94, 0);
  });
})();
