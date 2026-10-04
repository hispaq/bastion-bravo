/* Bastión Bravo · motor de batalla (simulación pura, sin DOM)
   Contrato: docs/DISENO.md, secciones 4.5–4.13. */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const U = BB.util;
  const W = BB.WORLD;
  const STEP = 1 / 60;

  const PROJ_SOUND = {
    arrow: 'arrow', bolt: 'bolt', fireball: 'fireball', ice: 'ice', cannon: 'cannon', bomb: 'bomb',
    magic: 'magic', dart: 'whoosh', hammer: 'hammer', potion: 'whoosh', rock: 'whoosh', feather: 'whoosh',
    holy: 'magic', bullet: 'musket', spear: 'whoosh', wind: 'wind', lightning: 'lightning', beam: 'magic',
  };

  function airMode(a) {
    const air = a.air !== false && a.air !== undefined ? !!a.air : false;
    const ground = a.ground !== false;
    if (air && ground) return 'both';
    if (air) return 'air';
    return 'ground';
  }
  function airOk(e, mode) {
    if (!mode || mode === 'both') return true;
    return mode === 'air' ? e.air : !e.air;
  }
  function randRange(r, rng) {
    if (Array.isArray(r)) return r[0] + (r[1] - r[0]) * rng();
    return r || 5;
  }

  // Estadísticas por defecto si aún no existen los módulos de mejoras
  function fallbackCastle() {
    return { maxHp: 600, wallHp: 400, wallArmor: 0.1, slots: 3, tapDamage: 12, tapCooldown: 0.25, goldBonus: 0, regen: 0, tier: 1, wallTier: 1 };
  }
  function fallbackHeroStats(def) {
    return { attack: Object.assign({}, def.attack || {}), abilityCooldown: (def.ability && def.ability.cooldown) || 15, abilityPower: 1, talents: {} };
  }

  class Battle extends U.Emitter {
    constructor(opts) {
      super();
      opts = opts || {};
      this.headless = !!opts.headless;
      this.save = opts.save || BB.save.data;
      this.level = opts.level || 1;
      this.levelDef = opts.levelDef || (BB.levelDef ? BB.levelDef(this.level) : { n: this.level, spawns: [], waves: [0] });
      const zones = (BB.data && BB.data.zones) || [];
      this.zone = zones.find(z => z.id === this.levelDef.zone) ||
        zones[Math.min(zones.length - 1, Math.floor((this.level - 1) / 10))] || null;
      this.seed = opts.seed != null ? opts.seed : (Math.random() * 1e9) | 0;
      this.rng = U.mulberry32(this.seed);
      this.fx = BB.createFX(this.headless);
      if (!this.headless && this.save.settings && this.save.settings.quality === 'baja') this.fx.quality = 0.5;

      this.t = 0; this._acc = 0; this._id = 0;
      this.speed = (this.save.settings && this.save.settings.speed) === 2 ? 2 : 1;
      this.paused = false; this.over = false; this.result = null;
      this.enemies = []; this.corpses = []; this.heroes = []; this.towers = []; this.projectiles = []; this.timers = [];
      this.boss = null; this.bossDefeated = null;
      this.gold = 0;
      this.stats = { kills: 0, killsByType: {}, dmgDealt: 0, abilities: 0, taps: 0, castleDamage: 0, wallBroken: false };
      this.heroBuffs = [];
      this.autoSkills = !!(opts.autoSkills != null ? opts.autoSkills : (this.save.settings && this.save.settings.autoSkills));

      // Castillo
      let cs = fallbackCastle();
      if (typeof BB.castleStats === 'function') {
        try { cs = Object.assign(fallbackCastle(), BB.castleStats(this.save) || {}); } catch (err) { console.error('castleStats', err); }
      }
      this.castleStats = cs;
      this.castle = {
        hp: cs.maxHp, maxHp: cs.maxHp, wallHp: cs.wallHp, wallMax: cs.wallHp, wallArmor: cs.wallArmor || 0,
        shield: 0, shieldT: 0, regen: cs.regen || 0, tier: cs.tier || 1, wallTier: cs.wallTier || 1,
        hitT: 0, wallHitT: 0,
      };
      this.tapState = { damage: cs.tapDamage || 12, cooldown: cs.tapCooldown || 0.25, cd: 0 };
      this.goldMul = 1 + (cs.goldBonus || 0);

      this._buildHeroes(cs.slots || 3);
      this._buildTowers();
      this._buildTroops();

      // Apariciones
      this.spawns = (this.levelDef.spawns || []).slice().sort((a, b) => a.t - b.t);
      this.spawnIdx = 0;
      const bossId = this.levelDef.boss;
      if (bossId && !this.spawns.some(s => s.type === bossId)) {
        const lastT = this.spawns.length ? this.spawns[this.spawns.length - 1].t : 0;
        this.spawns.push({ t: lastT + 4, type: bossId, boss: true });
      }
      this.waveTimes = (this.levelDef.waves && this.levelDef.waves.length ? this.levelDef.waves : [0]).slice().sort((a, b) => a - b);
      this.waveIdx = -1;
      this.totalSpawns = this.spawns.length;
      this.victoryT = -1;
    }

    // ------------------------------------------------------------- montaje
    _buildHeroes(slots) {
      const heroesDef = (BB.data && BB.data.heroes) || {};
      const lineup = this.save.lineup || [];
      const used = {};
      for (let i = 0; i < Math.min(slots, W.HERO_SLOTS.length); i++) {
        const id = lineup[i];
        if (!id || used[id]) continue;
        const def = heroesDef[id];
        const owned = this.save.heroes && this.save.heroes[id] && this.save.heroes[id].owned;
        if (!def || !owned) continue;
        used[id] = true;
        let stats;
        try { stats = typeof BB.heroStats === 'function' ? BB.heroStats(id, this.save) : null; } catch (err) { console.error('heroStats ' + id, err); }
        if (!stats || !stats.attack) stats = fallbackHeroStats(def);
        const slot = W.HERO_SLOTS[i];
        const cdMax = stats.abilityCooldown || (def.ability && def.ability.cooldown) || 15;
        this.heroes.push({
          id, def, stats, slot: i, x: slot.x, y: slot.y,
          level: (this.save.heroes[id] && this.save.heroes[id].level) || 1,
          cd: cdMax * 0.3, cdMax, atkTimer: 0.2 + this.rng() * 0.6, disabled: 0,
          atkAnim: 0, castAnim: 0, readyFlash: 0, data: {},
        });
      }
    }
    _buildTroops() {
      this.troops = [];
      const defs = (BB.data && BB.data.troops) || {};
      const order = (BB.data && BB.data.troopOrder) || Object.keys(defs);
      const slots = BB.TROOP_SLOTS || [];
      const own = this.save.troops || {};
      let i = 0;
      for (const id of order) {
        const n = (own[id] && own[id].count) || 0;
        for (let k = 0; k < n && i < slots.length; k++, i++) {
          const a = BB.troopsApi ? BB.troopsApi.stats(id, this.save) : Object.assign({}, defs[id].attack);
          this.troops.push({ id, def: defs[id], attack: a, x: slots[i].x, y: slots[i].y, slot: i,
            atkTimer: 0.3 + this.rng() * a.interval, atkAnim: 0, level: (own[id] && own[id].level) || 1 });
        }
      }
    }
    _updateTroop(u, dt) {
      if (u.atkAnim > 0) u.atkAnim -= dt;
      const a = u.attack;
      u.atkTimer -= dt * this.heroAtkMul();
      if (u.atkTimer > 0) return;
      const target = this.pickTarget(u.x, a.range || 850, { prefer: a.prefer || 'front', air: airMode(a) });
      if (!target) { u.atkTimer = 0.15; return; }
      this._fireAttack(u, a, target, { x: u.x - 14, y: u.y - (u.def.size || 52) * 0.62 }, null);
      u.atkTimer += a.interval || 1.2;
      if (u.atkTimer < 0) u.atkTimer = a.interval || 1.2;
      u.atkAnim = 0.22;
    }
    _buildTowers() {
      const defs = (BB.data && BB.data.towers) || {};
      const traps = this.save.traps || [];
      for (let i = 0; i < W.TRAP_SLOTS.length; i++) {
        const id = traps[i];
        if (!id || !defs[id]) continue;
        const owned = this.save.towers && this.save.towers[id] && this.save.towers[id].owned;
        if (!owned) continue;
        const def = defs[id];
        let stats = null;
        try { stats = typeof BB.towerStats === 'function' ? BB.towerStats(id, this.save) : null; } catch (err) { console.error('towerStats ' + id, err); }
        stats = stats || { attack: def.attack ? Object.assign({}, def.attack) : null, hp: def.block ? def.block.hp : 0 };
        const kind = def.kind || (def.trap ? 'trap' : def.block ? 'block' : 'tower');
        const hp = kind === 'block' ? (stats.hp || (def.block && def.block.hp) || 300) : 0;
        this.towers.push({
          id, def, stats, kind, slot: i, x: W.TRAP_SLOTS[i].x, y: W.GROUND,
          hp, maxHp: hp, broken: false, atkTimer: 0.5 + this.rng() * 0.5, atkAnim: 0, hitT: 0, data: {},
          level: (this.save.towers[id] && this.save.towers[id].level) || 1,
        });
      }
    }

    // ------------------------------------------------------------- control
    setSpeed(n) { this.speed = n === 2 ? 2 : 1; if (this.save.settings) { this.save.settings.speed = this.speed; BB.save.commit(); } }
    pause() { this.paused = true; }
    resume() { this.paused = false; }
    sound(name) { if (!this.headless && BB.audio && BB.audio.sfx) { try { BB.audio.sfx(name); } catch (err) { /* nada */ } } }
    after(s, fn) { this.timers.push({ t: this.t + s, fn, left: 1, every: 0 }); }
    every(s, fn, times) { this.timers.push({ t: this.t + s, fn, left: times || Infinity, every: s }); }

    update(realDt) {
      if (this.paused || this.over && this.result && this._endDone) { if (!this.paused) this.fx.update(realDt); return; }
      this._acc += Math.min(0.1, realDt) * this.speed;
      let n = 0;
      while (this._acc >= STEP && n < 10) { this.step(STEP); this._acc -= STEP; n++; }
      if (n >= 10) this._acc = 0;
    }

    step(dt) {
      this.t += dt;
      this.fx.update(dt);
      if (this.over) { this._postOver(dt); return; }
      // temporizadores
      if (this.timers.length) {
        const due = this.timers.filter(tm => tm.t <= this.t);
        if (due.length) {
          for (const tm of due) {
            try { tm.fn(this); } catch (err) { console.error('[temporizador]', err); }
            tm.left--;
            if (tm.left > 0 && tm.every > 0) tm.t += tm.every; else tm.dead = true;
          }
          this.timers = this.timers.filter(tm => !tm.dead);
        }
      }
      this._updateSpawns();
      this._updateCastle(dt);
      for (const h of this.heroes) this._updateHero(h, dt);
      for (const u of this.troops) this._updateTroop(u, dt);
      for (const tw of this.towers) this._updateTower(tw, dt);
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (!e.dead) this._updateEnemy(e, dt);
      }
      this._updateProjectiles(dt);
      // limpiar
      if (this.enemies.some(e => e.dead || e.removed)) {
        for (const e of this.enemies) if (e.dead && !e.removed) this.corpses.push(e);
        this.enemies = this.enemies.filter(e => !e.dead && !e.removed);
      }
      for (const c of this.corpses) { c.dying += dt; if (c.dying > 1.1) c.removed = true; }
      if (this.corpses.length) this.corpses = this.corpses.filter(c => !c.removed);
      this.heroBuffs = this.heroBuffs.filter(b => (b.t -= dt) > 0);
      this._checkEnd(dt);
    }

    // ------------------------------------------------------------- aparición
    _updateSpawns() {
      while (this.spawnIdx < this.spawns.length && this.spawns[this.spawnIdx].t <= this.t) {
        const s = this.spawns[this.spawnIdx++];
        this.spawnEnemy(s.type, { elite: !!s.elite, y: s.y });
      }
      while (this.waveIdx + 1 < this.waveTimes.length && this.t >= this.waveTimes[this.waveIdx + 1]) {
        this.waveIdx++;
        this.emit('wave', { index: this.waveIdx, count: this.waveTimes.length });
        if (this.waveIdx > 0) this.sound('wave');
      }
    }

    spawnEnemy(type, o) {
      o = o || {};
      const bosses = (BB.data && BB.data.bosses) || {};
      const enemies = (BB.data && BB.data.enemies) || {};
      const isBoss = !!bosses[type];
      const def = isBoss ? bosses[type] : enemies[type];
      if (!def) { console.warn('Enemigo desconocido:', type); return null; }
      const L = o.level || this.level;
      const elite = !!o.elite;
      const bal = BB.balance;
      const hp = Math.max(1, (def.hp || 30) * (isBoss ? bal.bossHp(L) : bal.enemyHp(L)) * (elite ? bal.ELITE_HP : 1) * (o.hpMul || 1));
      const dmg = (def.damage || 3) * bal.enemyDmg(L) * (elite ? bal.ELITE_DMG : 1) * (o.dmgMul || 1);
      const air = !!def.air;
      let y = o.y;
      if (y == null) {
        if (air) {
          const fy = def.flyY || [W.AIR_MIN, W.AIR_MAX];
          y = fy[0] + (fy[1] - fy[0]) * this.rng();
        } else y = W.GROUND + (this.rng() - 0.5) * 12;
      }
      const goldBase = (def.gold || 1) * bal.enemyGold(L) * (elite ? 2.5 : 1) * (o.minion ? 0.35 : 1);
      const e = {
        id: ++this._id, type, def, x: o.x != null ? o.x : W.SPAWN_X - this.rng() * 25, y, baseY: y,
        hp, maxHp: hp, speed: (def.speed || 50) * (o.speedMul || 1), damage: dmg,
        atkInterval: def.atkInterval || 1, atkTimer: 0.3 + this.rng() * 0.4,
        range: def.range || 0, armor: def.armor || 0, resist: def.resist || {}, immune: def.immune || {},
        air, burrowed: false, boss: isBoss, elite, minion: !!o.minion, leaps: !!def.leaps,
        state: 'walk', target: null, reached: false, status: {}, data: {}, buff: null,
        age: 0, face: 1, scale: (elite ? 1.15 : 1) * (o.scale || 1),
        radius: def.radius || (isBoss ? 60 : 18), size: (def.size || (isBoss ? 240 : 70)) * (isBoss ? 1 : 1.15),
        gold: Math.max(1, Math.round(goldBase)),
        hitFlash: 0, atkAnim: 0, dying: 0, kbLeft: 0, dotAcc: 0, dotT: 0, dotType: 'fire',
        phase: 0, atkTimers: null, level: L, spawnT: this.t,
      };
      if (isBoss) {
        e.atkTimers = (def.attacks || []).map(a => randRange(a.every, this.rng) * 0.6 + 1.5);
        this.boss = e;
        this.save.seen && (this.save.seen.bosses[type] = true);
      } else if (this.save.seen) this.save.seen.enemies[type] = true;
      this.enemies.push(e);
      if (def.onSpawn) { try { def.onSpawn(this, e); } catch (err) { console.error('[onSpawn ' + type + ']', err); } }
      this.emit('spawn', { enemy: e });
      if (isBoss) { this.emit('bossSpawn', { boss: e }); this.sound('roar'); this.fx.shake(10, 0.6); }
      return e;
    }

    // ------------------------------------------------------------- castillo
    _updateCastle(dt) {
      const c = this.castle;
      if (c.regen > 0 && c.hp < c.maxHp) c.hp = Math.min(c.maxHp, c.hp + c.regen * dt);
      if (c.shieldT > 0) { c.shieldT -= dt; if (c.shieldT <= 0) c.shield = 0; }
      if (c.hitT > 0) c.hitT -= dt;
      if (c.wallHitT > 0) c.wallHitT -= dt;
      if (this.tapState.cd > 0) this.tapState.cd -= dt;
    }
    damageWall(amount, src) {
      const c = this.castle;
      if (c.wallHp <= 0) return this.damageCastle(amount, { source: src, ignoreWall: true });
      const a = Math.max(0, amount * (1 - Math.min(0.85, c.wallArmor)));
      c.wallHp -= a; c.wallHitT = 0.15;
      this.stats.castleDamage += a;
      if (c.wallHp <= 0) {
        c.wallHp = 0; this.stats.wallBroken = true;
        this.emit('wallBroken', {});
        this.sound('wall_break');
        this.fx.explosion(W.WALL_X + 26, W.GROUND - 80, 90, { debris: ['#8b8f97', '#6f4723', '#a9adb5'] });
        this.fx.shake(12, 0.5);
        for (const e of this.enemies) e.reached = false;
      } else if (this.rng() < 0.3) this.sound('wall_hit');
      return a;
    }
    damageCastle(amount, o) {
      o = o || {};
      const c = this.castle;
      if (this.over || amount <= 0) return 0;
      if (!o.ignoreWall && c.wallHp > 0) return this.damageWall(amount, o.source);
      let a = amount;
      if (c.shield > 0) {
        const ab = Math.min(c.shield, a);
        c.shield -= ab; a -= ab;
        if (ab > 0) this.fx.number(W.CASTLE_X + 60, W.GROUND - 260, Math.round(ab), 'shield');
      }
      if (a <= 0) return 0;
      c.hp -= a; c.hitT = 0.18;
      this.stats.castleDamage += a;
      this.fx.number(W.CASTLE_X + 80 + this.rng() * 60, W.GROUND - 220 - this.rng() * 80, a, 'castle');
      if (this.rng() < 0.4) this.sound('castle_hit');
      this.emit('castleHit', { amount: a });
      if (c.hp <= 0) { c.hp = 0; this._finish(false); }
      return a;
    }
    healCastle(amount) {
      const c = this.castle;
      if (amount <= 0 || this.over) return 0;
      const before = c.hp;
      c.hp = Math.min(c.maxHp, c.hp + amount);
      const h = c.hp - before;
      if (h > 0) this.fx.number(W.CASTLE_X + 90, W.GROUND - 300, h, 'heal');
      return h;
    }
    shieldCastle(amount, dur) {
      const c = this.castle;
      c.shield = Math.max(c.shield, amount);
      c.shieldT = Math.max(c.shieldT, dur || 6);
      this.sound('shield');
    }

    // ------------------------------------------------------------- héroes
    heroAtkMul() { let m = 1; for (const b of this.heroBuffs) m += b.atkSpeed || 0; return m; }
    heroDmgMul() { let m = 1; for (const b of this.heroBuffs) m += b.dmg || 0; return m; }
    buffHeroes(o) {
      this.heroBuffs.push({ atkSpeed: o.atkSpeed || 0, dmg: o.dmg || 0, t: o.duration || 6 });
      this.sound('buff');
      for (const h of this.heroes) this.fx.particles(h.x, h.y - 40, { n: 6, color: ['#ffe46b', '#ffffff'], kind: 'star', speed: 70, gravity: -60, life: 0.8, size: 6 });
    }
    disableHero(h, seconds) {
      if (!h) return;
      h.disabled = Math.max(h.disabled, seconds || 3);
      this.fx.particles(h.x, h.y - 40, { n: 10, color: ['#bfeaff', '#ffffff'], kind: 'ice', speed: 90, life: 0.8, size: 6 });
    }
    castAbility(i) {
      const h = this.heroes.find(x => x.slot === i);
      if (!h || this.over || this.paused || h.cd > 0 || h.disabled > 0 || !h.def.ability || typeof h.def.ability.cast !== 'function') return false;
      h.cd = h.cdMax; h.castAnim = 0.7;
      this.stats.abilities++;
      this.sound('cast');
      this.fx.ring(h.x, h.y - 30, 60, { color: 'rgba(255,240,150,0.95)', dur: 0.5, width: 6 });
      try { h.def.ability.cast(this, h); } catch (err) { console.error('[habilidad ' + h.id + ']', err); }
      this.emit('heroCast', { hero: h });
      return true;
    }
    _updateHero(h, dt) {
      if (h.atkAnim > 0) h.atkAnim -= dt;
      if (h.castAnim > 0) h.castAnim -= dt;
      if (h.readyFlash > 0) h.readyFlash -= dt;
      if (h.disabled > 0) { h.disabled -= dt; return; }
      if (h.cd > 0) { h.cd -= dt; if (h.cd <= 0) { h.cd = 0; h.readyFlash = 0.6; } }
      if (this.autoSkills && h.cd <= 0 && (this.boss || this.enemies.filter(e => !e.dead && e.x > 120).length >= 3)) this.castAbility(h.slot);
      const a = h.stats.attack;
      if (!a || !a.damage) return;
      h.atkTimer -= dt * this.heroAtkMul();
      if (h.atkTimer <= 0) {
        const target = this.pickTarget(h.x, a.range || 800, { prefer: a.prefer || 'front', air: airMode(a) });
        if (target) {
          this._fireAttack(h, a, target, { x: h.x - 22, y: h.y - (h.def.size || 76) * 0.6 }, h.def.passive);
          h.atkTimer += a.interval || 1;
          if (h.atkTimer < 0) h.atkTimer = a.interval || 1;
          h.atkAnim = 0.22;
        } else h.atkTimer = 0.12;
      }
    }

    // Disparo genérico de héroes y torres
    _fireAttack(src, a, target, from, passive) {
      const mul = src && src.cdMax != null ? this.heroDmgMul() : 1;
      const info = {
        type: a.type || 'physical', source: src, critChance: a.crit || 0, critMul: a.critMul || 2,
        pierce: (a.pierce || 0) > 0,
      };
      const mode = airMode(a);
      const spec = {
        damage: (a.damage || 1) * mul, type: info.type, radius: a.radius || 0, air: mode,
        status: a.status || null, knockback: a.knockback || 0, pierce: a.pierce || 0, info, passive,
      };
      const kind = a.projectile || 'arrow';
      this.sound(PROJ_SOUND[kind] || 'arrow');
      if (kind === 'lightning') {
        const chain = Math.max(0, a.chain || 0);
        const hit = [target];
        const pts = [from, this.bodyPoint(target)];
        let cur = target;
        for (let k = 0; k < chain; k++) {
          let best = null, bd = 220;
          for (const e of this.enemies) {
            if (e.dead || e.burrowed || hit.includes(e) || !airOk(e, mode) || e.x < -30) continue;
            const d = Math.abs(e.x - cur.x) + Math.abs(this.bodyPoint(e).y - this.bodyPoint(cur).y) * 0.5;
            if (d < bd) { bd = d; best = e; }
          }
          if (!best) break;
          hit.push(best); pts.push(this.bodyPoint(best)); cur = best;
        }
        this.fx.lightning(pts, { color: a.color || '#a8e8ff' });
        hit.forEach((e, i) => this._applyHit(spec, e, i === 0 ? 1 : 0.85, this.bodyPoint(e)));
        return;
      }
      if (kind === 'beam') {
        const tp = this.bodyPoint(target);
        this.fx.beam(from.x, from.y, tp.x, tp.y, { color: a.color || '#fff3a0', width: 9, dur: 0.22 });
        this._applyHit(spec, target, 1, tp);
        if (spec.pierce > 0) {
          const extra = this.enemies.filter(e => e !== target && !e.dead && !e.burrowed && airOk(e, mode) && e.x < target.x && e.x > target.x - 420)
            .sort((p, q) => q.x - p.x).slice(0, spec.pierce);
          for (const e of extra) this._applyHit(spec, e, 0.8, this.bodyPoint(e));
        }
        return;
      }
      if (kind === 'wind') {
        this.spawnProjectile({ kind: 'wind', from: { x: from.x, y: W.GROUND - 30 }, to: { x: Math.max(-40, src.x - (a.range || 700)), y: W.GROUND - 30 },
          speed: a.speed || 520, team: 'player', source: src, wave: true, onHit: spec });
        return;
      }
      this.spawnProjectile({
        kind, from, to: target, speed: a.speed || 900, arc: a.arc || 0, homing: kind === 'magic' || kind === 'feather',
        team: 'player', source: src, onHit: spec, color: a.color, size: a.size,
      });
    }

    // Aplica un impacto descrito por un objeto (daño, área, estados, empuje, atravesar)
    _applyHit(spec, target, mulExtra, point) {
      const info = Object.assign({}, spec.info || {}, { type: spec.type || 'physical' });
      const dmg = (spec.damage || 0) * (mulExtra || 1);
      if (spec.radius > 0) {
        const p = point || (target ? this.bodyPoint(target) : { x: 0, y: W.GROUND });
        const groundHit = spec.air === 'ground' || (target ? !target.air : p.y > W.GROUND - 130);
        const hy = groundHit ? W.GROUND - 20 : p.y;
        const hits = this.damageArea(p.x, hy, spec.radius, dmg, Object.assign(info, { air: spec.air || 'both' }));
        for (const e of hits) this._postHit(spec, e);
        this._areaFx(spec.type, p.x, groundHit ? W.GROUND - 10 : p.y, spec.radius);
        if (spec.passive && spec.passive.onHit && target) { try { spec.passive.onHit(this, info.source, target, dmg); } catch (err) { console.error('[pasiva]', err); } }
        return;
      }
      if (!target || target.dead) return;
      const dealt = this.damage(target, dmg, info);
      this._postHit(spec, target);
      if (spec.passive && spec.passive.onHit) { try { spec.passive.onHit(this, info.source, target, dealt); } catch (err) { console.error('[pasiva]', err); } }
    }
    _postHit(spec, e) {
      if (!e || e.dead) return;
      if (spec.status) for (const s of [].concat(spec.status)) if (s && s.kind) this.applyStatus(e, s.kind, s);
      if (spec.knockback) this.knockback(e, spec.knockback);
    }
    _areaFx(type, x, y, r) {
      const map = {
        fire: { color: '#ff7a1c' }, ice: { color: '#7fd6ff', colors: ['#e9fbff', '#9fe7ff', '#5fb8ff'], flash: 'rgba(200,240,255,0.8)' },
        poison: { color: '#6ad13a', colors: ['#c6f59a', '#7fd13a', '#3f8a1c'], flash: 'rgba(170,255,120,0.6)' },
        lightning: { color: '#fff35c', colors: ['#ffffff', '#fff35c', '#8fd6ff'] }, arcane: { color: '#b56cff', colors: ['#f0d6ff', '#c58cff', '#8a4dff'] },
        holy: { color: '#ffe58a', colors: ['#ffffff', '#ffe58a', '#ffc94d'] },
      };
      if (type === 'physical' || !map[type]) this.fx.explosion(x, y, Math.min(r, 110));
      else {
        const m = map[type];
        this.fx.ring(x, y, r, { color: m.color, dur: 0.35, width: 5 });
        this.fx.particles(x, y, { n: 10 + r / 8, kind: type === 'ice' ? 'ice' : 'fire', color: m.colors || [m.color, '#ffffff'], speed: r * 3, life: 0.5, size: 7, gravity: type === 'ice' ? 300 : -40, add: type !== 'ice' && type !== 'poison', drag: 2 });
      }
    }

    // ------------------------------------------------------------- torres
    _updateTower(tw, dt) {
      if (tw.atkAnim > 0) tw.atkAnim -= dt;
      if (tw.hitT > 0) tw.hitT -= dt;
      const def = tw.def;
      if (tw.kind === 'block') { if (tw.hp <= 0 && !tw.broken) { tw.broken = true; this.fx.explosion(tw.x, W.GROUND - 30, 60, { debris: ['#8a5a30', '#6b4423'] }); this.sound('wall_break'); } }
      if (def.onUpdate) { try { def.onUpdate(this, tw, dt); } catch (err) { console.error('[torre ' + tw.id + ']', err); } }
      if (tw.kind === 'tower') {
        const a = tw.stats && tw.stats.attack;
        if (!a || !a.damage) return;
        tw.atkTimer -= dt;
        if (tw.atkTimer <= 0) {
          const target = this.pickTarget(tw.x, a.range || 600, { prefer: a.prefer || 'front', air: airMode(a), minRange: a.minRange || 0 });
          if (target) {
            this._fireAttack(tw, a, target, { x: tw.x - 10, y: W.GROUND - (def.size || 110) * 0.75 }, null);
            tw.atkTimer += a.interval || 1.5;
            if (tw.atkTimer < 0) tw.atkTimer = a.interval || 1.5;
            tw.atkAnim = 0.3;
          } else tw.atkTimer = 0.15;
        }
      } else if (tw.kind === 'trap' && def.trap && typeof def.trap.onEnemy === 'function') {
        const half = (def.trap.width || 90) / 2;
        for (const e of this.enemies) {
          if (e.dead || e.air || e.leaps || Math.abs(e.x - tw.x) >= half) continue;
          try { def.trap.onEnemy(this, tw, e, dt); } catch (err) { console.error('[trampa ' + tw.id + ']', err); break; }
        }
      }
    }
    barricade() { return this.towers.find(t => t.kind === 'block' && !t.broken && t.hp > 0) || null; }

    // ------------------------------------------------------------- enemigos
    bodyPoint(e) {
      if (!e) return { x: 0, y: W.GROUND };
      return { x: e.x, y: e.air ? e.y : e.y - e.size * 0.45 * (e.scale || 1) };
    }
    _statusSpeedMul(e) {
      const st = e.status;
      if (st.freeze || st.stun) return 0;
      if (st.root && !e.air) return 0;
      let m = 1;
      if (st.slow) m *= Math.max(0.15, 1 - st.slow.power);
      if (e.buff) m *= 1 + (e.buff.speed || 0);
      return m;
    }
    _tickStatus(e, dt) {
      const st = e.status;
      let dps = 0, type = null;
      for (const k in st) {
        const s = st[k];
        s.t -= dt;
        if (s.t <= 0) { delete st[k]; continue; }
        if (k === 'burn') { dps += s.dps || 0; type = 'fire'; }
        if (k === 'poison') { dps += (s.dps || 0) * (s.stacks || 1); type = type || 'poison'; }
      }
      if (e.buff) { e.buff.t -= dt; if (e.buff.t <= 0) e.buff = null; }
      if (dps > 0) {
        e.dotAcc += dps * dt; e.dotT += dt; e.dotType = type;
        if (e.dotT >= 0.5) {
          const amount = e.dotAcc; e.dotAcc = 0; e.dotT = 0;
          this.damage(e, amount, { type: e.dotType, source: 'dot', dot: true });
        }
      }
    }
    _updateEnemy(e, dt) {
      e.age += dt;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.atkAnim > 0) e.atkAnim -= dt;
      this._tickStatus(e, dt);
      if (e.dead) return;
      if (e.kbLeft > 0) { const m = Math.min(e.kbLeft, 700 * dt); e.x -= m; e.kbLeft -= m; e.x = Math.max(-25, e.x); }
      // Red de seguridad: nadie puede quedarse enterrado o atascado para siempre
      if (e.age > 60 && e.burrowed && !e.boss) { e.burrowed = false; e.data.forcedOut = true; }
      if (e.age > 120 && !e.boss && e.state === 'walk' && e.x < 200) e.x += 60 * dt;
      const def = e.def;
      if (e.boss) this._updateBoss(e, dt);
      if (e.dead) return;
      if (def.onUpdate) {
        let skip = false;
        try { skip = def.onUpdate(this, e, dt) === true; } catch (err) { console.error('[onUpdate ' + e.type + ']', err); }
        if (skip || e.dead) return;
      }
      if (e.status.freeze || e.status.stun) return;
      this._defaultAI(e, dt);
    }
    _targetFor(e) {
      if (e.air) return { kind: 'castillo', x: W.CASTLE_X - 30 };
      const bar = this.barricade();
      if (bar && !e.leaps && e.range <= 0 && e.x < bar.x - 20) return { kind: 'barricada', x: bar.x - 36, ref: bar };
      if (this.castle.wallHp > 0) return { kind: 'muralla', x: W.WALL_X };
      return { kind: 'castillo', x: W.CASTLE_X };
    }
    _defaultAI(e, dt) {
      const def = e.def;
      const tgt = this._targetFor(e);
      if (tgt.kind !== e.target) { e.target = tgt.kind; e.reached = false; }
      let stopX = tgt.x - (e.air ? 0 : e.radius * 0.6) - (e.range > 0 ? e.range : 0);
      if (e.boss && def.stopX) stopX = Math.min(stopX, def.stopX);
      if (e.x < stopX - 0.5) {
        const sp = e.speed * this._statusSpeedMul(e);
        e.x = Math.min(stopX, e.x + sp * dt);
        e.state = 'walk';
        return;
      }
      e.state = 'attack';
      if (!e.reached) {
        e.reached = true;
        if (def.onReach) { try { def.onReach(this, e); } catch (err) { console.error('[onReach ' + e.type + ']', err); } if (e.dead) return; }
      }
      // Un jefe plantado lejos (stopX) no golpea cuerpo a cuerpo: atacan sus habilidades
      if (e.range <= 0 && tgt.x - e.x > 90) return;
      let atkMul = 1;
      if (e.status.slow) atkMul *= Math.max(0.3, 1 - e.status.slow.power * 0.6);
      if (e.buff && e.buff.atk) atkMul *= 1 + e.buff.atk;
      e.atkTimer -= dt * atkMul;
      if (e.atkTimer > 0) return;
      e.atkTimer = e.atkInterval;
      e.atkAnim = 0.35;
      if (def.onAttack) {
        let done = false;
        try { done = def.onAttack(this, e) === true; } catch (err) { console.error('[onAttack ' + e.type + ']', err); }
        if (done) return;
      }
      const dmg = e.damage * (e.buff && e.buff.dmg ? 1 + e.buff.dmg : 1);
      if (e.range > 0) {
        const proj = def.projectile || { kind: 'arrow', speed: 520 };
        const to = tgt.kind === 'muralla' ? { x: W.WALL_X + 20, y: W.GROUND - 70 - this.rng() * 60 } : { x: W.CASTLE_X + 30 + this.rng() * 60, y: W.GROUND - 120 - this.rng() * 120 };
        const bp = this.bodyPoint(e);
        this.spawnProjectile({ kind: proj.kind || 'arrow', from: { x: bp.x + 15, y: bp.y - 10 }, to, speed: proj.speed || 520, arc: proj.arc || 40, team: 'enemy', onHit: { damage: dmg }, color: proj.color });
        return;
      }
      if (tgt.kind === 'barricada' && tgt.ref) {
        tgt.ref.hp -= dmg; tgt.ref.hitT = 0.15;
        if (this.rng() < 0.3) this.sound('hit');
      } else if (tgt.kind === 'muralla') this.damageWall(dmg, e);
      else this.damageCastle(dmg, { source: e, ignoreWall: true });
    }

    _updateBoss(e, dt) {
      const def = e.def;
      const phases = def.phases || [];
      const frac = e.hp / e.maxHp;
      while (e.phase + 1 < phases.length && frac <= phases[e.phase + 1].at) {
        e.phase++;
        const ph = phases[e.phase];
        this.emit('bossPhase', { boss: e, phase: e.phase, name: ph.name });
        this.fx.banner(ph.name || ('Fase ' + (e.phase + 1)), { color: def.color || '#ff5a4a', dur: 1.8 });
        this.fx.flash('rgba(255,255,255,0.5)', 0.25);
        this.fx.shake(14, 0.6);
        this.sound('roar');
        if (ph.onEnter) { try { ph.onEnter(this, e); } catch (err) { console.error('[fase ' + e.type + ']', err); } }
      }
      if (e.status.freeze || e.status.stun || e.x < 40) return;
      const attacks = def.attacks || [];
      for (let i = 0; i < attacks.length; i++) {
        const a = attacks[i];
        if (a.phases && !a.phases.includes(e.phase)) continue;
        e.atkTimers[i] -= dt;
        if (e.atkTimers[i] <= 0) {
          e.atkTimers[i] = randRange(a.every, this.rng);
          try { a.cast(this, e); } catch (err) { console.error('[ataque ' + (a.id || i) + ' de ' + e.type + ']', err); }
          if (e.dead) return;
        }
      }
    }

    // ------------------------------------------------------------- consultas
    enemiesInRange(x, range, opts) {
      opts = opts || {};
      const mode = opts.air || 'both';
      const minR = opts.minRange || 0;
      const out = [];
      for (const e of this.enemies) {
        if (e.dead || (e.burrowed && !opts.burrowed) || !airOk(e, mode) || e.x < -30) continue;
        const d = x - e.x;
        if (d < -5 || d > range || d < minR) continue;
        out.push(e);
      }
      out.sort((a, b) => b.x - a.x);
      return out;
    }
    pickTarget(x, range, opts) {
      opts = opts || {};
      const list = this.enemiesInRange(x, range, opts);
      if (!list.length) return null;
      const pick = (filter) => list.find(filter) || null;
      switch (opts.prefer) {
        case 'strongest': return list.reduce((a, b) => (b.hp > a.hp ? b : a));
        case 'weakest': return list.reduce((a, b) => (b.hp < a.hp ? b : a));
        case 'air': return pick(e => e.air) || list[0];
        case 'healer': return pick(e => e.def.healer || e.type === 'chaman') || pick(e => e.range > 0) || list[0];
        case 'ranged': return pick(e => e.range > 0) || list[0];
        case 'boss': return pick(e => e.boss) || list.reduce((a, b) => (b.maxHp > a.maxHp ? b : a));
        case 'random': return list[Math.floor(this.rng() * list.length)];
        default: return list[0];
      }
    }
    enemiesInRadius(x, y, r, opts) {
      opts = opts || {};
      const mode = opts.air || 'both';
      const out = [];
      for (const e of this.enemies) {
        if (e.dead || (e.burrowed && !opts.burrowed) || !airOk(e, mode)) continue;
        const bp = this.bodyPoint(e);
        const dx = bp.x - x, dy = (bp.y - y) * 0.6;
        const rr = r + e.radius * (e.scale || 1);
        if (dx * dx + dy * dy <= rr * rr) out.push(e);
      }
      return out;
    }
    frontEnemy(opts) { return this.pickTarget(W.CASTLE_X, 99999, Object.assign({ prefer: 'front' }, opts || {})); }
    densestPoint(range, radius, opts) {
      opts = opts || {};
      const list = this.enemiesInRange(W.CASTLE_X, range || 1300, opts);
      if (!list.length) return null;
      let best = null;
      for (const c of list) {
        const p = this.bodyPoint(c);
        const n = this.enemiesInRadius(p.x, p.y, radius || 120, opts).length;
        if (!best || n > best.count || (n === best.count && c.x > best.x)) best = { x: p.x, y: c.air ? c.y : W.GROUND - 20, count: n, ground: !c.air };
      }
      return best;
    }

    // ------------------------------------------------------------- daño
    damage(e, amount, info) {
      info = info || {};
      if (!e || e.dead || !(amount > 0)) return 0;
      if (e.burrowed && !info.burrowed && info.source !== 'trap') return 0;
      const type = info.type || 'physical';
      let dmg = amount;
      const res = (e.resist && e.resist[type]) || 0;
      dmg *= 1 - Math.min(0.95, res);
      if (type === 'physical') {
        let armor = e.armor || 0;
        if (e.status.armorBreak) armor -= e.status.armorBreak.power || 0;
        if (e.buff && e.buff.armor) armor += e.buff.armor;
        dmg *= 1 - U.clamp(armor, -0.5, 0.9);
      }
      if (e.status.curse) dmg *= 1 + (e.status.curse.power || 0.3);
      let crit = info.crit;
      if (crit == null) crit = info.critChance > 0 && this.rng() < info.critChance;
      if (crit) dmg *= info.critMul || 2;
      if (e.def.onDamage) {
        try {
          const r = e.def.onDamage(this, e, dmg, Object.assign({}, info, { type, crit }));
          if (typeof r === 'number' && !isNaN(r)) dmg = r;
        } catch (err) { console.error('[onDamage ' + e.type + ']', err); }
      }
      dmg = Math.max(0, dmg);
      if (dmg <= 0) return 0;
      e.hp -= dmg;
      e.hitFlash = 0.12;
      this.stats.dmgDealt += dmg;
      if (!info.noNumber && !this.headless) {
        const bp = this.bodyPoint(e);
        const kind = crit ? 'crit' : res <= -0.25 ? 'weak' : res >= 0.5 ? 'resist' : type;
        if (!info.dot || dmg >= 1) this.fx.number(bp.x, bp.y - e.size * 0.45 * (e.scale || 1), dmg, kind);
      }
      if (e.hp <= 0) this.kill(e, info.source);
      return dmg;
    }
    damageArea(x, y, r, amount, info) {
      info = info || {};
      const hits = this.enemiesInRadius(x, y, r, { air: info.air || 'both', burrowed: info.burrowed });
      for (const e of hits) this.damage(e, amount, info);
      return hits;
    }
    applyStatus(e, kind, o) {
      o = o || {};
      if (!e || e.dead) return false;
      if (e.immune && e.immune[kind]) {
        if (!this.headless && this.rng() < 0.25) this.fx.text(e.x, e.y - e.size, 'Inmune', { color: '#cfcfcf', size: 18, dur: 0.7 });
        return false;
      }
      let dur = o.duration || 2;
      if (e.boss && (kind === 'freeze' || kind === 'stun' || kind === 'root')) dur *= 0.4;
      const st = e.status;
      const cur = st[kind];
      switch (kind) {
        case 'slow': st.slow = { power: Math.max(cur ? cur.power : 0, o.power || 0.3), t: Math.max(cur ? cur.t : 0, dur) }; break;
        case 'freeze': case 'stun': st[kind] = { t: Math.max(cur ? cur.t : 0, dur) }; break;
        case 'root': if (e.air) return false; st.root = { t: Math.max(cur ? cur.t : 0, dur) }; break;
        case 'burn': st.burn = { dps: Math.max(cur ? cur.dps : 0, o.dps || 5), t: Math.max(cur ? cur.t : 0, dur) }; break;
        case 'poison': {
          const stacks = Math.min(o.maxStacks || 5, (cur ? cur.stacks : 0) + (o.stacks || 1));
          st.poison = { dps: Math.max(cur ? cur.dps : 0, o.dps || 4), stacks, t: dur };
          break;
        }
        case 'curse': st.curse = { power: Math.max(cur ? cur.power : 0, o.power || 0.3), t: Math.max(cur ? cur.t : 0, dur) }; break;
        case 'armorBreak': st.armorBreak = { power: Math.max(cur ? cur.power : 0, o.power || 0.2), t: Math.max(cur ? cur.t : 0, dur) }; break;
        default: st[kind] = Object.assign({}, o, { t: dur });
      }
      if (kind === 'freeze' || kind === 'stun' || kind === 'root') e.atkTimer = Math.max(e.atkTimer, 0.3);
      return true;
    }
    knockback(e, dist) {
      if (!e || e.dead || e.boss || (e.immune && e.immune.knockback) || !(dist > 0)) return false;
      e.kbLeft += dist;
      e.reached = false;
      return true;
    }
    healEnemy(e, amount) {
      if (!e || e.dead || !(amount > 0)) return 0;
      let a = amount;
      if (e.status.poison) a *= 0.5;
      const before = e.hp;
      e.hp = Math.min(e.maxHp, e.hp + a);
      const h = e.hp - before;
      if (h >= 1 && !this.headless) { const bp = this.bodyPoint(e); this.fx.number(bp.x, bp.y - e.size * 0.5, h, 'heal'); }
      return h;
    }
    buffEnemy(e, o) {
      if (!e || e.dead) return;
      e.buff = { speed: o.speed || 0, armor: o.armor || 0, dmg: o.dmg || 0, atk: o.atk || 0, t: o.duration || 2 };
    }
    kill(e, source) {
      if (!e || e.dead) return;
      e.hp = 0; e.dead = true; e.state = 'dying'; e.dying = 0;
      const g = Math.max(1, Math.round(e.gold * this.goldMul));
      this.gold += g;
      this.stats.kills++;
      this.stats.killsByType[e.type] = (this.stats.killsByType[e.type] || 0) + 1;
      const bp = this.bodyPoint(e);
      this.fx.coins(bp.x, bp.y, e.boss ? 6 : Math.min(4, 1 + (g > 20 ? 2 : 0) + (e.elite ? 1 : 0)));
      this.sound(e.def.deathSound || (e.boss ? 'die_big' : 'die_orc'));
      if (this.rng() < 0.5) this.sound('coin');
      if (e.def.onDeath) { try { e.def.onDeath(this, e); } catch (err) { console.error('[onDeath ' + e.type + ']', err); } }
      if (e.boss) {
        this.bossDefeated = e;
        if (this.boss === e) this.boss = null;
        this.fx.explosion(bp.x, bp.y, 160, {});
        this.fx.flash('rgba(255,255,255,0.7)', 0.35);
        this.fx.shake(18, 0.8);
        this.emit('bossDefeated', { boss: e });
      }
      this.emit('kill', { enemy: e, source });
    }

    // ------------------------------------------------------------- proyectiles
    spawnProjectile(spec) {
      const from = spec.from || { x: W.CASTLE_X, y: W.GROUND - 100 };
      const p = {
        kind: spec.kind || 'arrow', team: spec.team || 'player', x: from.x, y: from.y, sx: from.x, sy: from.y,
        target: spec.to && spec.to.def ? spec.to : null, tx: 0, ty: 0,
        speed: spec.speed || 900, arc: spec.arc || 0, homing: !!spec.homing, onHit: spec.onHit, source: spec.source || null,
        color: spec.color, size: spec.size, draw: spec.draw, wave: !!spec.wave, hitSet: null,
        age: 0, prog: 0, angle: 0, done: false, data: spec.data || {},
      };
      if (p.target) { const bp = this.bodyPoint(p.target); p.tx = bp.x; p.ty = bp.y; }
      else { p.tx = spec.to ? spec.to.x : from.x - 300; p.ty = spec.to ? spec.to.y : from.y; }
      p.total = Math.max(1, Math.hypot(p.tx - p.x, p.ty - p.y));
      p.angle = Math.atan2(p.ty - p.y, p.tx - p.x);
      if (p.wave) p.hitSet = new Set();
      this.projectiles.push(p);
      return p;
    }
    _updateProjectiles(dt) {
      for (const p of this.projectiles) {
        if (p.done) continue;
        p.age += dt;
        if (p.team === 'player' && p.target) {
          if (!p.target.dead) { const bp = this.bodyPoint(p.target); p.tx = bp.x; p.ty = bp.y; }
          else if (!p.homing) p.lost = true;
        }
        const dx = p.tx - p.x, dy = p.ty - p.y;
        const d = Math.hypot(dx, dy);
        const step = p.speed * dt;
        const prevX = p.x, prevY = p.y;
        if (p.wave) {
          // Onda por el suelo: golpea una vez a cada terrestre que toca
          p.x += Math.sign(dx || -1) * step;
          for (const e of this.enemies) {
            if (e.dead || e.air || e.burrowed || p.hitSet.has(e.id)) continue;
            if (Math.abs(e.x - p.x) < 30 + e.radius) { p.hitSet.add(e.id); this._applyHit(p.onHit, e, 1, this.bodyPoint(e)); }
          }
          if (Math.abs(p.x - p.tx) <= step + 1) p.done = true;
          continue;
        }
        if (d <= step || p.age > 6) {
          p.x = p.tx; p.y = p.ty; p.done = true;
          this._impact(p);
          continue;
        }
        p.x += dx / d * step; p.y += dy / d * step;
        const traveled = Math.hypot(p.x - p.sx, p.y - p.sy);
        p.total = Math.max(p.total, traveled + d - step);
        p.prog = U.clamp(traveled / p.total, 0, 1);
        p.lift = p.arc ? p.arc * 4 * p.prog * (1 - p.prog) : 0;
        p.angle = Math.atan2(p.y - prevY - (p.arc ? p.arc * 4 * (1 - 2 * p.prog) * (step / p.total) : 0), p.x - prevX);
      }
      if (this.projectiles.some(p => p.done)) this.projectiles = this.projectiles.filter(p => !p.done);
    }
    _impact(p) {
      if (p.team === 'enemy') {
        const h = p.onHit;
        if (typeof h === 'function') { try { h(this, p, null); } catch (err) { console.error('[proyectil enemigo]', err); } }
        else if (h && h.damage) this.damageCastle(h.damage, { source: 'projectile', ignoreWall: !!h.ignoreWall });
        this.fx.particles(p.x, p.y, { n: 6, color: ['#c9b38a', '#8a6a44'], speed: 120, life: 0.4, size: 4 });
        return;
      }
      const h = p.onHit;
      const target = p.target && !p.target.dead && !p.lost ? p.target : null;
      if (typeof h === 'function') { try { h(this, p, target); } catch (err) { console.error('[proyectil]', err); } return; }
      if (!h) return;
      if (h.radius > 0) { this._applyHit(h, target, 1, { x: p.x, y: p.y }); return; }
      if (!target) return;
      this._applyHit(h, target, 1, { x: p.x, y: p.y });
      if (h.pierce > 0) {
        const mode = h.air || 'both';
        const extra = this.enemies.filter(e => e !== target && !e.dead && !e.burrowed && airOk(e, mode) && e.x < target.x && e.x > target.x - 380)
          .sort((a, b) => b.x - a.x).slice(0, h.pierce);
        for (const e of extra) this._applyHit(h, e, 0.75, this.bodyPoint(e));
        if (extra.length && !this.headless) { const last = extra[extra.length - 1]; const lp = this.bodyPoint(last); this.fx.beam(p.x, p.y, lp.x, lp.y, { color: '#ffffff', width: 3, dur: 0.15 }); }
      }
    }

    // ------------------------------------------------------------- toque
    tap(x, y) {
      if (this.over || this.paused || this.tapState.cd > 0) return false;
      this.tapState.cd = this.tapState.cooldown;
      x = U.clamp(x, -20, W.WALL_X - 10);
      y = U.clamp(y, 120, W.GROUND + 10);
      // Ayuda a apuntar: si hay un enemigo cerca del toque, va a por él
      let best = null, bd = 85;
      for (const e of this.enemies) {
        if (e.dead || e.burrowed) continue;
        const bp = this.bodyPoint(e);
        const d = Math.hypot(bp.x - x, (bp.y - y) * 0.8);
        if (d < bd) { bd = d; best = e; }
      }
      const dmg = this.tapState.damage;
      const to = best || { x, y };
      this.spawnProjectile({
        kind: 'bolt', from: W.TAP_ORIGIN, to, speed: 1700, team: 'player', source: 'tap',
        onHit: (B, p, target) => {
          const hits = B.damageArea(p.x, p.y, 34, dmg, { type: 'physical', source: 'tap', air: 'both', critChance: 0.08, critMul: 2 });
          if (!hits.length && target) B.damage(target, dmg, { type: 'physical', source: 'tap' });
          B.fx.particles(p.x, p.y, { n: 6, color: ['#fff2c4', '#ffd36b'], speed: 160, life: 0.25, size: 3, add: true });
        },
      });
      this.stats.taps++;
      this.sound('tap');
      return true;
    }

    // ------------------------------------------------------------- final
    _checkEnd(dt) {
      if (this.over) return;
      const allSpawned = this.spawnIdx >= this.spawns.length;
      if (allSpawned && this.enemies.length === 0) {
        if (this.victoryT < 0) this.victoryT = 0;
        this.victoryT += dt;
        if (this.victoryT > 1.2) this._finish(true);
      } else this.victoryT = -1;
    }
    _finish(victory) {
      if (this.over) return;
      this.over = true;
      this.overT = 0;
      const c = this.castle;
      this.result = {
        victory, level: this.level, castleHpFrac: Math.max(0, c.hp / c.maxHp), kills: this.stats.kills,
        killsByType: this.stats.killsByType, gold: this.gold, timeSec: this.t, abilities: this.stats.abilities,
        taps: this.stats.taps, wallIntact: !this.stats.wallBroken, castleDamage: this.stats.castleDamage,
        bossKilled: this.bossDefeated ? this.bossDefeated.type : null,
        progress: this.totalSpawns ? Math.min(1, (this.stats.kills) / this.totalSpawns) : 0,
      };
      if (victory) { this.sound('victory'); this.fx.banner('¡VICTORIA!', { color: '#ffcf3d', dur: 2.5 }); }
      else {
        this.sound('defeat');
        this.fx.banner('¡EL CASTILLO HA CAÍDO!', { color: '#ff5a4a', dur: 2.5 });
        this.fx.explosion(W.CASTLE_X + 120, W.GROUND - 160, 150, {});
        this.fx.shake(20, 1);
      }
      this.emit(victory ? 'victory' : 'defeat', this.result);
    }
    _postOver(dt) {
      this.overT += dt;
      for (const c of this.corpses) c.dying += dt;
      this.corpses = this.corpses.filter(c => c.dying < 1.1);
      if (!this.result.victory) for (const e of this.enemies) { e.age += dt; e.state = 'attack'; }
      if (this.overT > 3) this._endDone = true;
    }
  }

  BB.Battle = Battle;
  BB.Battle.STEP = STEP;

  // ---------------------------------------------------------------- pruebas
  BB.test = {
    makeSave(o) {
      o = o || {};
      const s = JSON.parse(JSON.stringify(BB.save.defaults()));
      if (typeof BB.ensureSaveDefaults === 'function') { try { BB.ensureSaveDefaults(s); } catch (err) { /* nada */ } }
      const heroes = o.heroes || ['arquera', 'mago_fuego', 'maga_hielo'];
      s.lineup = heroes.slice(0, 10);
      while (s.lineup.length < 10) s.lineup.push(null);
      for (const id of heroes) {
        if (!id) continue;
        s.heroes[id] = Object.assign(s.heroes[id] || { talents: {}, points: 0 }, { owned: true, level: o.heroLevel || 1 });
        if (o.talents && o.talents[id]) s.heroes[id].talents = o.talents[id];
      }
      if (o.castle) Object.assign(s.castle, o.castle);
      if (o.slots != null) s.castle.huecos = o.slots;
      if (o.traps) {
        s.traps = o.traps.slice(0, 4);
        for (const id of o.traps) if (id) s.towers[id] = { owned: true, level: o.towerLevel || 1 };
      }
      s.settings.autoSkills = o.autoSkills !== false;
      return s;
    },
    simulate(n, o) {
      o = o || {};
      const save = o.save || BB.test.makeSave(o);
      const b = new BB.Battle({ level: n, save, headless: true, seed: o.seed != null ? o.seed : 12345, autoSkills: o.autoSkills !== false });
      const maxT = o.seconds || 900;
      let err = null;
      try {
        while (!b.over && b.t < maxT) b.step(STEP);
      } catch (e) { err = e; }
      const c = b.castle;
      return {
        level: n, over: b.over, victory: !!(b.result && b.result.victory), t: Math.round(b.t * 10) / 10,
        castleHpFrac: Math.round(c.hp / c.maxHp * 100) / 100, wallHp: Math.round(c.wallHp), kills: b.stats.kills,
        spawns: b.totalSpawns, enemiesLeft: b.enemies.length, gold: b.gold, dmgDealt: Math.round(b.stats.dmgDealt),
        error: err ? (err.stack || String(err)) : null, battle: o.keep ? b : undefined,
      };
    },
  };
})();
