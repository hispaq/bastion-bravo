/* Bastión Bravo · Enemigos — BB.data.enemies (12 tipos) + BB.enemyKit (utilidades para los hooks)
   Dueño: agente «Enemigos y jefes». Contrato: docs/DISENO.md §2.2, §4.5, §4.6 y §4.13.

   · Estadísticas de NIVEL 1: el motor multiplica hp × enemyHp(L), damage × enemyDmg(L) y gold × enemyGold(L).
   · Las mecánicas propias van en hooks y solo usan la API de la batalla (B).
   · Al cargarse solo registra definiciones: nada depende de otros archivos de datos.
   · Todos los hooks van protegidos: si algo falla se avisa UNA vez por consola y la batalla sigue.
   · Campos extra para la interfaz: weakTo (claves de BB.data.weakLabels), counters (ids de héroes y
     torres que les plantan cara), tags (etiquetas cortas), deathSound, color y role.
   · Hay un tipo auxiliar oculto (no enumerable) que solo invocan los jefes: 'totem_pantano'. */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  BB.data = BB.data || {};
  const TAU = Math.PI * 2;

  /* ======================================================================== *
   *  KIT COMPARTIDO (también lo usa bosses.js, siempre en tiempo de ejecución) *
   * ======================================================================== */
  const FALLBACK_WORLD = { W: 1600, H: 720, GROUND: 560, SPAWN_X: -60, WALL_X: 1235, CASTLE_X: 1300,
    AIR_MIN: 280, AIR_MAX: 400, HERO_SLOTS: [], TRAP_SLOTS: [] };
  const world = () => BB.WORLD || FALLBACK_WORLD;

  const reported = Object.create(null);
  function report(where, err) {
    if (reported[where]) return;
    reported[where] = true;
    try { console.error('[enemigos] error en ' + where + ':', err); } catch (_) { /* nada */ }
  }
  // Envuelve un hook: si lanza una excepción se informa una vez y se devuelve el valor de reserva
  function guard(where, fn, fallback) {
    return function () {
      try { return fn.apply(this, arguments); } catch (err) {
        report(where, err);
        return typeof fallback === 'function' ? fallback.apply(this, arguments) : fallback;
      }
    };
  }

  // Estado por batalla (límites de sonido, etc.) sin tocar el objeto B
  const perBattle = new WeakMap();
  function bstate(B) {
    if (!B || typeof B !== 'object') return {};
    let s = perBattle.get(B);
    if (!s) { s = { snd: Object.create(null) }; perBattle.set(B, s); }
    return s;
  }

  const now = B => (B && typeof B.t === 'number' ? B.t : 0);
  const rnd = B => (B && typeof B.rng === 'function' ? B.rng() : Math.random());
  const rand = (B, a, b) => a + (b - a) * rnd(B);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function pick(B, arr) { return arr && arr.length ? arr[Math.min(arr.length - 1, Math.floor(rnd(B) * arr.length))] : null; }
  function shuffle(B, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(B) * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // ---- unidades
  const data = e => e.data || (e.data = {});
  const alive = e => !!e && !e.dead && !e.removed && e.hp > 0;
  const sizeOf = e => ((e && (e.size || (e.def && e.def.size))) || 64) * ((e && e.scale) || 1);
  const footY = e => (e.air ? e.y + sizeOf(e) * 0.5 : e.y);   // los voladores tienen e.y en el centro
  const topY = e => footY(e) - sizeOf(e);
  const midY = e => (e.air ? e.y : e.y - sizeOf(e) * 0.45);

  // ---- efectos y sonido (seguros: nunca lanzan)
  function fx(B, name) {
    const f = B && B.fx;
    if (!f || typeof f[name] !== 'function') return null;
    const args = Array.prototype.slice.call(arguments, 2);
    try { return f[name].apply(f, args); } catch (err) { report('fx.' + name, err); return null; }
  }
  function sfx(B, name, cd) {
    if (!B || typeof B.sound !== 'function') return;
    const snd = bstate(B).snd, t = now(B);
    if (cd && snd[name] != null && t - snd[name] < cd && t >= snd[name]) return;
    snd[name] = t;
    try { B.sound(name); } catch (err) { report('sound', err); }
  }
  // Texto flotante sobre una unidad, con enfriamiento por clave
  function say(B, e, key, str, color, cd, size) {
    if (!e) return;
    const d = data(e), k = '_say_' + key, t = now(B);
    if (cd && d[k] != null && t - d[k] < cd) return;
    d[k] = t;
    fx(B, 'text', e.x, topY(e) - 12, str, { color: color || '#ffffff', size: size || 22 });
  }

  // ---- estados (el motor guarda e.status[kind] = { t, power, ... } y borra los que caducan)
  function hasStatus(e, kind) {
    const s = e && e.status && e.status[kind];
    return !!s && !(typeof s.t === 'number' && s.t <= 0);
  }
  function speedMul(B, e) {
    if (B && typeof B._statusSpeedMul === 'function') { try { return B._statusSpeedMul(e); } catch (_) { /* sigue */ } }
    if (hasStatus(e, 'freeze') || hasStatus(e, 'stun') || (hasStatus(e, 'root') && !e.air)) return 0;
    let m = 1;
    if (hasStatus(e, 'slow')) m *= Math.max(0.15, 1 - (e.status.slow.power || 0.3));
    if (e.buff && e.buff.speed) m *= 1 + e.buff.speed;
    return m;
  }
  const isHeld = e => hasStatus(e, 'freeze') || hasStatus(e, 'stun');
  // Multiplicador de velocidad con nombre (se puede quitar y poner sin acumular errores)
  function setSpeedMod(e, key, mul) {
    const d = data(e), mods = d._spd || (d._spd = {});
    const old = mods[key] || 1;
    if (Math.abs(old - mul) < 1e-6) return;
    mods[key] = mul;
    e.speed = (e.speed || 0) * (mul / old);
  }
  // Buff temporal de enemigo (usa B.buffEnemy del motor; e.buff lo dibuja el render con un aro naranja).
  // o: { speed, atk, dmg, armor, protect (reducción de TODO el daño, la aplica nuestro onDamage), duration, src }
  function buffEnemy(B, e, o) {
    if (!alive(e)) return false;
    const cur = e.buff;
    if (cur && cur.src && cur.src !== o.src && cur.t > 0.4 && (cur.strength || 0) > (o.strength || 0)) return false;
    if (B && typeof B.buffEnemy === 'function') {
      try { B.buffEnemy(e, { speed: o.speed || 0, atk: o.atk || 0, dmg: o.dmg || 0, armor: o.armor || 0, duration: o.duration || 2 }); } catch (err) { report('buffEnemy', err); }
    }
    if (!e.buff || e.buff === cur) e.buff = { speed: o.speed || 0, armor: o.armor || 0, dmg: o.dmg || 0, atk: o.atk || 0, t: o.duration || 2 };
    e.buff.src = o.src || null;
    e.buff.protect = o.protect || 0;
    e.buff.strength = o.strength || 0;
    return true;
  }

  // ---- castillo, muralla y barricada
  const wallUp = B => !!(B && B.castle && B.castle.wallHp > 0);
  // Punto de impacto de un ataque de asedio (muralla si sigue en pie; si no, castillo)
  function siegePoint(B, o) {
    const Wd = world();
    o = o || {};
    if (!o.ignoreWall && wallUp(B)) return { x: Wd.WALL_X + 12 + rnd(B) * 24, y: Wd.GROUND - 40 - rnd(B) * 110, wall: true };
    return { x: Wd.CASTLE_X + 40 + rnd(B) * 150, y: Wd.GROUND - 110 - rnd(B) * 200, wall: false };
  }
  function hitCastle(B, amount, o) {
    if (!B || B.over || !(amount > 0)) return 0;
    o = o || {};
    try { return B.damageCastle(amount, { source: o.source, ignoreWall: !!o.ignoreWall, type: o.type || 'physical' }) || 0; }
    catch (err) { report('damageCastle', err); return 0; }
  }
  function blockAhead(B, e) {
    let best = null;
    for (const t of (B && B.towers) || []) {
      if (!t || t.kind !== 'block' || t.broken || !(t.hp > 0)) continue;
      if (t.x > e.x - 40 && (!best || t.x < best.x)) best = t;
    }
    return best;
  }
  function damageBlock(B, t, amount) {
    if (!t || !(amount > 0)) return 0;
    if (B && typeof B.damageTower === 'function') { try { return B.damageTower(t, amount); } catch (err) { report('damageTower', err); } }
    t.hp = Math.max(0, (t.hp || 0) - amount);
    t.hitT = 0.15;                 // el motor detecta hp <= 0 y la rompe con su efecto
    return amount;
  }
  // x máxima a la que llega una unidad terrestre (igual que la IA del motor)
  function frontX(B, e, o) {
    const Wd = world();
    o = o || {};
    const r = (e.radius || 18) * 0.6;
    if (!o.ignoreBlock && !e.leaps) { const bar = blockAhead(B, e); if (bar && e.x < bar.x - 20) return bar.x - 36 - r; }
    return (wallUp(B) ? Wd.WALL_X : Wd.CASTLE_X) - r;
  }

  // Elimina a una unidad sin recompensa (el petardo al explotar, tótems al caer su jefe...)
  function killSelf(B, e) {
    if (!alive(e)) return;
    e.gold = 0;
    if (B && typeof B.kill === 'function') { try { B.kill(e, 'self'); return; } catch (err) { report('kill', err); } }
    e.burrowed = false;
    try { B.damage(e, e.hp * 10 + 1e6, { type: 'true', source: 'self', noNumber: true }); } catch (err) { report('damage', err); }
  }

  // ---- proyectiles enemigos contra el castillo
  // o: { kind, to, speed, arc, color, size, damage, type, ignoreWall, source, radius, shake, colors, debris,
  //      sound, hitSound, boom:false, after(B, x, y), draw(ctx, p) }
  function shoot(B, from, o) {
    o = o || {};
    const to = o.to || siegePoint(B, o);
    const spec = {
      kind: o.kind || 'rock', from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y },
      speed: o.speed || 520, arc: o.arc || 0, homing: false, team: 'enemy', color: o.color, size: o.size,
      onHit: function (B2, p) {
        const BX = B2 || B;
        if (BX.over) return;
        const hx = p && typeof p.x === 'number' ? p.x : to.x, hy = p && typeof p.y === 'number' ? p.y : to.y;
        if (o.damage > 0) hitCastle(BX, o.damage, { source: o.source, ignoreWall: o.ignoreWall, type: o.type });
        if (o.boom !== false && !BX.headless) fx(BX, 'explosion', hx, hy, o.radius || 42, { color: o.color || '#ff8a2a', colors: o.colors, debris: o.debris });
        if (o.shake) fx(BX, 'shake', o.shake, 0.25);
        if (o.hitSound) sfx(BX, o.hitSound, 0.06);
        if (typeof o.after === 'function') { try { o.after(BX, hx, hy); } catch (err) { report('shoot.after', err); } }
      },
    };
    if (typeof o.draw === 'function') { spec.kind = 'custom'; spec.draw = o.draw; }
    if (o.sound) sfx(B, o.sound, 0.08);
    try { return B.spawnProjectile(spec); } catch (err) { report('spawnProjectile', err); return null; }
  }

  // ---- aviso previo de un ataque fuerte (~1 s) y ejecución retrasada
  // o: { dur, text, color, zones:[{x,y,r}], zoneColor, edge, banner, sub, sound, hold:true (se planta mientras carga) }
  function telegraph(B, e, o, fn) {
    o = o || {};
    const dur = o.dur != null ? o.dur : 1;
    if (!B.headless) {
      if (o.text) fx(B, 'text', e.x, topY(e) - 26, o.text, { color: o.textColor || '#ffe066', size: o.textSize || 30, dur: Math.max(1.1, dur + 0.4), vy: -18 });
      if (o.ring !== false) {
        fx(B, 'ring', e.x, midY(e), sizeOf(e) * 0.7, { color: o.color || 'rgba(255,80,60,0.95)', dur: dur, width: 7 });
        fx(B, 'ring', e.x, footY(e), sizeOf(e) * 0.55, { color: o.color || 'rgba(255,80,60,0.95)', dur: dur * 0.8, width: 4, grow: false });
      }
      for (const z of o.zones || []) {
        fx(B, 'zone', z.x, z.y != null ? z.y : world().GROUND, z.r || 70, { color: o.zoneColor || 'rgba(255,50,40,0.5)', edge: o.edge || 'rgba(255,230,120,0.95)', dur: dur + 0.2 });
      }
      if (o.banner) fx(B, 'banner', o.banner, { color: o.bannerColor || '#ff5a4a', dur: Math.max(1.3, dur + 0.5), sub: o.sub || '' });
    }
    if (o.sound) sfx(B, o.sound, 0.25);
    if (o.hold) data(e).holdUntil = Math.max(data(e).holdUntil || 0, now(B) + dur);
    if (!B || typeof B.after !== 'function') { if (alive(e)) fn(); return; }
    B.after(dur, function () {
      if (B.over || !alive(e)) return;
      try { fn(); } catch (err) { report('ataque retrasado de ' + e.type, err); }
    });
  }

  // ---- invocar esbirros. o: { x, spread, front, y, elite, hpMul, dmgMul, cap, color, onEach(m, i) }
  function summon(B, e, type, n, o) {
    o = o || {};
    const out = [];
    const Wd = world();
    let living = 0;
    for (const x of (B && B.enemies) || []) if (x.minion && alive(x)) living++;
    const cap = o.cap || 14;
    for (let i = 0; i < n; i++) {
      if (living + out.length >= cap) break;
      let x;
      if (o.x != null) x = o.x + (o.spread || 0) * (i - (n - 1) / 2);
      else if (o.front) x = e.x + sizeOf(e) * 0.28 + 24 + i * 36 + rnd(B) * 16;
      else x = e.x - sizeOf(e) * 0.22 - 20 - i * 38 - rnd(B) * 20;
      x = clamp(x, Wd.SPAWN_X + 20, Wd.WALL_X - 110);
      let m = null;
      try { m = B.spawnEnemy(type, { x, y: o.y, elite: !!o.elite, minion: true, hpMul: o.hpMul, dmgMul: o.dmgMul }); }
      catch (err) { report('spawnEnemy ' + type, err); }
      if (!m) continue;
      out.push(m);
      if (!B.headless) {
        fx(B, 'smoke', m.x, midY(m), 6);
        fx(B, 'particles', m.x, midY(m), { n: 10, color: o.color || ['#ffffff', '#ffe58a'], kind: 'star', speed: 150, life: 0.5, size: 5, gravity: 100 });
      }
      if (typeof o.onEach === 'function') { try { o.onEach(m, i); } catch (err) { report('summon.onEach', err); } }
    }
    return out;
  }

  // ---- desactivar héroes con un estilo visual
  const DISABLE_STYLE = {
    ice: { text: '¡Congelado!', color: '#bfefff', parts: ['#e9fbff', '#9fe7ff'], kind: 'ice' },
    stun: { text: '¡Aturdido!', color: '#ffe14a', parts: ['#ffe46b', '#ffffff'], kind: 'star' },
    curse: { text: '¡Maldito!', color: '#d29bff', parts: ['#b56cff', '#5a2a8a', '#e8d0ff'], kind: 'spark' },
    fire: { text: '¡Quemado!', color: '#ffb35a', parts: ['#ffe46b', '#ff7a1c'], kind: 'fire' },
    sand: { text: '¡Cegado!', color: '#f3d58a', parts: ['#e8c87a', '#c9a05a'], kind: 'spark' },
    steam: { text: '¡Vapor!', color: '#ffffff', parts: ['#ffffff', '#d6dde7'], kind: 'smoke' },
    fear: { text: '¡Miedo!', color: '#ff8a7a', parts: ['#ff5a4a', '#ffffff'], kind: 'spark' },
    poison: { text: '¡Envenenado!', color: '#a8ff7a', parts: ['#c6f59a', '#6ad13a'], kind: 'bubble' },
  };
  const heroPool = B => ((B && B.heroes) || []).filter(h => h && !(h.disabled > 0));
  function disableHeroes(B, n, secs, style, list) {
    const pool = list || shuffle(B, heroPool(B));
    const st = DISABLE_STYLE[style] || DISABLE_STYLE.stun;
    const out = [];
    for (const h of pool) {
      if (out.length >= n) break;
      if (!h || h.disabled > 0) continue;
      try { B.disableHero(h, secs); } catch (err) { report('disableHero', err); continue; }
      out.push(h);
      if (!B.headless) {
        fx(B, 'particles', h.x, h.y - 40, { n: 14, color: st.parts, kind: st.kind, speed: 120, life: 0.8, size: 6, gravity: st.kind === 'smoke' || st.kind === 'bubble' ? -40 : 160 });
        fx(B, 'text', h.x, h.y - 96, st.text, { color: st.color, size: 20, dur: 1.3 });
        fx(B, 'ring', h.x, h.y - 36, 48, { color: st.color, dur: 0.5, width: 5 });
      }
    }
    return out;
  }

  // ---- capa de dibujo propia: un proyectil 'custom' invisible que dibuja encima del mundo.
  // Se renueva solo (los proyectiles viven 6 s): hay que llamar a overlay() en cada onUpdate.
  function overlay(B, unit, key, drawFn) {
    if (!B || B.headless || typeof B.spawnProjectile !== 'function') return null;
    const d = data(unit), ovs = d._ov || (d._ov = {});
    const cur = ovs[key];
    if (cur && !cur.done && cur.age < 4.5) return cur;
    if (cur) cur.done = true;
    let p = null;
    try {
      p = B.spawnProjectile({
        kind: 'custom', team: 'enemy', from: { x: -3000, y: -3000 }, to: { x: -3000, y: -2990 }, speed: 0.001,
        onHit: function () { /* nada */ },
        draw: function (ctx, pp, B2) {
          ctx.save();
          try { drawFn(ctx, unit, B2 || B, pp); } catch (err) { report('dibujo ' + key, err); }
          ctx.restore();
        },
      });
    } catch (err) { report('overlay', err); }
    ovs[key] = p;
    return p;
  }
  function dropOverlay(unit, key) {
    const d = unit && unit.data;
    if (d && d._ov && d._ov[key]) { d._ov[key].done = true; delete d._ov[key]; }
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  // Calavera pequeña (icono de no-muerto / maldición)
  function drawSkull(ctx, x, y, r, color, eye) {
    ctx.fillStyle = color || '#efe9df'; ctx.strokeStyle = '#1e1527'; ctx.lineWidth = Math.max(1.5, r * 0.18);
    ctx.beginPath(); ctx.arc(x, y - r * 0.15, r, Math.PI * 0.85, Math.PI * 2.15); ctx.lineTo(x + r * 0.55, y + r * 0.85);
    ctx.lineTo(x - r * 0.55, y + r * 0.85); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = eye || '#7a2bd6';
    ctx.beginPath(); ctx.arc(x - r * 0.38, y, r * 0.26, 0, TAU); ctx.arc(x + r * 0.38, y, r * 0.26, 0, TAU); ctx.fill();
  }

  // ---- no-muertos y espectros (los levanta el Nigromante / el Gran Chamán)
  function makeUndead(B, m, kind) {
    if (!alive(m)) return;
    const d = data(m);
    d.undead = kind || 'undead';
    // copia propia de resistencias (la del tipo es compartida)
    const extra = kind === 'spectral' ? { physical: 0.3, holy: -0.6, poison: 0.5 } : { holy: -0.6, poison: 0.6, fire: -0.2 };
    m.resist = Object.assign({}, m.resist || {}, extra);
    if (!B.headless) {
      fx(B, 'zone', m.x, world().GROUND, 46, { color: kind === 'spectral' ? 'rgba(120,200,255,0.5)' : 'rgba(150,80,255,0.5)', dur: 1.2 });
      fx(B, 'particles', m.x, midY(m), { n: 14, color: kind === 'spectral' ? ['#bfefff', '#7fd6ff'] : ['#c58cff', '#7a2bd6', '#e8d0ff'], speed: 120, up: 80, life: 0.8, size: 6, gravity: -80, add: true });
    }
  }
  function drawUndead(ctx, e, B) {
    if (e.removed || e.dead) return;
    const t = now(B), s = sizeOf(e), fy = footY(e);
    const spectral = data(e).undead === 'spectral';
    const col = spectral ? '127,214,255' : '160,100,255';
    ctx.globalCompositeOperation = 'lighter';
    const cy = fy - s * 0.48;
    const g = ctx.createRadialGradient(e.x, cy, s * 0.08, e.x, cy, s * 0.62);
    g.addColorStop(0, 'rgba(' + col + ',' + (0.2 + 0.08 * Math.sin(t * 5 + e.id)) + ')'); g.addColorStop(1, 'rgba(' + col + ',0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, cy, s * 0.62, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    drawSkull(ctx, e.x, fy - s * 1.02 - 24 + Math.sin(t * 3 + e.id) * 3, 8, spectral ? '#dff6ff' : '#efe9df', spectral ? '#2f8fd6' : '#7a2bd6');
  }
  function undeadTick(B, e, dt) {
    const d = data(e);
    overlay(B, e, 'undead', drawUndead);
    if (B.headless) return;
    d._wisp = (d._wisp || 0) - dt;
    if (d._wisp <= 0) {
      d._wisp = 0.22;
      const spectral = d.undead === 'spectral';
      fx(B, 'particles', e.x + rand(B, -14, 14), midY(e) + rand(B, -10, 10), { n: 1, color: spectral ? ['#bfefff', '#7fd6ff'] : ['#c58cff', '#9dff9a'], speed: 20, up: 50, gravity: -50, life: 0.7, size: 5, add: true });
    }
  }
  function undeadDeath(B, e) {
    if (B.headless) return;
    const spectral = data(e).undead === 'spectral';
    fx(B, 'particles', e.x, midY(e), { n: 16, color: spectral ? ['#dff6ff', '#7fd6ff'] : ['#e8d0ff', '#9b5cff'], speed: 160, up: 60, life: 0.8, size: 6, gravity: -60, add: true });
  }

  /* ======================================================================== *
   *  CAPA COMÚN DE TODOS LOS ENEMIGOS                                          *
   * ======================================================================== */
  function commonUpdate(B, e, dt) {
    const d = data(e);
    // aliados animados por el tambor o por un grito de guerra: notas / chispas flotando
    if (e.buff && e.buff.src && e.buff.t > 0 && !B.headless) {
      d._noteT = (d._noteT || 0) - dt;
      if (d._noteT <= 0) {
        d._noteT = 0.8 + rnd(B) * 0.5;
        const drum = e.buff.src === 'tambor';
        fx(B, 'text', e.x + rand(B, -14, 14), topY(e) - 2, drum ? '♪' : '!', { color: drum ? '#ffd27a' : '#ff8a6a', size: drum ? 22 : 20, dur: 0.9, vy: -55 });
      }
    }
    if (d.undead) undeadTick(B, e, dt);
  }
  function commonDamage(B, e, amount, info) {
    if (!(amount > 0)) return amount;
    if (info && info.type === 'true') return amount;
    if (e.buff && e.buff.protect > 0 && e.buff.t > 0) amount *= 1 - e.buff.protect;
    return amount;
  }

  function finalize(def) {
    const own = { onSpawn: def.onSpawn, onUpdate: def.onUpdate, onDamage: def.onDamage, onAttack: def.onAttack, onReach: def.onReach, onDeath: def.onDeath };
    const id = def.id;
    def.onSpawn = guard(id + '.onSpawn', function (B, e) { data(e); if (own.onSpawn) own.onSpawn(B, e); });
    def.onUpdate = guard(id + '.onUpdate', function (B, e, dt) {
      commonUpdate(B, e, dt);
      return own.onUpdate ? own.onUpdate(B, e, dt) === true : false;
    }, false);
    def.onDamage = guard(id + '.onDamage', function (B, e, amount, info) {
      let a = amount;
      if (own.onDamage) { const r = own.onDamage(B, e, a, info || {}); if (typeof r === 'number' && r === r) a = r; }
      return commonDamage(B, e, a, info || {});
    }, function (B, e, amount) { return amount; });
    if (own.onAttack) def.onAttack = guard(id + '.onAttack', own.onAttack, false);
    if (own.onReach) def.onReach = guard(id + '.onReach', own.onReach, undefined);
    def.onDeath = guard(id + '.onDeath', function (B, e) {
      if (data(e).undead) undeadDeath(B, e);
      if (own.onDeath) own.onDeath(B, e);
    });
    return def;
  }

  /* ======================================================================== *
   *  LOS 12 ENEMIGOS                                                          *
   * ======================================================================== */
  const RESIST0 = { fire: 0, ice: 0, lightning: 0, arcane: 0, poison: 0, holy: 0, physical: 0 };
  const IMMUNE0 = { slow: false, freeze: false, stun: false, root: false, knockback: false };
  const LIST = [];
  function enemy(def) {
    def.resist = Object.assign({}, RESIST0, def.resist || {});
    def.immune = Object.assign({}, IMMUNE0, def.immune || {});
    def.air = !!def.air;
    def.range = def.range || 0;
    def.armor = def.armor || 0;
    def.xp = def.xp || 1;
    LIST.push(def);
    return def;
  }

  /* 1 · GOBLIN SALTARÍN — enjambre rápido */
  enemy({
    id: 'goblin_veloz', name: 'Goblin Saltarín', unlockLevel: 1,
    desc: 'Un goblin pequeñajo y nervioso que corre muchísimo. Casi nunca viene solo: ¡llega en manada!',
    weakness: 'Débil contra: daño en área (bolas de fuego, bombas, rayos en cadena) y flechas rápidas.',
    weakTo: ['area', 'fast'], counters: ['mago_fuego', 'granadero', 'hechicera_rayo', 'arquera'],
    tags: ['Rápido', 'Poca vida', 'En manada'], role: 'swarm', color: '#7bc043',
    sprite: 'enemy_goblin_veloz', size: 60, anim: 'hop', air: false, radius: 16,
    hp: 26, speed: 95, damage: 4, atkInterval: 0.8, range: 0, armor: 0,
    gold: 2, xp: 1, deathSound: 'die_goblin',
    onSpawn(B, e) {
      // cada uno corre a un ritmo un poco distinto: la manada se estira y parece más viva
      setSpeedMod(e, 'ritmo', 0.92 + rnd(B) * 0.16);
    },
  });

  /* 2 · ORCO ESCUDERO — bloquea los disparos rectos físicos */
  const SHIELD_BLOCK = 0.8;
  function shieldFactor(info) {
    if (!info) return 1;
    const type = info.type || 'physical';
    if (type !== 'physical') return 1;                 // la magia y el veneno no se paran con madera
    if (info.arc || info.dot) return 1;                // lo que cae en parábola le pasa por encima
    const src = info.source;
    if (src === 'trap' || src === 'bomb' || src === 'self' || src === 'dot') return 1;   // desde abajo / explosiones
    if (src === 'tap') return 0.5;                     // la ballesta del castillo dispara desde arriba
    if (info.pierce) return 0.5;                       // los virotes perforantes lo atraviesan a medias
    return 1 - SHIELD_BLOCK;
  }
  enemy({
    id: 'orco_escudo', name: 'Orco Escudero', unlockLevel: 3,
    desc: 'Un orco fuerte con un escudo enorme. Las flechas, virotes y balas que le llegan de frente rebotan en su escudo.',
    weakness: 'Débil contra: magia (fuego, hielo, rayo, arcano) y disparos en parábola (catapulta, cañón).',
    weakTo: ['magic', 'arc'], counters: ['mago_fuego', 'maga_hielo', 'hechicera_rayo', 'arcano', 'ingeniero', 'catapulta'],
    tags: ['Escudo', 'Resistente'], role: 'tank', color: '#6d8b3a',
    sprite: 'enemy_orco_escudo', size: 88, anim: 'walk', air: false, radius: 24,
    hp: 70, speed: 52, damage: 9, atkInterval: 1.3, range: 0, armor: 0.1, shieldBlock: SHIELD_BLOCK,
    gold: 5, xp: 3, deathSound: 'die_orc',
    onDamage(B, e, amount, info) {
      const f = shieldFactor(info);
      if (f < 1 && amount > 0 && !B.headless) {
        const d = data(e);
        if (now(B) - (d.sparkT == null ? -9 : d.sparkT) > 0.12) {
          d.sparkT = now(B);
          fx(B, 'particles', e.x + 22 * (e.scale || 1), midY(e), { n: 5, color: ['#fff3b0', '#ffffff', '#ffd36b'], speed: 190, life: 0.25, size: 3, gravity: 300, angle: -Math.PI * 0.15, spread: 1.1 });
          sfx(B, 'hit', 0.12);
        }
        say(B, e, 'block', '¡Bloqueado!', '#dfe6ea', 1.8, 19);
      }
      return amount * f;
    },
  });

  /* 3 · GOBLIN PETARDO — kamikaze contra la muralla */
  function bomberArm(B, e) {
    const d = data(e);
    if (d.armed || d.exploded) return;
    d.armed = true; d.armedAt = now(B);
    say(B, e, 'arm', '¡Tsss!', '#ffd23f', 5, 22);
    fx(B, 'ring', e.x + 10, e.y - 26, 46, { color: 'rgba(255,122,43,0.95)', dur: 0.45, width: 4 });
  }
  function bomberBoomFx(B, x, y, big) {
    if (B.headless) return;
    fx(B, 'explosion', x, y, big ? 100 : 80, { color: '#ffb02e' });
    fx(B, 'particles', x, y, { n: 16, color: ['#ffd23f', '#ff7a1c', '#ffffff'], kind: 'star', speed: 330, life: 0.55, size: 5, gravity: 500 });
    fx(B, 'text', x, y - 74, '¡BUM!', { color: '#ffd23f', size: big ? 36 : 28, dur: 0.9 });
    fx(B, 'shake', big ? 9 : 6, 0.3);
  }
  function bomberWallBlast(B, e) {
    const d = data(e);
    if (d.exploded) return;
    d.exploded = true;
    bomberBoomFx(B, e.x + 16, e.y - 30, true);
    sfx(B, 'bomb', 0.05);
  }
  enemy({
    id: 'goblin_bombardero', name: 'Goblin Petardo', unlockLevel: 5,
    desc: 'Corre con una bomba enorme a la espalda hacia tu muralla y... ¡BUM! Explota y hace muchísimo daño. Si lo derribas antes, su bomba estalla entre sus amigos.',
    weakness: 'Débil contra: daño rápido a distancia (arquera, mosquetera, ballestero). ¡Derríbalo antes de que llegue!',
    weakTo: ['fast', 'longrange'], counters: ['arquera', 'mosquetera', 'ballestero', 'flechas'],
    tags: ['Explota', 'Kamikaze', 'Rápido'], role: 'bomber', color: '#e05a2b',
    sprite: 'enemy_goblin_bombardero', size: 64, anim: 'walk', air: false, radius: 18,
    hp: 30, speed: 100, damage: 50, atkInterval: 0.4, range: 0, armor: 0, resist: { fire: -0.25 },
    gold: 4, xp: 2, deathSound: 'die_goblin',
    onUpdate(B, e, dt) {
      const d = data(e);
      if (d.exploded) { if (!d.gone) { d.gone = true; killSelf(B, e); } return true; }
      if (!B.headless) {
        d.fuse = (d.fuse || 0) - dt;
        if (d.fuse <= 0) {   // chispas de la mecha
          d.fuse = d.armed ? 0.05 : 0.12;
          fx(B, 'particles', e.x - 9, topY(e) + 6, { n: d.armed ? 3 : 1, color: ['#ffd23f', '#ffffff', '#ff8a2a'], speed: 80, life: 0.3, size: 3, gravity: -60, add: true });
        }
      }
      // seguro: si ya está pegado a su objetivo y el golpe no llega (aturdido...), la mecha se acaba igual
      if (d.armed && now(B) - d.armedAt > 1.4) {
        bomberWallBlast(B, e);
        if (e.target === 'barricada') damageBlock(B, blockAhead(B, e), e.damage);
        else hitCastle(B, e.damage, { source: e, type: 'fire' });
      }
      return false;
    },
    onReach(B, e) { bomberArm(B, e); },
    onAttack(B, e) {
      if (data(e).exploded) return true;
      bomberArm(B, e);
      bomberWallBlast(B, e);
      return false;            // el golpe normal del motor aplica `damage` (la explosión) a muralla/barricada/castillo
    },
    onDeath(B, e) {
      const d = data(e);
      if (d.exploded) return;
      d.exploded = true;
      // derribado a tiempo: la bomba estalla y hiere a los enemigos que tenga cerca
      const x = e.x, y = e.y - 26, R = 105, dmg = (e.maxHp || 30) * 1.8;
      bomberBoomFx(B, x, y, false);
      sfx(B, 'bomb', 0.05);
      B.after(0.06, function () {
        if (B.over) return;
        try { B.damageArea(x, y, R, dmg, { type: 'fire', source: 'bomb', air: 'ground' }); } catch (err) { report('petardo.damageArea', err); }
      });
    },
  });

  /* 4 · GOBLIN PLANEADOR — volador que ignora la muralla */
  enemy({
    id: 'goblin_planeador', name: 'Goblin Planeador', unlockLevel: 7,
    desc: 'Vuela con unas alas de cuero y pasa por encima de la muralla, las trampas y la barricada para atacar directamente al castillo.',
    weakness: 'Débil contra: flechas, rayos y halcones (los héroes que disparan al aire).',
    weakTo: ['antiair', 'lightning'], counters: ['arquera', 'hechicera_rayo', 'halconera', 'rayos', 'flechas'],
    tags: ['Volador', 'Ignora la muralla'], role: 'flyer', color: '#8fd0ff',
    sprite: 'enemy_goblin_planeador', size: 66, anim: 'fly', air: true, radius: 20,
    hp: 30, speed: 80, damage: 5, atkInterval: 1.1, range: 0, armor: 0, resist: { lightning: -0.3 },
    gold: 4, xp: 2, deathSound: 'die_goblin',
    onUpdate(B, e, dt) {
      if (B.headless) return false;
      const d = data(e);
      d.trail = (d.trail || 0) - dt;
      if (d.trail <= 0 && e.state === 'walk') {   // estela de viento
        d.trail = 0.3;
        fx(B, 'particles', e.x - 26, e.y, { n: 1, color: 'rgba(255,255,255,0.8)', speed: 30, angle: Math.PI, spread: 0.3, life: 0.5, size: 3, gravity: 0 });
      }
      return false;
    },
    onDeath(B, e) {
      if (!B.headless) fx(B, 'particles', e.x, e.y, { n: 10, color: ['#c9a66b', '#8a6a44'], kind: 'leaf', speed: 120, life: 1.0, size: 6, gravity: 220 });
    },
  });

  /* 5 · JINETE DE LOBO — muy rápido, salta obstáculos */
  enemy({
    id: 'jinete_lobo', name: 'Jinete de Lobo', unlockLevel: 12,
    desc: 'Un goblin montado en un lobo salvaje. Corre muchísimo y salta por encima de las barricadas y las trampas. Su primer mordisco es tremendo.',
    weakness: 'Débil contra: hielo (ralentizar y congelar) y aturdir (martillos).',
    weakTo: ['ice', 'stun'], counters: ['maga_hielo', 'martillo', 'druida'],
    tags: ['Muy rápido', 'Salta obstáculos'], role: 'runner', color: '#8a8f99',
    sprite: 'enemy_jinete_lobo', size: 86, anim: 'hop', air: false, radius: 26, leaps: true,
    hp: 55, speed: 140, damage: 7, atkInterval: 0.75, range: 0, armor: 0.05, resist: { ice: -0.4 },
    gold: 5, xp: 3, deathSound: 'die_orc',
    onSpawn(B, e) { sfx(B, 'howl', 2.5); },
    onUpdate(B, e) {
      if (hasStatus(e, 'slow') || hasStatus(e, 'freeze')) say(B, e, 'brr', '¡Brrr!', '#bfefff', 5, 18);
      return false;
    },
    onAttack(B, e) {
      const d = data(e);
      if (d.pounced) return false;
      d.pounced = true;
      if (e.target === 'barricada') return false;
      hitCastle(B, e.damage * 2, { source: e });          // primer zarpazo: el doble
      if (!B.headless) {
        fx(B, 'text', e.x + 20, topY(e) - 6, '¡Zarpazo!', { color: '#ffffff', size: 22 });
        fx(B, 'particles', e.x + 34, midY(e), { n: 9, color: ['#ffffff', '#ffd6d6'], speed: 220, life: 0.3, size: 3, gravity: 0 });
      }
      sfx(B, 'hit_heavy', 0.1);
      return true;
    },
  });

  /* 6 · CHAMÁN CURANDERO — se queda atrás y cura en área */
  const SHAMAN = { every: 3.5, radius: 200, pct: 0.12, cap: 0.6 };
  function shamanPulse(B, e) {
    const R = SHAMAN.radius, cx = e.x, cy = e.y - 40;
    const weak = hasStatus(e, 'poison');                  // envenenado: cura la mitad (y B.healEnemy vuelve a reducirla en aliados envenenados)
    const mul = weak ? 0.5 : 1;
    let list = [];
    try { list = B.enemiesInRadius(cx, cy, R, { air: 'both' }) || []; } catch (err) { report('enemiesInRadius', err); }
    let n = 0;
    for (const a of list) {
      if (!alive(a) || a.hp >= a.maxHp - 0.5 || (a.def && a.def.noHeal)) continue;
      const amount = Math.min(a.maxHp * SHAMAN.pct, (e.maxHp || 48) * SHAMAN.cap) * mul;
      try { B.healEnemy(a, amount); } catch (err) { report('healEnemy', err); }
      if (!B.headless) fx(B, 'particles', a.x, midY(a), { n: 6, color: ['#7dff8a', '#d8ffd0'], kind: 'star', speed: 60, up: 40, life: 0.7, size: 4, gravity: -80 });
      n++;
    }
    if (!B.headless) {
      fx(B, 'ring', cx, e.y - 10, R, { color: 'rgba(110,255,130,0.9)', dur: 0.6, width: 5 });
      fx(B, 'zone', e.x, world().GROUND, R * 0.75, { color: 'rgba(90,220,110,0.35)', dur: 0.6 });
      fx(B, 'particles', e.x + 18, topY(e) + 8, { n: 10, color: ['#9dff9a', '#ffffff'], speed: 90, life: 0.8, size: 4, gravity: -60, add: true });
    }
    if (n) sfx(B, 'heal', 0.5);
    if (n && weak) say(B, e, 'weak', 'Curación débil', '#b6ff6a', 3, 18);
  }
  enemy({
    id: 'chaman', name: 'Chamán Curandero', unlockLevel: 15,
    desc: 'Un orco viejo y sabio que se queda atrás y cura a sus amigos con magia verde. ¡Mientras viva, tus enemigos no caerán!',
    weakness: 'Débil contra: francotiradores como el Ballestero y el veneno (que reduce mucho su curación).',
    weakTo: ['sniper', 'poison'], counters: ['ballestero', 'envenenadora', 'druida', 'mosquetera'],
    tags: ['Curandero', 'A distancia', 'Se queda atrás'], role: 'healer', healer: true, color: '#5fd35f',
    sprite: 'enemy_chaman', size: 82, anim: 'walk', air: false, radius: 22,
    hp: 48, speed: 46, damage: 6, atkInterval: 2.2, range: 470, armor: 0, resist: { poison: -0.2 },
    projectile: { kind: 'magic', speed: 380, arc: 60, color: '#7dff8a' },
    heal: SHAMAN, gold: 6, xp: 4, deathSound: 'die_orc',
    onSpawn(B, e) { data(e).healT = 1.2 + rnd(B) * 1.2; },
    onUpdate(B, e, dt) {
      const d = data(e);
      if (isHeld(e)) return false;                        // congelado o aturdido no cura
      d.healT -= dt;
      if (d.healT <= 0) { d.healT = SHAMAN.every; shamanPulse(B, e); }
      return false;
    },
  });

  /* 7 · GOBLIN ARQUERO — dispara desde lejos */
  enemy({
    id: 'goblin_arquero', name: 'Goblin Arquero', unlockLevel: 18,
    desc: 'Se para lejos de tu muralla y dispara flechas sin parar. Como no se acerca, las trampas no lo tocan.',
    weakness: 'Débil contra: héroes de largo alcance (Ballestero, Arquera, Mosquetera).',
    weakTo: ['longrange', 'sniper'], counters: ['ballestero', 'arquera', 'mosquetera', 'catapulta'],
    tags: ['A distancia', 'Frágil'], role: 'ranged', ranged: true, color: '#9bbf4a',
    sprite: 'enemy_goblin_arquero', size: 64, anim: 'walk', air: false, radius: 18,
    hp: 30, speed: 72, damage: 6, atkInterval: 1.6, range: 520, armor: 0,
    projectile: { kind: 'arrow', speed: 600, arc: 70 },
    gold: 4, xp: 2, deathSound: 'die_goblin',
  });

  /* 8 · ORCO BERSERKER — furia por debajo del 50 % */
  function enrage(B, e) {
    const d = data(e);
    if (d.rage) return;
    d.rage = true;
    setSpeedMod(e, 'furia', 1.7);
    e.damage *= 1.6;
    e.atkInterval *= 0.65;
    e.scale = (e.scale || 1) * 1.1;
    if (!B.headless) {
      fx(B, 'text', e.x, topY(e) - 10, '¡FURIA!', { color: '#ff3b2f', size: 30 });
      fx(B, 'ring', e.x, midY(e), 74, { color: 'rgba(255,59,47,0.95)', dur: 0.5, width: 6 });
      fx(B, 'particles', e.x, midY(e), { n: 16, color: ['#ff4a2f', '#ffb3a0'], speed: 230, life: 0.5, size: 4, gravity: 0 });
    }
    sfx(B, 'roar', 0.8);
  }
  enemy({
    id: 'orco_berserker', name: 'Orco Berserker', unlockLevel: 23,
    desc: 'Un orco salvaje con dos hachas. Cuando le queda menos de la mitad de la vida se pone rojo de furia: corre más y pega más fuerte.',
    weakness: 'Débil contra: aturdir, congelar y daño explosivo (¡acábalo de golpe!).',
    weakTo: ['stun', 'freeze', 'burst'], counters: ['martillo', 'maga_hielo', 'granadero', 'mosquetera'],
    tags: ['Furia', 'Peligroso'], role: 'bruiser', color: '#c0392b',
    sprite: 'enemy_orco_berserker', size: 92, anim: 'walk', air: false, radius: 26,
    hp: 105, speed: 56, damage: 12, atkInterval: 1.1, range: 0, armor: 0.1,
    gold: 7, xp: 4, deathSound: 'die_orc',
    onUpdate(B, e, dt) {
      const d = data(e);
      if (!d.rage && e.hp < e.maxHp * 0.5) enrage(B, e);
      if (d.rage && !B.headless) {
        d.steam = (d.steam || 0) - dt;
        if (d.steam <= 0) { d.steam = 0.18; fx(B, 'particles', e.x + rand(B, -10, 10), topY(e) + 14, { n: 2, color: ['#ff5a3c', '#ffb3a0'], speed: 50, up: 30, life: 0.5, size: 4, gravity: -90 }); }
      }
      return false;
    },
  });

  /* 9 · ORCO TAMBORILERO — su tambor acelera y protege */
  const DRUM = { every: 2.2, radius: 240, speed: 0.3, atk: 0.15, protect: 0.3, dur: 2.7 };
  function drumBeat(B, e) {
    const R = DRUM.radius;
    if (!B.headless) {
      fx(B, 'ring', e.x, midY(e), R, { color: 'rgba(255,180,70,0.95)', dur: 0.7, width: 6 });
      fx(B, 'ring', e.x, world().GROUND, R * 0.9, { color: 'rgba(255,214,120,0.7)', dur: 0.8, width: 4 });
      B.after(0.18, function () { if (alive(e)) fx(B, 'ring', e.x, midY(e), R * 0.6, { color: 'rgba(255,230,150,0.85)', dur: 0.5, width: 4 }); });
      fx(B, 'particles', e.x + 14, midY(e), { n: 6, color: ['#ffd27a', '#ffffff'], kind: 'star', speed: 120, life: 0.4, size: 4, gravity: 0 });
    }
    sfx(B, 'drum', 0.45);
    let list = [];
    try { list = B.enemiesInRadius(e.x, e.y - 40, R, { air: 'both' }) || []; } catch (err) { report('enemiesInRadius', err); }
    for (const a of list) {
      if (a === e || !alive(a)) continue;
      buffEnemy(B, a, { speed: DRUM.speed, atk: DRUM.atk, protect: DRUM.protect, duration: DRUM.dur, src: 'tambor', strength: 1 });
    }
  }
  enemy({
    id: 'orco_tambor', name: 'Orco Tamborilero', unlockLevel: 27,
    desc: 'Toca un tambor de guerra enorme. ¡Bum, bum! Sus ondas hacen que los enemigos de alrededor corran más y reciban menos daño.',
    weakness: 'Débil contra: daño concentrado en él (Ballestero, Cazadora) y veneno. Él no se protege a sí mismo.',
    weakTo: ['focus', 'poison'], counters: ['ballestero', 'cazadora', 'envenenadora', 'mosquetera'],
    tags: ['Apoyo', 'Aura', 'Acelera'], role: 'support', support: true, color: '#d9822b',
    sprite: 'enemy_orco_tambor', size: 90, anim: 'walk', air: false, radius: 28,
    hp: 95, speed: 48, damage: 7, atkInterval: 1.4, range: 0, armor: 0.15, resist: { poison: -0.25 },
    aura: DRUM, gold: 8, xp: 5, deathSound: 'die_orc',
    onSpawn(B, e) { data(e).beat = 0.6 + rnd(B) * 0.8; },
    onUpdate(B, e, dt) {
      const d = data(e);
      if (isHeld(e)) return false;
      d.beat -= dt;
      if (d.beat <= 0) { d.beat = DRUM.every; drumBeat(B, e); }
      return false;
    },
  });

  /* 10 · GOBLIN TOPO — viaja bajo tierra y sale junto a la muralla */
  function moleEmerge(B, e) {
    const d = data(e);
    e.burrowed = false;
    d.emerged = true;
    d.dizzyUntil = now(B) + 1.4;
    try { B.applyStatus(e, 'stun', { duration: 1.1 }); } catch (err) { report('applyStatus', err); }
    if (!B.headless) {
      fx(B, 'particles', e.x, e.y - 6, { n: 24, kind: 'debris', color: ['#6b4a2b', '#8a6a44', '#4e3420'], speed: 280, up: 260, life: 0.8, size: 5, gravity: 900 });
      fx(B, 'smoke', e.x, e.y - 10, 6);
      fx(B, 'ring', e.x, world().GROUND, 60, { color: 'rgba(160,110,60,0.9)', dur: 0.4, width: 5 });
      fx(B, 'text', e.x, topY(e) - 8, '¡Sorpresa!', { color: '#ffe0a3', size: 24 });
    }
    sfx(B, 'burrow', 0.2);
  }
  enemy({
    id: 'goblin_topo', name: 'Goblin Topo', unlockLevel: 32,
    desc: 'Viaja bajo tierra, donde casi nada le alcanza, y sale de golpe justo al lado de tu muralla. Al salir se marea un momento.',
    weakness: 'Débil contra: trampas (le dan aunque esté bajo tierra), terremotos y daño en área cuando sale mareado.',
    weakTo: ['traps', 'quake', 'area'], counters: ['pinchos', 'martillo', 'granadero', 'mago_fuego'],
    tags: ['Bajo tierra', 'Sorpresa'], role: 'digger', color: '#8d6e63',
    sprite: 'enemy_goblin_topo', size: 64, anim: 'burrow', air: false, radius: 18,
    hp: 52, speed: 68, damage: 9, atkInterval: 0.9, range: 0, armor: 0.15,
    gold: 6, xp: 4, deathSound: 'die_goblin',
    onSpawn(B, e) { e.burrowed = true; sfx(B, 'burrow', 1.5); },
    onUpdate(B, e, dt) {
      if (e.burrowed) {
        // bajo tierra pasa por debajo de la barricada: lo movemos nosotros
        const ex = frontX(B, e, { ignoreBlock: true }) - 44;
        if (e.x >= ex) { moleEmerge(B, e); return true; }
        e.x = Math.min(ex, e.x + e.speed * speedMul(B, e) * dt);
        e.state = 'walk';
        return true;
      }
      const d = data(e);
      if (d.dizzyUntil > now(B) && !B.headless) {
        d.star = (d.star || 0) - dt;
        if (d.star <= 0) { d.star = 0.3; fx(B, 'particles', e.x, topY(e) + 4, { n: 1, kind: 'star', color: '#ffe14a', speed: 30, life: 0.5, size: 5, gravity: 0 }); }
      }
      return false;
    },
    onDamage(B, e, amount) { return data(e).dizzyUntil > now(B) ? amount * 1.4 : amount; },
  });

  /* 11 · TROLL DEL MUSGO — tanque que se regenera si no arde */
  const TROLL_REGEN = 0.025;    // fracción de la vida máxima por segundo
  enemy({
    id: 'troll', name: 'Troll del Musgo', unlockLevel: 36,
    desc: 'Un gigante lento, enorme y muy duro, cubierto de musgo. Si no lo quemas, sus heridas se cierran solas.',
    weakness: 'Débil contra: fuego (le impide regenerarse), veneno y ácido que rompe su armadura.',
    weakTo: ['fire', 'poison', 'percent'], counters: ['mago_fuego', 'envenenadora', 'alquimista', 'cazadora'],
    tags: ['Tanque', 'Se regenera', 'Armadura'], role: 'tank', color: '#4e8a52',
    sprite: 'enemy_troll', size: 150, anim: 'heavy', air: false, radius: 44,
    hp: 330, speed: 32, damage: 24, atkInterval: 1.9, range: 0, armor: 0.4, resist: { fire: -0.3, poison: -0.2 },
    regen: TROLL_REGEN, gold: 18, xp: 10, deathSound: 'die_big',
    onUpdate(B, e, dt) {
      const d = data(e);
      d.regenT = (d.regenT == null ? 1 : d.regenT) - dt;
      if (d.regenT > 0) return false;
      d.regenT = 1;
      if (hasStatus(e, 'burn')) {
        if (!B.headless) fx(B, 'smoke', e.x, topY(e) + 30, 3);
        say(B, e, 'noregen', '¡No se cura!', '#ffb38a', 4, 20);
        return false;
      }
      if (e.hp < e.maxHp) {
        try { B.healEnemy(e, e.maxHp * TROLL_REGEN); } catch (err) { report('healEnemy', err); }
        if (!B.headless) fx(B, 'particles', e.x, midY(e), { n: 5, kind: 'leaf', color: ['#6fdc5a', '#3f9a3a'], speed: 50, up: 40, life: 0.9, size: 5, gravity: -40 });
      }
      return false;
    },
  });

  /* 12 · ARIETE DE GUERRA — rompemurallas imparable */
  enemy({
    id: 'orco_ariete', name: 'Ariete de Guerra', unlockLevel: 42,
    desc: 'Dos orcos empujan un tronco gigante con cabeza de hierro. Golpea la muralla con una fuerza brutal y nada lo frena ni lo empuja.',
    weakness: 'Débil contra: fuego (¡es de madera!) y trampas. Congelar y aturdir sí lo paran.',
    weakTo: ['fire', 'traps'], counters: ['mago_fuego', 'pinchos', 'brea', 'alquimista'],
    tags: ['Rompemurallas', 'Imparable'], role: 'siege', color: '#8d5a2b',
    sprite: 'enemy_orco_ariete', size: 108, anim: 'roll', air: false, radius: 50,
    hp: 230, speed: 38, damage: 26, atkInterval: 2.4, range: 0, armor: 0.35, resist: { fire: -0.6 },
    immune: { slow: true, knockback: true, root: true }, wallMul: 2.5, trapMul: 2,
    gold: 16, xp: 9, deathSound: 'die_big',
    onUpdate(B, e) {
      if (hasStatus(e, 'burn')) say(B, e, 'arde', '¡Arde la madera!', '#ffb35a', 6, 20);
      return false;
    },
    onDamage(B, e, amount, info) {
      if (info && info.source === 'trap') { say(B, e, 'crac', '¡Crac!', '#ffe0a3', 2, 20); return amount * 2; }
      return amount;
    },
    onAttack(B, e) {
      const Wd = world();
      if (e.target === 'muralla') hitCastle(B, e.damage * 2.5, { source: e });
      else if (e.target === 'barricada') damageBlock(B, blockAhead(B, e), e.damage * 2.5);
      else return false;
      if (!B.headless) {
        const hx = e.target === 'muralla' ? Wd.WALL_X : e.x + 50;
        fx(B, 'shake', 8, 0.25);
        fx(B, 'particles', hx, e.y - 40, { n: 14, kind: 'debris', color: ['#b9a48a', '#8a6a44', '#6f4723'], speed: 260, up: 160, life: 0.6, size: 5, gravity: 800 });
        fx(B, 'text', hx - 30, e.y - 120, '¡PUM!', { color: '#ffe0a3', size: 30, dur: 0.8 });
      }
      sfx(B, 'hit_heavy', 0.1);
      return true;
    },
  });

  /* ======================================================================== *
   *  TIPO AUXILIAR OCULTO (solo lo invoca el Gran Chamán)                      *
   * ======================================================================== */
  const TOTEM = { every: 2.5, radius: 330, pct: 0.04, bossPct: 0.012 };
  function drawTotem(ctx, e, B) {
    if (e.removed) return;
    const t = now(B);
    let alpha = 1, tilt = 0, sink = 0;
    if (e.dead) {
      const k = Math.min(1, (e.dying || 0) / 0.7);
      alpha = 1 - k; tilt = -k * 0.35; sink = k * 18;
      if (alpha <= 0.01) return;
    }
    ctx.translate(e.x, e.y + sink);
    ctx.rotate(tilt);
    ctx.globalAlpha = alpha;
    const pulse = 0.5 + 0.5 * Math.sin(t * 4 + e.id);
    // resplandor verde
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, -70, 4, 0, -70, 78);
    g.addColorStop(0, 'rgba(140,255,120,' + (0.3 + pulse * 0.25) + ')'); g.addColorStop(1, 'rgba(140,255,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -70, 78, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineJoin = 'round'; ctx.strokeStyle = '#1e1527'; ctx.lineWidth = 3;
    // base de piedras
    ctx.fillStyle = '#6f6a63'; roundRect(ctx, -36, -16, 72, 20, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-30, -13, 40, 4);
    // poste
    ctx.fillStyle = '#7a4f2a'; ctx.fillRect(-21, -92, 42, 78); ctx.strokeRect(-21, -92, 42, 78);
    ctx.strokeStyle = 'rgba(30,21,39,0.45)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-9, -88); ctx.lineTo(-11, -18); ctx.moveTo(8, -86); ctx.lineTo(10, -20); ctx.stroke();
    // máscara inferior (verde, boca abierta)
    ctx.strokeStyle = '#1e1527'; ctx.lineWidth = 3;
    ctx.fillStyle = '#3f8a3a'; roundRect(ctx, -31, -58, 62, 34, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1e1527'; roundRect(ctx, -14, -38, 28, 10, 4); ctx.fill();
    ctx.fillStyle = '#efe9df';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-12 + i * 7, -38); ctx.lineTo(-9 + i * 7, -33); ctx.lineTo(-6 + i * 7, -38); ctx.fill(); }
    ctx.fillStyle = '#ffe14a'; ctx.beginPath(); ctx.arc(-13, -49, 4, 0, TAU); ctx.arc(13, -49, 4, 0, TAU); ctx.fill();
    // cráneo con cuernos arriba
    ctx.fillStyle = '#d9cfb8';
    ctx.beginPath(); ctx.moveTo(-26, -78); ctx.quadraticCurveTo(-40, -94, -30, -100); ctx.quadraticCurveTo(-30, -88, -18, -84); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(26, -78); ctx.quadraticCurveTo(40, -94, 30, -100); ctx.quadraticCurveTo(30, -88, 18, -84); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#efe9df';
    ctx.beginPath(); ctx.arc(0, -80, 21, Math.PI * 0.9, Math.PI * 2.1); ctx.lineTo(13, -60); ctx.lineTo(-13, -60); ctx.closePath(); ctx.fill(); ctx.stroke();
    // ojos que brillan
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(150,255,120,' + (0.7 + pulse * 0.3) + ')';
    ctx.beginPath(); ctx.arc(-8, -78, 5.5, 0, TAU); ctx.arc(8, -78, 5.5, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // plumas
    ctx.fillStyle = '#e8463c'; ctx.beginPath(); ctx.ellipse(-30, -66, 5, 13, -0.5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(30, -66, 5, 13, 0.5, 0, TAU); ctx.fill(); ctx.stroke();
    // destello al recibir daño
    if (e.hitFlash > 0 && !e.dead) {
      ctx.globalAlpha = alpha * Math.min(1, e.hitFlash / 0.12) * 0.6;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-36, -100, 72, 104);
    }
  }
  function totemPulse(B, e) {
    let list = [];
    try { list = B.enemiesInRadius(e.x, e.y - 50, TOTEM.radius, { air: 'both' }) || []; } catch (err) { report('enemiesInRadius', err); }
    let healed = 0;
    for (const a of list) {
      if (a === e || !alive(a) || a.hp >= a.maxHp - 0.5 || (a.def && a.def.noHeal)) continue;
      const amount = a.boss ? a.maxHp * TOTEM.bossPct : Math.min(a.maxHp * TOTEM.pct * 2, e.maxHp * 0.5);
      try { B.healEnemy(a, amount); } catch (err) { report('healEnemy', err); }
      healed++;
      if (!B.headless && a.boss) fx(B, 'beam', e.x, e.y - 80, a.x, midY(a), { color: '#7dff8a', width: 5, dur: 0.3 });
    }
    if (!B.headless) {
      fx(B, 'ring', e.x, e.y - 20, TOTEM.radius * 0.6, { color: 'rgba(120,255,120,0.85)', dur: 0.6, width: 4 });
      fx(B, 'particles', e.x, e.y - 82, { n: 8, color: ['#9dff9a', '#ffffff'], speed: 70, up: 50, life: 0.7, size: 4, gravity: -60, add: true });
    }
    if (healed) sfx(B, 'heal', 0.6);
  }
  const TOTEM_DEF = finalize(enemy({
    id: 'totem_pantano', name: 'Tótem del Pantano', unlockLevel: 20, hidden: true, minionOnly: true, noHeal: true,
    desc: 'Un poste mágico que levanta el Gran Chamán. Cura a todos los enemigos de alrededor, ¡también a su jefe!',
    weakness: 'Débil contra: cualquier ataque: no se mueve ni se defiende. ¡Rómpelo rápido!',
    weakTo: ['focus', 'sniper'], counters: ['ballestero', 'mosquetera', 'cazadora'],
    tags: ['Curandero', 'Inmóvil'], role: 'healer', healer: true, color: '#3f8a3a',
    sprite: 'enemy_totem_pantano', size: 100, anim: 'heavy', air: false, radius: 26,
    hp: 120, speed: 0, damage: 0, atkInterval: 9, range: 0, armor: 0.2, resist: { poison: 0.5, fire: -0.3 },
    immune: { slow: true, freeze: true, stun: true, root: true, knockback: true },
    gold: 3, xp: 2, deathSound: 'hit_heavy',
    onSpawn(B, e) {
      data(e).pulse = 1.2;
      if (!B.headless) {
        fx(B, 'particles', e.x, e.y - 10, { n: 20, kind: 'debris', color: ['#6b4a2b', '#8a6a44'], speed: 220, up: 200, life: 0.7, size: 5, gravity: 900 });
        fx(B, 'ring', e.x, world().GROUND, 70, { color: 'rgba(120,255,120,0.9)', dur: 0.5, width: 5 });
      }
      overlay(B, e, 'totem', drawTotem);
    },
    onUpdate(B, e, dt) {
      const d = data(e);
      overlay(B, e, 'totem', drawTotem);
      e.state = 'idle';
      d.pulse -= dt;
      if (d.pulse <= 0) { d.pulse = TOTEM.every; totemPulse(B, e); }
      return true;      // no anda ni ataca
    },
    onDeath(B, e) {
      if (B.headless) return;
      fx(B, 'particles', e.x, e.y - 50, { n: 18, kind: 'debris', color: ['#7a4f2a', '#d9cfb8', '#3f8a3a'], speed: 220, up: 180, life: 0.8, size: 6, gravity: 900 });
      fx(B, 'text', e.x, e.y - 120, '¡Tótem roto!', { color: '#b6ff6a', size: 22 });
    },
  }));
  LIST.pop();   // el tótem no forma parte de la lista pública de 12

  /* ======================================================================== *
   *  REGISTRO                                                                 *
   * ======================================================================== */
  const enemies = {};
  for (const def of LIST) enemies[def.id] = finalize(def);
  // Tipos auxiliares: accesibles por id (B.spawnEnemy) pero NO enumerables (no salen en listas ni en la interfaz)
  Object.defineProperty(enemies, 'totem_pantano', { value: TOTEM_DEF, enumerable: false, configurable: true, writable: true });
  BB.data.enemies = enemies;

  // Orden de aparición (útil para la interfaz)
  BB.data.enemyOrder = LIST.slice().sort((a, b) => a.unlockLevel - b.unlockLevel).map(d => d.id);

  // Nombres en español de las claves de weakTo
  BB.data.weakLabels = {
    area: 'Daño en área', fast: 'Disparo rápido', longrange: 'Largo alcance', sniper: 'Francotiradores',
    magic: 'Magia', arc: 'Disparos en parábola', fire: 'Fuego', ice: 'Hielo', lightning: 'Rayo',
    arcane: 'Arcano', poison: 'Veneno', holy: 'Luz sagrada', antiair: 'Antiaéreo', stun: 'Aturdir',
    freeze: 'Congelar', slow: 'Ralentizar', burst: 'Daño explosivo', focus: 'Daño concentrado',
    traps: 'Trampas', quake: 'Terremotos', percent: 'Daño por porcentaje',
  };

  // Utilidades para bosses.js y pruebas
  BB.enemyKit = {
    TAU, world, report, guard, bstate, now, rnd, rand, clamp, pick, shuffle,
    data, alive, sizeOf, footY, topY, midY,
    fx, sfx, say, hasStatus, isHeld, speedMul, setSpeedMod, buffEnemy,
    wallUp, siegePoint, hitCastle, blockAhead, damageBlock, frontX, killSelf,
    shoot, telegraph, summon, disableHeroes, heroPool, DISABLE_STYLE,
    overlay, dropOverlay, roundRect, drawSkull, makeUndead,
    commonUpdate, commonDamage, shieldFactor,
  };
})();
