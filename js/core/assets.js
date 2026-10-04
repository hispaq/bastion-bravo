/* Bastión Bravo · carga de imágenes (sprites generados con IA) */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};

  const images = {};      // clave → Image cargada
  const failed = {};      // clave → true si falló
  const silCache = {};    // clave → canvas blanco (destello al recibir daño)
  const urlCache = {};    // clave → dataURL de los personajes dibujados
  let total = 0, done = 0, started = false;
  const waiters = [];

  function finishOne() {
    done++;
    if (done >= total) while (waiters.length) waiters.shift()();
  }

  BB.assets = {
    // Carga todas las imágenes del manifiesto. Nunca falla: si una imagen no existe, se ignora.
    loadAll(onProgress) {
      const sprites = BB.SPRITES || {};
      const keys = Object.keys(sprites);
      if (started) return new Promise(res => (done >= total ? res() : waiters.push(res)));
      started = true;
      total = keys.length;
      if (!total) return Promise.resolve();
      return new Promise(resolve => {
        waiters.push(resolve);
        for (const key of keys) {
          const meta = sprites[key];
          const img = new Image();
          img.decoding = 'async';
          img.onload = () => { images[key] = img; finishOne(); if (onProgress) onProgress(done / total); };
          img.onerror = () => { failed[key] = true; finishOne(); if (onProgress) onProgress(done / total); };
          img.src = meta.src;
        }
        // Red de seguridad: no bloquear el arranque más de 20 s
        setTimeout(() => { while (waiters.length) waiters.shift()(); }, 20000);
      });
    },
    progress() { return total ? done / total : 1; },
    // Personajes: siempre el dibujo vectorial animable (estilo unificado), no la imagen de IA
    isRig(key) { return !!(BB.rig && BB.rig.has(key)); },
    get(key) {
      if (BB.rig && BB.rig.has(key)) { try { return BB.rig.image(key, 256); } catch (err) { /* sigue con la imagen */ } }
      const cm = /^castle_([1-5])$/.exec(key);
      if (cm && BB.scenery && BB.scenery.castleImage) { try { return BB.scenery.castleImage(+cm[1]); } catch (err) { /* sigue */ } }
      const img = images[key];
      return img && img.naturalWidth > 0 ? img : null;
    },
    has(key) { return !!BB.assets.get(key); },
    meta(key) {
      if (BB.rig && BB.rig.has(key)) { const c = BB.rig.image(key, 256); return { src: BB.assets.url(key), w: c.width, h: c.height, facing: 'right' }; }
      return (BB.SPRITES || {})[key] || null;
    },
    // Silueta blanca de un sprite para el parpadeo al recibir daño
    silhouette(key) {
      if (silCache[key] !== undefined) return silCache[key];
      const img = BB.assets.get(key);
      if (!img) return null;
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, c.width, c.height);
        silCache[key] = c;
      } catch (err) {
        silCache[key] = null;
      }
      return silCache[key];
    },
    // URL de la imagen (para <img> en la interfaz) o null
    url(key) {
      if (BB.rig && BB.rig.has(key)) {
        if (!urlCache[key]) { try { urlCache[key] = BB.rig.image(key, 256).toDataURL('image/png'); } catch (err) { urlCache[key] = null; } }
        if (urlCache[key]) return urlCache[key];
      }
      if (/^castle_[1-5]$/.test(key) && BB.scenery) {
        if (!urlCache[key]) { try { urlCache[key] = BB.assets.get(key).toDataURL('image/png'); } catch (err) { urlCache[key] = null; } }
        if (urlCache[key]) return urlCache[key];
      }
      const m = (BB.SPRITES || {})[key];
      return m && !failed[key] ? m.src : null;
    },
  };
})();
