/* Bastión Bravo · pantallas: title, menu, shop, hero, army, result, settings, achievements, daily,
   enemyIntro (superposición) y pause (superposición). La pantalla "map" la registra js/ui/map.js. */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const UI = () => BB.ui;
  const el = (t, a, c) => BB.ui.el(t, a, c);
  const fmt = n => BB.ui.fmt(n);
  const icon = (n, c) => BB.ui.icon(n, c);
  const sfx = (n, o) => BB.ui.sfx(n, o);
  const S = () => (BB.save && BB.save.data) || null;
  const D = () => BB.data || {};
  const commit = () => { if (BB.save && BB.save.commit) BB.save.commit(); };
  const fn = (o, k) => o && typeof o[k] === 'function';

  // Llama a la primera función existente de la lista. → { found, value }
  function tryCall(obj, names, args) {
    if (!obj) return { found: false };
    for (const n of names) {
      if (typeof obj[n] === 'function') {
        try { return { found: true, value: obj[n].apply(obj, args) }; } catch (err) { console.error('[ui] ' + n, err); return { found: true, value: false, error: err }; }
      }
    }
    return { found: false };
  }
  const okResult = v => !(v === false || v === null || (v && typeof v === 'object' && v.ok === false));
  function failMsg(v, def) { return (v && typeof v === 'object' && (v.reason || v.msg || v.error)) || def; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function spend(cost) {
    if (BB.econ && BB.econ.spend) return BB.econ.spend(cost);
    const d = S();
    if (!d || (cost.gold || 0) > d.gold || (cost.gems || 0) > d.gems) return false;
    d.gold -= cost.gold || 0; d.gems -= cost.gems || 0; commit(); return true;
  }
  function list(objOrArr) { if (!objOrArr) return []; return Array.isArray(objOrArr) ? objOrArr : Object.keys(objOrArr).map(k => Object.assign({ id: k }, objOrArr[k])); }
  function pct(v) { return Math.round((v || 0) * 100) + '%'; }
  function num(v) { return v == null || isNaN(v) ? '—' : (Math.abs(v) < 10 && v % 1 ? (Math.round(v * 10) / 10).toString().replace('.', ',') : fmt(Math.round(v))); }
  function costOf(c) { if (!c) return null; if (typeof c === 'number') return { gold: c }; return { gold: c.gold || 0, gems: c.gems || 0 }; }

  // ================================================================== adaptadores (módulo de héroes y mejoras)
  const RAR_NAME = { comun: 'Común', rara: 'Rara', epica: 'Épica', legendaria: 'Legendaria' };
  const A = {
    heroes() { return list(D().heroes); },
    hero(id) { const h = D().heroes; return h ? (Array.isArray(h) ? h.find(x => x.id === id) : h[id]) : null; },
    hstate(id) { const d = S(); return (d && d.heroes && d.heroes[id]) || { owned: false, level: 0, talents: {}, points: 0 }; },
    maxLevel() { return (BB.balance && BB.balance.HERO_MAX_LEVEL) || 60; },
    heroStats(id, save) {
      save = save || S();
      if (fn(BB, 'heroStats')) { try { const st = BB.heroStats(id, save); if (st && st.attack) return st; } catch (err) { console.error(err); } }
      const def = A.hero(id) || {};
      const lv = (save.heroes[id] && save.heroes[id].level) || 1;
      const at = Object.assign({}, def.attack || {});
      if (at.damage && BB.balance) at.damage *= BB.balance.heroDmg(lv);
      return { attack: at, abilityCooldown: def.ability && def.ability.cooldown, abilityPower: 1 };
    },
    heroCost(id) {
      const r = tryCall(BB.heroes, ['levelCost', 'upgradeCost', 'nextLevelCost', 'costLevel'], [id, S()]);
      if (r.found && r.value) return costOf(r.value);
      const def = A.hero(id) || {};
      const lv = A.hstate(id).level || 1;
      return { gold: BB.balance ? BB.balance.heroLevelCost(lv, def.rarity) : 50 * lv };
    },
    heroUp(id) {
      const r = tryCall(BB.heroes, ['levelUp', 'upgrade', 'lvlUp'], [id, S()]);
      if (r.found) return r.value;
      const st = A.hstate(id);
      if (!st.owned || st.level >= A.maxLevel()) return false;
      if (!spend(A.heroCost(id))) return false;
      st.level++;
      const per = (BB.balance && BB.balance.LEVELS_PER_TALENT_POINT) || 2;
      if (st.level % per === 0) st.points = (st.points || 0) + 1;
      if (S().stats) S().stats.heroLevelUps = (S().stats.heroLevelUps || 0) + 1;
      commit();
      return true;
    },
    unlockReq(def) { const u = def.unlock || {}; return { cost: costOf({ gold: u.gold || 0, gems: u.gems || 0 }), level: u.level || 0 }; },
    heroUnlock(id) {
      if (fn(BB.heroes, 'unlockStatus')) { try { const s = BB.heroes.unlockStatus(id); if (s && !s.ok) return { ok: false, reason: s.reason }; } catch (err) { /* nada */ } }
      const r = tryCall(BB.heroes, ['unlock', 'buy', 'recruit'], [id, S()]);
      if (r.found) return r.value;
      const d = S(), def = A.hero(id);
      const rq = A.unlockReq(def);
      if (rq.level && d.maxLevel < rq.level) return { ok: false, reason: 'Llega al nivel ' + rq.level + ' del mapa' };
      if (!spend(rq.cost)) return false;
      d.heroes[id] = Object.assign({ talents: {}, points: 0 }, d.heroes[id] || {}, { owned: true, level: Math.max(1, (d.heroes[id] && d.heroes[id].level) || 1) });
      commit();
      return true;
    },
    talents(id) { const t = D().talents; return (t && t[id]) || []; },
    rank(id, nodeId) { const st = A.hstate(id); return (st.talents && st.talents[nodeId]) || 0; },
    canLearn(id, node) {
      const r = tryCall(BB.heroes, ['canTalent', 'canLearnTalent', 'canLearn'], [id, node.id, S()]);
      if (r.found) return !!(r.value && (r.value.ok !== false));
      const st = A.hstate(id);
      if (!st.owned || (st.points || 0) <= 0 || A.rank(id, node.id) >= (node.max || 1)) return false;
      return (node.req || []).every(q => A.rank(id, q) >= 1);
    },
    reqMet(id, node) { return (node.req || []).every(q => A.rank(id, q) >= 1); },
    whyNot(id, nodeId) {
      if (fn(BB.heroes, 'talentInfo')) { try { return BB.heroes.talentInfo(id, nodeId).reason || ''; } catch (err) { /* nada */ } }
      return null;
    },
    learn(id, nodeId) {
      const why = A.whyNot(id, nodeId);
      if (why) return { ok: false, reason: why };
      const r = tryCall(BB.heroes, ['talentUp', 'learnTalent', 'learn', 'addTalent'], [id, nodeId, S()]);
      if (r.found) return r.value;
      const node = A.talents(id).find(n => n.id === nodeId);
      if (!node || !A.canLearn(id, node)) return false;
      const st = A.hstate(id);
      st.talents = st.talents || {};
      st.talents[nodeId] = (st.talents[nodeId] || 0) + 1;
      st.points--;
      commit();
      return true;
    },
    resetCost(id) {
      const r = tryCall(BB.heroes, ['resetTalentsCost', 'resetCost'], [id, S()]);
      return r.found ? costOf(r.value) : null;
    },
    resetTalents(id) {
      const r = tryCall(BB.heroes, ['resetTalents', 'respec'], [id, S()]);
      if (r.found) return r.value;
      const st = A.hstate(id);
      let n = 0;
      for (const k in st.talents || {}) n += st.talents[k];
      st.talents = {};
      st.points = (st.points || 0) + n;
      commit();
      return true;
    },
    // castillo
    castleDefs() {
      const l = D().castleUpgrades;
      if (l && l.length) return list(l);
      return [['torreon', 'Torreón', 'Más vida para el castillo'], ['muralla', 'Muralla', 'Más vida y armadura para la muralla'],
        ['huecos', 'Huecos', 'Más huecos para héroes'], ['ballesta', 'Ballesta', 'Más daño al tocar el campo'],
        ['tesoro', 'Tesoro', 'Más oro en cada batalla'], ['reparacion', 'Reparación', 'El castillo se repara solo']]
        .map(x => ({ id: x[0], name: x[1], desc: x[2], max: x[0] === 'huecos' ? 7 : 30 }));
    },
    castleLvl(id) { const d = S(); return (d && d.castle && d.castle[id]) || 0; },
    castleCost(def) {
      const r = tryCall(BB.castle, ['cost', 'upgradeCost', 'nextCost'], [def.id, S()]);
      if (r.found && r.value) return costOf(r.value);
      const lv = A.castleLvl(def.id);
      if (typeof def.cost === 'function') { try { return costOf(def.cost(lv)); } catch (err) { /* nada */ } }
      return { gold: BB.balance ? BB.balance.castleCost(def.id, lv) : 100 };
    },
    castleUp(def) {
      const r = tryCall(BB.castle, ['upgrade', 'buy', 'levelUp'], [def.id, S()]);
      if (r.found) return r.value;
      const lv = A.castleLvl(def.id);
      if (lv >= (def.max || 30)) return false;
      if (!spend(A.castleCost(def))) return false;
      S().castle[def.id] = lv + 1;
      if (S().stats) S().stats.castleUpgrades = (S().stats.castleUpgrades || 0) + 1;
      commit();
      return true;
    },
    castleStats(save) {
      save = save || S();
      if (fn(BB, 'castleStats')) { try { return BB.castleStats(save) || {}; } catch (err) { console.error(err); } }
      return { slots: 3 + ((save.castle && save.castle.huecos) || 0), tier: 1 };
    },
    // torres
    towers() { return list(D().towers); },
    tower(id) { const t = D().towers; return t ? (Array.isArray(t) ? t.find(x => x.id === id) : t[id]) : null; },
    tstate(id) { const d = S(); return (d && d.towers && d.towers[id]) || { owned: false, level: 0 }; },
    towerMax() { return (BB.balance && BB.balance.TOWER_MAX_LEVEL) || 40; },
    towerCost(id) {
      const r = tryCall(BB.towersApi, ['levelCost', 'upgradeCost', 'cost', 'nextCost'], [id, S()]);
      if (r.found && r.value) return costOf(r.value);
      return { gold: BB.balance ? BB.balance.towerLevelCost(Math.max(1, A.tstate(id).level || 1)) : 100 };
    },
    towerUp(id) {
      const r = tryCall(BB.towersApi, ['upgrade', 'levelUp'], [id, S()]);
      if (r.found) return r.value;
      const st = A.tstate(id);
      if (!st.owned || st.level >= A.towerMax()) return false;
      if (!spend(A.towerCost(id))) return false;
      st.level++; commit(); return true;
    },
    towerUnlock(id) {
      const r = tryCall(BB.towersApi, ['unlock', 'buy'], [id, S()]);
      if (r.found) return r.value;
      const d = S(), def = A.tower(id);
      const rq = A.unlockReq(def);
      if (rq.level && d.maxLevel < rq.level) return { ok: false, reason: 'Llega al nivel ' + rq.level + ' del mapa' };
      if (!spend(rq.cost)) return false;
      d.towers[id] = { owned: true, level: 1 };
      commit(); return true;
    },
    towerStats(id, save) {
      save = save || S();
      if (fn(BB, 'towerStats')) { try { const s = BB.towerStats(id, save); if (s) return s; } catch (err) { console.error(err); } }
      const def = A.tower(id) || {};
      return { attack: def.attack, hp: def.block && def.block.hp };
    },
  };
  BB.uiAdapters = A;

  // Feedback común tras comprar/mejorar
  function afterAction(v, okText, failText) {
    if (okResult(v)) {
      sfx('upgrade');
      BB.ui.vibrate(15);
      if (okText) BB.ui.toast(okText, { type: 'good' });
      BB.ui.refreshTop();
      return true;
    }
    sfx('deny');
    BB.ui.toast(failMsg(v, failText || 'No se puede'), { type: 'bad' });
    return false;
  }

  // ================================================================== fondos
  function sceneSvg(night, noCastle) {
    const sky = night ? ['#1e1a45', '#4a3a78', '#c46a5a'] : ['#4fa9ec', '#8fd3f7', '#e9f7f2'];
    return '<svg class="bg-scene" viewBox="0 0 1600 720" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="bbsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + sky[0] + '"/><stop offset=".6" stop-color="' + sky[1] + '"/><stop offset="1" stop-color="' + sky[2] + '"/></linearGradient>' +
      '<radialGradient id="bbsun"><stop offset="0" stop-color="#fff8d0"/><stop offset=".35" stop-color="#ffe680"/><stop offset="1" stop-color="#ffe680" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="1600" height="720" fill="url(#bbsky)"/><circle cx="1240" cy="150" r="220" fill="url(#bbsun)"/>' +
      '<path d="M0 470 L120 330 L230 420 L380 250 L520 400 L640 300 L790 440 L900 340 L1040 430 L1180 280 L1320 410 L1450 320 L1600 420 V720 H0Z" fill="' + (night ? '#3b2f62' : '#8fa9c9') + '"/>' +
      '<path d="M380 250 L330 310 L360 300 L380 320 L400 300 L430 310Z M1180 280 L1140 330 L1170 320 L1190 335 L1215 318Z" fill="#fff" opacity=".85"/>' +
      '<path d="M0 520 C200 440 360 500 520 470 C700 430 820 520 1000 480 C1180 440 1350 500 1600 460 V720 H0Z" fill="' + (night ? '#2f5a3a' : '#6dbb45') + '"/>' +
      '<path d="M0 600 C250 540 500 610 800 570 C1100 530 1350 600 1600 560 V720 H0Z" fill="' + (night ? '#244a2e' : '#57a338') + '"/>' +
      '<g fill="' + (night ? '#1c3a22' : '#3f8a2a') + '"><circle cx="140" cy="560" r="38"/><circle cx="190" cy="575" r="30"/><circle cx="420" cy="585" r="34"/><circle cx="1500" cy="560" r="40"/><circle cx="1450" cy="580" r="28"/></g>' +
      (noCastle ? '' : '<g transform="translate(1040 300)" fill="#c2c6cd" stroke="#2b1708" stroke-width="7" stroke-linejoin="round">' +
      '<path d="M40 300 V110 H25 V70 H55 V85 H75 V70 H105 V110 H90 V150 H250 V110 H235 V70 H265 V85 H285 V70 H315 V110 H300 V300Z"/>' +
      '<path d="M140 300 V230 a30 30 0 0 1 60 0 V300Z" fill="#7a4a22"/><path d="M20 70 L65 10 L110 70Z M230 70 L275 0 L320 70Z" fill="#c8302a"/>' +
      '<path d="M170 150 V60 M170 60 L215 75 L170 90" fill="#ffd23f" stroke-width="5"/></g>') +
      '<g fill="#fff" opacity=".9"><ellipse cx="260" cy="120" rx="90" ry="30"/><ellipse cx="320" cy="100" rx="60" ry="34"/><ellipse cx="760" cy="170" rx="80" ry="24"/><ellipse cx="810" cy="155" rx="50" ry="28"/></g></svg>';
  }
  function background(o) {
    o = o || {};
    const wrap = el('div', { class: 'bg-wrap', style: { position: 'absolute', inset: '0', overflow: 'hidden', pointerEvents: 'none' } });
    const key = o.key || 'title_art';
    const url = BB.assets && BB.assets.url ? BB.assets.url(key) : null;
    if (url) {
      const img = el('img', { class: 'bg-img', src: url, alt: '' });
      img.onerror = () => { img.remove(); wrap.insertAdjacentHTML('afterbegin', sceneSvg(o.night, o.noCastle)); };
      wrap.appendChild(img);
    } else wrap.insertAdjacentHTML('afterbegin', sceneSvg(o.night, o.noCastle));
    if (o.clouds) for (let i = 0; i < 3; i++) {
      const c = el('div', { class: 'bg-cloud' });
      c.style.top = (6 + i * 9) + '%';
      c.style.animationDelay = (-i * 21) + 's';
      c.style.animationDuration = (55 + i * 12) + 's';
      wrap.appendChild(c);
    }
    wrap.appendChild(el('div', { class: 'bg-shade' }));
    return wrap;
  }
  function logo() {
    const lines = () => [el('span', { class: 'lg-l1', text: 'BASTIÓN' }), el('span', { class: 'lg-l2', text: 'BRAVO' })];
    return el('div', { class: 'logo', 'aria-label': 'Bastión Bravo' }, [
      el('span', { class: 'lg-back', 'aria-hidden': 'true' }, lines()),
      el('span', { class: 'lg-front' }, lines()),
    ]);
  }
  function screen(cls) { return el('div', { class: 'scr ' + cls }); }

  // ================================================================== TITLE
  (function () {
    const root = screen('scr-title bg-sky');
    let bar, txt, timer = null, params = {}, ready = false, started = false, shownAt = 0;
    function setLoading(p) {
      if (!bar) return;
      bar.style.transform = 'scaleX(' + p + ')';
      txt.textContent = 'Cargando… ' + Math.round(p * 100) + '%';
      if (p >= 1) setReady();
    }
    function setReady() {
      if (ready) return;
      ready = true;
      root.classList.add('is-ready');
    }
    function poll() {
      let p = BB.ui.loadFrac;
      if (p == null && BB.assets && fn(BB.assets, 'progress')) p = BB.assets.progress();
      if (p != null) setLoading(p);
      if (Date.now() - shownAt > 12000) setReady();
    }
    function start() {
      if (!ready || started) return;
      started = true;
      if (BB.audio && BB.audio.init) { try { BB.audio.init(); } catch (err) { /* nada */ } }
      sfx('click');
      if (typeof params.onStart === 'function') params.onStart();
      else if (BB.app && fn(BB.app, 'goMenu')) BB.app.goMenu();
      else BB.ui.show('menu');
    }
    root.addEventListener('click', start);
    BB.ui.register({
      id: 'title', el: root, setLoading,
      show(p) {
        params = p || {};
        started = false; ready = false; shownAt = Date.now();
        root.classList.remove('is-ready');
        root.innerHTML = '';
        root.appendChild(background({ clouds: true }));
        const lg = el('div', { class: 'title-logo' }, [logo(), el('div', { class: 'logo-sub', text: '¡Defiende el castillo de orcos y goblins!' })]);
        root.appendChild(lg);
        bar = el('div', { class: 'loadbar-fill' });
        txt = el('div', { class: 'loadbar-txt', text: 'Cargando…' });
        root.appendChild(el('div', { class: 'title-bottom' }, [el('div', { class: 'loadbar' }, [bar, txt]), el('div', { class: 'tap-start', text: 'Toca para empezar' })]));
        root.appendChild(el('div', { class: 'title-ver', text: 'v1.0 · Bastión Bravo' }));
        if (params.loading && params.loading.then) params.loading.then(() => setLoading(1));
        clearInterval(timer);
        timer = setInterval(poll, 120);
        poll();
      },
      hide() { clearInterval(timer); timer = null; },
    });
  })();

  // ================================================================== MENU
  function dailyCanClaim() {
    try { return !!(BB.daily && fn(BB.daily, 'status') && BB.daily.status(S()).canClaim); } catch (err) { return false; }
  }
  function achClaimable() { return achList().filter(a => a.done && !a.claimed).length; }
  function castleTier() { const st = A.castleStats(); return Math.max(1, Math.min(5, st.tier || 1)); }
  function goMap() {
    if (BB.app && fn(BB.app, 'goMap')) BB.app.goMap();
    else BB.ui.show('map');
  }
  (function () {
    const root = screen('scr-menu');
    BB.ui.register({
      id: 'menu', el: root, music: 'menu',
      show() {
        root.innerHTML = '';
        // escena viva: batalla de demostración dibujada en el lienzo, detrás del menú
        if (BB.app && fn(BB.app, 'startDemo')) BB.app.startDemo();
        const live = !!(BB.app && BB.app.demo);
        root.classList.toggle('is-live', live);
        if (live) root.appendChild(el('div', { class: 'menu-vignette' }));
        else root.appendChild(background({ clouds: true, key: 'bg_bosque', noCastle: true }));
        const gear = BB.ui.button(null, () => BB.ui.show('settings'), { kind: 'wood', round: true, icon: 'gear', title: 'Ajustes' });
        root.appendChild(BB.ui.topBar({ back: false, currencies: ['gold', 'gems', 'stars'], right: gear }));
        const lvl = (S().maxLevel || 1);
        const zn = zoneName(lvl);
        const hero = el('div', { class: 'menu-hero' }, [logo(),
          el('div', { class: 'menu-progress' }, [icon('flag'), el('span', { text: 'Nivel ' + lvl + (zn ? ' · ' + zn : '') })]),
          live ? null : el('div', { class: 'menu-castle' }, BB.ui.sprite('castle_' + castleTier()))]);
        const nAch = achClaimable();
        const daily = dailyCanClaim();
        const mk = (label, ic, kind, go, badge) => {
          const b = BB.ui.button(label, go, { kind, icon: ic });
          if (badge) b.appendChild(el('span', { class: 'badge-dot', text: String(badge) }));
          return b;
        };
        const btns = el('div', { class: 'menu-btns' }, [
          BB.ui.button('JUGAR', goMap, { icon: 'play', cls: 'btn-play', sound: 'open' }),
          el('div', { class: 'menu-grid' }, [
            mk('Ejército', 'helmet', 'blue', () => BB.ui.show('army')),
            mk('Tienda', 'shop', 'gold', () => BB.ui.show('shop')),
            mk('Logros', 'trophy', 'purple', () => BB.ui.show('achievements'), nAch || null),
            mk('Diaria', 'gift', 'red', () => BB.ui.show('daily'), daily ? '!' : null),
          ]),
        ]);
        root.appendChild(el('div', { class: 'menu-main' }, [hero, btns]));
      },
    });
  })();

  // ================================================================== SHOP
  function statRow(label, a, b) {
    const v = el('span', { class: 'stat-v' }, [String(a)]);
    if (b != null && String(b) !== String(a)) { v.appendChild(el('span', { class: 'arrow', text: '→' })); v.appendChild(el('span', { class: 'up', text: String(b) })); }
    return el('div', { class: 'stat' }, [el('span', { class: 'stat-k', text: label }), v]);
  }
  const CASTLE_FIELDS = {
    torreon: [['Vida', 'maxHp', num]], muralla: [['Vida muralla', 'wallHp', num], ['Armadura', 'wallArmor', pct]],
    huecos: [['Huecos', 'slots', num]], ballesta: [['Daño', 'tapDamage', num], ['Recarga', 'tapCooldown', v => num(v) + ' s']],
    tesoro: [['Oro extra', 'goldBonus', v => '+' + pct(v)]], reparacion: [['Reparación', 'regen', v => num(v) + '/s']],
  };
  const KIND_NAME = { tower: 'Torre', trap: 'Trampa', block: 'Bloqueo' };

  (function () {
    const root = screen('scr-shop bg-wood');
    let tab = 'castle';
    let panel, tabsEl;
    function cardBtn(cost, max, onBuy, label) {
      if (max) return BB.ui.button('MÁXIMO', null, { kind: 'gold', disabled: true });
      return BB.ui.button(label || 'Mejorar', onBuy, { cost, icon: 'up' });
    }
    function renderCastle(grid) {
      const save = S();
      for (const def of A.castleDefs()) {
        const lv = A.castleLvl(def.id);
        const max = lv >= (def.max || 30);
        const now = A.castleStats(save);
        const s2 = clone(save); s2.castle[def.id] = lv + 1;
        const nxt = max ? null : A.castleStats(s2);
        const stats = el('div', { class: 'stats' });
        const fields = CASTLE_FIELDS[def.id];
        if (fields && fn(BB, 'castleStats')) for (const f of fields) stats.appendChild(statRow(f[0], f[2](now[f[1]]), nxt ? f[2](nxt[f[1]]) : null));
        else if (typeof def.value === 'function') stats.appendChild(statRow('Valor', num(def.value(lv)), max ? null : num(def.value(lv + 1))));
        const cost = A.castleCost(def);
        grid.appendChild(el('div', { class: 'card' + (max ? ' is-max' : '') }, [
          el('div', { class: 'card-art' }, [el('span', { class: 'card-lvl' + (max ? ' is-max' : ''), text: 'Nv. ' + lv + '/' + (def.max || 30) }), icon(def.id, 'ico-xl')]),
          el('div', { class: 'card-name', text: def.name || def.id }),
          el('div', { class: 'card-desc', text: def.desc || '' }),
          stats,
          cardBtn(cost, max, () => { if (afterAction(A.castleUp(def), (def.name || 'Mejora') + ' nivel ' + (lv + 1))) render(); }),
        ]));
      }
    }
    function heroStatsRows(id, st, stNext) {
      const a = st.attack || {}, b = stNext ? stNext.attack || {} : null;
      const box = el('div', { class: 'stats' });
      box.appendChild(statRow('Daño', num(a.damage), b ? num(b.damage) : null));
      if (a.interval) box.appendChild(statRow('Cadencia', num(a.interval) + ' s', b && b.interval !== a.interval ? num(b.interval) + ' s' : null));
      return box;
    }
    function renderHeroes(grid) {
      const save = S();
      for (const def of A.heroes()) {
        const st = A.hstate(def.id);
        const card = el('div', { class: 'card hero-card-s rar-' + (def.rarity || 'comun') + (st.owned ? '' : ' is-locked') });
        const art = el('div', { class: 'card-art' }, [BB.ui.sprite(def.sprite || 'hero_' + def.id)]);
        card.appendChild(art);
        card.appendChild(el('div', { class: 'card-name', text: (def.name || def.id).split(',')[0] }));
        card.appendChild(el('div', { class: 'card-sub', text: def.role || def.title || '' }));
        if (st.owned) {
          const max = st.level >= A.maxLevel();
          art.appendChild(el('span', { class: 'card-lvl' + (max ? ' is-max' : ''), text: 'Nv. ' + st.level }));
          if ((st.points || 0) > 0) art.appendChild(el('span', { class: 'card-tag', text: st.points + ' pt', style: { background: '#2f8a1f' } }));
          const cur = A.heroStats(def.id, save);
          let nxt = null;
          if (!max) { const s2 = clone(save); s2.heroes[def.id].level++; nxt = A.heroStats(def.id, s2); }
          card.appendChild(heroStatsRows(def.id, cur, nxt));
          card.appendChild(el('div', { class: 'card-btns' }, [
            cardBtn(A.heroCost(def.id), max, () => { if (afterAction(A.heroUp(def.id), def.name.split(',')[0] + ' sube de nivel')) render(); }, 'Subir'),
            BB.ui.button(null, () => BB.ui.show('hero', { id: def.id }), { kind: 'blue', round: true, icon: 'book', title: 'Ficha y talentos' }),
          ]));
        } else {
          art.appendChild(icon('lock', 'lock-ico'));
          const rq = A.unlockReq(def);
          card.appendChild(el('div', { class: 'card-desc', text: def.desc || '' }));
          if (rq.level && save.maxLevel < rq.level) card.appendChild(BB.ui.button('Nivel ' + rq.level, null, { kind: 'gray', disabled: true, icon: 'lock' }));
          else card.appendChild(BB.ui.button('Reclutar', () => {
            if (afterAction(A.heroUnlock(def.id), '¡' + def.name.split(',')[0] + ' se une a tu ejército!')) { sfx('unlock'); render(); }
          }, { cost: rq.cost, kind: 'purple' }));
        }
        card.addEventListener('click', () => { BB.ui.show('hero', { id: def.id }); });
        grid.appendChild(card);
      }
    }
    function renderTowers(grid) {
      const save = S();
      for (const def of A.towers()) {
        const st = A.tstate(def.id);
        const card = el('div', { class: 'card' + (st.owned ? '' : ' is-locked') });
        const art = el('div', { class: 'card-art' }, [BB.ui.sprite(def.sprite || 'tower_' + def.id), el('span', { class: 'card-tag', text: KIND_NAME[def.kind] || 'Torre' })]);
        card.appendChild(art);
        card.appendChild(el('div', { class: 'card-name', text: def.name || def.id }));
        card.appendChild(el('div', { class: 'card-desc', text: def.desc || '' }));
        if (st.owned) {
          const max = st.level >= A.towerMax();
          art.appendChild(el('span', { class: 'card-lvl' + (max ? ' is-max' : ''), text: 'Nv. ' + st.level }));
          const cur = A.towerStats(def.id, save);
          let nx = null;
          if (!max) { const s2 = clone(save); s2.towers[def.id].level++; nx = A.towerStats(def.id, s2); }
          const stats = el('div', { class: 'stats' });
          if (cur.attack && cur.attack.damage != null) stats.appendChild(statRow('Daño', num(cur.attack.damage), nx && nx.attack ? num(nx.attack.damage) : null));
          if (cur.hp) stats.appendChild(statRow('Vida', num(cur.hp), nx ? num(nx.hp) : null));
          if (cur.damage != null && !(cur.attack && cur.attack.damage != null)) stats.appendChild(statRow('Daño', num(cur.damage), nx ? num(nx.damage) : null));
          card.appendChild(stats);
          card.appendChild(cardBtn(A.towerCost(def.id), max, () => { if (afterAction(A.towerUp(def.id), (def.name || 'Torre') + ' mejorada')) render(); }));
        } else {
          art.appendChild(icon('lock', 'lock-ico'));
          const rq = A.unlockReq(def);
          if (rq.level && save.maxLevel < rq.level) card.appendChild(BB.ui.button('Nivel ' + rq.level, null, { kind: 'gray', disabled: true, icon: 'lock' }));
          else card.appendChild(BB.ui.button('Comprar', () => { if (afterAction(A.towerUnlock(def.id), '¡' + (def.name || 'Torre') + ' comprada! Colócala en Ejército')) { sfx('unlock'); render(); } }, { cost: rq.cost, kind: 'purple' }));
        }
        grid.appendChild(card);
      }
    }
    // Tropas: se reclutan por unidades y aparecen en las almenas y el adarve del castillo
    function renderTroops(grid) {
      const T = BB.troopsApi;
      if (!T || !BB.data.troops) return;
      const save = S();
      const total = T.total(save), cap = T.slotsMax();
      grid.appendChild(el('div', { class: 'card-desc', style: { gridColumn: '1 / -1', fontSize: '1.05em', textAlign: 'center' },
        text: 'Soldados en el castillo: ' + total + ' / ' + cap + ' · Se ven en las almenas y disparan solos durante la batalla.' }));
      for (const id of BB.data.troopOrder) {
        const def = BB.data.troops[id];
        const st = T.state(id, save);
        const unlocked = T.unlocked(id, save);
        const card = el('div', { class: 'card' + (unlocked ? '' : ' is-locked') });
        const art = el('div', { class: 'card-art' }, [BB.ui.sprite(def.rig)]);
        art.appendChild(el('span', { class: 'card-lvl', text: '×' + (st.count || 0) }));
        if (st.count) art.appendChild(el('span', { class: 'card-tag', text: 'Nv. ' + st.level, style: { background: '#2f6fd0' } }));
        card.appendChild(art);
        card.appendChild(el('div', { class: 'card-name', text: def.name }));
        card.appendChild(el('div', { class: 'card-desc', text: def.desc }));
        const a = T.stats(id, save);
        const stats = el('div', { class: 'stats' });
        stats.appendChild(statRow('Daño', num(a.damage), null));
        stats.appendChild(statRow('Cadencia', num(a.interval) + ' s', null));
        card.appendChild(stats);
        if (!unlocked) {
          art.appendChild(icon('lock', 'lock-ico'));
          card.appendChild(BB.ui.button('Nivel ' + def.unlockLevel, null, { kind: 'gray', disabled: true, icon: 'lock' }));
        } else {
          const full = st.count >= def.max || total >= cap;
          const btns = [full ? BB.ui.button('Lleno', null, { kind: 'gray', disabled: true })
            : BB.ui.button('Reclutar', () => { if (afterAction(T.recruit(id), '¡Nuevo ' + def.name.toLowerCase() + ' en las almenas!')) { sfx('unlock'); render(); } }, { cost: T.recruitCost(id, save), kind: 'purple' })];
          if (st.count) btns.push(BB.ui.button('Mejorar', () => { if (afterAction(T.levelUp(id), def.name + ' nivel ' + (st.level + 1))) render(); }, { cost: T.levelCost(id, save), icon: 'up' }));
          card.appendChild(el('div', { class: 'card-btns' }, btns));
        }
        grid.appendChild(card);
      }
    }
    function render() {
      if (!panel) return;
      const scroll = panel.querySelector('.shop-grid');
      const y = scroll ? scroll.scrollTop : 0;
      panel.innerHTML = '';
      tabsEl.querySelectorAll('.bb-tab').forEach(t => t.classList.toggle('is-on', t.dataset.tab === tab));
      const grid = el('div', { class: 'shop-grid ui-scroll' });
      if (tab === 'castle') {
        const tier = castleTier();
        const dots = el('div', { class: 'sc-tier' });
        for (let i = 1; i <= 5; i++) dots.appendChild(el('i', { class: i <= tier ? 'on' : '' }));
        panel.appendChild(el('div', { class: 'shop-castle' }, [el('div', { class: 'sc-name', text: 'Tu castillo' }), el('div', { class: 'sc-art' }, BB.ui.sprite('castle_' + tier)), dots,
          el('div', { class: 'sc-name', style: { fontSize: '0.9em' }, text: 'Etapa ' + tier + ' de 5' })]));
        renderCastle(grid);
      } else if (tab === 'heroes') renderHeroes(grid);
      else if (tab === 'troops') renderTroops(grid);
      else renderTowers(grid);
      if (!grid.children.length) grid.appendChild(el('div', { class: 't-muted', text: 'Aún no hay nada aquí.' }));
      panel.appendChild(grid);
      grid.scrollTop = y;
      BB.ui.refreshTop();
    }
    BB.ui.register({
      id: 'shop', el: root,
      show(p) {
        if (p && p.tab) tab = p.tab;
        root.innerHTML = '';
        root.appendChild(BB.ui.topBar({ title: 'Tienda', back: true, currencies: ['gold', 'gems'] }));
        const mkTab = (id, label, ic) => {
          const b = el('button', { class: 'bb-tab', 'data-tab': id, type: 'button' }, [icon(ic), label]);
          b.addEventListener('click', () => { if (tab !== id) { tab = id; sfx('click'); render(); } });
          return b;
        };
        tabsEl = el('div', { class: 'bb-tabs' }, [mkTab('castle', 'Castillo', 'castle'), mkTab('heroes', 'Héroes', 'users'), mkTab('troops', 'Tropas', 'sword'), mkTab('towers', 'Torres', 'tower')]);
        panel = el('div', { class: 'bb-panel shop-panel' });
        root.appendChild(el('div', { class: 'shop-wrap' }, [tabsEl, panel]));
        render();
      },
      get params() { return { tab }; },
    });
  })();

  // ================================================================== HERO (ficha + árbol de talentos)
  (function () {
    const root = screen('scr-hero bg-wood');
    let id = null, sel = null;
    function owned() { return A.heroes().filter(h => A.hstate(h.id).owned); }
    function nav(dir) {
      const arr = A.heroes();
      let i = arr.findIndex(h => h.id === id);
      i = (i + dir + arr.length) % arr.length;
      id = arr[i].id; sel = null;
      sfx('click');
      render();
    }
    function render() {
      const def = A.hero(id);
      if (!def) { BB.ui.back(); return; }
      const st = A.hstate(id);
      const save = S();
      root.innerHTML = '';
      const navEl = el('div', { class: 'tb-nav' }, [
        BB.ui.button(null, () => nav(-1), { kind: 'wood', round: true, icon: 'left', title: 'Anterior', sound: false }),
        BB.ui.button(null, () => nav(1), { kind: 'wood', round: true, icon: 'right', title: 'Siguiente', sound: false }),
      ]);
      root.appendChild(BB.ui.topBar({ title: (def.name || id).split(',')[0], back: true, right: navEl }));
      // ficha
      const stats = A.heroStats(id, save);
      const a = stats.attack || {};
      let nx = null;
      const max = st.level >= A.maxLevel();
      if (st.owned && !max) { const s2 = clone(save); s2.heroes[id].level++; nx = A.heroStats(id, s2); }
      const nb = nx ? nx.attack || {} : null;
      const statBox = el('div', { class: 'stats' }, [
        statRow('Daño', num(a.damage), nb ? num(nb.damage) : null),
        a.interval ? statRow('Cadencia', num(a.interval) + ' s', null) : null,
        a.range ? statRow('Alcance', num(a.range), null) : null,
        statRow('Objetivos', a.air === false || a.air == null ? (a.ground === false ? 'Aire' : 'Tierra') : (a.ground === false ? 'Aire' : 'Tierra y aire'), null),
        stats.abilityPower ? statRow('Poder habilidad', '×' + num(stats.abilityPower), nx && nx.abilityPower !== stats.abilityPower ? '×' + num(nx.abilityPower) : null) : null,
      ]);
      const ab = def.ability || {};
      const info = el('div', { class: 'hero-info ui-scroll' }, [
        el('div', { class: 'hero-name', text: (def.name || id).split(',')[0] }),
        el('div', { class: 'hero-role', text: [def.title || (def.name || '').split(',')[1], def.role].filter(Boolean).join(' · ') }),
        el('div', { class: 'hero-desc', text: def.desc || '' }),
        el('div', { class: 'ability-box' }, [
          el('div', { class: 'ab-name' }, [icon('bolt', 'ico-sm'), ab.name || 'Habilidad']),
          el('div', { class: 'ab-desc', text: ab.desc || '' }),
          el('div', { class: 'ab-cd', text: 'Recarga: ' + num(stats.abilityCooldown || ab.cooldown) + ' s' }),
        ]),
        def.passive && def.passive.desc ? el('div', { class: 'hero-desc', text: 'Pasiva: ' + def.passive.desc }) : null,
        statBox,
      ]);
      const art = el('div', { class: 'hero-art rar-' + (def.rarity || 'comun') }, [BB.ui.sprite(def.sprite || 'hero_' + id), el('span', { class: 'rar-pill', text: RAR_NAME[def.rarity] || 'Común' })]);
      let lvlRow;
      if (st.owned) {
        lvlRow = el('div', { class: 'hero-level' }, [el('span', { class: 'lvl-num', text: 'Nv. ' + st.level }),
          max ? BB.ui.button('MÁXIMO', null, { kind: 'gold', disabled: true })
            : BB.ui.button('Subir nivel', () => { if (afterAction(A.heroUp(id), null)) render(); }, { cost: A.heroCost(id), icon: 'up' })]);
      } else {
        const rq = A.unlockReq(def);
        lvlRow = el('div', { class: 'hero-level' }, [rq.level && save.maxLevel < rq.level
          ? BB.ui.button('Se desbloquea en el nivel ' + rq.level, null, { kind: 'gray', disabled: true, icon: 'lock' })
          : BB.ui.button('Reclutar', () => { if (afterAction(A.heroUnlock(id), '¡Nuevo héroe!')) { sfx('unlock'); render(); } }, { cost: rq.cost, kind: 'purple' })]);
      }
      const sheet = el('div', { class: 'bb-panel hero-sheet' }, [el('div', { class: 'hero-top' }, [art, info]), lvlRow]);
      root.appendChild(el('div', { class: 'hero-main' }, [sheet, treePanel(def, st)]));
    }
    function treePanel(def, st) {
      const nodes = A.talents(id);
      const panel = el('div', { class: 'bb-panel hero-tree' });
      const pts = st.points || 0;
      const resetBtn = BB.ui.button('Reiniciar', () => {
        const rc = A.resetCost(id);
        BB.ui.confirm('Se devolverán todos los puntos de talento de este héroe' + (rc && (rc.gold || rc.gems) ? ' (cuesta ' + (rc.gems ? rc.gems + ' gemas' : fmt(rc.gold) + ' de oro') + ')' : '') + '.', () => {
          if (afterAction(A.resetTalents(id), 'Talentos reiniciados')) { sel = null; render(); }
        }, { title: 'Reiniciar talentos', yes: 'Reiniciar' });
      }, { kind: 'wood', small: true, icon: 'refresh' });
      panel.appendChild(el('div', { class: 'tree-head' }, [el('span', { class: 'th-title', text: 'Talentos' }),
        el('span', { class: 'th-points' }, ['Puntos libres: ', el('b', { text: String(pts) })]), el('span', { class: 'tb-spacer', style: { flex: '1' } }),
        st.owned && nodes.some(n => A.rank(id, n.id) > 0) ? resetBtn : null]));
      const area = el('div', { class: 'tree-area' });
      panel.appendChild(area);
      const infoBox = el('div', { class: 'tree-info' });
      panel.appendChild(infoBox);
      if (!nodes.length) {
        area.appendChild(el('div', { class: 't-muted', style: { position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }, text: 'Árbol de talentos no disponible todavía' }));
        infoBox.appendChild(el('div', { class: 'ti-text t-muted', text: 'Gana un punto de talento cada ' + ((BB.balance && BB.balance.LEVELS_PER_TALENT_POINT) || 2) + ' niveles.' }));
        return panel;
      }
      const rows = nodes.map(n => n.row || 0), cols = nodes.map(n => n.col || 0);
      const r0 = Math.min.apply(null, rows), r1 = Math.max.apply(null, rows);
      const c0 = Math.min.apply(null, cols), c1 = Math.max.apply(null, cols);
      const px = n => ((n.col || 0) - c0 + 0.5) / (c1 - c0 + 1) * 100;
      const py = n => ((n.row || 0) - r0 + 0.5) / (r1 - r0 + 1) * 100;
      const byId = {};
      nodes.forEach(n => { byId[n.id] = n; });
      let svg = '<svg class="tree-svg" viewBox="0 0 100 100" preserveAspectRatio="none">';
      const lines = [];
      nodes.forEach(n => (n.req || []).forEach(q => { if (byId[q]) lines.push([byId[q], n]); }));
      lines.forEach(l => { svg += '<line class="ln-shadow" x1="' + px(l[0]) + '" y1="' + py(l[0]) + '" x2="' + px(l[1]) + '" y2="' + py(l[1]) + '"/>'; });
      lines.forEach(l => {
        const on = A.rank(id, l[0].id) > 0 && A.rank(id, l[1].id) > 0;
        const avail = !on && A.rank(id, l[0].id) > 0;
        svg += '<line class="' + (on ? 'is-on' : avail ? 'is-avail' : '') + '" x1="' + px(l[0]) + '" y1="' + py(l[0]) + '" x2="' + px(l[1]) + '" y2="' + py(l[1]) + '"/>';
      });
      svg += '</svg>';
      area.insertAdjacentHTML('beforeend', svg);
      const BRANCH_ICO = ['sword', 'bolt', 'shield', 'fire', 'snow'];
      const isFinal = n => n.row === r1 && nodes.filter(m => m.row === r1).length === 1 && (n.req || []).length > 1;
      nodes.forEach(n => {
        const rk = A.rank(id, n.id), mx = n.max || 1;
        const can = A.canLearn(id, n);
        const met = A.reqMet(id, n);
        let cls = 'tnode';
        if (rk >= mx) cls += ' is-max'; else if (can) cls += ' is-avail'; else if (rk > 0) cls += ' is-some'; else if (!met) cls += ' is-locked';
        if (isFinal(n)) cls += ' is-final';
        if (sel === n.id) cls += ' is-sel';
        const ic = n.icon || (isFinal(n) ? 'crown' : BRANCH_ICO[((n.col || 0) - c0) % BRANCH_ICO.length]);
        const b = el('button', { class: cls, type: 'button', title: n.name, style: { left: px(n) + '%', top: py(n) + '%' } },
          [icon(ic, 'tn-ico'), el('span', { class: 'tn-rank', text: rk + '/' + mx }), !met && rk === 0 ? icon('lock', 'tn-lock') : null]);
        b.addEventListener('click', () => { sel = n.id; sfx('click'); render(); });
        area.appendChild(b);
      });
      // información del nodo elegido
      const n = byId[sel] || nodes.find(m => A.canLearn(id, m)) || nodes[0];
      const rk = A.rank(id, n.id), mx = n.max || 1;
      const reqNames = (n.req || []).filter(q => A.rank(id, q) < 1).map(q => byId[q] ? byId[q].name : q);
      let why = A.whyNot(id, n.id);
      if (why == null) why = reqNames.length ? 'Necesitas: ' + reqNames.join(', ') : '';
      if (rk >= mx) why = '';
      infoBox.appendChild(el('div', { class: 'ti-text' }, [
        el('div', { class: 'ti-name', text: n.name + '  (' + rk + '/' + mx + ')' }),
        el('div', { class: 'ti-desc', text: n.desc || '' }),
        why ? el('div', { class: 'ti-req', text: why }) : null,
      ]));
      if (sel === n.id || byId[sel] == null) {
        const can = A.canLearn(id, n);
        infoBox.appendChild(BB.ui.button(rk >= mx ? 'Completo' : 'Aprender', () => {
          if (afterAction(A.learn(id, n.id), null, 'No puedes aprender este talento')) render();
        }, { kind: rk >= mx ? 'gold' : can ? 'green' : 'gray', disabled: rk >= mx || !can, icon: rk >= mx ? 'check' : 'up' }));
      }
      return panel;
    }
    BB.ui.register({
      id: 'hero', el: root,
      show(p) {
        if (p && p.id) { if (p.id !== id) sel = null; id = p.id; }
        if (!id) { const o = owned(); id = (o[0] || A.heroes()[0] || {}).id; }
        render();
      },
    });
  })();

  // ================================================================== ARMY (colocar héroes y torres)
  (function () {
    const root = screen('scr-army bg-wood');
    let tab = 'heroes';
    let selSlot = null;   // { type:'hero'|'trap', i }
    let selItem = null;   // id
    const W = () => BB.WORLD || { HERO_SLOTS: [], TRAP_SLOTS: [] };
    function slotsCount() { return Math.max(1, Math.min(10, A.castleStats().slots || 3)); }
    function lineup() { const d = S(); if (!Array.isArray(d.lineup)) d.lineup = []; while (d.lineup.length < 10) d.lineup.push(null); return d.lineup; }
    function traps() { const d = S(); if (!Array.isArray(d.traps)) d.traps = []; while (d.traps.length < 4) d.traps.push(null); return d.traps; }
    function place(type, i, itemId) {
      const api = type === 'hero' ? BB.heroes : BB.towersApi;
      if (fn(api, 'place') && type === 'hero') {
        let ok = false;
        try { ok = api.place(i, itemId); } catch (err) { console.error(err); }
        if (!ok) { sfx('deny'); BB.ui.toast('No se puede colocar ahí', { type: 'bad' }); selSlot = null; selItem = null; return; }
        sfx('upgrade', { pitch: 1.2 }); BB.ui.vibrate(12); selSlot = null; selItem = null; return;
      }
      const arr = type === 'hero' ? lineup() : traps();
      const prevIdx = arr.indexOf(itemId);
      const old = arr[i];
      if (prevIdx >= 0 && prevIdx !== i) arr[prevIdx] = old || null;
      arr[i] = itemId;
      commit();
      sfx('upgrade', { pitch: 1.2 });
      BB.ui.vibrate(12);
      selSlot = null; selItem = null;
    }
    function tapSlot(type, i, locked) {
      if (locked) {
        sfx('deny');
        BB.ui.toast(type === 'hero' ? 'Mejora «Huecos» en la tienda para tener más héroes' : 'Hueco bloqueado', { type: 'bad', icon: 'lock' });
        return;
      }
      if (selItem && ((type === 'hero') === (tab === 'heroes'))) { place(type, i, selItem); render(); return; }
      if (selSlot && selSlot.type === type && selSlot.i === i) selSlot = null;
      else { selSlot = { type, i }; tab = type === 'hero' ? 'heroes' : 'towers'; }
      selItem = null;
      sfx('click');
      render();
    }
    function tapItem(itemId) {
      if (selSlot && ((selSlot.type === 'hero') === (tab === 'heroes'))) { place(selSlot.type, selSlot.i, itemId); render(); return; }
      selItem = selItem === itemId ? null : itemId;
      sfx('click');
      render();
    }
    function removeAt(type, i) {
      const arr = type === 'hero' ? lineup() : traps();
      arr[i] = null; commit(); sfx('close'); selSlot = null; render();
    }
    function autoFill() {
      const arr = lineup(), n = slotsCount();
      const free = A.heroes().filter(h => A.hstate(h.id).owned && arr.indexOf(h.id) < 0 || arr.indexOf(h.id) >= n)
        .sort((x, y) => A.hstate(y.id).level - A.hstate(x.id).level);
      for (let i = 0; i < n; i++) if (!arr[i] && free.length) { const h = free.shift(); const j = arr.indexOf(h.id); if (j >= 0) arr[j] = null; arr[i] = h.id; }
      commit(); sfx('upgrade'); render();
    }
    function field() {
      const f = el('div', { class: 'army-field' });
      const w = W();
      const wx = (w.WALL_X || 1235), cx = (w.CASTLE_X || 1300);
      if (w.PLAZA) return plazaField(f, w, wx, cx);
      // vista del mundo: x 700..1560, y 130..640
      const X0 = 700, X1 = 1560, Y0 = 95, Y1 = 640;
      const fx = x => ((x - X0) / (X1 - X0) * 100) + '%';
      const fy = y => ((y - Y0) / (Y1 - Y0) * 100) + '%';
      const gy = ((BB.WORLD ? BB.WORLD.GROUND : 560) - Y0) / (Y1 - Y0) * 100;
      f.style.background = 'linear-gradient(180deg,#74c3ee 0%,#b9e6f6 ' + (gy - 2) + '%,#8fcf5e ' + gy + '%,#6aa843 ' + (gy + 6) + '%,#7a5634 ' + (gy + 6.2) + '%,#5d3e22 100%)';
      const toX = x => (x - X0) / (X1 - X0) * 1000, toY = y => (y - Y0) / (Y1 - Y0) * 1000;
      const g = toY(w.GROUND || 560);
      // castillo esquemático: cuerpo con almenas, ventanas y puerta; muralla delante
      const L0 = toX(cx - 6), R0 = toX(1450), T0 = toY(160);
      let cren = '';
      const cw = (R0 - L0) / 7;
      for (let k = 0; k < 7; k += 2) cren += '<rect x="' + (L0 + k * cw) + '" y="' + (T0 - 34) + '" width="' + cw + '" height="36" fill="#b9bec6" stroke="#2b1708" stroke-width="5"/>';
      const wl = toX(wx), wr = toX(cx) - 6, wt = g - toY(W().GROUND - 150 + 0) + toY(0);
      const wallTop = toY((w.GROUND || 560) - 150);
      let wcren = '';
      const ww = (wr - wl) / 3;
      for (let k = 0; k < 3; k += 2) wcren += '<rect x="' + (wl + k * ww) + '" y="' + (wallTop - 26) + '" width="' + ww + '" height="28" fill="#a3a9b2" stroke="#2b1708" stroke-width="5"/>';
      f.insertAdjacentHTML('beforeend', '<svg class="af-svg" viewBox="0 0 1000 1000" preserveAspectRatio="none">' +
        '<defs><pattern id="afst" width="60" height="40" patternUnits="userSpaceOnUse"><path d="M0 20 H60 M30 0 V20 M0 20 V40 M60 20 V40" stroke="rgba(0,0,0,.12)" stroke-width="3"/></pattern></defs>' +
        cren + '<rect x="' + L0 + '" y="' + T0 + '" width="' + (R0 - L0) + '" height="' + (g - T0) + '" fill="#c4c8cf" stroke="#2b1708" stroke-width="6"/>' +
        '<rect x="' + L0 + '" y="' + T0 + '" width="' + (R0 - L0) + '" height="' + (g - T0) + '" fill="url(#afst)"/>' +
        '<path d="M' + ((L0 + R0) / 2 - 34) + ' ' + g + ' v-70 a34 34 0 0 1 68 0 v70z" fill="#7a4a22" stroke="#2b1708" stroke-width="6"/>' +
        wcren + '<rect x="' + wl + '" y="' + wallTop + '" width="' + (wr - wl) + '" height="' + (g - wallTop) + '" fill="#a3a9b2" stroke="#2b1708" stroke-width="6"/>' +
        '<rect x="' + wl + '" y="' + wallTop + '" width="' + (wr - wl) + '" height="' + (g - wallTop) + '" fill="url(#afst)"/>' +
        '<line x1="0" y1="' + g + '" x2="1000" y2="' + g + '" stroke="#3f7a26" stroke-width="6"/></svg>');
      void wt;
      f.appendChild(el('div', { class: 'af-label', style: { left: fx(wx + 30), top: fy((w.GROUND || 560) + 22) }, text: 'Muralla' }));
      const n = slotsCount();
      const lu = lineup();
      (w.HERO_SLOTS || []).forEach((p, i) => {
        const locked = i >= n;
        const hid = lu[i];
        const sel = selSlot && selSlot.type === 'hero' && selSlot.i === i;
        const b = el('button', { class: 'slot' + (locked ? ' is-locked' : hid ? ' is-full' : '') + (sel ? ' is-sel' : ''), type: 'button', style: { left: fx(p.x), top: fy(p.y - 34) } });
        if (locked) b.appendChild(icon('lock'));
        else if (hid && A.hero(hid)) b.appendChild(BB.ui.portrait(A.hero(hid).sprite || 'hero_' + hid));
        else b.appendChild(el('span', { class: 'sl-plus', text: '+' }));
        b.appendChild(el('span', { class: 'sl-num', text: String(i + 1) }));
        if (sel && hid) { const x = el('span', { class: 'sl-x' }, icon('close')); x.addEventListener('click', e => { e.stopPropagation(); removeAt('hero', i); }); b.appendChild(x); }
        b.addEventListener('click', () => tapSlot('hero', i, locked));
        f.appendChild(b);
      });
      const tr = traps();
      (w.TRAP_SLOTS || []).forEach((p, i) => {
        const tid = tr[i];
        const sel = selSlot && selSlot.type === 'trap' && selSlot.i === i;
        const b = el('button', { class: 'slot trap-slot' + (tid ? ' is-full' : '') + (sel ? ' is-sel' : ''), type: 'button', style: { left: fx(p.x), top: fy((w.GROUND || 560) - 40) } });
        if (tid && A.tower(tid)) b.appendChild(BB.ui.sprite(A.tower(tid).sprite || 'tower_' + tid));
        else b.appendChild(el('span', { class: 'sl-plus', text: '+' }));
        b.appendChild(el('span', { class: 'sl-num', text: String(i + 1) }));
        if (sel && tid) { const x = el('span', { class: 'sl-x' }, icon('close')); x.addEventListener('click', e => { e.stopPropagation(); removeAt('trap', i); }); b.appendChild(x); }
        b.addEventListener('click', () => tapSlot('trap', i, false));
        f.appendChild(b);
      });
      f.appendChild(el('div', { class: 'af-label', style: { left: fx(985), top: fy((w.GROUND || 560) + 22) }, text: 'Torres y trampas' }));
      return f;
    }
    // Vista del campo con la torre y la plaza de detrás (disposición de la referencia)
    function plazaField(f, w, wx, cx) {
      const X0 = 540, X1 = 1610, Y0 = 60, Y1 = 700;
      const fx = x => ((x - X0) / (X1 - X0) * 100) + '%';
      const fy = y => ((y - Y0) / (Y1 - Y0) * 100) + '%';
      const G = w.GROUND || 560;
      const gy = (G - Y0) / (Y1 - Y0) * 100;
      f.classList.add('is-plaza');
      f.style.background = 'linear-gradient(180deg,#a9dcf2 0%,#d4f0f7 ' + (gy - 14) + '%,#9fd36a ' + (gy - 13) + '%,#86c255 ' + (gy - 2) + '%,#e2c48a ' + (gy - 1.5) + '%,#d9b77a 100%)';
      const tier = (BB.castleStats && BB.castleStats(BB.save.data).tier) || 1;
      const src = BB.assets.url('castle_' + tier);
      if (src) f.appendChild(el('img', { class: 'af-castle', src, alt: '', style: { left: fx(cx + 60), top: fy(G + 34), height: ((440) / (Y1 - Y0) * 100) + '%' } }));
      const pal = BB.assets.url('deco_empalizada');
      if (pal) f.appendChild(el('img', { class: 'af-castle', src: pal, alt: '', style: { left: fx(wx + 6), top: fy(G + 22), height: (78 / (Y1 - Y0) * 100) + '%' } }));
      f.appendChild(el('div', { class: 'af-label', style: { left: fx(1450), top: fy(G - 30) }, text: 'Plaza de héroes' }));
      const n = slotsCount();
      const lu = lineup();
      (w.HERO_SLOTS || []).forEach((p, i) => {
        const locked = i >= n;
        const hid = lu[i];
        const sel = selSlot && selSlot.type === 'hero' && selSlot.i === i;
        const b = el('button', { class: 'slot' + (locked ? ' is-locked' : hid ? ' is-full' : '') + (sel ? ' is-sel' : ''), type: 'button', style: { left: fx(p.x), top: fy(p.y - 40) } });
        if (locked) b.appendChild(icon('lock'));
        else if (hid && A.hero(hid)) b.appendChild(BB.ui.portrait(A.hero(hid).sprite || 'hero_' + hid));
        else b.appendChild(el('span', { class: 'sl-plus', text: '+' }));
        b.appendChild(el('span', { class: 'sl-num', text: String(i + 1) }));
        if (sel && hid) { const x = el('span', { class: 'sl-x' }, icon('close')); x.addEventListener('click', e => { e.stopPropagation(); removeAt('hero', i); }); b.appendChild(x); }
        b.addEventListener('click', () => tapSlot('hero', i, locked));
        f.appendChild(b);
      });
      const tr = traps();
      (w.TRAP_SLOTS || []).forEach((p, i) => {
        const tid = tr[i];
        const sel = selSlot && selSlot.type === 'trap' && selSlot.i === i;
        const b = el('button', { class: 'slot trap-slot' + (tid ? ' is-full' : '') + (sel ? ' is-sel' : ''), type: 'button', style: { left: fx(p.x), top: fy(G - 20) } });
        if (tid && A.tower(tid)) b.appendChild(BB.ui.sprite(A.tower(tid).sprite || 'tower_' + tid));
        else b.appendChild(el('span', { class: 'sl-plus', text: '+' }));
        b.appendChild(el('span', { class: 'sl-num', text: String(i + 1) }));
        if (sel && tid) { const x = el('span', { class: 'sl-x' }, icon('close')); x.addEventListener('click', e => { e.stopPropagation(); removeAt('trap', i); }); b.appendChild(x); }
        b.addEventListener('click', () => tapSlot('trap', i, false));
        f.appendChild(b);
      });
      f.appendChild(el('div', { class: 'af-label', style: { left: fx(785), top: fy(G + 60) }, text: 'Torres y trampas' }));
      return f;
    }
    function roster() {
      const p = el('div', { class: 'bb-panel army-roster' });
      const mkTab = (id, label, ic) => {
        const b = el('button', { class: 'bb-tab' + (tab === id ? ' is-on' : ''), type: 'button' }, [icon(ic), label]);
        b.addEventListener('click', () => { if (tab !== id) { tab = id; selItem = null; selSlot = null; sfx('click'); render(); } });
        return b;
      };
      p.appendChild(el('div', { class: 'bb-tabs' }, [mkTab('heroes', 'Héroes', 'users'), mkTab('towers', 'Torres', 'tower')]));
      const grid = el('div', { class: 'roster-grid ui-scroll' });
      if (tab === 'heroes') {
        const lu = lineup(), n = slotsCount();
        A.heroes().forEach(h => {
          const st = A.hstate(h.id);
          if (!st.owned) return;
          const at = lu.indexOf(h.id);
          const used = at >= 0 && at < n;
          const it = el('button', { class: 'r-item' + (used ? ' is-used' : '') + (selItem === h.id ? ' is-sel' : ''), type: 'button' }, [
            el('div', { class: 'r-art' }, BB.ui.portrait(h.sprite || 'hero_' + h.id)),
            el('div', { class: 'r-name', text: (h.name || h.id).split(',')[0] }),
            el('div', { class: 'r-lvl', text: 'Nv. ' + st.level }),
            used ? el('span', { class: 'r-slot', text: String(at + 1) }) : null,
          ]);
          it.addEventListener('click', () => tapItem(h.id));
          grid.appendChild(it);
        });
      } else {
        const tr = traps();
        A.towers().forEach(t => {
          const st = A.tstate(t.id);
          const at = tr.indexOf(t.id);
          const it = el('button', { class: 'r-item' + (at >= 0 ? ' is-used' : '') + (st.owned ? '' : ' is-locked') + (selItem === t.id ? ' is-sel' : ''), type: 'button' }, [
            el('div', { class: 'r-art' }, BB.ui.sprite(t.sprite || 'tower_' + t.id)),
            el('div', { class: 'r-name', text: t.name || t.id }),
            el('div', { class: 'r-lvl', text: st.owned ? 'Nv. ' + st.level : 'En tienda' }),
            at >= 0 ? el('span', { class: 'r-slot', text: String(at + 1) }) : null,
          ]);
          it.addEventListener('click', () => {
            if (!st.owned) { sfx('deny'); BB.ui.toast('Cómprala primero en la Tienda', { type: 'bad', icon: 'shop' }); return; }
            tapItem(t.id);
          });
          grid.appendChild(it);
        });
      }
      if (!grid.children.length) grid.appendChild(el('div', { class: 't-muted', text: tab === 'heroes' ? 'No tienes héroes.' : 'No hay torres.' }));
      p.appendChild(grid);
      const hint = selSlot ? (selSlot.type === 'hero' ? 'Elige un héroe para el hueco ' + (selSlot.i + 1) : 'Elige una torre o trampa para el hueco ' + (selSlot.i + 1))
        : selItem ? 'Ahora toca un hueco' : 'Toca un hueco y luego un héroe o torre';
      p.appendChild(el('div', { class: 'army-hint', text: hint }));
      return p;
    }
    function render() {
      root.innerHTML = '';
      const tools = el('div', { class: 'army-tools' }, [BB.ui.button('Rellenar', autoFill, { kind: 'blue', small: true, icon: 'users', sound: false })]);
      root.appendChild(BB.ui.topBar({ title: 'Ejército', back: true, right: tools }));
      root.appendChild(el('div', { class: 'army-main' }, [roster(), field()]));
    }
    BB.ui.register({ id: 'army', el: root, show() { selSlot = null; selItem = null; render(); } });
  })();

  // ================================================================== RESULT
  function findName(id) {
    const d = D();
    for (const k of ['heroes', 'towers', 'enemies', 'bosses', 'zones']) {
      const c = d[k];
      if (!c) continue;
      const it = Array.isArray(c) ? c.find(x => x.id === id) : c[id];
      if (it) return { kind: k, name: (it.name || id).split(',')[0], def: it };
    }
    return { kind: null, name: id };
  }
  function zoneName(level) {
    const zs = D().zones || [];
    const z = zs.find(z => z.levels && level >= z.levels[0] && level <= z.levels[1]) || zs[Math.floor((level - 1) / 10)];
    return z ? z.name : '';
  }
  (function () {
    const root = screen('scr-result');
    const timers = [];
    const later = (ms, f) => timers.push(setTimeout(f, ms));
    function count(node, to, ms) {
      const steps = 20;
      for (let i = 1; i <= steps; i++) later(ms * i / steps, () => { node.textContent = fmt(Math.round(to * i / steps)); if (i % 4 === 0) sfx('coin', { vol: 0.6 }); });
    }
    BB.ui.register({
      id: 'result', el: root,
      show(p) {
        p = p || {};
        timers.forEach(clearTimeout); timers.length = 0;
        const win = !!p.victory;
        const lvl = p.level || 1;
        root.className = 'scr scr-result ' + (win ? 'is-victory' : 'is-defeat');
        root.innerHTML = '';
        root.appendChild(el('div', { class: 'res-rays' }));
        root.appendChild(el('div', { class: 'res-banner', text: win ? '¡VICTORIA!' : 'DERROTA' }));
        const stars = el('div', { class: 'res-stars' });
        const n = win ? Math.max(1, Math.min(3, p.stars || 1)) : 0;
        for (let i = 0; i < 3; i++) stars.appendChild(el('div', { class: 'res-star' }, [icon('star', 'rs-empty'), icon('star', 'rs-full')]));
        root.appendChild(stars);
        for (let i = 0; i < n; i++) later(500 + i * 380, () => { stars.children[i].classList.add('is-on'); sfx('star', { pitch: 1 + i * 0.12 }); BB.ui.vibrate(20); });
        const panel = el('div', { class: 'bb-panel res-panel' });
        panel.appendChild(el('div', { class: 'res-level', text: 'Nivel ' + lvl + (zoneName(lvl) ? ' · ' + zoneName(lvl) : '') + (p.replay && win ? ' · repetición' : '') }));
        const rw = p.rewards || {};
        const gv = el('span', { text: '0' }), mv = el('span', { text: '0' });
        panel.appendChild(el('div', { class: 'res-rewards' }, [
          el('span', { class: 'res-rew' }, [icon('gold'), gv]),
          rw.gems ? el('span', { class: 'res-rew' }, [icon('gem'), mv]) : null,
        ]));
        count(gv, rw.gold || 0, 900);
        if (rw.gems) count(mv, rw.gems, 700);
        if (p.firstClear && win) panel.appendChild(el('div', { class: 'res-first', text: '¡Primera victoria en este nivel!' }));
        const st = p.stats || {};
        const t = Math.round(st.timeSec || 0);
        panel.appendChild(el('div', { class: 'res-stats' }, [
          el('span', null, [icon('skull', 'ico-sm'), 'Bajas: ', el('b', { text: fmt(st.kills || 0) })]),
          el('span', null, [icon('clock', 'ico-sm'), 'Tiempo: ', el('b', { text: Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0') })]),
          el('span', null, [icon('heart', 'ico-sm'), 'Castillo: ', el('b', { text: pct(st.castleHpFrac) })]),
        ]));
        const chips = el('div', { class: 'res-unlocks' });
        (p.unlocked || []).forEach((id, i) => {
          const f = findName(id);
          const c = el('span', { class: 'chip' }, [icon(f.kind === 'heroes' ? 'users' : f.kind === 'towers' ? 'tower' : f.kind === 'zones' ? 'map' : 'lock'), '¡Nuevo! ' + f.name]);
          c.style.animationDelay = (1.4 + i * 0.15) + 's';
          chips.appendChild(c);
        });
        const achs = list(D().achievements);
        (p.achievements || []).forEach((id, i) => {
          const a = achs.find(x => x.id === id);
          const c = el('span', { class: 'chip ch-ach' }, [icon('trophy'), 'Logro: ' + (a ? a.name : id)]);
          c.style.animationDelay = (1.6 + i * 0.15) + 's';
          chips.appendChild(c);
        });
        if (chips.children.length) panel.appendChild(chips);
        if (!win) panel.appendChild(el('div', { class: 'res-tip', text: 'Consejo: mejora el castillo y sube de nivel a tus héroes en la Tienda, y revisa la debilidad de cada enemigo.' }));
        root.appendChild(panel);
        const app = BB.app || {};
        const call = (f, alt) => () => { if (typeof f === 'function') f(); else if (alt) alt(); };
        const btns = el('div', { class: 'res-btns' }, [
          BB.ui.button('Mejorar', call(p.onUpgrade, () => { if (fn(app, 'endBattle')) app.endBattle(); BB.ui.show('shop'); }), { kind: 'gold', icon: 'up' }),
          BB.ui.button('Repetir', call(p.onRetry, () => fn(app, 'startLevel') && app.startLevel(lvl, { replay: true })), { kind: 'blue', icon: 'refresh' }),
          BB.ui.button('Continuar', call(p.onContinue, goMap), { kind: win ? 'wood' : 'green', icon: 'map' }),
          win && lvl < 100 ? BB.ui.button('Siguiente', call(p.onNext, () => fn(app, 'startLevel') && app.startLevel(lvl + 1)), { icon: 'play' }) : null,
        ]);
        root.appendChild(btns);
        if (BB.audio && BB.audio.current !== (win ? 'victoria' : 'derrota') && BB.audio.music) BB.audio.music(win ? 'victoria' : 'derrota');
        if (win) BB.ui.vibrate([40, 40, 60]);
        BB.ui.refreshTop();
      },
      hide() { timers.forEach(clearTimeout); timers.length = 0; },
      onEscape() {},
    });
  })();

  // ================================================================== SETTINGS
  function settings() { const d = S(); if (d && !d.settings) d.settings = {}; return d ? d.settings : {}; }
  (function () {
    const root = screen('scr-settings bg-wood');
    function row(ic, name, desc, ctrl) {
      return el('div', { class: 'set-row' }, [icon(ic), el('div', { class: 'sr-txt' }, [el('div', { class: 'sr-name', text: name }), desc ? el('div', { class: 'sr-desc', text: desc }) : null]), ctrl]);
    }
    function set(k, v) { settings()[k] = v; commit(); }
    function credits() {
      const body = el('div', { class: 'credits' }, [
        el('h3', { text: 'Bastión Bravo' }), el('div', { text: 'Un juego de defensa de castillos hecho con HTML5 y JavaScript.' }),
        el('h3', { text: 'Diseño, código y sonido' }), el('div', { text: 'Equipo de Bastión Bravo, con ayuda de agentes de IA' }),
        el('h3', { text: 'Música y efectos' }), el('div', { text: 'Sintetizados en tiempo real con Web Audio' }),
        el('h3', { text: 'Tipografías' }), el('div', { text: 'Lilita One y Nunito (Google Fonts, licencia OFL)' }),
        el('h3', { text: '¡Gracias por jugar!' }),
      ]);
      BB.ui.modal({ title: 'Créditos', body, buttons: [{ label: 'Cerrar', kind: 'wood' }] });
    }
    function resetFlow() {
      BB.ui.confirm('Se borrará TODO tu progreso: oro, gemas, héroes, niveles y logros.', () => {
        setTimeout(() => BB.ui.confirm('Esto no se puede deshacer. ¿Borrar la partida de verdad?', () => {
          if (BB.save && BB.save.reset) BB.save.reset();
          sfx('wall_break');
          BB.ui.toast('Progreso reiniciado', { type: 'bad' });
          BB.ui.refreshTop();
          if (BB.app && fn(BB.app, 'goMenu')) BB.app.goMenu(); else BB.ui.show('menu');
        }, { title: '¡Última advertencia!', yes: 'BORRAR TODO', danger: true, ribbon: 'purple' }), 250);
      }, { title: 'Reiniciar progreso', yes: 'Continuar', danger: true });
    }
    BB.ui.register({
      id: 'settings', el: root,
      show() {
        const st = settings();
        root.innerHTML = '';
        root.appendChild(BB.ui.topBar({ title: 'Ajustes', back: true, currencies: [] }));
        const q = el('div', { class: 'bb-seg' });
        ['alta', 'baja'].forEach(v => {
          const b = el('button', { type: 'button', class: (st.quality || 'alta') === v ? 'is-on' : '', text: v === 'alta' ? 'Alta' : 'Baja' });
          b.addEventListener('click', () => { set('quality', v); sfx('click'); q.querySelectorAll('button').forEach(x => x.classList.toggle('is-on', x === b)); });
          q.appendChild(b);
        });
        const listEl = el('div', { class: 'set-list ui-scroll' }, [
          row('music', 'Música', 'Melodías de cada zona', BB.ui.toggle(st.music !== false, v => { set('music', v); if (BB.audio) BB.audio.setMusic(v); if (v && BB.audio) BB.audio.music(BB.audio.current || 'menu'); })),
          row('sound', 'Efectos de sonido', null, BB.ui.toggle(st.sfx !== false, v => { set('sfx', v); if (BB.audio) BB.audio.setSfx(v); })),
          row('vibrate', 'Vibración', 'En móviles compatibles', BB.ui.toggle(st.vibration !== false, v => { set('vibration', v); if (v) BB.ui.vibrate(40); })),
          row('auto', 'Habilidades automáticas', 'Los héroes lanzan su habilidad solos', BB.ui.toggle(!!st.autoSkills, v => { set('autoSkills', v); const b = BB.app && BB.app.battle; if (b) b.autoSkills = v; })),
          row('quality', 'Calidad gráfica', 'Baja = menos partículas (móviles lentos)', q),
        ]);
        const foot = el('div', { class: 'set-foot' }, [
          BB.ui.button('Créditos', credits, { kind: 'blue', icon: 'info' }),
          BB.ui.button('Reiniciar progreso', resetFlow, { kind: 'red', icon: 'refresh' }),
        ]);
        root.appendChild(el('div', { class: 'bb-panel set-panel' }, [listEl, foot]));
      },
    });
  })();

  // ================================================================== ACHIEVEMENTS
  function achList() {
    const d = S();
    if (!d) return [];
    const api = BB.achievementsApi;
    let items = null;
    if (fn(api, 'list')) { try { items = api.list(d); } catch (err) { console.error(err); } }
    if (!items) items = list(D().achievements).map(a => ({ def: a }));
    return items.map(it => {
      const def = it.def || it;
      const target = it.target != null ? it.target : def.target || 1;
      let prog = it.progress != null ? it.progress : it.value;
      if (prog == null && typeof def.progress === 'function') { try { prog = def.progress(d); } catch (err) { prog = 0; } }
      prog = Math.min(target, prog || 0);
      const claimed = it.claimed != null ? it.claimed : !!(d.achievements && d.achievements[def.id] && d.achievements[def.id].claimed);
      return { id: def.id || it.id, name: def.name, desc: def.desc, icon: def.icon, reward: def.reward || it.reward || {}, target, progress: prog, done: it.done != null ? it.done : prog >= target, claimed };
    });
  }
  function grant(before, reward) {
    const d = S();
    if (d.gold === before.gold && d.gems === before.gems && reward && (reward.gold || reward.gems) && BB.econ) BB.econ.add(reward, 'recompensa');
  }
  function claimAch(a) {
    const d = S();
    const before = { gold: d.gold, gems: d.gems };
    const api = BB.achievementsApi;
    let ok = true;
    if (fn(api, 'claim')) { try { const v = api.claim(a.id, d); ok = v != null && okResult(v); } catch (err) { console.error(err); ok = false; } }
    else { d.achievements = d.achievements || {}; d.achievements[a.id] = Object.assign({}, d.achievements[a.id], { claimed: true }); }
    if (ok) {
      grant(before, a.reward);
      commit();
      sfx('gem');
      BB.ui.toast('¡Recompensa del logro conseguida!', { type: 'good', icon: 'trophy' });
      BB.ui.refreshTop();
    }
    return ok;
  }
  function rewardEl(r, cls) {
    return el('span', { class: cls || 'ach-rew' }, [r.gems ? icon('gem') : null, r.gems ? fmt(r.gems) : null, r.gold ? icon('gold') : null, r.gold ? fmt(r.gold) : null]);
  }
  (function () {
    const root = screen('scr-achievements bg-wood');
    function render() {
      const items = achList();
      root.innerHTML = '';
      root.appendChild(BB.ui.topBar({ title: 'Logros', back: true, currencies: ['gold', 'gems'] }));
      const done = items.filter(a => a.done).length;
      const head = el('div', { class: 'ach-head' }, [icon('trophy', 'ico-lg'), el('span', { class: 't-title', style: { fontSize: '1.2em' }, text: done + ' / ' + items.length }), BB.ui.bar(items.length ? done / items.length : 0)]);
      const listEl = el('div', { class: 'ach-list ui-scroll' });
      items.sort((x, y) => (y.done && !y.claimed) - (x.done && !x.claimed) || (x.claimed - y.claimed) || (y.progress / y.target - x.progress / x.target));
      items.forEach(a => {
        const side = el('div', { class: 'ach-side' }, [rewardEl(a.reward)]);
        if (a.claimed) side.appendChild(el('span', { class: 'ach-ok' }, [icon('check', 'ico-sm'), 'Hecho']));
        else if (a.done) side.appendChild(BB.ui.button('Reclamar', () => { if (claimAch(a)) render(); }, { kind: 'gold', small: true, sound: false }));
        listEl.appendChild(el('div', { class: 'ach' + (a.claimed ? ' is-claimed' : a.done ? ' is-done' : ' is-locked') }, [
          el('div', { class: 'ach-ico' }, /^(castle|hero|tower|enemy|boss)_/.test(a.icon || '') ? BB.ui.sprite(a.icon) : icon(a.icon || 'trophy')),
          el('div', { class: 'ach-txt' }, [el('div', { class: 'ach-name', text: a.name || a.id }), el('div', { class: 'ach-desc', text: a.desc || '' }),
            BB.ui.bar(a.progress / a.target, fmt(a.progress) + ' / ' + fmt(a.target))]),
          side,
        ]));
      });
      if (!items.length) listEl.appendChild(el('div', { class: 't-muted', text: 'Los logros aparecerán aquí.' }));
      root.appendChild(el('div', { class: 'bb-panel ach-panel' }, [head, listEl]));
    }
    BB.ui.register({ id: 'achievements', el: root, show: render });
  })();

  // ================================================================== DAILY
  (function () {
    const root = screen('scr-daily bg-wood');
    function table() {
      const d = BB.daily || {};
      const t = (fn(d, 'rewards') ? d.rewards() : d.rewards) || d.table || d.REWARDS || D().dailyRewards || D().daily;
      return Array.isArray(t) ? t : null;
    }
    function render() {
      root.innerHTML = '';
      root.appendChild(BB.ui.topBar({ title: 'Recompensa diaria', back: true, currencies: ['gold', 'gems'] }));
      const panel = el('div', { class: 'bb-panel daily-panel' }, el('div', { class: 'panel-head' }, el('div', { class: 'ribbon rb-gold', text: '¡Vuelve cada día!' })));
      let status = null;
      try { status = BB.daily && fn(BB.daily, 'status') ? BB.daily.status(S()) : null; } catch (err) { console.error(err); }
      if (!status) {
        panel.appendChild(el('div', { class: 'daily-msg', text: 'La recompensa diaria no está disponible todavía.' }));
        root.appendChild(panel);
        return;
      }
      const tab = Array.isArray(status.week) && status.week.length ? status.week : table();
      const day = Math.max(1, status.day || 1);
      const track = el('div', { class: 'daily-track' });
      const cnt = tab ? Math.min(7, tab.length) : 7;
      for (let i = 1; i <= cnt; i++) {
        const r = tab ? (tab[i - 1].reward || tab[i - 1]) : (i === day ? status.reward : null);
        const claimed = i < day || (i === day && !status.canClaim);
        const today = i === day && status.canClaim;
        const big = r && r.gems;
        track.appendChild(el('div', { class: 'dday' + (claimed ? ' is-claimed' : '') + (today ? ' is-today' : '') + (i === 7 ? ' is-big' : '') }, [
          el('div', { class: 'dd-n', text: 'Día ' + i }),
          el('div', { class: 'dd-ico' }, icon(i === 7 ? 'gift' : big ? 'gem' : r ? 'gold' : 'question')),
          el('div', { class: 'dd-val', text: r ? [r.gold ? fmt(r.gold) + ' oro' : '', r.gems ? fmt(r.gems) + ' gemas' : ''].filter(Boolean).join('\n') : '?' }),
          claimed ? icon('check', 'dd-check') : null,
        ]));
      }
      panel.appendChild(track);
      const streak = S().daily && S().daily.streak;
      if (streak) panel.appendChild(el('div', { class: 'daily-streak', text: 'Racha: ' + streak + (streak === 1 ? ' día' : ' días') }));
      if (status.canClaim) {
        panel.appendChild(BB.ui.button('¡Reclamar!', () => {
          const d = S();
          const before = { gold: d.gold, gems: d.gems };
          let r = null;
          try { r = BB.daily.claim(d); } catch (err) { console.error(err); }
          if (!r && r !== 0) { sfx('deny'); return; }
          grant(before, r && typeof r === 'object' ? r : status.reward);
          commit();
          sfx('unlock'); sfx('coin');
          BB.ui.vibrate([30, 30, 30]);
          BB.ui.toast('¡Recompensa reclamada!', { type: 'good', icon: 'gift' });
          BB.ui.refreshTop();
          render();
        }, { big: true, kind: 'gold', icon: 'gift', sound: false }));
      } else panel.appendChild(el('div', { class: 'daily-msg', text: 'Ya has reclamado la recompensa de hoy. ¡Vuelve mañana!' }));
      root.appendChild(panel);
    }
    BB.ui.register({ id: 'daily', el: root, show: render });
  })();

  // ================================================================== ENEMY INTRO (superposición)
  function pips(v, steps) {
    let n = 1;
    steps.forEach(s => { if (v >= s) n++; });
    const box = el('div', { class: 'pips' });
    for (let i = 1; i <= 5; i++) box.appendChild(el('i', { class: i <= Math.min(5, n) ? 'on' : '' }));
    return box;
  }
  (function () {
    const root = el('div', { class: 'ovl' });
    let types = [], idx = 0, onDone = null;
    function render() {
      const id = types[idx];
      const def = (D().enemies && D().enemies[id]) || (D().bosses && D().bosses[id]) || { name: id };
      root.innerHTML = '';
      const art = el('div', { class: 'intro-art' }, [BB.ui.sprite(def.sprite || 'enemy_' + id), def.air ? el('span', { class: 'rar-pill air-tag', style: { background: '#2688d8' }, text: 'Volador' }) : null]);
      const last = idx >= types.length - 1;
      const dots = el('div', { class: 'intro-dots' });
      if (types.length > 1) types.forEach((t, i) => dots.appendChild(el('i', { class: i === idx ? 'on' : '' })));
      const txt = el('div', { class: 'intro-txt' }, [
        el('div', { class: 'intro-name', text: def.name || id }),
        el('div', { class: 'intro-desc', text: def.desc || '' }),
        def.weakness ? el('div', { class: 'intro-weak' }, [icon('sword'), el('span', { text: /^débil/i.test(def.weakness) ? def.weakness : 'Débil contra: ' + def.weakness })]) : null,
        el('div', { class: 'intro-meters' }, [
          el('span', { text: 'Vida' }), pips(def.hp || 0, [25, 50, 100, 220]),
          el('span', { text: 'Velocidad' }), pips(def.speed || 0, [40, 60, 90, 120]),
          el('span', { text: 'Daño' }), pips(def.damage || 0, [4, 8, 15, 30]),
        ]),
        el('div', { class: 'intro-foot' }, [dots, BB.ui.button(last ? '¡A luchar!' : 'Siguiente', next, { big: true, icon: last ? 'sword' : 'next' })]),
      ]);
      root.appendChild(el('div', { class: 'bb-panel intro-card' }, [el('div', { class: 'panel-head' }, el('div', { class: 'ribbon', text: '¡NUEVO ENEMIGO!' })), art, txt]));
    }
    function next() {
      const d = S();
      const id = types[idx];
      if (d && d.seen && id) { d.seen.enemies = d.seen.enemies || {}; d.seen.enemies[id] = true; commit(); }
      if (idx < types.length - 1) { idx++; sfx('open'); render(); return; }
      BB.ui.hide('enemyIntro');
      const f = onDone; onDone = null;
      if (typeof f === 'function') f();
    }
    BB.ui.register({
      id: 'enemyIntro', el: root, overlay: true,
      show(p) {
        p = p || {};
        types = (p.types || []).filter(Boolean);
        idx = 0; onDone = p.onDone;
        if (!types.length) { setTimeout(next, 0); return; }
        sfx('open');
        render();
      },
      onEscape() { next(); },
    });
  })();

  // ================================================================== PAUSE (superposición)
  (function () {
    const root = el('div', { class: 'ovl' });
    let cb = {};
    function close(then) {
      BB.ui.hide('pause');
      if (typeof then === 'function') then();
    }
    function render() {
      root.innerHTML = '';
      const st = settings();
      const b = BB.app && BB.app.battle;
      const lvl = b ? b.level : null;
      const mus = BB.ui.button(null, () => { const v = !(settings().music !== false); settings().music = v; commit(); if (BB.audio) { BB.audio.setMusic(v); } render(); },
        { kind: 'wood', round: true, icon: 'music', title: 'Música', cls: st.music === false ? 'is-off' : '' });
      const fx = BB.ui.button(null, () => { const v = !(settings().sfx !== false); settings().sfx = v; commit(); if (BB.audio) BB.audio.setSfx(v); render(); },
        { kind: 'wood', round: true, icon: 'sound', title: 'Efectos', cls: st.sfx === false ? 'is-off' : '' });
      root.appendChild(el('div', { class: 'bb-panel pause-card' }, [
        el('div', { class: 'panel-head' }, el('div', { class: 'ribbon', text: 'PAUSA' })),
        lvl ? el('div', { class: 'pause-level', text: 'Nivel ' + lvl + (zoneName(lvl) ? ' · ' + zoneName(lvl) : '') }) : null,
        BB.ui.button('Continuar', () => close(cb.onResume), { big: true, icon: 'play' }),
        BB.ui.button('Reiniciar nivel', () => BB.ui.confirm('Empezarás este nivel desde el principio.', () => close(cb.onRestart), { title: 'Reiniciar', yes: 'Reiniciar' }), { kind: 'gold', icon: 'refresh' }),
        BB.ui.button('Salir al mapa', () => BB.ui.confirm('Perderás el progreso de esta batalla.', () => close(cb.onQuit), { title: 'Salir', yes: 'Salir', danger: true }), { kind: 'red', icon: 'exit' }),
        el('div', { class: 'pause-toggles' }, [mus, fx]),
      ]));
    }
    BB.ui.register({
      id: 'pause', el: root, overlay: true,
      show(p) { cb = p || {}; sfx('open'); render(); },
      onEscape() { setTimeout(() => { if (BB.ui.isOpen('pause')) close(cb.onResume); }, 0); },
    });
  })();
})();
