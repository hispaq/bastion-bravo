/* Bastión Bravo · arranque, flujo entre pantallas, bucle de la batalla y entrada */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};

  let canvas = null;
  let battle = null;          // BB.Battle en curso
  let battleLevel = 0, battleReplay = false;
  let last = 0, running = false;
  let ended = false;
  let menuSeenThisSession = false;

  const has = (o, k) => o && typeof o[k] === 'function';
  function music(track) { if (has(BB.audio, 'music')) { try { BB.audio.music(track); } catch (err) { /* nada */ } } }
  function sfx(name) { if (has(BB.audio, 'sfx')) { try { BB.audio.sfx(name); } catch (err) { /* nada */ } } }
  function show(id, params) {
    if (has(BB.ui, 'show')) { try { BB.ui.show(id, params); return true; } catch (err) { console.error('[ui.show ' + id + ']', err); } }
    return false;
  }
  function hideScreens() {
    if (has(BB.ui, 'hideAll')) { try { BB.ui.hideAll(); return; } catch (err) { console.error(err); } }
    if (has(BB.ui, 'show')) { try { BB.ui.show(null); } catch (err) { /* nada */ } }
  }
  function setCanvasVisible(v) { if (canvas) canvas.style.visibility = v ? 'visible' : 'hidden'; }

  // ------------------------------------------------------------------ bucle
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = last ? (now - last) / 1000 : 0;
    last = now;
    if (dt > 0.1) dt = 0.1;
    tick(dt);
  }
  // ------------------------------------------------------------------ escena viva del menú
  // Una batalla de demostración (sin sonido, castillo invulnerable, sin guardar nada) detrás del menú
  let demo = null;
  function startDemo() {
    if (demo || battle || !BB.Battle) return;
    try {
      const save = JSON.parse(JSON.stringify(BB.save.data));
      save.settings.autoSkills = true;
      const top = Math.max(1, Math.min(100, save.maxLevel || 1));
      // un nivel normal de la zona actual (no jefe) con bastantes enemigos
      let n = Math.max(1, top - 1); if (n % 10 === 0) n--;
      n = Math.max(1, n);
      demo = new BB.Battle({ level: n, save, autoSkills: true, seed: (Math.random() * 1e9) | 0 });
      demo.sound = () => {};
      demo.isDemo = true;
      if (demo.fx) { demo.fx.banner = () => {}; demo.fx.text = () => {}; demo.fx.flash = () => {}; }
      BB.render.invalidate();
      setCanvasVisible(true);
    } catch (err) { console.error('[demo]', err); demo = null; }
  }
  function stopDemo() {
    if (!demo) return;
    demo = null;
    if (!battle) setCanvasVisible(false);
  }
  function tickDemo(dt) {
    if (!demo) return;
    try {
      demo.update(dt);
      const c = demo.castle;
      if (c) { c.hp = c.maxHp; if (c.wallMax) c.wallHp = Math.max(c.wallHp, c.wallMax * 0.5); }
      if (demo.over || demo.t > 150) { demo = null; startDemo(); return; }
      BB.render.draw(demo, dt);
    } catch (err) { console.error('[demo]', err); demo = null; }
  }

  function tick(dt) {
    if (!battle) tickDemo(dt);
    if (battle) {
      battle.update(dt);
      BB.render.draw(battle, battle.paused ? 0 : dt);
      if (has(BB.hud, 'frame')) { try { BB.hud.frame(dt, battle); } catch (err) { console.error('[hud]', err); } }
      if (!battle.paused) BB.save.data.stats.playTime += dt;
    }
    if (has(BB.ui, 'tick')) { try { BB.ui.tick(dt); } catch (err) { /* nada */ } }
  }

  // ------------------------------------------------------------------ batalla
  function startLevel(n, opts) {
    opts = opts || {};
    const d = BB.save.data;
    n = Math.max(1, Math.min(100, n | 0));
    if (n > d.maxLevel) { if (has(BB.ui, 'toast')) BB.ui.toast('Ese nivel aún está bloqueado'); return false; }
    const def = typeof BB.levelDef === 'function' ? BB.levelDef(n) : null;
    if (!def) { console.error('No hay definición del nivel', n); return false; }
    const replay = opts.replay != null ? !!opts.replay : !!(d.levels[n] && d.levels[n].clears > 0);
    const steps = [];
    const fresh = (def.newEnemies || []).filter(t => !(d.seen && d.seen.enemies && d.seen.enemies[t]));
    if (fresh.length && BB.ui && BB.ui.has && BB.ui.has('enemyIntro')) steps.push(done => show('enemyIntro', { types: fresh, onDone: done }) || done());
    else if (fresh.length) steps.push(done => show('enemyIntro', { types: fresh, onDone: done }) || done());
    if (def.boss && has(BB.bossIntro, 'play')) steps.push(done => { hideScreens(); try { BB.bossIntro.play(def.boss, done); } catch (err) { console.error(err); done(); } });
    const run = () => {
      if (!steps.length) return beginBattle(n, def, replay);
      const step = steps.shift();
      let called = false;
      step(() => { if (!called) { called = true; run(); } });
    };
    hideScreens();
    run();
    return true;
  }

  function beginBattle(n, def, replay) {
    stopDemo();
    endBattle(true);
    battle = new BB.Battle({ level: n, levelDef: def, save: BB.save.data });
    battleLevel = n; battleReplay = replay; ended = false;
    BB.render.invalidate();
    setCanvasVisible(true);
    hideScreens();
    if (has(BB.hud, 'attach')) { try { BB.hud.attach(battle); } catch (err) { console.error('[hud.attach]', err); } }
    music(def.boss ? 'jefe' : ((battle.zone && battle.zone.music) || (battle.zone && battle.zone.id) || 'bosque'));
    battle.on('victory', res => onBattleEnd(res));
    battle.on('defeat', res => onBattleEnd(res));
    battle.on('bossSpawn', () => music('jefe'));
    battle.on('wallBroken', () => vibrate(80));
    battle.on('castleHit', ev => { if (ev.amount > battle.castle.maxHp * 0.06) vibrate(30); });
    battle.fx.banner('Nivel ' + n, { sub: battle.zone ? battle.zone.name : '', color: '#ffe58a', dur: 1.8 });
  }

  function vibrate(ms) {
    const s = BB.save.data.settings;
    if (s && s.vibration && navigator.vibrate) { try { navigator.vibrate(ms); } catch (err) { /* nada */ } }
  }

  function endBattle(silent) {
    if (!battle) return;
    if (has(BB.hud, 'detach')) { try { BB.hud.detach(); } catch (err) { console.error(err); } }
    battle = null;
    if (!silent) setCanvasVisible(false);
  }

  function onBattleEnd(res) {
    if (ended) return;
    ended = true;
    const n = battleLevel;
    const d = BB.save.data;
    const st = d.stats;
    st.kills += res.kills || 0;
    for (const k in res.killsByType || {}) st.killsByType[k] = (st.killsByType[k] || 0) + res.killsByType[k];
    st.abilitiesCast += res.abilities || 0;
    st.tapShots += res.taps || 0;
    let rewards = { gold: 0, gems: 0 }, stars = 0, firstClear = false, prevStars = 0;
    if (res.victory) {
      stars = typeof BB.starsFor === 'function' ? BB.starsFor(res.castleHpFrac) : (res.castleHpFrac >= 0.8 ? 3 : res.castleHpFrac >= 0.45 ? 2 : 1);
      const prev = d.levels[n] || { stars: 0, clears: 0, best: 0 };
      prevStars = prev.stars || 0;
      firstClear = !prev.clears;
      try {
        rewards = has(BB.rewards, 'victory')
          ? BB.rewards.victory(n, { stars, prevStars, firstClear, replay: battleReplay && !firstClear, killGold: res.gold })
          : { gold: BB.balance.levelGold(n) + res.gold, gems: firstClear ? 2 : 0 };
      } catch (err) { console.error('[rewards]', err); rewards = { gold: BB.balance.levelGold(n) + res.gold, gems: 0 }; }
      d.levels[n] = { stars: Math.max(prevStars, stars), clears: (prev.clears || 0) + 1, best: Math.max(prev.best || 0, res.castleHpFrac) };
      if (n >= d.maxLevel && n < 100) d.maxLevel = n + 1;
      st.levelsWon++;
      st.threeStars = Object.values(d.levels).filter(l => l.stars >= 3).length;
      if (res.wallIntact) st.flawless++;
      if (res.bossKilled) { st.bossesKilled++; st.bossKills[res.bossKilled] = (st.bossKills[res.bossKilled] || 0) + 1; }
    } else {
      st.defeats++;
      try {
        rewards = has(BB.rewards, 'defeat') ? BB.rewards.defeat(n, { killGold: res.gold, progress: res.progress }) : { gold: Math.round(res.gold * 0.5), gems: 0 };
      } catch (err) { rewards = { gold: Math.round(res.gold * 0.5), gems: 0 }; }
    }
    rewards = { gold: Math.max(0, Math.floor(rewards.gold || 0)), gems: Math.max(0, Math.floor(rewards.gems || 0)) };
    BB.econ.add(rewards, res.victory ? 'victoria' : 'derrota');
    // logros completados (se reclaman en su pantalla)
    let achievements = [];
    if (has(BB.achievementsApi, 'list')) {
      try { achievements = BB.achievementsApi.list(d).filter(a => a.done && !a.claimed).map(a => (a.def && a.def.id) || a.id); } catch (err) { /* nada */ }
    }
    BB.save.commit(true);
    const payload = {
      victory: res.victory, level: n, stars, prevStars, rewards, firstClear, replay: battleReplay,
      stats: { kills: res.kills, timeSec: Math.round(res.timeSec), castleHpFrac: res.castleHpFrac },
      unlocked: [], achievements,
      onContinue: () => goMap(), onRetry: () => startLevel(n, { replay: true }), onNext: () => startLevel(Math.min(100, n + 1)),
      onUpgrade: () => { endBattle(); show('shop'); music('menu'); },
    };
    setTimeout(() => {
      music(res.victory ? 'victoria' : 'derrota');
      if (!show('result', payload)) goMap();
    }, 2300);
  }

  function goMap(params) {
    stopDemo();
    endBattle();
    if (!show('map', params || {})) show('menu');
    music('mapa');
  }
  function goMenu() {
    endBattle();
    startDemo();
    show('menu');
    music('menu');
    if (!menuSeenThisSession) {
      menuSeenThisSession = true;
      try {
        if (has(BB.daily, 'status') && BB.daily.status(BB.save.data).canClaim) setTimeout(() => show('daily'), 600);
      } catch (err) { /* nada */ }
    }
  }
  function pause() {
    if (!battle || battle.over || battle.paused) return;
    battle.pause();
    const ok = show('pause', {
      onResume: () => { if (battle) battle.resume(); hideScreens(); },
      onRestart: () => { const n = battleLevel; endBattle(true); startLevel(n, { replay: battleReplay }); },
      onQuit: () => goMap(),
    });
    if (!ok) battle.resume();
  }

  // ------------------------------------------------------------------ entrada
  function onPointer(ev) {
    if (!battle || battle.paused || battle.over) return;
    const r = canvas.getBoundingClientRect();
    const w = BB.render.screenToWorld(ev.clientX - r.left, ev.clientY - r.top);
    if (w.x > BB.WORLD.WALL_X + 10) return;          // tocar el castillo no dispara
    if (battle.tap(w.x, w.y)) BB.save.data.stats.tapShots += 0;
    battle.fx.ring(w.x, Math.min(w.y, BB.WORLD.GROUND), 16, { color: 'rgba(255,240,170,0.9)', dur: 0.25, width: 3 });
    ev.preventDefault();
  }
  function onKey(ev) {
    if (!battle) return;
    if (ev.key === 'Escape' || ev.key === 'p' || ev.key === 'P' || ev.key === ' ') { if (!battle.paused) pause(); ev.preventDefault(); return; }
    const map = { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6, '8': 7, '9': 8, '0': 9 };
    if (map[ev.key] != null && !battle.paused) battle.castAbility(map[ev.key]);
  }

  // ------------------------------------------------------------------ arranque
  function tryFullscreen() {
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!touch) return;
    const el = document.documentElement;
    try {
      const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : null;
      if (p && p.then) p.then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => {});
    } catch (err) { /* opcional */ }
  }

  function boot() {
    canvas = document.getElementById('battle');
    // Dentro del APK (Capacitor): pantalla completa sin barra de estado
    try {
      const cap = window.Capacitor;
      if (cap && cap.Plugins && cap.Plugins.StatusBar) cap.Plugins.StatusBar.hide().catch(() => {});
    } catch (err) { /* opcional */ }
    BB.save.load();
    BB.render.init(canvas);
    setCanvasVisible(false);
    canvas.addEventListener('pointerdown', onPointer);
    canvas.addEventListener('contextmenu', ev => ev.preventDefault());
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', () => { if (document.hidden && battle && !battle.over) pause(); });
    if (has(BB.ui, 'init')) { try { BB.ui.init(); } catch (err) { console.error('[ui.init]', err); } }
    const loading = BB.assets.loadAll(p => { if (has(BB.ui, 'setLoading')) BB.ui.setLoading(p); });
    const startGame = () => {
      if (has(BB.audio, 'init')) { try { BB.audio.init(); } catch (err) { /* nada */ } }
      tryFullscreen();
      goMenu();
    };
    if (!show('title', { loading, onStart: startGame })) loading.then(startGame);
    loading.then(() => { BB.render.invalidate(); if (has(BB.ui, 'onAssetsLoaded')) BB.ui.onAssetsLoaded(); });
    requestAnimationFrame(frame);
    // PWA: solo con http(s)
    if ('serviceWorker' in navigator && /^https?:/.test(location.protocol) && !/localhost|127\.0\.0\.1/.test(location.hostname + '') ) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  BB.app = {
    boot, startLevel, goMap, goMenu, pause, tick, startDemo, stopDemo,
    get demo() { return demo; },
    get battle() { return battle; },
    endBattle,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
