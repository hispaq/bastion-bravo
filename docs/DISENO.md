# BASTIÓN BRAVO — Documento de diseño y contratos técnicos

Juego *tower defense* para móvil (horizontal), inspirado en el género "defiende tu castillo"
(tipo Grow Castle) pero con contenido 100 % original. Todo el texto del juego va en **español**.

Carpeta del proyecto: `C:\Users\pabli\Desktop\BastionBravo`

> Este documento es el contrato entre el integrador (agente principal) y los 5 subagentes.
> Si algo de tu módulo necesita un cambio en el contrato, **no edites archivos de otros**:
> resuélvelo dentro de tus archivos y apúntalo en tu informe final.

---

## 1. Idea y reglas

- El castillo del jugador está a la **derecha**. Oleadas de orcos y goblins llegan desde la **izquierda**.
- Delante del castillo hay una **muralla** (HP propio + armadura). Mientras la muralla aguanta, los enemigos
  terrestres se paran a golpearla. Si cae, avanzan hasta el castillo. **Los voladores ignoran la muralla**
  y atacan directamente al castillo.
- Si la vida del castillo llega a 0 → **derrota**. Si se derrotan todos los enemigos del nivel → **victoria**.
- Castillo y muralla empiezan cada nivel con la vida al máximo.
- **Héroes** (mínimo 18; hay 20) se colocan en los **huecos** del castillo (3 al empezar, hasta 10 con mejoras).
  Atacan solos. Cada uno tiene una **habilidad especial** con recarga (botón en el HUD; opción de lanzamiento
  automático en Ajustes) y un **árbol de talentos**.
- **Ataque por toque**: tocar el campo de batalla dispara un virote del castillo al punto tocado
  (daño mejorable, recarga corta).
- **Torres y trampas**: 4 huecos en el suelo delante de la muralla (pinchos, catapulta, torre de rayos,
  torre de flechas, pozo de brea, barricada).
- **12 tipos de enemigo** con debilidades distintas; van apareciendo poco a poco con los niveles.
- **100 niveles**, 10 zonas de 10 niveles. El nivel 10, 20, …, 100 es un **jefe** distinto (10 jefes),
  con fases, ataques especiales, barra de vida grande y **presentación especial**.
- **Mapa de progresión** con un camino que recorre las 10 zonas (100 nodos). Estrellas (1–3) por nivel.
  Los jefes se ven destacados. El fondo del combate cambia según la zona.
- **Economía**: oro (enemigos + recompensa de nivel) y gemas (primeras victorias, jefes, 3 estrellas,
  logros, recompensa diaria). Se gasta en mejorar castillo, héroes, talentos y torres.
  Se pueden **repetir niveles** para ganar más oro. **Recompensa diaria**, **logros**, **guardado automático**.
- Estrellas al ganar: castillo con ≥ 80 % de vida → 3★, ≥ 45 % → 2★, si no → 1★.

## 2. Contenido (nombres oficiales)

### 2.1 Zonas (10 niveles cada una; el último de cada zona es el jefe)
| # | id | Nombre | Niveles | Jefe |
|---|----|--------|---------|------|
| 1 | bosque | Bosque Esmeralda | 1–10 | rey_goblin |
| 2 | pantano | Pantano Brumoso | 11–20 | chaman_gigante |
| 3 | montanas | Picos Grises | 21–30 | troll_piedra |
| 4 | desierto | Desierto de Ámbar | 31–40 | escorpion |
| 5 | volcan | Volcán Ardiente | 41–50 | senor_fuego |
| 6 | oscuras | Tierras Oscuras | 51–60 | senor_guerra |
| 7 | hielo | Cumbres Heladas | 61–70 | gigante_escarcha |
| 8 | ruinas | Ruinas Malditas | 71–80 | nigromante |
| 9 | forja | Forja de Hierro | 81–90 | golem |
| 10 | dragon | Nido del Dragón | 91–100 | dragon |

### 2.2 Enemigos (12) — `BB.data.enemies[id]`
| id | Nombre | Idea | Debilidad clave | Aparece en |
|----|--------|------|-----------------|-----------|
| goblin_veloz | Goblin Saltarín | pequeño, rapidísimo, poca vida | daño en área, flechas | 1 |
| orco_escudo | Orco Escudero | escudo frontal: bloquea gran parte del daño físico de proyectiles rectos | magia (fuego, hielo, rayo, arcano) y disparos en parábola (catapulta, cañón) | 3 |
| goblin_bombardero | Goblin Petardo | corre hacia la muralla y explota (mucho daño); al morir su bomba daña a enemigos cercanos | daño rápido a distancia | 5 |
| goblin_planeador | Goblin Planeador | **volador**: ignora trampas, barricada y muralla | flechas, rayo, halcones (antiaéreo) | 7 |
| jinete_lobo | Jinete de Lobo | muy rápido; salta barricadas y trampas | hielo (ralentizar/congelar), aturdir | 12 |
| chaman | Chamán Curandero | se queda atrás y cura a los enemigos cercanos | francotiradores (ballestero), veneno (reduce curación) | 15 |
| goblin_arquero | Goblin Arquero | se para a distancia y dispara al castillo | héroes de largo alcance | 18 |
| orco_berserker | Orco Berserker | por debajo del 50 % de vida se enfurece (más rápido y más daño) | aturdir, congelar, daño explosivo | 23 |
| orco_tambor | Orco Tamborilero | su tambor acelera y protege a los aliados cercanos | daño concentrado, veneno | 27 |
| goblin_topo | Goblin Topo | viaja bajo tierra (inmune salvo a trampas y efectos de suelo) y sale junto a la muralla | trampas, terremotos, área al salir | 32 |
| troll | Troll del Musgo | tanque enorme, lento, se regenera, armadura física | fuego (anula la regeneración), veneno, daño % | 36 |
| orco_ariete | Ariete de Guerra | dos orcos con un ariete: daño brutal a la muralla, inmune a empujes y ralentizaciones | fuego (es de madera), trampas | 42 |

### 2.3 Jefes (10) — `BB.data.bosses[id]`
| Nivel | id | Nombre | Título | Concepto |
|------|----|--------|--------|----------|
| 10 | rey_goblin | Rey Grikko | El Rey Goblin | goblin gordo con corona en un trono con ruedas; lanza bombas de oro, llama a su guardia; fase 2: embiste con el trono |
| 20 | chaman_gigante | Mog'Rath | El Gran Chamán | chamán orco gigante; se cura, invoca tótems y lluvia venenosa; fase 2: lobos espectrales |
| 30 | troll_piedra | Gorrumbo | El Troll de Piedra | troll de roca; lanza pedruscos al castillo; fase 2: piel de piedra (inmune al físico a ratos); fase 3: terremoto que aturde héroes |
| 40 | escorpion | Khazrak | El Jinete del Escorpión | caudillo goblin sobre un escorpión gigante; se entierra (invulnerable) y reaparece; aguijón venenoso |
| 50 | senor_fuego | Ignarok | Señor del Magma | orco con armadura de lava; lluvia de fuego; fase 2: escudo de lava (inmune al fuego, débil al hielo) |
| 60 | senor_guerra | Thargrim | Señor de la Guerra | orco colosal acorazado; grito de guerra, invoca élites; fase 2: muro de escudos; fase 3: furia |
| 70 | gigante_escarcha | Hrimgor | El Ogro de Escarcha | congela huecos de héroe (los desactiva unos segundos), ventisca; fase 2: armadura de hielo que se regenera |
| 80 | nigromante | Vorlath | El Nigromante | revive enemigos caídos como esqueletos, maldice a los héroes, se teletransporta; fase 2: forma espectral voladora |
| 90 | golem | Gran Gólem de Tuerca | Máquina de Guerra Goblin | mecha de vapor pilotado por goblins; andanada de cañones, suelta topos; fases con escudo (débil al rayo) |
| 100 | dragon | Skarnoth | El Dragón de los Orcos | dragón con jinete orco; **volador**; aliento de fuego al castillo; fase 2: aterriza; fase 3: infierno |

### 2.4 Héroes (20) — `BB.data.heroes[id]`
Los héroes miran a la **izquierda** (disparan hacia los enemigos).
| id | Nombre | Rol | Habilidad |
|----|--------|-----|-----------|
| arquera | Lira, la Arquera | disparo rápido, tierra y aire | Lluvia de Flechas |
| mago_fuego | Ignazio, Mago de Fuego | bola de fuego en área + quemadura | Meteoro |
| maga_hielo | Nívea, Maga de Hielo | ralentiza | Ventisca (congela en área) |
| ballestero | Brock, el Ballestero | largo alcance, atraviesa, prioriza curanderos y arqueros | Virote Perforante |
| sacerdote | Fray Ámbar, Sacerdote | cura el castillo poco a poco | Bendición (cura + escudo) |
| ingeniero | Tuerca, Ingeniero de Cañones | bala de cañón en parábola, área y empuje (solo tierra) | Andanada |
| hechicera_rayo | Volta, Hechicera del Rayo | rayo en cadena (tierra y aire) | Tormenta |
| druida | Robledo, el Druida | espinas venenosas | Raíces (inmoviliza en área) |
| alquimista | Burbuja, la Alquimista | frascos de ácido: rompen armadura | Lluvia Ácida |
| martillo | Gunnar, Lanzamartillos | martillos que aturden | Martillo Sísmico |
| bardo | Trova, el Bardo | aura: +velocidad de ataque a los héroes | Himno Heroico |
| brujo | Sombra, el Brujo | drena vida (cura el castillo) | Maldición (+daño recibido) |
| halconera | Kira, la Halconera | halcón: daño extra a voladores | Bandada |
| arcano | Orbe, el Mago Arcano | misiles teledirigidos que ignoran escudos | Torrente Arcano |
| granadero | Pólvora, el Granadero | bombas de gran área | Barril Explosivo |
| cazadora | Sierra, Cazadora de Monstruos | daño extra a jefes y enemigos grandes | Arpón |
| monje_viento | Céfiro, Monje del Viento | ráfagas que empujan | Tornado |
| envenenadora | Belladona, la Envenenadora | veneno acumulable | Nube Tóxica |
| sacerdotisa_sol | Solenne, Sacerdotisa del Sol | rayo sagrado (fuerte contra no-muertos) | Rayo Solar |
| mosquetera | Pimienta, la Mosquetera | disparos con muchos críticos | Disparo Certero |

### 2.5 Torres y trampas (6) — `BB.data.towers[id]`
| id | Nombre | Tipo | Idea |
|----|--------|------|------|
| pinchos | Trampa de Pinchos | trampa | daña a los enemigos terrestres que pasan (y a los topos bajo tierra) |
| catapulta | Catapulta | torre | piedras en parábola, área, solo tierra, mucho alcance |
| rayos | Torre de Rayos | torre | rayo en cadena, tierra y aire |
| flechas | Torre de Flechas | torre | disparo rápido, tierra y aire |
| brea | Pozo de Brea | trampa | ralentiza; si recibe fuego arde |
| barricada | Barricada | bloqueo | frena a los terrestres (tiene vida); los lobos la saltan |

### 2.6 Mejoras del castillo — `BB.data.castleUpgrades`
`torreon` (vida del castillo), `muralla` (vida + armadura de la muralla), `huecos` (3 → 10 huecos de héroe),
`ballesta` (daño del ataque por toque), `tesoro` (+% oro), `reparacion` (regeneración del castillo en combate).
El **aspecto** del castillo cambia en 5 etapas (`castle_1` … `castle_5`) según `BB.castleStats(save).tier`.

---

## 3. Arquitectura técnica

- HTML5 + JavaScript puro (sin compilación ni frameworks). Scripts clásicos (`<script src>`), funciona con
  `file://`, con un servidor local y en GitHub Pages. **Nunca uses `fetch` de archivos locales** (falla en
  `file://`): los datos van en `.js`.
- Espacio de nombres global `window.BB`. Cada archivo empieza con
  `(function () { const BB = window.BB = window.BB || {}; ... })();`
- Batalla en un `<canvas>` a pantalla completa; la interfaz son pantallas DOM encima (`#ui`).
- Mundo de combate **fijo de 1600 × 720** (unidades del mundo), independiente de la pantalla. La cámara
  escala el mundo para que quepa entero en horizontal y extiende cielo/suelo si sobra espacio.

### 3.1 Carpetas y dueño de cada archivo
| Ruta | Dueño |
|------|-------|
| `index.html`, `css/base.css`, `js/core/*.js`, `js/data/balance.js`, `js/app.js`, `manifest.webmanifest`, `sw.js` | Integrador |
| `tools/*`, `sprites/**`, `sprites/manifest.js` | Agente **Gráficos IA** |
| `js/data/enemies.js`, `js/data/bosses.js`, `js/ui/boss_intro.js`, `tests/enemigos.html` | Agente **Enemigos y jefes** |
| `js/data/heroes.js`, `js/data/upgrades.js`, `tests/heroes.html` | Agente **Héroes y mejoras** |
| `js/data/zones.js`, `js/data/levels.js`, `js/data/rewards.js`, `js/ui/map.js`, `css/map.css`, `tests/mapa.html` | Agente **Mapa de progresión** |
| `js/audio.js`, `js/ui/ui.js`, `js/ui/screens.js`, `js/ui/hud.js`, `css/ui.css`, `tests/ui.html` | Agente **Interfaz y sonido** |

### 3.2 Orden de carga (index.html)
```
sprites/manifest.js
js/core/util.js  js/core/assets.js  js/data/balance.js  js/core/save.js
js/audio.js
js/data/zones.js  js/data/enemies.js  js/data/bosses.js  js/data/heroes.js
js/data/upgrades.js  js/data/levels.js  js/data/rewards.js
js/core/fx.js  js/core/battle.js  js/core/render.js
js/ui/ui.js  js/ui/screens.js  js/ui/hud.js  js/ui/map.js  js/ui/boss_intro.js
js/app.js
```
Los archivos de datos **no deben ejecutar nada** al cargarse aparte de registrar sus definiciones
(sin depender del orden entre archivos de datos). Las funciones se resuelven en tiempo de ejecución.

---

## 4. Contratos

### 4.1 Mundo — `BB.WORLD` (core/util.js)
```js
BB.WORLD = {
  W: 1600, H: 720, GROUND: 560,          // y de los pies de las unidades terrestres
  SPAWN_X: -60,                          // los enemigos aparecen aquí y caminan hacia la derecha (x+)
  WALL_X: 1235,                          // cara frontal de la muralla
  CASTLE_X: 1300,                        // cara frontal del castillo
  AIR_MIN: 280, AIR_MAX: 400,            // franja de vuelo (y)
  HERO_SLOTS: [ {x:1328,y:500}, {x:1402,y:500}, {x:1328,y:425}, {x:1402,y:425}, {x:1328,y:350},
                {x:1402,y:350}, {x:1328,y:275}, {x:1402,y:275}, {x:1328,y:200}, {x:1402,y:200} ],
  TRAP_SLOTS: [ {x:1150}, {x:1040}, {x:930}, {x:820} ],
  TAP_ORIGIN: { x: 1470, y: 175 },
};
```
Distancias y alcances se miden en unidades del mundo (horizontal). Escala orientativa: alcance de
arquera ≈ 950, mago ≈ 750; velocidad de goblin rápido ≈ 95 u/s, orco ≈ 55, troll ≈ 32, lobo ≈ 140.
Alto de sprite orientativo: héroe 76, goblin 58–66, orco 84–92, troll 150, jefes 200–320.

### 4.2 Guardado — `BB.save` (core/save.js)
`BB.save.data` es el estado; `BB.save.commit()` guarda (con debounce) en `localStorage['bastionbravo.v1']`.
```js
{
  v: 1, created, lastSeen,
  gold: 0, gems: 0,
  maxLevel: 1,                                  // nivel más alto desbloqueado
  levels: { "1": { stars: 3, clears: 2, best: 0.93 } },
  heroes: { arquera: { owned: true, level: 1, talents: { nodo: 2 }, points: 0 } },
  lineup: ["arquera", "mago_fuego", null, ...], // índice = hueco del castillo
  castle: { torreon: 0, muralla: 0, huecos: 0, ballesta: 0, tesoro: 0, reparacion: 0 },
  towers: { pinchos: { owned: false, level: 0 } },
  traps: [null, null, null, null],              // torre/trampa colocada en cada hueco del suelo
  settings: { music: true, sfx: true, autoSkills: false, speed: 1, vibration: true, quality: 'alta' },
  daily: { last: "2026-10-02", streak: 0 },
  achievements: { id: { claimed: false } },
  stats: { kills: 0, killsByType: {}, bossesKilled: 0, goldEarned: 0, gemsEarned: 0, levelsWon: 0,
           threeStars: 0, abilitiesCast: 0, tapShots: 0, playTime: 0 },
  seen: { enemies: {}, bosses: {} },
  tutorial: {}
}
```
- `BB.econ.canAfford(cost)`, `BB.econ.spend(cost) → bool`, `BB.econ.add(reward, motivo)`; `cost`/`reward` = `{gold, gems}`.
- `BB.save.reset()` borra la partida.

### 4.3 Balance global — `BB.balance` (data/balance.js, del integrador)
Todas las curvas de dificultad/economía salen de aquí para poder ajustar en un solo sitio:
`enemyHp(L)`, `enemyDmg(L)`, `enemyGold(L)`, `bossHp(L)`, `levelGold(L)`, `heroDmg(heroLevel)`,
`heroLevelCost(heroLevel, rarity)`, `towerDmg(lvl)`, `towerLevelCost(lvl)`, `castleCost(id, lvl)`,
`replayGoldMul` (0.6). Los multiplicadores devuelven 1 a nivel 1.

### 4.4 Sprites — `BB.SPRITES` / `BB.assets` (manifest del agente de gráficos, loader del integrador)
```js
BB.SPRITES = {
  hero_arquera: { src: "sprites/heroes/arquera.png", w: 300, h: 384, facing: "left" },
  enemy_goblin_veloz: { src: "sprites/enemies/goblin_veloz.png", w: 320, h: 300, facing: "right" },
  bg_bosque: { src: "sprites/bg/bosque.jpg", w: 1600, h: 720 },
  ...
};
```
Claves: `hero_<id>`, `enemy_<id>`, `boss_<id>`, `castle_1..5`, `tower_<id>`, `bg_<zona>`, `map_<zona>`,
`icon_<nombre>`, `title_art`, `app_icon`. Los PNG están recortados al contenido (sin márgenes): el
renderizador ancla los pies en el borde inferior y centra en horizontal. `BB.assets.get(key)` devuelve
la imagen o `null` si no existe (entonces se dibuja un marcador de posición).

### 4.5 La batalla — `B` (core/battle.js)
`B` es la batalla en curso; se pasa a todos los *hooks*. Simulación pura (sin DOM), paso fijo de 1/60 s.

**Propiedades**: `B.t` (s), `B.level` (n), `B.levelDef`, `B.zone`, `B.enemies` (vivos), `B.heroes`
(unidades en huecos), `B.towers` (torres/trampas), `B.castle` `{hp,maxHp,wallHp,wallMax,wallArmor,shield}`,
`B.boss` (o null), `B.gold` (oro ganado en la batalla), `B.speed`, `B.paused`, `B.over`, `B.result`.

**Consulta**
- `B.enemiesInRange(x, range, opts)` → enemigos con `|e.x - x| ≤ range` y `e.x < x`, ordenados del más
  adelantado (mayor x) al menos. `opts`: `{ air:'both'|'ground'|'air', burrowed:false }`.
- `B.pickTarget(x, range, opts)` → enemigo o null. `opts.prefer`: `'front'|'strongest'|'weakest'|'air'|
  'healer'|'ranged'|'boss'|'random'`; `opts.air` como arriba.
- `B.enemiesInRadius(x, y, r, opts)` → enemigos cuyo cuerpo toca el círculo.
- `B.frontEnemy(opts)`, `B.densestPoint(range, radius, opts)` → `{x, y, count}` (para habilidades).
- `B.rng()` → aleatorio reproducible [0,1).

**Daño y efectos**
- `B.damage(e, amount, info)` → daño real. `info`: `{ type:'physical'|'fire'|'ice'|'lightning'|'arcane'|
  'poison'|'holy'|'true', source: unidad|'tap'|'trap'|'ability', crit?:bool, critChance?, critMul?,
  arc?:bool (proyectil en parábola), pierce?:bool, noNumber?:bool, color? }`.
  Fórmula: `amount × (1 - resist[type]) × (físico: 1 - armadura) × maldición × crítico`, luego `def.onDamage`.
- `B.damageArea(x, y, r, amount, info)` → enemigos golpeados (`info.air` igual que arriba).
- `B.applyStatus(e, kind, o)`: `kind` ∈ `slow` (`power` 0–1), `freeze`, `stun`, `root`, `burn` (`dps`;
  anula regeneración), `poison` (`dps`, acumulable hasta `o.maxStacks`; reduce curaciones 50 %),
  `curse` (`power`: +daño recibido), `armorBreak` (`power`: −armadura). Todos con `duration`.
  Respeta `def.immune[kind]`.
- `B.knockback(e, dist)` (empuja hacia la izquierda; no a jefes/inmunes).
- `B.healEnemy(e, amount)`, `B.spawnEnemy(type, {x, y, elite, minion})` → enemigo.
- `B.damageCastle(amount, {source, ignoreWall, type})`, `B.healCastle(amount)`, `B.shieldCastle(amount, dur)`.
- `B.buffHeroes({atkSpeed, dmg, duration})`, `B.disableHero(heroUnit, seconds)`.

**Proyectiles** — `B.spawnProjectile(spec)`:
```js
{ kind: 'arrow'|'bolt'|'fireball'|'ice'|'cannon'|'bomb'|'magic'|'dart'|'hammer'|'potion'|'rock'|
        'spit'|'feather'|'holy'|'bullet'|'spear'|'custom',
  from: {x, y}, to: enemigo | {x, y}, speed: 900, arc: 0 /*altura de la parábola*/, homing: false,
  team: 'player'|'enemy', color, size,
  onHit: { damage, type, radius, air, status: [{kind, ...}], knockback, pierce } | function (B, p, target) {},
  draw: function (ctx, p) {}   // solo para kind 'custom'
}
```
Los proyectiles enemigos (`team:'enemy'`) viajan hacia el castillo y llaman `onHit` al llegar.

**Tiempo y eventos**: `B.after(s, fn)`, `B.every(s, fn, veces)`, `B.on(evento, fn)`, `B.emit(evento, datos)`.
Eventos: `start`, `wave` {index}, `spawn` {enemy}, `kill` {enemy, source}, `bossSpawn` {boss},
`bossPhase` {boss, phase}, `castleHit` {amount}, `wallBroken`, `heroCast` {hero}, `victory`, `defeat`.

**Efectos visuales** `B.fx` (core/fx.js): `explosion(x,y,r,{color})`, `ring(x,y,r,{color,dur})`,
`particles(x,y,{n,color,speed,life,size,gravity})`, `text(x,y,str,{color,size})`, `number(x,y,v,kind)`,
`shake(mag,dur)`, `flash(color,dur)`, `beam(x1,y1,x2,y2,{color,width,dur})`, `lightning(puntos,{color})`,
`smoke(x,y,n)`, `coins(x,y,n)`, `zone(x,y,r,{color,dur})` (círculo persistente en el suelo).
**Sonido**: `B.sound(nombre)` → `BB.audio.sfx(nombre)`.

### 4.6 Definición de enemigo — `BB.data.enemies[id]`
```js
{
  id, name, desc, weakness /* "Débil contra: ..." */, unlockLevel,
  sprite: 'enemy_goblin_veloz', size: 62, anim: 'walk'|'hop'|'fly'|'heavy'|'roll'|'burrow',
  air: false, radius: 18,
  hp: 30, speed: 95, damage: 4, atkInterval: 1.0, range: 0 /* 0 = cuerpo a cuerpo */,
  armor: 0 /* 0..0.9 físico */, resist: { fire: 0, ice: 0, lightning: 0, arcane: 0, poison: 0, holy: 0, physical: 0 },
  immune: { slow: false, freeze: false, stun: false, root: false, knockback: false },
  gold: 2, xp: 1,
  projectile: { kind: 'arrow', speed: 500 },   // solo si range > 0
  // hooks opcionales (todos reciben B):
  onSpawn(B, e), onUpdate(B, e, dt) /* devolver true = salto la IA por defecto */,
  onDamage(B, e, amount, info) /* → amount modificado */, onAttack(B, e) /* true = sustituye el golpe */,
  onReach(B, e) /* llega a su objetivo */, onDeath(B, e)
}
```
**Instancia** (la crea el motor): `{ id, type, def, x, y, hp, maxHp, speed, damage, atkInterval, armor,
air, burrowed, boss, elite, minion, state:'walk'|'attack'|'custom'|'dying', target:'barricada'|'muralla'|'castillo',
status:{...}, data:{} /* libre para hooks */, age, face:1, scale:1 }`.
El motor escala `hp`, `damage` y `gold` con `BB.balance` según el nivel; élite = ×2.4 vida, ×1.5 daño.

### 4.7 Definición de jefe — `BB.data.bosses[id]`
Como un enemigo, más:
```js
{
  level: 10, title: 'El Rey Goblin', quote: 'frase de entrada', color: '#ffcf3d',
  stopX: 1090,  // opcional: x donde se planta para atacar a distancia
  phases: [ { at: 1.0, name: 'Fase 1' }, { at: 0.5, name: '¡Furia!', onEnter(B, boss) {} } ],
  attacks: [ { id: 'bombas', name: 'Bombas de oro', every: [6, 9], phases: [0, 1], cast(B, boss) {} } ],
}
```
El motor gestiona fases (al bajar de `at`), el programador de ataques y la barra grande.
`BB.bossIntro.play(bossId, onDone)` (js/ui/boss_intro.js) muestra la presentación antes del combate.

### 4.8 Definición de héroe — `BB.data.heroes[id]`
```js
{
  id, name, title, role, desc, rarity: 'comun'|'rara'|'epica'|'legendaria',
  unlock: { gold: 0 } | { gems: 60 } | { gold: 5000, level: 15 /* nivel de mapa mínimo */ },
  sprite: 'hero_arquera', size: 76,
  attack: { damage: 10, interval: 0.9, range: 950, type: 'physical', projectile: 'arrow', speed: 1000,
            arc: 0, radius: 0 /*área*/, pierce: 0, chain: 0, air: true, ground: true, prefer: 'front',
            crit: 0.05, critMul: 2, status: [], knockback: 0 },
  ability: { name, desc, cooldown: 14, cast(B, hero) },
  passive: { desc, onHit(B, hero, target, dmg) },   // opcional
}
```
**Unidad en batalla**: `{ id, def, stats, slot, x, y, cd, cdMax, atkTimer, disabled, buff }`.
`BB.heroStats(id, save)` (data/upgrades.js) → `{ attack: {...calculado}, abilityCooldown, abilityPower,
talents: {...} }`. El motor usa `stats.attack` para el ataque automático y llama `def.ability.cast(B, hero)`;
dentro, usa `hero.stats.abilityPower` para escalar.

### 4.9 Mejoras — `BB.data.upgrades` (data/upgrades.js)
- Nivel de héroe: 1–60, coste en oro (`BB.balance.heroLevelCost`). Cada 2 niveles da 1 punto de talento.
- Árbol de talentos por héroe: `BB.data.talents[heroId] = [{ id, name, desc, max, row, col, req: [ids],
  effect: { ... } }]` (≈ 3 ramas + nodo final).
- `BB.data.castleUpgrades = [{ id, name, desc, max, cost(lvl) → {gold|gems}, value(lvl) → número }]`,
  `BB.castleStats(save)` → `{ maxHp, wallHp, wallArmor, slots, tapDamage, tapCooldown, goldBonus, regen, tier, wallTier }`.
- Torres: `BB.data.towers[id] = { id, name, kind:'tower'|'trap'|'block', desc, sprite, size, unlock:{gold, level},
  attack?, trap?: { width, onEnemy(B, t, e, dt) }, block?: { hp }, onUpdate?(B, t, dt) }`,
  `BB.towerStats(id, save)`.

### 4.10 Niveles, zonas y recompensas
- `BB.data.zones = [{ id, name, levels: [1, 10], bg: 'bg_bosque', map: 'map_bosque', music: 'bosque',
  palette: { sky, groundTop, ground, groundDark, accent, fog }, boss: 'rey_goblin', desc }]`.
- `BB.levelDef(n)` → `{ n, zone, boss, spawns: [{ t, type, elite }], waves: [t0, t1, ...], newEnemies: [...],
  rewards: { gold, gems, firstGems }, recommended }`. Debe ser determinista (mismo nivel → misma partida).
- `BB.starsFor(castleHpFrac)` → 1..3.
- `BB.data.achievements = [{ id, name, desc, icon, target, progress(save) → número, reward: { gems, gold } }]`.
- `BB.daily = { status(save) → { canClaim, day, reward }, claim(save) → reward }` (ciclo de 7 días).

### 4.11 Interfaz y flujo
- `BB.ui.init()`, `BB.ui.register({ id, el, show(params), hide(), tick?(dt) })`, `BB.ui.show(id, params)`,
  `BB.ui.toast(texto)`, `BB.ui.modal({ title, body, buttons })`, `BB.ui.refreshTop()`.
- Pantallas: `title` (carga + tocar para empezar), `menu`, `map` (agente del mapa), `shop` (pestañas
  Castillo / Héroes / Torres), `hero` (ficha + árbol de talentos), `army` (colocar héroes y trampas en sus
  huecos), `result` (victoria/derrota), `settings`, `achievements`, `daily`, `enemyIntro` (nuevo enemigo).
- HUD de batalla (`hud.js`): monedas, progreso de oleadas, vida del castillo y de la muralla, **barra grande
  del jefe**, botones de habilidad con recarga, pausa (continuar / reiniciar / salir), velocidad ×1/×2.
- Flujo (lo implementa `js/app.js`): `BB.app.startLevel(n, { replay })` → intro de enemigos nuevos →
  intro del jefe → batalla → pantalla de resultado → mapa. `BB.app.goMap()`, `BB.app.goMenu()`.
- Coordenadas de pantalla: `BB.render.worldToScreen(x, y)` y `screenToWorld(px, py)`.

### 4.12 Sonido — `BB.audio` (js/audio.js)
`init()` (tras el primer toque), `music(pista)` (`menu`, `mapa`, una por zona: `bosque`, `pantano`…,
`jefe`, `victoria`, `derrota`), `sfx(nombre)`, `setMusic(bool)`, `setSfx(bool)`.
Efectos mínimos: `tap, arrow, bolt, fireball, explosion, ice, freeze, lightning, cannon, hit, hit_heavy,
crit, die_goblin, die_orc, die_big, roar, coin, gem, heal, shield, buff, wall_hit, castle_hit,
wall_break, click, open, close, upgrade, unlock, star, victory, defeat, wave, boss_intro, ready,
cast, poison, wind, hammer, musket, magic, whoosh, deny, bomb, burrow, drum, howl`.
Todo generado por código (Web Audio), sin archivos.

---

### 4.13 Comportamientos por defecto del motor (lo que NO hace falta programar en los hooks)
- **Enemigo terrestre**: camina hacia la derecha a `speed`. Se detiene ante el primer obstáculo vivo:
  barricada (si existe y el enemigo no tiene `leaps: true`), muralla (cara en `WALL_X`) o castillo
  (`CASTLE_X`). Golpea cada `atkInterval` con `damage` (a la barricada, a la muralla o al castillo).
  `onReach` se llama la primera vez que llega a su objetivo (útil para el bombardero).
- **Enemigo a distancia** (`range > 0`): se detiene cuando el objetivo está a `range` y dispara
  `projectile` (equipo enemigo) contra la muralla o el castillo.
- **Volador** (`air: true`): vuela a una altura entre `AIR_MIN` y `AIR_MAX` (o `flyY`), ignora trampas,
  barricada y muralla, y ataca al castillo en `CASTLE_X - 30`.
- `leaps: true`: salta barricadas y trampas (jinete de lobo).
- `e.burrowed = true`: no se le puede apuntar ni dañar salvo con `{burrowed:true}` en las consultas
  y por trampas; sigue moviéndose. Lo gestiona el hook del topo/jefe.
- **Muerte**: el motor reproduce la animación, suelta monedas, da `gold`, llama `onDeath` una sola vez.
- **Jefe**: se mueve como un enemigo (o hasta `stopX`), golpea con `damage`, y además el motor cambia
  de fase y lanza `attacks[].cast` cada `every` segundos si la fase actual está en `phases`.
- **Héroe**: cada `attack.interval` elige objetivo con `B.pickTarget(hero.x, range, {prefer, air})`
  y dispara. `attack.projectile` puede ser: `arrow, bolt, fireball, ice, cannon, bomb, magic` (teledirigido),
  `dart, hammer, potion, rock, feather, holy, bullet, spear, wind` (onda que recorre el suelo y golpea a
  todos), `lightning` (instantáneo, encadena `chain` objetivos) o `beam` (instantáneo, línea).
  Al impactar aplica `damage`, `radius` (área), `status`, `knockback` y `pierce`.
  `passive.onHit(B, hero, target, dmg)` se llama en cada impacto del ataque normal.
- **Torre** (`kind:'tower'`): ataca igual que un héroe desde su hueco del suelo (y = `GROUND - size*0.7`).
- **Trampa** (`kind:'trap'`): el motor llama `trap.onEnemy(B, t, e, dt)` cada paso para cada enemigo
  terrestre que la pisa (`|e.x - t.x| < width/2`), incluidos los enterrados; no afecta a voladores ni a `leaps`.
- **Bloqueo** (`kind:'block'`): barricada con `block.hp` (escalado por nivel de torre); los terrestres se
  paran a golpearla; si cae, desaparece hasta el siguiente nivel.
- Velocidad ×2 y pausa las gestiona el motor (`B.setSpeed(1|2)`, `B.pause()`, `B.resume()`).
- `B.castAbility(i)` lanza la habilidad del héroe en el hueco `i` si está lista; `B.tap(x, y)` dispara
  la ballesta del castillo a ese punto del mundo.

### 4.14 HUD y pantallas que llama la app
- `BB.hud.attach(B)` al empezar la batalla, `BB.hud.frame(dt)` en cada fotograma, `BB.hud.detach()` al
  terminar. El HUD lee el estado de `B` y llama `B.castAbility(i)`, `B.setSpeed(n)`, `BB.app.pause()`.
- Resultado: `BB.ui.show('result', { victory, level, stars, rewards: {gold, gems}, firstClear, replay,
  stats: {kills, timeSec, castleHpFrac}, unlocked: [ids], achievements: [ids] })`.
  Botones: Continuar (mapa), Repetir, Siguiente nivel (si ganó), Mejorar (tienda).
- Nuevo enemigo: `BB.ui.show('enemyIntro', { types: ['orco_escudo'], onDone })` — tarjeta con sprite,
  nombre, descripción y debilidad.
- Jefe: `BB.bossIntro.play(bossId, onDone)`.
- Pausa: `BB.ui.show('pause', { onResume, onRestart, onQuit })` (modal dentro de `screens.js`).
- El `<canvas id="battle">` está siempre detrás de `#ui`; fuera de la batalla la app lo oculta.

## 5. Estilo gráfico (agente de gráficos)
Mismo estilo para todo. Prefijos de prompt (en inglés, funcionan mejor):
- Sprites: `2D cartoon mobile game sprite, side view, full body, bold clean black outlines, vibrant saturated
  colors, soft cel shading, heroic fantasy, centered, isolated on plain white background, no text, no watermark`
- Fondos: `2D cartoon mobile game background, side-scrolling landscape panorama, vibrant colors, bold outlines,
  painterly cel shading, empty flat ground strip at the bottom, no characters, no text, no watermark`
- Mapa: `2D cartoon fantasy world map region seen from above, top-down illustrated game map, vibrant colors,
  bold outlines, no text, no labels, no watermark`
- Iconos: `2D cartoon mobile game icon, bold black outline, vibrant glossy colors, centered, isolated on plain
  white background, no text`
Héroes miran a la izquierda; enemigos y jefes, a la derecha.

## 6. Pruebas
- Chrome: `C:\Program Files\Google\Chrome\Application\chrome.exe` (headless). Flags útiles:
  `--headless=new --disable-gpu --allow-file-access-from-files --host-resolver-rules="MAP * ~NOTFOUND"`
  (sin la última, el tiempo virtual se cuelga esperando Google Fonts), `--virtual-time-budget=5000`,
  `--screenshot=ruta.png --window-size=1600,720` o `--dump-dom` (lee `document.title`).
  `requestAnimationFrame` no avanza con `--virtual-time-budget`: usa los métodos de paso manual.
- No hay Node. Python 3.11 sí (`python`). Para HTTPS desde Python usa `truststore`
  (`import truststore; truststore.inject_into_ssl()`), porque el PC intercepta certificados.
- `BB.test.simulate(n, opciones)` (core) ejecuta un nivel sin dibujar y devuelve el resultado.
- Cada agente usa su página en `tests/` para probar su parte dentro del motor real.
