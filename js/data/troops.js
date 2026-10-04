/* Bastión Bravo · tropas reclutables: se compran por unidades, se mejoran por grupo y aparecen
   en las almenas del castillo y en el adarve de la muralla, disparando de verdad. */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  BB.data = BB.data || {};

  // Huecos para tropas: en el suelo, detrás de la torre (filas del fondo de la plaza)
  BB.TROOP_SLOTS = [
    { x: 1330, y: 548 }, { x: 1374, y: 548 }, { x: 1418, y: 548 }, { x: 1462, y: 548 },
    { x: 1352, y: 572 }, { x: 1396, y: 572 }, { x: 1440, y: 572 }, { x: 1484, y: 572 },
    { x: 1506, y: 548 }, { x: 1528, y: 572 }, { x: 1550, y: 548 }, { x: 1572, y: 572 },
  ];

  BB.data.troops = {
    arquero: {
      id: 'arquero', name: 'Arquero', desc: 'Soldado del castillo que dispara flechas a tierra y aire. Barato y fiable.',
      rig: 'troop_arquero', size: 52, unlockLevel: 1, max: 12, baseCost: 60,
      attack: { damage: 5, interval: 1.15, range: 900, type: 'physical', projectile: 'arrow', speed: 1050, air: true, ground: true, prefer: 'front', crit: 0.05 },
    },
    ballestero: {
      id: 'ballestero', name: 'Ballestero', desc: 'Dispara virotes pesados que atraviesan escudos. Más lento, más daño.',
      rig: 'troop_ballestero', size: 54, unlockLevel: 9, max: 12, baseCost: 140,
      attack: { damage: 13, interval: 2.0, range: 1000, type: 'physical', projectile: 'bolt', speed: 1300, air: true, ground: true, prefer: 'strongest', pierce: 1 },
    },
    aprendiz: {
      id: 'aprendiz', name: 'Mago aprendiz', desc: 'Lanza chispas mágicas teledirigidas que ignoran la armadura.',
      rig: 'troop_aprendiz', size: 52, unlockLevel: 16, max: 12, baseCost: 220,
      attack: { damage: 9, interval: 1.5, range: 850, type: 'arcane', projectile: 'magic', speed: 650, air: true, ground: true, prefer: 'front', color: '#b56cff' },
    },
    lanzapiedras: {
      id: 'lanzapiedras', name: 'Lanzapiedras', desc: 'Arroja piedras en parábola con daño en área. Solo contra enemigos de tierra.',
      rig: 'troop_lanzapiedras', size: 54, unlockLevel: 24, max: 12, baseCost: 300,
      attack: { damage: 15, interval: 2.4, range: 800, type: 'physical', projectile: 'rock', speed: 620, arc: 120, radius: 55, air: false, ground: true, prefer: 'front' },
    },
  };
  BB.data.troopOrder = ['arquero', 'ballestero', 'aprendiz', 'lanzapiedras'];

  function st(save) {
    save.troops = save.troops || {};
    for (const id of BB.data.troopOrder) save.troops[id] = save.troops[id] || { count: 0, level: 1 };
    return save.troops;
  }

  BB.troopsApi = {
    state(id, save) { return st(save || BB.save.data)[id]; },
    total(save) { const t = st(save || BB.save.data); return BB.data.troopOrder.reduce((s, id) => s + (t[id].count || 0), 0); },
    slotsMax() { return BB.TROOP_SLOTS.length; },
    unlocked(id, save) { save = save || BB.save.data; return (save.maxLevel || 1) >= (BB.data.troops[id].unlockLevel || 1); },
    // Coste de reclutar una unidad más (crece con las que ya tienes de ese tipo)
    recruitCost(id, save) {
      const s = BB.troopsApi.state(id, save), d = BB.data.troops[id];
      return { gold: Math.round(d.baseCost * Math.pow(1.45, s.count || 0)) };
    },
    levelCost(id, save) {
      const s = BB.troopsApi.state(id, save), d = BB.data.troops[id];
      return { gold: Math.round(d.baseCost * 0.9 * Math.pow(s.level || 1, 1.7)) };
    },
    canRecruit(id, save) {
      save = save || BB.save.data;
      const s = BB.troopsApi.state(id, save), d = BB.data.troops[id];
      return BB.troopsApi.unlocked(id, save) && s.count < d.max && BB.troopsApi.total(save) < BB.troopsApi.slotsMax() &&
        BB.econ.canAfford(BB.troopsApi.recruitCost(id, save));
    },
    recruit(id) {
      const save = BB.save.data;
      if (!BB.troopsApi.canRecruit(id, save)) return false;
      if (!BB.econ.spend(BB.troopsApi.recruitCost(id, save))) return false;
      BB.troopsApi.state(id, save).count++;
      BB.save.commit();
      return true;
    },
    levelUp(id) {
      const save = BB.save.data;
      const s = BB.troopsApi.state(id, save);
      if (!s.count || s.level >= 60) return false;
      if (!BB.econ.spend(BB.troopsApi.levelCost(id, save))) return false;
      s.level++;
      BB.save.commit();
      return true;
    },
    // Estadísticas de ataque de una unidad a su nivel
    stats(id, save) {
      const s = BB.troopsApi.state(id, save || BB.save.data), d = BB.data.troops[id];
      const a = Object.assign({}, d.attack);
      a.damage = a.damage * BB.balance.heroDmg(s.level || 1);
      return a;
    },
  };
})();
