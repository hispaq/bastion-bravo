/* Bastión Bravo · mini-framework de interfaz (pantallas DOM sobre el canvas)
   API: BB.ui.init(), register({id, el, show(params), hide(), tick?(dt), overlay?}), show(id, params), hide(id),
   back(), toast(texto), modal({title, body, buttons}), confirm(texto, siFn, opts), topBar(opts), refreshTop(),
   button(...), icon(nombre), sprite(clave), portrait(clave), vibrate(patrón), sfx(nombre). */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};

  // ---------------------------------------------------------------- utilidades
  function el(tag, attrs, children) {
    if (BB.util && BB.util.el) return BB.util.el(tag, attrs, children);
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    if (children != null) for (const c of [].concat(children)) {
      if (c == null || c === false) continue;
      n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return n;
  }
  function fmt(n) {
    if (BB.util && BB.util.fmt) return BB.util.fmt(n);
    return String(Math.floor(Number(n) || 0));
  }
  function save() { return (BB.save && BB.save.data) || null; }
  function settings() { const d = save(); return (d && d.settings) || {}; }
  function sfx(name, opts) {
    if (BB.audio && BB.audio.sfx) { try { BB.audio.sfx(name, opts); } catch (err) { /* sin sonido */ } }
  }
  function hashStr(s) {
    if (BB.util && BB.util.hashStr) return BB.util.hashStr(String(s));
    let h = 2166136261 >>> 0;
    s = String(s);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function colorFor(id) {
    const h = hashStr(id) % 360;
    return 'hsl(' + h + ',62%,52%)';
  }

  // ---------------------------------------------------------------- iconos SVG (alternativa a icon_*.png)
  const K = 'stroke="#2b1708" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"';
  const STAR_PATH = 'M32 6 L39.1 23.3 L57.7 24.7 L43.4 36.7 L47.9 54.8 L32 45 L16.1 54.8 L20.6 36.7 L6.3 24.7 L24.9 23.3 Z';
  const ICONS = {
    gold: '<ellipse cx="32" cy="35" rx="25" ry="24" fill="#c98712" ' + K + '/><circle cx="32" cy="31" r="24" fill="#ffd23f" ' + K + '/>' +
      '<circle cx="32" cy="31" r="16" fill="none" stroke="#e8a417" stroke-width="3.5"/>' +
      '<path d="M32 21 l3 6.5 7 .8-5.2 4.8 1.5 7-6.3-3.6-6.3 3.6 1.5-7-5.2-4.8 7-.8z" fill="#f2ab1a"/>' +
      '<path d="M17 22 a18 18 0 0 1 10-7.5" fill="none" stroke="#fff8d0" stroke-width="4" stroke-linecap="round"/>',
    gem: '<path d="M12 25 L22 12 H42 L52 25 L32 55 Z" fill="#b35cff"/><path d="M22 12 L27 25 H12 Z" fill="#dcaeff"/>' +
      '<path d="M27 25 H37 L32 55 Z" fill="#c983ff"/><path d="M42 12 L37 25 H52 Z" fill="#9440e6"/>' +
      '<path d="M12 25 H52 M22 12 L27 25 L32 55 L37 25 L42 12" fill="none" stroke="#5d1aa3" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M12 25 L22 12 H42 L52 25 L32 55 Z" fill="none" ' + K + '/><path d="M19 21 l4-5" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
    star: '<path d="' + STAR_PATH + '" fill="#ffd23f" ' + K + '/><path d="M24 26 L28.5 25.5 L31 18" fill="none" stroke="#fff8c8" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>',
    heart: '<path d="M32 55 C14 43 7 33 9 23 C11 14 22 10 32 20 C42 10 53 14 55 23 C57 33 50 43 32 55 Z" fill="#ff4d4d" ' + K + '/>' +
      '<path d="M17 24 q1.5-6 8-7" fill="none" stroke="#ffd0d0" stroke-width="4" stroke-linecap="round"/>',
    shield: '<path d="M32 7 L53 14 V30 C53 44 44 52 32 58 C20 52 11 44 11 30 V14 Z" fill="#9fb6cc" ' + K + '/>' +
      '<path d="M32 13 L47 18 V30 C47 41 40 47 32 51 Z" fill="#cfdeeb"/>',
    wall: '<path d="M8 22 H15 V12 H25 V22 H39 V12 H49 V22 H56 V56 H8 Z" fill="#b3b7bf" ' + K + '/>' +
      '<path d="M8 34 H56 M8 45 H56 M22 22 V34 M42 22 V34 M15 34 V45 M32 34 V45 M49 34 V45 M24 45 V56 M40 45 V56" stroke="#6b7079" stroke-width="2.5"/>',
    tower: '<path d="M18 58 V25 H13 V11 H21 V17 H28 V11 H36 V17 H43 V11 H51 V25 H46 V58 Z" fill="#b8bcc4" ' + K + '/>' +
      '<path d="M27 58 V47 a5 5 0 0 1 10 0 V58" fill="#6b4423" ' + K + '/><rect x="29" y="28" width="6" height="9" rx="3" fill="#3a2a1a"/>',
    castle: '<path d="M6 58 V22 H3 V11 H9 V15 H14 V11 H20 V22 H18 V30 H46 V22 H44 V11 H50 V15 H55 V11 H61 V22 H58 V58 Z" fill="#c2c6cd" ' + K + '/>' +
      '<path d="M25 58 V45 a7 7 0 0 1 14 0 V58 Z" fill="#7a4a22" ' + K + '/><rect x="9" y="29" width="5" height="8" rx="2.5" fill="#3a2a1a"/>' +
      '<rect x="50" y="29" width="5" height="8" rx="2.5" fill="#3a2a1a"/><path d="M32 30 V20 M32 20 L42 23 L32 26" fill="#e0402f" stroke="#2b1708" stroke-width="2.5" stroke-linejoin="round"/>',
    crossbow: '<path d="M8 26 Q32 6 56 26" fill="none" stroke="#2b1708" stroke-width="10" stroke-linecap="round"/>' +
      '<path d="M8 26 Q32 6 56 26" fill="none" stroke="#b5793f" stroke-width="4.5" stroke-linecap="round"/>' +
      '<path d="M9 27 L32 33 L55 27" fill="none" stroke="#f3e6c8" stroke-width="2.5"/>' +
      '<rect x="28" y="14" width="8" height="45" rx="3" fill="#8a5530" ' + K + '/><path d="M32 3 L38 13 H26 Z" fill="#d6dde5" ' + K + '/>',
    chest: '<path d="M8 31 H56 V56 H8 Z" fill="#a8682f" ' + K + '/><path d="M8 31 C8 15 56 15 56 31 Z" fill="#c9843f" ' + K + '/>' +
      '<path d="M18 19 V56 M46 19 V56" stroke="#e8a417" stroke-width="4"/><rect x="27" y="28" width="10" height="13" rx="2" fill="#ffd23f" ' + K + '/>' +
      '<path d="M8 31 H56" stroke="#2b1708" stroke-width="3"/>',
    hammer: '<g transform="rotate(-38 32 32)"><rect x="28" y="24" width="8" height="36" rx="3" fill="#a8682f" ' + K + '/>' +
      '<rect x="13" y="7" width="38" height="17" rx="3" fill="#a9b2bc" ' + K + '/></g><path d="M50 42 v14 M43 49 h14" stroke="#2b1708" stroke-width="8" stroke-linecap="round"/>' +
      '<path d="M50 42 v14 M43 49 h14" stroke="#7ad84f" stroke-width="4" stroke-linecap="round"/>',
    slots: '<rect x="8" y="8" width="21" height="21" rx="5" fill="#ffd9a0" ' + K + '/><rect x="35" y="8" width="21" height="21" rx="5" fill="#ffd9a0" ' + K + '/>' +
      '<rect x="8" y="35" width="21" height="21" rx="5" fill="#ffd9a0" ' + K + '/><rect x="35" y="35" width="21" height="21" rx="5" fill="#7ad84f" ' + K + '/>' +
      '<path d="M45.5 40 v11 M40 45.5 h11" stroke="#fff" stroke-width="4" stroke-linecap="round"/>',
    sword: '<g transform="rotate(45 32 32)"><path d="M28 42 V11 L32 3 L36 11 V42 Z" fill="#e3e9f0" ' + K + '/>' +
      '<rect x="18" y="41" width="28" height="7" rx="3" fill="#e8a417" ' + K + '/><rect x="29" y="48" width="6" height="12" rx="2" fill="#7a4a22" ' + K + '/></g>',
    clock: '<circle cx="32" cy="35" r="23" fill="#fff6e0" ' + K + '/><path d="M32 22 V35 L41 41" fill="none" stroke="#2b1708" stroke-width="4" stroke-linecap="round"/>' +
      '<rect x="26" y="4" width="12" height="7" rx="2" fill="#e0402f" ' + K + '/>',
    pause: '<rect x="15" y="11" width="12" height="42" rx="3" fill="#fff" ' + K + '/><rect x="37" y="11" width="12" height="42" rx="3" fill="#fff" ' + K + '/>',
    play: '<path d="M19 9 L54 32 L19 55 Z" fill="#fff" ' + K + '/>',
    speed: '<path d="M6 14 L29 32 L6 50 Z M31 14 L54 32 L31 50 Z" fill="#fff" ' + K + '/>',
    gear: '<path d="M27 4 h10 l2 9 a20 20 0 0 1 7 4 l9-3 5 9 -7 6 a20 20 0 0 1 0 8 l7 6 -5 9 -9-3 a20 20 0 0 1 -7 4 l-2 9 h-10 l-2-9 a20 20 0 0 1 -7-4 l-9 3 -5-9 7-6 a20 20 0 0 1 0-8 l-7-6 5-9 9 3 a20 20 0 0 1 7-4 z" fill="#c3cbd4" ' + K + '/>' +
      '<circle cx="32" cy="33" r="8" fill="#6d7680" ' + K + '/>',
    trophy: '<path d="M18 14 H8 C8 26 14 31 21 31 M46 14 H56 C56 26 50 31 43 31" fill="none" stroke="#2b1708" stroke-width="4"/>' +
      '<path d="M18 7 H46 V22 C46 34 39 40 32 40 C25 40 18 34 18 22 Z" fill="#ffd23f" ' + K + '/>' +
      '<path d="M28 40 H36 V48 H28 Z" fill="#e8a417" ' + K + '/><rect x="17" y="48" width="30" height="9" rx="2" fill="#a8682f" ' + K + '/>' +
      '<path d="M25 13 v11" stroke="#fff6c0" stroke-width="4" stroke-linecap="round"/>',
    gift: '<rect x="12" y="37" width="40" height="21" rx="2" fill="#e0402f" ' + K + '/><rect x="8" y="26" width="48" height="12" rx="2" fill="#ff6a52" ' + K + '/>' +
      '<rect x="28" y="26" width="8" height="32" fill="#ffd23f" ' + K + '/><path d="M32 26 C23 11 11 16 19 25 Z M32 26 C41 11 53 16 45 25 Z" fill="#ffd23f" ' + K + '/>',
    shop: '<path d="M11 23 H53 L48 58 H16 Z" fill="#c9843f" ' + K + '/><path d="M22 23 V17 a10 10 0 0 1 20 0 V23" fill="none" stroke="#2b1708" stroke-width="4"/>' +
      '<circle cx="32" cy="40" r="8.5" fill="#ffd23f" ' + K + '/>',
    helmet: '<path d="M30 10 C30 1 45 -2 54 6 C46 5 39 7 35 12 Z" fill="#e0402f" ' + K + '/>' +
      '<path d="M12 41 C12 19 21 9 32 9 C43 9 52 19 52 41 V52 H12 Z" fill="#c3cbd4" ' + K + '/>' +
      '<path d="M21 30 H43 V36 H21 Z" fill="#3a2a1a" ' + K + '/><path d="M32 40 V52" stroke="#2b1708" stroke-width="3"/>',
    map: '<path d="M6 14 L22 8 L42 14 L58 8 V50 L42 56 L22 50 L6 56 Z" fill="#f3e2b0" ' + K + '/>' +
      '<path d="M22 8 V50 M42 14 V56" stroke="#c9a46a" stroke-width="3"/>' +
      '<path d="M12 42 C20 32 27 45 33 32 S45 24 47 22" fill="none" stroke="#e0402f" stroke-width="3" stroke-dasharray="4 4"/>' +
      '<path d="M46 15 l7 7 m0-7 l-7 7" stroke="#e0402f" stroke-width="3.5" stroke-linecap="round"/>',
    music: '<path d="M24 14 L50 8 V16 L24 22 Z" fill="#5fc4ff" ' + K + '/><path d="M24 46 V18 M50 40 V12" stroke="#2b1708" stroke-width="5"/>' +
      '<ellipse cx="18" cy="47" rx="8" ry="6.5" fill="#5fc4ff" ' + K + '/><ellipse cx="44" cy="41" rx="8" ry="6.5" fill="#5fc4ff" ' + K + '/>',
    sound: '<path d="M8 24 H18 L32 12 V52 L18 40 H8 Z" fill="#ffd23f" ' + K + '/>' +
      '<path d="M40 23 C44 27 44 37 40 41 M46 16 C54 24 54 40 46 48" fill="none" stroke="#2b1708" stroke-width="4.5" stroke-linecap="round"/>',
    vibrate: '<rect x="20" y="8" width="24" height="48" rx="5" fill="#5fc4ff" ' + K + '/><rect x="25" y="14" width="14" height="30" rx="2" fill="#e8f6ff"/>' +
      '<path d="M12 22 L8 26 L12 30 L8 34 L12 38 M52 22 L56 26 L52 30 L56 34 L52 38" fill="none" stroke="#2b1708" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>',
    lock: '<path d="M20 29 V20 a12 12 0 0 1 24 0 V29" fill="none" stroke="#2b1708" stroke-width="8"/>' +
      '<path d="M20 29 V20 a12 12 0 0 1 24 0 V29" fill="none" stroke="#c3cbd4" stroke-width="3"/>' +
      '<rect x="12" y="28" width="40" height="30" rx="5" fill="#ffd23f" ' + K + '/><path d="M32 38 V48" stroke="#2b1708" stroke-width="5" stroke-linecap="round"/>',
    check: '<circle cx="32" cy="32" r="26" fill="#5fcf3a" ' + K + '/><path d="M19 33 L28 42 L46 22" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
    close: '<path d="M17 17 L47 47 M47 17 L17 47" stroke="#2b1708" stroke-width="14" stroke-linecap="round"/><path d="M17 17 L47 47 M47 17 L17 47" stroke="#fff" stroke-width="6.5" stroke-linecap="round"/>',
    back: '<path d="M29 9 L7 32 L29 55 V43 H56 V21 H29 Z" fill="#fff" ' + K + '/>',
    next: '<path d="M35 9 L57 32 L35 55 V43 H8 V21 H35 Z" fill="#fff" ' + K + '/>',
    left: '<path d="M42 8 L16 32 L42 56 Z" fill="#fff" ' + K + '/>',
    right: '<path d="M22 8 L48 32 L22 56 Z" fill="#fff" ' + K + '/>',
    skull: '<path d="M32 6 C16 6 8 17 8 30 C8 38 13 42 17 44 V55 H47 V44 C51 42 56 38 56 30 C56 17 48 6 32 6 Z" fill="#f4efe2" ' + K + '/>' +
      '<circle cx="22" cy="30" r="6.5" fill="#2b1708"/><circle cx="42" cy="30" r="6.5" fill="#2b1708"/><path d="M32 36 L28 44 H36 Z" fill="#2b1708"/>' +
      '<path d="M25 55 V49 M32 55 V49 M39 55 V49" stroke="#2b1708" stroke-width="3"/>',
    crown: '<path d="M8 22 L20 35 L32 12 L44 35 L56 22 L52 52 H12 Z" fill="#ffd23f" ' + K + '/>' +
      '<circle cx="32" cy="41" r="4.5" fill="#e0402f" stroke="#2b1708" stroke-width="2.5"/><circle cx="19" cy="43" r="3" fill="#5fc4ff"/><circle cx="45" cy="43" r="3" fill="#5fc4ff"/>',
    bolt: '<path d="M36 4 L12 36 H30 L26 60 L52 26 H34 Z" fill="#ffd23f" ' + K + '/>',
    up: '<path d="M32 6 L56 32 H42 V58 H22 V32 H8 Z" fill="#7ad84f" ' + K + '/>',
    refresh: '<path d="M50 31 A18 18 0 1 1 40 15.5" fill="none" stroke="#2b1708" stroke-width="11" stroke-linecap="round"/>' +
      '<path d="M50 31 A18 18 0 1 1 40 15.5" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/><path d="M33 5 L51 9 L42 25 Z" fill="#fff" ' + K + '/>',
    info: '<circle cx="32" cy="32" r="26" fill="#5fc4ff" ' + K + '/><circle cx="32" cy="19" r="4.5" fill="#fff"/><rect x="28" y="27" width="8" height="22" rx="3" fill="#fff"/>',
    exit: '<rect x="10" y="6" width="30" height="52" rx="3" fill="#a8682f" ' + K + '/><circle cx="33" cy="34" r="3" fill="#ffd23f"/>' +
      '<path d="M43 32 H59 M51 24 L59 32 L51 40" fill="none" stroke="#2b1708" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
    flag: '<path d="M14 6 V60" stroke="#2b1708" stroke-width="5" stroke-linecap="round"/><path d="M16 8 C28 2 36 14 52 8 V34 C36 40 28 28 16 34 Z" fill="#e0402f" ' + K + '/>',
    quality: '<path d="M32 4 L38 26 L60 32 L38 38 L32 60 L26 38 L4 32 L26 26 Z" fill="#cf86ff" ' + K + '/><circle cx="32" cy="32" r="4" fill="#fff"/>',
    auto: '<circle cx="32" cy="32" r="26" fill="#7ad84f" ' + K + '/><path d="M21 46 L32 17 L43 46 M25.5 37 H38.5" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
    trap: '<path d="M6 53 L14 25 L22 53 L30 21 L38 53 L46 25 L54 53 Z" fill="#d6dde5" ' + K + '/><rect x="4" y="51" width="56" height="9" rx="2" fill="#7a4a22" ' + K + '/>',
    users: '<circle cx="22" cy="22" r="9" fill="#ffcf9a" ' + K + '/><path d="M6 54 C6 38 38 38 38 54 Z" fill="#5fc4ff" ' + K + '/>' +
      '<circle cx="42" cy="20" r="9" fill="#ffcf9a" ' + K + '/><path d="M28 50 C28 36 58 36 58 50 Z" fill="#7ad84f" ' + K + '/>',
    book: '<path d="M6 12 C16 8 26 10 32 16 C38 10 48 8 58 12 V54 C48 50 38 52 32 58 C26 52 16 50 6 54 Z" fill="#f3e2b0" ' + K + '/><path d="M32 16 V58" stroke="#2b1708" stroke-width="3"/>',
    question: '<circle cx="32" cy="32" r="26" fill="#cf86ff" ' + K + '/><path d="M24 25 a8 8 0 1 1 11 7 c-2 1-3 3-3 5 v2" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><circle cx="32" cy="48" r="3.8" fill="#fff"/>',
    fire: '<path d="M32 4 C40 16 52 24 50 40 C48 54 38 60 32 60 C24 60 14 54 14 41 C14 30 22 26 24 16 C28 22 30 26 30 30 C34 24 34 14 32 4 Z" fill="#ff8a2a" ' + K + '/>' +
      '<path d="M32 30 C37 38 42 42 40 50 C38 56 26 56 25 49 C24 43 30 40 32 30 Z" fill="#ffd23f"/>',
    snow: '<path d="M32 6 V58 M9.5 19 L54.5 45 M9.5 45 L54.5 19" stroke="#2b1708" stroke-width="9" stroke-linecap="round"/>' +
      '<path d="M32 6 V58 M9.5 19 L54.5 45 M9.5 45 L54.5 19" stroke="#bfeaff" stroke-width="4" stroke-linecap="round"/>',
    poison: '<path d="M24 8 H40 V22 L52 46 C55 53 51 58 44 58 H20 C13 58 9 53 12 46 L24 22 Z" fill="#7ad84f" ' + K + '/><rect x="22" y="4" width="20" height="7" rx="2" fill="#a8682f" ' + K + '/>' +
      '<circle cx="27" cy="44" r="4" fill="#c6f59a"/><circle cx="37" cy="38" r="3" fill="#c6f59a"/>',
  };
  const ICON_ALIAS = {
    gems: 'gem', coin: 'gold', oro: 'gold', gema: 'gem', estrella: 'star', stars: 'star', settings: 'gear', ajustes: 'gear',
    achievements: 'trophy', logros: 'trophy', daily: 'gift', army: 'helmet', ejercito: 'helmet', tienda: 'shop', jugar: 'play',
    torreon: 'tower', muralla: 'wall', huecos: 'slots', ballesta: 'crossbow', tesoro: 'chest', reparacion: 'hammer',
    hp: 'heart', vida: 'heart', castillo: 'castle', heroes: 'users', towers: 'tower', torres: 'tower', boss: 'crown',
    enemy: 'skull', kills: 'skull', time: 'clock', wave: 'flag', sfx: 'sound', efectos: 'sound', vibration: 'vibrate',
    upgrade: 'up', restart: 'refresh', reset: 'refresh', quit: 'exit', salir: 'exit', autoSkills: 'auto',
  };

  function svgIcon(name) {
    const key = ICONS[name] ? name : ICON_ALIAS[name];
    const body = ICONS[key] || ICONS.question;
    return '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + body + '</svg>';
  }

  function assetUrl(key) {
    const A = BB.assets;
    if (!A) return null;
    try {
      if (typeof A.url === 'function') return A.url(key);
      const img = A.get && A.get(key);
      return img && img.src ? img.src : null;
    } catch (err) { return null; }
  }

  // Icono: primero icon_<nombre> del manifiesto; si no existe o falla, SVG propio.
  function icon(name, cls) {
    const wrap = el('span', { class: 'ico' + (cls ? ' ' + cls : ''), 'data-ico': name });
    const key = ICON_ALIAS[name] && !ICONS[name] ? ICON_ALIAS[name] : name;
    const url = assetUrl('icon_' + name) || (key !== name ? assetUrl('icon_' + key) : null);
    if (url) {
      const img = el('img', { src: url, alt: '', draggable: 'false' });
      img.style.width = '100%'; img.style.height = '100%'; img.style.objectFit = 'contain';
      img.onerror = () => { wrap.innerHTML = svgIcon(name); };
      wrap.appendChild(img);
    } else wrap.innerHTML = svgIcon(name);
    return wrap;
  }

  // ---------------------------------------------------------------- sprites y marcadores de posición
  function phSvg(key) {
    const id = String(key || '').replace(/^(hero|enemy|boss|tower|castle)_/, '');
    const c = colorFor(id);
    const c2 = 'hsl(' + ((hashStr(id) % 360 + 40) % 360) + ',70%,40%)';
    const letter = (id[0] || '?').toUpperCase();
    if (/^hero_/.test(key)) {
      return '<svg viewBox="0 0 100 128" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="122" rx="30" ry="5" fill="rgba(0,0,0,.2)"/>' +
        '<path d="M24 120 L28 70 C30 58 70 58 72 70 L76 120 Z" fill="' + c + '" ' + K + '/>' +
        '<circle cx="50" cy="44" r="21" fill="#ffd3a3" ' + K + '/><path d="M28 40 C28 18 72 18 72 40 C62 30 40 30 28 40 Z" fill="' + c2 + '" ' + K + '/>' +
        '<circle cx="42" cy="47" r="3.2" fill="#2b1708"/><circle cx="56" cy="47" r="3.2" fill="#2b1708"/><path d="M44 56 q5 4 10 0" stroke="#2b1708" stroke-width="3" fill="none" stroke-linecap="round"/>' +
        '<text x="50" y="104" text-anchor="middle" font-family="Lilita One, Arial Black, sans-serif" font-size="30" fill="#fff" stroke="#2b1708" stroke-width="2.5" paint-order="stroke">' + letter + '</text></svg>';
    }
    if (/^(enemy|boss)_/.test(key)) {
      const boss = /^boss_/.test(key);
      return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="95" rx="32" ry="5" fill="rgba(0,0,0,.2)"/>' +
        '<path d="M22 92 L26 62 C30 52 70 52 74 62 L78 92 Z" fill="#6b4a2b" ' + K + '/>' +
        '<path d="M14 36 L30 44 L28 30 Z M86 36 L70 44 L72 30 Z" fill="#6dbb45" ' + K + '/>' +
        '<circle cx="50" cy="42" r="24" fill="#7fcf52" ' + K + '/>' +
        '<path d="M36 36 L46 40 M64 36 L54 40" stroke="#2b1708" stroke-width="4" stroke-linecap="round"/>' +
        '<circle cx="41" cy="44" r="4" fill="#ff3b2a"/><circle cx="59" cy="44" r="4" fill="#ff3b2a"/>' +
        '<path d="M40 56 L44 52 L48 56 L52 52 L56 56 L60 52" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>' +
        (boss ? '<path d="M32 22 L38 10 L44 20 L50 6 L56 20 L62 10 L68 22 Z" fill="#ffd23f" ' + K + '/>' : '') + '</svg>';
    }
    if (/^tower_/.test(key)) {
      return '<svg viewBox="0 0 100 110" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="106" rx="34" ry="4" fill="rgba(0,0,0,.2)"/>' +
        '<path d="M26 104 L30 40 H70 L74 104 Z" fill="#a8682f" ' + K + '/><path d="M22 40 V24 H32 V32 H44 V24 H56 V32 H68 V24 H78 V40 Z" fill="#8a5530" ' + K + '/>' +
        '<rect x="42" y="56" width="16" height="18" rx="8" fill="#3a2a1a"/><text x="50" y="98" text-anchor="middle" font-family="Lilita One, Arial Black, sans-serif" font-size="22" fill="#fff" stroke="#2b1708" stroke-width="2" paint-order="stroke">' + letter + '</text></svg>';
    }
    if (/^castle_/.test(key)) {
      const tier = Math.max(1, Math.min(5, parseInt(id, 10) || 1));
      const roof = ['#a8682f', '#3f7fd1', '#c8302a', '#7d39cc', '#e8a417'][tier - 1];
      const extra = tier >= 3 ? '<path d="M8 120 V56 H4 V44 H12 V48 H18 V44 H26 V56 H22 V120 Z" fill="#c2c6cd" ' + K + '/><path d="M2 44 L15 26 L28 44 Z" fill="' + roof + '" ' + K + '/>' : '';
      return '<svg viewBox="0 0 160 130" xmlns="http://www.w3.org/2000/svg"><ellipse cx="88" cy="126" rx="70" ry="5" fill="rgba(0,0,0,.2)"/>' + extra +
        '<path d="M30 124 V60 H26 V46 H36 V52 H44 V46 H54 V60 H50 V70 H112 V60 H108 V46 H118 V52 H126 V46 H136 V60 H132 V124 Z" fill="#c2c6cd" ' + K + '/>' +
        '<path d="M24 46 L40 22 L56 46 Z M106 46 L122 ' + (22 - tier * 2) + ' L138 46 Z" fill="' + roof + '" ' + K + '/>' +
        '<path d="M66 124 V96 a15 15 0 0 1 30 0 V124 Z" fill="#7a4a22" ' + K + '/>' +
        '<rect x="36" y="74" width="8" height="13" rx="4" fill="#3a2a1a"/><rect x="118" y="74" width="8" height="13" rx="4" fill="#3a2a1a"/>' +
        '<path d="M81 70 V40 M81 40 L98 46 L81 52" fill="#e0402f" stroke="#2b1708" stroke-width="3" stroke-linejoin="round"/>' +
        (tier >= 4 ? '<circle cx="81" cy="86" r="5" fill="#ffd23f" ' + K + '/>' : '') + '</svg>';
    }
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="80" height="80" rx="16" fill="' + c + '" ' + K + '/>' +
      '<text x="50" y="66" text-anchor="middle" font-family="Lilita One, Arial Black, sans-serif" font-size="44" fill="#fff" stroke="#2b1708" stroke-width="3" paint-order="stroke">' + letter + '</text></svg>';
  }

  function placeholder(key, cls) {
    return el('div', { class: 'spr-ph' + (cls ? ' ' + cls : ''), html: phSvg(key), 'data-key': key });
  }

  // <img> del sprite del manifiesto o marcador de posición si no existe
  function sprite(key, cls) {
    const url = assetUrl(key);
    if (!url) return placeholder(key, cls);
    const img = el('img', { class: 'spr' + (cls ? ' ' + cls : ''), src: url, alt: '', draggable: 'false', 'data-key': key });
    img.onerror = () => { if (img.parentNode) img.parentNode.replaceChild(placeholder(key, cls), img); };
    return img;
  }

  // Retrato circular: recorta la cabeza (parte superior) del sprite en un canvas
  function portrait(key, opts) {
    opts = opts || {};
    const id = String(key).replace(/^(hero|enemy|boss|tower)_/, '');
    const wrap = el('div', { class: 'portrait' + (opts.cls ? ' ' + opts.cls : '') });
    wrap.style.background = 'radial-gradient(circle at 50% 30%, #fff3cf, ' + colorFor(id) + ')';
    const initial = el('div', { class: 'ph-initial', text: (opts.letter || id[0] || '?').toUpperCase() });
    wrap.appendChild(initial);
    const draw = (img) => {
      try {
        const S = 128;
        const c = document.createElement('canvas');
        c.width = S; c.height = S;
        const g = c.getContext('2d');
        const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        if (!w || !h) return;
        const side = Math.min(w * (opts.zoom || 0.78), h * 0.62);
        const sx = Math.max(0, Math.min(w - side, w * (opts.cx != null ? opts.cx : 0.5) - side / 2));
        const sy = Math.max(0, h * (opts.top != null ? opts.top : 0.01));
        g.drawImage(img, sx, sy, side, Math.min(side, h - sy), 0, 0, S, S * Math.min(1, (h - sy) / side));
        if (initial.parentNode) wrap.removeChild(initial);
        wrap.appendChild(c);
      } catch (err) { /* se queda la inicial */ }
    };
    const loaded = BB.assets && BB.assets.get ? BB.assets.get(key) : null;
    if (loaded) draw(loaded);
    else {
      const url = assetUrl(key);
      if (url) { const im = new Image(); im.onload = () => draw(im); im.src = url; }
    }
    return wrap;
  }

  // ---------------------------------------------------------------- estado y capas
  const screens = {};
  const order = [];
  let root = null;
  const L = {};
  let current = null;
  let currentParams = null;
  const overlays = [];
  const history = [];
  let inited = false;
  let externalTick = false;
  const modals = [];

  function mount(s) {
    if (!inited || s.mounted) return;
    (s.overlay ? L.overlays : L.screens).appendChild(s.wrap);
    s.mounted = true;
  }

  function register(def, maybe) {
    if (typeof def === 'string') def = Object.assign({ id: def }, maybe || {});
    if (!def || !def.id) { console.warn('[ui] register sin id'); return null; }
    const prev = screens[def.id];
    if (prev && prev.wrap.parentNode) prev.wrap.parentNode.removeChild(prev.wrap);
    const wrap = el('div', { class: 'ui-screen' + (def.overlay ? ' ui-overlay' : ''), 'data-screen': def.id });
    const inner = def.el || el('div', { class: 'ui-screen-inner' });
    if (!def.el) def.el = inner;
    wrap.appendChild(inner);
    const s = { id: def.id, def, wrap, el: inner, overlay: !!def.overlay, mounted: false, timer: null, on: false };
    screens[def.id] = s;
    if (!prev) order.push(def.id);
    mount(s);
    return s;
  }

  function callDef(s, fn, arg) {
    if (s && s.def && typeof s.def[fn] === 'function') {
      try { return s.def[fn].call(s.def, arg, s.el); } catch (err) { console.error('[ui ' + s.id + '.' + fn + ']', err); }
    }
    return undefined;
  }

  function enter(s, params) {
    clearTimeout(s.timer);
    s.wrap.classList.remove('is-leaving');
    s.wrap.classList.add('is-on', 'is-entering');
    s.on = true;
    callDef(s, 'show', params || {});
    s.timer = setTimeout(() => s.wrap.classList.remove('is-entering'), 380);
  }

  function leave(s) {
    if (!s || !s.on) return;
    s.on = false;
    callDef(s, 'hide');
    clearTimeout(s.timer);
    s.wrap.classList.remove('is-on', 'is-entering');
    s.wrap.classList.add('is-leaving');
    s.timer = setTimeout(() => s.wrap.classList.remove('is-leaving'), 240);
  }

  const MENU_MUSIC = { menu: 'menu', shop: 'keep', hero: 'keep', army: 'keep', achievements: 'keep', daily: 'keep', settings: 'keep', map: 'mapa' };
  function musicFor(id, params) {
    if (!BB.audio || !BB.audio.music) return;
    let m = (screens[id] && screens[id].def.music) || MENU_MUSIC[id];
    if (params && params.music) m = params.music;
    if (!m) return;
    if (m === 'keep') {
      const cur = BB.audio.current;
      if (cur === 'menu' || cur === 'mapa') return;
      m = 'menu';
    }
    try { BB.audio.music(m); } catch (err) { /* nada */ }
  }

  const NO_HISTORY = { title: 1, result: 1, enemyIntro: 1, pause: 1 };

  function show(id, params) {
    if (!inited) init();
    if (id == null || id === 'none' || id === 'battle' || id === 'game') {
      closeOverlays(); closeModals();
      if (current) leave(screens[current]);
      current = null; currentParams = null;
      history.length = 0;
      return null;
    }
    const s = screens[id];
    if (!s) { console.warn('[ui] pantalla desconocida:', id); toast('Pantalla no disponible'); return null; }
    if (s.overlay) return openOverlay(s, params);
    closeOverlays(); closeModals();
    const prev = current ? screens[current] : null;
    if (prev && prev !== s) {
      if (!NO_HISTORY[prev.id] && !(params && params.noHistory)) {
        history.push({ id: prev.id, params: currentParams });
        if (history.length > 12) history.shift();
      }
      leave(prev);
    }
    if (id === 'menu' || id === 'map') history.length = 0;
    current = id;
    currentParams = params || {};
    if (prev === s) callDef(s, 'show', currentParams);
    else enter(s, currentParams);
    musicFor(id, params);
    return s;
  }

  function openOverlay(s, params) {
    const i = overlays.indexOf(s);
    if (i >= 0) overlays.splice(i, 1);
    overlays.push(s);
    L.overlays.appendChild(s.wrap);
    enter(s, params);
    return s;
  }

  function hide(id) {
    if (id == null) { if (overlays.length) { leave(overlays.pop()); return; } if (current) { leave(screens[current]); current = null; } return; }
    const s = screens[id];
    if (!s) return;
    if (s.overlay) {
      const i = overlays.indexOf(s);
      if (i >= 0) overlays.splice(i, 1);
      leave(s);
    } else if (current === id) { leave(s); current = null; }
  }

  function closeOverlays() { while (overlays.length) leave(overlays.pop()); }

  function back() {
    sfx('close');
    if (overlays.length) { hide(overlays[overlays.length - 1].id); return; }
    const h = history.pop();
    if (h && screens[h.id]) {
      const prevLen = history.length;
      show(h.id, Object.assign({}, h.params || {}, { noHistory: true }));
      history.length = prevLen;
      return;
    }
    if (BB.app && typeof BB.app.goMap === 'function' && current !== 'menu' && current !== 'map' && screens.map) { BB.app.goMap(); return; }
    if (current !== 'menu') {
      if (BB.app && typeof BB.app.goMenu === 'function') BB.app.goMenu();
      else show('menu');
    }
  }

  // ---------------------------------------------------------------- avisos
  function toast(text, opts) {
    if (!inited) init();
    opts = opts || {};
    if (typeof opts === 'string') opts = { type: opts };
    const t = el('div', { class: 'ui-toast' + (opts.type ? ' tt-' + opts.type : '') }, [opts.icon ? icon(opts.icon) : null, el('span', { text: String(text) })]);
    L.toasts.appendChild(t);
    while (L.toasts.children.length > 3) L.toasts.removeChild(L.toasts.firstChild);
    const ms = opts.time || 2200;
    setTimeout(() => t.classList.add('is-out'), ms);
    setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, ms + 320);
    return t;
  }

  // ---------------------------------------------------------------- ventanas modales
  function modal(o) {
    if (!inited) init();
    o = o || {};
    const backEl = el('div', { class: 'ui-modal-back' });
    const box = el('div', { class: 'ui-modal bb-panel' + (o.wide ? ' mw-wide' : '') + (o.cls ? ' ' + o.cls : '') });
    let closed = false;
    const handle = {
      el: box,
      close(silent) {
        if (closed) return;
        closed = true;
        const i = modals.indexOf(handle);
        if (i >= 0) modals.splice(i, 1);
        backEl.classList.add('is-out');
        setTimeout(() => { if (backEl.parentNode) backEl.parentNode.removeChild(backEl); }, 200);
        if (!silent && typeof o.onClose === 'function') { try { o.onClose(); } catch (err) { console.error(err); } }
      },
      persist: !!o.persist,
      closable: o.closable !== false,
    };
    if (o.title) box.appendChild(el('div', { class: 'panel-head' }, el('div', { class: 'ribbon' + (o.ribbon ? ' rb-' + o.ribbon : ''), text: o.title })));
    if (handle.closable && o.closeButton !== false) {
      const x = button(null, () => handle.close(), { kind: 'red', round: true, icon: 'close', cls: 'ui-modal-x', sound: 'close' });
      box.appendChild(x);
    }
    const body = el('div', { class: 'ui-modal-body ui-scroll' });
    if (o.icon) body.appendChild(icon(o.icon, 'ico-hero'));
    if (o.body != null) {
      if (typeof o.body === 'string') String(o.body).split('\n').forEach(line => body.appendChild(el('p', { text: line })));
      else body.appendChild(o.body);
    }
    box.appendChild(body);
    const btns = o.buttons || [{ label: 'Aceptar', kind: 'green' }];
    if (btns.length) {
      const row = el('div', { class: 'ui-modal-btns' });
      btns.forEach(b => {
        row.appendChild(button(b.label, () => {
          let r;
          if (typeof b.onClick === 'function') { try { r = b.onClick(handle); } catch (err) { console.error(err); } }
          if (b.close !== false && r !== false) handle.close(true);
        }, { kind: b.kind || 'green', icon: b.icon, cls: b.cls, sound: b.sound, cost: b.cost }));
      });
      box.appendChild(row);
    }
    backEl.appendChild(box);
    backEl.addEventListener('pointerdown', (e) => { if (e.target === backEl && handle.closable && o.tapOutside !== false) handle.close(); });
    L.modals.appendChild(backEl);
    modals.push(handle);
    if (o.sound !== false) sfx(o.sound || 'open');
    return handle;
  }

  function closeModals() {
    for (const m of modals.slice()) if (!m.persist) m.close(true);
  }

  function confirmBox(text, onYes, opts) {
    opts = opts || {};
    return new Promise(resolve => {
      let answered = false;
      modal({
        title: opts.title || '¿Seguro?',
        body: text,
        icon: opts.icon,
        ribbon: opts.ribbon,
        closeButton: false,
        onClose: () => { if (!answered) { answered = true; if (opts.onNo) opts.onNo(); resolve(false); } },
        buttons: [
          { label: opts.no || 'Cancelar', kind: 'wood', sound: 'close', onClick: () => { answered = true; if (opts.onNo) opts.onNo(); resolve(false); } },
          { label: opts.yes || 'Sí', kind: opts.danger ? 'red' : 'green', icon: opts.yesIcon, onClick: () => { answered = true; if (onYes) { try { onYes(); } catch (err) { console.error(err); } } resolve(true); } },
        ],
      });
    });
  }

  // ---------------------------------------------------------------- botones
  function costEl(cost) {
    const wrap = el('span', { class: 'btn-cost' });
    if (!cost) return wrap;
    if (cost.gold) wrap.appendChild(el('span', { class: 'cost-part' }, [icon('gold'), fmt(cost.gold)]));
    if (cost.gems) wrap.appendChild(el('span', { class: 'cost-part' }, [icon('gem'), fmt(cost.gems)]));
    if (!cost.gold && !cost.gems) wrap.appendChild(el('span', { text: 'Gratis' }));
    return wrap;
  }

  function canAfford(cost) {
    if (!cost) return true;
    if (BB.econ && BB.econ.canAfford) return BB.econ.canAfford(cost);
    const d = save();
    return !!d && (cost.gold || 0) <= d.gold && (cost.gems || 0) <= d.gems;
  }

  // button(texto, alPulsar, {kind, icon, cost, big, huge, small, round, wide, cls, sound, disabled, title})
  function button(label, onClick, o) {
    o = o || {};
    let cls = 'bb-btn';
    if (o.kind && o.kind !== 'green') cls += ' btn-' + o.kind;
    if (o.big) cls += ' btn-big';
    if (o.huge) cls += ' btn-huge';
    if (o.small) cls += ' btn-small';
    if (o.round) cls += ' btn-round';
    if (o.wide) cls += ' btn-wide';
    if (o.cls) cls += ' ' + o.cls;
    const b = el('button', { class: cls, type: 'button', title: o.title || null, 'aria-label': o.title || (typeof label === 'string' ? label : null) });
    if (o.icon) b.appendChild(typeof o.icon === 'string' ? icon(o.icon) : o.icon);
    if (label != null && label !== '') b.appendChild(el('span', { class: 'btn-lbl', text: String(label) }));
    if (o.cost) {
      b.appendChild(costEl(o.cost));
      if (!canAfford(o.cost)) b.classList.add('is-poor');
    }
    if (o.disabled) b.disabled = true;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (b.disabled) return;
      if (o.cost && !canAfford(o.cost) && !o.allowPoor) {
        sfx('deny');
        vibrate(25);
        b.classList.remove('is-shake'); void b.offsetWidth; b.classList.add('is-shake');
        toast(o.cost.gems && !(o.cost.gold) ? 'No tienes suficientes gemas' : (o.cost.gold && o.cost.gems ? 'No te alcanza' : 'No tienes suficiente oro'), { type: 'bad', icon: o.cost.gems && !o.cost.gold ? 'gem' : 'gold' });
        if (typeof o.onPoor === 'function') o.onPoor();
        return;
      }
      if (o.sound !== false) sfx(o.sound || 'click');
      if (typeof onClick === 'function') { try { onClick(e); } catch (err) { console.error('[botón]', err); } }
    });
    return b;
  }

  function toggle(on, onChange) {
    const sw = el('button', { class: 'bb-switch' + (on ? ' is-on' : ''), type: 'button', role: 'switch', 'aria-checked': on ? 'true' : 'false' },
      [el('span', { class: 'sw-txt sw-on', text: 'SÍ' }), el('span', { class: 'sw-txt sw-off', text: 'NO' })]);
    sw.addEventListener('click', (e) => {
      e.stopPropagation();
      on = !on;
      sw.classList.toggle('is-on', on);
      sw.setAttribute('aria-checked', on ? 'true' : 'false');
      sfx('click');
      if (onChange) { try { onChange(on); } catch (err) { console.error(err); } }
    });
    return sw;
  }

  function bar(frac, text, cls) {
    const f = el('div', { class: 'bar-fill' });
    f.style.transform = 'scaleX(' + Math.max(0, Math.min(1, frac || 0)) + ')';
    return el('div', { class: 'bar' + (cls ? ' ' + cls : '') }, [f, text != null ? el('div', { class: 'bar-txt', text: String(text) }) : null]);
  }

  // ---------------------------------------------------------------- barra superior y monedas
  function starsTotal(d) {
    d = d || save();
    if (!d || !d.levels) return 0;
    let n = 0;
    for (const k in d.levels) n += (d.levels[k] && d.levels[k].stars) || 0;
    return n;
  }
  function curValue(k) {
    const d = save();
    if (!d) return 0;
    if (k === 'gold') return d.gold || 0;
    if (k === 'gems') return d.gems || 0;
    if (k === 'stars') return starsTotal(d);
    return 0;
  }
  function currency(kind) {
    const ic = kind === 'gems' ? 'gem' : kind === 'stars' ? 'star' : 'gold';
    const v = curValue(kind);
    const n = el('div', { class: 'cur cur-' + kind, 'data-cur': kind, title: kind === 'gold' ? 'Oro' : kind === 'gems' ? 'Gemas' : 'Estrellas' },
      [icon(ic), el('span', { class: 'cur-val', text: fmt(v) })]);
    n._v = v;
    return n;
  }

  // topBar({title, back: true|función, currencies: ['gold','gems','stars'], left: [nodos], right: [nodos]})
  function topBar(o) {
    o = o || {};
    const bar = el('div', { class: 'ui-topbar' });
    if (o.back !== false && o.back != null) {
      bar.appendChild(button(null, () => { if (typeof o.back === 'function') o.back(); else back(); },
        { kind: 'wood', round: true, icon: 'back', sound: 'close', title: 'Volver', cls: 'tb-back' }));
    }
    if (o.left) [].concat(o.left).forEach(n => n && bar.appendChild(n));
    if (o.title) bar.appendChild(el('div', { class: 'tb-title', text: o.title }));
    bar.appendChild(el('div', { class: 'tb-spacer' }));
    if (o.right) [].concat(o.right).forEach(n => n && bar.appendChild(n));
    const curs = el('div', { class: 'tb-curs' });
    (o.currencies || ['gold', 'gems']).forEach(k => curs.appendChild(currency(k)));
    bar.appendChild(curs);
    return bar;
  }

  function refreshTop() {
    if (!root) return;
    const nodes = root.querySelectorAll('[data-cur]');
    for (const n of nodes) {
      const v = curValue(n.getAttribute('data-cur'));
      if (n._v === v) continue;
      const up = n._v != null && v > n._v;
      n._v = v;
      const val = n.querySelector('.cur-val');
      if (val) val.textContent = fmt(v);
      if (up) { n.classList.remove('is-bump'); void n.offsetWidth; n.classList.add('is-bump'); }
    }
  }

  // ---------------------------------------------------------------- vibración
  function vibrate(pattern) {
    const st = settings();
    if (st.vibration === false) return false;
    try { if (navigator.vibrate) return navigator.vibrate(pattern || 20); } catch (err) { /* nada */ }
    return false;
  }

  // ---------------------------------------------------------------- arranque
  function guards() {
    // Bloqueo de zoom (pellizco, doble toque, ctrl+rueda) y del menú contextual de pulsación larga
    document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
    document.addEventListener('gesturechange', e => e.preventDefault(), { passive: false });
    document.addEventListener('touchmove', e => { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
    document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
    document.addEventListener('dblclick', e => e.preventDefault());
    document.addEventListener('contextmenu', e => { if (!(e.target && e.target.closest && e.target.closest('input,textarea'))) e.preventDefault(); });
    // Escape = volver / cerrar
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || e.repeat) return;
      if (modals.length) { const m = modals[modals.length - 1]; if (m.closable) m.close(); return; }
      if (overlays.length) { const o = overlays[overlays.length - 1]; if (o.def.onEscape) { callDef(o, 'onEscape'); return; } return; }
      if (current && screens[current] && screens[current].def.onEscape) { callDef(screens[current], 'onEscape'); return; }
      if (current && current !== 'menu' && current !== 'title' && current !== 'result' && current !== 'map') back();
    });
  }

  function headTweaks() {
    try {
      let vp = document.querySelector('meta[name="viewport"]');
      if (!vp) {
        vp = document.createElement('meta');
        vp.name = 'viewport';
        vp.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
        document.head.appendChild(vp);
      } else {
        let c = vp.content || '';
        if (!/user-scalable/.test(c)) c += ', user-scalable=no';
        if (!/maximum-scale/.test(c)) c += ', maximum-scale=1';
        if (!/viewport-fit/.test(c)) c += ', viewport-fit=cover';
        vp.content = c.replace(/^,\s*/, '');
      }
      if (!document.querySelector('link[href*="fonts.googleapis.com"]')) {
        const pre = document.createElement('link');
        pre.rel = 'preconnect'; pre.href = 'https://fonts.gstatic.com'; pre.crossOrigin = 'anonymous';
        document.head.appendChild(pre);
        const lk = document.createElement('link');
        lk.rel = 'stylesheet';
        lk.href = 'https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@600;700;800;900&display=swap';
        document.head.appendChild(lk);
      }
    } catch (err) { /* nada */ }
  }

  function loop(t) {
    requestAnimationFrame(loop);
    const now = t || performance.now();
    const dt = loop.last ? Math.min(0.1, (now - loop.last) / 1000) : 0.016;
    loop.last = now;
    if (!externalTick) tickAll(dt);
  }
  function tickAll(dt) {
    if (current && screens[current] && screens[current].def.tick) callDef(screens[current], 'tick', dt);
    for (const o of overlays) if (o.def.tick) callDef(o, 'tick', dt);
  }

  function init(rootEl) {
    if (inited) return BB.ui;
    root = rootEl || document.getElementById('ui');
    if (!root) { root = el('div', { id: 'ui' }); document.body.appendChild(root); }
    root.classList.add('bb-ui');
    L.screens = el('div', { class: 'ui-layer ui-screens' });
    L.hud = el('div', { class: 'ui-layer ui-hud', id: 'hud' });
    L.overlays = el('div', { class: 'ui-layer ui-overlays' });
    L.modals = el('div', { class: 'ui-layer ui-modals' });
    L.toasts = el('div', { class: 'ui-layer ui-toasts', 'aria-live': 'polite' });
    L.rotate = el('div', { class: 'ui-rotate' }, [
      el('div', { class: 'rot-phone' }),
      el('div', { class: 'rot-title', text: 'Gira el móvil' }),
      el('div', { class: 'rot-text', text: 'Bastión Bravo se juega en horizontal. ¡Ponlo de lado para defender el castillo!' }),
    ]);
    [L.screens, L.hud, L.overlays, L.modals, L.toasts, L.rotate].forEach(n => root.appendChild(n));
    inited = true;
    for (const id of order) mount(screens[id]);
    headTweaks();
    guards();
    if (/[?&]noanim\b/.test(location.search)) root.classList.add('ui-noanim');
    requestAnimationFrame(loop);
    return BB.ui;
  }

  // Carga de imágenes (la llama app.js): reenvía a la portada
  let loadFrac = null, assetsDone = false;
  function setLoading(p) {
    loadFrac = Math.max(0, Math.min(1, Number(p) || 0));
    const s = screens.title;
    if (s && s.def.setLoading) callDef(s, 'setLoading', loadFrac);
  }
  function onAssetsLoaded() {
    assetsDone = true;
    loadFrac = 1;
    const s = screens.title;
    if (s && s.def.setLoading) callDef(s, 'setLoading', 1);
  }

  BB.ui = {
    init, register, show, hide, back, toast, setLoading, onAssetsLoaded,
    hideAll() { show(null); },
    has(id) { return !!screens[id]; },
    get loadFrac() { return assetsDone ? 1 : loadFrac; }, modal, confirm: confirmBox, closeModals, closeOverlays,
    topBar, refreshTop, currency, starsTotal,
    button, toggle, bar, costEl, canAfford, icon, svgIcon, sprite, portrait, placeholder, vibrate, sfx, fmt, el, colorFor,
    tick(dt) { externalTick = true; tickAll(dt || 0.016); },
    get current() { return current; },
    get params() { return currentParams; },
    get root() { return root; },
    get layers() { return L; },
    get screens() { return screens; },
    isOpen(id) { const s = screens[id]; return !!(s && s.on); },
    ICONS,
  };
})();
