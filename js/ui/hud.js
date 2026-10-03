/* Bastión Bravo · HUD de batalla
   BB.hud.attach(B) al empezar, BB.hud.frame(dt, B) en cada fotograma, BB.hud.detach() al terminar.
   Solo sus botones capturan toques: el resto del campo sigue llegando al canvas. */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const el = (t, a, c) => BB.ui.el(t, a, c);
  const icon = (n, c) => BB.ui.icon(n, c);
  const fmt = n => BB.ui.fmt(n);
  const RING_C = 2 * Math.PI * 45;

  let B = null, root = null, R = {}, abs = [], bossShown = null, bossHideT = null;
  let sizeT = 0, lastGold = -1, lastWave = -2, lastHp = -1, lastWall = -1, lastBossHp = -1;
  const offs = [];

  function settings() { return (BB.save && BB.save.data && BB.save.data.settings) || {}; }
  function setW(node, f) { node.style.transform = 'scaleX(' + Math.max(0, Math.min(1, f || 0)).toFixed(4) + ')'; }
  function txt(node, s) { if (node._t !== s) { node._t = s; node.textContent = s; } }
  function bump(node, cls) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }

  function hbar(cls, ic) {
    const fill = el('div', { class: 'hb-fill' }), trail = el('div', { class: 'hb-trail' }), shield = el('div', { class: 'hb-shield' }), t = el('div', { class: 'hb-txt' });
    const node = el('div', { class: 'hbar ' + cls }, [icon(ic), el('div', { class: 'hb-track' }, [trail, fill, shield, t])]);
    return { node, fill, trail, shield, t };
  }

  function build() {
    root = el('div', { class: 'hud' });
    R.gold = el('span', { class: 'hv', text: '0' });
    R.goldPill = el('div', { class: 'hud-pill hud-gold' }, [icon('gold'), R.gold]);
    R.waveLbl = el('span', { text: 'Oleada 1/1' });
    R.waveFill = el('div', { class: 'hw-fill' });
    R.wave = el('div', { class: 'hud-pill hud-wave' }, [el('div', { class: 'hw-lbl' }, [icon('flag'), R.waveLbl]), el('div', { class: 'hw-bar' }, R.waveFill)]);
    R.castle = hbar('hb-castle', 'heart');
    R.wall = hbar('hb-wall', 'shield');
    R.auto = el('button', { class: 'hud-btn', type: 'button', title: 'Habilidades automáticas' }, [el('span', { class: 'hb-lbl', text: 'AUTO' })]);
    R.auto.querySelector('.hb-lbl').style.fontSize = '0.72em';
    R.speed = el('button', { class: 'hud-btn', type: 'button', title: 'Velocidad' }, [el('span', { class: 'hb-lbl', text: '×1' })]);
    R.pause = el('button', { class: 'hud-btn', type: 'button', title: 'Pausa' }, [icon('pause')]);
    R.auto.addEventListener('click', e => { e.stopPropagation(); toggleAuto(); });
    R.speed.addEventListener('click', e => { e.stopPropagation(); toggleSpeed(); });
    R.pause.addEventListener('click', e => { e.stopPropagation(); doPause(); });
    const top = el('div', { class: 'hud-top' }, [R.goldPill, R.wave, el('div', { class: 'hud-spacer' }),
      el('div', { class: 'hud-bars' }, [R.castle.node, R.wall.node]), el('div', { class: 'hud-btns' }, [R.auto, R.speed, R.pause])]);
    // jefe
    R.bossName = el('span', { class: 'hb-name' });
    R.bossTitle = el('span', { class: 'hb-title' });
    R.bossPhase = el('span', { class: 'hb-phase' });
    R.bossFill = el('div', { class: 'hb-fill' });
    R.bossTrail = el('div', { class: 'hb-trail' });
    R.bossPct = el('div', { class: 'hb-pct' });
    R.bossTrack = el('div', { class: 'hb-track2' }, [R.bossTrail, R.bossFill, R.bossPct]);
    R.boss = el('div', { class: 'hud-boss' }, [el('div', { class: 'hb-head' }, [icon('crown'), R.bossName, R.bossTitle, R.bossPhase]), R.bossTrack]);
    R.abil = el('div', { class: 'hud-abil' }, [el('div', { class: 'hab-auto', text: 'AUTO' })]);
    root.appendChild(top);
    root.appendChild(R.boss);
    root.appendChild(R.abil);
  }

  function abilityButtons() {
    R.abil.querySelectorAll('.hab').forEach(n => n.remove());
    abs = [];
    (B.heroes || []).slice().sort((a, b) => a.slot - b.slot).forEach((h, k) => {
      const def = h.def || {};
      const ring = '<svg class="hab-ring" viewBox="0 0 100 100"><circle class="rg-bg" cx="50" cy="50" r="45"/><circle class="rg-fg" cx="50" cy="50" r="45" stroke-dasharray="' + RING_C.toFixed(1) + '" stroke-dashoffset="0"/></svg>';
      const btn = el('button', { class: 'hab', type: 'button', title: (def.ability && def.ability.name) || def.name || h.id });
      btn.appendChild(el('div', { class: 'hab-face' }, BB.ui.portrait(def.sprite || 'hero_' + h.id)));
      btn.appendChild(el('div', { class: 'hab-dim' }));
      btn.insertAdjacentHTML('beforeend', ring);
      const cd = el('div', { class: 'hab-cd' });
      btn.appendChild(cd);
      btn.appendChild(el('div', { class: 'hab-name', text: (def.ability && def.ability.name) || (def.name || h.id).split(',')[0] }));
      btn.appendChild(el('div', { class: 'hab-key', text: String((h.slot + 1) % 10) }));
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (!B) return;
        const ok = typeof B.castAbility === 'function' ? B.castAbility(h.slot) : false;
        if (ok) { bump(btn, 'is-cast'); BB.ui.vibrate(15); }
        else BB.ui.sfx('deny');
      });
      btn.addEventListener('pointerdown', e => e.stopPropagation());
      R.abil.appendChild(btn);
      abs.push({ h, btn, cd, fg: btn.querySelector('.rg-fg'), ready: null, off: null, k });
    });
  }

  function toggleSpeed() {
    if (!B) return;
    const n = B.speed === 2 ? 1 : 2;
    if (typeof B.setSpeed === 'function') B.setSpeed(n); else B.speed = n;
    BB.ui.sfx('click');
  }
  function toggleAuto() {
    if (!B) return;
    B.autoSkills = !B.autoSkills;
    const st = settings();
    st.autoSkills = B.autoSkills;
    if (BB.save && BB.save.commit) BB.save.commit();
    BB.ui.sfx('click');
    BB.ui.toast(B.autoSkills ? 'Habilidades automáticas activadas' : 'Habilidades manuales', { time: 1400 });
  }
  function doPause() {
    if (!B || B.over) return;
    BB.ui.sfx('click');
    if (BB.app && typeof BB.app.pause === 'function') { BB.app.pause(); return; }
    if (typeof B.pause === 'function') B.pause(); else B.paused = true;
    BB.ui.show('pause', {
      onResume: () => { if (B) { if (B.resume) B.resume(); else B.paused = false; } },
      onRestart: () => { if (B && B.resume) B.resume(); },
      onQuit: () => { if (B && B.resume) B.resume(); },
    });
  }

  // Tamaño de los botones de habilidad: que quepan en la franja de suelo bajo y=600 del mundo
  function layout() {
    if (!root) return;
    const H = window.innerHeight || 720;
    const base = parseFloat(getComputedStyle(BB.ui.root || document.body).fontSize) || 16;
    let avail = H * 0.16;
    if (BB.render && typeof BB.render.worldToScreen === 'function') {
      try {
        const p = BB.render.worldToScreen(0, 600);
        if (p && isFinite(p.y) && p.y > 0 && p.y < H) avail = H - p.y;
      } catch (err) { /* nada */ }
    }
    let size = Math.max(44, Math.min(base * 5.4, avail - 8));
    const n = Math.max(1, abs.length);
    const maxW = (window.innerWidth || 1280) * 0.86;
    const gap = Math.max(6, size * 0.14);
    if (n * (size + gap) > maxW) size = Math.max(40, maxW / n - gap);
    R.abil.style.setProperty('--ab', Math.round(size) + 'px');
    R.abil.style.setProperty('--ab-gap', Math.round(gap) + 'px');
  }

  function attach(battle) {
    if (!BB.ui || !BB.ui.layers || !BB.ui.layers.hud) { if (BB.ui && BB.ui.init) BB.ui.init(); }
    detach();
    B = battle;
    if (!B) return;
    if (BB.ui.current) BB.ui.hideAll ? BB.ui.hideAll() : BB.ui.show(null);
    build();
    BB.ui.layers.hud.appendChild(root);
    abilityButtons();
    lastGold = -1; lastWave = -2; lastHp = -1; lastWall = -1; lastBossHp = -1; bossShown = null; sizeT = 0;
    if (typeof B.on === 'function') {
      offs.push(B.on('wave', ev => { if (ev && ev.index > 0) { bump(R.wave, 'is-new'); banner('¡Oleada ' + (ev.index + 1) + '!'); } }));
      offs.push(B.on('wallBroken', () => banner('¡La muralla ha caído!')));
    }
    layout();
    window.addEventListener('resize', layout);
    frame(0);
  }

  function banner(text) {
    if (!root) return;
    const n = el('div', { class: 'hud-toast', text });
    root.appendChild(n);
    setTimeout(() => n.remove(), 1900);
  }

  function detach() {
    window.removeEventListener('resize', layout);
    while (offs.length) { const f = offs.pop(); if (typeof f === 'function') { try { f(); } catch (err) { /* nada */ } } }
    clearTimeout(bossHideT);
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null; B = null; abs = []; R = {};
  }

  function updateBoss() {
    const boss = B.boss && !B.boss.dead ? B.boss : null;
    if (boss && bossShown !== boss) {
      clearTimeout(bossHideT);
      bossShown = boss;
      const def = boss.def || {};
      txt(R.bossName, (def.name || boss.type || 'Jefe').split(',')[0]);
      txt(R.bossTitle, def.title || '');
      R.boss.style.setProperty('--boss-c', def.color || '#e0402f');
      R.bossTrack.querySelectorAll('.hb-mark').forEach(n => n.remove());
      (def.phases || []).forEach((ph, i) => { if (i > 0 && ph.at > 0 && ph.at < 1) R.bossTrack.appendChild(el('div', { class: 'hb-mark', style: { left: (ph.at * 100) + '%' } })); });
      R.boss.classList.remove('is-dead');
      R.boss.classList.add('is-on');
      R.bossPhase._phase = -1;
      lastBossHp = -1;
    }
    if (!boss && bossShown) {
      bossShown = null;
      R.boss.classList.add('is-dead');
      bossHideT = setTimeout(() => { if (R.boss) R.boss.classList.remove('is-on', 'is-dead'); }, 800);
      setW(R.bossFill, 0); setW(R.bossTrail, 0);
      return;
    }
    if (!boss) return;
    const f = Math.max(0, boss.hp / (boss.maxHp || 1));
    if (f !== lastBossHp) {
      if (lastBossHp >= 0 && f < lastBossHp - 0.004) bump(R.boss, 'is-hit');
      lastBossHp = f;
      setW(R.bossFill, f); setW(R.bossTrail, f);
      txt(R.bossPct, Math.ceil(f * 100) + '%');
    }
    const phases = (boss.def && boss.def.phases) || [];
    const ph = boss.phase || 0;
    if (R.bossPhase._phase !== ph) {
      R.bossPhase._phase = ph;
      const name = phases[ph] && phases[ph].name ? phases[ph].name : 'Fase ' + (ph + 1);
      txt(R.bossPhase, phases.length > 1 ? name : '');
      R.bossPhase.style.display = phases.length > 1 ? '' : 'none';
      bump(R.bossPhase, 'is-new');
    }
  }

  function frame(dt, battle) {
    if (battle && battle !== B) attach(battle);
    if (!B || !root) return;
    sizeT -= dt || 0;
    if (sizeT <= 0) { sizeT = 0.75; layout(); }
    // oro
    const g = Math.floor(B.gold || 0);
    if (g !== lastGold) { if (lastGold >= 0 && g > lastGold) bump(R.goldPill, 'is-bump'); lastGold = g; txt(R.gold, fmt(g)); }
    // oleadas y progreso
    const total = (B.waveTimes && B.waveTimes.length) || (B.levelDef && B.levelDef.waves && B.levelDef.waves.length) || 1;
    const wi = Math.max(0, B.waveIdx != null ? B.waveIdx : 0);
    const key = wi * 1000 + (B.boss ? 1 : 0);
    if (key !== lastWave) { lastWave = key; txt(R.waveLbl, B.boss ? '¡Jefe!' : 'Oleada ' + Math.min(total, wi + 1) + '/' + total); }
    const spawns = B.totalSpawns || (B.levelDef && B.levelDef.spawns && B.levelDef.spawns.length) || 1;
    setW(R.waveFill, ((B.stats && B.stats.kills) || 0) / spawns);
    // castillo y muralla
    const c = B.castle || {};
    const hp = c.maxHp ? c.hp / c.maxHp : 0;
    if (hp !== lastHp) {
      if (lastHp >= 0 && hp < lastHp - 0.002) bump(R.castle.node, 'is-hit');
      lastHp = hp;
      setW(R.castle.fill, hp); setW(R.castle.trail, hp);
      R.castle.fill.classList.toggle('is-mid', hp < 0.6 && hp >= 0.3);
      R.castle.fill.classList.toggle('is-low', hp < 0.3);
      txt(R.castle.t, fmt(Math.ceil(c.hp || 0)) + ' / ' + fmt(c.maxHp || 0));
    }
    setW(R.castle.shield, c.shield > 0 && c.maxHp ? c.shield / c.maxHp : 0);
    const wl = c.wallMax ? c.wallHp / c.wallMax : 0;
    if (wl !== lastWall) {
      if (lastWall >= 0 && wl < lastWall - 0.002) bump(R.wall.node, 'is-hit');
      lastWall = wl;
      setW(R.wall.fill, wl); setW(R.wall.trail, wl);
      R.wall.node.classList.toggle('is-broken', wl <= 0);
      txt(R.wall.t, wl <= 0 ? 'Muralla rota' : fmt(Math.ceil(c.wallHp || 0)) + ' / ' + fmt(c.wallMax || 0));
    }
    // botones
    txt(R.speed.firstChild, B.speed === 2 ? '×2' : '×1');
    R.speed.classList.toggle('is-on', B.speed === 2);
    R.auto.classList.toggle('is-on', !!B.autoSkills);
    R.abil.classList.toggle('is-auto', !!B.autoSkills);
    updateBoss();
    // habilidades
    for (const a of abs) {
      const h = a.h;
      const off = h.disabled > 0;
      const ready = !off && h.cd <= 0;
      if (a.off !== off) { a.off = off; a.btn.classList.toggle('is-off', off); }
      if (a.ready !== ready) {
        const wasNot = a.ready === false;
        a.ready = ready;
        a.btn.classList.toggle('is-ready', ready);
        if (ready && wasNot && !B.over) { bump(a.btn, 'is-flash'); BB.ui.sfx('ready'); }
      }
      if (off) txt(a.cd, Math.ceil(h.disabled) + '');
      else if (!ready) {
        txt(a.cd, Math.ceil(h.cd) + '');
        const p = 1 - Math.max(0, Math.min(1, h.cd / (h.cdMax || 1)));
        a.fg.setAttribute('stroke-dashoffset', (RING_C * (1 - p)).toFixed(1));
      }
    }
  }

  BB.hud = { attach, frame, detach, get battle() { return B; }, layout };
})();
