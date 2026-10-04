/* Bastión Bravo · sonido 100 % sintetizado con Web Audio (sin archivos)
   API: BB.audio.init(), music(pista), sfx(nombre, {pitch, vol}), setMusic(bool), setSfx(bool), stopMusic().
   Pistas: menu, mapa, bosque, pantano, montanas, desierto, volcan, oscuras, hielo, ruinas, forja, dragon, jefe,
   victoria y derrota (estas dos son sintonías cortas que no se repiten).
   Si el navegador no tiene Web Audio, todas las funciones existen y no hacen nada. */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const AC = window.AudioContext || window.webkitAudioContext || null;

  let ctx = null;
  let master = null, comp = null, musicBus = null, sfxBus = null, revIn = null, revOut = null;
  let noiseBuf = null, driveCurve = null;
  let musicOn = true, sfxOn = true;
  let wanted = null;        // pista pedida (aunque la música esté apagada o el contexto no exista aún)
  let song = null;          // pista sonando
  const fading = [];        // pistas saliendo (fundido cruzado)
  let pumpTimer = null;
  let wasRunning = false;
  const MUSIC_VOL = 0.5, SFX_VOL = 0.9;

  // ------------------------------------------------------------------ utilidades
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[(Math.random() * arr.length) | 0];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function noteToMidi(tok) {
    const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(tok);
    if (!m) return null;
    return 12 * (parseInt(m[3], 10) + 1) + NOTE[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }
  const QUAL = {
    '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus4: [0, 5, 7], sus2: [0, 2, 7],
    dim: [0, 3, 6], aug: [0, 4, 8], 5: [0, 7, 12], add9: [0, 4, 7, 14], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9], m9: [0, 3, 7, 10, 14],
  };
  function parseChord(sym) {
    const m = /^([A-G])([#b]?)(.*)$/.exec(sym);
    if (!m) return null;
    const root = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    const iv = QUAL[m[3]] || QUAL[''];
    return { root: (root + 12) % 12, iv, sym };
  }

  // ------------------------------------------------------------------ grafo
  function makeIR(seconds, decay) {
    const rate = ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * seconds));
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const x = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - x, decay) * (i < rate * 0.012 ? i / (rate * 0.012) : 1);
      }
    }
    return buf;
  }
  function buildGraph() {
    master = ctx.createGain();
    master.gain.value = 0.9;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 10;
    comp.ratio.value = 5;
    comp.attack.value = 0.003;
    comp.release.value = 0.22;
    master.connect(comp);
    comp.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = MUSIC_VOL;
    // Filtro suave: quita los agudos chillones y deja un sonido cálido de orquesta
    const warmth = ctx.createBiquadFilter();
    warmth.type = 'lowpass'; warmth.frequency.value = 3600; warmth.Q.value = 0.5;
    const shelf = ctx.createBiquadFilter();
    shelf.type = 'highshelf'; shelf.frequency.value = 2500; shelf.gain.value = -5;
    musicBus.connect(warmth); warmth.connect(shelf); shelf.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = SFX_VOL;
    sfxBus.connect(master);
    revIn = ctx.createConvolver();
    revIn.buffer = makeIR(2.2, 3.2);
    revOut = ctx.createGain();
    revOut.gain.value = 0.55;
    revIn.connect(revOut);
    revOut.connect(master);
    // ruido blanco compartido
    const n = Math.floor(ctx.sampleRate * 2);
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    // distorsión suave
    driveCurve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; driveCurve[i] = Math.tanh(x * 3.2) / Math.tanh(3.2); }
  }

  function readSettings() {
    const st = BB.save && BB.save.data && BB.save.data.settings;
    if (st) { musicOn = st.music !== false; sfxOn = st.sfx !== false; }
  }

  function init() {
    if (!AC) return false;
    if (!ctx) {
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch (err) {
        try { ctx = new AC(); } catch (err2) { ctx = null; return false; }
      }
      try { buildGraph(); } catch (err) { console.warn('[audio] sin grafo', err); ctx = null; return false; }
      readSettings();
      pumpTimer = setInterval(pump, 50);
    }
    if (ctx.state === 'suspended') { try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* nada */ } }
    if (wanted && musicOn && !song) crossTo(wanted);
    return true;
  }

  // Desbloqueo con el primer toque en cualquier sitio (iOS necesita resume() dentro del gesto)
  function unlockHandler() {
    if (!AC) return;
    if (!ctx) init();
    else if (ctx.state !== 'running') { try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* nada */ } }
    if (ctx && ctx.state === 'running') {
      ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'keydown', 'click'].forEach(ev => document.removeEventListener(ev, unlockHandler, true));
    }
  }
  if (AC && typeof document !== 'undefined') {
    ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'keydown', 'click'].forEach(ev => document.addEventListener(ev, unlockHandler, true));
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      try {
        if (document.hidden) { wasRunning = ctx.state === 'running'; if (wasRunning) ctx.suspend(); }
        else if (wasRunning) { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); }
      } catch (err) { /* nada */ }
    });
  }

  // ------------------------------------------------------------------ piezas de síntesis
  function gainNode(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function envPerc(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.01, dur));
  }
  function cleanup(src, nodes) {
    src.onended = () => { for (const n of nodes) { try { n.disconnect(); } catch (err) { /* nada */ } } };
  }
  // Oscilador con barrido de tono y envolvente de percusión
  function tone(t, out, type, f0, f1, dur, vol, o) {
    o = o || {};
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, f0), t);
    if (f1 && f1 !== f0) {
      if (o.linear) osc.frequency.linearRampToValueAtTime(Math.max(1, f1), t + (o.sweep || dur));
      else osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + (o.sweep || dur));
    }
    const g = ctx.createGain();
    envPerc(g, t, o.a || 0.004, vol, dur);
    let head = g;
    const nodes = [osc, g];
    if (o.lp || o.bp || o.hp) {
      const f = ctx.createBiquadFilter();
      f.type = o.lp ? 'lowpass' : o.bp ? 'bandpass' : 'highpass';
      f.frequency.value = o.lp || o.bp || o.hp;
      f.Q.value = o.q || 0.8;
      osc.connect(f); f.connect(g);
      nodes.push(f);
    } else osc.connect(g);
    if (o.vib) {
      const l = ctx.createOscillator();
      const lg = ctx.createGain();
      l.frequency.value = o.vib[0];
      lg.gain.value = o.vib[1];
      l.connect(lg); lg.connect(osc.detune);
      l.start(t); l.stop(t + dur + 0.05);
      nodes.push(l, lg);
    }
    head.connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    cleanup(osc, nodes);
    return osc;
  }
  // Ruido filtrado con barrido opcional (pts = [[t relativo, frecuencia], ...])
  function noise(t, out, dur, vol, type, f0, f1, o) {
    o = o || {};
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type || 'bandpass';
    f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(f0, t);
    if (o.pts) for (const p of o.pts) f.frequency.exponentialRampToValueAtTime(Math.max(20, p[1]), t + p[0]);
    else if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    if (o.swell) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + o.swell);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    } else envPerc(g, t, o.a || 0.002, vol, dur);
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
    cleanup(src, [src, f, g]);
    return src;
  }

  // ------------------------------------------------------------------ instrumentos
  const PRESET = {
    lead: { wave: 'triangle', gain: 0.17, a: 0.02, d: 0.2, s: 0.7, r: 0.15, cutoff: 2200, q: 0.6, vib: [5, 10, 0.25], harm: [['sine', 2, 0.15]] },
    lead2: { wave: 'sawtooth', gain: 0.05, a: 0.02, d: 0.2, s: 0.6, r: 0.12, cutoff: 1200, fenv: 900, fdcy: 0.2, vib: [5, 8, 0.25] },
    flute: { wave: 'triangle', gain: 0.2, a: 0.04, d: 0.2, s: 0.8, r: 0.16, vib: [5, 12, 0.25], breath: 0.05, harm: [['sine', 2, 0.12]] },
    brass: { wave: 'sawtooth', voices: 2, spread: 7, gain: 0.06, a: 0.06, d: 0.3, s: 0.75, r: 0.2, cutoff: 600, fenv: 1300, fdcy: 0.3, q: 1.2, vib: [5, 8, 0.35] },
    horn: { wave: 'sawtooth', voices: 2, spread: 6, gain: 0.055, a: 0.09, d: 0.3, s: 0.85, r: 0.3, cutoff: 520, fenv: 700, fdcy: 0.35, q: 0.9, vib: [4.5, 7, 0.4] },
    harp: { wave: 'triangle', gain: 0.17, a: 0.003, d: 0.9, perc: true, cutoff: 2600, fenv: 1500, fdcy: 0.12, harm: [['sine', 2, 0.25, 0.4]] },
    pluck: { wave: 'triangle', gain: 0.16, a: 0.003, d: 0.28, perc: true, cutoff: 3500, fenv: 3000, fdcy: 0.1 },
    pizz: { wave: 'sawtooth', gain: 0.065, a: 0.003, d: 0.2, perc: true, cutoff: 1300, fenv: 2600, fdcy: 0.06 },
    marimba: { wave: 'sine', gain: 0.26, a: 0.002, d: 0.38, perc: true, harm: [['sine', 4, 0.2, 0.06]] },
    bell: { fm: [3.5, 2.4], gain: 0.13, a: 0.002, d: 1.5, perc: true },
    glass: { wave: 'sine', gain: 0.11, a: 0.002, d: 0.55, perc: true, harm: [['sine', 2.01, 0.35, 0.25]] },
    musicbox: { wave: 'sine', gain: 0.19, a: 0.002, d: 0.9, perc: true, harm: [['sine', 3.99, 0.25, 0.14], ['triangle', 2, 0.1, 0.3]] },
    oud: { wave: 'sawtooth', gain: 0.1, a: 0.002, d: 0.32, perc: true, cutoff: 1400, fenv: 2600, fdcy: 0.08, q: 3, bend: 70, bendT: 0.04 },
    pad: { wave: 'sawtooth', voices: 3, spread: 12, gain: 0.03, a: 0.45, d: 0.5, s: 0.85, r: 0.7, cutoff: 1300, q: 0.6 },
    warm: { wave: 'triangle', voices: 2, spread: 9, gain: 0.07, a: 0.3, d: 0.4, s: 0.9, r: 0.6 },
    organ: { wave: 'sine', gain: 0.06, a: 0.06, d: 0.2, s: 0.95, r: 0.35, harm: [['sine', 2, 0.6], ['sine', 3, 0.35], ['sine', 4, 0.18]], trem: [5, 0.12] },
    choir: { wave: 'sawtooth', voices: 3, spread: 14, gain: 0.045, a: 0.35, d: 0.4, s: 0.9, r: 0.6, formant: [650, 1100], vib: [5, 12, 0.3] },
    strings: { wave: 'sawtooth', voices: 2, spread: 10, gain: 0.05, a: 0.09, d: 0.3, s: 0.8, r: 0.3, cutoff: 2500, q: 0.7 },
    stacc: { wave: 'sawtooth', voices: 2, spread: 10, gain: 0.05, a: 0.006, d: 0.16, perc: true, cutoff: 1100, fenv: 1000, fdcy: 0.08 },
    bass: { wave: 'triangle', gain: 0.3, a: 0.005, d: 0.25, s: 0.7, r: 0.06 },
    bassSaw: { wave: 'sawtooth', gain: 0.11, a: 0.004, d: 0.2, s: 0.6, r: 0.05, cutoff: 650, fenv: 1000, fdcy: 0.12, q: 4 },
    sub: { wave: 'sine', gain: 0.36, a: 0.005, d: 0.3, s: 0.75, r: 0.08 },
    dist: { wave: 'sawtooth', gain: 0.06, a: 0.004, d: 0.15, s: 0.7, r: 0.06, cutoff: 1700, drive: true },
    theremin: { wave: 'sine', gain: 0.13, a: 0.12, d: 0.3, s: 0.9, r: 0.35, vib: [6, 30, 0.08], glide: 0.09 },
    ney: { wave: 'sine', gain: 0.13, a: 0.08, d: 0.2, s: 0.85, r: 0.2, vib: [5, 18, 0.25], breath: 0.1 },
  };

  function playInst(name, t, f, dur, vel, out, prevF) {
    const p = PRESET[name] || PRESET.lead;
    const peak = (p.gain || 0.1) * vel;
    const a = p.a || 0.005;
    const amp = ctx.createGain();
    let end;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(peak, t + a);
    if (p.perc) {
      end = t + a + (p.d || 0.3);
      amp.gain.exponentialRampToValueAtTime(0.0001, end);
    } else {
      const s = Math.max(0.0002, peak * (p.s != null ? p.s : 0.7));
      const hold = t + Math.max(dur, a + 0.02);
      amp.gain.linearRampToValueAtTime(s, Math.min(hold, t + a + (p.d || 0.1)));
      amp.gain.setValueAtTime(s, hold);
      end = hold + (p.r || 0.1);
      amp.gain.exponentialRampToValueAtTime(0.0001, end);
    }
    amp.connect(out);
    const nodes = [amp];
    let src = amp;
    if (p.trem) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = p.trem[0]; lg.gain.value = peak * p.trem[1];
      l.connect(lg); lg.connect(amp.gain); l.start(t); l.stop(end + 0.05);
      nodes.push(l, lg);
    }
    if (p.cutoff) {
      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.Q.value = p.q || 0.8;
      if (p.fenv) {
        flt.frequency.setValueAtTime(p.cutoff + p.fenv, t);
        flt.frequency.exponentialRampToValueAtTime(p.cutoff, t + (p.fdcy || 0.15));
      } else flt.frequency.value = p.cutoff;
      flt.connect(src); src = flt; nodes.push(flt);
    }
    if (p.formant) {
      const sp = ctx.createGain();
      sp.gain.value = 2.6;
      for (const ff of p.formant) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = 4;
        sp.connect(bp); bp.connect(src); nodes.push(bp);
      }
      src = sp; nodes.push(sp);
    }
    if (p.drive) {
      const ws = ctx.createWaveShaper();
      ws.curve = driveCurve;
      ws.connect(src); src = ws; nodes.push(ws);
    }
    const oscs = [];
    const mk = (type, freq, g, det, decay) => {
      const o = ctx.createOscillator();
      o.type = type;
      if (p.glide && prevF) {
        o.frequency.setValueAtTime(prevF * (freq / f), t);
        o.frequency.exponentialRampToValueAtTime(freq, t + p.glide);
      } else if (p.bend) {
        o.frequency.setValueAtTime(freq * Math.pow(2, p.bend / 1200), t);
        o.frequency.exponentialRampToValueAtTime(freq, t + (p.bendT || 0.05));
      } else o.frequency.setValueAtTime(freq, t);
      if (det) o.detune.value = det;
      let head = o;
      if (g !== 1 || decay) {
        const gg = ctx.createGain();
        if (decay) envPerc(gg, t, 0.002, g, decay);
        else gg.gain.value = g;
        o.connect(gg); head = gg; nodes.push(gg);
      }
      head.connect(src);
      o.start(t); o.stop(end + 0.05);
      oscs.push(o); nodes.push(o);
      return o;
    };
    if (p.fm) {
      const car = mk('sine', f, 1, 0);
      const mod = ctx.createOscillator();
      const mg = ctx.createGain();
      mod.frequency.value = f * p.fm[0];
      mg.gain.setValueAtTime(f * p.fm[1], t);
      mg.gain.exponentialRampToValueAtTime(Math.max(1, f * 0.05), t + (p.d || 1) * 0.6);
      mod.connect(mg); mg.connect(car.frequency);
      mod.start(t); mod.stop(end + 0.05);
      nodes.push(mod, mg);
    } else {
      const nv = p.voices || 1;
      for (let i = 0; i < nv; i++) mk(p.wave || 'square', f, nv > 1 ? 1 / Math.sqrt(nv) : 1, nv > 1 ? (i - (nv - 1) / 2) * (p.spread || 10) : 0);
    }
    if (p.harm) for (const h of p.harm) mk(h[0], f * h[1], h[2], 0, h[3]);
    if (p.vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = p.vib[0];
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(p.vib[1], t + (p.vib[2] || 0.15) + 0.05);
      l.connect(lg);
      for (const o of oscs) lg.connect(o.detune);
      l.start(t); l.stop(end + 0.05);
      nodes.push(l, lg);
    }
    if (p.breath) {
      const ns = ctx.createBufferSource();
      ns.buffer = noiseBuf; ns.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = Math.min(9000, f * 2); bp.Q.value = 1.2;
      const ng = ctx.createGain();
      envPerc(ng, t, a, peak * p.breath * 3, Math.min(end - t, 0.25));
      ns.connect(bp); bp.connect(ng); ng.connect(amp);
      ns.start(t, Math.random()); ns.stop(t + 0.3);
      nodes.push(ns, bp, ng);
    }
    if (oscs[0]) cleanup(oscs[0], nodes);
    return end;
  }

  // ------------------------------------------------------------------ percusión
  const DRUM = {
    kick(t, v, out) {
      tone(t, out, 'sine', 155, 42, 0.36, 0.95 * v, { sweep: 0.11 });
      noise(t, out, 0.02, 0.25 * v, 'highpass', 3000);
    },
    heart(t, v, out) { tone(t, out, 'sine', 90, 40, 0.3, 0.8 * v, { sweep: 0.08 }); },
    snare(t, v, out) {
      noise(t, out, 0.17, 0.42 * v, 'highpass', 1300, null, { q: 0.7 });
      tone(t, out, 'triangle', 200, 150, 0.08, 0.35 * v);
    },
    clap(t, v, out) {
      for (let i = 0; i < 3; i++) noise(t + i * 0.011, out, 0.03, 0.3 * v, 'bandpass', 1400, null, { q: 1.4 });
      noise(t + 0.033, out, 0.14, 0.32 * v, 'bandpass', 1300, null, { q: 1.2 });
    },
    hat(t, v, out) { noise(t, out, 0.035, 0.14 * v, 'highpass', 7800, null, { q: 0.6 }); },
    ohat(t, v, out) { noise(t, out, 0.24, 0.12 * v, 'highpass', 7000, null, { q: 0.6 }); },
    shaker(t, v, out) { noise(t, out, 0.06, 0.1 * v, 'bandpass', 6500, null, { q: 2, a: 0.012 }); },
    tamb(t, v, out) { noise(t, out, 0.1, 0.11 * v, 'bandpass', 9000, null, { q: 1.5 }); tone(t, out, 'square', 4200, 4100, 0.05, 0.02 * v, { hp: 3000 }); },
    tom(t, v, out) { tone(t, out, 'sine', 190, 110, 0.3, 0.6 * v, { sweep: 0.15 }); },
    ltom(t, v, out) { tone(t, out, 'sine', 125, 70, 0.4, 0.7 * v, { sweep: 0.2 }); },
    timp(t, v, out) {
      tone(t, out, 'sine', 98, 82, 0.9, 0.75 * v, { sweep: 0.3 });
      tone(t, out, 'sine', 147, 130, 0.5, 0.18 * v, { sweep: 0.3 });
      noise(t, out, 0.06, 0.18 * v, 'lowpass', 600, null, { q: 0.7 });
    },
    timpH(t, v, out) {
      tone(t, out, 'sine', 131, 110, 0.7, 0.65 * v, { sweep: 0.25 });
      noise(t, out, 0.05, 0.15 * v, 'lowpass', 700, null, { q: 0.7 });
    },
    taiko(t, v, out) {
      tone(t, out, 'sine', 95, 46, 0.75, 0.95 * v, { sweep: 0.25 });
      noise(t, out, 0.09, 0.35 * v, 'lowpass', 400, null, { q: 0.7 });
    },
    doum(t, v, out) { tone(t, out, 'sine', 120, 78, 0.28, 0.7 * v, { sweep: 0.12 }); noise(t, out, 0.04, 0.12 * v, 'lowpass', 500); },
    tek(t, v, out) { noise(t, out, 0.05, 0.2 * v, 'bandpass', 3400, null, { q: 3 }); tone(t, out, 'sine', 620, 560, 0.04, 0.12 * v); },
    anvil(t, v, out) {
      const base = 420 * rnd(0.98, 1.02);
      [[1, 0.5, 0.25], [2.76, 0.3, 0.6], [5.4, 0.18, 0.45], [8.93, 0.1, 0.3]].forEach(p => tone(t, out, 'sine', base * p[0], base * p[0], p[2], p[1] * 0.45 * v));
      noise(t, out, 0.03, 0.25 * v, 'highpass', 4000);
    },
    clank(t, v, out) {
      tone(t, out, 'square', 330, 320, 0.11, 0.08 * v, { bp: 2000, q: 2 });
      tone(t, out, 'square', 467, 460, 0.09, 0.07 * v, { bp: 2500, q: 2 });
      noise(t, out, 0.05, 0.12 * v, 'bandpass', 5000, null, { q: 2 });
    },
    steam(t, v, out) { noise(t, out, 0.22, 0.07 * v, 'highpass', 5000, 2500, { swell: 0.05 }); },
    crash(t, v, out) { noise(t, out, 1.4, 0.16 * v, 'highpass', 5200, 3500, { q: 0.5 }); },
    tick(t, v, out) { tone(t, out, 'sine', 2900, 2700, 0.035, 0.13 * v); },
    bloop(t, v, out) { tone(t, out, 'sine', rnd(260, 360), rnd(110, 160), 0.16, 0.32 * v, { sweep: 0.12 }); },
    drip(t, v, out) { tone(t, out, 'sine', rnd(1300, 1900), rnd(2400, 3200), 0.08, 0.1 * v, { sweep: 0.05 }); },
    bell(t, v, out) { playInst('bell', t, mtof(pick([47, 59])), 1.2, 0.9 * v, out); },
  };

  // ------------------------------------------------------------------ pistas (compás 4/4 salvo indicación; tokens por paso)
  const TRACKS = {
    // Tema principal de aventura: trompa heroica, cuerdas en pizzicato, arpa y timbales
    menu: {
      bpm: 104, reverb: 0.3, vol: 1,
      prog: { len: 16, chords: 'D Bm G A D Bm Em A  G A F#m Bm G Em A A' },
      parts: [
        { type: 'mel', inst: 'horn', div: 2, vol: 1, mel:
          'A3 - D4 - F#4 - - E4 | D4 - - - A3 - - - | B3 - D4 - G4 - F#4 E4 | E4 - - - - - . . |' +
          'A3 - D4 - F#4 - A4 - | B4 - - A4 F#4 - D4 - | E4 - G4 - F#4 - E4 - | E4 - - - - - . . |' +
          'B4 - - A4 G4 - D4 - | E4 - F#4 - A4 - - - | F#4 - - E4 C#4 - A3 - | D4 - F#4 - B4 - - - |' +
          'G4 - - F#4 E4 - D4 - | E4 - G4 - B4 - A4 G4 | F#4 - - - E4 - - - | E4 - - - C#4 - E4 - |' },
        { type: 'mel', inst: 'flute', div: 2, vol: 0.5, mel:
          '. . . . . . . . | F#5 - E5 - D5 - . . | . . . . . . . . | C#5 - D5 - E5 - . . |' +
          '. . . . . . . . | F#5 - G5 - A5 - . . | . . . . . . . . | A5 - G5 - E5 - . . |' +
          '. . . . . . . . | . . . . C#5 - E5 - | . . . . . . . . | F#5 - - - D5 - . . |' +
          '. . . . . . . . | . . . . . . . . | A4 - B4 - C#5 - D5 - | E5 - - - - - . . |' },
        { type: 'arp', inst: 'harp', div: 4, oct: 4, vol: 0.5, pat: '1 2 3 4 3 2 1 2' },
        { type: 'arp', inst: 'pizz', div: 2, oct: 3, vol: 0.6, pat: '1 . 2 . 3 . 2 .' },
        { type: 'pad', inst: 'strings', oct: 3, vol: 0.45 },
        { type: 'bass', inst: 'bass', div: 2, oct: 2, vol: 0.8, pat: 'R . . . 5 . . .' },
        { type: 'drums', div: 4, kit: { timp: 'x...............', timpH: '..........x.....', shaker: '..o...o...o...o.', crash: 'o' + '.'.repeat(255) } },
      ],
    },
    // Mapa: marcha tranquila de viaje
    mapa: {
      bpm: 92, swing: 0.1, reverb: 0.28, vol: 1,
      prog: { len: 16, chords: 'F C Dm Bb F C Bb C' },
      parts: [
        { type: 'mel', inst: 'flute', div: 2, vol: 0.9, mel:
          'C5 - F5 - A5 - G5 F5 | E5 - C5 - G4 - - - | A4 - D5 - F5 - E5 D5 | D5 - - - Bb4 - - - |' +
          'C5 - F5 - A5 - G5 - | F5 - E5 D5 - - C5 - | D5 - Bb4 - C5 - E5 - | F5 - - - - - . . |' },
        { type: 'arp', inst: 'harp', div: 2, oct: 4, vol: 0.6, pat: '1 2 3 2 1 2 3 4' },
        { type: 'mel', inst: 'horn', div: 1, vol: 0.5, oct: -1, mel: 'F4 - - - E4 - - - | D4 - - - D4 - - -' },
        { type: 'bass', inst: 'pizz', div: 2, oct: 2, vol: 0.9, pat: 'R . . 5 . . R .' },
        { type: 'pad', inst: 'warm', oct: 3, vol: 0.4 },
        { type: 'drums', div: 4, kit: { timp: 'x...............', shaker: '..o...o...o...o.', tamb: '............o...' } },
      ],
    },
    // Bosque: aventura alegre y pegadiza
    bosque: {
      bpm: 112, swing: 0.06, reverb: 0.24, vol: 1,
      prog: { len: 8, chords: 'G*2 Em*2 C*2 D*2 G*2 Em*2 C D G*2' },
      parts: [
        { type: 'mel', inst: 'flute', div: 2, vol: 0.95, mel:
          'D5 . G5 . B5 - A5 G5 | B4 . E5 . G5 - F#5 E5 | E5 . C5 . G5 - E5 - | F#5 - A5 - D5 - - - |' +
          'B4 . A4 . G4 - D5 - | E5 . G5 . B5 - A5 G5 | E5 - G5 - F#5 - A5 - | G5 - - - . . D5 . |' },
        { type: 'mel', inst: 'horn', div: 2, vol: 0.55, oct: -1, mel:
          'G4 - - - - - - - | E4 - - - - - - - | C4 - - - E4 - - - | D4 - - - F#4 - - - |' +
          'G4 - - - - - - - | E4 - - - - - - - | C4 - - - D4 - - - | G4 - - - - - - - |' },
        { type: 'arp', inst: 'pizz', div: 4, oct: 3, vol: 0.55, pat: '1 . 2 3 . 2 4 .' },
        { type: 'arp', inst: 'harp', div: 4, oct: 4, vol: 0.3, pat: '. 3 . . 4 . . 2' },
        { type: 'bass', inst: 'bass', div: 2, oct: 2, vol: 0.8, pat: 'R . 5 . R . 5 3' },
        { type: 'drums', div: 4, kit: { timp: 'x.......x.......', shaker: 'o.o.o.o.o.o.o.o.', tamb: '....o.......o...' } },
      ],
    },
    pantano: {
      bpm: 88, swing: 0.18, reverb: 0.35, vol: 0.95,
      prog: { len: 32, chords: 'Dm C Bb A' },
      parts: [
        { type: 'mel', inst: 'marimba', div: 2, vol: 1, mel:
          'D5 . F5 . A5 - G5 . | F5 - E5 - D5 - - - | E5 . G5 . C6 - Bb5 . | A5 - G5 - E5 - - - |' +
          'D5 . F5 . Bb5 - A5 . | G5 - F5 - D5 - - - | E5 . C#5 . E5 - G5 . | A5 - - - - - . . |' },
        { type: 'mel', inst: 'ney', div: 2, vol: 0.55, oct: -1, mel:
          '. . . . . . . . | . . . . A4 - - - | . . . . . . . . | . . . . G4 - - - |' +
          '. . . . . . . . | . . . . F4 - - - | . . . . . . . . | E4 - - - C#4 - - - |' },
        { type: 'pad', inst: 'pad', oct: 3, vol: 0.8 },
        { type: 'bass', inst: 'sub', div: 2, oct: 2, vol: 0.9, pat: 'R . . . R . 5 . R . . . 8 . 5 .' },
        { type: 'drums', div: 4, kit: { bloop: '......x.........x.........x.....', heart: 'x.........x.....', drip: '.....x..........', hat: '..o...o...o...o.' } },
      ],
    },
    montanas: {
      bpm: 96, reverb: 0.3, vol: 1,
      prog: { len: 16, chords: 'Dm Bb F C Dm Bb C A' },
      parts: [
        { type: 'mel', inst: 'brass', div: 2, vol: 1, mel:
          'A4 - D5 - F5 - - E5 | D5 - - - - - . . | C5 - F5 - A5 - - G5 | E5 - - - - - . . |' +
          'F5 - A5 - D6 - - C6 | Bb5 - A5 - F5 - D5 - | E5 - G5 - C6 - Bb5 - | A5 - - - C#5 - E5 - |' },
        { type: 'arp', inst: 'strings', div: 2, oct: 3, vol: 0.7, pat: '1 1 2 1 3 1 2 1' },
        { type: 'pad', inst: 'choir', oct: 4, vol: 0.55 },
        { type: 'bass', inst: 'bass', div: 2, oct: 2, vol: 0.9, pat: 'R - - - R - 5 -' },
        { type: 'drums', div: 4, kit: { taiko: 'x.....x.....x...', ltom: '..............xx', snare: '........o.......', crash: 'x' + '.'.repeat(127) } },
      ],
    },
    desierto: {
      bpm: 104, reverb: 0.24, vol: 1.15,
      prog: { len: 8, chords: 'E*2 F*2 E*2 Dm*2 E*2 F*2 G F E*2' },
      parts: [
        { type: 'mel', inst: 'oud', div: 2, vol: 1, mel:
          'E5 - F5 G#5 A5 G#5 F5 E5 | F5 - A5 - C6 B5 A5 G#5 | A5 - G#5 F5 E5 - - - | D5 - F5 - A5 G#5 A5 - |' +
          'B5 - C6 B5 A5 G#5 A5 B5 | C6 - B5 A5 G#5 - F5 - | G5 F5 G5 - F5 E5 F5 - | E5 - - - - - . . |' },
        { type: 'mel', inst: 'ney', div: 2, vol: 0.5, oct: -1, mel:
          'E5 - - - - - - - | F5 - - - - - - - | E5 - - - - - - - | D5 - - - - - - - |' +
          'G#5 - - - - - - - | A5 - - - - - - - | B5 - - - A5 - - - | G#5 - - - - - - - |' },
        { type: 'bass', inst: 'bassSaw', div: 2, oct: 2, vol: 0.9, pat: 'R . . R . . 5 .' },
        { type: 'mel', inst: 'sub', div: 1, vol: 0.4, mel: 'E2 - - - - - - -' },
        { type: 'drums', div: 4, kit: { doum: 'x.....x...x.....', tek: '..x.x...x...x.xx', tamb: 'o...o...o...o...' } },
      ],
    },
    volcan: {
      bpm: 144, reverb: 0.14, vol: 0.9,
      prog: { len: 16, chords: 'Cm Cm Ab Bb Cm Cm Ab/Bb G' },
      parts: [
        { type: 'mel', inst: 'horn', div: 2, vol: 1, oct: -1, mel:
          'C5 - Eb5 - G5 - C6 - | Bb5 - G5 - Eb5 - G5 - | Ab5 - - - G5 - F5 - | D5 - F5 - Bb5 - - - |' +
          'C6 - - Bb5 G5 - Eb5 - | F5 - Eb5 - D5 - C5 - | Eb5 - C5 - F5 - D5 - | B4 - D5 - G5 - - - |' },
        { type: 'bass', inst: 'bassSaw', div: 2, oct: 2, vol: 0.8, pat: 'R . R . R . 8 .' },
        { type: 'chords', inst: 'stacc', div: 2, oct: 3, vol: 0.45, pat: '. x . x . x . x' },
        { type: 'drums', div: 4, kit: { timp: 'x.......x.......', taiko: '....x.......x...', crash: 'o' + '.'.repeat(127), ltom: '.'.repeat(124) + 'oooo' } },
      ],
    },
    oscuras: {
      bpm: 76, reverb: 0.42, vol: 1,
      prog: { len: 32, chords: 'Bm C Bm F#' },
      parts: [
        { type: 'mel', inst: 'choir', div: 2, vol: 1, mel:
          'F#4 - - - B4 - - - | D5 - C#5 - B4 - - - | C5 - - - E5 - - - | G5 - F5 - E5 - - - |' +
          'F#5 - - - D5 - - - | B4 - C#5 - D5 - - - | C#5 - - - A#4 - - - | F#4 - - - - - - - |' },
        { type: 'pad', inst: 'organ', oct: 3, vol: 0.8 },
        { type: 'bass', inst: 'sub', div: 1, oct: 1, vol: 1, pat: 'R - - - R - L -' },
        { type: 'arp', inst: 'glass', div: 2, oct: 5, vol: 0.4, pat: '. . 3 . . 2 . . . . 3 . 1 . . .' },
        { type: 'drums', div: 4, kit: { heart: 'x.x.............', bell: 'x' + '.'.repeat(63), ltom: '..............o.' } },
      ],
    },
    hielo: {
      bpm: 92, reverb: 0.45, vol: 0.95,
      prog: { len: 16, chords: 'A B F#m D A B E E' },
      parts: [
        { type: 'mel', inst: 'harp', div: 2, vol: 1, oct: -1, mel:
          'E5 - A5 - C#6 - B5 - | D#6 - - - F#5 - B5 - | A5 - C#6 - F#6 - E6 - | D6 - - - A5 - F#5 - |' +
          'E6 - C#6 - A5 - B5 - | D#6 - B5 - F#5 - D#5 - | E5 - G#5 - B5 - E6 - | D#6 - B5 - - - . . |' },
        { type: 'arp', inst: 'glass', div: 4, oct: 5, vol: 0.55, pat: '1 2 3 4 3 2 1 2' },
        { type: 'pad', inst: 'warm', oct: 4, vol: 0.6 },
        { type: 'bass', inst: 'sub', div: 2, oct: 2, vol: 0.7, pat: 'R - - - 5 - - -' },
        { type: 'drums', div: 4, kit: { tick: 'x..x..x...x..x..', shaker: '..o...o...o...o.', kick: 'o...............' } },
      ],
    },
    ruinas: {
      bpm: 84, beats: 3, reverb: 0.48, vol: 1.6,
      prog: { len: 12, chords: 'Em Am B7 Em C Am B7 Em' },
      parts: [
        { type: 'mel', inst: 'musicbox', div: 2, vol: 1, mel:
          'B4 - E5 - G5 - | A5 - G5 - E5 - | F#5 - D#5 - B4 - | E5 - - - - - |' +
          'G5 - E5 - C6 - | B5 - A5 - E5 - | D#5 - F#5 - A5 - | G5 - - - - - |' },
        { type: 'mel', inst: 'theremin', div: 2, vol: 0.7, oct: -1, mel:
          'E5 - - - - - | C5 - - - - - | B4 - - - - - | G4 - - - - - |' +
          'E5 - - - - - | E5 - - - - - | F#5 - - - - - | E5 - - - - - |' },
        { type: 'bass', inst: 'pizz', div: 2, oct: 2, vol: 1, pat: 'R . 5 . 5 .' },
        { type: 'pad', inst: 'choir', oct: 3, vol: 0.4 },
        { type: 'drums', div: 4, kit: { tick: '....o...o...', drip: '.'.repeat(30) + 'x' + '.'.repeat(17) } },
      ],
    },
    forja: {
      bpm: 112, reverb: 0.16, vol: 0.92,
      prog: { len: 16, chords: 'Fm Fm Db Eb Fm Fm Db C' },
      parts: [
        { type: 'mel', inst: 'brass', div: 2, vol: 1, mel:
          'F5 . F5 Ab5 . F5 C6 . | Bb5 . Ab5 G5 . F5 - - | F5 . F5 Ab5 . F5 Db6 . | C6 - Bb5 - G5 - Eb5 - |' +
          'F5 . F5 Ab5 . F5 C6 . | Eb6 - Db6 C6 - Ab5 - - | Db6 - C6 - Ab5 - F5 - | E5 - G5 - C6 - - - |' },
        { type: 'bass', inst: 'bassSaw', div: 4, oct: 2, vol: 1, pat: 'R . R 8 . R . R R . R 8 . R 5 .' },
        { type: 'drums', div: 4, kit: { anvil: 'x.....x...x.....', clank: '...x.......x..x.', kick: 'x..x..x...x..x..', snare: '....x.......x...', steam: '..x.......x.....' } },
      ],
    },
    dragon: {
      bpm: 136, reverb: 0.3, vol: 1,
      prog: { len: 16, chords: 'Dm Bb Gm A Dm Bb C A7' },
      parts: [
        { type: 'mel', inst: 'horn', div: 2, vol: 1.05, mel:
          'D4 - A3 - D4 - F4 - | Bb4 - - - A4 - F4 - | G4 - Bb4 - D5 - - C5 | C#5 - - - A4 - E4 - |' +
          'F4 - A4 - D5 - - - | F5 - E5 - D5 - Bb4 - | E5 - D5 - C5 - G4 - | A4 - - - C#5 - E5 - |' },
        { type: 'pad', inst: 'choir', oct: 3, vol: 0.55 },
        { type: 'arp', inst: 'stacc', div: 4, oct: 3, vol: 0.55, pat: '1 2 3 2' },
        { type: 'bass', inst: 'bass', div: 2, oct: 2, vol: 0.9, pat: 'R . R . R . 5 .' },
        { type: 'drums', div: 4, kit: { taiko: 'x.....x...x.....', timpH: '....o.......o...', crash: 'o' + '.'.repeat(63) } },
      ],
    },
    // Jefe: épica orquestal con ostinato de cuerdas y timbales (tensa pero no estridente)
    jefe: {
      bpm: 132, reverb: 0.26, vol: 1,
      prog: { len: 16, chords: 'Em Em C D Em Em C B7' },
      parts: [
        { type: 'mel', inst: 'horn', div: 2, vol: 1.1, mel:
          'E4 - - - G4 - F#4 - | E4 - B3 - - - - - | E4 - - - G4 - A4 - | F#4 - - - D4 - - - |' +
          'B4 - - - A4 - G4 - | F#4 - G4 - A4 - B4 - | C5 - - - B4 - A4 - | B4 - - - D#4 - F#4 - |' },
        { type: 'arp', inst: 'stacc', div: 4, oct: 3, vol: 0.7, pat: '1 1 2 1 3 1 2 1' },
        { type: 'bass', inst: 'bass', div: 4, oct: 2, vol: 0.9, pat: 'R . R . R . 5 . R . R . 8 . 5 .' },
        { type: 'pad', inst: 'choir', oct: 3, vol: 0.4 },
        { type: 'drums', div: 4, kit: { timp: 'x..x....x..x....', timpH: '......x.......x.', snare: '....o.......o...', crash: 'o' + '.'.repeat(127) } },
      ],
    },
    victoria: {
      bpm: 156, reverb: 0.3, vol: 1, once: 3,
      prog: { len: 8, chords: 'C*2 F G C*2' },
      parts: [
        { type: 'mel', inst: 'horn', div: 2, vol: 1.1, mel: 'G3 - C4 - E4 - G4 - | A4 - F4 - B4 - G4 - | C5 - - - - - - - - - - -' },
        { type: 'mel', inst: 'flute', div: 2, vol: 0.55, mel: 'G4 - C5 - E5 - G5 - | A5 - F5 - B5 - G5 - | C6 - - - - - - - - - - -' },
        { type: 'pad', inst: 'strings', oct: 3, vol: 0.8 },
        { type: 'bass', inst: 'bass', div: 1, oct: 2, vol: 0.9, pat: 'R R R R' },
        { type: 'drums', div: 4, kit: { snare: 'o.o.o.o.x.x.xxxx', crash: '.'.repeat(32) + 'x', taiko: '.'.repeat(32) + 'x' } },
      ],
    },
    derrota: {
      bpm: 92, reverb: 0.35, vol: 1, once: 2.5,
      prog: { len: 16, chords: 'Cm Cm Ab' },
      parts: [
        { type: 'mel', inst: 'brass', div: 2, vol: 1.1, mel: 'G4 - F#4 - F4 - E4 - | - - - - - - . . | . . . .' },
        { type: 'mel', inst: 'sub', div: 1, vol: 0.5, mel: 'C2 - - - C2 - - - Ab1 -' },
        { type: 'pad', inst: 'organ', oct: 3, vol: 0.5 },
        { type: 'drums', div: 4, kit: { ltom: 'x.......x.......x', crash: 'x' } },
      ],
    },
  };

  // ------------------------------------------------------------------ compilación de pistas
  function tokens(str) { return String(str).replace(/\|/g, ' ').trim().split(/\s+/).filter(Boolean); }
  function compileMel(str, octShift) {
    const tk = tokens(str);
    const out = [];
    for (let i = 0; i < tk.length; i++) {
      const tok = tk[i];
      if (tok === '-' || tok === '.') { out.push(null); continue; }
      const m = noteToMidi(tok);
      if (m == null) { out.push(null); continue; }
      let len = 1;
      while (i + len < tk.length && tk[i + len] === '-') len++;
      out.push({ m: m + 12 * (octShift || 0), len });
    }
    return out;
  }
  function compileProg(prog) {
    const list = [];
    for (const tok of tokens(prog.chords)) {
      const mul = /\*(\d+)$/.exec(tok);
      const parts = tok.replace(/\*\d+$/, '').split('/');
      const n = mul ? parseInt(mul[1], 10) : 1;
      for (let k = 0; k < n; k++) for (const p of parts) {
        const c = parseChord(p);
        if (c) list.push({ c, len: (prog.len || 16) / (parts.length > 1 ? parts.length : 1) });
      }
    }
    // tramos con inicio en pasos de semicorchea
    let s = 0;
    const seg = [];
    for (const it of list) {
      const prev = seg[seg.length - 1];
      if (prev && prev.c.sym === it.c.sym) prev.len += it.len;
      else seg.push({ c: it.c, start: s, len: it.len });
      s += it.len;
    }
    return { seg, total: s || 16 };
  }
  function compile(def) {
    const prog = def.prog ? compileProg(def.prog) : null;
    const parts = (def.parts || []).map(p => {
      const step = 4 / (p.div || 2);
      const c = { p, step, vol: p.vol != null ? p.vol : 1, prevF: 0 };
      if (p.type === 'mel') c.notes = compileMel(p.mel, p.oct);
      else if (p.type === 'arp' || p.type === 'bass' || p.type === 'chords') c.pat = tokens(p.pat);
      else if (p.type === 'drums') {
        c.kit = {};
        for (const k in p.kit) c.kit[k] = String(p.kit[k]).replace(/[\s|]/g, '');
      }
      return c;
    });
    return { prog, parts };
  }
  function chordAt(song, s) {
    const pr = song.c.prog;
    if (!pr) return null;
    const x = s % pr.total;
    for (const sg of pr.seg) if (x >= sg.start && x < sg.start + sg.len) return sg;
    return pr.seg[0];
  }
  function chordTones(c, oct) {
    const base = 12 * (oct + 1) + c.root;
    const tones = c.iv.map(i => base + i);
    const ext = tones.slice();
    for (let k = 1; ext.length < 8; k++) for (const t of tones) { if (ext.length < 8) ext.push(t + 12 * k); }
    return ext;
  }

  class Song {
    constructor(name, def) {
      this.name = name;
      this.def = def;
      this.c = compile(def);
      this.sixteenth = 60 / def.bpm / 4;
      this.barSteps = (def.beats || 4) * 4;
      this.step = 0;
      this.next = ctx.currentTime + 0.1;
      this.out = ctx.createGain();
      this.out.gain.value = 0.0001;
      this.out.connect(musicBus);
      this.rev = gainNode(def.reverb != null ? def.reverb : 0.2);
      this.out.connect(this.rev);
      this.rev.connect(revIn);
      this.ended = false;
      this.stopAt = 0;
      if (def.once) this.lastStep = Math.round(def.once * this.barSteps);
    }
    schedule(until) {
      while (this.next < until && !this.ended) {
        if (this.lastStep != null && this.step >= this.lastStep) { this.ended = true; this.endTime = this.next + 2.5; break; }
        this.playStep(this.step, this.next);
        this.step++;
        this.next += this.sixteenth;
      }
    }
    playStep(s, t0) {
      const def = this.def;
      const swing = def.swing && (s % 4 === 2) ? def.swing * this.sixteenth * 1.4 : 0;
      const once = this.lastStep != null;
      for (const pc of this.c.parts) {
        const p = pc.p;
        if (s % pc.step !== 0 && p.type !== 'pad') continue;
        const t = t0 + swing + (p.type === 'drums' ? 0 : rnd(-0.003, 0.003));
        const idx = Math.floor(s / pc.step);
        try {
          if (p.type === 'mel') {
            if (once && idx >= pc.notes.length) continue;
            const n = pc.notes[idx % pc.notes.length];
            if (!n) continue;
            const f = mtof(n.m);
            playInst(p.inst, t, f, n.len * pc.step * this.sixteenth * 0.92, pc.vol * rnd(0.9, 1), this.out, pc.prevF);
            pc.prevF = f;
          } else if (p.type === 'pad') {
            const sg = chordAt(this, s);
            if (!sg || (s % this.c.prog.total) !== sg.start) continue;
            const tones = chordTones(sg.c, p.oct != null ? p.oct : 3).slice(0, Math.min(4, sg.c.iv.length));
            const dur = sg.len * this.sixteenth * 0.96;
            for (const m of tones) playInst(p.inst, t, mtof(m), dur, pc.vol, this.out);
          } else if (p.type === 'arp' || p.type === 'bass' || p.type === 'chords') {
            if (once && idx >= pc.pat.length * 4) continue;
            const tok = pc.pat[idx % pc.pat.length];
            if (!tok || tok === '.' || tok === '-') continue;
            const sg = chordAt(this, s);
            if (!sg) continue;
            let len = 1;
            while (pc.pat[(idx + len) % pc.pat.length] === '-' && len < pc.pat.length) len++;
            const dur = len * pc.step * this.sixteenth * 0.9;
            if (p.type === 'arp') {
              const ext = chordTones(sg.c, p.oct != null ? p.oct : 4);
              const k = Math.max(1, parseInt(tok, 10) || 1) - 1;
              playInst(p.inst, t, mtof(ext[k % ext.length]), dur, pc.vol * rnd(0.85, 1), this.out);
            } else if (p.type === 'chords') {
              const tones = chordTones(sg.c, p.oct != null ? p.oct : 4).slice(0, 3);
              for (const m of tones) playInst(p.inst, t, mtof(m), dur, pc.vol * (tok === 'X' ? 1.2 : 1), this.out);
            } else {
              const root = 12 * ((p.oct != null ? p.oct : 2) + 1) + sg.c.root;
              const iv = sg.c.iv;
              const off = { R: 0, 3: iv[1], 5: iv[2] != null ? iv[2] : 7, 8: 12, 7: iv[3] != null ? iv[3] : 10, L: (iv[2] != null ? iv[2] : 7) - 12 }[tok];
              if (off == null) continue;
              playInst(p.inst, t, mtof(root + off), dur, pc.vol * (s % this.barSteps === 0 ? 1 : 0.88), this.out, pc.prevF);
            }
          } else if (p.type === 'drums') {
            for (const k in pc.kit) {
              const str = pc.kit[k];
              if (once && idx >= str.length) continue;
              const ch = str[idx % str.length];
              if (!ch || ch === '.') continue;
              const v = ch === 'X' ? 1 : ch === 'o' ? 0.45 : 0.8;
              if (DRUM[k]) DRUM[k](t, v * pc.vol * 0.9, this.out);
            }
          }
        } catch (err) { /* una nota fallida no debe parar la música */ }
      }
    }
  }

  function pump() {
    if (!ctx || ctx.state !== 'running') return;
    const until = ctx.currentTime + 0.3;
    if (song) {
      song.schedule(until);
      if (song.ended && ctx.currentTime > song.endTime) { retire(song, 0.1); song = null; }
    }
    for (let i = fading.length - 1; i >= 0; i--) {
      const f = fading[i];
      if (ctx.currentTime < f.stopAt - 0.3) f.schedule(until);
      if (ctx.currentTime > f.stopAt + 2.5) {
        try { f.out.disconnect(); f.rev.disconnect(); } catch (err) { /* nada */ }
        fading.splice(i, 1);
      }
    }
  }

  function retire(s, fade) {
    if (!s) return;
    const now = ctx.currentTime;
    try {
      s.out.gain.cancelScheduledValues(now);
      s.out.gain.setValueAtTime(Math.max(0.0001, s.out.gain.value), now);
      s.out.gain.linearRampToValueAtTime(0.0001, now + fade);
    } catch (err) { /* nada */ }
    s.stopAt = now + fade;
    fading.push(s);
  }

  function crossTo(name) {
    if (!ctx) return;
    const def = TRACKS[name];
    if (!def) return;
    if (song && song.name === name && !song.ended) return;
    const jingle = !!def.once;
    if (song) retire(song, jingle ? 0.35 : 1.0);
    song = new Song(name, def);
    const now = ctx.currentTime;
    song.out.gain.setValueAtTime(0.0001, now);
    song.out.gain.linearRampToValueAtTime(def.vol || 1, now + (jingle ? 0.05 : 1.2));
    if (jingle) song.next = now + 0.25;
    song.schedule(now + 0.3);
  }

  // ------------------------------------------------------------------ efectos de sonido
  // [máximo simultáneo, separación mínima (s), volumen, reverberación]
  const RULE = {
    tap: [3, 0.05, 0.5, 0], arrow: [3, 0.06, 0.6, 0], bolt: [3, 0.07, 0.4, 0], fireball: [3, 0.08, 0.45, 0.1],
    explosion: [3, 0.09, 0.7, 0.15], ice: [3, 0.08, 0.35, 0.25], freeze: [2, 0.15, 0.5, 0.3], lightning: [3, 0.09, 0.45, 0.15],
    cannon: [3, 0.09, 0.6, 0.1], hit: [4, 0.04, 0.35, 0], hit_heavy: [3, 0.07, 0.5, 0.05], crit: [3, 0.06, 0.4, 0.1],
    die_goblin: [3, 0.06, 0.8, 0.05], die_orc: [3, 0.07, 0.75, 0.05], die_big: [2, 0.2, 0.7, 0.2], roar: [1, 0.6, 0.85, 0.25],
    coin: [3, 0.05, 0.4, 0.05], gem: [2, 0.1, 0.45, 0.25], heal: [2, 0.2, 0.5, 0.3], shield: [2, 0.25, 0.5, 0.25],
    buff: [2, 0.25, 0.45, 0.2], wall_hit: [2, 0.12, 0.45, 0], castle_hit: [2, 0.12, 0.55, 0.05], wall_break: [1, 0.5, 0.85, 0.2],
    click: [3, 0.04, 0.4, 0], open: [2, 0.08, 0.7, 0.05], close: [2, 0.08, 0.65, 0.05], upgrade: [2, 0.08, 0.5, 0.2],
    unlock: [2, 0.2, 0.6, 0.3], star: [3, 0.1, 0.55, 0.3], victory: [1, 1, 0.7, 0.25], defeat: [1, 1, 0.7, 0.25],
    wave: [1, 0.8, 0.65, 0.3], boss_intro: [1, 1, 0.95, 0.35], ready: [3, 0.12, 0.35, 0.25], cast: [3, 0.1, 0.5, 0.2],
    poison: [3, 0.1, 0.4, 0.1], wind: [2, 0.15, 0.45, 0.15], hammer: [3, 0.08, 0.45, 0.1], musket: [3, 0.07, 0.5, 0.1],
    magic: [3, 0.07, 0.7, 0.25], whoosh: [3, 0.05, 0.35, 0.05], deny: [2, 0.12, 0.45, 0], bomb: [3, 0.1, 0.65, 0.12],
    burrow: [2, 0.15, 0.5, 0.05], drum: [2, 0.3, 0.6, 0.15], howl: [1, 0.6, 0.55, 0.35],
  };
  const DEF_RULE = [3, 0.06, 0.4, 0.05];
  const active = {};
  const lastAt = {};
  let voices = 0;
  const MAX_VOICES = 26;
  const warned = {};

  const SFX = {
    tap(t, o, v) {
      noise(t, o, 0.1, 0.5, 'bandpass', 3200 * v, 1100 * v, { q: 1.6 });
      tone(t, o, 'triangle', 950 * v, 320 * v, 0.07, 0.35);
      tone(t, o, 'sine', 190, 90, 0.08, 0.35);
      return 0.12;
    },
    arrow(t, o, v) {
      noise(t, o, 0.17, 0.5, 'bandpass', 2600 * v, 850 * v, { q: 2.2 });
      tone(t, o, 'triangle', 560 * v, 300 * v, 0.06, 0.28);
      return 0.2;
    },
    bolt(t, o, v) {
      tone(t, o, 'sawtooth', 170 * v, 85 * v, 0.13, 0.35, { lp: 900 });
      noise(t, o, 0.22, 0.45, 'bandpass', 1900 * v, 600 * v, { q: 1.4 });
      noise(t, o, 0.015, 0.3, 'highpass', 3000);
      return 0.25;
    },
    fireball(t, o, v) {
      noise(t, o, 0.5, 0.7, 'bandpass', 380 * v, null, { q: 0.9, pts: [[0.15, 1900 * v], [0.5, 280]], swell: 0.06 });
      tone(t, o, 'sawtooth', 85, 48, 0.45, 0.22, { lp: 320 });
      for (let i = 0; i < 4; i++) noise(t + rnd(0.05, 0.35), o, 0.03, 0.18, 'highpass', 3500);
      return 0.55;
    },
    explosion(t, o, v) {
      noise(t, o, 0.95, 0.95, 'lowpass', 2600 * v, 110, { q: 0.7 });
      tone(t, o, 'sine', 125 * v, 34, 0.65, 0.9, { sweep: 0.4 });
      for (let i = 0; i < 5; i++) noise(t + rnd(0.02, 0.4), o, 0.04, 0.22, 'highpass', 2500);
      return 1.0;
    },
    ice(t, o, v) {
      const notes = [2093, 2349, 2637, 3136, 3520];
      for (let i = 0; i < 4; i++) tone(t + i * 0.035, o, 'sine', pick(notes) * v, null, 0.28, 0.22);
      noise(t, o, 0.22, 0.16, 'highpass', 6500);
      return 0.4;
    },
    freeze(t, o, v) {
      tone(t, o, 'triangle', 2500 * v, 850 * v, 0.55, 0.22);
      tone(t, o, 'sine', 3100 * v, 3000 * v, 0.7, 0.08);
      for (let i = 0; i < 7; i++) noise(t + rnd(0, 0.5), o, 0.025, 0.28, 'bandpass', rnd(3000, 6000), null, { q: 3 });
      noise(t, o, 0.6, 0.15, 'highpass', 5000, 9000, { swell: 0.2 });
      return 0.75;
    },
    lightning(t, o, v) {
      const z = ctx.createOscillator();
      z.type = 'square';
      for (let i = 0; i < 18; i++) z.frequency.setValueAtTime(rnd(60, 900) * v, t + i * 0.016);
      const g = ctx.createGain();
      envPerc(g, t, 0.002, 0.16, 0.32);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3000;
      z.connect(f); f.connect(g); g.connect(o);
      z.start(t); z.stop(t + 0.36);
      cleanup(z, [z, f, g]);
      for (let i = 0; i < 4; i++) noise(t + i * rnd(0.03, 0.07), o, rnd(0.04, 0.09), 0.5, 'highpass', 1800);
      tone(t, o, 'sawtooth', 70, 48, 0.3, 0.25, { lp: 400 });
      return 0.4;
    },
    cannon(t, o, v) {
      tone(t, o, 'sine', 95 * v, 30, 0.6, 1, { sweep: 0.35 });
      noise(t, o, 0.55, 0.85, 'lowpass', 1300 * v, 90, { q: 0.7 });
      noise(t, o, 0.025, 0.4, 'highpass', 3000);
      return 0.65;
    },
    hit(t, o, v) {
      noise(t, o, 0.07, 0.6, 'bandpass', 1300 * v, null, { q: 1 });
      tone(t, o, 'sine', 170 * v, 70, 0.09, 0.55);
      return 0.1;
    },
    hit_heavy(t, o, v) {
      tone(t, o, 'sine', 115 * v, 38, 0.24, 0.95);
      noise(t, o, 0.2, 0.7, 'lowpass', 950 * v, 180);
      return 0.26;
    },
    crit(t, o, v) {
      tone(t, o, 'square', 1800 * v, 1700 * v, 0.07, 0.14, { lp: 5000 });
      tone(t + 0.015, o, 'sine', 2637 * v, null, 0.3, 0.22);
      noise(t, o, 0.06, 0.5, 'bandpass', 1500, null, { q: 1 });
      tone(t, o, 'sine', 180, 70, 0.1, 0.5);
      return 0.32;
    },
    die_goblin(t, o, v) {
      tone(t, o, 'square', 980 * v, 360 * v, 0.24, 0.16, { lp: 2600, vib: [28, 70] });
      noise(t + 0.03, o, 0.12, 0.15, 'bandpass', 1800, 700);
      return 0.26;
    },
    die_orc(t, o, v) {
      tone(t, o, 'sawtooth', 215 * v, 82 * v, 0.4, 0.4, { bp: 720, q: 2.2 });
      tone(t, o, 'sawtooth', 160 * v, 64 * v, 0.38, 0.2, { lp: 500 });
      noise(t, o, 0.25, 0.22, 'lowpass', 650);
      return 0.42;
    },
    die_big(t, o, v) {
      tone(t, o, 'sawtooth', 145 * v, 42, 0.95, 0.5, { lp: 520, vib: [9, 40] });
      noise(t, o, 0.85, 0.6, 'lowpass', 900, 90);
      tone(t + 0.28, o, 'sine', 95, 32, 0.55, 0.95);
      return 1.0;
    },
    roar(t, o, v) {
      const n = noise(t, o, 1.35, 0.55, 'bandpass', 420 * v, 300 * v, { q: 2.5, swell: 0.15 });
      tone(t, o, 'sawtooth', 112 * v, 76 * v, 1.3, 0.55, { lp: 950, vib: [17, 45], a: 0.12 });
      tone(t, o, 'sawtooth', 168 * v, 110 * v, 1.2, 0.25, { bp: 800, q: 3, vib: [13, 60], a: 0.15 });
      return n ? 1.4 : 1.4;
    },
    coin(t, o, v) {
      tone(t, o, 'square', 988 * v, null, 0.075, 0.15, { lp: 5000 });
      tone(t + 0.07, o, 'square', 1319 * v, null, 0.26, 0.15, { lp: 5000 });
      return 0.33;
    },
    gem(t, o, v) {
      [1047, 1319, 1568, 2093].forEach((f, i) => tone(t + i * 0.05, o, 'triangle', f * v, null, 0.35, 0.3));
      tone(t + 0.2, o, 'sine', 3136 * v, null, 0.5, 0.15);
      return 0.7;
    },
    heal(t, o, v) {
      [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.065, o, 'sine', f * v, null, 0.55, 0.3, { a: 0.02 }));
      noise(t, o, 0.5, 0.08, 'highpass', 7000, null, { swell: 0.2 });
      return 0.8;
    },
    shield(t, o, v) {
      tone(t, o, 'sine', 300 * v, 720 * v, 0.55, 0.45, { a: 0.03 });
      tone(t, o, 'triangle', 600 * v, 1400 * v, 0.5, 0.15, { a: 0.03 });
      tone(t + 0.12, o, 'sine', 2200 * v, null, 0.7, 0.1);
      return 0.85;
    },
    buff(t, o, v) {
      [523, 659, 784].forEach((f, i) => tone(t + i * 0.05, o, 'square', f * v, null, 0.1, 0.12, { lp: 3500 }));
      tone(t + 0.15, o, 'square', 1047 * v, null, 0.35, 0.13, { lp: 3500, vib: [6, 15] });
      return 0.5;
    },
    wall_hit(t, o, v) {
      noise(t, o, 0.13, 0.65, 'lowpass', 520 * v, 200);
      tone(t, o, 'sine', 125 * v, 58, 0.13, 0.6);
      return 0.15;
    },
    castle_hit(t, o, v) {
      noise(t, o, 0.28, 0.8, 'lowpass', 950 * v, 180);
      tone(t, o, 'sine', 92 * v, 38, 0.3, 0.85);
      for (let i = 0; i < 3; i++) noise(t + 0.05 + i * rnd(0.04, 0.08), o, 0.04, 0.25, 'bandpass', rnd(1500, 2600), null, { q: 2 });
      return 0.35;
    },
    wall_break(t, o, v) {
      noise(t, o, 1.3, 0.95, 'lowpass', 1600 * v, 90, { q: 0.6 });
      tone(t, o, 'sine', 75 * v, 28, 0.9, 1);
      for (let i = 0; i < 9; i++) {
        const tt = t + 0.1 + rnd(0, 0.9);
        noise(tt, o, rnd(0.03, 0.07), rnd(0.2, 0.45), 'bandpass', rnd(900, 3200), null, { q: 2 });
        if (i % 3 === 0) tone(tt, o, 'sine', rnd(140, 220), 60, 0.12, 0.35);
      }
      return 1.4;
    },
    click(t, o, v) {
      tone(t, o, 'sine', 920 * v, 700 * v, 0.05, 0.35);
      tone(t, o, 'triangle', 1850 * v, 1400 * v, 0.03, 0.08);
      return 0.06;
    },
    open(t, o, v) {
      noise(t, o, 0.19, 0.25, 'bandpass', 600 * v, 3200 * v, { q: 1.3 });
      tone(t, o, 'sine', 520 * v, 950 * v, 0.13, 0.18);
      return 0.2;
    },
    close(t, o, v) {
      noise(t, o, 0.17, 0.22, 'bandpass', 3000 * v, 600 * v, { q: 1.3 });
      tone(t, o, 'sine', 820 * v, 440 * v, 0.11, 0.14);
      return 0.18;
    },
    upgrade(t, o, v) {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(t + i * 0.055, o, 'square', f * v, null, 0.16, 0.11, { lp: 4200 }));
      tone(t + 0.27, o, 'sine', 2637 * v, null, 0.45, 0.18);
      noise(t + 0.25, o, 0.35, 0.08, 'highpass', 8000);
      return 0.75;
    },
    unlock(t, o, v) {
      [523, 659, 784].forEach(f => tone(t, o, 'triangle', f * v, null, 0.7, 0.22, { a: 0.01 }));
      [1047, 1319, 1568, 2093].forEach((f, i) => tone(t + 0.18 + i * 0.06, o, 'sine', f * v, null, 0.45, 0.2));
      noise(t, o, 0.5, 0.15, 'bandpass', 500, 5000, { q: 1, swell: 0.15 });
      return 0.9;
    },
    star(t, o, v) {
      tone(t, o, 'triangle', 1319 * v, null, 0.5, 0.3);
      tone(t, o, 'sine', 2637 * v, null, 0.7, 0.22);
      tone(t + 0.04, o, 'sine', 3951 * v, null, 0.45, 0.1);
      noise(t, o, 0.3, 0.1, 'highpass', 8000);
      return 0.75;
    },
    victory(t, o, v) {
      [262, 330, 392, 523].forEach(f => tone(t, o, 'sawtooth', f * v, null, 0.9, 0.12, { lp: 2400, a: 0.02 }));
      noise(t, o, 1.4, 0.25, 'highpass', 5000, 3500);
      DRUM.taiko(t, 0.9, o);
      return 1.5;
    },
    defeat(t, o, v) {
      tone(t, o, 'sawtooth', 294 * v, 280 * v, 0.35, 0.3, { lp: 1200 });
      tone(t + 0.38, o, 'sawtooth', 277 * v, 247 * v, 0.95, 0.3, { lp: 1100, vib: [5.5, 30], a: 0.03 });
      DRUM.ltom(t, 0.8, o);
      return 1.4;
    },
    wave(t, o, v) {
      tone(t, o, 'sawtooth', 110 * v, null, 0.4, 0.38, { lp: 700, a: 0.08 });
      tone(t, o, 'sawtooth', 110.6 * v, null, 0.4, 0.3, { lp: 700, a: 0.08 });
      tone(t + 0.42, o, 'sawtooth', 146.8 * v, null, 0.95, 0.38, { lp: 800, a: 0.1, vib: [5, 8] });
      tone(t + 0.42, o, 'sawtooth', 147.5 * v, null, 0.95, 0.3, { lp: 800, a: 0.1 });
      DRUM.taiko(t, 0.8, o);
      DRUM.taiko(t + 0.42, 0.9, o);
      return 1.45;
    },
    boss_intro(t, o, v) {
      tone(t, o, 'sine', 62, 28, 1.6, 1, { sweep: 1.2 });
      noise(t, o, 1.3, 0.5, 'lowpass', 180, null, { pts: [[1.2, 2600]], swell: 1.1 });
      [73.4, 87.3, 110].forEach(f => tone(t + 1.2, o, 'sawtooth', f * v, null, 1.4, 0.22, { lp: 900, a: 0.02 }));
      DRUM.taiko(t + 1.2, 1, o);
      noise(t + 1.2, o, 1.5, 0.22, 'highpass', 4500, 3000);
      return 2.8;
    },
    ready(t, o, v) {
      tone(t, o, 'sine', 1319 * v, null, 0.3, 0.25);
      tone(t + 0.07, o, 'sine', 1976 * v, null, 0.4, 0.22);
      tone(t + 0.07, o, 'triangle', 3951 * v, null, 0.2, 0.05);
      return 0.5;
    },
    cast(t, o, v) {
      noise(t, o, 0.38, 0.4, 'bandpass', 420 * v, 3200 * v, { q: 1.5, swell: 0.1 });
      tone(t, o, 'sine', 380 * v, 1250 * v, 0.32, 0.22, { a: 0.02 });
      tone(t + 0.22, o, 'sine', 2093 * v, null, 0.3, 0.12);
      return 0.55;
    },
    poison(t, o, v) {
      for (let i = 0; i < 5; i++) { const f = rnd(280, 520) * v; tone(t + i * 0.06 + rnd(0, 0.03), o, 'sine', f, f * 1.9, 0.08, 0.3, { sweep: 0.06 }); }
      noise(t, o, 0.3, 0.1, 'lowpass', 900);
      return 0.42;
    },
    wind(t, o, v) {
      noise(t, o, 0.95, 0.65, 'bandpass', 380 * v, null, { q: 3.5, pts: [[0.35, 1300 * v], [0.95, 450 * v]], swell: 0.28 });
      noise(t, o, 0.8, 0.12, 'highpass', 4500, null, { swell: 0.3 });
      return 1.0;
    },
    hammer(t, o, v) {
      const b = 340 * v;
      [[1, 0.35, 0.5], [2.4, 0.22, 0.4], [3.9, 0.14, 0.3], [5.8, 0.09, 0.22]].forEach(p => tone(t, o, 'sine', b * p[0], null, p[2], p[1]));
      tone(t, o, 'sine', 130, 60, 0.12, 0.6);
      noise(t, o, 0.04, 0.35, 'highpass', 3000);
      return 0.55;
    },
    musket(t, o, v) {
      noise(t, o, 0.13, 0.95, 'highpass', 900 * v, null, { a: 0.001 });
      noise(t, o, 0.35, 0.5, 'lowpass', 1100, 150);
      tone(t, o, 'sine', 160 * v, 50, 0.2, 0.6);
      return 0.4;
    },
    magic(t, o, v) {
      tone(t, o, 'sine', 620 * v, 1850 * v, 0.3, 0.22, { vib: [24, 60] });
      for (let i = 0; i < 3; i++) tone(t + 0.05 + i * 0.06, o, 'sine', pick([2093, 2637, 3136, 3520]) * v, null, 0.25, 0.1);
      return 0.45;
    },
    whoosh(t, o, v) {
      noise(t, o, 0.26, 0.55, 'bandpass', 320 * v, null, { q: 1.6, pts: [[0.12, 1500 * v], [0.26, 420 * v]], swell: 0.08 });
      return 0.28;
    },
    deny(t, o, v) {
      tone(t, o, 'square', 220 * v, null, 0.09, 0.16, { lp: 1500 });
      tone(t + 0.11, o, 'square', 175 * v, null, 0.16, 0.16, { lp: 1500 });
      return 0.3;
    },
    bomb(t, o, v) {
      noise(t, o, 0.12, 0.25, 'highpass', 5200, null, { q: 1 });
      noise(t + 0.1, o, 0.55, 0.85, 'lowpass', 3000 * v, 180, { q: 0.8 });
      tone(t + 0.1, o, 'sine', 210 * v, 48, 0.32, 0.85, { sweep: 0.2 });
      for (let i = 0; i < 4; i++) noise(t + 0.12 + rnd(0, 0.3), o, 0.035, 0.2, 'highpass', 2600);
      return 0.7;
    },
    burrow(t, o, v) {
      for (let i = 0; i < 3; i++) noise(t + i * 0.09, o, 0.08, 0.5, 'lowpass', rnd(700, 1100) * v, 300, { q: 1.2 });
      tone(t, o, 'sine', 62, 45, 0.42, 0.45);
      return 0.45;
    },
    drum(t, o, v) {
      DRUM.taiko(t, 0.9 * v, o);
      DRUM.taiko(t + 0.19, 0.75 * v, o);
      noise(t, o, 0.06, 0.15, 'bandpass', 900);
      return 0.95;
    },
    howl(t, o, v) {
      const voice = (dt, mul, vol) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        const f0 = 360 * v * mul;
        osc.frequency.setValueAtTime(f0, t + dt);
        osc.frequency.exponentialRampToValueAtTime(f0 * 1.95, t + dt + 0.45);
        osc.frequency.setValueAtTime(f0 * 1.95, t + dt + 0.75);
        osc.frequency.exponentialRampToValueAtTime(f0 * 1.35, t + dt + 1.3);
        const l = ctx.createOscillator(), lg = ctx.createGain();
        l.frequency.value = 6; lg.gain.value = 22; l.connect(lg); lg.connect(osc.detune);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.2;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t + dt);
        g.gain.linearRampToValueAtTime(vol, t + dt + 0.25);
        g.gain.setValueAtTime(vol, t + dt + 0.9);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 1.35);
        osc.connect(bp); bp.connect(g); g.connect(o);
        osc.start(t + dt); osc.stop(t + dt + 1.4); l.start(t + dt); l.stop(t + dt + 1.4);
        cleanup(osc, [osc, l, lg, bp, g]);
      };
      voice(0, 1, 0.7);
      voice(0.12, 1.12, 0.35);
      return 1.55;
    },
  };

  function sfx(name, opts) {
    if (!sfxOn || !ctx || ctx.state !== 'running') return false;
    const fn = SFX[name];
    if (!fn) {
      if (!warned[name]) { warned[name] = true; console.warn('[audio] efecto desconocido:', name); }
      return false;
    }
    opts = opts || {};
    const r = RULE[name] || DEF_RULE;
    const now = ctx.currentTime;
    if (lastAt[name] != null && now - lastAt[name] < r[1]) return false;
    const n = active[name] || 0;
    if (n >= r[0]) return false;
    if (voices >= MAX_VOICES && r[1] < 0.2) return false;
    lastAt[name] = now;
    const out = ctx.createGain();
    out.gain.value = r[2] * (opts.vol != null ? opts.vol : 1) / Math.sqrt(1 + n * 0.8);
    out.connect(sfxBus);
    let send = null;
    if (r[3] > 0) { send = gainNode(r[3]); out.connect(send); send.connect(revIn); }
    const pitch = (opts.pitch || 1) * (1 + (Math.random() - 0.5) * 0.08);
    let dur = 0.5;
    try { dur = fn(now + 0.004, out, pitch) || 0.5; } catch (err) { console.warn('[audio] fallo en efecto', name, err); }
    active[name] = n + 1;
    voices++;
    setTimeout(() => {
      active[name] = Math.max(0, (active[name] || 1) - 1);
      voices = Math.max(0, voices - 1);
      setTimeout(() => { try { out.disconnect(); if (send) send.disconnect(); } catch (err) { /* nada */ } }, 1500);
    }, (dur + 0.05) * 1000);
    return true;
  }

  // ------------------------------------------------------------------ API pública
  function music(name) {
    if (name && !TRACKS[name]) {
      console.warn('[audio] pista desconocida:', name);
      name = 'mapa';
    }
    wanted = name || null;
    if (!ctx || !musicOn) return;
    if (!name) { stopMusic(); return; }
    crossTo(name);
  }
  function stopMusic(fade) {
    if (!ctx) return;
    if (song) { retire(song, fade != null ? fade : 0.8); song = null; }
  }
  function setMusic(on) {
    musicOn = !!on;
    if (!ctx) return;
    if (!musicOn) stopMusic(0.5);
    else if (wanted && !song) {
      if (TRACKS[wanted] && TRACKS[wanted].once) return;
      crossTo(wanted);
    }
  }
  function setSfx(on) { sfxOn = !!on; }

  // Analiza un efecto o una pista renderizando sin conexión (para pruebas): → Promise<{peak, rms}>
  function analyze(kind, name, seconds) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return Promise.resolve(null);
    const secs = seconds || (kind === 'music' ? 6 : 2);
    const rate = 22050;
    const off = new OAC(2, Math.ceil(rate * secs), rate);
    const saved = { ctx, master, comp, musicBus, sfxBus, revIn, revOut, noiseBuf, driveCurve };
    try {
      ctx = off;
      buildGraph();
      if (kind === 'music') {
        const s = new Song(name, TRACKS[name]);
        s.out.gain.value = TRACKS[name].vol || 1;
        s.next = 0.02;
        s.schedule(secs);
      } else {
        const out = ctx.createGain();
        const r = RULE[name] || DEF_RULE;
        out.gain.value = r[2];
        out.connect(sfxBus);
        if (r[3] > 0) { const sd = gainNode(r[3]); out.connect(sd); sd.connect(revIn); }
        SFX[name](0.01, out, 1);
      }
    } catch (err) {
      Object.assign({}, saved);
      ctx = saved.ctx; master = saved.master; comp = saved.comp; musicBus = saved.musicBus; sfxBus = saved.sfxBus;
      revIn = saved.revIn; revOut = saved.revOut; noiseBuf = saved.noiseBuf; driveCurve = saved.driveCurve;
      return Promise.reject(err);
    }
    ctx = saved.ctx; master = saved.master; comp = saved.comp; musicBus = saved.musicBus; sfxBus = saved.sfxBus;
    revIn = saved.revIn; revOut = saved.revOut; noiseBuf = saved.noiseBuf; driveCurve = saved.driveCurve;
    return off.startRendering().then(buf => {
      let peak = 0, sum = 0;
      const n = buf.length;
      for (let ch = 0; ch < buf.numberOfChannels; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < n; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; }
      }
      return { peak: Math.round(peak * 1000) / 1000, rms: Math.round(Math.sqrt(sum / (n * buf.numberOfChannels)) * 1000) / 1000, buffer: buf };
    });
  }

  BB.audio = {
    init, music, sfx, setMusic, setSfx, stopMusic, analyze,
    get current() { return song && !song.ended ? song.name : wanted; },
    get musicOn() { return musicOn; },
    get sfxOn() { return sfxOn; },
    get ctx() { return ctx; },
    get supported() { return !!AC; },
    tracks: Object.keys(TRACKS),
    sfxNames: Object.keys(SFX),
  };
})();
