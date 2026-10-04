/* Bastión Bravo · Jefes — BB.data.bosses (10 jefes, uno cada 10 niveles)
   Dueño: agente «Enemigos y jefes». Contrato: docs/DISENO.md §2.3, §4.5, §4.7 y §4.13.

   · `hp` es la vida BASE de nivel 1: el motor la multiplica por BB.balance.bossHp(nivel del jefe).
     Se calculó para ~65–70 s de daño puro con el poder esperado del jugador en ese punto
     (héroes a nivel ≈ 0,9 × nivel, 3 + (zona−1)·0,8 héroes, ~12 DPS por héroe a nivel 1 × heroDmg);
     escudos, curas, invulnerabilidades y esbirros alargan el combate hasta ~80–100 s.
   · El motor gestiona fases (banner, destello y rugido), temporizadores de ataques y la barra grande.
     Aquí van los efectos propios: avisos de ~1 s antes de los ataques fuertes, proyectiles enemigos,
     esbirros, curas, escudos, inmunidades, entierros, vuelo, desactivar héroes, etc.
   · Las utilidades vienen de BB.enemyKit (enemies.js) y se resuelven al ejecutar los hooks. */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  BB.data = BB.data || {};
  const TAU = Math.PI * 2;

  // ---- acceso perezoso al kit de enemies.js (orden de carga indiferente)
  const KF = name => function () { const K = BB.enemyKit; return K ? K[name].apply(null, arguments) : undefined; };
  const fx = KF('fx'), sfx = KF('sfx'), say = KF('say'), telegraph = KF('telegraph'), summon = KF('summon');
  const shoot = KF('shoot'), hitCastle = KF('hitCastle'), disableHeroes = KF('disableHeroes'), siegePoint = KF('siegePoint');
  const frontX = KF('frontX'), blockAhead = KF('blockAhead'), damageBlock = KF('damageBlock'), killSelf = KF('killSelf');
  const buffEnemy = KF('buffEnemy'), setSpeedMod = KF('setSpeedMod'), speedMul = KF('speedMul'), overlay = KF('overlay');
  const makeUndead = KF('makeUndead'), heroPool = KF('heroPool'), shuffle = KF('shuffle'), roundRect = KF('roundRect');
  const drawSkull = KF('drawSkull');
  const W = () => BB.WORLD || { GROUND: 560, WALL_X: 1235, CASTLE_X: 1300, SPAWN_X: -60 };
  const now = B => (B && typeof B.t === 'number' ? B.t : 0);
  const rnd = B => (B && typeof B.rng === 'function' ? B.rng() : Math.random());
  const rand = (B, a, b) => a + (b - a) * rnd(B);
  const data = e => e.data || (e.data = {});
  const alive = e => !!e && !e.dead && !e.removed && e.hp > 0;
  const sizeOf = e => ((e && (e.size || (e.def && e.def.size))) || 240) * ((e && e.scale) || 1);
  const footY = e => (e.air ? e.y + sizeOf(e) * 0.5 : e.y);
  const topY = e => footY(e) - sizeOf(e);
  const midY = e => (e.air ? e.y : e.y - sizeOf(e) * 0.45);
  const held = e => !!(e.status && (e.status.freeze || e.status.stun));
  const phaseOf = b => (typeof b.phase === 'number' ? b.phase : (data(b).phase || 0));
  const hand = b => ({ x: b.x + sizeOf(b) * 0.22, y: topY(b) + sizeOf(b) * 0.32 });

  const reported = Object.create(null);
  function guard(where, fn, fallback) {
    return function () {
      try { return fn.apply(this, arguments); } catch (err) {
        if (!reported[where]) { reported[where] = true; console.error('[jefes] error en ' + where + ':', err); }
        return typeof fallback === 'function' ? fallback.apply(this, arguments) : fallback;
      }
    };
  }
  function nearWall(B, b, dist) { return frontX(B, b) - b.x < (dist || 70); }
  function countType(B, type) { let n = 0; for (const e of B.enemies || []) if (e.type === type && alive(e)) n++; return n; }

  /* ======================================================================== *
   *  MECÁNICAS COMUNES DE JEFE                                                *
   * ======================================================================== */
  // Escudo que absorbe daño. o: { pct (de la vida máxima), mul:{tipo:×}, rgb:'r,g,b', name, regenDelay, regenPct, reform }
  function giveShield(B, b, o) {
    const max = b.maxHp * o.pct;
    data(b).shield = { hp: max, max, mul: o.mul || {}, rgb: o.rgb || '143,214,255', name: o.name || 'Escudo',
      regenDelay: o.regenDelay || 0, regenPct: o.regenPct || 0, reform: o.reform || 0, lastHit: now(B), brokenAt: -1, hint: o.hint || '' };
    if (!B.headless) {
      fx(B, 'ring', b.x, midY(b), sizeOf(b) * 0.7, { color: 'rgba(' + (o.rgb || '143,214,255') + ',0.95)', dur: 0.6, width: 8 });
      fx(B, 'text', b.x, topY(b) - 40, '¡' + (o.name || 'Escudo') + '!', { color: 'rgb(' + (o.rgb || '143,214,255') + ')', size: 30, dur: 1.6 });
      if (o.hint) fx(B, 'text', b.x, topY(b) - 6, o.hint, { color: '#ffffff', size: 20, dur: 2.2, vy: -10 });
    }
    sfx(B, 'shield', 0.3);
  }
  function shieldAbsorb(B, b, amount, info) {
    const s = data(b).shield;
    if (!s || s.hp <= 0 || info.type === 'true') return amount;
    const m = s.mul[info.type] || 1;
    const eff = amount * m;
    const ab = Math.min(s.hp, eff);
    s.hp -= ab; s.lastHit = now(B);
    if (!B.headless && Math.random() < 0.3) fx(B, 'particles', b.x - sizeOf(b) * 0.3, midY(b), { n: 3, color: 'rgb(' + s.rgb + ')', speed: 140, life: 0.3, size: 4, gravity: 0, add: true });
    if (m > 1) say(B, b, 'shweak', '¡Muy eficaz!', '#ffe066', 1.5, 22);
    if (s.hp <= 0) {
      s.hp = 0; s.brokenAt = now(B);
      if (!B.headless) {
        fx(B, 'particles', b.x, midY(b), { n: 34, color: ['rgb(' + s.rgb + ')', '#ffffff'], kind: 'ice', speed: 380, life: 0.9, size: 8, gravity: 500 });
        fx(B, 'ring', b.x, midY(b), sizeOf(b) * 0.8, { color: '#ffffff', dur: 0.5, width: 8 });
        fx(B, 'text', b.x, topY(b) - 30, '¡' + s.name + ' roto!', { color: '#ffffff', size: 30, dur: 1.6 });
        fx(B, 'shake', 8, 0.3);
      }
      sfx(B, 'wall_break', 0.3);
      if (!s.reform) data(b).shield = null;
    }
    return Math.max(0, (eff - ab) / m);
  }
  function shieldTick(B, b, dt) {
    const s = data(b).shield;
    if (!s) return;
    if (s.hp <= 0) {
      if (s.reform && s.brokenAt >= 0 && now(B) - s.brokenAt > s.reform) {
        s.hp = s.max; s.lastHit = now(B);
        if (!B.headless) fx(B, 'text', b.x, topY(b) - 30, '¡' + s.name + ' se regenera!', { color: 'rgb(' + s.rgb + ')', size: 26, dur: 1.6 });
        sfx(B, 'shield', 0.3);
      }
      return;
    }
    if (s.regenPct && now(B) - s.lastHit > s.regenDelay && s.hp < s.max) s.hp = Math.min(s.max, s.hp + s.max * s.regenPct * dt);
  }

  // Carga en línea recta (con retroceso si ya está pegado). o: { speed, mul, text }
  function startDash(B, b, o) {
    const toX = frontX(B, b);
    data(b).dash = { speed: o.speed || 520, toX, backX: toX - b.x < 140 ? b.x - 170 : null, mul: o.mul || 3, color: o.color || '#ffd23f', label: o.label || '¡CRASH!' };
  }
  function dashTick(B, b, dt) {
    const d = data(b), ds = d.dash;
    if (!ds) return false;
    if (held(b)) return true;
    b.state = 'walk';
    if (ds.backX != null) {
      b.x -= 260 * dt;
      if (b.x <= ds.backX) ds.backX = null;
      return true;
    }
    ds.toX = frontX(B, b);
    b.x += ds.speed * speedMul(B, b) * dt;
    if (!B.headless && Math.random() < 0.6) fx(B, 'particles', b.x - sizeOf(b) * 0.3, W().GROUND - 4, { n: 2, kind: 'smoke', color: ['#cfc8bd', '#a99f93'], speed: 60, up: 40, gravity: -20, life: 0.6, size: 14, shrink: false });
    if (b.x >= ds.toX) {
      b.x = ds.toX; d.dash = null;
      const bar = blockAhead(B, b);
      if (bar && b.x < bar.x) damageBlock(B, bar, b.damage * ds.mul);
      else hitCastle(B, b.damage * ds.mul, { source: b });
      if (!B.headless) {
        fx(B, 'explosion', b.x + sizeOf(b) * 0.3, W().GROUND - 60, 90, { color: ds.color, debris: ['#8a6a44', '#b9a48a', '#6f4723'] });
        fx(B, 'text', b.x + 40, topY(b) - 10, ds.label, { color: '#ffffff', size: 34, dur: 1 });
        fx(B, 'shake', 16, 0.5);
      }
      sfx(B, 'hit_heavy', 0.1);
    }
    return true;
  }

  // Despegar / aterrizar. Los voladores tienen e.y en el centro del cuerpo; los terrestres, en los pies.
  function land(B, b, dur) {
    const G = W().GROUND, s = sizeOf(b);
    data(b).lift = { from: b.y, to: G - s * 0.5, t: 0, dur: dur || 1.1, endAir: false };
  }
  function takeOff(B, b, toY, dur) {
    const G = W().GROUND, s = sizeOf(b);
    if (!b.air) { b.air = true; b.y = G - s * 0.5; }
    data(b).lift = { from: b.y, to: toY, t: 0, dur: dur || 1.2, endAir: true };
  }
  function liftTick(B, b, dt) {
    const L = data(b).lift;
    if (!L) return false;
    L.t += dt;
    const k = Math.min(1, L.t / L.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    b.y = L.from + (L.to - L.from) * e;
    b.state = 'attack';
    if (!B.headless && Math.random() < 0.5) fx(B, 'particles', b.x + rand(B, -60, 60), W().GROUND - 4, { n: 2, kind: 'smoke', color: ['#cfc8bd', '#a99f93'], speed: 90, up: 30, gravity: -10, life: 0.7, size: 16, shrink: false });
    if (k >= 1) {
      data(b).lift = null;
      if (!L.endAir) {
        b.air = false; b.y = W().GROUND;
        if (!B.headless) { fx(B, 'shake', 18, 0.6); fx(B, 'explosion', b.x, W().GROUND - 20, 120, { color: '#cfc8bd', debris: ['#6b4a2b', '#8a6a44'] }); }
        sfx(B, 'hit_heavy', 0.2);
      }
    }
    return true;
  }

  // Lluvia de proyectiles desde el cielo sobre muralla / castillo
  function skyStrike(B, b, n, o) {
    const pts = o.points || [];
    for (let i = 0; i < n; i++) {
      const p = pts[i] || siegePoint(B, o);
      B.after(i * (o.gap || 0.15), function () {
        if (B.over) return;
        shoot(B, { x: p.x - 260 + rand(B, -60, 60), y: -80 }, { kind: o.kind || 'fireball', to: p, speed: o.speed || 900, size: o.size || 15,
          color: o.color, damage: o.damage, type: o.type || 'fire', ignoreWall: o.ignoreWall, source: b, radius: o.radius || 50, hitSound: o.hitSound || 'explosion', colors: o.colors });
      });
    }
  }
  function pickPoints(B, n, o) { const a = []; for (let i = 0; i < n; i++) a.push(siegePoint(B, o)); return a; }

  // ---- capa de dibujo del jefe (escudos, piel de piedra, lava, protección...)
  function drawBossOverlay(ctx, b, B) {
    if (b.removed || b.dead) return;
    const d = data(b), t = now(B), s = sizeOf(b), cx = b.x, cy = midY(b);
    const sh = d.shield;
    if (sh && sh.hp > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 5);
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(cx, cy, s * 0.15, cx, cy, s * 0.62);
      g.addColorStop(0, 'rgba(' + sh.rgb + ',0.02)'); g.addColorStop(0.8, 'rgba(' + sh.rgb + ',' + (0.16 + pulse * 0.08) + ')'); g.addColorStop(1, 'rgba(' + sh.rgb + ',0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.5, s * 0.58, 0, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(' + sh.rgb + ',' + (0.55 + pulse * 0.3) + ')'; ctx.lineWidth = 4;
      ctx.setLineDash([18, 10]); ctx.lineDashOffset = -t * 40;
      ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.5, s * 0.58, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      // barrita del escudo
      const bw = 120, by = topY(b) - 18;
      ctx.fillStyle = 'rgba(20,12,24,0.85)'; roundRect(ctx, cx - bw / 2 - 2, by - 2, bw + 4, 10, 4); ctx.fill();
      ctx.fillStyle = 'rgb(' + sh.rgb + ')'; roundRect(ctx, cx - bw / 2, by, Math.max(4, bw * sh.hp / sh.max), 6, 3); ctx.fill();
    }
    if (d.stoneUntil > t) {
      ctx.globalAlpha = 0.35 + 0.1 * Math.sin(t * 6);
      ctx.fillStyle = '#8b8f97'; ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.42, s * 0.5, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.8; ctx.strokeStyle = '#3a3a42'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - s * 0.2, cy - s * 0.3); ctx.lineTo(cx - s * 0.05, cy - s * 0.1); ctx.lineTo(cx - s * 0.15, cy + s * 0.15);
      ctx.moveTo(cx + s * 0.18, cy - s * 0.2); ctx.lineTo(cx + s * 0.05, cy + s * 0.05); ctx.lineTo(cx + s * 0.2, cy + s * 0.25); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (d.lava) {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(cx, cy, s * 0.1, cx, cy, s * 0.6);
      g.addColorStop(0, 'rgba(255,120,30,' + (0.18 + 0.1 * Math.sin(t * 9)) + ')'); g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, s * 0.6, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (d.protectedBy && d.protectedBy.some(alive)) {
      const ix = cx, iy = topY(b) - 34 + Math.sin(t * 3) * 3;
      ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#1e1527'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(ix, iy - 16); ctx.lineTo(ix + 14, iy - 10); ctx.lineTo(ix + 12, iy + 6); ctx.lineTo(ix, iy + 16); ctx.lineTo(ix - 12, iy + 6); ctx.lineTo(ix - 14, iy - 10); ctx.closePath(); ctx.fill(); ctx.stroke();
      for (const g2 of d.protectedBy) if (alive(g2)) { ctx.strokeStyle = 'rgba(255,210,63,0.45)'; ctx.lineWidth = 3; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(g2.x, g2.y - 60); ctx.lineTo(cx, cy); ctx.stroke(); ctx.setLineDash([]); }
    }
    if (d.spectral) {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(cx, cy, s * 0.1, cx, cy, s * 0.65);
      g.addColorStop(0, 'rgba(180,120,255,' + (0.2 + 0.08 * Math.sin(t * 4)) + ')'); g.addColorStop(1, 'rgba(120,60,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, s * 0.65, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (d.channel) {
      const k = Math.min(1, (t - d.channel.start) / d.channel.dur);
      ctx.strokeStyle = d.channel.color || '#7dff8a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx, topY(b) - 34, 18, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
    }
  }

  /* ======================================================================== *
   *  CONSTRUCTOR DE JEFES                                                     *
   * ======================================================================== */
  const BOSSES = {};
  function boss(def) {
    const id = def.id;
    def.resist = Object.assign({ fire: 0, ice: 0, lightning: 0, arcane: 0, poison: 0, holy: 0, physical: 0 }, def.resist || {});
    def.immune = Object.assign({ slow: false, freeze: false, stun: false, root: false, knockback: true }, def.immune || {});
    def.air = !!def.air; def.range = def.range || 0; def.armor = def.armor || 0;
    def.sprite = def.sprite || 'boss_' + id;
    def.deathSound = def.deathSound || 'die_big';
    def.xp = def.xp || 50;
    const own = { onSpawn: def.onSpawn, onUpdate: def.onUpdate, onDamage: def.onDamage, onDeath: def.onDeath, onAttack: def.onAttack };

    def.onSpawn = guard(id + '.onSpawn', function (B, b) {
      data(b);
      if (!B.headless) {
        fx(B, 'banner', def.name, { sub: def.title, color: def.color || '#ff5a4a', dur: 2.4 });
        fx(B, 'flash', 'rgba(0,0,0,0.35)', 0.4);
      }
      if (own.onSpawn) own.onSpawn(B, b);
    });
    def.onUpdate = guard(id + '.onUpdate', function (B, b, dt) {
      const K = BB.enemyKit;
      if (K) K.commonUpdate(B, b, dt);
      overlay(B, b, 'boss', drawBossOverlay);
      shieldTick(B, b, dt);
      const d = data(b);
      if (d.channel && now(B) > d.channel.start + d.channel.dur + 0.5) d.channel = null;
      if (liftTick(B, b, dt)) return true;
      if (dashTick(B, b, dt)) return true;
      if (own.onUpdate && own.onUpdate(B, b, dt) === true) return true;
      if (d.holdUntil > now(B)) { b.state = 'attack'; return true; }
      return false;
    }, false);
    def.onDamage = guard(id + '.onDamage', function (B, b, amount, info) {
      info = info || {};
      const d = data(b);
      if (info.type !== 'true') {
        if (d.invulnUntil > now(B)) { say(B, b, 'inv', '¡Invulnerable!', '#dfe6ea', 1.2, 22); return 0; }
        if (d.stoneUntil > now(B) && info.type === 'physical') { say(B, b, 'stone', '¡Inmune al daño físico!', '#cfd2d8', 1.4, 22); return 0; }
      }
      let a = amount;
      if (own.onDamage) { const r = own.onDamage(B, b, a, info); if (typeof r === 'number' && r === r) a = r; }
      if (d.channel) d.channel.dmg += a;
      a = shieldAbsorb(B, b, a, info);
      const K = BB.enemyKit;
      return K ? K.commonDamage(B, b, a, info) : a;
    }, function (B, b, amount) { return amount; });
    def.onDeath = guard(id + '.onDeath', function (B, b) {
      const d = data(b);
      if (typeof d.unsub === 'function') { try { d.unsub(); } catch (_) { /* nada */ } }
      // los tótems y esbirros inmóviles caen con su jefe
      for (const e of (B.enemies || []).slice()) if (alive(e) && e.def && e.def.minionOnly) killSelf(B, e);
      if (!B.headless) {
        fx(B, 'particles', b.x, midY(b), { n: 40, color: [def.color || '#ffd23f', '#ffffff', '#ffe58a'], kind: 'star', speed: 420, life: 1.2, size: 8, gravity: 300 });
        fx(B, 'banner', '¡' + def.name + ' derrotado!', { color: '#ffe58a', dur: 2.2 });
      }
      if (own.onDeath) own.onDeath(B, b);
    });
    if (own.onAttack) def.onAttack = guard(id + '.onAttack', own.onAttack, false);
    (def.phases || []).forEach(function (ph, i) {
      const enter = ph.onEnter;
      ph.onEnter = guard(id + '.fase' + i, function (B, b) { data(b).phase = i; if (enter) enter(B, b); });
    });
    (def.attacks || []).forEach(function (a) {
      const cast = a.cast;
      a.cast = guard(id + '.' + a.id, function (B, b) {
        const d = data(b);
        if ((b.burrowed && !a.whileBurrowed) || d.dash || d.lift || held(b)) return;
        cast(B, b);
      });
    });
    BOSSES[id] = def;
    return def;
  }

  /* ======================================================================== *
   *  1 · REY GRIKKO (nivel 10)                                                *
   * ======================================================================== */
  boss({
    id: 'rey_goblin', name: 'Rey Grikko', title: 'El Rey Goblin', level: 10, color: '#ffcf3d',
    quote: '¡Todo el oro del reino será mío! ¡Guardias, a por ellos!',
    desc: 'El goblin más gordo y caprichoso del bosque. Viaja en un trono con ruedas, lanza bombas de oro y llama a su guardia.',
    weakness: 'Débil contra: fuego y daño en área para su guardia. ¡Cuidado con su embestida!',
    weakTo: ['fire', 'area'], tags: ['Jefe', 'Invoca guardias', 'Embestida'],
    size: 240, anim: 'roll', radius: 60,
    hp: 1950, speed: 30, damage: 15, atkInterval: 1.6, armor: 0.1, resist: { fire: -0.15 },
    gold: 80, xp: 60,
    phases: [
      { at: 1.0, name: '¡Larga vida al rey!' },
      { at: 0.5, name: '¡Trono a toda máquina!', onEnter(B, b) {
        setSpeedMod(b, 'trono', 1.5);
        summon(B, b, 'orco_escudo', 2, { front: true, color: ['#ffd23f', '#ffffff'] });
        if (!B.headless) fx(B, 'particles', b.x, midY(b), { n: 30, kind: 'coin', color: '#ffd23f', speed: 300, life: 1, size: 7, gravity: 600 });
      } },
    ],
    attacks: [
      { id: 'bombas_oro', name: 'Bombas de oro', every: [5, 7], phases: [0, 1], cast(B, b) {
        const n = phaseOf(b) >= 1 ? 4 : 3;
        const pts = [];
        for (let i = 0; i < n; i++) pts.push(siegePoint(B));
        telegraph(B, b, { dur: 0.75, text: '¡Bombas de oro!', textColor: '#ffd23f', color: 'rgba(255,210,63,0.95)', zones: pts.map(p => ({ x: p.x, r: 46 })), zoneColor: 'rgba(255,200,40,0.4)' }, function () {
          pts.forEach(function (p, i) {
            B.after(i * 0.2, function () {
              if (!alive(b)) return;
              shoot(B, hand(b), { kind: 'bomb', to: p, speed: 470, arc: 220 + rnd(B) * 80, size: 14, damage: b.damage * 0.7, type: 'fire', source: b,
                color: '#ffd23f', colors: ['#fff6a0', '#ffd23f', '#ffae3d'], radius: 48, hitSound: 'bomb', sound: 'whoosh',
                after(BX, x, y) { if (!BX.headless) fx(BX, 'particles', x, y, { n: 8, kind: 'coin', color: '#ffd23f', speed: 220, life: 0.8, size: 6, gravity: 700 }); } });
            });
          });
        });
      } },
      { id: 'guardia', name: '¡A mí la guardia!', every: [11, 14], phases: [0, 1], cast(B, b) {
        if (!B.headless) fx(B, 'text', b.x, topY(b) - 30, '¡A mí la guardia!', { color: '#ffd23f', size: 28, dur: 1.4 });
        sfx(B, 'roar', 0.5);
        const p2 = phaseOf(b) >= 1;
        summon(B, b, 'goblin_veloz', p2 ? 2 : 3, { front: true });
        summon(B, b, 'orco_escudo', p2 ? 2 : 1, { front: true });
      } },
      { id: 'embestida', name: 'Embestida del trono', every: [9, 12], phases: [1], cast(B, b) {
        telegraph(B, b, { dur: 1.0, hold: true, text: '¡EMBESTIDA!', textColor: '#ff7a3d', zones: [{ x: frontX(B, b) + 40, r: 90 }], sound: 'roar' }, function () {
          startDash(B, b, { speed: 560, mul: 3, color: '#ffd23f', label: '¡CRASH!' });
        });
      } },
    ],
  });

  /* ======================================================================== *
   *  2 · MOG'RATH, EL GRAN CHAMÁN (nivel 20)                                  *
   * ======================================================================== */
  boss({
    id: 'chaman_gigante', name: "Mog'Rath", title: 'El Gran Chamán', level: 20, color: '#5fd35f',
    quote: 'El pantano me da su fuerza... ¡y a vosotros, su veneno!',
    desc: 'Un chamán orco gigantesco. Se cura, levanta tótems que curan a todos y hace llover veneno sobre tu castillo.',
    weakness: 'Débil contra: veneno (cura la mitad), arcano y daño rápido para romper sus tótems. ¡Golpéalo fuerte mientras se cura para interrumpirlo!',
    weakTo: ['poison', 'arcane', 'focus'], tags: ['Jefe', 'Se cura', 'Tótems'],
    size: 260, anim: 'walk', radius: 62,
    hp: 2100, speed: 26, damage: 14, atkInterval: 2.0, range: 380, stopX: 660, armor: 0.1,
    projectile: { kind: 'magic', speed: 400, arc: 60, color: '#7dff8a' },
    resist: { poison: 0.3, arcane: -0.2 }, gold: 100, xp: 70,
    phases: [
      { at: 1.0, name: '¡El pantano despierta!' },
      { at: 0.5, name: '¡Espíritus del lobo!', onEnter(B, b) {
        summon(B, b, 'jinete_lobo', 3, { front: true, hpMul: 0.6, color: ['#bfefff', '#7fd6ff'], onEach(m) { makeUndead(B, m, 'spectral'); } });
        sfx(B, 'howl', 0.5);
      } },
    ],
    attacks: [
      { id: 'curacion', name: 'Curación ancestral', every: [11, 14], phases: [0, 1], cast(B, b) {
        const d = data(b);
        d.channel = { start: now(B), dur: 1.6, dmg: 0, color: '#7dff8a' };
        telegraph(B, b, { dur: 1.6, hold: true, text: '¡Se va a curar!', textColor: '#7dff8a', color: 'rgba(110,255,130,0.95)', zones: [{ x: b.x, r: 110 }], zoneColor: 'rgba(90,220,110,0.4)', edge: 'rgba(200,255,200,0.9)' }, function () {
          const ch = d.channel; d.channel = null;
          if (held(b) || (ch && ch.dmg >= b.maxHp * 0.035)) { say(B, b, 'int', '¡Curación interrumpida!', '#ffffff', 0.5, 26); return; }
          const poisoned = !!(b.status && b.status.poison);
          try { B.healEnemy(b, b.maxHp * 0.07); } catch (err) { /* nada */ }
          if (!B.headless) {
            fx(B, 'ring', b.x, midY(b), 220, { color: 'rgba(110,255,130,0.95)', dur: 0.7, width: 8 });
            fx(B, 'particles', b.x, midY(b), { n: 26, color: ['#7dff8a', '#ffffff'], kind: 'star', speed: 200, up: 80, life: 0.9, size: 6, gravity: -100 });
          }
          if (poisoned) say(B, b, 'pois', '¡El veneno le cura la mitad!', '#b6ff6a', 0.5, 22);
          sfx(B, 'heal', 0.3);
        });
      } },
      { id: 'totem', name: 'Tótem del pantano', every: [13, 16], phases: [0, 1], cast(B, b) {
        if (countType(B, 'totem_pantano') >= 2) return;
        if (!B.headless) fx(B, 'text', b.x, topY(b) - 30, '¡Tótem!', { color: '#7dff8a', size: 28, dur: 1.3 });
        sfx(B, 'magic', 0.3);
        summon(B, b, 'totem_pantano', 1, { x: Math.min(W().WALL_X - 160, b.x + sizeOf(b) * 0.35 + 70 + rnd(B) * 50), color: ['#7dff8a', '#ffffff'] });
      } },
      { id: 'lluvia', name: 'Lluvia venenosa', every: [12, 15], phases: [0, 1], cast(B, b) {
        const C = W().CASTLE_X;
        telegraph(B, b, { dur: 1.0, text: '¡Lluvia venenosa!', textColor: '#a8ff7a', color: 'rgba(120,255,90,0.95)', zones: [{ x: C + 60, r: 90 }, { x: C + 200, r: 90 }], zoneColor: 'rgba(120,255,90,0.4)', sound: 'poison' }, function () {
          B.every(0.7, function () {
            if (B.over || !alive(b)) return;
            hitCastle(B, b.damage * 0.3, { source: b, ignoreWall: true, type: 'poison' });
            if (!B.headless) for (let i = 0; i < 6; i++) fx(B, 'particles', C + 20 + rnd(B) * 260, 80 + rnd(B) * 100, { n: 1, kind: 'bubble', color: '#9dff6a', speed: 30, angle: Math.PI / 2, spread: 0.2, life: 0.9, size: 6, gravity: 500 });
            sfx(B, 'poison', 0.6);
          }, 6);
        });
      } },
      { id: 'lobos', name: 'Lobos espectrales', every: [14, 17], phases: [1], cast(B, b) {
        if (!B.headless) fx(B, 'text', b.x, topY(b) - 30, '¡Lobos espectrales!', { color: '#bfefff', size: 26, dur: 1.3 });
        sfx(B, 'howl', 0.5);
        summon(B, b, 'jinete_lobo', 2, { front: true, hpMul: 0.6, color: ['#bfefff', '#7fd6ff'], onEach(m) { makeUndead(B, m, 'spectral'); } });
      } },
    ],
  });

  /* ======================================================================== *
   *  3 · GORRUMBO, EL TROLL DE PIEDRA (nivel 30)                              *
   * ======================================================================== */
  function stoneSkin(B, b, secs) {
    data(b).stoneUntil = now(B) + secs;
    if (!B.headless) {
      fx(B, 'text', b.x, topY(b) - 34, '¡PIEL DE PIEDRA!', { color: '#cfd2d8', size: 30, dur: 1.6 });
      fx(B, 'text', b.x, topY(b) - 4, 'Usa magia', { color: '#ffffff', size: 20, dur: 2 });
      fx(B, 'particles', b.x, midY(b), { n: 24, kind: 'debris', color: ['#8b8f97', '#6f737b', '#b9bcc4'], speed: 260, up: 120, life: 0.8, size: 6, gravity: 700 });
    }
    sfx(B, 'shield', 0.4);
    B.after(secs, function () { if (alive(b) && !B.headless) fx(B, 'text', b.x, topY(b) - 20, 'Piel normal', { color: '#ffe066', size: 22 }); });
  }
  function quake(B, b) {
    const G = W().GROUND;
    telegraph(B, b, { dur: 1.2, hold: true, text: '¡TERREMOTO!', textColor: '#ffb35a', zones: [{ x: b.x, r: 160 }], sound: 'roar' }, function () {
      if (!B.headless) {
        fx(B, 'shake', 18, 1.0);
        for (let x = b.x; x < W().CASTLE_X + 200; x += 70) fx(B, 'particles', x, G - 4, { n: 3, kind: 'debris', color: ['#6b4a2b', '#8a6a44', '#8b8f97'], speed: 160, up: 260, life: 0.8, size: 6, gravity: 900 });
        fx(B, 'ring', b.x, G, 260, { color: 'rgba(255,180,90,0.9)', dur: 0.7, width: 8 });
      }
      sfx(B, 'hit_heavy', 0.1);
      const n = Math.min(3, 2 + Math.floor(((B.heroes || []).length) / 6));
      disableHeroes(B, n, 2.5, 'stun');
      hitCastle(B, b.damage * 1.0, { source: b });
    });
  }
  boss({
    id: 'troll_piedra', name: 'Gorrumbo', title: 'El Troll de Piedra', level: 30, color: '#a39e93',
    quote: '¡GORRUMBO APLASTA! ¡GORRUMBO TIRA PIEDRAS GRANDES!',
    desc: 'Un troll gigante hecho de roca. Lanza pedruscos al castillo, su piel se vuelve de piedra y hace temblar el suelo.',
    weakness: 'Débil contra: magia (sobre todo cuando su piel es de piedra) y rayo.',
    weakTo: ['magic', 'lightning'], tags: ['Jefe', 'Piel de piedra', 'Terremoto'],
    size: 300, anim: 'heavy', radius: 70,
    hp: 2800, speed: 24, damage: 22, atkInterval: 2.2, armor: 0.35, resist: { lightning: -0.25, poison: 0.2 },
    gold: 120, xp: 80,
    phases: [
      { at: 1.0, name: '¡Gorrumbo aplasta!' },
      { at: 0.6, name: '¡Piel de piedra!', onEnter(B, b) { stoneSkin(B, b, 4); } },
      { at: 0.3, name: '¡Terremoto!', onEnter(B, b) { quake(B, b); } },
    ],
    attacks: [
      { id: 'pedrusco', name: 'Pedrusco', every: [5, 7], phases: [0, 1, 2], cast(B, b) {
        const p = siegePoint(B);
        telegraph(B, b, { dur: 0.8, text: '¡Pedrusco!', textColor: '#e0d6c8', zones: [{ x: p.x, r: 70 }] }, function () {
          shoot(B, hand(b), { kind: 'rock', to: p, speed: 470, arc: 260, size: 24, damage: b.damage * 1.5, source: b, radius: 64, shake: 7,
            colors: ['#cfd2d8', '#8b8f97', '#ffb35a'], debris: ['#8b8f97', '#6f737b'], hitSound: 'hit_heavy', sound: 'whoosh' });
        });
      } },
      { id: 'avalancha', name: 'Avalancha', every: [9, 11], phases: [1, 2], cast(B, b) {
        for (let i = 0; i < 3; i++) B.after(i * 0.25, function () {
          if (!alive(b)) return;
          shoot(B, hand(b), { kind: 'rock', speed: 520, arc: 180 + rnd(B) * 120, size: 13, damage: b.damage * 0.45, source: b, radius: 36, debris: ['#8b8f97'], sound: 'whoosh' });
        });
      } },
      { id: 'piel', name: 'Piel de piedra', every: [12, 15], phases: [1, 2], cast(B, b) { stoneSkin(B, b, 5); } },
      { id: 'terremoto', name: 'Terremoto', every: [11, 14], phases: [2], cast(B, b) { quake(B, b); } },
    ],
  });

  /* ======================================================================== *
   *  4 · KHAZRAK, EL JINETE DEL ESCORPIÓN (nivel 40)                          *
   * ======================================================================== */
  function burrow(B, b) {
    telegraph(B, b, { dur: 0.6, hold: true, text: '¡Se entierra!', textColor: '#f3d58a', color: 'rgba(240,200,120,0.95)' }, function () {
      b.burrowed = true;
      const d = data(b);
      d.burrow = { until: now(B) + 3, toX: Math.min(frontX(B, b, { ignoreBlock: true }) - 10, b.x + 300) };
      if (!B.headless) fx(B, 'particles', b.x, W().GROUND - 6, { n: 30, kind: 'debris', color: ['#e8c87a', '#c9a05a', '#8a6a44'], speed: 260, up: 220, life: 0.8, size: 6, gravity: 900 });
      sfx(B, 'burrow', 0.3);
    });
  }
  boss({
    id: 'escorpion', name: 'Khazrak', title: 'El Jinete del Escorpión', level: 40, color: '#e8a33a',
    quote: '¡Mi escorpión tiene hambre... y vuestra muralla parece crujiente!',
    desc: 'Un caudillo goblin montado en un escorpión gigante. Se entierra en la arena (¡nadie le puede dar!) y reaparece junto a tu muralla. Su aguijón envenena el castillo.',
    weakness: 'Débil contra: hielo y trampas (le dan aunque esté bajo tierra). El veneno casi no le hace nada.',
    weakTo: ['ice', 'traps'], tags: ['Jefe', 'Se entierra', 'Veneno'],
    size: 250, anim: 'walk', radius: 75,
    hp: 2750, speed: 40, damage: 18, atkInterval: 1.4, armor: 0.3, resist: { poison: 0.6, ice: -0.3 },
    gold: 140, xp: 90,
    onUpdate(B, b, dt) {
      const d = data(b);
      if (!d.burrow) return false;
      if (b.burrowed && now(B) < d.burrow.until) {
        b.x = Math.min(d.burrow.toX, b.x + 120 * speedMul(B, b) * dt);
        b.state = 'walk';
        if (!B.headless && Math.random() < 0.5) fx(B, 'particles', b.x - 30, W().GROUND - 2, { n: 2, kind: 'debris', color: ['#e8c87a', '#c9a05a'], speed: 100, up: 180, life: 0.5, size: 5, gravity: 800 });
        return true;
      }
      b.burrowed = false; d.burrow = null;
      if (!B.headless) {
        fx(B, 'explosion', b.x, W().GROUND - 30, 110, { color: '#e8c87a', debris: ['#e8c87a', '#c9a05a', '#8a6a44'] });
        fx(B, 'text', b.x, topY(b) - 20, '¡Emerge!', { color: '#f3d58a', size: 30 });
      }
      sfx(B, 'burrow', 0.2);
      if (nearWall(B, b, 60)) { hitCastle(B, b.damage * 1.5, { source: b }); if (!B.headless) fx(B, 'text', b.x + 60, topY(b) + 10, '¡Emboscada!', { color: '#ff7a3d', size: 26 }); }
      return false;
    },
    phases: [
      { at: 1.0, name: '¡Al ataque, escorpión!' },
      { at: 0.5, name: '¡Furia del desierto!', onEnter(B, b) {
        summon(B, b, 'goblin_topo', 2, { color: ['#e8c87a', '#ffffff'] });
        burrow(B, b);
      } },
    ],
    attacks: [
      { id: 'aguijon', name: 'Aguijón venenoso', every: [6, 8], phases: [0, 1], cast(B, b) {
        telegraph(B, b, { dur: 0.7, text: '¡Aguijón!', textColor: '#a8ff7a', color: 'rgba(160,255,90,0.95)' }, function () {
          const ticks = phaseOf(b) >= 1 ? 6 : 4;
          shoot(B, { x: b.x + sizeOf(b) * 0.1, y: topY(b) + 20 }, { kind: 'spit', speed: 560, arc: 100, size: 14, color: '#9dff5a', damage: b.damage * 1.0, type: 'poison', source: b, radius: 40,
            colors: ['#c6f59a', '#7fd13a'], hitSound: 'poison',
            after(BX) {
              BX.every(1, function () {
                if (BX.over) return;
                hitCastle(BX, b.damage * 0.15, { source: b, ignoreWall: true, type: 'poison' });
                if (!BX.headless) fx(BX, 'particles', W().CASTLE_X + 60 + rnd(BX) * 180, W().GROUND - 140 - rnd(BX) * 160, { n: 3, kind: 'bubble', color: '#9dff6a', speed: 20, up: 40, gravity: -30, life: 0.9, size: 5 });
              }, ticks);
            } });
        });
      } },
      { id: 'enterrarse', name: 'Se entierra', every: [13, 16], phases: [0, 1], cast(B, b) { burrow(B, b); } },
      { id: 'tormenta', name: 'Tormenta de arena', every: [15, 18], phases: [1], cast(B, b) {
        telegraph(B, b, { dur: 1.0, text: '¡Tormenta de arena!', textColor: '#f3d58a', color: 'rgba(240,200,120,0.95)', sound: 'wind' }, function () {
          if (!B.headless) for (let i = 0; i < 40; i++) fx(B, 'particles', rand(B, 0, 1500), rand(B, 120, 560), { n: 1, color: ['#e8c87a', '#c9a05a'], speed: 380, angle: 0, spread: 0.2, life: 1.4, size: 5, gravity: 0 });
          disableHeroes(B, 2, 2.5, 'sand');
        });
      } },
      { id: 'pinzas', name: 'Pinzas', every: [8, 10], phases: [1], cast(B, b) {
        if (!nearWall(B, b, 60)) return;
        if (!B.headless) fx(B, 'text', b.x + 40, topY(b) - 10, '¡Pinzas!', { color: '#ffb35a', size: 26 });
        hitCastle(B, b.damage * 1.2, { source: b });
        B.after(0.3, function () { if (alive(b)) { hitCastle(B, b.damage * 1.2, { source: b }); fx(B, 'shake', 8, 0.2); } });
        sfx(B, 'hit_heavy', 0.1);
      } },
    ],
  });

  /* ======================================================================== *
   *  5 · IGNAROK, SEÑOR DEL MAGMA (nivel 50)                                  *
   * ======================================================================== */
  boss({
    id: 'senor_fuego', name: 'Ignarok', title: 'Señor del Magma', level: 50, color: '#ff5a1f',
    quote: '¡Arderéis como la lava de mi volcán!',
    desc: 'Un orco con armadura de lava. Hace llover fuego sobre tu castillo y, cuando se enfada, se cubre con un escudo de lava.',
    weakness: 'Débil contra: hielo (¡muchísimo con el escudo de lava!). El fuego apenas le hace nada.',
    weakTo: ['ice', 'freeze'], tags: ['Jefe', 'Lluvia de fuego', 'Escudo de lava'],
    size: 270, anim: 'heavy', radius: 66,
    hp: 3200, speed: 28, damage: 20, atkInterval: 1.7, armor: 0.3, resist: { fire: 0.5, ice: -0.3, poison: 0.2 },
    immune: { burn: true }, gold: 160, xp: 100,
    onUpdate(B, b, dt) {
      const d = data(b);
      if (d.lava && !B.headless) {
        d.ember = (d.ember || 0) - dt;
        if (d.ember <= 0) { d.ember = 0.08; fx(B, 'particles', b.x + rand(B, -60, 60), midY(b) + rand(B, -70, 70), { n: 1, kind: 'fire', color: ['#ffe46b', '#ff7a1c'], speed: 30, up: 60, gravity: -80, life: 0.6, size: 8, add: true }); }
      }
      return false;
    },
    onDamage(B, b, amount, info) {
      if (!data(b).lava) return amount;
      if (info.type === 'fire') { say(B, b, 'fire', '¡Inmune al fuego!', '#ffb35a', 1.3, 22); return 0; }
      if (info.type === 'ice') { say(B, b, 'ice', '¡Débil al hielo!', '#bfefff', 1.5, 22); return amount * 2; }
      return amount;
    },
    phases: [
      { at: 1.0, name: '¡Arded!' },
      { at: 0.5, name: '¡Escudo de lava!', onEnter(B, b) {
        data(b).lava = true;
        if (!B.headless) {
          fx(B, 'text', b.x, topY(b) - 4, 'Usa el hielo', { color: '#bfefff', size: 22, dur: 2.2, vy: -10 });
          fx(B, 'explosion', b.x, midY(b), 140, { color: '#ff5a1f' });
        }
      } },
    ],
    attacks: [
      { id: 'lluvia_fuego', name: 'Lluvia de fuego', every: [9, 12], phases: [0, 1], cast(B, b) {
        const n = phaseOf(b) >= 1 ? 7 : 5;
        const pts = pickPoints(B, n);
        telegraph(B, b, { dur: 1.0, text: '¡Lluvia de fuego!', textColor: '#ffb35a', zones: pts.map(p => ({ x: p.x, r: 55 })), sound: 'fireball' }, function () {
          skyStrike(B, b, n, { points: pts, damage: b.damage * 0.6, color: '#ff8a2a', size: 16, radius: 52 });
        });
      } },
      { id: 'bola_magma', name: 'Bola de magma', every: [5, 7], phases: [0, 1], cast(B, b) {
        shoot(B, hand(b), { kind: 'fireball', speed: 520, arc: 160, size: 20, color: '#ff5a1f', damage: b.damage * 1.3, type: 'fire', source: b, radius: 60, shake: 6, hitSound: 'explosion', sound: 'fireball',
          after(BX) { BX.every(1, function () { if (!BX.over) hitCastle(BX, b.damage * 0.12, { source: b, ignoreWall: true, type: 'fire' }); }, 3); } });
      } },
      { id: 'hijos', name: 'Hijos del volcán', every: [15, 18], phases: [0, 1], cast(B, b) {
        if (!B.headless) fx(B, 'text', b.x, topY(b) - 30, '¡Hijos del volcán!', { color: '#ff7a3d', size: 28, dur: 1.4 });
        sfx(B, 'roar', 0.5);
        summon(B, b, 'orco_berserker', phaseOf(b) >= 1 ? 3 : 2, { front: true, color: ['#ff7a1c', '#ffe46b'] });
      } },
      { id: 'erupcion', name: 'Erupción', every: [13, 16], phases: [1], cast(B, b) {
        telegraph(B, b, { dur: 1.0, hold: true, text: '¡ERUPCIÓN!', textColor: '#ff5a1f', zones: [{ x: b.x, r: 140 }], sound: 'roar' }, function () {
          if (!B.headless) {
            fx(B, 'explosion', b.x, midY(b), 160, { color: '#ff5a1f' });
            fx(B, 'flash', 'rgba(255,100,30,0.35)', 0.4);
            fx(B, 'particles', b.x, topY(b), { n: 40, kind: 'fire', color: ['#ffe46b', '#ff7a1c', '#ff3b1c'], speed: 500, angle: -Math.PI / 2, spread: 0.9, life: 1.2, size: 9, gravity: 600, add: true });
          }
          disableHeroes(B, 2, 2, 'fire');
          hitCastle(B, b.damage * 0.8, { source: b, type: 'fire' });
        });
      } },
    ],
  });

  /* ======================================================================== *
   *  6 · THARGRIM, SEÑOR DE LA GUERRA (nivel 60)                              *
   * ======================================================================== */
  function axeDraw(ctx, p) {
    ctx.translate(p.x, p.y - (p.lift || 0)); ctx.rotate(p.age * 14);
    ctx.fillStyle = '#6b4423'; ctx.fillRect(-3, -22, 6, 44);
    ctx.fillStyle = '#c9ced6'; ctx.strokeStyle = '#1e1527'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(2, -20); ctx.quadraticCurveTo(26, -16, 22, 4); ctx.quadraticCurveTo(14, -6, 2, -4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-2, -20); ctx.quadraticCurveTo(-26, -16, -22, 4); ctx.quadraticCurveTo(-14, -6, -2, -4); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  boss({
    id: 'senor_guerra', name: 'Thargrim', title: 'Señor de la Guerra', level: 60, color: '#c0392b',
    quote: '¡Mil orcos marchan conmigo! ¡Vuestras murallas caerán hoy!',
    desc: 'Un orco colosal con armadura negra. Lanza hachas, anima a su ejército con gritos de guerra, se esconde tras un muro de escudos y al final entra en furia.',
    weakness: 'Débil contra: arcano y rayo (su armadura no los para). Rompe primero a sus escuderos.',
    weakTo: ['arcane', 'lightning', 'focus'], tags: ['Jefe', 'Élites', 'Furia'],
    size: 300, anim: 'heavy', radius: 70,
    hp: 3500, speed: 26, damage: 24, atkInterval: 1.8, armor: 0.45, resist: { arcane: -0.2, lightning: -0.15 },
    gold: 180, xp: 110,
    onUpdate(B, b, dt) {
      const d = data(b);
      if (d.rage && !B.headless) {
        d.steam = (d.steam || 0) - dt;
        if (d.steam <= 0) { d.steam = 0.1; fx(B, 'particles', b.x + rand(B, -50, 50), topY(b) + 40, { n: 2, color: ['#ff5a3c', '#ffb3a0'], speed: 60, up: 50, life: 0.6, size: 6, gravity: -90 }); }
      }
      return false;
    },
    onDamage(B, b, amount) {
      const g = data(b).protectedBy;
      if (g && g.some(alive)) { say(B, b, 'prot', '¡Protegido por sus escudos!', '#ffd23f', 1.6, 22); return amount * 0.4; }
      return amount;
    },
    phases: [
      { at: 1.0, name: '¡Por la Horda!' },
      { at: 0.66, name: '¡Muro de escudos!', onEnter(B, b) {
        data(b).protectedBy = summon(B, b, 'orco_escudo', 3, { front: true, elite: true, color: ['#ffd23f', '#ffffff'] });
        if (!B.headless) fx(B, 'text', b.x, topY(b) - 4, 'Rompe a los escuderos', { color: '#ffffff', size: 20, dur: 2.4, vy: -10 });
      } },
      { at: 0.33, name: '¡FURIA!', onEnter(B, b) {
        const d = data(b);
        d.rage = true;
        setSpeedMod(b, 'furia', 1.6);
        b.damage *= 1.4; b.atkInterval *= 0.7;
        if (!B.headless) fx(B, 'flash', 'rgba(255,40,30,0.35)', 0.5);
      } },
    ],
    attacks: [
      { id: 'hacha', name: 'Hacha arrojadiza', every: [6, 8], phases: [0, 1, 2], cast(B, b) {
        telegraph(B, b, { dur: 0.6, text: '¡Hacha!', textColor: '#e0e4ea', color: 'rgba(220,220,230,0.95)' }, function () {
          shoot(B, hand(b), { speed: 640, arc: 130, damage: b.damage * 1.3, source: b, radius: 46, shake: 5, draw: axeDraw, hitSound: 'hit_heavy', sound: 'whoosh', debris: ['#8b8f97', '#6f4723'] });
        });
      } },
      { id: 'grito', name: 'Grito de guerra', every: [10, 13], phases: [0, 1, 2], cast(B, b) {
        telegraph(B, b, { dur: 0.8, hold: true, text: '¡GRITO DE GUERRA!', textColor: '#ff5a4a' }, function () {
          if (!B.headless) {
            for (let i = 0; i < 3; i++) B.after(i * 0.15, function () { fx(B, 'ring', b.x, midY(b), 200 + i * 160, { color: 'rgba(255,70,50,0.9)', dur: 0.6, width: 8 }); });
            fx(B, 'shake', 10, 0.5);
          }
          sfx(B, 'roar', 0.3);
          let list = [];
          try { list = B.enemiesInRadius(b.x, b.y - 80, 520, { air: 'both' }) || []; } catch (err) { /* nada */ }
          for (const a of list) buffEnemy(B, a, { speed: 0.35, atk: 0.25, protect: 0.2, duration: 6, src: 'grito', strength: 2 });
          disableHeroes(B, 1, 1.5, 'fear');
        });
      } },
      { id: 'elites', name: 'Élites', every: [15, 18], phases: [0, 1, 2], cast(B, b) {
        const types = shuffle(B, ['orco_berserker', 'orco_escudo', 'orco_tambor', 'jinete_lobo']);
        if (!B.headless) fx(B, 'text', b.x, topY(b) - 30, '¡Élites, conmigo!', { color: '#ffd23f', size: 28, dur: 1.4 });
        summon(B, b, types[0], 1, { elite: true, color: ['#ffd23f', '#ffffff'] });
        summon(B, b, types[1], 1, { elite: true, color: ['#ffd23f', '#ffffff'] });
      } },
      { id: 'carga', name: 'Carga brutal', every: [10, 12], phases: [2], cast(B, b) {
        telegraph(B, b, { dur: 1.0, hold: true, text: '¡CARGA!', textColor: '#ff5a4a', zones: [{ x: frontX(B, b) + 40, r: 100 }], sound: 'roar' }, function () {
          startDash(B, b, { speed: 600, mul: 3, color: '#ff5a4a', label: '¡BRUTAL!' });
        });
      } },
    ],
  });

  /* ======================================================================== *
   *  7 · HRIMGOR, EL OGRO DE ESCARCHA (nivel 70)                              *
   * ======================================================================== */
  function icicleDraw(ctx, p) {
    ctx.translate(p.x, p.y - (p.lift || 0)); ctx.rotate(p.angle || 0);
    ctx.fillStyle = '#d6f4ff'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(-6, -12); ctx.lineTo(-24, 0); ctx.lineTo(-6, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(127,214,255,0.7)'; ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(-6, -4); ctx.lineTo(-6, 4); ctx.closePath(); ctx.fill();
  }
  boss({
    id: 'gigante_escarcha', name: 'Hrimgor', title: 'El Ogro de Escarcha', level: 70, color: '#7fd6ff',
    quote: 'El invierno eterno ha llegado... ¡Quedaos quietos para siempre!',
    desc: 'Un ogro enorme de piel helada. Congela a tus héroes en sus huecos, desata ventiscas y se cubre con una armadura de hielo que se regenera.',
    weakness: 'Débil contra: fuego (y mucho más contra su armadura de hielo). El hielo no le hace casi nada.',
    weakTo: ['fire'], tags: ['Jefe', 'Congela héroes', 'Armadura de hielo'],
    size: 300, anim: 'heavy', radius: 70,
    hp: 4000, speed: 24, damage: 24, atkInterval: 2.0, armor: 0.2, resist: { ice: 0.8, fire: -0.4 },
    immune: { freeze: true, slow: true }, gold: 200, xp: 120,
    phases: [
      { at: 1.0, name: '¡Invierno eterno!' },
      { at: 0.5, name: '¡Armadura de hielo!', onEnter(B, b) {
        giveShield(B, b, { pct: 0.12, mul: { fire: 2.5 }, rgb: '159,231,255', name: 'Armadura de hielo', regenDelay: 3, regenPct: 0.08, reform: 10, hint: 'Usa el fuego' });
      } },
    ],
    attacks: [
      { id: 'congelar', name: 'Aliento helado', every: [8, 11], phases: [0, 1], cast(B, b) {
        const victims = shuffle(B, heroPool(B)).slice(0, 2);
        if (!victims.length) return;
        if (!B.headless) for (const h of victims) { fx(B, 'ring', h.x, h.y - 36, 50, { color: 'rgba(160,230,255,0.95)', dur: 1.0, width: 6, grow: false }); fx(B, 'text', h.x, h.y - 100, '¡Cuidado!', { color: '#bfefff', size: 18, dur: 1 }); }
        telegraph(B, b, { dur: 1.0, text: '¡Aliento helado!', textColor: '#bfefff', color: 'rgba(160,230,255,0.95)', sound: 'wind' }, function () {
          if (!B.headless) for (const h of victims) fx(B, 'beam', b.x + sizeOf(b) * 0.2, topY(b) + 50, h.x, h.y - 40, { color: '#bfefff', width: 10, dur: 0.4 });
          disableHeroes(B, 2, 4, 'ice', victims);
          sfx(B, 'freeze', 0.2);
        });
      } },
      { id: 'ventisca', name: 'Ventisca', every: [13, 16], phases: [0, 1], cast(B, b) {
        telegraph(B, b, { dur: 0.8, text: '¡Ventisca!', textColor: '#e9fbff', color: 'rgba(220,245,255,0.95)', sound: 'wind' }, function () {
          let list = [];
          try { list = B.enemiesInRadius(b.x, b.y - 80, 900, { air: 'both' }) || []; } catch (err) { /* nada */ }
          for (const a of list) buffEnemy(B, a, { speed: 0.25, duration: 5, src: 'ventisca', strength: 1 });
          let k = 0;
          B.every(0.5, function () {
            if (B.over || !alive(b)) return;
            if (!B.headless) for (let i = 0; i < 8; i++) fx(B, 'particles', rand(B, -40, 1400), rand(B, 60, 520), { n: 1, kind: 'ice', color: ['#ffffff', '#e9fbff'], speed: 320, angle: 0.25, spread: 0.2, life: 1.3, size: 5, gravity: 30 });
            if (k++ % 2 === 0) hitCastle(B, b.damage * 0.12, { source: b, type: 'ice' });
          }, 10);
        });
      } },
      { id: 'carambano', name: 'Carámbano gigante', every: [6, 8], phases: [0, 1], cast(B, b) {
        const p = siegePoint(B);
        telegraph(B, b, { dur: 0.7, text: '¡Carámbano!', textColor: '#bfefff', color: 'rgba(160,230,255,0.95)', zones: [{ x: p.x, r: 60 }], zoneColor: 'rgba(150,220,255,0.45)' }, function () {
          shoot(B, hand(b), { to: p, speed: 560, arc: 180, damage: b.damage * 1.4, type: 'ice', source: b, radius: 54, shake: 6, draw: icicleDraw,
            colors: ['#ffffff', '#bfefff', '#7fd6ff'], debris: ['#d6f4ff', '#9fe7ff'], hitSound: 'ice', sound: 'whoosh' });
        });
      } },
      { id: 'pisoton', name: 'Pisotón helado', every: [12, 14], phases: [1], cast(B, b) {
        if (!nearWall(B, b, 90)) return;
        telegraph(B, b, { dur: 0.9, hold: true, text: '¡Pisotón!', textColor: '#bfefff', zones: [{ x: frontX(B, b) + 30, r: 110 }], zoneColor: 'rgba(150,220,255,0.45)' }, function () {
          hitCastle(B, b.damage * 2, { source: b, type: 'ice' });
          if (!B.headless) { fx(B, 'shake', 14, 0.5); fx(B, 'particles', frontX(B, b) + 20, W().GROUND - 40, { n: 26, kind: 'ice', color: ['#ffffff', '#9fe7ff'], speed: 320, up: 200, life: 0.9, size: 8, gravity: 800 }); }
          sfx(B, 'freeze', 0.2);
        });
      } },
    ],
  });

  /* ======================================================================== *
   *  8 · VORLATH, EL NIGROMANTE (nivel 80)                                    *
   * ======================================================================== */
  const BIG_TYPES = { troll: 1, orco_ariete: 1, totem_pantano: 1 };
  boss({
    id: 'nigromante', name: 'Vorlath', title: 'El Nigromante', level: 80, color: '#a36bff',
    quote: 'Cada guerrero que cae... se levanta de nuevo para servirme.',
    desc: 'Un brujo orco que levanta a los enemigos caídos como no-muertos, maldice a tus héroes y se teletransporta. Al final se convierte en un espectro volador.',
    weakness: 'Débil contra: luz sagrada (Sacerdotisa del Sol) y, en forma espectral, los héroes que disparan al aire.',
    weakTo: ['holy', 'antiair'], tags: ['Jefe', 'Revive enemigos', 'Vuela'],
    size: 240, anim: 'walk', radius: 55,
    hp: 4200, speed: 30, damage: 18, atkInterval: 1.9, range: 420, stopX: 620, armor: 0.1,
    projectile: { kind: 'magic', speed: 460, arc: 50, color: '#b57bff' },
    resist: { holy: -0.6, poison: 0.5, arcane: 0.2 }, gold: 220, xp: 130,
    onSpawn(B, b) {
      const d = data(b);
      d.graves = [];
      if (typeof B.on === 'function') {
        d.unsub = B.on('kill', function (ev) {
          const en = ev && ev.enemy;
          if (!alive(b) || !en || en.boss || en === b || en.air) return;
          d.graves.push({ type: BIG_TYPES[en.type] ? 'orco_escudo' : en.type, x: Math.min(en.x, W().WALL_X - 120) });
          if (d.graves.length > 10) d.graves.shift();
        });
      }
    },
    onDamage(B, b, amount, info) {
      if (data(b).spectral && info.type === 'physical') { say(B, b, 'ghost', 'Los golpes le atraviesan', '#d29bff', 2, 20); return amount * 0.5; }
      return amount;
    },
    phases: [
      { at: 1.0, name: '¡Levantaos!' },
      { at: 0.45, name: '¡Forma espectral!', onEnter(B, b) {
        data(b).spectral = true;
        takeOff(B, b, 330, 1.4);
        if (!B.headless) { fx(B, 'flash', 'rgba(160,100,255,0.4)', 0.5); fx(B, 'text', b.x, topY(b) - 4, '¡Ahora vuela!', { color: '#ffffff', size: 22, dur: 2 }); }
      } },
    ],
    attacks: [
      { id: 'alzar', name: 'Alzar a los muertos', every: [11, 14], phases: [0, 1], cast(B, b) {
        const d = data(b);
        let graves = (d.graves || []).splice(-4, 4);
        if (!graves.length) graves = [0, 1, 2].map(i => ({ type: 'goblin_veloz', x: Math.max(40, b.x - 120 - i * 70) }));
        telegraph(B, b, { dur: 0.9, text: '¡Alzaos, mis siervos!', textColor: '#d29bff', color: 'rgba(170,110,255,0.95)', zones: graves.map(g => ({ x: g.x, r: 50 })), zoneColor: 'rgba(150,80,255,0.45)', edge: 'rgba(220,190,255,0.9)', sound: 'magic' }, function () {
          for (const g of graves) summon(B, b, g.type, 1, { x: g.x, hpMul: 0.6, color: ['#c58cff', '#7a2bd6'], onEach(m) { makeUndead(B, m, 'undead'); } });
        });
      } },
      { id: 'maldicion', name: 'Maldición', every: [9, 12], phases: [0, 1], cast(B, b) {
        const victims = shuffle(B, heroPool(B)).slice(0, 2);
        if (!victims.length) return;
        if (!B.headless) for (const h of victims) fx(B, 'beam', b.x, midY(b), h.x, h.y - 40, { color: '#b57bff', width: 4, dur: 1.0 });
        telegraph(B, b, { dur: 1.0, text: '¡Maldición!', textColor: '#d29bff', color: 'rgba(170,110,255,0.95)' }, function () {
          disableHeroes(B, 2, 3, 'curse', victims);
          sfx(B, 'magic', 0.2);
        });
      } },
      { id: 'teletransporte', name: 'Teletransporte', every: [10, 13], phases: [0, 1], cast(B, b) {
        const old = { x: b.x, y: midY(b) };
        let nx = rand(B, 240, 640);
        if (Math.abs(nx - b.x) < 160) nx = b.x > 440 ? nx - 240 : nx + 240;
        b.x = Math.max(120, Math.min(640, nx));
        if (!B.headless) {
          fx(B, 'particles', old.x, old.y, { n: 24, color: ['#b57bff', '#5a2a8a', '#e8d0ff'], speed: 200, life: 0.7, size: 7, gravity: -40, add: true });
          fx(B, 'smoke', old.x, old.y, 8);
          fx(B, 'particles', b.x, midY(b), { n: 24, color: ['#b57bff', '#e8d0ff'], speed: 200, life: 0.7, size: 7, gravity: -40, add: true });
          fx(B, 'text', b.x, topY(b) - 20, '¡Puf!', { color: '#d29bff', size: 26 });
        }
        sfx(B, 'magic', 0.2);
      } },
      { id: 'orbes', name: 'Orbes sombríos', every: [6, 8], phases: [1], cast(B, b) {
        for (let i = 0; i < 3; i++) B.after(i * 0.25, function () {
          if (!alive(b)) return;
          shoot(B, { x: b.x + 30, y: midY(b) }, { kind: 'magic', speed: 520, arc: 40 + i * 30, size: 12, color: '#b57bff', damage: b.damage * 0.8, type: 'arcane', ignoreWall: true, source: b, radius: 40,
            colors: ['#f0d6ff', '#c58cff', '#8a4dff'], hitSound: 'magic', sound: 'magic' });
        });
      } },
    ],
  });

  /* ======================================================================== *
   *  9 · GRAN GÓLEM DE TUERCA (nivel 90)                                      *
   * ======================================================================== */
  boss({
    id: 'golem', name: 'Gran Gólem de Tuerca', title: 'Máquina de Guerra Goblin', level: 90, color: '#d4a043',
    quote: '¡Más vapor! ¡Más cañones! ¡Aplastad ese castillo, chatarreros!',
    desc: 'Un robot de vapor gigantesco pilotado por goblins. Dispara andanadas de cañón, suelta topos y se protege con escudos de vapor.',
    weakness: 'Débil contra: rayo (destroza sus escudos) y aturdir (interrumpe sus reparaciones). Es de metal: el veneno no le hace nada.',
    weakTo: ['lightning', 'stun'], tags: ['Jefe', 'Escudos', 'Cañones'],
    size: 320, anim: 'heavy', radius: 80,
    hp: 4200, speed: 22, damage: 26, atkInterval: 2.2, armor: 0.5, resist: { lightning: -0.5, fire: 0.3, poison: 0.8 },
    immune: { slow: true, root: true }, gold: 250, xp: 150,
    onUpdate(B, b, dt) {
      if (B.headless) return false;
      const d = data(b);
      d.puff = (d.puff || 0) - dt;
      if (d.puff <= 0) { d.puff = d.overload ? 0.15 : 0.35; fx(B, 'particles', b.x - sizeOf(b) * 0.2, topY(b) + 30, { n: 1, kind: 'smoke', color: ['#efe9df', '#cfc8bd'], speed: 30, up: 60, gravity: -40, life: 1.0, size: 16, shrink: false }); }
      return false;
    },
    phases: [
      { at: 1.0, name: '¡Máquina en marcha!' },
      { at: 0.7, name: '¡Escudo de vapor!', onEnter(B, b) {
        giveShield(B, b, { pct: 0.12, mul: { lightning: 3 }, rgb: '143,214,255', name: 'Escudo de vapor', hint: '¡Usa el rayo!' });
      } },
      { at: 0.35, name: '¡Sobrecarga!', onEnter(B, b) {
        data(b).overload = true;
        b.atkInterval *= 0.75;
        giveShield(B, b, { pct: 0.15, mul: { lightning: 3 }, rgb: '255,200,90', name: 'Escudo sobrecargado', hint: '¡Usa el rayo!' });
      } },
    ],
    attacks: [
      { id: 'andanada', name: 'Andanada de cañones', every: [8, 10], phases: [0, 1, 2], cast(B, b) {
        const n = phaseOf(b) >= 2 ? 6 : 4;
        const pts = pickPoints(B, n);
        telegraph(B, b, { dur: 1.0, text: '¡Andanada!', textColor: '#ffd23f', zones: pts.map(p => ({ x: p.x, r: 50 })) }, function () {
          pts.forEach(function (p, i) {
            B.after(i * 0.18, function () {
              if (!alive(b)) return;
              const from = { x: b.x + sizeOf(b) * 0.15, y: topY(b) + 40 };
              if (!B.headless) fx(B, 'smoke', from.x, from.y, 3);
              shoot(B, from, { kind: 'cannon', to: p, speed: 640, arc: 200, size: 12, damage: b.damage * 0.6, source: b, radius: 46, hitSound: 'explosion', sound: 'cannon' });
            });
          });
        });
      } },
      { id: 'topos', name: '¡Suelta topos!', every: [12, 15], phases: [0, 1, 2], cast(B, b) {
        if (!B.headless) fx(B, 'text', b.x, topY(b) - 30, '¡Suelta topos!', { color: '#ffd23f', size: 26, dur: 1.3 });
        summon(B, b, 'goblin_topo', 3, { color: ['#8a6a44', '#ffffff'] });
      } },
      { id: 'reparar', name: 'Reparación', every: [16, 20], phases: [1, 2], cast(B, b) {
        const d = data(b);
        d.channel = { start: now(B), dur: 3, dmg: 0, color: '#ffd23f' };
        if (!B.headless) fx(B, 'text', b.x, topY(b) - 30, '¡Los goblins reparan!', { color: '#ffd23f', size: 26, dur: 1.6 });
        let ok = true;
        B.every(0.6, function () {
          if (B.over || !alive(b) || !ok) return;
          if (held(b)) { ok = false; d.channel = null; say(B, b, 'rep', '¡Reparación interrumpida!', '#ffffff', 0.5, 24); return; }
          try { B.healEnemy(b, b.maxHp * 0.01); } catch (err) { /* nada */ }
          if (!B.headless) fx(B, 'particles', b.x + rand(B, -60, 60), midY(b) + rand(B, -60, 60), { n: 6, color: ['#ffd23f', '#ffffff'], kind: 'star', speed: 160, life: 0.4, size: 4, gravity: 200 });
          sfx(B, 'hammer', 0.3);
        }, 5);
      } },
      { id: 'vapor', name: 'Chorro de vapor', every: [11, 14], phases: [2], cast(B, b) {
        telegraph(B, b, { dur: 0.8, text: '¡Chorro de vapor!', textColor: '#ffffff', color: 'rgba(240,240,240,0.95)', sound: 'wind' }, function () {
          if (!B.headless) for (let i = 0; i < 10; i++) fx(B, 'particles', b.x + 60 + i * 110, rand(B, 250, 520), { n: 2, kind: 'smoke', color: ['#ffffff', '#e9e4dc'], speed: 200, angle: 0, spread: 0.3, life: 1.2, size: 22, shrink: false, gravity: -20 });
          disableHeroes(B, 2, 2, 'steam');
        });
      } },
    ],
  });

  /* ======================================================================== *
   *  10 · SKARNOTH, EL DRAGÓN DE LOS ORCOS (nivel 100) — jefe final           *
   * ======================================================================== */
  const mouth = b => ({ x: b.x + sizeOf(b) * 0.4, y: midY(b) - sizeOf(b) * 0.12 });
  boss({
    id: 'dragon', name: 'Skarnoth', title: 'El Dragón de los Orcos', level: 100, color: '#e0302b',
    quote: '¡Soy el fuego que devora reinos! ¡Arrodillaos ante Skarnoth!',
    desc: 'El enemigo final: un dragón rojo enorme con un jinete orco. Vuela y quema tu castillo con su aliento, aterriza para golpear la muralla y al final lo convierte todo en un infierno.',
    weakness: 'Débil contra: hielo y héroes que disparan al aire (arquera, rayo, halcones). En tierra le puede dar todo el mundo.',
    weakTo: ['antiair', 'ice'], tags: ['Jefe final', 'Volador', 'Aliento de fuego'],
    size: 320, anim: 'fly', air: true, flyY: [300, 320], radius: 85,
    hp: 5800, speed: 42, damage: 22, atkInterval: 2.0, range: 340, armor: 0.35,
    projectile: { kind: 'fireball', speed: 560, arc: 30, color: '#ff7a1c' },
    resist: { fire: 0.7, ice: -0.3, lightning: -0.1 }, immune: { burn: true }, gold: 400, xp: 200,
    phases: [
      { at: 1.0, name: '¡Señor de los cielos!' },
      { at: 0.6, name: '¡Aterriza!', onEnter(B, b) {
        b.range = 0;
        land(B, b, 1.1);
        if (!B.headless) fx(B, 'text', b.x, topY(b) - 4, '¡Ahora todos le pueden dar!', { color: '#ffffff', size: 22, dur: 2.2 });
      } },
      { at: 0.25, name: '¡INFIERNO!', onEnter(B, b) {
        b.range = 340;
        takeOff(B, b, 310, 1.2);
        b.atkInterval *= 0.8;
        if (!B.headless) fx(B, 'flash', 'rgba(255,60,20,0.45)', 0.6);
      } },
    ],
    attacks: [
      { id: 'aliento', name: 'Aliento de fuego', every: [8, 10], phases: [0, 2], cast(B, b) {
        const C = W().CASTLE_X;
        telegraph(B, b, { dur: 1.0, hold: true, text: '¡Aliento de fuego!', textColor: '#ff7a1c', zones: [{ x: C + 80, r: 110 }, { x: C + 220, r: 90 }], sound: 'roar' }, function () {
          disableHeroes(B, 1, 1.5, 'fire');
          B.every(0.25, function () {
            if (B.over || !alive(b)) return;
            const m = mouth(b), tx = C + 40 + rnd(B) * 200, ty = W().GROUND - 120 - rnd(B) * 200;
            if (!B.headless) {
              fx(B, 'beam', m.x, m.y, tx, ty, { color: '#ff7a1c', width: 14, dur: 0.28 });
              fx(B, 'particles', tx, ty, { n: 6, kind: 'fire', color: ['#ffe46b', '#ff7a1c', '#ff3b1c'], speed: 160, up: 60, life: 0.6, size: 9, gravity: -60, add: true });
            }
            hitCastle(B, b.damage * 0.35, { source: b, ignoreWall: true, type: 'fire' });
            sfx(B, 'fireball', 0.2);
          }, 6);
        });
      } },
      { id: 'bolas', name: 'Bolas de fuego', every: [5, 7], phases: [0, 1, 2], cast(B, b) {
        for (let i = 0; i < 3; i++) B.after(i * 0.2, function () {
          if (!alive(b)) return;
          shoot(B, mouth(b), { kind: 'fireball', speed: 620, arc: 60 + i * 30, size: 16, color: '#ff5a1f', damage: b.damage * 0.6, type: 'fire', source: b, radius: 50, hitSound: 'explosion', sound: 'fireball' });
        });
      } },
      { id: 'jinete', name: 'El jinete llama refuerzos', every: [14, 18], phases: [0, 1, 2], cast(B, b) {
        if (!B.headless) fx(B, 'text', b.x, topY(b) - 30, '¡Refuerzos!', { color: '#ff7a3d', size: 28, dur: 1.4 });
        sfx(B, 'roar', 0.4);
        summon(B, b, 'goblin_planeador', 2, { x: Math.max(60, b.x - 160), spread: 60 });
        summon(B, b, phaseOf(b) >= 1 ? 'orco_berserker' : 'jinete_lobo', 1, { x: Math.max(40, b.x - 220), elite: phaseOf(b) >= 1 });
      } },
      { id: 'coletazo', name: 'Coletazo', every: [7, 9], phases: [1], cast(B, b) {
        if (!nearWall(B, b, 90)) return;
        telegraph(B, b, { dur: 0.9, hold: true, text: '¡Coletazo!', textColor: '#ff7a3d', zones: [{ x: frontX(B, b) + 30, r: 110 }] }, function () {
          hitCastle(B, b.damage * 2.2, { source: b });
          if (!B.headless) { fx(B, 'shake', 16, 0.5); fx(B, 'explosion', frontX(B, b) + 30, W().GROUND - 70, 90, { color: '#ff7a1c', debris: ['#8b8f97', '#6f4723'] }); }
          sfx(B, 'hit_heavy', 0.1);
        });
      } },
      { id: 'infierno', name: 'Infierno', every: [10, 12], phases: [2], cast(B, b) {
        const pts = pickPoints(B, 8).concat(pickPoints(B, 2, { ignoreWall: true }));
        telegraph(B, b, { dur: 1.2, text: '¡INFIERNO!', textColor: '#ff3b1c', banner: '¡INFIERNO!', sub: '¡Lluvia de meteoros!', zones: pts.map(p => ({ x: p.x, r: 55 })), sound: 'roar' }, function () {
          if (!B.headless) fx(B, 'flash', 'rgba(255,60,20,0.3)', 0.4);
          skyStrike(B, b, pts.length, { points: pts, gap: 0.12, damage: b.damage * 0.5, color: '#ff3b1c', size: 18, radius: 56 });
        });
      } },
    ],
  });

  BB.data.bosses = BOSSES;
  BB.data.bossOrder = Object.keys(BOSSES).sort((a, b) => BOSSES[a].level - BOSSES[b].level);
  BB.bossKit = { giveShield, startDash, land, takeOff, skyStrike };
})();
