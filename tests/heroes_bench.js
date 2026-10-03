/* Banco de pruebas de héroes y mejoras (tests/heroes.html).
   Modos por URL:  ?mode=check  ·  ?mode=dps&lvl=20&tal=none|0|1|2|all  ·  ?mode=show&hero=id&lvl=20&tal=all&at=0.8
   En los modos automáticos el resultado se escribe en document.title (para Chrome headless --dump-dom). */
(function () {
  'use strict';
  const BB = window.BB;
  const q = new URLSearchParams(location.search);
  const MODE = q.get('mode') || '';
  for (const k in BB.SPRITES) if (!/^\.\.\//.test(BB.SPRITES[k].src)) BB.SPRITES[k].src = '../' + BB.SPRITES[k].src;

  // ---- captura de errores
  const errors = [];
  const origErr = console.error.bind(console);
  console.error = function () { errors.push(Array.prototype.map.call(arguments, a => (a && a.stack) || String(a)).join(' ')); origErr.apply(null, arguments); };
  window.addEventListener('error', ev => errors.push('window: ' + ev.message + ' @' + (ev.filename || '') + ':' + ev.lineno));

  // ---- enemigos de prueba (propios del banco; no tocan los datos de los demás)
  BB.data = BB.data || {};
  BB.data.enemies = BB.data.enemies || {};
  const E = BB.data.enemies;
  const dummy = (o) => Object.assign({ hp: 1e6, speed: 25, damage: 0.0001, atkInterval: 2, size: 66, radius: 18, gold: 0, anim: 'walk', armor: 0, resist: {}, immune: {} }, o);
  E.heroes_dummy = E.heroes_dummy || dummy({ id: 'heroes_dummy', name: 'Muñeco' });
  E.heroes_dummy_air = E.heroes_dummy_air || dummy({ id: 'heroes_dummy_air', name: 'Muñeco volador', air: true, anim: 'fly' });
  E.heroes_tank = E.heroes_tank || dummy({ id: 'heroes_tank', name: 'Muñeco grande', hp: 1e8, size: 100, radius: 30 });
  E.heroes_goblin = E.heroes_goblin || { id: 'heroes_goblin', name: 'Goblin', hp: 30, speed: 90, damage: 4, atkInterval: 1, size: 60, radius: 16, gold: 2, anim: 'hop' };
  E.heroes_orco = E.heroes_orco || { id: 'heroes_orco', name: 'Orco', hp: 95, speed: 55, damage: 9, atkInterval: 1.2, size: 88, radius: 22, gold: 4, armor: 0.2, anim: 'heavy' };
  E.heroes_volador = E.heroes_volador || { id: 'heroes_volador', name: 'Planeador', hp: 35, speed: 70, damage: 6, atkInterval: 1, size: 64, radius: 18, gold: 3, air: true, anim: 'fly' };
  const real = (id, fb) => (E[id] && id.indexOf('heroes_') !== 0 ? id : fb);

  function benchLevel(n) {
    if (typeof BB.levelDef === 'function') { try { const d = BB.levelDef(n); if (d && d.spawns && d.spawns.length) return d; } catch (err) { /* usa el propio */ } }
    const spawns = [];
    for (let i = 0; i < 70; i++) {
      const t = 1 + i * 0.75, r = (i * 7) % 10;
      spawns.push({ t, type: r < 5 ? real('goblin_veloz', 'heroes_goblin') : r < 8 ? real('orco_escudo', 'heroes_orco') : real('goblin_planeador', 'heroes_volador'), elite: i % 23 === 22 });
    }
    return { n, zone: 'bosque', spawns, waves: [0, 18, 36] };
  }

  // ---- partidas de prueba
  function presetTalents(id, preset) {
    const out = {};
    if (!preset || preset === 'none') return out;
    for (const n of BB.data.talents[id]) if (preset === 'all' || n.final || String(n.col) === String(preset)) out[n.id] = n.max;
    return out;
  }
  function makeSave(lineup, lvl, preset) {
    const talents = {};
    for (const id of lineup) if (id) talents[id] = presetTalents(id, preset);
    const s = BB.test.makeSave({ heroes: lineup, heroLevel: lvl, talents, slots: 7, autoSkills: true });
    s.maxLevel = 100;
    return s;
  }
  const EMPTY = { n: 1, zone: 'bosque', spawns: [], waves: [0] };

  function scenario(id, lvl, preset, kind, secs) {
    const save = makeSave([id], lvl, preset);
    BB.save.data = save;
    const B = new BB.Battle({ level: 1, levelDef: EMPTY, save, headless: true, seed: 7, autoSkills: true });
    if (kind === 'tanque') B.spawnEnemy('heroes_tank', { x: 820 });
    if (kind === 'horda') for (let i = 0; i < 12; i++) B.spawnEnemy('heroes_dummy', { x: 620 + i * 32 });
    if (kind === 'aire') for (let i = 0; i < 6; i++) B.spawnEnemy('heroes_dummy_air', { x: 650 + i * 60 });
    let casts = 0;
    B.on('heroCast', () => casts++);
    const steps = Math.round(secs * 60);
    for (let i = 0; i < steps && !B.over; i++) B.step(1 / 60);
    return { dps: B.stats.dmgDealt / secs, casts };
  }
  function dpsTable(lvl, preset, secs) {
    const rows = [];
    for (const id of BB.data.heroOrder) {
      const st = BB.heroStats(id, makeSave([id], lvl, preset));
      const t = scenario(id, lvl, preset, 'tanque', secs), h = scenario(id, lvl, preset, 'horda', secs), a = scenario(id, lvl, preset, 'aire', secs);
      rows.push({ id, rarity: BB.data.heroes[id].rarity, est: st.dps, power: st.power, tank: Math.round(t.dps), horde: Math.round(h.dps), air: Math.round(a.dps), casts: t.casts });
    }
    return rows;
  }

  // ---- comprobaciones de datos y API
  function check() {
    const out = [];
    const bad = (m) => out.push(m);
    const ids = BB.data.heroOrder;
    if (ids.length !== 20) bad('heroes ' + ids.length);
    const SND = 'tap arrow bolt fireball explosion ice freeze lightning cannon hit hit_heavy crit die_goblin die_orc die_big roar coin gem heal shield buff wall_hit castle_hit wall_break click open close upgrade unlock star victory defeat wave boss_intro ready cast poison wind hammer musket magic whoosh deny bomb burrow drum howl'.split(' ');
    const PROJ = 'arrow bolt fireball ice cannon bomb magic dart hammer potion rock feather holy bullet spear wind lightning beam'.split(' ');
    for (const id of ids) {
      const d = BB.data.heroes[id];
      ['name', 'title', 'role', 'desc', 'rarity', 'unlock', 'attack', 'ability', 'passive'].forEach(k => { if (!d[k]) bad(id + ' sin ' + k); });
      if (PROJ.indexOf(d.attack.projectile) < 0) bad(id + ' proyectil ' + d.attack.projectile);
      const tr = BB.data.talents[id];
      if (!tr || tr.length !== 10) bad(id + ' árbol ' + (tr && tr.length));
      const nids = {};
      for (const n of tr) { if (nids[n.id]) bad(id + ' nodo repetido ' + n.id); nids[n.id] = 1; for (const r of n.req) if (!tr.some(m => m.id === r)) bad(id + ' req ' + r); }
      // las variantes que lee cast() deben existir en el árbol
      const src = d.ability.cast.toString() + (d.passive.onHit.toString());
      for (const L of [1, 50, 100]) for (const p of ['none', 'all']) {
        const st = BB.heroStats(id, makeSave([id], L, p));
        if (!(st.attack.damage > 0) || !(st.attack.interval > 0) || !(st.abilityCooldown > 0) || !isFinite(st.power)) bad(id + ' stats L' + L + ' ' + p);
      }
    }
    // sonidos usados por los héroes
    const used = {};
    for (const id of ids) {
      const src = BB.data.heroes[id].ability.cast.toString();
      (src.match(/snd\(B, '([a-z_]+)'\)/g) || []).forEach(m => { used[m.slice(8, -2)] = 1; });
    }
    for (const s in used) if (SND.indexOf(s) < 0) bad('sonido desconocido ' + s);
    // lanzar cada habilidad con y sin enemigos, con todos los talentos
    for (const id of ids) {
      for (const p of ['none', 'all']) {
        const save = makeSave([id], 30, p);
        BB.save.data = save;
        const B = new BB.Battle({ level: 5, levelDef: EMPTY, save, headless: false, seed: 3, autoSkills: false });
        const h = B.heroes[0];
        if (!h) { bad(id + ' no desplegado'); continue; }
        const r0 = h.def.ability.cast(B, h);
        for (let i = 0; i < 10; i++) B.spawnEnemy(i % 3 ? 'heroes_goblin' : 'heroes_volador', { x: 500 + i * 60 });
        B.spawnEnemy('heroes_orco', { x: 900, elite: true });
        h.cd = 0;
        const ok = B.castAbility(0);
        for (let i = 0; i < 60 * 8; i++) B.step(1 / 60);
        if (r0 !== false && id !== 'sacerdote' && id !== 'bardo') bad(id + ' sin enemigos no devolvió false');
        if (!ok) bad(id + ' castAbility falló');
      }
    }
    // API de compra sobre un guardado nuevo
    const s = JSON.parse(JSON.stringify(BB.save.defaults()));
    BB.ensureSaveDefaults(s);
    BB.save.data = s;
    s.gold = 1e7; s.gems = 5000; s.maxLevel = 3;
    if (BB.heroes.canUnlock('halconera')) bad('halconera sin nivel');
    s.maxLevel = 100;
    if (!BB.heroes.unlock('halconera')) bad('unlock halconera');
    if (s.lineup[3] !== null && s.lineup.indexOf('halconera') < 0) bad('lineup');
    for (let i = 0; i < 9; i++) BB.heroes.levelUp('halconera');
    if (s.heroes.halconera.level !== 10 || BB.heroes.pointsLeft('halconera') !== 5) bad('levelUp/puntos ' + s.heroes.halconera.level + ' ' + BB.heroes.pointsLeft('halconera'));
    if (BB.heroes.canTalent('halconera', 'rapaces')) bad('talento sin requisitos');
    for (let i = 0; i < 3; i++) BB.heroes.talentUp('halconera', 'nido');
    if (!BB.heroes.talentUp('halconera', 'silbido')) bad('talentUp fila 2');
    if (BB.heroes.pointsLeft('halconera') !== 1) bad('puntos tras talentos');
    const g = s.gems;
    if (!BB.heroes.resetTalents('halconera') || s.gems !== g - 20 || BB.heroes.pointsLeft('halconera') !== 5) bad('reset');
    if (!BB.castle.upgrade('huecos') || BB.castleStats(s).slots !== 4) bad('huecos');
    for (let i = 0; i < 10; i++) BB.castle.upgrade('huecos');
    if (BB.castleStats(s).slots !== 10) bad('huecos max');
    if (!BB.towersApi.unlock('pinchos') || !BB.towersApi.unlock('brea') || !BB.towersApi.levelUp('pinchos')) bad('torres');
    BB.towersApi.place(2, 'pinchos');
    if (s.traps.filter(x => x === 'pinchos').length !== 1 || s.traps[2] !== 'pinchos') bad('place torre ' + JSON.stringify(s.traps));
    if (!(BB.armyPower(s) > 0)) bad('armyPower');
    const cs0 = BB.castleStats(BB.ensureSaveDefaults(JSON.parse(JSON.stringify(BB.save.defaults()))));
    return { problems: out, errors: errors.slice(0, 8), castle0: cs0, power0: BB.armyPower(BB.ensureSaveDefaults(JSON.parse(JSON.stringify(BB.save.defaults())))) };
  }

  // ---- escena para capturas: horda + lanzamiento de una habilidad
  let B = null;
  function show(id, lvl, preset, at) {
    const others = BB.data.heroOrder.filter(h => h !== id).slice(0, 3);
    const save = makeSave([id].concat(others), lvl, preset);
    BB.save.data = save;
    B = new BB.Battle({ level: 12, levelDef: EMPTY, save, headless: false, seed: 11, autoSkills: false });
    for (let i = 0; i < 16; i++) B.spawnEnemy(i % 4 === 3 ? 'heroes_volador' : i % 3 ? 'heroes_goblin' : 'heroes_orco', { x: 380 + i * 42 + (i % 2) * 15 });
    for (const e of B.enemies) e.hp = e.maxHp = 5000;
    for (let i = 0; i < 60; i++) B.step(1 / 60);
    B.heroes[0].cd = 0;
    B.castAbility(0);
    for (let i = 0; i < Math.round(at * 60); i++) B.step(1 / 60);
    BB.render.init(document.getElementById('c'));
    BB.render.draw(B, 0.016);
    return { enemies: B.enemies.length, proj: B.projectiles.length, dmg: Math.round(B.stats.dmgDealt) };
  }

  if (MODE) {
    document.body.className = 'auto';
    let res;
    try {
      if (MODE === 'check') res = check();
      else if (MODE === 'dps') res = dpsTable(+(q.get('lvl') || 20), q.get('tal') || 'none', +(q.get('secs') || 40));
      else if (MODE === 'show') res = show(q.get('hero') || 'arquera', +(q.get('lvl') || 20), q.get('tal') || 'all', +(q.get('at') || 0.8));
    } catch (err) { res = { crash: err.stack || String(err) }; }
    document.title = 'RESULT ' + JSON.stringify({ res, errors: errors.slice(0, 8) });
    // también como texto visible (las capturas headless sirven para leerlo)
    const pre = document.createElement('pre');
    pre.style.cssText = 'position:absolute;left:0;top:0;margin:0;padding:6px;font:13px/1.25 monospace;color:#fff;background:rgba(0,0,0,' + (MODE === 'show' ? '0.45' : '1') + ');white-space:pre-wrap;max-width:' + (MODE === 'show' ? '700px' : '100%') + ';z-index:9';
    let txt;
    if (MODE === 'dps' && Array.isArray(res)) {
      txt = 'héroe            rareza      est  poder  tanque  horda  aire  casts\n' + res.map(r =>
        (r.id + '                 ').slice(0, 17) + (r.rarity + '          ').slice(0, 11) + String(r.est).padStart(5) + String(r.power).padStart(7) +
        String(r.tank).padStart(8) + String(r.horde).padStart(7) + String(r.air).padStart(6) + String(r.casts).padStart(6)).join('\n');
    } else txt = JSON.stringify(res, null, 1);
    pre.textContent = txt + '\nERRORES: ' + (errors.length ? errors.slice(0, 8).join('\n') : 'ninguno');
    document.body.appendChild(pre);
    return;
  }

  // ---- modo interactivo
  const $ = (id) => document.getElementById(id);
  const log = (m) => { $('log').textContent = m + '\n' + $('log').textContent.slice(0, 3000); };
  const slotsEl = $('slots');
  const defaults = ['arquera', 'mago_fuego', 'maga_hielo', 'halconera', 'hechicera_rayo'];
  for (let i = 0; i < 10; i++) {
    const s = document.createElement('select');
    s.id = 'slot' + i;
    s.innerHTML = '<option value="">— hueco ' + (i + 1) + ' —</option>' + BB.data.heroOrder.map(id => '<option value="' + id + '">' + BB.data.heroes[id].fullName + '</option>').join('');
    s.value = defaults[i] || '';
    slotsEl.appendChild(s);
  }
  let speed = 1, last = 0;
  BB.render.init($('c'));
  function start() {
    const lineup = [];
    for (let i = 0; i < 10; i++) lineup.push($('slot' + i).value || null);
    const save = makeSave(lineup, +$('lvl').value, $('tal').value);
    BB.save.data = save;
    const n = +$('map').value;
    B = new BB.Battle({ level: n, levelDef: benchLevel(n), save, headless: false, autoSkills: false });
    B.setSpeed(speed);
    B.on('victory', () => log('VICTORIA en ' + Math.round(B.t) + ' s'));
    B.on('defeat', () => log('DERROTA en ' + Math.round(B.t) + ' s'));
    const ab = $('abil');
    ab.innerHTML = '';
    for (const h of B.heroes) {
      const b = document.createElement('button');
      b.className = 'ab';
      b.onclick = () => { h.cd = 0; B.castAbility(h.slot); log(h.def.name + ': ' + h.def.ability.name + ' · ' + BB.heroAbilityDetail(h.id, h.stats).join(' · ')); };
      b.textContent = (h.slot + 1) + '. ' + h.def.ability.name + ' (' + h.def.name + ')';
      ab.appendChild(b);
    }
    log('Batalla nivel ' + n + ' · poder del ejército ' + BB.armyPower(save) + ' · recomendado ' + BB.recommendedPower(n));
  }
  $('go').onclick = start;
  $('x2').onclick = () => { speed = speed === 1 ? 2 : 1; if (B) B.setSpeed(speed); };
  $('pause').onclick = () => { if (B) (B.paused ? B.resume() : B.pause()); };
  $('dps').onclick = () => {
    const rows = dpsTable(+$('lvl').value, $('tal').value, 30);
    $('dpsOut').innerHTML = '<table><tr><th>Héroe</th><th>est.</th><th>tanque</th><th>horda</th><th>aire</th></tr>' +
      rows.map(r => '<tr><td>' + BB.data.heroes[r.id].name + '</td><td>' + r.est + '</td><td>' + r.tank + '</td><td>' + r.horde + '</td><td>' + r.air + '</td></tr>').join('') + '</table>';
  };
  $('c').addEventListener('pointerdown', ev => {
    if (!B) return;
    const r = $('c').getBoundingClientRect();
    const w = BB.render.screenToWorld(ev.clientX - r.left, ev.clientY - r.top);
    B.tap(w.x, w.y);
  });
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (B) { B.update(dt); BB.render.draw(B, dt); }
  }
  requestAnimationFrame(frame);
  start();
})();
