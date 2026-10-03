/* Bastión Bravo · efectos visuales de la batalla (partículas, números, rayos, explosiones...) */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);

  const NUM_COLORS = {
    physical: '#ffffff', fire: '#ffae3d', ice: '#9fe7ff', lightning: '#fff35c', arcane: '#d79bff',
    poison: '#9dff6a', holy: '#ffe58a', true: '#ffffff', crit: '#ffd23f', heal: '#6dff8f', castle: '#ff5a4a',
    weak: '#ff9a3d', resist: '#b9b9b9', gold: '#ffd23f', shield: '#8fd3ff',
  };

  // Efectos vacíos para las simulaciones sin dibujo
  const NOOP = () => {};
  function NoopFX() {}
  ['explosion', 'ring', 'particles', 'text', 'number', 'shake', 'flash', 'beam', 'lightning', 'smoke',
   'coins', 'zone', 'update', 'draw', 'banner', 'trail', 'clear'].forEach(k => { NoopFX.prototype[k] = NOOP; });

  class FX {
    constructor() {
      this.parts = []; this.nums = []; this.rings = []; this.beams = []; this.bolts = [];
      this.zones = []; this.texts = []; this.banners = [];
      this.shakeMag = 0; this.shakeT = 0; this.flashColor = null; this.flashT = 0; this.flashMax = 0;
      this.quality = 1;
    }
    get low() { return this.quality < 1; }
    clear() { this.parts.length = this.nums.length = this.rings.length = this.beams.length = this.bolts.length = 0; this.zones.length = this.texts.length = this.banners.length = 0; }
    addPart(p) {
      const cap = this.low ? 260 : 650;
      if (this.parts.length >= cap) this.parts.shift();
      p.max = p.life; p.rot = p.rot || 0; p.vr = p.vr || 0;
      this.parts.push(p);
    }

    particles(x, y, o) {
      o = o || {};
      let n = Math.round((o.n || 10) * (this.low ? 0.4 : 1));
      const sp = o.speed || 160;
      for (let i = 0; i < n; i++) {
        const a = o.angle != null ? o.angle + rnd(-(o.spread || 0.6), o.spread || 0.6) : rnd(0, TAU);
        const s = sp * rnd(0.35, 1);
        this.addPart({
          x: x + rnd(-(o.jitter || 0), o.jitter || 0), y: y + rnd(-(o.jitter || 0), o.jitter || 0),
          vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up || 0),
          life: (o.life || 0.6) * rnd(0.7, 1.25), size: (o.size || 5) * rnd(0.7, 1.3),
          color: Array.isArray(o.color) ? o.color[(Math.random() * o.color.length) | 0] : (o.color || '#ffffff'),
          gravity: o.gravity != null ? o.gravity : 400, kind: o.kind || 'spark', add: !!o.add,
          shrink: o.shrink !== false, drag: o.drag || 0, rot: rnd(0, TAU), vr: rnd(-8, 8),
        });
      }
    }
    smoke(x, y, n) {
      this.particles(x, y, { n: n || 8, kind: 'smoke', color: ['#6b6460', '#857c77', '#5a5350'], speed: 50, up: 40, gravity: -30, life: 1.2, size: 16, shrink: false });
    }
    explosion(x, y, r, o) {
      o = o || {};
      r = r || 60;
      const c = o.color || '#ff8a2a';
      this.ring(x, y, r, { color: o.ringColor || 'rgba(255,220,150,0.9)', dur: 0.35, width: 6 });
      this.addPart({ x, y, vx: 0, vy: 0, life: 0.25, size: r * 1.3, color: o.flash || 'rgba(255,240,200,0.9)', gravity: 0, kind: 'glow', add: true, shrink: false });
      this.particles(x, y, { n: Math.round(10 + r / 6), kind: 'fire', color: o.colors || ['#ffe46b', '#ffa02e', c], speed: r * 4, life: 0.5, size: 8 + r / 12, gravity: -60, add: true, drag: 3 });
      this.particles(x, y, { n: Math.round(5 + r / 12), kind: 'smoke', color: ['#5d5452', '#776e6a'], speed: r * 1.6, up: 40, life: 1.0, size: 12 + r / 8, gravity: -40, shrink: false, drag: 2 });
      this.particles(x, y, { n: Math.round(4 + r / 15), kind: 'debris', color: o.debris || ['#6b4a2b', '#8a6a44', '#5b5b5b'], speed: r * 3.5, up: 220, life: 0.9, size: 5, gravity: 900 });
      if (r >= 70) this.shake(Math.min(14, r / 9), 0.3);
    }
    ring(x, y, r, o) {
      o = o || {};
      this.rings.push({ x, y, r, color: o.color || 'rgba(255,255,255,0.9)', life: o.dur || 0.4, max: o.dur || 0.4, width: o.width || 4, fill: o.fill || null, grow: o.grow !== false });
    }
    zone(x, y, r, o) {
      o = o || {};
      this.zones.push({ x, y, r, color: o.color || 'rgba(120,200,80,0.35)', edge: o.edge || null, life: o.dur || 3, max: o.dur || 3, kind: o.kind || 'circle', seed: Math.random() * 1000 });
    }
    beam(x1, y1, x2, y2, o) {
      o = o || {};
      this.beams.push({ x1, y1, x2, y2, color: o.color || '#fff6a0', width: o.width || 8, life: o.dur || 0.25, max: o.dur || 0.25 });
    }
    lightning(pts, o) {
      o = o || {};
      if (!pts || pts.length < 2) return;
      this.bolts.push({ pts: pts.map(p => ({ x: p.x, y: p.y })), color: o.color || '#a8e8ff', width: o.width || 4, life: o.dur || 0.28, max: o.dur || 0.28 });
    }
    text(x, y, str, o) {
      o = o || {};
      this.texts.push({ x, y, str: String(str), color: o.color || '#ffffff', size: o.size || 26, life: o.dur || 1.2, max: o.dur || 1.2, vy: o.vy != null ? o.vy : -40 });
    }
    banner(str, o) {
      o = o || {};
      // Los carteles no se solapan: el nuevo espera a que termine el anterior
      const last = this.banners[this.banners.length - 1];
      const wait = last ? Math.max(0, last.life + (last.delay || 0) - 0.2) : 0;
      this.banners.push({ str: String(str), sub: o.sub || '', color: o.color || '#ffcf3d', life: o.dur || 2, max: o.dur || 2, delay: wait });
    }
    number(x, y, v, kind) {
      if (this.nums.length > 70) this.nums.shift();
      const big = kind === 'crit';
      let str;
      if (typeof v === 'number') {
        const n = Math.round(v);
        if (n <= 0 && kind !== 'heal') return;
        str = (kind === 'heal' ? '+' : '') + BB.util.fmt(n) + (big ? '!' : '');
      } else str = String(v);
      this.nums.push({
        x: x + rnd(-10, 10), y, str, color: NUM_COLORS[kind] || '#ffffff',
        size: big ? 34 : kind === 'castle' ? 26 : kind === 'resist' ? 17 : kind === 'weak' ? 25 : 21,
        life: big ? 1.0 : 0.8, max: big ? 1.0 : 0.8, vy: big ? -95 : -70, vx: rnd(-20, 20), pop: big ? 1.6 : 1.2,
      });
    }
    coins(x, y, n) {
      n = Math.min(6, n || 3);
      for (let i = 0; i < n; i++) {
        this.addPart({ x, y, vx: rnd(-120, 120), vy: rnd(-260, -140), life: rnd(0.7, 1.0), size: 7, color: '#ffd23f', gravity: 700, kind: 'coin', shrink: false, bounce: true, ground: BB.WORLD.GROUND + rnd(-4, 8) });
      }
    }
    shake(mag, dur) { if (mag > this.shakeMag || this.shakeT <= 0) { this.shakeMag = mag; this.shakeT = dur || 0.25; } }
    flash(color, dur) { this.flashColor = color || 'rgba(255,255,255,0.6)'; this.flashT = this.flashMax = dur || 0.2; }
    trail(x, y, color, size, add) {
      this.addPart({ x, y, vx: rnd(-15, 15), vy: rnd(-15, 15), life: 0.3, size: size || 6, color, gravity: 0, kind: add ? 'glow' : 'spark', add: !!add });
    }

    update(dt) {
      const G = BB.WORLD.GROUND;
      for (const p of this.parts) {
        p.life -= dt;
        if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.bounce && p.y > p.ground) { p.y = p.ground; p.vy *= -0.4; p.vx *= 0.6; if (Math.abs(p.vy) < 40) { p.vy = 0; p.gravity = 0; } }
        if (p.kind === 'debris' && p.y > G + 6) { p.y = G + 6; p.vy *= -0.3; p.vx *= 0.5; }
      }
      this.parts = this.parts.filter(p => p.life > 0);
      for (const n of this.nums) { n.life -= dt; n.y += n.vy * dt; n.x += n.vx * dt; n.vy += 110 * dt; }
      this.nums = this.nums.filter(n => n.life > 0);
      for (const a of [this.rings, this.beams, this.bolts, this.zones, this.texts]) for (const o of a) o.life -= dt;
      for (const b of this.banners) { if (b.delay > 0) b.delay -= dt; else b.life -= dt; }
      for (const t of this.texts) t.y += t.vy * dt;
      this.rings = this.rings.filter(o => o.life > 0);
      this.beams = this.beams.filter(o => o.life > 0);
      this.bolts = this.bolts.filter(o => o.life > 0);
      this.zones = this.zones.filter(o => o.life > 0);
      this.texts = this.texts.filter(o => o.life > 0);
      this.banners = this.banners.filter(o => o.life > 0);
      if (this.shakeT > 0) this.shakeT -= dt;
      if (this.flashT > 0) this.flashT -= dt;
    }

    shakeOffset() {
      if (this.shakeT <= 0) return { x: 0, y: 0 };
      const m = this.shakeMag * Math.min(1, this.shakeT * 4);
      return { x: rnd(-m, m), y: rnd(-m, m) };
    }

    // Capa de suelo (zonas persistentes) — en coordenadas del mundo
    drawGround(ctx, t) {
      for (const z of this.zones) {
        const a = Math.min(1, z.life / 0.4, (z.max - z.life) / 0.2 + 0.2);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(z.x, z.y);
        ctx.scale(1, 0.32);
        const g = ctx.createRadialGradient(0, 0, z.r * 0.1, 0, 0, z.r);
        g.addColorStop(0, z.color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.fill();
        if (z.edge) {
          ctx.setLineDash([16, 12]); ctx.lineDashOffset = -t * 30;
          ctx.strokeStyle = z.edge; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.arc(0, 0, z.r * 0.96, 0, TAU); ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Capa superior: partículas, rayos, anillos, números...
    draw(ctx, t) {
      ctx.save();
      for (const r of this.rings) {
        const k = 1 - r.life / r.max;
        const rad = r.grow ? r.r * (0.3 + 0.7 * Math.sqrt(k)) : r.r;
        ctx.globalAlpha = Math.max(0, r.life / r.max);
        if (r.fill) { ctx.fillStyle = r.fill; ctx.beginPath(); ctx.ellipse(r.x, r.y, rad, rad * 0.45, 0, 0, TAU); ctx.fill(); }
        ctx.strokeStyle = r.color; ctx.lineWidth = r.width * (1 - k * 0.6);
        ctx.beginPath(); ctx.ellipse(r.x, r.y, rad, rad * 0.45, 0, 0, TAU); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (const b of this.beams) {
        const a = b.life / b.max;
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.globalAlpha = a * 0.55; ctx.strokeStyle = b.color; ctx.lineWidth = b.width * 2.6;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
        ctx.globalAlpha = a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = b.width * 0.6;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = 1;
      for (const bo of this.bolts) {
        const a = bo.life / bo.max;
        ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let i = 0; i < bo.pts.length - 1; i++) {
          const p0 = bo.pts[i], p1 = bo.pts[i + 1];
          const n = 7;
          ctx.beginPath(); ctx.moveTo(p0.x, p0.y);
          for (let k = 1; k < n; k++) {
            const f = k / n;
            ctx.lineTo(p0.x + (p1.x - p0.x) * f + rnd(-14, 14), p0.y + (p1.y - p0.y) * f + rnd(-14, 14));
          }
          ctx.lineTo(p1.x, p1.y);
          ctx.globalAlpha = a * 0.5; ctx.strokeStyle = bo.color; ctx.lineWidth = bo.width * 2.8; ctx.stroke();
          ctx.globalAlpha = a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = bo.width * 0.8; ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = 1;
      for (const p of this.parts) {
        const a = Math.max(0, Math.min(1, p.life / p.max));
        const s = Math.max(0.5, p.shrink ? p.size * (0.35 + 0.65 * a) : p.size * (1 + (1 - a) * 1.2));
        if (p.add) ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = p.kind === 'smoke' ? a * 0.5 : a;
        ctx.fillStyle = p.color;
        switch (p.kind) {
          case 'glow': {
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
            g.addColorStop(0, p.color); g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU); ctx.fill();
            break;
          }
          case 'debris':
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-s * 0.8, -s * 0.5, s * 1.6, s); ctx.restore();
            break;
          case 'ice':
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
            ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.45, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.45, 0); ctx.closePath(); ctx.fill();
            ctx.restore();
            break;
          case 'leaf':
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
            ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.45, 0, 0, TAU); ctx.fill(); ctx.restore();
            break;
          case 'coin':
            ctx.beginPath(); ctx.ellipse(p.x, p.y, s * Math.abs(Math.cos(p.rot)) + 1, s, 0, 0, TAU); ctx.fill();
            ctx.strokeStyle = '#a86b00'; ctx.lineWidth = 1.5; ctx.stroke();
            break;
          case 'star': {
            ctx.beginPath();
            for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.45 : s; const an = p.rot + i * Math.PI / 5; ctx.lineTo(p.x + Math.cos(an) * r, p.y + Math.sin(an) * r); }
            ctx.closePath(); ctx.fill();
            break;
          }
          case 'bubble':
            ctx.strokeStyle = p.color; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU); ctx.stroke();
            break;
          default:
            ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      for (const tx of this.texts) {
        const a = Math.min(1, tx.life / tx.max * 2.5);
        ctx.globalAlpha = a;
        ctx.font = tx.size + 'px "Lilita One", "Arial Black", sans-serif';
        ctx.lineWidth = tx.size * 0.22; ctx.strokeStyle = '#1e1527'; ctx.strokeText(tx.str, tx.x, tx.y);
        ctx.fillStyle = tx.color; ctx.fillText(tx.str, tx.x, tx.y);
      }
      for (const n of this.nums) {
        const k = 1 - n.life / n.max;
        const pop = k < 0.12 ? 1 + (n.pop - 1) * (k / 0.12) : n.pop - (n.pop - 1) * Math.min(1, (k - 0.12) / 0.2);
        ctx.globalAlpha = Math.min(1, n.life / n.max * 3);
        const size = n.size * pop;
        ctx.font = size + 'px "Lilita One", "Arial Black", sans-serif';
        ctx.lineWidth = Math.max(3, size * 0.2); ctx.strokeStyle = '#1e1527';
        ctx.strokeText(n.str, n.x, n.y);
        ctx.fillStyle = n.color; ctx.fillText(n.str, n.x, n.y);
      }
      ctx.restore();
    }
  }

  BB.FX = FX;
  BB.createFX = function (headless) { return headless ? new NoopFX() : new FX(); };
})();
