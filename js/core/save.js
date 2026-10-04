/* Bastión Bravo · guardado automático y economía */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const KEY = 'bastionbravo.v1';

  function defaults() {
    const now = Date.now();
    return {
      v: 1, created: now, lastSeen: now,
      gold: 60, gems: 10,
      maxLevel: 1,
      levels: {},
      heroes: {
        arquera: { owned: true, level: 1, talents: {}, points: 0 },
        mago_fuego: { owned: true, level: 1, talents: {}, points: 0 },
        maga_hielo: { owned: true, level: 1, talents: {}, points: 0 },
      },
      lineup: ['arquera', 'mago_fuego', 'maga_hielo', null, null, null, null, null, null, null],
      castle: { torreon: 0, muralla: 0, huecos: 0, ballesta: 0, tesoro: 0, reparacion: 0 },
      towers: {},
      troops: { arquero: { count: 2, level: 1 } },
      traps: [null, null, null, null],
      settings: { music: true, sfx: true, autoSkills: false, speed: 1, vibration: true, quality: 'alta' },
      daily: { last: '', streak: 0 },
      achievements: {},
      stats: {
        kills: 0, killsByType: {}, bossesKilled: 0, bossKills: {}, goldEarned: 0, gemsEarned: 0,
        levelsWon: 0, threeStars: 0, abilitiesCast: 0, tapShots: 0, playTime: 0, defeats: 0,
        flawless: 0, heroLevelUps: 0, castleUpgrades: 0,
      },
      seen: { enemies: {}, bosses: {} },
      tutorial: {},
    };
  }

  // Rellena lo que falte sin pisar lo existente
  function fill(target, def) {
    for (const k in def) {
      if (!(k in target) || target[k] === undefined) target[k] = def[k];
      else if (def[k] && typeof def[k] === 'object' && !Array.isArray(def[k]) &&
               target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) fill(target[k], def[k]);
    }
    return target;
  }

  let timer = null;
  function write() {
    timer = null;
    try {
      BB.save.data.lastSeen = Date.now();
      localStorage.setItem(KEY, JSON.stringify(BB.save.data));
    } catch (err) { /* sin almacenamiento: se juega igual, sin guardar */ }
  }

  BB.save = {
    KEY,
    data: defaults(),
    defaults,
    load() {
      let loaded = null;
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) loaded = JSON.parse(raw);
      } catch (err) { loaded = null; }
      const d = loaded && typeof loaded === 'object' ? fill(loaded, defaults()) : defaults();
      if (!Array.isArray(d.lineup)) d.lineup = defaults().lineup;
      while (d.lineup.length < 10) d.lineup.push(null);
      if (!Array.isArray(d.traps)) d.traps = [null, null, null, null];
      while (d.traps.length < 4) d.traps.push(null);
      BB.save.data = d;
      if (typeof BB.ensureSaveDefaults === 'function') {
        try { BB.ensureSaveDefaults(d); } catch (err) { console.error('ensureSaveDefaults', err); }
      }
      return d;
    },
    commit(immediate) {
      if (immediate) { if (timer) clearTimeout(timer); write(); return; }
      if (!timer) timer = setTimeout(write, 250);
    },
    flush() { if (timer) { clearTimeout(timer); write(); } },
    reset() {
      try { localStorage.removeItem(KEY); } catch (err) { /* nada */ }
      BB.save.data = defaults();
      if (typeof BB.ensureSaveDefaults === 'function') {
        try { BB.ensureSaveDefaults(BB.save.data); } catch (err) { console.error(err); }
      }
      write();
    },
  };

  BB.econ = {
    canAfford(cost) {
      const d = BB.save.data;
      if (!cost) return true;
      return (cost.gold || 0) <= d.gold && (cost.gems || 0) <= d.gems;
    },
    spend(cost) {
      if (!BB.econ.canAfford(cost)) return false;
      const d = BB.save.data;
      d.gold -= cost.gold || 0;
      d.gems -= cost.gems || 0;
      BB.save.commit();
      if (BB.ui && BB.ui.refreshTop) { try { BB.ui.refreshTop(); } catch (err) { /* nada */ } }
      return true;
    },
    add(reward, reason) {
      if (!reward) return;
      const d = BB.save.data;
      const g = Math.max(0, Math.floor(reward.gold || 0));
      const m = Math.max(0, Math.floor(reward.gems || 0));
      d.gold += g; d.gems += m;
      d.stats.goldEarned += g; d.stats.gemsEarned += m;
      BB.save.commit();
      if (BB.ui && BB.ui.refreshTop) { try { BB.ui.refreshTop(); } catch (err) { /* nada */ } }
    },
  };

  window.addEventListener('pagehide', () => BB.save.flush());
  document.addEventListener('visibilitychange', () => { if (document.hidden) BB.save.flush(); });
})();
