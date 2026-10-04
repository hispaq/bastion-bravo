/* Bastión Bravo · Presentación de jefe — BB.bossIntro.play(bossId, onDone)
   Dueño: agente «Enemigos y jefes». Pantalla completa en DOM con su propio <style>.
   Bandas de cine, fondo del color del jefe, sprite grande (o silueta si no hay imagen), nombre gigante,
   título y frase con animaciones. Se cierra al tocar (o con Intro/Espacio/Esc) o sola a los ~5,4 s. */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const AUTO_CLOSE = 5.4;      // s
  const MIN_TAP = 0.6;         // s: evita saltarla con el toque que lanzó el nivel

  const CSS = `
.bbi{position:fixed;inset:0;z-index:9000;overflow:hidden;background:#000;color:#fff;cursor:pointer;
  font-family:'Lilita One','Luckiest Guy','Arial Black',Impact,sans-serif;-webkit-user-select:none;user-select:none;
  touch-action:manipulation;--c:#ff5a4a;animation:bbi-in .25s ease-out both}
.bbi.out{animation:bbi-out .35s ease-in forwards}
.bbi *{box-sizing:border-box}
.bbi-bg{position:absolute;inset:-10%;background:radial-gradient(ellipse at 32% 55%,var(--c) 0%,color-mix(in srgb,var(--c) 45%,#120812) 38%,#0a0508 78%);
  animation:bbi-bgpulse 2.4s ease-in-out infinite alternate}
@supports not (background:color-mix(in srgb,red 50%,blue)){.bbi-bg{background:radial-gradient(ellipse at 32% 55%,var(--c) 0%,#3a1418 45%,#0a0508 80%)}}
.bbi-rays{position:absolute;left:32%;top:55%;width:240vmax;height:240vmax;margin:-120vmax 0 0 -120vmax;opacity:.22;
  background:repeating-conic-gradient(from 0deg,rgba(255,255,255,.9) 0deg 6deg,transparent 6deg 18deg);animation:bbi-spin 26s linear infinite}
.bbi-lines{position:absolute;inset:0;opacity:.18;background:repeating-linear-gradient(100deg,transparent 0 46px,rgba(255,255,255,.55) 47px 49px,transparent 50px 120px);
  animation:bbi-lines .5s linear infinite}
.bbi-vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,.75) 100%)}
.bbi-emb{position:absolute;bottom:-20px;width:6px;height:6px;border-radius:50%;background:#fff;box-shadow:0 0 8px 2px var(--c);opacity:0;animation:bbi-emb linear infinite}
.bbi-band{position:absolute;left:0;right:0;height:11vh;background:#000;z-index:5;transition:none}
.bbi-band.t{top:0;animation:bbi-bandt .5s cubic-bezier(.2,.9,.3,1) both}
.bbi-band.b{bottom:0;animation:bbi-bandb .5s cubic-bezier(.2,.9,.3,1) both}
.bbi-hz{position:absolute;left:0;right:0;height:3.2vh;min-height:10px;z-index:6;
  background:repeating-linear-gradient(-45deg,#ffd23f 0 14px,#1e1527 14px 28px);opacity:.95}
.bbi-hz.t{top:11vh;animation:bbi-hzt 5s linear infinite, bbi-fade .4s .2s both}
.bbi-hz.b{bottom:11vh;animation:bbi-hzt 5s linear infinite reverse, bbi-fade .4s .2s both}
.bbi-stage{position:absolute;left:0;right:0;top:11vh;bottom:11vh;display:flex;align-items:center;z-index:4}
.bbi-spr{position:relative;flex:0 0 46%;height:100%;display:flex;align-items:flex-end;justify-content:center;padding-bottom:2vh}
.bbi-spr-in{position:relative;height:92%;width:100%;display:flex;align-items:flex-end;justify-content:center;
  animation:bbi-zoom .7s .35s cubic-bezier(.15,.9,.25,1.15) both}
.bbi-spr img,.bbi-spr svg{max-height:100%;max-width:100%;object-fit:contain;filter:drop-shadow(0 0 22px var(--c)) drop-shadow(0 12px 10px rgba(0,0,0,.6));
  animation:bbi-breath 2.2s 1.2s ease-in-out infinite}
.bbi-glow{position:absolute;left:50%;bottom:4%;width:70%;height:14%;transform:translateX(-50%);border-radius:50%;
  background:radial-gradient(ellipse,rgba(0,0,0,.65),transparent 70%)}
.bbi-txt{flex:1 1 auto;min-width:0;padding:0 4vw 0 1vw;display:flex;flex-direction:column;justify-content:center;gap:1.4vh}
.bbi-badge{align-self:flex-start;display:inline-block;transform:rotate(-3deg);white-space:nowrap;margin-bottom:.6vh;padding:.25em .8em;border-radius:.4em;background:#e8262b;color:#fff;
  font-size:clamp(13px,4vh,34px);letter-spacing:.06em;border:3px solid #fff;box-shadow:0 0 0 3px #1e1527,0 0 24px rgba(255,40,40,.8);
  animation:bbi-badge .45s .15s cubic-bezier(.2,1.6,.4,1) both, bbi-blink .9s 1s ease-in-out infinite}
.bbi-lvl{font-family:'Nunito','Segoe UI',sans-serif;font-weight:900;font-size:clamp(11px,3.2vh,24px);letter-spacing:.2em;color:#ffe58a;
  text-shadow:0 2px 0 #1e1527;animation:bbi-fade .4s .5s both}
.bbi-name{font-size:clamp(34px,15vh,140px);line-height:.95;color:#fff;white-space:nowrap;
  text-shadow:0 .05em 0 #1e1527,.04em .04em 0 #1e1527,-.04em .04em 0 #1e1527,0 0 .35em var(--c),0 0 .9em var(--c)}
.bbi-name span{display:inline-block;animation:bbi-drop .55s cubic-bezier(.2,1.5,.4,1) both}
.bbi-title{font-size:clamp(16px,6vh,54px);color:var(--c);text-shadow:0 3px 0 #1e1527,0 0 14px rgba(0,0,0,.6);
  -webkit-text-stroke:1px #1e1527;animation:bbi-slide .5s 1.25s cubic-bezier(.2,.9,.3,1.1) both;filter:brightness(1.35)}
.bbi-quote{font-family:'Nunito','Segoe UI',sans-serif;font-weight:800;font-style:italic;font-size:clamp(12px,4vh,30px);color:#fff8e8;
  max-width:46em;background:rgba(0,0,0,.45);border-left:.3em solid var(--c);padding:.45em .8em;border-radius:.3em;
  text-shadow:0 2px 0 #000;animation:bbi-fade .4s 1.7s both;min-height:2.6em}
.bbi-tap{position:absolute;left:0;right:0;bottom:2.2vh;z-index:7;text-align:center;font-size:clamp(14px,4.4vh,34px);color:#fff;
  text-shadow:0 3px 0 #1e1527;animation:bbi-fade .3s 2.4s both, bbi-blink 1.1s 2.7s ease-in-out infinite}
.bbi-bar{position:absolute;left:0;bottom:0;height:5px;z-index:8;background:var(--c);box-shadow:0 0 10px var(--c);animation:bbi-bar linear both}
.bbi-flash{position:absolute;inset:0;z-index:9;background:#fff;pointer-events:none;opacity:0;animation:bbi-flash .5s .55s ease-out both}
.bbi-flash.f2{animation-delay:1.1s;animation-duration:.35s}
.bbi-shake{animation:bbi-shake .5s .6s both}
@keyframes bbi-in{from{opacity:0}to{opacity:1}}
@keyframes bbi-out{to{opacity:0;transform:scale(1.06)}}
@keyframes bbi-fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes bbi-bandt{from{transform:translateY(-100%)}to{transform:none}}
@keyframes bbi-bandb{from{transform:translateY(100%)}to{transform:none}}
@keyframes bbi-hzt{from{background-position:0 0}to{background-position:400px 0}}
@keyframes bbi-spin{to{transform:rotate(360deg)}}
@keyframes bbi-lines{from{background-position:0 0}to{background-position:-120px 0}}
@keyframes bbi-bgpulse{from{filter:brightness(.85)}to{filter:brightness(1.15)}}
@keyframes bbi-emb{0%{opacity:0;transform:translateY(0)}10%{opacity:.9}100%{opacity:0;transform:translateY(-110vh) translateX(30px)}}
@keyframes bbi-zoom{0%{opacity:0;transform:scale(2.6) translateY(-6%);filter:blur(8px) brightness(3)}60%{opacity:1;filter:blur(0) brightness(1.4)}100%{opacity:1;transform:none;filter:none}}
@keyframes bbi-breath{0%,100%{transform:scale(1)}50%{transform:scale(1.025,0.985)}}
@keyframes bbi-badge{from{opacity:0;transform:scale(1.8) rotate(-10deg)}to{opacity:1;transform:rotate(-3deg)}}
@keyframes bbi-blink{0%,100%{opacity:1}50%{opacity:.55}}
@keyframes bbi-drop{0%{opacity:0;transform:translateY(-1.2em) scale(1.6)}100%{opacity:1;transform:none}}
@keyframes bbi-slide{from{opacity:0;transform:translateX(1.5em)}to{opacity:1;transform:none}}
@keyframes bbi-bar{from{width:0}to{width:100%}}
@keyframes bbi-flash{0%{opacity:.85}100%{opacity:0}}
@keyframes bbi-shake{0%,100%{transform:none}15%{transform:translate(-14px,8px)}30%{transform:translate(12px,-10px)}45%{transform:translate(-9px,-6px)}60%{transform:translate(7px,7px)}75%{transform:translate(-4px,3px)}}
@media (max-aspect-ratio:1/1){.bbi-stage{flex-direction:column}.bbi-spr{flex:0 0 46%;width:100%}.bbi-txt{align-items:center;text-align:center;padding:0 4vw}.bbi-badge{align-self:center}.bbi-name{white-space:normal;font-size:clamp(30px,9vh,90px)}}
@media (prefers-reduced-motion:reduce){.bbi-rays,.bbi-lines,.bbi-emb{animation:none;display:none}.bbi-shake{animation:none}}
`;

  // Silueta de reserva (si aún no hay sprite): forma según el jefe, ojos brillantes
  const SHAPES = {
    king: 'M60 300 L60 200 Q60 150 100 140 L100 110 L85 70 L110 95 L125 60 L140 95 L155 60 L170 95 L195 70 L180 110 L180 140 Q220 150 220 200 L220 300 Z M30 300 L30 240 L250 240 L250 300 Z',
    hood: 'M70 300 Q60 220 85 170 Q95 120 140 60 Q185 120 195 170 Q220 220 210 300 Z M215 300 L222 40 L232 40 L228 300 Z',
    brute: 'M30 300 Q20 220 50 170 Q60 130 95 120 L80 70 L110 100 Q140 80 170 100 L200 70 L185 120 Q220 130 230 170 Q260 220 250 300 Z',
    golem: 'M40 300 L40 210 L20 200 L20 140 L60 130 L60 90 L100 90 L100 60 L180 60 L180 90 L220 90 L220 130 L260 140 L260 200 L240 210 L240 300 Z',
    scorpion: 'M10 300 Q20 250 70 240 L190 240 Q240 230 250 190 Q255 120 210 90 Q190 80 200 60 Q235 70 262 110 Q280 170 260 230 Q250 270 270 300 Z M110 240 L120 160 Q140 140 160 160 L170 240 Z',
    dragon: 'M20 300 Q40 230 90 220 L60 120 Q100 150 120 190 L130 110 Q150 40 140 20 Q190 60 180 130 L200 190 Q230 150 270 120 L240 220 Q270 240 280 300 Z',
  };
  const SHAPE_OF = { rey_goblin: 'king', chaman_gigante: 'hood', nigromante: 'hood', troll_piedra: 'brute', senor_fuego: 'brute', senor_guerra: 'brute', gigante_escarcha: 'brute', golem: 'golem', escorpion: 'scorpion', dragon: 'dragon' };
  const EYES = { king: [[118, 175], [162, 175]], hood: [[125, 150], [155, 150]], brute: [[120, 150], [160, 150]], golem: [[115, 115], [165, 115]], scorpion: [[130, 195], [150, 195]], dragon: [[150, 80], [165, 85]] };

  let active = null;
  let styleEl = null;

  function ensureStyle() {
    if (styleEl && styleEl.isConnected) return;
    styleEl = document.createElement('style');
    styleEl.id = 'bb-boss-intro-style';
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);
  }
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function silhouette(id, color) {
    const shape = SHAPE_OF[id] || 'brute';
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 280 310');
    svg.setAttribute('width', '280'); svg.setAttribute('height', '310');
    svg.style.height = '100%'; svg.style.width = 'auto';
    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = '<radialGradient id="bbi-g" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#2a1c26"/><stop offset="1" stop-color="#05030a"/></radialGradient>';
    svg.appendChild(defs);
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', SHAPES[shape]);
    p.setAttribute('fill', 'url(#bbi-g)');
    p.setAttribute('stroke', color); p.setAttribute('stroke-width', '5'); p.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(p);
    for (const e of EYES[shape]) {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', e[0]); c.setAttribute('cy', e[1]); c.setAttribute('r', '7');
      c.setAttribute('fill', '#fff'); c.setAttribute('style', 'filter:drop-shadow(0 0 6px ' + color + ') drop-shadow(0 0 12px ' + color + ')');
      svg.appendChild(c);
    }
    const q = el('div'); q.style.cssText = 'position:absolute;top:28%;left:0;right:0;text-align:center;font-size:clamp(40px,18vh,150px);color:' + color + ';opacity:.85;text-shadow:0 0 20px ' + color;
    q.textContent = '?';
    return { svg, mark: q };
  }
  function spriteNode(id) {
    let img = null;
    try {
      img = BB.rig && BB.rig.has('boss_' + id) ? BB.rig.image('boss_' + id, 600)
        : (BB.assets && BB.assets.get ? BB.assets.get('boss_' + id) : null);
    } catch (err) { img = null; }
    if (!img) return null;
    if (img.src) { const n = new Image(); n.src = img.src; n.alt = ''; n.draggable = false; return n; }
    try {   // lienzo o ImageBitmap
      const c = document.createElement('canvas');
      c.width = img.width || img.naturalWidth; c.height = img.height || img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      c.style.maxHeight = '100%'; c.style.maxWidth = '100%'; c.style.height = '100%'; c.style.width = 'auto'; c.style.objectFit = 'contain';
      return c;
    } catch (err) { return null; }
  }
  function callAudio(fn, arg) {
    const A = BB.audio;
    if (A && typeof A[fn] === 'function') { try { A[fn](arg); } catch (err) { /* sin sonido */ } }
  }

  function play(bossId, onDone) {
    if (active) active.close(true);
    const def = (BB.data && BB.data.bosses && BB.data.bosses[bossId]) || {};
    const color = def.color || '#ff5a4a';
    const name = def.name || String(bossId || '¿?');
    ensureStyle();

    const root = el('div', 'bbi');
    root.style.setProperty('--c', color);
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Jefe: ' + name);
    const shake = el('div', 'bbi-shake'); shake.style.cssText = 'position:absolute;inset:0';
    shake.appendChild(el('div', 'bbi-bg'));
    shake.appendChild(el('div', 'bbi-rays'));
    shake.appendChild(el('div', 'bbi-lines'));
    for (let i = 0; i < 18; i++) {
      const m = el('div', 'bbi-emb');
      m.style.left = (Math.random() * 100).toFixed(1) + '%';
      m.style.animationDuration = (2.5 + Math.random() * 3).toFixed(2) + 's';
      m.style.animationDelay = (Math.random() * 3).toFixed(2) + 's';
      const s = (3 + Math.random() * 6).toFixed(1) + 'px';
      m.style.width = s; m.style.height = s;
      shake.appendChild(m);
    }
    shake.appendChild(el('div', 'bbi-vig'));

    const stage = el('div', 'bbi-stage');
    const spr = el('div', 'bbi-spr');
    spr.appendChild(el('div', 'bbi-glow'));
    const sprIn = el('div', 'bbi-spr-in');
    const node = spriteNode(bossId);
    if (node) sprIn.appendChild(node);
    else { const s = silhouette(bossId, color); sprIn.appendChild(s.svg); sprIn.appendChild(s.mark); }
    spr.appendChild(sprIn);
    stage.appendChild(spr);

    const txt = el('div', 'bbi-txt');
    txt.appendChild(el('div', 'bbi-badge', def.level >= 100 ? '¡JEFE FINAL!' : '¡JEFE!'));
    if (def.level) txt.appendChild(el('div', 'bbi-lvl', 'NIVEL ' + def.level));
    const nameEl = el('div', 'bbi-name');
    const letters = Array.from(name);
    letters.forEach(function (ch, i) {
      const s = el('span', null, ch === ' ' ? ' ' : ch);
      s.style.animationDelay = (0.75 + i * 0.045).toFixed(3) + 's';
      nameEl.appendChild(s);
    });
    txt.appendChild(nameEl);
    if (def.title) txt.appendChild(el('div', 'bbi-title', def.title));
    const quote = el('div', 'bbi-quote');
    txt.appendChild(quote);
    stage.appendChild(txt);
    shake.appendChild(stage);
    root.appendChild(shake);

    root.appendChild(el('div', 'bbi-band t'));
    root.appendChild(el('div', 'bbi-band b'));
    root.appendChild(el('div', 'bbi-hz t'));
    root.appendChild(el('div', 'bbi-hz b'));
    root.appendChild(el('div', 'bbi-tap', 'Toca para luchar'));
    const bar = el('div', 'bbi-bar'); bar.style.animationDuration = AUTO_CLOSE + 's';
    root.appendChild(bar);
    root.appendChild(el('div', 'bbi-flash'));
    root.appendChild(el('div', 'bbi-flash f2'));

    (document.body || document.documentElement).appendChild(root);

    // Ajuste del nombre si no cabe en una línea
    const fit = function () {
      try {
        nameEl.style.fontSize = '';
        const avail = txt.clientWidth * 0.98;
        if (avail > 0 && nameEl.scrollWidth > avail) {
          const fs = parseFloat(getComputedStyle(nameEl).fontSize);
          nameEl.style.fontSize = Math.max(22, Math.floor(fs * avail / nameEl.scrollWidth)) + 'px';
        }
      } catch (err) { /* nada */ }
    };
    fit();

    // Frase con efecto máquina de escribir
    const q = def.quote ? '«' + def.quote + '»' : '';
    let qi = 0;
    const timers = [];
    timers.push(setTimeout(function typeNext() {
      if (!root.isConnected) return;
      qi = Math.min(q.length, qi + 1);
      quote.textContent = q.slice(0, qi);
      if (qi < q.length) timers.push(setTimeout(typeNext, 28));
    }, 1750));
    if (!q) quote.style.display = 'none';

    callAudio('sfx', 'boss_intro');
    callAudio('music', 'jefe');
    if (navigator.vibrate) { try { navigator.vibrate([60, 60, 120]); } catch (err) { /* nada */ } }

    const t0 = performance.now();
    let closed = false;
    function close(silent) {
      if (closed) return;
      closed = true;
      timers.forEach(clearTimeout);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', fit);
      if (active === handle) active = null;
      if (silent) { root.remove(); return; }
      root.classList.add('out');
      setTimeout(function () { root.remove(); }, 360);
      if (typeof onDone === 'function') setTimeout(function () { try { onDone(); } catch (err) { console.error('[bossIntro onDone]', err); } }, 200);
    }
    function tryClose() { if ((performance.now() - t0) / 1000 >= MIN_TAP) close(false); }
    function onKey(ev) {
      if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); tryClose(); }
    }
    root.addEventListener('pointerdown', function (ev) { ev.preventDefault(); ev.stopPropagation(); tryClose(); });
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', fit);
    timers.push(setTimeout(function () { close(false); }, AUTO_CLOSE * 1000));

    const handle = { close: function (silent) { close(!!silent); }, el: root };
    active = handle;
    return handle;
  }

  BB.bossIntro = { play, isActive: function () { return !!active; } };
})();
