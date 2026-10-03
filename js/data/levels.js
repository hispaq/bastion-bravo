/* Bastión Bravo · los 100 niveles: generador DETERMINISTA de oleadas, jefes y recompensas.
   BB.levelDef(n) → { n, zone, zoneIndex, zoneName, kind, boss, bossAt, spawns:[{t,type,elite,wave,boss?}],
                      waves:[t0,t1,…], waveInfo:[{t,count,theme,label}], newEnemies:[ids], types:[ids],
                      total, elites, duration, rewards:{gold,gems,firstGems,starGems}, recommended }
   - Mismo nivel → misma partida (semilla por nivel con BB.util.mulberry32).
   - El jefe va DENTRO de spawns ({ type: idJefe, boss: true }) en el instante bossAt.
   - Dificultad: la vida/daño de cada enemigo la escala el motor (BB.balance.enemyHp/enemyDmg); aquí se decide
     cuántos y cuáles salen con un "presupuesto de presión" que crece suavemente. */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  BB.data = BB.data || {};

  const COUNT = 100;
  const ZONE_IDS = ['bosque', 'pantano', 'montanas', 'desierto', 'volcan', 'oscuras', 'hielo', 'ruinas', 'forja', 'dragon'];
  const ZONE_NAMES = ['Bosque Esmeralda', 'Pantano Brumoso', 'Picos Grises', 'Desierto de Ámbar', 'Volcán Ardiente',
    'Tierras Oscuras', 'Cumbres Heladas', 'Ruinas Malditas', 'Forja de Hierro', 'Nido del Dragón'];
  const BOSS_IDS = ['rey_goblin', 'chaman_gigante', 'troll_piedra', 'escorpion', 'senor_fuego', 'senor_guerra',
    'gigante_escarcha', 'nigromante', 'golem', 'dragon'];
  const BOSS_NAMES = {
    rey_goblin: ['Rey Grikko', 'El Rey Goblin'],
    chaman_gigante: ["Mog'Rath", 'El Gran Chamán'],
    troll_piedra: ['Gorrumbo', 'El Troll de Piedra'],
    escorpion: ['Khazrak', 'El Jinete del Escorpión'],
    senor_fuego: ['Ignarok', 'Señor del Magma'],
    senor_guerra: ['Thargrim', 'Señor de la Guerra'],
    gigante_escarcha: ['Hrimgor', 'El Ogro de Escarcha'],
    nigromante: ['Vorlath', 'El Nigromante'],
    golem: ['Gran Gólem de Tuerca', 'Máquina de Guerra Goblin'],
    dragon: ['Skarnoth', 'El Dragón de los Orcos'],
  };

  // Tabla 2.2. unlock = "Aparece en". hp/speed = valores orientativos (si BB.data.enemies los define, se usan
  // los reales acotados a ×0,5…×2). threat = peso extra en el presupuesto (vuela, explota, cura, dispara…).
  // w = frecuencia base; role = orden de salida en la oleada; group = tamaño de los grupos; feature = cuántos
  // salen como mínimo en la oleada de presentación.
  const E = {
    goblin_veloz:      { name: 'Goblin Saltarín',  unlock: 1,  hp: 30,  speed: 95,  threat: 1.00, w: 10,  role: 'swarm',   group: [2, 4], feature: 5 },
    orco_escudo:       { name: 'Orco Escudero',    unlock: 3,  hp: 90,  speed: 55,  threat: 1.25, w: 6,   role: 'tank',    group: [1, 2], feature: 3 },
    goblin_bombardero: { name: 'Goblin Petardo',   unlock: 5,  hp: 35,  speed: 105, threat: 2.00, w: 3,   role: 'siege',   group: [1, 2], feature: 4 },
    goblin_planeador:  { name: 'Goblin Planeador', unlock: 7,  hp: 40,  speed: 80,  threat: 1.60, w: 4,   role: 'air',     group: [1, 3], feature: 4 },
    jinete_lobo:       { name: 'Jinete de Lobo',   unlock: 12, hp: 80,  speed: 140, threat: 1.30, w: 4,   role: 'fast',    group: [1, 3], feature: 4 },
    chaman:            { name: 'Chamán Curandero', unlock: 15, hp: 70,  speed: 50,  threat: 1.80, w: 2,   role: 'support', group: [1, 1], feature: 2 },
    goblin_arquero:    { name: 'Goblin Arquero',   unlock: 18, hp: 45,  speed: 75,  threat: 1.50, w: 3.5, role: 'ranged',  group: [1, 3], feature: 4 },
    orco_berserker:    { name: 'Orco Berserker',   unlock: 23, hp: 130, speed: 60,  threat: 1.30, w: 4,   role: 'brute',   group: [1, 2], feature: 3 },
    orco_tambor:       { name: 'Orco Tamborilero', unlock: 27, hp: 120, speed: 50,  threat: 1.60, w: 1.6, role: 'support', group: [1, 1], feature: 2 },
    goblin_topo:       { name: 'Goblin Topo',      unlock: 32, hp: 55,  speed: 70,  threat: 1.60, w: 3,   role: 'burrow',  group: [1, 3], feature: 4 },
    troll:             { name: 'Troll del Musgo',  unlock: 36, hp: 450, speed: 32,  threat: 1.20, w: 1.2, role: 'giant',   group: [1, 1], feature: 2 },
    orco_ariete:       { name: 'Ariete de Guerra', unlock: 42, hp: 350, speed: 45,  threat: 1.40, w: 1.2, role: 'giant',   group: [1, 1], feature: 2 },
  };
  const ENEMY_IDS = Object.keys(E);
  const ROLE_ORDER = { giant: 0, tank: 1, brute: 2, swarm: 3, siege: 4, burrow: 4, air: 5, fast: 6, ranged: 7, support: 8 };
  const GAP_IN = { swarm: 0.45, air: 0.6, fast: 0.5, burrow: 0.6, siege: 0.7, ranged: 0.7, tank: 0.9, brute: 0.9, support: 1, giant: 1.6 };

  // Temas de oleada: multiplicadores de frecuencia. need = enemigo que debe existir ya (y no presentarse hoy).
  const THEMES = {
    mixto:     { label: 'Oleada mixta', mul: {} },
    descanso:  { label: 'Avanzadilla', mul: { goblin_veloz: 2.5, goblin_planeador: 1.2 }, others: 0.55 },
    enjambre:  { label: 'Enjambre goblin', from: 6, mul: { goblin_veloz: 3, goblin_bombardero: 1.6, goblin_planeador: 1.4, goblin_arquero: 1.4, goblin_topo: 1.6 }, others: 0.3 },
    muro:      { label: 'Muro de escudos', from: 8, need: 'orco_escudo', mul: { orco_escudo: 3.2, troll: 2.5, orco_berserker: 1.6, chaman: 1.8, orco_tambor: 2.2, orco_ariete: 1.2 }, others: 0.45 },
    cielo:     { label: 'Ataque aéreo', from: 9, need: 'goblin_planeador', mul: { goblin_planeador: 5, goblin_arquero: 1.3 }, others: 0.6 },
    asedio:    { label: 'Asedio', from: 9, need: 'goblin_bombardero', mul: { goblin_bombardero: 2.6, orco_ariete: 3, orco_escudo: 1.4, orco_tambor: 1.3 }, others: 0.6 },
    carga:     { label: 'Carga salvaje', from: 13, need: 'jinete_lobo', mul: { jinete_lobo: 4, orco_berserker: 2, goblin_veloz: 1.3 }, others: 0.5 },
    tiradores: { label: 'Lluvia de flechas', from: 19, need: 'goblin_arquero', mul: { goblin_arquero: 3.5, orco_escudo: 1.6, chaman: 1.5, orco_tambor: 1.3 }, others: 0.5 },
    emboscada: { label: 'Emboscada', from: 33, need: 'goblin_topo', mul: { goblin_topo: 4, goblin_arquero: 1.8, goblin_planeador: 1.4 }, others: 0.5 },
    gigantes:  { label: 'Pasos de gigante', from: 37, need: 'troll', mul: { troll: 4, orco_ariete: 2.5, chaman: 1.6, orco_tambor: 1.6 }, others: 0.4 },
    final:     { label: 'Gran oleada', mul: {}, flat: true },
  };
  const THEME_W = { mixto: 2, enjambre: 1, muro: 1.1, cielo: 1, asedio: 0.8, carga: 1, tiradores: 0.9, emboscada: 0.9, gigantes: 0.8 };

  // Escoltas preferidas de cada jefe (solo las ya desbloqueadas)
  const ESCORTS = {
    rey_goblin: ['goblin_veloz', 'orco_escudo', 'goblin_bombardero', 'goblin_planeador'],
    chaman_gigante: ['chaman', 'jinete_lobo', 'orco_escudo', 'goblin_arquero'],
    troll_piedra: ['orco_berserker', 'orco_escudo', 'orco_tambor', 'goblin_arquero'],
    escorpion: ['goblin_topo', 'goblin_arquero', 'goblin_bombardero', 'jinete_lobo'],
    senor_fuego: ['orco_ariete', 'goblin_bombardero', 'orco_berserker', 'orco_tambor'],
    senor_guerra: ['orco_escudo', 'orco_berserker', 'orco_tambor', 'orco_ariete'],
    gigante_escarcha: ['jinete_lobo', 'troll', 'goblin_planeador', 'chaman'],
    nigromante: ['chaman', 'goblin_planeador', 'goblin_arquero', 'orco_escudo'],
    golem: ['goblin_topo', 'goblin_bombardero', 'orco_ariete', 'goblin_arquero'],
    dragon: ['goblin_planeador', 'orco_berserker', 'troll', 'orco_tambor', 'jinete_lobo'],
  };

  // Ajustes de dificultad (se pueden retocar desde fuera: BB.levels.TUNE)
  const TUNE = {
    capacity: 55,       // "presión" por segundo que despacha un ejército del nivel recomendado
    growth: 0.01,       // dificultad extra por nivel, además de BB.balance.enemyHp
    pressure0: 0.30,    // fracción de esa capacidad que se exige en el nivel 1…
    pressure1: 0.76,    // …y al final
    pressureK: 22,      // rapidez de la subida
    support: 0.047,     // mejora del ejército sin contar el nivel de los héroes (huecos, torres, talentos)
    newMul: 0.92,       // los niveles que presentan enemigo son algo más suaves
    eliteFrom: 21,      // élites a partir de la zona 3
    elite0: 0.035, elite1: 0.25,
    eliteCost: 2.4 * 1.2,
    firstWave: 2,       // segundo en que empieza la primera oleada
    maxPerWave: 32,
    bossEscort: 0.55,   // las escoltas y la vanguardia del jefe son más ligeras (el jefe ya aprieta)
  };
  // Multiplicador por posición dentro de la zona (1 y 6 = descanso, 9 = reto antes del jefe)
  const POS_MUL = [1, 0.80, 0.93, 0.98, 1.02, 1.06, 0.84, 1.05, 1.10, 1.17, 1];
  const WAVE_RANGE = [[2, 3], [3, 4], [3, 4], [4, 4], [4, 5], [4, 5], [4, 5], [5, 6], [5, 6], [5, 6]];
  const STAR_GEMS = [0, 0, 1, 3];   // gemas por conseguir por primera vez la 2.ª y la 3.ª estrella (×2 en jefes)

  // ---------------------------------------------------------------- utilidades
  function hashFallback(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberryFallback(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeRng(n, salt) {
    const U = BB.util || {};
    const seed = (U.hashStr || hashFallback)('BastionBravo/nivel/' + n + '/' + (salt || 'base'));
    return (U.mulberry32 || mulberryFallback)(seed);
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const round2 = v => Math.round(v * 100) / 100;
  const randInt = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
  function pickWeighted(rng, items, weights) {
    let sum = 0;
    for (let i = 0; i < items.length; i++) if (weights[i] > 0) sum += weights[i];
    if (sum <= 0) return null;
    let r = rng() * sum;
    let lastOk = null;
    for (let i = 0; i < items.length; i++) {
      if (!(weights[i] > 0)) continue;
      lastOk = items[i];
      if (r < weights[i]) return items[i];
      r -= weights[i];
    }
    return lastOk;
  }

  const bal = () => BB.balance || {};
  function enemyHpMul(L) { const b = bal(); if (typeof b.enemyHp === 'function') return b.enemyHp(L); const x = Math.max(0, L - 1); return 1 + 0.15 * x + 0.0045 * x * x; }
  function heroDmgMul(h) { const b = bal(); if (typeof b.heroDmg === 'function') return b.heroDmg(h); const x = Math.max(0, h - 1); return 1 + 0.11 * x + 0.0022 * x * x; }
  function levelGold(L) { const b = bal(); if (typeof b.levelGold === 'function') return b.levelGold(L); return Math.round(50 + 20 * L + 0.9 * L * L); }
  const maxHeroLevel = () => bal().HERO_MAX_LEVEL || 100;

  // ---------------------------------------------------------------- consultas básicas
  const normN = n => clamp(Math.round(Number(n) || 1), 1, COUNT);
  const zoneIndexOf = n => clamp(Math.floor((normN(n) - 1) / 10), 0, 9);
  const posOf = n => ((normN(n) - 1) % 10) + 1;
  const isBoss = n => normN(n) % 10 === 0;
  const isRest = n => !isBoss(n) && (posOf(n) === 1 || posOf(n) === 6);
  const newEnemiesAt = n => ENEMY_IDS.filter(id => E[id].unlock === normN(n));
  const unlockedAt = n => ENEMY_IDS.filter(id => E[id].unlock <= normN(n));

  function realDef(id) { const d = BB.data && BB.data.enemies; return d && d[id] ? d[id] : null; }
  function hpOf(id) { const base = E[id].hp; const d = realDef(id); const v = d ? Number(d.hp) : 0; return v > 0 ? clamp(v, base * 0.5, base * 2) : base; }
  function speedOf(id) { const base = E[id].speed; const d = realDef(id); const v = d ? Number(d.speed) : 0; return v > 0 ? clamp(v, base * 0.5, base * 2) : base; }
  // Coste de un enemigo en "presión": vida × amenaza × rapidez (los lentos dan más tiempo para matarlos)
  function unitCost(id, elite) { return hpOf(id) * E[id].threat * Math.sqrt(speedOf(id) / 70) * (elite ? TUNE.eliteCost : 1); }

  const intensity = n => 1 + TUNE.growth * (n - 1);
  const pressure = n => TUNE.pressure0 + (TUNE.pressure1 - TUNE.pressure0) * (1 - Math.exp(-(n - 1) / TUNE.pressureK));
  function timing(n) { const f = (n - 1) / (COUNT - 1); return { window: 7 + f, gap: 11 - 6 * f }; }
  function eliteChance(n) {
    if (n < TUNE.eliteFrom) return 0;
    return TUNE.elite0 + (TUNE.elite1 - TUNE.elite0) * (n - TUNE.eliteFrom) / (COUNT - TUNE.eliteFrom);
  }
  function waveCount(n) {
    if (isBoss(n)) return 2;
    if (n <= 2) return 2;
    const z = zoneIndexOf(n), p = posOf(n);
    const [lo, hi] = WAVE_RANGE[z];
    if (isRest(n)) return Math.max(2, lo - (z >= 3 ? 1 : 0));
    return p >= 5 ? hi : lo;
  }
  function firstGems(n) {
    n = normN(n);
    const z = zoneIndexOf(n);
    if (isBoss(n)) return 20 + 5 * z;
    return 3 + Math.floor(z / 2) + (posOf(n) === 9 ? 1 : 0);
  }
  function starGemsFor(n, prevStars, stars) {
    let g = 0;
    for (let s = Math.max(1, (prevStars | 0) + 1); s <= Math.min(3, stars | 0); s++) g += STAR_GEMS[s] || 0;
    return g * (isBoss(n) ? 2 : 1);
  }
  // Nivel de héroe recomendado: el que iguala la vida de los enemigos con el daño esperado del ejército
  function recommended(n) {
    n = normN(n);
    let target = enemyHpMul(n) * intensity(n) / (1 + TUNE.support * (n - 1));
    target *= isBoss(n) ? 1.12 : Math.sqrt(POS_MUL[posOf(n)]);
    let h = 1;
    const max = maxHeroLevel();
    while (h < max && heroDmgMul(h) < target) h++;
    return h;
  }

  // ---------------------------------------------------------------- composición de oleadas
  function typeWeight(id, n, theme, opts) {
    const e = E[id];
    let w = e.w;
    const since = n - e.unlock;
    if (since >= 1 && since <= 8) w *= 1 + 1.2 * (1 - since / 9);            // lo recién llegado sale más
    if (id === 'goblin_veloz') w *= Math.max(0.35, 1 - (n - 1) / 110);        // el goblin básico va cediendo
    if (theme.flat) w = Math.sqrt(w) * 1.6;                                    // oleada final: más variada
    const m = theme.mul && theme.mul[id];
    w *= m != null ? m : (theme.others != null ? theme.others : 1);
    if (opts && opts.prefs) w *= opts.prefs.indexOf(id) >= 0 ? 2.6 : 0.55;
    return w;
  }
  function capFor(id, n) {
    const e = E[id], since = n - e.unlock;
    if (e.role === 'support') return 1 + Math.floor(since / 25);
    if (e.role === 'giant') return 1 + Math.floor(since / 22);
    if (id === 'goblin_bombardero') return 2 + Math.floor(n / 18);
    return 99;
  }

  // Llena una oleada hasta gastar `budget`. Devuelve { units:[{type,elite}], spent }.
  function fillWave(rng, n, pool, theme, budget, eChance, opts) {
    opts = opts || {};
    const units = [], counts = {};
    let spent = 0;
    const add = (id, elite) => { units.push({ type: id, elite: !!elite }); counts[id] = (counts[id] || 0) + 1; spent += unitCost(id, elite); };
    // Oleada de presentación: el nuevo enemigo protagoniza la oleada
    if (opts.feature) {
      const f = opts.feature;
      const want = Math.max(E[f].feature, Math.ceil(budget * 0.65 / unitCost(f, false)));
      const k = Math.min(want, E[f].feature + 6);
      for (let i = 0; i < k; i++) add(f, false);
    }
    // Siembra de variedad en la oleada final: uno de varios tipos distintos
    if (theme.flat && !opts.feature) {
      // barajado de Fisher-Yates (sort con comparador aleatorio NO es reproducible en V8)
      const mix = pool.slice();
      for (let i = mix.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const tmp = mix[i]; mix[i] = mix[j]; mix[j] = tmp; }
      const seedTypes = mix.slice(0, Math.min(pool.length, n >= 20 ? 4 : 3));
      for (const id of seedTypes) if (unitCost(id, false) <= budget * 0.45 && (counts[id] || 0) < capFor(id, n)) add(id, false);
    }
    let guard = 0;
    while (spent < budget * 0.96 && units.length < TUNE.maxPerWave && guard++ < 300) {
      const remaining = budget - spent;
      const weights = pool.map(id => {
        if (opts.feature && id === opts.feature) return 0;
        if ((counts[id] || 0) >= capFor(id, n)) return 0;
        if (units.length > 0 && unitCost(id, false) > remaining + budget * 0.18) return 0;
        return typeWeight(id, n, theme, opts);
      });
      const id = pickWeighted(rng, pool, weights);
      if (!id) break;
      const e = E[id];
      const size = randInt(rng, e.group[0], e.group[1]);
      for (let g = 0; g < size; g++) {
        if ((counts[id] || 0) >= capFor(id, n)) break;
        const elite = eChance > 0 && rng() < eChance;
        if (g > 0 && spent + unitCost(id, elite) > budget * 1.08) break;
        add(id, elite);
        if (units.length >= TUNE.maxPerWave) break;
      }
    }
    if (!units.length) add(pool[0], false);
    return { units, spent };
  }

  // Reparte una oleada en el tiempo: grupos del mismo tipo, del frente (tanques) a la retaguardia (apoyo)
  function schedule(rng, units, t0, window, waveIndex) {
    const groups = [];
    for (const u of units) {
      const last = groups[groups.length - 1];
      if (last && last.type === u.type && last.units.length < 4) last.units.push(u);
      else groups.push({ type: u.type, units: [u], key: 0 });
    }
    for (const g of groups) g.key = ROLE_ORDER[E[g.type].role] + rng() * 3.2;
    groups.sort((a, b) => a.key - b.key);
    const G = groups.length;
    const out = [];
    const step = G > 1 ? window / (G - 1) : 0;
    groups.forEach((g, k) => {
      let t = t0 + step * k + (k > 0 && k < G - 1 ? (rng() - 0.5) * step * 0.5 : 0);
      const gap = GAP_IN[E[g.type].role] || 0.7;
      for (const u of g.units) {
        out.push({ t: round2(Math.max(0, t)), type: u.type, elite: u.elite, wave: waveIndex });
        t += gap * (0.85 + rng() * 0.3);
      }
    });
    return out;
  }

  function chooseThemes(rng, n, W, featured) {
    const avail = Object.keys(THEME_W).filter(k => {
      const th = THEMES[k];
      if (th.from && n < th.from) return false;
      if (th.need && (E[th.need].unlock > n || E[th.need].unlock === n)) return false;
      return true;
    });
    const out = [];
    let prev = null;
    for (let i = 0; i < W; i++) {
      if (i === 0 && featured) { out.push('nuevo'); prev = 'nuevo'; continue; }
      if (i === W - 1 && W >= 2) { out.push('final'); continue; }
      if (isRest(n) && i === 0) { out.push('descanso'); prev = 'descanso'; continue; }
      if (n <= 6) { out.push('mixto'); prev = 'mixto'; continue; }
      const cand = avail.filter(k => k !== prev && out.indexOf(k) < 0);
      const list = cand.length ? cand : avail;
      const k = pickWeighted(rng, list, list.map(x => THEME_W[x])) || 'mixto';
      out.push(k); prev = k;
    }
    return out;
  }

  // Garantías de mezcla: aire y escudos para obligar a combinar héroes; élites a partir de la zona 3
  function ensureMix(rng, n, waves, featuredIdx) {
    const all = [];
    waves.forEach(w => w.units.forEach(u => all.push(u)));
    const has = id => all.some(u => u.type === id);
    const others = waves.map((w, i) => i).filter(i => i !== featuredIdx);
    const target = others.length ? others[Math.floor(rng() * others.length)] : waves.length - 1;
    if (n >= 9 && E.goblin_planeador.unlock <= n && !has('goblin_planeador')) {
      waves[target].units.push({ type: 'goblin_planeador', elite: false }, { type: 'goblin_planeador', elite: false });
    }
    if (n >= 8 && !has('orco_escudo')) waves[target].units.unshift({ type: 'orco_escudo', elite: false });
    if (n >= 26 && E.chaman.unlock <= n && !has('chaman') && !has('orco_tambor') && !isRest(n)) {
      waves[waves.length - 1].units.push({ type: 'chaman', elite: false });
    }
    if (n >= TUNE.eliteFrom && !all.some(u => u.elite)) {
      const fin = waves[waves.length - 1].units;
      let best = null;
      for (const u of fin) if (!best || hpOf(u.type) > hpOf(best.type)) best = u;
      if (best) best.elite = true;
    }
  }

  // ---------------------------------------------------------------- niveles normales
  function genNormal(n) {
    const rng = makeRng(n);
    const W = waveCount(n);
    const fresh = newEnemiesAt(n);
    const pool = unlockedAt(n);
    const tm = timing(n);
    const cycle = tm.window + tm.gap;
    const mul = POS_MUL[posOf(n)] * (fresh.length ? TUNE.newMul : 1);
    const total = TUNE.capacity * intensity(n) * pressure(n) * mul * cycle * W;
    const shares = [];
    let sum = 0;
    for (let i = 0; i < W; i++) { let s = 1 + 0.18 * i; if (i === W - 1) s *= 1.35; shares.push(s); sum += s; }
    const themes = chooseThemes(rng, n, W, fresh.length > 0);
    let eChance = eliteChance(n) * (isRest(n) ? 0.5 : posOf(n) === 9 ? 1.3 : 1);
    const waves = [];
    let left = total;
    for (let i = 0; i < W; i++) {
      const restShare = shares.slice(i).reduce((a, b) => a + b, 0);
      const budget = Math.max(total * 0.12, left * shares[i] / restShare);
      const themeKey = themes[i];
      const theme = THEMES[themeKey] || THEMES.mixto;
      const opts = themeKey === 'nuevo' ? { feature: fresh[0] } : null;
      const r = fillWave(rng, n, pool, themeKey === 'nuevo' ? THEMES.mixto : theme, budget, themeKey === 'nuevo' ? 0 : eChance, opts);
      left -= r.spent;
      waves.push({ theme: themeKey, label: themeKey === 'nuevo' ? '¡Nuevo enemigo!' : theme.label, units: r.units, spent: r.spent });
    }
    // Si hay un segundo enemigo nuevo en el mismo nivel (no ocurre con la tabla actual), que salga también
    for (let k = 1; k < fresh.length; k++) waves[Math.min(waves.length - 1, k)].units.push({ type: fresh[k], elite: false }, { type: fresh[k], elite: false });
    ensureMix(rng, n, waves, fresh.length ? 0 : -1);
    // Calendario
    const spawns = [], starts = [], info = [];
    let t = TUNE.firstWave;
    waves.forEach((w, i) => {
      const last = i === W - 1;
      const window = tm.window + (last ? 1.5 : 0) + (w.units.length > 14 ? 1 : 0);
      starts.push(round2(t));
      const list = schedule(rng, w.units, t, window, i);
      spawns.push.apply(spawns, list);
      info.push({ t: round2(t), count: w.units.length, theme: w.theme, label: last ? 'Oleada final' : w.label });
      t += window + (W >= 6 ? tm.gap * 0.8 : tm.gap);
    });
    return finish(n, { spawns, starts, info, boss: null, bossAt: null, fresh, budget: total });
  }

  // ---------------------------------------------------------------- niveles de jefe
  function genBoss(n) {
    const rng = makeRng(n, 'jefe');
    const z = zoneIndexOf(n);
    const boss = BOSS_IDS[z];
    const pool = unlockedAt(n);
    const prefs = (ESCORTS[boss] || []).filter(id => E[id] && E[id].unlock <= n);
    const tm = timing(n);
    const unit = TUNE.capacity * TUNE.bossEscort * intensity(n) * pressure(n) * (tm.window + tm.gap);
    const eChance = eliteChance(n);
    const spawns = [];
    // Oleada previa, corta
    const t0 = TUNE.firstWave;
    const preWin = tm.window * 0.85;
    const pre = fillWave(rng, n, pool, THEMES.mixto, unit * 0.75, eChance * 0.7, { prefs });
    spawns.push.apply(spawns, schedule(rng, pre.units, t0, preWin, 0));
    const bossAt = round2(t0 + preWin + Math.max(7, tm.gap * 0.9) + 1);
    // El jefe y sus escoltas (todas llegan pronto: al caer el jefe, el nivel termina enseguida)
    spawns.push({ t: bossAt, type: boss, elite: false, boss: true, wave: 1 });
    const groups = 2 + (z >= 3 ? 1 : 0) + (z >= 6 ? 1 : 0);
    let escorts = 0;
    for (let g = 0; g < groups; g++) {
      const tg = bossAt + 0.8 + g * 8;
      const r = fillWave(rng, n, pool, THEMES.mixto, unit * (0.3 + 0.015 * z), z >= 2 ? eChance * 1.3 : 0, { prefs });
      if (z >= 2 && g === groups - 1 && !r.units.some(u => u.elite)) r.units[0].elite = true;
      escorts += r.units.length;
      spawns.push.apply(spawns, schedule(rng, r.units, tg, 3.5, 1));
    }
    const info = [
      { t: t0, count: pre.units.length, theme: 'vanguardia', label: 'Vanguardia' },
      { t: bossAt, count: escorts + 1, theme: 'jefe', label: '¡' + (BOSS_NAMES[boss] ? BOSS_NAMES[boss][0] : 'Jefe') + '!' },
    ];
    return finish(n, { spawns, starts: [t0, bossAt], info, boss, bossAt, fresh: [], budget: unit * 2 });
  }

  function finish(n, o) {
    o.spawns.sort((a, b) => a.t - b.t || (a.boss ? -1 : b.boss ? 1 : 0));
    const z = zoneIndexOf(n);
    const zones = (BB.data && BB.data.zones) || [];
    const types = [];
    let elites = 0, total = 0, last = 0;
    for (const s of o.spawns) {
      if (s.boss) continue;
      total++;
      if (s.elite) elites++;
      if (types.indexOf(s.type) < 0) types.push(s.type);
      last = Math.max(last, s.t);
    }
    const kind = o.boss ? 'jefe' : o.fresh.length ? 'nuevo' : isRest(n) ? 'descanso' : posOf(n) === 9 ? 'reto' : 'normal';
    return {
      n,
      zone: ZONE_IDS[z],
      zoneIndex: z,
      zoneName: (zones[z] && zones[z].name) || ZONE_NAMES[z],
      kind,
      boss: o.boss,
      bossAt: o.bossAt,
      spawns: o.spawns,
      waves: o.starts,
      waveInfo: o.info,
      newEnemies: o.fresh.slice(),
      types,
      total,
      elites,
      duration: Math.round((o.boss ? Math.max(last, o.bossAt + 30) : last) + 14),
      budget: Math.round(o.budget),
      rewards: { gold: levelGold(n), gems: starGemsFor(n, 0, 3), firstGems: firstGems(n), starGems: STAR_GEMS.map(g => g * (isBoss(n) ? 2 : 1)) },
      recommended: recommended(n),
    };
  }

  function levelDef(n) {
    n = normN(n);
    return isBoss(n) ? genBoss(n) : genNormal(n);
  }

  BB.levelDef = levelDef;
  BB.levels = {
    count: COUNT,
    ENEMIES: E,
    THEMES,
    TUNE,
    STAR_GEMS,
    enemyIds: ENEMY_IDS,
    bossIds: BOSS_IDS,
    zoneIds: ZONE_IDS,
    zoneIndexOf,
    zoneOf(n) {
      const z = zoneIndexOf(n);
      const zones = (BB.data && BB.data.zones) || [];
      return zones[z] || { id: ZONE_IDS[z], index: z, num: z + 1, name: ZONE_NAMES[z], boss: BOSS_IDS[z], levels: [z * 10 + 1, z * 10 + 10] };
    },
    isBoss,
    isRest,
    posInZone: posOf,
    bossOf(n) { return isBoss(n) ? BOSS_IDS[zoneIndexOf(n)] : null; },
    bossLevel(id) { const i = BOSS_IDS.indexOf(id); return i >= 0 ? (i + 1) * 10 : 0; },
    unlockLevel(id) { return E[id] ? E[id].unlock : 0; },
    newEnemiesAt,
    unlockedAt,
    enemyName(id) {
      const d = realDef(id);
      if (d && d.name) return d.name;
      if (E[id]) return E[id].name;
      const b = BB.data && BB.data.bosses && BB.data.bosses[id];
      return (b && b.name) || (BOSS_NAMES[id] ? BOSS_NAMES[id][0] : id);
    },
    bossName(id) {
      const b = BB.data && BB.data.bosses && BB.data.bosses[id];
      return { name: (b && b.name) || (BOSS_NAMES[id] ? BOSS_NAMES[id][0] : id), title: (b && b.title) || (BOSS_NAMES[id] ? BOSS_NAMES[id][1] : '') };
    },
    firstGems,
    starGems: starGemsFor,
    recommended,
    eliteChance,
    unitCost,
  };
})();
