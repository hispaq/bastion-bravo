/* Bastión Bravo · utilidades comunes y constantes del mundo de combate */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};

  // Mundo de combate fijo (unidades del mundo); la cámara lo escala a la pantalla.
  BB.WORLD = {
    W: 1600, H: 720, GROUND: 560,
    SPAWN_X: -60,
    WALL_X: 1235,
    CASTLE_X: 1300,
    AIR_MIN: 280, AIR_MAX: 400,
    HERO_SLOTS: [
      { x: 1328, y: 500 }, { x: 1402, y: 500 }, { x: 1328, y: 425 }, { x: 1402, y: 425 },
      { x: 1328, y: 350 }, { x: 1402, y: 350 }, { x: 1328, y: 275 }, { x: 1402, y: 275 },
      { x: 1328, y: 200 }, { x: 1402, y: 200 },
    ],
    TRAP_SLOTS: [{ x: 1150 }, { x: 1040 }, { x: 930 }, { x: 820 }],
    TAP_ORIGIN: { x: 1470, y: 175 },
  };

  const TAU = Math.PI * 2;

  function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashStr(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  class Emitter {
    constructor() { this._ev = {}; }
    on(name, fn) { (this._ev[name] = this._ev[name] || []).push(fn); return () => this.off(name, fn); }
    off(name, fn) { const a = this._ev[name]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } }
    emit(name, data) {
      const a = this._ev[name];
      if (!a) return;
      for (const fn of a.slice()) {
        try { fn(data); } catch (err) { console.error('[evento ' + name + ']', err); }
      }
    }
  }

  // Formato de números en español: 1.234 · 12,5 K · 3,4 M
  function fmt(n) {
    n = Math.floor(Number(n) || 0);
    const neg = n < 0; n = Math.abs(n);
    let s;
    if (n < 100000) s = n.toLocaleString('es-ES', { useGrouping: true, minimumGroupingDigits: 1 });
    else if (n < 1e6) s = (n / 1000).toFixed(n < 1e5 ? 1 : 0).replace('.', ',') + ' K';
    else if (n < 1e9) s = (n / 1e6).toFixed(n < 1e7 ? 2 : 1).replace('.', ',') + ' M';
    else s = (n / 1e9).toFixed(2).replace('.', ',') + ' MM';
    return (neg ? '-' : '') + s;
  }

  function todayStr(d) {
    d = d || new Date();
    const p = v => String(v).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? '' : v);
      }
    }
    if (children != null) {
      for (const c of [].concat(children)) {
        if (c == null || c === false) continue;
        node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      }
    }
    return node;
  }

  BB.util = {
    TAU, mulberry32, hashStr, Emitter, fmt, todayStr, el,
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
    rand: (a, b) => a + Math.random() * (b - a),
    randInt: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
    pick: (arr, rng) => arr[Math.floor((rng ? rng() : Math.random()) * arr.length)],
    easeOutCubic: t => 1 - Math.pow(1 - t, 3),
    easeInCubic: t => t * t * t,
    easeInOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
    easeOutBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    easeOutElastic: t => (t === 0 || t === 1) ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1,
  };
})();
