/* Bastión Bravo · curvas globales de dificultad y economía (las ajusta el integrador).
   Todas las funciones de multiplicador valen 1 en el nivel 1. */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};

  const RARITY_MUL = { comun: 1, rara: 1.3, epica: 1.7, legendaria: 2.2 };
  const CASTLE_BASE = { torreon: 30, muralla: 30, ballesta: 25, tesoro: 120, reparacion: 90 };

  const bal = BB.balance = {
    RARITY_MUL,
    HERO_MAX_LEVEL: 100,
    TOWER_MAX_LEVEL: 40,
    LEVELS_PER_TALENT_POINT: 2,
    ELITE_HP: 2.4,
    ELITE_DMG: 1.5,
    replayGoldMul: 0.75,

    // Enemigos (multiplicadores sobre las estadísticas base de nivel 1)
    // Más exigente al principio (+40 % en el nivel 1, que se diluye hacia el nivel 40)
    enemyHp(L) { const x = Math.max(0, L - 1); return 1.55 * (1 + 0.15 * x + 0.0045 * x * x) * (1 + 0.4 * Math.max(0, 1 - x / 40)); },
    enemyDmg(L) { const x = Math.max(0, L - 1); return 1.2 * (1 + 0.07 * x + 0.0012 * x * x) * (1 + 0.3 * Math.max(0, 1 - x / 40)); },
    enemyGold(L) { const x = Math.max(0, L - 1); return 1.45 * (1 + 0.12 * x + 0.002 * x * x); },
    bossHp(L) { return bal.enemyHp(L) * 0.8; },

    // Recompensa fija por superar el nivel L (sin contar el oro de los enemigos)
    levelGold(L) { return Math.round(80 + 32 * L + 1.5 * L * L); },

    // Héroes
    heroDmg(n) { const x = Math.max(0, n - 1); return 1 + 0.11 * x + 0.0022 * x * x; },
    heroLevelCost(n, rarity) {        // coste en oro de subir del nivel n al n+1
      return Math.round((RARITY_MUL[rarity] || 1) * 10 * Math.pow(Math.max(1, n), 1.62));
    },

    // Torres y trampas
    towerDmg(lvl) { const x = Math.max(0, lvl - 1); return 1 + 0.12 * x + 0.002 * x * x; },
    towerLevelCost(lvl) { return Math.round(60 * Math.pow(Math.max(1, lvl), 1.7)); },

    // Mejoras del castillo (lvl = nivel actual; devuelve el coste del siguiente)
    castleCost(id, lvl) { return Math.round((CASTLE_BASE[id] || 40) * Math.pow(lvl + 1, 1.75)); },
  };
})();
