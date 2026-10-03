/* Bastión Bravo · estrellas, recompensas de nivel, logros y recompensa diaria.
   BB.starsFor(frac) · BB.rewards.victory/defeat · BB.data.achievements · BB.achievementsApi · BB.daily */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  BB.data = BB.data || {};

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);
  function levelGold(n) {
    const b = BB.balance;
    return b && typeof b.levelGold === 'function' ? b.levelGold(n) : Math.round(50 + 20 * n + 0.9 * n * n);
  }
  const isBoss = n => (n | 0) % 10 === 0;
  function firstGems(n) {
    if (BB.levels && BB.levels.firstGems) return BB.levels.firstGems(n);
    const z = Math.floor((n - 1) / 10);
    return isBoss(n) ? 20 + 5 * z : 3 + Math.floor(z / 2);
  }
  function starGems(n, prev, stars) {
    if (BB.levels && BB.levels.starGems) return BB.levels.starGems(n, prev, stars);
    const t = [0, 0, 1, 3];
    let g = 0;
    for (let s = Math.max(1, prev + 1); s <= Math.min(3, stars); s++) g += t[s];
    return g * (isBoss(n) ? 2 : 1);
  }
  function save() { return (BB.save && BB.save.data) || {}; }
  // Bonificación de oro del Tesoro (fracción: 0,10 = +10 %). La batalla ya la aplica al oro de los enemigos;
  // aquí se aplica solo al oro fijo del nivel.
  function goldBonus(s) {
    try { if (typeof BB.castleStats === 'function') return Math.max(0, num((BB.castleStats(s || save()) || {}).goldBonus)); } catch (err) { /* nada */ }
    return 0;
  }

  // ---------------------------------------------------------------- estrellas
  BB.starsFor = function (castleHpFrac) {
    const f = Number(castleHpFrac) || 0;
    return f >= 0.8 ? 3 : f >= 0.45 ? 2 : 1;
  };

  // ---------------------------------------------------------------- recompensas de nivel
  BB.rewards = {
    // Victoria: oro fijo del nivel (×0,6 si se repite) + oro de los enemigos (killGold); gemas por primera
    // victoria (más en jefes) y por cada estrella nueva (sobre todo la 3.ª). `gold` YA INCLUYE killGold.
    victory(n, o) {
      o = o || {};
      n = clamp(n | 0 || 1, 1, 100);
      const stars = clamp(o.stars | 0 || 1, 1, 3);
      const prevStars = clamp(o.prevStars | 0, 0, 3);
      const firstClear = o.firstClear != null ? !!o.firstClear : prevStars === 0;
      const replay = o.replay != null ? !!o.replay : !firstClear;
      const killGold = Math.max(0, Math.floor(num(o.killGold)));
      const bonus = goldBonus();
      let levelPart = levelGold(n) * (replay ? ((BB.balance && BB.balance.replayGoldMul) || 0.6) : 1);
      levelPart = Math.round(levelPart * (1 + bonus));
      const fg = firstClear ? firstGems(n) : 0;
      const sg = starGems(n, prevStars, stars);
      return {
        gold: levelPart + killGold,
        gems: fg + sg,
        levelGold: levelPart,
        killGold,
        firstGems: fg,
        starGems: sg,
        newStars: Math.max(0, stars - prevStars),
      };
    },
    // Derrota: te quedas con parte del oro de los enemigos y un pequeño premio de consolación según el avance
    defeat(n, o) {
      o = o || {};
      n = clamp(n | 0 || 1, 1, 100);
      const killGold = Math.max(0, Math.floor(num(o.killGold)));
      const progress = clamp(num(o.progress), 0, 1);
      const consolation = Math.round(levelGold(n) * 0.12 * progress);
      return { gold: Math.round(killGold * 0.6) + consolation, gems: 0, killGold, consolation };
    },
    // Para el panel del mapa
    preview(n, s) {
      s = s || save();
      const st = (s.levels && s.levels[n]) || {};
      const cleared = (st.clears || 0) > 0 || (st.stars || 0) > 0;
      const bonus = goldBonus(s);
      const base = levelGold(n);
      return {
        cleared,
        stars: st.stars || 0,
        gold: Math.round(base * (1 + bonus)),
        replayGold: Math.round(base * ((BB.balance && BB.balance.replayGoldMul) || 0.6) * (1 + bonus)),
        firstGems: cleared ? 0 : firstGems(n),
        starGemsLeft: starGems(n, st.stars || 0, 3),
      };
    },
    firstGems,
    starGems,
  };

  // ---------------------------------------------------------------- logros
  const ENEMY_NAMES = {
    goblin_veloz: 'Goblins Saltarines', orco_escudo: 'Orcos Escuderos', goblin_bombardero: 'Goblins Petardo',
    goblin_planeador: 'Goblins Planeadores', jinete_lobo: 'Jinetes de Lobo', chaman: 'Chamanes Curanderos',
    goblin_arquero: 'Goblins Arqueros', orco_berserker: 'Orcos Berserkers', orco_tambor: 'Orcos Tamborileros',
    goblin_topo: 'Goblins Topo', troll: 'Trolls del Musgo', orco_ariete: 'Arietes de Guerra',
  };
  const BOSSES = [
    ['rey_goblin', 10, '¡Abajo el rey!', 'Rey Grikko, el Rey Goblin', 15],
    ['chaman_gigante', 20, 'Sin magia negra', "Mog'Rath, el Gran Chamán", 20],
    ['troll_piedra', 30, 'Picapedrero', 'Gorrumbo, el Troll de Piedra', 25],
    ['escorpion', 40, 'Aguijón roto', 'Khazrak, el Jinete del Escorpión', 30],
    ['senor_fuego', 50, 'Apagafuegos', 'Ignarok, Señor del Magma', 35],
    ['senor_guerra', 60, 'Fin de la guerra', 'Thargrim, Señor de la Guerra', 40],
    ['gigante_escarcha', 70, 'Deshielo', 'Hrimgor, el Ogro de Escarcha', 45],
    ['nigromante', 80, 'Descanse en paz', 'Vorlath, el Nigromante', 50],
    ['golem', 90, 'Chatarra', 'el Gran Gólem de Tuerca', 60],
    ['dragon', 100, 'Matadragones', 'Skarnoth, el Dragón de los Orcos', 100],
  ];

  const stat = (s, k) => num(s && s.stats && s.stats[k]);
  const killsOf = (s, id) => num(s && s.stats && s.stats.killsByType && s.stats.killsByType[id]);
  function totalStars(s) { let t = 0; for (const k in (s && s.levels) || {}) t += num(s.levels[k] && s.levels[k].stars); return t; }
  function countLevels(s, fn) { let t = 0; for (const k in (s && s.levels) || {}) if (s.levels[k] && fn(s.levels[k])) t++; return t; }
  function ownedHeroes(s) { let t = 0; for (const k in (s && s.heroes) || {}) if (s.heroes[k] && s.heroes[k].owned) t++; return t; }
  function maxHeroLevel(s) { let m = 0; for (const k in (s && s.heroes) || {}) if (s.heroes[k] && s.heroes[k].owned) m = Math.max(m, num(s.heroes[k].level)); return m; }
  function castleLevels(s) { let t = 0; for (const k in (s && s.castle) || {}) t += num(s.castle[k]); return t; }
  function slots(s) {
    try { if (typeof BB.castleStats === 'function') { const v = num((BB.castleStats(s) || {}).slots); if (v) return v; } } catch (err) { /* nada */ }
    return 3 + num(s && s.castle && s.castle.huecos);
  }
  function towersOwned(s) { let t = 0; for (const k in (s && s.towers) || {}) if (s.towers[k] && s.towers[k].owned) t++; return t; }
  function bossBeaten(s, id, lvl) {
    const L = s && s.levels && s.levels[lvl];
    return (L && (num(L.clears) > 0 || num(L.stars) > 0)) || num(s && s.stats && s.stats.bossKills && s.stats.bossKills[id]) > 0 ? 1 : 0;
  }

  const A = [];
  const add = (id, name, desc, icon, target, progress, reward, cat) => A.push({ id, name, desc, icon, target, progress, reward, cat });

  // Cazadores (uno por tipo de enemigo)
  [
    ['goblin_veloz', 'Cazagoblins', 300, 10], ['orco_escudo', 'Rompeescudos', 150, 10],
    ['goblin_bombardero', 'Artificiero', 100, 10], ['goblin_planeador', 'Defensa antiaérea', 120, 12],
    ['jinete_lobo', 'Domalobos', 100, 12], ['chaman', 'Sin curas para nadie', 60, 12],
    ['goblin_arquero', 'Duelo de puntería', 100, 12], ['orco_berserker', 'Calma la furia', 80, 15],
    ['orco_tambor', 'Silencio, tambores', 50, 15], ['goblin_topo', 'Cazatopos', 80, 15],
    ['troll', 'Matatrolls', 40, 20], ['orco_ariete', 'Leña al ariete', 30, 20],
  ].forEach(([id, name, target, gems]) => add('caza_' + id, name, 'Derrota a ' + target + ' ' + ENEMY_NAMES[id] + '.',
    'enemy_' + id, target, s => killsOf(s, id), { gems }, 'enemigos'));

  // Enemigos en total
  add('bajas_100', 'Primera sangre', 'Derrota a 100 enemigos.', 'sword', 100, s => stat(s, 'kills'), { gold: 300 }, 'enemigos');
  add('bajas_2000', 'Muro viviente', 'Derrota a 2.000 enemigos.', 'sword', 2000, s => stat(s, 'kills'), { gems: 20 }, 'enemigos');
  add('bajas_10000', 'Leyenda del bastión', 'Derrota a 10.000 enemigos.', 'sword', 10000, s => stat(s, 'kills'), { gems: 50 }, 'enemigos');

  // Jefes
  for (const [id, lvl, name, who, gems] of BOSSES) {
    add('jefe_' + id, name, 'Derrota a ' + who + ' (nivel ' + lvl + ').', 'boss_' + id, 1, s => bossBeaten(s, id, lvl), { gems }, 'jefes');
  }

  // Estrellas y victorias
  add('estrellas_30', 'Estrellado', 'Consigue 30 estrellas en el mapa.', 'star', 30, totalStars, { gems: 10 }, 'mapa');
  add('estrellas_100', 'Constelación', 'Consigue 100 estrellas en el mapa.', 'star', 100, totalStars, { gems: 25 }, 'mapa');
  add('estrellas_200', 'Firmamento', 'Consigue 200 estrellas en el mapa.', 'star', 200, totalStars, { gems: 50 }, 'mapa');
  add('estrellas_300', 'Perfección absoluta', 'Consigue las 300 estrellas.', 'star', 300, totalStars, { gems: 150 }, 'mapa');
  add('impecable_25', 'Impecable', 'Gana 25 niveles con 3 estrellas.', 'star', 25, s => countLevels(s, l => num(l.stars) >= 3), { gems: 20 }, 'mapa');
  add('perfecta', 'Defensa perfecta', 'Gana un nivel con el castillo al 100 %.', 'shield', 1, s => countLevels(s, l => num(l.best) >= 0.999), { gems: 10 }, 'mapa');
  add('muralla_1', 'Ni un rasguño', 'Gana un nivel sin que caiga la muralla.', 'shield', 1, s => stat(s, 'flawless'), { gems: 5 }, 'mapa');
  add('muralla_25', 'Muralla de acero', 'Gana 25 batallas sin que caiga la muralla.', 'shield', 25, s => stat(s, 'flawless'), { gems: 25 }, 'mapa');
  add('victorias_50', 'Incansable', 'Gana 50 batallas (las repeticiones cuentan).', 'trophy', 50, s => stat(s, 'levelsWon'), { gold: 2000 }, 'mapa');
  add('victorias_300', 'Guardián eterno', 'Gana 300 batallas.', 'trophy', 300, s => stat(s, 'levelsWon'), { gems: 40 }, 'mapa');
  add('zona_5', 'Explorador', 'Llega a la zona 5: Volcán Ardiente.', 'map', 41, s => num(s && s.maxLevel), { gems: 15 }, 'mapa');

  // Oro
  add('oro_10k', 'Bolsa llena', 'Gana 10.000 de oro en total.', 'gold', 10000, s => stat(s, 'goldEarned'), { gems: 10 }, 'economia');
  add('oro_250k', 'Cofre del tesoro', 'Gana 250.000 de oro en total.', 'gold', 250000, s => stat(s, 'goldEarned'), { gems: 25 }, 'economia');
  add('oro_5m', 'Montaña de oro', 'Gana 5.000.000 de oro en total.', 'gold', 5000000, s => stat(s, 'goldEarned'), { gems: 60 }, 'economia');

  // Héroes
  add('heroes_5', 'Reclutador', 'Ten 5 héroes en tu ejército.', 'hero_arquera', 5, ownedHeroes, { gems: 15 }, 'heroes');
  add('heroes_10', 'Gran compañía', 'Ten 10 héroes.', 'hero_arquera', 10, ownedHeroes, { gems: 30 }, 'heroes');
  add('heroes_20', 'Leyendas reunidas', 'Recluta a los 20 héroes.', 'hero_arquera', 20, ownedHeroes, { gems: 100 }, 'heroes');
  add('nivel_10', 'Entrenamiento', 'Sube un héroe a nivel 10.', 'up', 10, maxHeroLevel, { gold: 1000 }, 'heroes');
  add('nivel_30', 'Veterano', 'Sube un héroe a nivel 30.', 'up', 30, maxHeroLevel, { gems: 25 }, 'heroes');
  add('nivel_60', 'Maestro de armas', 'Sube un héroe a nivel 60.', 'up', 60, maxHeroLevel, { gems: 60 }, 'heroes');
  add('habilidades_50', 'Poder desatado', 'Lanza 50 habilidades especiales.', 'bolt', 50, s => stat(s, 'abilitiesCast'), { gems: 10 }, 'heroes');
  add('habilidades_1000', 'Archimago de guerra', 'Lanza 1.000 habilidades especiales.', 'bolt', 1000, s => stat(s, 'abilitiesCast'), { gems: 30 }, 'heroes');

  // Castillo, ballesta y torres
  add('castillo_10', 'Albañil', 'Compra 10 mejoras del castillo.', 'castle_2', 10, castleLevels, { gems: 10 }, 'castillo');
  add('castillo_50', 'Fortaleza imponente', 'Compra 50 mejoras del castillo.', 'castle_4', 50, castleLevels, { gems: 30 }, 'castillo');
  add('huecos_10', 'Casa llena', 'Abre los 10 huecos de héroe del castillo.', 'castle_5', 10, slots, { gems: 40 }, 'castillo');
  add('virotes_500', 'Dedo rápido', 'Dispara 500 virotes tocando el campo de batalla.', 'target', 500, s => stat(s, 'tapShots'), { gold: 800 }, 'castillo');
  add('virotes_10000', 'Ballestero del bastión', 'Dispara 10.000 virotes con la ballesta.', 'target', 10000, s => stat(s, 'tapShots'), { gems: 25 }, 'castillo');
  add('torres_3', 'Ingeniería defensiva', 'Consigue 3 torres o trampas.', 'tower_flechas', 3, towersOwned, { gems: 15 }, 'castillo');
  add('torres_6', 'Arsenal completo', 'Consigue las 6 torres y trampas.', 'tower_catapulta', 6, towersOwned, { gems: 40 }, 'castillo');

  // Constancia
  add('diaria_7', 'Fiel al bastión', 'Reclama la recompensa diaria 7 días seguidos.', 'calendar', 7, s => Math.max(num(s && s.daily && s.daily.streak), num(s && s.daily && s.daily.best)), { gems: 20 }, 'diaria');

  BB.data.achievements = A;

  BB.achievementsApi = {
    list(s) {
      s = s || save();
      const st = s.achievements || {};
      return A.map(def => {
        let raw = 0;
        try { raw = num(def.progress(s)); } catch (err) { raw = 0; }
        const claimed = !!(st[def.id] && st[def.id].claimed);
        return { def, id: def.id, value: Math.min(raw, def.target), raw, target: def.target, done: raw >= def.target, claimed };
      });
    },
    claimable(s) { return this.list(s).filter(a => a.done && !a.claimed).length; },
    claim(id) {
      const s = save();
      const def = A.find(a => a.id === id);
      if (!def) return null;
      let v = 0;
      try { v = num(def.progress(s)); } catch (err) { v = 0; }
      if (v < def.target) return null;
      s.achievements = s.achievements || {};
      const st = s.achievements[id] = s.achievements[id] || {};
      if (st.claimed) return null;
      st.claimed = true;
      st.at = Date.now();
      const reward = { gold: def.reward.gold || 0, gems: def.reward.gems || 0 };
      if (BB.econ && BB.econ.add) BB.econ.add(reward, 'logro');
      if (BB.save && BB.save.commit) BB.save.commit();
      return reward;
    },
  };

  // ---------------------------------------------------------------- recompensa diaria (ciclo de 7 días)
  const DAILY = [
    { day: 1, gold: 0.5 }, { day: 2, gems: 5 }, { day: 3, gold: 1 }, { day: 4, gems: 10 },
    { day: 5, gold: 1.6 }, { day: 6, gems: 15 }, { day: 7, gems: 50, gold: 2.5, big: true },
  ];
  function dayStr(now, offsetDays) {
    const d = now ? new Date(now instanceof Date ? now.getTime() : now) : new Date();
    if (offsetDays) d.setDate(d.getDate() + offsetDays);
    if (BB.util && BB.util.todayStr) return BB.util.todayStr(d);
    const p = v => String(v).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function dailyReward(day, s) {
    const d = DAILY[(day - 1) % 7];
    const ref = levelGold(clamp(num(s && s.maxLevel) || 1, 1, 100));   // el oro crece con tu progreso
    return { day: d.day, gold: d.gold ? Math.round(ref * d.gold / 10) * 10 : 0, gems: d.gems || 0, big: !!d.big };
  }
  BB.daily = {
    REWARDS: DAILY,
    // `now` es opcional (Date o milisegundos), para pruebas
    status(s, now) {
      s = s || save();
      const d = s.daily || {};
      const streak = num(d.streak);
      const today = dayStr(now), yest = dayStr(now, -1);
      let canClaim, day, run;
      if (streak > 0 && d.last && d.last >= today) { canClaim = false; day = ((streak - 1) % 7) + 1; run = streak; }
      else if (streak > 0 && d.last === yest) { canClaim = true; day = (streak % 7) + 1; run = streak; }
      else { canClaim = true; day = 1; run = 0; }
      const week = [];
      for (let k = 1; k <= 7; k++) week.push(dailyReward(k, s));
      const midnight = new Date(now ? new Date(now).getTime() : Date.now());
      midnight.setHours(24, 0, 0, 0);
      return { canClaim, day, reward: dailyReward(day, s), streak: run, week, nextIn: Math.max(0, midnight.getTime() - (now ? new Date(now).getTime() : Date.now())) };
    },
    claim(s, now) {
      s = s || save();
      const st = this.status(s, now);
      if (!st.canClaim) return null;
      const d = s.daily = s.daily || {};
      d.streak = num(d.streak) > 0 && d.last === dayStr(now, -1) ? num(d.streak) + 1 : 1;
      d.last = dayStr(now);
      d.best = Math.max(num(d.best), d.streak);
      d.total = num(d.total) + 1;
      const reward = st.reward;
      if (BB.econ && BB.econ.add) BB.econ.add({ gold: reward.gold, gems: reward.gems }, 'diaria');
      if (BB.save && BB.save.commit) BB.save.commit();
      return reward;
    },
  };
})();
