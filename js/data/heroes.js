/* Bastión Bravo · Héroes (20): ataque base, pasiva y habilidad especial.
   Contrato: docs/DISENO.md §2.4, §4.5, §4.8 y §4.13.
   Nivel y talentos se calculan en js/data/upgrades.js (BB.heroStats); aquí solo se leen
   hero.stats.attack, hero.stats.abilityPower, hero.stats.abilityMods, hero.stats.passiveMods
   y hero.stats.talents (rangos de cada nodo, para las variantes). */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  BB.data = BB.data || {};

  // ================================================================ kit de habilidades
  const AB_RANGE = 1360;                         // las habilidades alcanzan casi todo el campo
  const GROUND = () => (BB.WORLD ? BB.WORLD.GROUND : 560);
  const WALL = () => (BB.WORLD ? BB.WORLD.WALL_X : 1235);
  const CASTLE = () => (BB.WORLD ? BB.WORLD.CASTLE_X : 1300);

  function rnd(B) { return B && typeof B.rng === 'function' ? B.rng() : Math.random(); }
  function rk(hero, id) { const t = hero && hero.stats && hero.stats.talents; return (t && t[id]) | 0; }
  function AP(hero) { const p = hero && hero.stats && hero.stats.abilityPower; return p > 0 ? p : 1; }
  function MOD(hero) {
    const m = (hero && hero.stats && hero.stats.abilityMods) || {};
    return { radius: m.radius || 1, duration: m.duration || 1, count: m.count || 0 };
  }
  function PM(hero, key) { const p = hero && hero.stats && hero.stats.passiveMods; return (p && p[key]) || 0; }
  function ATK(hero) { return (hero && hero.stats && hero.stats.attack) || (hero && hero.def && hero.def.attack) || {}; }
  function soft(p) { return 1 + 0.35 * Math.log(Math.max(1, p)); }        // escala suave (curas, escudos)
  function dataOf(o) { return o.data || (o.data = {}); }
  function fmtN(v) { return BB.util && BB.util.fmt ? BB.util.fmt(Math.round(v)) : String(Math.round(v)); }

  function fx(B, name) {
    const f = B && B.fx && B.fx[name];
    if (typeof f !== 'function') return;
    try { f.apply(B.fx, Array.prototype.slice.call(arguments, 2)); } catch (err) { console.warn('[fx ' + name + ']', err); }
  }
  function snd(B, name) { if (B && typeof B.sound === 'function') { try { B.sound(name); } catch (err) { /* sin sonido */ } } }
  function say(B, x, y, str, color, size) { fx(B, 'text', x, y, str, { color: color || '#ffffff', size: size || 30, dur: 1.4, vy: -30 }); }

  function alive(e) { return !!e && !e.dead && !e.removed && e.hp > 0; }
  function eSize(e) { return (e.size || (e.def && e.def.size) || 60) * (e.scale || 1); }
  function eRad(e) { return (e.radius || (e.def && e.def.radius) || 18) * (e.scale || 1); }
  function body(B, e) {
    if (B && typeof B.bodyPoint === 'function') return B.bodyPoint(e);
    return { x: e.x, y: e.air ? e.y : e.y - eSize(e) * 0.45 };
  }
  function airOk(e, mode) { return !mode || mode === 'both' ? true : mode === 'air' ? !!e.air : !e.air; }
  function living(B) { return ((B && B.enemies) || []).filter(alive); }
  // Enemigos cuya x cae en una franja vertical (lluvias, rayos, explosiones a ras de suelo)
  function column(B, x, half, air, burrowed) {
    return living(B).filter(e => (burrowed || !e.burrowed) && airOk(e, air) && e.x > -40 && Math.abs(e.x - x) <= half + eRad(e));
  }
  function inReach(B, hero, range, air) {
    return living(B).filter(e => !e.burrowed && airOk(e, air) && e.x > -40 && e.x <= hero.x + 5 && hero.x - e.x <= range)
      .sort((a, b) => b.x - a.x);
  }
  function isBig(e) { return !!e && (e.boss || e.elite || eSize(e) >= 110 || !!(e.def && e.def.big)); }
  function isUndead(e) {
    if (!e) return false;
    const d = e.def || {};
    if (d.undead || (Array.isArray(d.tags) && d.tags.indexOf('undead') >= 0) || (e.data && e.data.undead)) return true;
    if (d.resist && d.resist.holy < 0) return true;
    return /esquelet|skelet|zombi|espect|fantasm|undead|nigrom/i.test(String(e.type || d.id || ''));
  }
  function isSupport(e) { return !!e && ((e.def && e.def.healer) || e.type === 'chaman' || e.type === 'orco_tambor' || e.range > 0); }
  function strongest(list) {
    let best = null, sc = -1;
    for (const e of list) { const s = (e.boss ? 1e12 : 0) + (e.elite ? 1e9 : 0) + e.hp; if (s > sc) { sc = s; best = e; } }
    return best;
  }
  function airModeOf(a) { return a.air && a.ground !== false ? 'both' : a.air ? 'air' : 'ground'; }

  function safe(B, fn) { return function () { if (B.over) return; try { fn(); } catch (err) { console.error('[habilidad]', err); } }; }
  function later(B, s, fn) { const g = safe(B, fn); if (typeof B.after === 'function') B.after(s, g); else g(); }
  function repeat(B, s, times, fn) {
    const g = safe(B, fn);
    if (typeof B.every === 'function') B.every(s, g, times); else for (let i = 0; i < times; i++) g();
  }
  function dmgMul(B) { return typeof B.heroDmgMul === 'function' ? B.heroDmgMul() : 1; }

  // Golpe de habilidad (o de pasiva) sobre un enemigo: daño + estados + empuje
  function hit(B, hero, e, amount, o) {
    if (!alive(e)) return 0;
    o = o || {};
    let a = amount * (o.noBuff ? 1 : dmgMul(B));
    if (o.undead && isUndead(e)) a *= o.undead;
    if (o.boss && e.boss) a *= o.boss;
    let dealt = 0;
    if (a > 0) {
      const info = { type: o.type || 'physical', source: o.source || 'ability', hero: hero };
      if (o.crit != null) info.crit = o.crit;
      if (o.critMul) info.critMul = o.critMul;
      if (o.arc) info.arc = true;
      if (o.pierce) info.pierce = true;
      if (o.burrowed) info.burrowed = true;
      if (o.noNumber) info.noNumber = true;
      dealt = B.damage(e, a, info) || 0;
    }
    if (alive(e)) {
      if (o.status) for (const s of o.status) if (s && s.kind) B.applyStatus(e, s.kind, Object.assign({}, s));
      if (o.knockback > 0) B.knockback(e, o.knockback);
    }
    return dealt;
  }
  function blast(B, hero, x, half, amount, o) {
    o = o || {};
    const list = column(B, x, half, o.air || 'ground', o.burrowed);
    let total = 0;
    for (const e of list) total += hit(B, hero, e, amount, o);
    return { list, total };
  }
  // Explosión circular a media altura (esferas en el aire)
  function sphere(B, hero, x, y, r, amount, o) {
    const list = living(B).filter(e => !e.burrowed && airOk(e, (o && o.air) || 'both')).filter(e => {
      const p = body(B, e); const dx = p.x - x, dy = (p.y - y) * 0.6, rr = r + eRad(e);
      return dx * dx + dy * dy <= rr * rr;
    });
    for (const e of list) hit(B, hero, e, amount, o);
    return list;
  }

  function findArea(B, hero, radius, air) {
    let pt = null;
    if (typeof B.densestPoint === 'function') { try { pt = B.densestPoint(AB_RANGE, radius, { air: air || 'both' }); } catch (err) { pt = null; } }
    if (pt && pt.count > 0 && isFinite(pt.x)) return { x: pt.x, y: isFinite(pt.y) ? pt.y : GROUND() - 20, count: pt.count };
    const list = inReach(B, hero, AB_RANGE + 200, air || 'both');
    if (!list.length) return null;
    let best = null, bn = -1;
    for (const e of list) {
      const n = list.reduce((acc, o) => acc + (Math.abs(o.x - e.x) <= radius ? 1 : 0), 0);
      if (n > bn) { bn = n; best = e; }
    }
    return { x: best.x, y: best.air ? best.y : GROUND() - 20, count: bn };
  }

  function origin(hero) { return { x: hero.x - 22, y: hero.y - ((hero.def && hero.def.size) || 76) * 0.6 }; }
  function shoot(B, spec) {
    if (typeof B.spawnProjectile === 'function') return B.spawnProjectile(Object.assign({ team: 'player' }, spec));
    if (typeof spec.onHit === 'function') later(B, 0.25, () => spec.onHit(B, spec, null));
    return null;
  }
  function skyBolt(B, x, y, color) {
    const pts = [{ x: x + (rnd(B) - 0.5) * 80, y: -30 }];
    for (let i = 1; i < 5; i++) pts.push({ x: x + (rnd(B) - 0.5) * 50, y: -30 + (y + 30) * i / 5 });
    pts.push({ x, y });
    fx(B, 'lightning', pts, { color: color || '#bfe9ff', width: 5, dur: 0.3 });
  }

  // Segundo disparo normal contra otro enemigo (pasivas de doble disparo)
  function extraShot(B, hero, target, chance) {
    if (!(chance > 0) || rnd(B) >= chance) return false;
    const a = ATK(hero);
    const mode = airModeOf(a);
    const list = inReach(B, hero, a.range || 900, mode).filter(e => e !== target);
    const t2 = list.length ? list[Math.floor(rnd(B) * list.length)] : (alive(target) ? target : null);
    if (!t2) return false;
    shoot(B, {
      kind: a.projectile || 'arrow', from: origin(hero), to: t2, speed: a.speed || 900, arc: a.arc || 0, homing: true,
      color: a.color, size: a.size, source: hero,
      onHit: { damage: (a.damage || 1) * dmgMul(B), type: a.type || 'physical', radius: a.radius || 0, air: mode,
        status: a.status && a.status.length ? a.status : null, knockback: a.knockback || 0, pierce: 0,
        info: { type: a.type || 'physical', source: hero, critChance: a.crit || 0, critMul: a.critMul || 2 } },
    });
    return true;
  }

  function procs(B, hero, target) {
    const list = hero.stats && hero.stats.procs;
    if (!list || !list.length || !alive(target)) return;
    for (const pr of list) if (rnd(B) < pr.chance) B.applyStatus(target, pr.kind, Object.assign({}, pr));
  }
  // Pasiva: estados con probabilidad (de talentos) + lógica propia; protegida contra reentradas
  function passive(desc, fn) {
    return {
      desc,
      onHit(B, hero, target, dmg) {
        if (!B || !hero || !hero.stats) return;
        const d = dataOf(hero);
        if (d.inPassive) return;
        d.inPassive = true;
        try { procs(B, hero, target); if (fn) fn(B, hero, target, +dmg || 0); }
        catch (err) { console.error('[pasiva ' + hero.id + ']', err); }
        finally { d.inPassive = false; }
      },
    };
  }
  function bonusHit(B, hero, target, amount, extra) {
    if (!alive(target) || !(amount > 0)) return 0;
    return hit(B, hero, target, amount, Object.assign({ type: ATK(hero).type || 'physical', source: hero, noBuff: false }, extra || {}));
  }
  function igniteTar(B, x, r) {
    const list = B && B.towers;
    if (!list || !list.length) return;
    const def = BB.data.towers && BB.data.towers.brea;
    if (!def || typeof def.ignite !== 'function') return;
    const half = ((def.trap && def.trap.width) || 130) / 2;
    for (const t of list) if (t.id === 'brea' && Math.abs(t.x - x) <= half + (r || 0)) def.ignite(B, t);
  }
  function healCastle(B, amount) { if (B.castle && B.castle.hp > 0 && B.castle.hp < B.castle.maxHp && amount > 0) B.healCastle(amount); }

  // Exportado para upgrades.js (torres) y las pruebas
  BB.heroKit = { alive, column, inReach, hit, blast, sphere, findArea, shoot, later, repeat, fx, snd, rnd, body, igniteTar, isUndead, isBig, GROUND };

  // ================================================================ definiciones
  const H = {};
  const C = (o) => Object.assign({ damage: 10, interval: 1, range: 850, type: 'physical', projectile: 'arrow', speed: 900, arc: 0,
    radius: 0, pierce: 0, chain: 0, air: true, ground: true, prefer: 'front', crit: 0.05, critMul: 2, status: [], knockback: 0 }, o);

  // ---------------------------------------------------------------- 1 · Arquera
  H.arquera = {
    name: 'Lira', title: 'La Arquera', rarity: 'comun', unlock: { gold: 0 }, starter: true, color: '#6cc04a',
    role: 'Disparo rápido · tierra y aire',
    desc: 'Arquera veloz del Bosque Esmeralda. Dispara sin descanso a enemigos de tierra y a los voladores.',
    tags: ['Tierra y aire', 'Rápida', 'Antiaérea'], counters: ['goblin_veloz', 'goblin_planeador', 'goblin_bombardero'],
    attack: C({ damage: 10, interval: 0.85, range: 950, projectile: 'arrow', speed: 1100, crit: 0.08 }),
    passive: passive('Doble tensión: 12 % de probabilidad de soltar una segunda flecha contra otro enemigo.',
      (B, hero, target) => extraShot(B, hero, target, 0.12 + PM(hero, 'extraShot'))),
    ability: {
      name: 'Lluvia de Flechas', cooldown: 12, value: 240,
      desc: 'Una lluvia de 24 flechas cae sobre el grupo de enemigos más denso (alcanza tierra y aire).',
      detail: (st) => [(24 + st.abilityMods.count) + ' flechas de ' + fmtN(10 * st.abilityPower) + ' de daño', 'Radio ' + Math.round(150 * st.abilityMods.radius)],
      cast(B, hero) {
        const p = AP(hero), m = MOD(hero), R = 150 * m.radius;
        const pt = findArea(B, hero, R, 'both');
        if (!pt) return false;
        const n = Math.round(24 + m.count), fire = rk(hero, 'flechas_fuego');
        const status = fire ? [{ kind: 'burn', dps: 3 * p * fire, duration: 3 }] : null;
        say(B, pt.x, 230, '¡Lluvia de Flechas!', '#ffe08a');
        fx(B, 'zone', pt.x, GROUND(), R, { color: 'rgba(255,230,150,0.25)', dur: 1.6 });
        let i = 0;
        repeat(B, 1.4 / n, n, () => {
          i++;
          const tx = pt.x + (rnd(B) * 2 - 1) * R;
          shoot(B, { kind: 'arrow', from: { x: tx + 170, y: -40 }, to: { x: tx, y: GROUND() - 6 }, speed: 1500,
            onHit: () => {
              blast(B, hero, tx, 26, 10 * p, { air: 'both', arc: true, status });
              fx(B, 'particles', tx, GROUND() - 4, { n: 3, color: fire ? ['#ffb347', '#ff6a1c'] : ['#d9c7a0', '#8a6a44'], speed: 110, life: 0.3, size: 3, up: 60 });
            } });
          if (i % 5 === 1) snd(B, 'arrow');
        });
        return true;
      },
    },
  };

  // ---------------------------------------------------------------- 2 · Mago de fuego
  function meteorImpact(B, hero, x, R, dmg, main) {
    const p = AP(hero), cat = rk(hero, 'cataclismo');
    const st = [{ kind: 'burn', dps: 10 * p, duration: 4 }];
    if (main) st.push({ kind: 'stun', duration: 0.6 + 0.4 * cat });
    blast(B, hero, x, R, dmg, { type: 'fire', air: 'ground', arc: true, status: st });
    fx(B, 'explosion', x, GROUND() - 20, main ? R : R * 0.8, { color: '#ff6a1c', colors: ['#fff1a0', '#ffa02e', '#ff4a1c'] });
    if (main) { fx(B, 'shake', 12, 0.45); fx(B, 'flash', 'rgba(255,140,40,0.35)', 0.18); }
    snd(B, 'explosion');
    igniteTar(B, x, R);
    const tq = rk(hero, 'tierra_quemada');
    if (main && tq) {
      const dur = 2 * tq;
      fx(B, 'zone', x, GROUND(), R * 0.85, { color: 'rgba(255,90,20,0.45)', edge: 'rgba(255,170,60,0.6)', dur });
      repeat(B, 0.5, Math.round(dur / 0.5), () => {
        blast(B, hero, x, R * 0.85, 5 * p, { type: 'fire', air: 'ground', noNumber: true, status: [{ kind: 'burn', dps: 6 * p, duration: 2 }] });
        fx(B, 'particles', x + (rnd(B) - 0.5) * R, GROUND() - 10, { n: 4, kind: 'fire', color: ['#ffe46b', '#ff8a2a'], speed: 40, up: 90, gravity: -80, life: 0.6, size: 9, add: true });
      });
    }
  }
  H.mago_fuego = {
    name: 'Ignazio', title: 'Mago de Fuego', rarity: 'comun', unlock: { gold: 0 }, starter: true, color: '#ff6a2a',
    role: 'Daño en área · quemaduras',
    desc: 'Lanza bolas de fuego que estallan en área y queman. Anula la regeneración de los trols y prende la madera de los arietes.',
    tags: ['Área', 'Fuego', 'Mágico'], counters: ['goblin_veloz', 'orco_escudo', 'troll', 'orco_ariete'],
    attack: C({ damage: 12, interval: 1.5, range: 760, type: 'fire', projectile: 'fireball', speed: 750, radius: 65,
      status: [{ kind: 'burn', dpsMul: 0.25, duration: 3 }] }),
    passive: passive('Combustión: si su bola de fuego remata a un enemigo, este estalla y quema a los que tiene cerca.', (B, hero, target) => {
      const a = ATK(hero);
      if (target) igniteTar(B, target.x, a.radius || 60);
      if (target && (target.dead || target.hp <= 0) && !(target.data && target.data.combusted)) {
        dataOf(target).combusted = true;
        const r = 75 * (1 + 0.1 * rk(hero, 'cataclismo'));
        blast(B, hero, target.x, r, a.damage * (0.5 + PM(hero, 'combust')), { type: 'fire', air: 'ground', source: hero,
          status: [{ kind: 'burn', dps: a.damage * 0.2, duration: 2 }] });
        fx(B, 'explosion', target.x, body(B, target).y, r * 0.8, { color: '#ff7b22' });
      }
    }),
    ability: {
      name: 'Meteoro', cooldown: 16, value: 450,
      desc: 'Invoca un meteoro sobre el grupo más denso: gran daño de fuego, quemadura y un breve aturdimiento.',
      detail: (st) => ['Daño ' + fmtN(130 * st.abilityPower) + ' + quemadura ' + fmtN(10 * st.abilityPower) + '/s', 'Radio ' + Math.round(150 * st.abilityMods.radius)],
      cast(B, hero) {
        const p = AP(hero), m = MOD(hero), R = 150 * m.radius * (1 + 0.1 * rk(hero, 'cataclismo'));
        const pt = findArea(B, hero, R, 'ground');
        if (!pt) return false;
        const x = pt.x;
        snd(B, 'fireball');
        say(B, x, 220, '¡Meteoro!', '#ffb347');
        fx(B, 'zone', x, GROUND(), R, { color: 'rgba(255,80,20,0.3)', edge: 'rgba(255,120,40,0.8)', dur: 0.9 });
        shoot(B, { kind: 'fireball', from: { x: x + 300, y: -140 }, to: { x, y: GROUND() - 20 }, speed: 850, size: 30, color: '#ff6a1c',
          onHit: () => meteorImpact(B, hero, x, R, 130 * p, true) });
        const extra = rk(hero, 'lluvia_meteoros');
        for (let k = 0; k < extra; k++) {
          later(B, 0.45 + 0.3 * k, () => {
            const tx = x + (rnd(B) * 2 - 1) * R * 1.6;
            shoot(B, { kind: 'fireball', from: { x: tx + 260, y: -120 }, to: { x: tx, y: GROUND() - 20 }, speed: 900, size: 18, color: '#ff8a2a',
              onHit: () => meteorImpact(B, hero, tx, R * 0.6, 50 * p, false) });
          });
        }
        return true;
      },
    },
  };

  // ---------------------------------------------------------------- 3 · Maga de hielo
  H.maga_hielo = {
    name: 'Nívea', title: 'Maga de Hielo', rarity: 'comun', unlock: { gold: 0 }, starter: true, color: '#6ad0ff',
    role: 'Control · ralentiza y congela',
    desc: 'Sus carámbanos ralentizan a todo lo que tocan. Imprescindible contra lobos, berserkers y enemigos rápidos.',
    tags: ['Control', 'Hielo', 'Mágico'], counters: ['jinete_lobo', 'orco_berserker', 'goblin_veloz', 'orco_escudo'],
    attack: C({ damage: 10, interval: 1.2, range: 820, type: 'ice', projectile: 'ice', speed: 900, radius: 45,
      status: [{ kind: 'slow', power: 0.35, duration: 2 }] }),
    passive: passive('Congelación: cada 5 impactos sobre el mismo enemigo lo congelan 1 s.', (B, hero, target) => {
      if (!alive(target)) return;
      const d = dataOf(target);
      d.frost = (d.frost || 0) + 1;
      if (d.frost >= 5) {
        d.frost = 0;
        B.applyStatus(target, 'freeze', { duration: 1 + PM(hero, 'freezeDur') });
        const bp = body(B, target);
        fx(B, 'particles', bp.x, bp.y, { n: 10, kind: 'ice', color: ['#e9fbff', '#9fe7ff'], speed: 140, life: 0.5, size: 6 });
        snd(B, 'freeze');
      }
    }),
    ability: {
      name: 'Ventisca', cooldown: 15, value: 300,
      desc: 'Una ventisca congela a los enemigos de la zona durante 2 s y luego los sigue ralentizando y dañando.',
      detail: (st) => ['Congela 2 s · daño ' + fmtN(35 * st.abilityPower), 'Radio ' + Math.round(180 * st.abilityMods.radius)],
      cast(B, hero) {
        const p = AP(hero), m = MOD(hero), th = rk(hero, 'tormenta_helada'), zero = rk(hero, 'cero_absoluto'), q = rk(hero, 'quebradizo');
        const R = 180 * m.radius * (1 + 0.1 * th);
        const air = zero ? 'both' : 'ground';
        const pt = findArea(B, hero, R, air);
        if (!pt) return false;
        const x = pt.x, fz = 2 + 0.5 * zero, dur = (4 + th) * m.duration;
        const st = [{ kind: 'freeze', duration: fz }];
        if (q) st.push({ kind: 'curse', power: 0.08 * q, duration: fz + 3 });
        blast(B, hero, x, R, 35 * p, { type: 'ice', air, status: st });
        snd(B, 'freeze'); snd(B, 'ice');
        say(B, x, 220, '¡Ventisca!', '#bfefff');
        fx(B, 'flash', 'rgba(200,240,255,0.35)', 0.2);
        fx(B, 'zone', x, GROUND(), R, { color: 'rgba(190,240,255,0.5)', edge: 'rgba(255,255,255,0.7)', dur });
        fx(B, 'ring', x, GROUND() - 10, R, { color: '#dff8ff', dur: 0.5, width: 7 });
        repeat(B, 0.5, Math.round(dur / 0.5), () => {
          blast(B, hero, x, R, 5 * p, { type: 'ice', air, noNumber: true, status: [{ kind: 'slow', power: 0.5, duration: 1 }] });
          fx(B, 'particles', x + (rnd(B) - 0.5) * R * 1.6, 120 + rnd(B) * 120, { n: 8, kind: 'ice', color: ['#ffffff', '#cdf3ff'], speed: 60, angle: 1.9, spread: 0.3, gravity: 260, life: 1.4, size: 5 });
        });
        return true;
      },
    },
  };

  // ---------------------------------------------------------------- 4 · Halconera
  H.halconera = {
    name: 'Kira', title: 'La Halconera', rarity: 'comun', unlock: { gold: 200, level: 4 }, color: '#c58a4a',
    role: 'Antiaérea · halcón veloz',
    desc: 'Su halcón persigue a los voladores y les hace el doble de daño. La mejor defensa barata contra los planeadores.',
    tags: ['Antiaérea', 'Teledirigido', 'Largo alcance'], counters: ['goblin_planeador', 'goblin_bombardero', 'dragon'],
    attack: C({ damage: 8, interval: 0.75, range: 1000, projectile: 'feather', speed: 950, prefer: 'air' }),
    passive: passive('Garras: doble de daño contra voladores.', (B, hero, target) => {
      if (alive(target) && target.air) bonusHit(B, hero, target, ATK(hero).damage * (1 + PM(hero, 'vsAir')));
      extraShot(B, hero, target, PM(hero, 'extraShot'));
    }),
    ability: {
      name: 'Bandada', cooldown: 13, value: 240,
      desc: 'Suelta 8 halcones que persiguen a los enemigos (primero a los voladores). Doble daño contra voladores.',
      detail: (st) => [(8 + st.abilityMods.count) + ' halcones de ' + fmtN(28 * st.abilityPower) + ' de daño', '×2 contra voladores'],
      cast(B, hero) {
        const p = AP(hero), m = MOD(hero), n = Math.round(8 + m.count), queen = rk(hero, 'reina_cielos');
        if (!inReach(B, hero, AB_RANGE, 'both').length) return false;
        say(B, hero.x - 160, hero.y - 110, '¡Bandada!', '#ffd27a', 26);
        snd(B, 'whoosh');
        repeat(B, 0.09, n, () => {
          const list = inReach(B, hero, AB_RANGE, 'both');
          if (!list.length) return;
          const airs = list.filter(e => e.air);
          const pool = airs.length ? airs : list;
          const t = pool[Math.floor(rnd(B) * Math.min(pool.length, 4))];
          const o = origin(hero);
          shoot(B, { kind: 'feather', from: { x: o.x, y: o.y - 20 + rnd(B) * 40 }, to: t, homing: true, speed: 1050 + rnd(B) * 200, source: hero,
            onHit: (B2, prj, tgt) => {
              const e = alive(tgt) ? tgt : (alive(t) ? t : null);
              if (!e) return;
              const mul = e.air ? 2 + PM(hero, 'vsAir') : 1;
              for (let k = 0; k < (queen ? 2 : 1); k++) hit(B, hero, e, 28 * p * mul * (k ? 0.4 + 0.2 * queen : 1), { type: 'physical' });
              const bp = body(B, e);
              fx(B, 'particles', bp.x, bp.y, { n: 6, color: ['#c58a4a', '#ffffff'], speed: 150, life: 0.4, size: 4, kind: 'leaf' });
            } });
        });
        return true;
      },
    },
  };

  // ---------------------------------------------------------------- 5 · Hechicera del rayo
  H.hechicera_rayo = {
    name: 'Volta', title: 'Hechicera del Rayo', rarity: 'rara', unlock: { gold: 500, level: 6 }, color: '#b48cff',
    role: 'Rayo en cadena · tierra y aire',
    desc: 'Sus rayos saltan de enemigo en enemigo, sean de tierra o voladores. Ignora los escudos y destroza las máquinas.',
    tags: ['Cadena', 'Tierra y aire', 'Mágico'], counters: ['goblin_planeador', 'orco_escudo', 'goblin_veloz', 'golem'],
    attack: C({ damage: 12, interval: 1.4, range: 820, type: 'lightning', projectile: 'lightning', chain: 2,
      status: [{ kind: 'stun', chance: 0.1, duration: 0.5 }] }),
    passive: passive('Sobrecarga: 10 % de probabilidad de aturdir 0,5 s a cada enemigo alcanzado.', null),
    ability: {
      name: 'Tormenta', cooldown: 15, value: 550,
      desc: 'Durante 4 s caen 16 rayos sobre enemigos al azar, de tierra y de aire.',
      detail: (st) => [(16 + st.abilityMods.count) + ' rayos de ' + fmtN(20 * st.abilityPower) + ' de daño'],
      cast(B, hero) {
        const p = AP(hero), m = MOD(hero), n = Math.round(16 + m.count), eye = rk(hero, 'ojo_tormenta'), god = rk(hero, 'diosa_trueno');
        if (!inReach(B, hero, AB_RANGE, 'both').length) return false;
        say(B, 700, 200, '¡Tormenta!', '#d8c8ff');
        fx(B, 'flash', 'rgba(60,40,120,0.35)', 0.4);
        let i = 0;
        repeat(B, 4 / n, n, () => {
          i++;
          const list = inReach(B, hero, AB_RANGE, 'both');
          if (!list.length) return;
          for (let k = 0; k < (god ? 2 : 1); k++) {
            const e = list[Math.floor(rnd(B) * list.length)];
            const bp = body(B, e);
            skyBolt(B, bp.x, bp.y, '#d6c8ff');
            const st = eye ? [{ kind: 'stun', duration: 0.3 * eye }] : null;
            sphere(B, hero, bp.x, bp.y, 45, 20 * p * (k ? 0.6 + 0.15 * god : 1), { type: 'lightning', air: 'both', status: st });
            fx(B, 'particles', bp.x, bp.y, { n: 6, color: ['#ffffff', '#fff35c', '#8fd6ff'], speed: 220, life: 0.3, size: 4, add: true });
          }
          if (i % 2) snd(B, 'lightning');
        });
        return true;
      },
    },
  };

  // ---------------------------------------------------------------- 6 · Ingeniero
  H.ingeniero = {
    name: 'Tuerca', title: 'Ingeniero de Cañones', rarity: 'comun', unlock: { gold: 800, level: 9 }, color: '#c9a227',
    role: 'Artillería · área y empuje (solo tierra)',
    desc: 'Sus balas de cañón caen en parábola por encima de los escudos, revientan en área y empujan a los enemigos.',
    tags: ['Área', 'Parábola', 'Empuje', 'Solo tierra'], counters: ['orco_escudo', 'goblin_veloz', 'goblin_topo'],
    attack: C({ damage: 20, interval: 2.3, range: 980, projectile: 'cannon', speed: 700, arc: 140, radius: 80, air: false, knockback: 25 }),
    passive: passive('Metralla: 20 % de probabilidad de que la bala suelte metralla que hiere a los de alrededor.', (B, hero, target) => {
      if (!target) return;
      const a = ATK(hero), x = target.x;
      if (rnd(B) < 0.2 + PM(hero, 'shrapnel')) {
        later(B, 0.1, () => {
          blast(B, hero, x, 130, a.damage * 0.35, { air: 'ground', arc: true, source: hero });
          fx(B, 'particles', x, GROUND() - 20, { n: 12, kind: 'debris', color: ['#555', '#888'], speed: 300, up: 150, life: 0.6, size: 4, gravity: 800 });
        });
      }
      if (rk(hero, 'balas_incendiarias')) igniteTar(B, x, a.radius);
      const g = rk(hero, 'gran_canon');
      if (g) {
        const d = dataOf(hero);
        d.shots = (d.shots || 0) + 1;
        if (d.shots >= 4) {
          d.shots = 0;
          later(B, 0.05, () => {
            blast(B, hero, x, 160, a.damage * (0.6 + 0.4 * g), { air: 'ground', arc: true, knockback: 30, source: hero });
            fx(B, 'explosion', x, GROUND() - 20, 150, { color: '#ffb347' });
            snd(B, 'explosion');
          });
        }
      }
    }),
    ability: {
      name: 'Andanada', cooldown: 14, value: 420,
      desc: 'Dispara 6 cañonazos seguidos sobre el grupo más denso: daño en área y empuje.',
      detail: (st) => [(6 + st.abilityMods.count) + ' balas de ' + fmtN(40 * st.abilityPower) + ' de daño', 'Radio 90 · empuje'],
      cast(B, hero) {
        const p = AP(hero), m = MOD(hero), R = 120 * m.radius, a = ATK(hero), fire = rk(hero, 'balas_incendiarias');
        const pt = findArea(B, hero, R, 'ground');
        if (!pt) return false;
        const n = Math.round(6 + m.count);
        say(B, pt.x, 230, '¡Andanada!', '#ffd27a');
        let i = 0;
        repeat(B, 0.2, n, () => {
          i++;
          const tx = pt.x + (rnd(B) * 2 - 1) * R;
          snd(B, 'cannon');
          shoot(B, { kind: 'cannon', from: origin(hero), to: { x: tx, y: GROUND() - 12 }, speed: 780, arc: 160 + rnd(B) * 80, size: 11,
            onHit: () => {
              blast(B, hero, tx, 90 * m.radius, 40 * p, { air: 'ground', arc: true, knockback: 35,
                status: fire ? [{ kind: 'burn', dps: a.damage * 0.12 * fire, duration: 3 }] : null });
              fx(B, 'explosion', tx, GROUND() - 15, 85, { color: '#ffb347' });
              snd(B, 'explosion');
              if (fire) igniteTar(B, tx, 90);
            } });
        });
        return true;
      },
    },
  };

  // ---------------------------------------------------------------- 7 · Ballestero
  H.ballestero = {
    name: 'Brock', title: 'El Ballestero', rarity: 'comun', unlock: { gold: 1400, level: 12 }, color: '#8a6d4a',
    role: 'Francotirador · atraviesa · prioriza curanderos',
    desc: 'Tirador de élite con el mayor alcance. Sus virotes atraviesan filas y busca primero a chamanes y arqueros.',
    tags: ['Largo alcance', 'Atraviesa', 'Francotirador'], counters: ['chaman', 'goblin_arquero', 'goblin_bombardero', 'orco_tambor'],
    attack: C({ damage: 30, interval: 2.1, range: 1180, projectile: 'bolt', speed: 1600, pierce: 2, prefer: 'healer', crit: 0.12, critMul: 2.2 }),
    passive: passive('Cazarrecompensas: +30 % de daño contra curanderos, tamborileros y enemigos a distancia.', (B, hero, target) => {
      if (alive(target) && isSupport(target)) bonusHit(B, hero, target, ATK(hero).damage * (0.3 + PM(hero, 'bounty')), { pierce: true });
    }),
    ability: {
      name: 'Virote Perforante', cooldown: 11, value: 330,
      desc: 'Un virote gigante recorre el campo a ras de suelo y atraviesa a todos los enemigos de su línea.',
      detail: (st) => ['Daño ' + fmtN(90 * st.abilityPower) + ' a cada enemigo de la línea'],
      cast(B, hero) {
        const p = AP(hero), elite = rk(hero, 'tirador_elite'), expl = rk(hero, 'virote_explosivo');
        if (!inReach(B, hero, AB_RANGE, elite ? 'both' : 'ground').length) return false;
        const W = BB.WORLD, startX = WALL() - 10, endX = -60, speed = 2400, o = origin(hero);
        const lanes = [{ y: GROUND() - 40, air: 'ground' }];
        if (elite) lanes.push({ y: ((W && W.AIR_MIN) || 280) * 0.5 + ((W && W.AIR_MAX) || 400) * 0.5, air: 'air' });
        snd(B, 'bolt'); snd(B, 'whoosh');
        for (const lane of lanes) {
          fx(B, 'beam', o.x, o.y, startX, lane.y, { color: 'rgba(255,236,170,0.9)', width: 4, dur: 0.2 });
          shoot(B, { kind: 'bolt', from: { x: startX, y: lane.y }, to: { x: endX, y: lane.y }, speed, onHit: function () {} });
          const victims = living(B).filter(e => !e.burrowed && airOk(e, lane.air) && e.x <= startX + 30 && e.x >= endX);
          let last = null;
          for (const e of victims) {
            later(B, Math.max(0, (startX - e.x) / speed), () => {
              if (!alive(e)) return;
              hit(B, hero, e, 90 * p * (1 + 0.1 * elite), { type: 'physical', pierce: true, knockback: 25 });
              const bp = body(B, e);
              fx(B, 'particles', bp.x, bp.y, { n: 8, color: ['#ffe9a8', '#ffffff'], speed: 220, life: 0.35, size: 3, add: true });
            });
            if (!last || e.x < last.x) last = e;
          }
          if (expl && last) {
            const ex = last.x;
            later(B, Math.max(0, (startX - ex) / speed) + 0.03, () => {
              blast(B, hero, ex, 120, 90 * p * 0.4 * expl, { air: lane.air, type: 'fire' });
              fx(B, 'explosion', ex, lane.y, 110, { color: '#ffb347' });
              snd(B, 'explosion');
            });
          }
        }
        return true;
      },
    },
  };

  // ---------------------------------------------------------------- 8 · Lanzamartillos
  function quake(B, hero, mul) {
    const p = AP(hero), m = MOD(hero), reach = 1100 * m.radius, fall = rk(hero, 'fallas');
    const list = living(B).filter(e => !e.air && e.x < hero.x && hero.x - e.x <= reach);   // incluye a los enterrados
    for (const e of list) {
      hit(B, hero, e, 50 * p * mul, { type: 'physical', arc: true, burrowed: true,
        status: [{ kind: 'stun', duration: 1.6 * m.duration }].concat(fall ? [{ kind: 'slow', power: 0.4, duration: 3 + fall }] : []) });
    }
    fx(B, 'shake', 14 * mul, 0.6);
    fx(B, 'ring', WALL() - 40, GROUND(), 160, { color: '#e0c08a', dur: 0.6, width: 8 });
    for (let k = 0; k < 10; k++) {
      later(B, k * 0.04, () => fx(B, 'particles', WALL() - 60 - k * reach / 10, GROUND() - 4,
        { n: 6, kind: 'debris', color: ['#8a6a44', '#6b4a2b', '#a9adb5'], speed: 120, up: 260, gravity: 900, life: 0.7, size: 5 }));
    }
    snd(B, 'hammer'); snd(B, 'hit_heavy');
    return list.length;
  }
  H.martillo = {
    name: 'Gunnar', title: 'Lanzamartillos', rarity: 'rara', unlock: { gold: 2200, level: 14 }, color: '#d0d6de',
    role: 'Aturde · contundente (solo tierra)',
    desc: 'Enano que lanza martillos que aturden. Su Martillo Sísmico sacude el suelo e incluso alcanza a los topos enterrados.',
    tags: ['Aturdir', 'Parábola', 'Solo tierra', 'Antitopos'], counters: ['jinete_lobo', 'orco_berserker', 'goblin_topo', 'orco_escudo'],
    attack: C({ damage: 20, interval: 1.6, range: 800, projectile: 'hammer', speed: 850, arc: 60, radius: 40, air: false, knockback: 10 }),
    passive: passive('Contundente: 25 % de probabilidad de aturdir 0,8 s.', (B, hero, target) => {
      if (!alive(target) || rnd(B) >= 0.25 + PM(hero, 'stunChance')) return;
      const dur = 0.8 + PM(hero, 'stunDur');
      B.applyStatus(target, 'stun', { duration: dur });
      const rb = rk(hero, 'rompehuesos');
      if (rb) B.applyStatus(target, 'curse', { power: 0.08 * rb, duration: dur + 2 });
    }),
    ability: {
      name: 'Martillo Sísmico', cooldown: 16, value: 330,
      desc: 'Golpea el suelo: daña y aturde 1,6 s a todos los enemigos de tierra del campo, incluidos los enterrados.',
      detail: (st) => ['Daño ' + fmtN(50 * st.abilityPower) + ' a todos los de tierra', 'Aturde ' + (1.6 * st.abilityMods.duration).toFixed(1).replace('.', ',') + ' s'],
      cast(B, hero) {
        if (!living(B).some(e => !e.air)) return false;
        say(B, WALL() - 260, 300, '¡Martillo Sísmico!', '#ffe08a');
        quake(B, hero, 1);
        const g = rk(hero, 'martillo_dioses');
        if (g) later(B, 0.7, () => quake(B, hero, 0.5 + 0.25 * g));
        return true;
      },
    },
  };

  // ---------------------------------------------------------------- 9 · Sacerdote
  H.sacerdote = {
    name: 'Fray Ámbar', title: 'El Sacerdote', rarity: 'rara', unlock: { gold: 3000, level: 17 }, color: '#ffd36b',
    role: 'Sanador · cura el castillo',
    desc: 'Cada golpe de luz sagrada cura un poco el castillo. Su Bendición lo sana y lo protege con un escudo.',
    tags: ['Curación', 'Escudo', 'Sagrado'], counters: ['goblin_arquero', 'goblin_planeador', 'nigromante'],
    attack: C({ damage: 9, interval: 1.25, range: 820, type: 'holy', projectile: 'holy', speed: 800, size: 9 }),
    passive: passive('Plegaria: cada impacto cura al castillo un 0,3 % de su vida máxima.', (B, hero) => {
      const c = B.castle;
      if (!c || !(c.maxHp > 0)) return;
      healCastle(B, c.maxHp * 0.003 * soft(AP(hero)) * (1 + PM(hero, 'heal')));
      const mi = rk(hero, 'milagro'), d = dataOf(hero);
      if (mi && c.hp > 0 && c.hp < c.maxHp * 0.4 && !(d.miracleT > B.t)) {
        d.miracleT = B.t + 20;
        healCastle(B, c.maxHp * (0.1 + 0.05 * mi));
        say(B, CASTLE() + 100, GROUND() - 340, '¡Milagro!', '#fff0a0');
        fx(B, 'ring', CASTLE() + 100, GROUND() - 160, 200, { color: '#ffe58a', dur: 0.8, width: 8 });
        snd(B, 'heal');
      }
    }),
    ability: {
      name: 'Bendición', cooldown: 18, value: 300,
      desc: 'Cura el 12 % de la vida del castillo y lo envuelve en un escudo durante 8 s.',
      detail: (st) => ['Cura ' + Math.round(12 * soft(st.abilityPower)) + ' % · escudo ' + Math.round(15 * soft(st.abilityPower) * (1 + (st.passiveMods.shield || 0))) + ' %'],
      cast(B, hero) {
        const p = AP(hero), s = soft(p), c = B.castle, m = MOD(hero);
        if (!c) return false;
        healCastle(B, c.maxHp * 0.12 * s);
        if (typeof B.shieldCastle === 'function') B.shieldCastle(c.maxHp * 0.15 * s * (1 + PM(hero, 'shield')), 8 * m.duration);
        const mw = rk(hero, 'muro_sagrado');
        if (mw && c.wallHp > 0 && c.wallMax > 0) c.wallHp = Math.min(c.wallMax, c.wallHp + c.wallMax * 0.08 * mw);
        const santo = rk(hero, 'santo');
        if (santo && typeof B.buffHeroes === 'function') B.buffHeroes({ dmg: 0.15 * santo, duration: 6 });
        const cx = CASTLE() + 100, cy = GROUND() - 170;
        say(B, cx, GROUND() - 360, '¡Bendición!', '#fff0a0');
        fx(B, 'ring', cx, cy, 230, { color: '#ffe58a', dur: 0.9, width: 10, fill: 'rgba(255,240,170,0.12)' });
        fx(B, 'particles', cx, cy, { n: 30, kind: 'star', color: ['#fff6c4', '#ffe58a', '#ffffff'], speed: 220, gravity: -80, life: 1.1, size: 6, add: true });
        fx(B, 'flash', 'rgba(255,240,170,0.3)', 0.25);
        snd(B, 'heal');
        return true;
      },
    },
  };

  // ---------------------------------------------------------------- 10 · Druida
  H.druida = {
    name: 'Robledo', title: 'El Druida', rarity: 'rara', unlock: { gold: 4200, level: 20 }, color: '#3f9a4a',
    role: 'Veneno · inmoviliza',
    desc: 'Lanza espinas venenosas que ralentizan. Sus Raíces atrapan a grupos enteros (perfecto contra lobos y arietes).',
    tags: ['Veneno', 'Inmovilizar', 'Control'], counters: ['jinete_lobo', 'chaman', 'troll', 'orco_berserker'],
    attack: C({ damage: 9, interval: 1.05, range: 850, type: 'poison', projectile: 'dart', speed: 950,
      status: [{ kind: 'poison', dpsMul: 0.35, duration: 4, maxStacks: 4 }, { kind: 'slow', power: 0.15, duration: 1.5 }] }),
    passive: passive('Abrojos: sus espinas envenenan (acumulable) y ralentizan un 15 %.', null),
    ability: {
      name: 'Raíces', cooldown: 14, value: 220,
      desc: 'Raíces espinosas brotan bajo el grupo más denso: lo inmovilizan 3 s y lo envenenan.',
      detail: (st) => ['Inmoviliza ' + (3 * st.abilityMods.duration).toFixed(1).replace('.', ',') + ' s · daño ' + fmtN(25 * st.abilityPower), 'Radio ' + Math.round(170 * st.abilityMods.radius)],
      cast(B, hero) {
        const p = AP(hero), m = MOD(hero), ab = rk(hero, 'abrazo_bosque'), ira = rk(hero, 'ira_bosque'), sv = rk(hero, 'savia_vital');
        const R = 170 * m.radius * (1 + 0.12 * ab);
        const pt = findArea(B, hero, R, ira ? 'both' : 'ground');
        if (!pt) return false;
        const x = pt.x, dur = 3 * m.duration + 0.5 * ab;
        const res = blast(B, hero, x, R, 25 * p * (1 + 0.4 * ira), { type: 'poison', air: 'ground',
          status: [{ kind: 'root', duration: dur }, { kind: 'poison', dps: 5 * p, duration: 4, maxStacks: 6 }] });
        if (ira) blast(B, hero, x, R, 25 * p * (1 + 0.4 * ira), { type: 'poison', air: 'air', status: [{ kind: 'stun', duration: 1 }] });
        if (sv && B.castle) healCastle(B, B.castle.maxHp * 0.005 * sv * res.list.length);
        say(B, x, 250, '¡Raíces!', '#a6f07a');
        fx(B, 'zone', x, GROUND(), R, { color: 'rgba(70,140,40,0.5)', edge: 'rgba(160,230,90,0.7)', dur });
        for (let k = 0; k < 8; k++) fx(B, 'particles', x + (rnd(B) - 0.5) * R * 1.8, GROUND() - 4, { n: 4, kind: 'leaf', color: ['#4f8a2a', '#7fd13a', '#3f6a1c'], speed: 90, up: 200, gravity: 350, life: 0.9, size: 7 });
        snd(B, 'poison'); snd(B, 'whoosh');
        return true;
      },
    },
  };

  // ---------------------------------------------------------------- 11 · Alquimista
  H.alquimista = {
    name: 'Burbuja', title: 'La Alquimista', rarity: 'rara', unlock: { gold: 5500, level: 23 }, color: '#9be15d',
    role: 'Rompe armaduras · ácido en área',
    desc: 'Sus frascos de ácido caen en parábola y corroen la armadura: después, todo el ejército hace más daño físico.',
    tags: ['Rompe armadura', 'Área', 'Parábola'], counters: ['troll', 'orco_escudo', 'orco_ariete', 'golem'],
    attack: C({ damage: 11, interval: 1.45, range: 820, type: 'poison', projectile: 'potion', speed: 650, arc: 120, radius: 60, air: false, color: '#8fe04a',
      status: [{ kind: 'armorBreak', power: 0.25, duration: 4 }] }),
    passive: passive('Mezcla volátil: 15 % de probabilidad de añadir un efecto al azar (ralentizar, quemar, envenenar o aturdir).', (B, hero, target) => {
      if (!alive(target) || rnd(B) >= 0.15 + PM(hero, 'volatile')) return;
      const a = ATK(hero), r = Math.floor(rnd(B) * 4);
      const st = [{ kind: 'slow', power: 0.4, duration: 2 }, { kind: 'burn', dps: a.damage * 0.5, duration: 3 },
        { kind: 'poison', dps: a.damage * 0.4, duration: 4, maxStacks: 5 }, { kind: 'stun', duration: 0.6 }][r];
      B.applyStatus(target, st.kind, st);
      const bp = body(B, target);
      fx(B, 'particles', bp.x, bp.y, { n: 8, kind: 'bubble', color: ['#7fd7ff', '#ff8a3d', '#9be15d', '#ffe066'][r], speed: 120, life: 0.6, size: 5 });
    }),
    ability: {
      name: 'Lluvia Ácida', cooldown: 15, value: 330,
      desc: 'Llueven 12 frascos de ácido sobre la zona: dañan, envenenan y rompen la armadura.',
      detail: (st) => [(12 + st.abilityMods.count) + ' frascos de ' + fmtN(14 * st.abilityPower) + ' de daño', 'Armadura −35 % durante 5 s'],
      cast(B, hero) {
        const p = AP(hero), m = MOD(hero), R = 160 * m.radius, gas = rk(hero, 'gas_nervioso');
        const pt = findArea(B, hero, R, 'ground');
        if (!pt) return false;
        const n = Math.round(12 + m.count);
        say(B, pt.x, 230, '¡Lluvia Ácida!', '#c6f59a');
        fx(B, 'zone', pt.x, GROUND(), R, { color: 'rgba(120,220,60,0.4)', dur: 2.6 });
        let i = 0;
        repeat(B, 2 / n, n, () => {
          i++;
          const tx = pt.x + (rnd(B) * 2 - 1) * R;
          shoot(B, { kind: 'potion', from: { x: tx + 140, y: -50 }, to: { x: tx, y: GROUND() - 10 }, speed: 900, color: '#8fe04a',
            onHit: () => {
              const st = [{ kind: 'armorBreak', power: 0.35, duration: 5 }, { kind: 'poison', dps: 4 * p, duration: 4, maxStacks: 5 }];
              if (gas) st.push({ kind: 'slow', power: 0.15 * gas, duration: 2 });
              blast(B, hero, tx, 70, 14 * p, { type: 'poison', air: 'ground', arc: true, status: st });
              fx(B, 'particles', tx, GROUND() - 10, { n: 8, kind: 'bubble', color: ['#c6f59a', '#7fd13a'], speed: 120, up: 80, life: 0.7, size: 5 });
            } });
          if (i % 4 === 1) snd(B, 'poison');
        });
        return true;
      },
    },
  };

  // ---------------------------------------------------------------- 12 · Bardo
  H.bardo = {
    name: 'Trova', title: 'El Bardo', rarity: 'epica', unlock: { gold: 7500, level: 26 }, color: '#ff7fc8',
    role: 'Apoyo · acelera a todos los héroes',
    desc: 'Su música da un aura de velocidad de ataque a todos los héroes desplegados. Su Himno los convierte en una tormenta.',
    tags: ['Apoyo', 'Aura', 'Mágico'], counters: [],
    aura: { atkSpeed: 0.12, dmg: 0 },
    attack: C({ damage: 7, interval: 1.0, range: 800, type: 'arcane', projectile: 'magic', speed: 650, color: '#ff8fd0', size: 8 }),
    passive: passive('Aura: +12 % de velocidad de ataque a todos los héroes desplegados (incluido él).', null),
    ability: {
      name: 'Himno Heroico', cooldown: 20, value: 300,
      desc: 'Durante 7 s todos los héroes atacan un 35 % más rápido y hacen un 20 % más de daño.',
      detail: (st) => { const k = 1 + 0.12 * Math.log(Math.max(1, st.abilityPower)); return ['+' + Math.round(35 * k) + ' % vel. de ataque · +' + Math.round(20 * k) + ' % daño', 'Duración ' + Math.round(7 * st.abilityMods.duration) + ' s']; },
      cast(B, hero) {
        const p = AP(hero), m = MOD(hero), k = 1 + 0.12 * Math.log(Math.max(1, p));
        const dur = 7 * m.duration + 1.5 * rk(hero, 'balada_eterna');
        if (typeof B.buffHeroes === 'function') B.buffHeroes({ atkSpeed: 0.35 * k, dmg: 0.2 * k, duration: dur });
        for (const h of (B.heroes || [])) {
          fx(B, 'ring', h.x, h.y - 38, 50, { color: '#ff9ad5', dur: 0.7, width: 5 });
          fx(B, 'particles', h.x, h.y - 50, { n: 5, kind: 'star', color: ['#ff9ad5', '#ffd6f0'], speed: 80, gravity: -120, life: 1, size: 6 });
        }
        const coro = rk(hero, 'coro');
        if (coro && B.castle) healCastle(B, B.castle.maxHp * 0.04 * coro);
        const op = rk(hero, 'opera');
        if (op) for (const h of (B.heroes || [])) if (h !== hero && h.cd > 0) h.cd = Math.max(0, h.cd - (h.cdMax || h.cd) * 0.1 * op);
        say(B, hero.x - 120, hero.y - 110, '¡Himno Heroico!', '#ffb3e0', 26);
        return true;
      },
    },
  };

  // ---------------------------------------------------------------- 13 · Granadero
  H.granadero = {
    name: 'Pólvora', title: 'El Granadero', rarity: 'rara', unlock: { gold: 9000, level: 30 }, color: '#ff9a3c',
    role: 'Bombas de gran área (solo tierra)',
    desc: 'Lanza bombas en parábola con el mayor radio de explosión. Arrasa hordas y topos que acaban de salir.',
    tags: ['Gran área', 'Parábola', 'Solo tierra'], counters: ['goblin_veloz', 'goblin_topo', 'orco_berserker', 'orco_escudo'],
    attack: C({ damage: 22, interval: 2.5, range: 860, projectile: 'bomb', speed: 600, arc: 180, radius: 115, air: false, knockback: 15, size: 10 }),
    passive: passive('Fragmentos: 25 % de probabilidad de una segunda explosión menor.', (B, hero, target) => {
      if (!target) return;
      const a = ATK(hero), x = target.x;
      if (rk(hero, 'napalm')) igniteTar(B, x, a.radius);
      if (rnd(B) < 0.25 + PM(hero, 'frag')) {
        later(B, 0.3, () => {
          const r = (a.radius || 110) * 0.7;
          blast(B, hero, x - 30, r, a.damage * 0.6, { air: 'ground', arc: true, source: hero });
          fx(B, 'explosion', x - 30, GROUND() - 15, r * 0.8, { color: '#ffb347' });
          snd(B, 'bomb');
        });
      }
    }),
    ability: {
      name: 'Barril Explosivo', cooldown: 16, value: 520,
      desc: 'Lanza un barril de pólvora: enorme explosión de fuego que aturde 1 s y empuja.',
      detail: (st) => ['Daño ' + fmtN(130 * st.abilityPower) + ' · aturde 1 s', 'Radio ' + Math.round(200 * st.abilityMods.radius)],
      cast(B, hero) {
        const p = AP(hero), m = MOD(hero), g = rk(hero, 'gran_estallido'), rac = rk(hero, 'racimo');
        const R = 200 * m.radius * (1 + 0.15 * g);
        const pt = findArea(B, hero, R, 'ground');
        if (!pt) return false;
        const x = pt.x;
        snd(B, 'whoosh');
        fx(B, 'zone', x, GROUND(), R, { color: 'rgba(255,120,40,0.25)', edge: 'rgba(255,90,40,0.8)', dur: 1.1 });
        shoot(B, { kind: 'bomb', from: origin(hero), to: { x, y: GROUND() - 12 }, speed: 650, arc: 320, size: 22,
          onHit: () => {
            blast(B, hero, x, R, 130 * p, { type: 'fire', air: 'ground', arc: true, knockback: 60, status: [{ kind: 'stun', duration: 1 + 0.5 * g }] });
            fx(B, 'explosion', x, GROUND() - 30, Math.min(R, 180), { color: '#ff7a1c' });
            fx(B, 'shake', 16, 0.5); fx(B, 'flash', 'rgba(255,200,120,0.4)', 0.2); fx(B, 'smoke', x, GROUND() - 30, 14);
            say(B, x, 240, '¡BUM!', '#ffb347', 40);
            snd(B, 'bomb'); snd(B, 'explosion');
            igniteTar(B, x, R);
            for (let k = 0; k < 2 * rac; k++) {
              const tx = x + (rnd(B) * 2 - 1) * R * 1.7;
              shoot(B, { kind: 'bomb', from: { x, y: GROUND() - 40 }, to: { x: tx, y: GROUND() - 10 }, speed: 500, arc: 150, size: 9,
                onHit: () => { blast(B, hero, tx, 70, 40 * p, { air: 'ground', arc: true }); fx(B, 'explosion', tx, GROUND() - 15, 65, { color: '#ffb347' }); } });
            }
          } });
        return true;
      },
    },
  };

  // ---------------------------------------------------------------- 14 · Envenenadora
  H.envenenadora = {
    name: 'Belladona', title: 'La Envenenadora', rarity: 'epica', unlock: { gold: 12000, level: 34 }, color: '#7fd14f',
    role: 'Veneno acumulable · revienta tanques',
    desc: 'Sus dardos acumulan dosis de veneno sobre el enemigo más fuerte. Los chamanes curan la mitad a los envenenados.',
    tags: ['Veneno', 'Antitanques', 'Anticuración'], counters: ['troll', 'chaman', 'orco_tambor', 'chaman_gigante'],
    attack: C({ damage: 6, interval: 0.85, range: 880, type: 'poison', projectile: 'dart', speed: 1000, prefer: 'strongest',
      status: [{ kind: 'poison', dpsMul: 0.7, duration: 5, maxStacks: 6 }] }),
    passive: passive('Toxina letal: +4 % de daño por cada dosis de veneno que ya lleve el objetivo.', (B, hero, target) => {
      if (!target) return;
      const a = ATK(hero), ps = (a.status || []).find(s => s.kind === 'poison');
      const stacks = (target.status && target.status.poison && target.status.poison.stacks) || 0;
      if (alive(target) && stacks > 1) bonusHit(B, hero, target, a.damage * (stacks - 1) * (0.04 + PM(hero, 'perStack')), { type: 'poison', noNumber: true });
      const c = rk(hero, 'contagio');
      if (c && (target.dead || target.hp <= 0) && stacks > 0 && !dataOf(target).spread) {
        dataOf(target).spread = true;
        const near = column(B, target.x, 120, 'both').filter(e => e !== target).slice(0, 2 + c);
        for (const e of near) B.applyStatus(e, 'poison', { dps: ps ? ps.dps : a.damage * 0.7, duration: 4, maxStacks: ps ? ps.maxStacks : 6, stacks: 1 + c });
        fx(B, 'smoke', target.x, body(B, target).y, 6);
      }
    }),
    ability: {
      name: 'Nube Tóxica', cooldown: 14, value: 450,
      desc: 'Una nube venenosa cubre la zona durante 5 s y acumula veneno en todo lo que hay dentro (tierra y aire).',
      detail: (st) => ['Veneno ' + fmtN(3.5 * st.abilityPower) + '/s por dosis (máx. 8)', 'Radio ' + Math.round(180 * st.abilityMods.radius)],
      cast(B, hero) {
        const p = AP(hero), m = MOD(hero), es = rk(hero, 'nube_espesa'), reina = rk(hero, 'reina_venenos');
        const R = 180 * m.radius * (1 + 0.1 * es);
        const pt = findArea(B, hero, R, 'both');
        if (!pt) return false;
        const dur = (5 + es) * m.duration;
        let x = pt.x, k = 0;
        say(B, x, 230, '¡Nube Tóxica!', '#b8f58a');
        snd(B, 'poison');
        if (!reina) fx(B, 'zone', x, GROUND(), R, { color: 'rgba(120,200,60,0.45)', edge: 'rgba(170,90,220,0.5)', dur });
        repeat(B, 0.5, Math.round(dur / 0.5), () => {
          k++;
          if (reina) {
            const np = findArea(B, hero, R, 'both');
            if (np) x += Math.max(-80, Math.min(80, np.x - x));
            fx(B, 'zone', x, GROUND(), R, { color: 'rgba(120,200,60,0.45)', dur: 0.6 });
          }
          const st = [{ kind: 'poison', dps: 3.5 * p * (1 + 0.2 * reina), duration: 3, maxStacks: 8 }];
          if (es) st.push({ kind: 'slow', power: 0.1 * es, duration: 1 });
          blast(B, hero, x, R, 3 * p, { type: 'poison', air: 'both', noNumber: k % 2 === 0, status: st });
          fx(B, 'particles', x + (rnd(B) - 0.5) * R * 1.5, GROUND() - 40 - rnd(B) * 140, { n: 5, kind: 'smoke', color: ['#7fd13a', '#9a6ad6', '#5f9a2a'], speed: 30, up: 20, gravity: -10, life: 1.4, size: 22, shrink: false });
        });
        return true;
      },
    },
  };

  // ---------------------------------------------------------------- 15 · Cazadora
  function harpoon(B, hero, e, mul) {
    const p = AP(hero), mark = rk(hero, 'marca_presa'), leg = rk(hero, 'leyenda_caza');
    const o = origin(hero);
    snd(B, 'whoosh');
    shoot(B, { kind: 'spear', from: o, to: e, homing: true, speed: 1600, source: hero,
      onHit: (B2, prj, tgt) => {
        const t = alive(tgt) ? tgt : (alive(e) ? e : null);
        if (!t) return;
        hit(B, hero, t, 220 * p * mul, { type: 'physical', pierce: true, boss: 1 + 0.2 * leg, knockback: 90,
          status: [{ kind: 'stun', duration: 1.2 }, { kind: 'curse', power: 0.2 + 0.1 * mark, duration: 6 + 2 * mark }] });
        const bp = body(B, t);
        fx(B, 'beam', hero.x - 10, hero.y - 40, bp.x, bp.y, { color: '#c08a50', width: 3, dur: 0.5 });
        fx(B, 'particles', bp.x, bp.y, { n: 12, color: ['#ff5a4a', '#ffffff'], speed: 220, life: 0.4, size: 4 });
        say(B, bp.x, bp.y - 70, '¡Marcado!', '#ff7a6a', 22);
        snd(B, 'hit_heavy');
      } });
  }
  H.cazadora = {
    name: 'Sierra', title: 'Cazadora de Monstruos', rarity: 'legendaria', unlock: { gems: 250, level: 38 }, color: '#a0522d',
    role: 'Cazajefes · daño extra a grandes',
    desc: 'Especialista en presas enormes: hace mucho más daño a jefes, élites y bestias grandes, y siempre apunta al más fuerte.',
    tags: ['Antijefes', 'Atraviesa', 'Daño concentrado'], counters: ['troll', 'orco_ariete', 'orco_tambor', 'troll_piedra'],
    attack: C({ damage: 28, interval: 1.8, range: 950, projectile: 'spear', speed: 1300, pierce: 1, prefer: 'strongest', crit: 0.1 }),
    passive: passive('Cazamonstruos: +60 % de daño contra jefes, élites y enemigos grandes.', (B, hero, target) => {
      if (alive(target) && isBig(target)) bonusHit(B, hero, target, ATK(hero).damage * (0.6 + PM(hero, 'vsBig')), { pierce: true });
      extraShot(B, hero, target, PM(hero, 'extraShot'));
    }),
    ability: {
      name: 'Arpón', cooldown: 12, value: 300,
      desc: 'Arponea al enemigo más fuerte: gran daño, lo aturde, lo arrastra hacia atrás y lo marca (+20 % de daño recibido).',
      detail: (st) => ['Daño ' + fmtN(220 * st.abilityPower) + ' · aturde 1,2 s', 'Marca: +' + Math.round(20 + 10 * (st.talents.marca_presa || 0)) + ' % daño recibido'],
      cast(B, hero) {
        const list = inReach(B, hero, AB_RANGE, 'both');
        if (!list.length) return false;
        const leg = rk(hero, 'leyenda_caza');
        const n = leg ? 1 + leg : 1;
        const sorted = list.slice().sort((a, b) => ((b.boss ? 1e12 : 0) + (b.elite ? 1e9 : 0) + b.hp) - ((a.boss ? 1e12 : 0) + (a.elite ? 1e9 : 0) + a.hp));
        sorted.slice(0, n).forEach((e, k) => later(B, k * 0.15, () => harpoon(B, hero, e, k ? 0.6 : 1)));
        return true;
      },
    },
  };

  // ---------------------------------------------------------------- 16 · Monje del viento
  H.monje_viento = {
    name: 'Céfiro', title: 'Monje del Viento', rarity: 'epica', unlock: { gold: 18000, level: 45 }, color: '#9fe7e0',
    role: 'Empuja · ráfagas que barren el suelo',
    desc: 'Sus ráfagas recorren el suelo golpeando a todos los enemigos de tierra y empujándolos lejos de la muralla.',
    tags: ['Empuje', 'Línea', 'Solo tierra'], counters: ['goblin_veloz', 'goblin_bombardero', 'jinete_lobo', 'orco_berserker'],
    attack: C({ damage: 13, interval: 1.7, range: 760, projectile: 'wind', speed: 620, air: false, knockback: 35,
      status: [{ kind: 'slow', power: 0.2, duration: 1 }] }),
    passive: passive('Viento helado: los enemigos alcanzados quedan ralentizados un 20 % durante 1 s.', null),
    ability: {
      name: 'Tornado', cooldown: 15, value: 300,
      desc: 'Un tornado sale de la muralla y barre el campo: daña y arrastra a los enemigos hacia atrás.',
      detail: (st) => ['Hasta 4 golpes de ' + fmtN(7 * st.abilityPower) + ' y empuje fuerte', 'Duración ' + (3 * st.abilityMods.duration).toFixed(1).replace('.', ',') + ' s'],
      cast(B, hero) {
        if (!living(B).some(e => !e.burrowed)) return false;
        const hu = rk(hero, 'huracan'), ojo = rk(hero, 'ojo_huracan'), av = rk(hero, 'avatar_viento');
        say(B, WALL() - 250, 300, '¡Tornado!', '#dff8ff');
        snd(B, 'wind');
        tornado(B, hero, 1, hu, ojo);
        if (av) later(B, 0.8, () => tornado(B, hero, 0.5 + 0.25 * av, hu, ojo));
        return true;
      },
    },
  };
  function tornado(B, hero, mul, hu, ojo) {
    const p = AP(hero), m = MOD(hero);
    const dur = (3 + 0.5 * hu) * m.duration, steps = Math.max(1, Math.round(dur / 0.1));
    const startX = WALL() - 40, endX = 20, R = 70 * (1 + 0.2 * hu) * m.radius;
    const air = ojo ? 'both' : 'ground';
    const hits = new Map();
    let i = 0;
    repeat(B, 0.1, steps, () => {
      i++;
      const x = startX + (endX - startX) * (i / steps);
      for (let k = 0; k < 3; k++) {
        fx(B, 'particles', x + (rnd(B) - 0.5) * 30, GROUND() - 10 - k * 55, { n: 3, color: ['#e8f7ff', '#bfe9ff', '#ffffff'], speed: 120 + k * 40, life: 0.45, size: 4 + k, gravity: -40, drag: 2 });
      }
      if (i % 4 === 0) fx(B, 'smoke', x, GROUND() - 6, 2);
      for (const e of column(B, x, R, air)) {
        const c = hits.get(e) || 0;
        if (c >= 4) continue;
        hits.set(e, c + 1);
        hit(B, hero, e, 7 * p * mul * (e.air ? 1 + 0.25 * ojo : 1), { type: 'physical', noNumber: c > 0, knockback: 45 * mul });
      }
    });
  }

  // ---------------------------------------------------------------- 17 · Brujo
  H.brujo = {
    name: 'Sombra', title: 'El Brujo', rarity: 'epica', unlock: { gold: 25000, level: 52 }, color: '#7b3fbf',
    role: 'Drena vida · maldiciones',
    desc: 'Sus orbes oscuros drenan vida para el castillo. Su Maldición hace que los enemigos reciban mucho más daño de todos.',
    tags: ['Maldición', 'Curación', 'Mágico'], counters: ['troll', 'orco_tambor', 'senor_guerra'],
    attack: C({ damage: 16, interval: 1.1, range: 850, type: 'arcane', projectile: 'magic', speed: 650, color: '#8a3dd6', size: 10 }),
    passive: passive('Drenar vida: cura al castillo el 12 % del daño que inflige.', (B, hero, target, dmg) => {
      healCastle(B, (dmg > 0 ? dmg : ATK(hero).damage) * (0.12 + PM(hero, 'drain')));
      extraShot(B, hero, target, PM(hero, 'extraShot'));
    }),
    ability: {
      name: 'Maldición', cooldown: 14, value: 260,
      desc: 'Maldice una zona (tierra y aire): los enemigos reciben un 35 % más de daño durante 7 s.',
      detail: (st) => ['+' + Math.round(35 + 5 * (st.talents.condena || 0)) + ' % de daño recibido · daño ' + fmtN(40 * st.abilityPower), 'Radio ' + Math.round(190 * st.abilityMods.radius)],
      cast(B, hero) {
        const p = AP(hero), m = MOD(hero), co = rk(hero, 'condena'), cos = rk(hero, 'cosecha'), ss = rk(hero, 'senor_sombras');
        const R = 190 * m.radius;
        const pt = findArea(B, hero, R, 'both');
        if (!pt) return false;
        const zones = [pt.x];
        if (ss) {
          const others = inReach(B, hero, AB_RANGE, 'both').filter(e => Math.abs(e.x - pt.x) > R * 1.5);
          if (others.length) zones.push(others[0].x);
        }
        let total = 0;
        for (const x of zones) {
          const st = [{ kind: 'curse', power: 0.35 + 0.05 * co, duration: (7 + 1.5 * co) * m.duration }];
          if (ss) st.push({ kind: 'slow', power: 0.15 * ss, duration: 4 });
          total += blast(B, hero, x, R, 40 * p, { type: 'arcane', air: 'both', status: st }).total;
          fx(B, 'zone', x, GROUND(), R, { color: 'rgba(110,40,170,0.45)', edge: 'rgba(200,120,255,0.7)', dur: 2 });
          fx(B, 'particles', x, GROUND() - 60, { n: 24, kind: 'smoke', color: ['#3a1a5a', '#6a2bb6', '#24102e'], speed: 90, up: 60, gravity: -60, life: 1.2, size: 16, shrink: false });
          say(B, x, 230, '¡Maldición!', '#d6a8ff');
        }
        if (cos) healCastle(B, total * 0.25 * cos);
        snd(B, 'magic');
        return true;
      },
    },
  };

  // ---------------------------------------------------------------- 18 · Mosquetera
  H.mosquetera = {
    name: 'Pimienta', title: 'La Mosquetera', rarity: 'epica', unlock: { gold: 34000, level: 60 }, color: '#e84a5f',
    role: 'Críticos devastadores',
    desc: 'Lenta pero letal: un 30 % de sus disparos son críticos de ×2,5 y remata a los enemigos heridos.',
    tags: ['Críticos', 'Largo alcance', 'Tierra y aire'], counters: ['goblin_bombardero', 'goblin_arquero', 'orco_tambor', 'chaman'],
    attack: C({ damage: 30, interval: 2.0, range: 1050, projectile: 'bullet', speed: 2400, crit: 0.3, critMul: 2.5 }),
    passive: passive('Remate: +50 % de daño contra enemigos por debajo del 30 % de vida.', (B, hero, target) => {
      if (alive(target) && target.maxHp > 0 && target.hp / target.maxHp < 0.3) bonusHit(B, hero, target, ATK(hero).damage * (0.5 + PM(hero, 'execute')), { pierce: true });
    }),
    ability: {
      name: 'Disparo Certero', cooldown: 10, value: 360,
      desc: 'Un disparo perfecto al enemigo más peligroso: crítico garantizado de ×3.',
      detail: (st) => ['Daño ' + fmtN(120 * st.abilityPower) + ' ×3 (crítico)'],
      cast(B, hero) {
        const p = AP(hero), list = inReach(B, hero, AB_RANGE, 'both');
        if (!list.length) return false;
        const bounces = rk(hero, 'rebote'), mark = rk(hero, 'leyenda');
        const shot = (from, e, mul) => {
          const bp = body(B, e);
          fx(B, 'beam', from.x, from.y, bp.x, bp.y, { color: '#fff1a8', width: 4, dur: 0.25 });
          fx(B, 'particles', bp.x, bp.y, { n: 14, color: ['#ffd166', '#ffffff'], speed: 260, life: 0.45, size: 4, add: true });
          hit(B, hero, e, 120 * p * mul, { type: 'physical', crit: true, critMul: 3, pierce: true,
            status: mark ? [{ kind: 'curse', power: 0.15 * mark, duration: 6 }] : null });
        };
        let prev = strongest(list);
        shot(origin(hero), prev, 1);
        snd(B, 'musket'); snd(B, 'crit');
        fx(B, 'flash', 'rgba(255,246,208,0.25)', 0.08);
        for (let k = 0; k < bounces; k++) {
          later(B, 0.12 * (k + 1), () => {
            const from = { x: prev.x, y: body(B, prev).y };
            const next = inReach(B, hero, AB_RANGE, 'both').filter(e => e !== prev).sort((u, v) => Math.abs(u.x - prev.x) - Math.abs(v.x - prev.x))[0];
            if (!next) return;
            shot(from, next, 0.6);
            prev = next;
          });
        }
        return true;
      },
    },
  };

  // ---------------------------------------------------------------- 19 · Mago arcano
  function singularity(B, hero, rank) {
    const p = AP(hero), R = 150, pt = findArea(B, hero, R, 'both');
    if (!pt) return;
    const dur = 2 + rank;
    fx(B, 'zone', pt.x, GROUND(), R, { color: 'rgba(110,80,255,0.45)', edge: 'rgba(190,170,255,0.8)', dur });
    repeat(B, 0.25, Math.round(dur / 0.25), () => {
      blast(B, hero, pt.x, R, 5 * p, { type: 'arcane', air: 'both', noNumber: true, status: [{ kind: 'slow', power: 0.6, duration: 0.4 }] });
      fx(B, 'particles', pt.x, GROUND() - 80, { n: 6, color: ['#8f7bff', '#d8ceff'], speed: 160, life: 0.5, size: 4, gravity: 0, drag: 3, add: true });
    });
  }
  H.arcano = {
    name: 'Orbe', title: 'El Mago Arcano', rarity: 'legendaria', unlock: { gems: 400, level: 66 }, color: '#7a6cff',
    role: 'Misiles teledirigidos · ignora escudos',
    desc: 'Dispara misiles arcanos que nunca fallan y atraviesan cualquier escudo. Cada pocos misiles lanza una esfera que estalla.',
    tags: ['Teledirigido', 'Ignora escudos', 'Tierra y aire'], counters: ['orco_escudo', 'goblin_planeador', 'senor_guerra', 'golem'],
    attack: C({ damage: 10, interval: 0.55, range: 900, type: 'arcane', projectile: 'magic', speed: 700, color: '#9b8bff', size: 8 }),
    passive: passive('Resonancia: cada 6.º misil es una esfera que estalla en área (150 % de daño).', (B, hero, target) => {
      const d = dataOf(hero), every = Math.max(3, 6 - PM(hero, 'sphereEvery'));
      d.res = (d.res || 0) + 1;
      if (d.res >= every && target) {
        d.res = 0;
        const a = ATK(hero), bp = body(B, target);
        sphere(B, hero, bp.x, bp.y, 90, a.damage * (1.5 + PM(hero, 'sphere')), { type: 'arcane', air: 'both', source: hero });
        fx(B, 'explosion', bp.x, bp.y, 80, { color: '#8f7bff', colors: ['#ffffff', '#c9b8ff', '#7a6cff'], ringColor: 'rgba(200,180,255,0.9)' });
        snd(B, 'magic');
      }
      extraShot(B, hero, target, PM(hero, 'extraShot'));
    }),
    ability: {
      name: 'Torrente Arcano', cooldown: 14, value: 320,
      desc: 'Una ráfaga de 20 misiles arcanos teledirigidos contra los enemigos cercanos.',
      detail: (st) => [(20 + st.abilityMods.count) + ' misiles de ' + fmtN(16 * st.abilityPower) + ' de daño'],
      cast(B, hero) {
        const p = AP(hero), m = MOD(hero);
        if (!inReach(B, hero, AB_RANGE, 'both').length) return false;
        const n = Math.round(20 + m.count);
        say(B, hero.x - 200, hero.y - 110, '¡Torrente Arcano!', '#c9b8ff', 26);
        let i = 0;
        repeat(B, 2 / n, n, () => {
          i++;
          const list = inReach(B, hero, AB_RANGE, 'both');
          if (!list.length) return;
          const e = list[Math.floor(rnd(B) * Math.min(list.length, 6))];
          const o = origin(hero);
          shoot(B, { kind: 'magic', from: { x: o.x + (rnd(B) - 0.5) * 40, y: o.y + (rnd(B) - 0.5) * 40 }, to: e, homing: true,
            speed: 650 + rnd(B) * 300, color: '#a78bff', size: 9, source: hero,
            onHit: (B2, prj, tgt) => {
              const t = alive(tgt) ? tgt : (alive(e) ? e : null);
              if (!t) return;
              hit(B, hero, t, 16 * p, { type: 'arcane' });
            } });
          if (i % 4 === 1) snd(B, 'magic');
        });
        const sg = rk(hero, 'singularidad');
        if (sg) later(B, 2.1, () => singularity(B, hero, sg));
        return true;
      },
    },
  };

  // ---------------------------------------------------------------- 20 · Sacerdotisa del sol
  H.sacerdotisa_sol = {
    name: 'Solenne', title: 'Sacerdotisa del Sol', rarity: 'legendaria', unlock: { gems: 550, level: 75 }, color: '#ffcc33',
    role: 'Luz sagrada · azote de no-muertos',
    desc: 'Rayos de sol que atraviesan filas enteras. Devastadora contra esqueletos y espectros del Nigromante.',
    tags: ['Sagrado', 'Atraviesa', 'Antinomuertos'], counters: ['nigromante', 'goblin_planeador', 'chaman', 'dragon'],
    attack: C({ damage: 22, interval: 1.3, range: 900, type: 'holy', projectile: 'beam', pierce: 2, color: '#ffe066' }),
    passive: passive('Luz purificadora: +50 % de daño contra no-muertos; cada impacto cura un poco al castillo.', (B, hero, target) => {
      if (alive(target) && isUndead(target)) bonusHit(B, hero, target, ATK(hero).damage * (0.5 + PM(hero, 'undead')), { type: 'holy' });
      if (B.castle) healCastle(B, B.castle.maxHp * 0.0015);
    }),
    ability: {
      name: 'Rayo Solar', cooldown: 16, value: 600,
      desc: 'Una columna de luz abrasa la zona durante 2,4 s (tierra y aire). Doble daño contra no-muertos.',
      detail: (st) => ['16 golpes de ' + fmtN(14 * st.abilityPower) + ' de daño sagrado', 'Radio ' + Math.round(120 * st.abilityMods.radius)],
      cast(B, hero) {
        const p = AP(hero), m = MOD(hero), am = rk(hero, 'amanecer'), ec = rk(hero, 'eclipse'), cal = rk(hero, 'calor');
        const R = 120 * m.radius;
        const pt = findArea(B, hero, R, 'both');
        if (!pt) return false;
        const dur = 2.4 + 0.4 * am, ticks = Math.round(dur / 0.15);
        let x = pt.x;
        const seen = new Set();
        say(B, x, 200, '¡Rayo Solar!', '#fff3b0');
        fx(B, 'flash', 'rgba(255,243,176,0.35)', 0.25);
        snd(B, 'magic');
        repeat(B, 0.15, ticks, () => {
          if (am) x -= 30;
          fx(B, 'beam', x, -40, x, GROUND(), { color: 'rgba(255,225,110,0.8)', width: R * 0.45, dur: 0.2 });
          fx(B, 'particles', x, GROUND() - 10, { n: 4, color: ['#fff6c4', '#ffe066'], speed: 160, up: 120, life: 0.4, size: 4, add: true });
          const st = [];
          if (ec) st.push({ kind: 'slow', power: 0.3, duration: 0.5 });
          if (cal) st.push({ kind: 'burn', dps: 4 * p * cal, duration: 3 });
          const res = blast(B, hero, x, R, 14 * p, { type: 'holy', air: 'both', undead: 2, noNumber: false, status: st.length ? st : null });
          for (const e of res.list) seen.add(e);
        });
        if (ec) later(B, dur + 0.05, () => { if (B.castle) healCastle(B, B.castle.maxHp * Math.min(0.15, 0.01 * ec * seen.size)); });
        return true;
      },
    },
  };

  // ================================================================ registro
  const ORDER = ['arquera', 'mago_fuego', 'maga_hielo', 'halconera', 'hechicera_rayo', 'ingeniero', 'ballestero', 'martillo',
    'sacerdote', 'druida', 'alquimista', 'bardo', 'granadero', 'envenenadora', 'cazadora', 'monje_viento', 'brujo',
    'mosquetera', 'arcano', 'sacerdotisa_sol'];
  const out = {};
  ORDER.forEach((id, i) => {
    const d = H[id];
    d.id = id;
    d.order = i + 1;
    d.fullName = d.name + ', ' + (/^(El|La) /.test(d.title) ? d.title.charAt(0).toLowerCase() + d.title.slice(1) : d.title);
    d.sprite = 'hero_' + id;
    d.size = d.size || 76;
    d.ability.cooldown = d.ability.cooldown || 15;
    out[id] = d;
  });
  BB.data.heroes = out;
  BB.data.heroOrder = ORDER.slice();
})();
