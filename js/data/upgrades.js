/* Bastión Bravo · Mejoras: talentos de héroes, estadísticas, castillo, torres y API de compra.
   Contrato: docs/DISENO.md §2.5, §2.6, §4.2, §4.8, §4.9 y §4.13.
   Todo se resuelve en tiempo de ejecución: al cargar solo se registran definiciones. */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  BB.data = BB.data || {};

  const bal = () => BB.balance;
  const fmt = (v) => (BB.util && BB.util.fmt ? BB.util.fmt(v) : String(Math.round(v)));
  const pct = (v) => Math.round(v * 100) + ' %';
  const saveData = () => (BB.save && BB.save.data) || null;
  const commit = () => { if (BB.save && typeof BB.save.commit === 'function') BB.save.commit(); };
  function afford(cost) {
    if (BB.econ && typeof BB.econ.canAfford === 'function') return BB.econ.canAfford(cost);
    const d = saveData();
    return !!d && (cost.gold || 0) <= d.gold && (cost.gems || 0) <= d.gems;
  }
  function pay(cost) {
    if (BB.econ && typeof BB.econ.spend === 'function') return BB.econ.spend(cost);
    if (!afford(cost)) return false;
    const d = saveData(); d.gold -= cost.gold || 0; d.gems -= cost.gems || 0; return true;
  }
  function stat(key, n) { const d = saveData(); if (d && d.stats) d.stats[key] = (d.stats[key] || 0) + (n || 1); }

  // ================================================================ talentos
  // Filas: puntos invertidos en el árbol necesarios para cada fila.
  const ROW_POINTS = [0, 3, 8, 16];
  const N = (id, name, desc, max, effect) => ({ id, name, desc, max, effect: effect || {} });
  const dmgN = (id, name) => N(id, name, '+6 % de daño de ataque por rango.', 5, { dmg: 0.06 });
  const spdN = (id, name, max) => N(id, name, '+6 % de velocidad de ataque por rango.', max || 4, { atkSpeed: 0.06 });
  const rngN = (id, name, max) => N(id, name, '+4 % de alcance por rango.', max || 5, { range: 0.04 });
  const apN = (id, name) => N(id, name, '+10 % de potencia de la habilidad por rango.', 5, { ap: 0.1 });
  const cdN = (id, name) => N(id, name, '−6 % de recarga de la habilidad por rango.', 4, { cd: 0.06 });

  BB.data.talents = {};
  BB.data.talentBranches = {};
  function tree(heroId, names, branches, fin) {
    const out = [];
    branches.forEach((br, col) => br.forEach((n, row) => {
      out.push(Object.assign({ row, col, branch: names[col], req: row ? [br[row - 1].id] : [], minPoints: ROW_POINTS[row] }, n));
    }));
    out.push(Object.assign({ row: 3, col: 1, branch: 'Maestría', req: [], minPoints: ROW_POINTS[3], final: true }, fin));
    out[out.length - 1].desc += ' (Requiere ' + ROW_POINTS[3] + ' puntos en el árbol.)';
    BB.data.talents[heroId] = out;
    BB.data.talentBranches[heroId] = names.concat(['Maestría']);
  }

  tree('arquera', ['Puntería', 'Lluvia', 'Instinto'], [
    [dmgN('punteria', 'Puntería'), spdN('tension', 'Tensión'), N('perforante', 'Flechas perforantes', 'Las flechas atraviesan a 1 enemigo más por rango.', 3, { pierce: 1 })],
    [apN('aljaba', 'Aljaba repleta'), cdN('recarga_rapida', 'Recarga rápida'), N('flechas_fuego', 'Flechas incendiarias', 'La Lluvia de Flechas quema (3 de daño/s por rango, escalado).', 3)],
    [rngN('vista_lejana', 'Vista lejana'), N('doble_tension', 'Doble tensión', '+5 % de probabilidad de flecha extra por rango.', 4, { passive: { extraShot: 0.05 } }),
      N('critico', 'Ojo crítico', '+5 % de crítico y +0,25 de multiplicador crítico por rango.', 3, { crit: 0.05, critMul: 0.25 })],
  ], N('tormenta_flechas', 'Diluvio', 'La Lluvia de Flechas dispara 8 flechas más y cubre un 10 % más de área por rango.', 3, { abCount: 8, abRadius: 0.1 }));

  tree('mago_fuego', ['Llama', 'Meteoro', 'Pirómano'], [
    [dmgN('llama_viva', 'Llama viva'), N('ignicion', 'Ignición', 'Las quemaduras hacen +6 % del daño del ataque por segundo por rango.', 4, { status: { burn: { dpsMul: 0.06 } } }),
      N('explosion_mayor', 'Explosión mayor', '+12 % de radio de explosión por rango.', 3, { radius: 0.12 })],
    [apN('meteoro_pesado', 'Meteoro pesado'), cdN('concentracion', 'Concentración'), N('lluvia_meteoros', 'Lluvia de meteoros', 'El Meteoro trae 1 meteoro pequeño más por rango.', 3)],
    [rngN('alcance_igneo', 'Alcance ígneo'), N('combustion', 'Combustión', 'La explosión al rematar hace +20 % de daño por rango.', 4, { passive: { combust: 0.2 } }),
      N('tierra_quemada', 'Tierra quemada', 'El Meteoro deja el suelo ardiendo 2 s por rango.', 3)],
  ], N('cataclismo', 'Cataclismo', '+10 % de daño y radio por rango; el Meteoro aturde 0,4 s más por rango.', 3, { dmg: 0.1, radius: 0.1 }));

  tree('maga_hielo', ['Carámbanos', 'Ventisca', 'Escarcha'], [
    [dmgN('frio_cortante', 'Frío cortante'), spdN('rafaga_helada', 'Ráfaga helada'), N('carambanos', 'Carámbanos', '+15 % de radio de impacto por rango.', 3, { radius: 0.15 })],
    [apN('tempestad', 'Tempestad'), cdN('invierno', 'Invierno eterno'), N('tormenta_helada', 'Tormenta helada', 'La Ventisca dura 1 s más y es un 10 % más grande por rango.', 3)],
    [N('hielo_profundo', 'Hielo profundo', '+5 % de ralentización por rango.', 5, { status: { slow: { power: 0.05 } } }),
      N('congelacion', 'Congelación', 'La congelación de la pasiva dura 0,25 s más por rango.', 4, { passive: { freezeDur: 0.25 } }),
      N('quebradizo', 'Quebradizo', 'Los congelados por la Ventisca reciben +8 % de daño por rango.', 3)],
  ], N('cero_absoluto', 'Cero absoluto', 'La Ventisca alcanza a los voladores y congela 0,5 s más por rango.', 3));

  tree('halconera', ['Halcón', 'Bandada', 'Cetrería'], [
    [dmgN('plumas_acero', 'Plumas de acero'), spdN('vuelo_rapido', 'Vuelo rápido'), N('doble_presa', 'Doble presa', '+10 % de probabilidad de atacar a un segundo enemigo por rango.', 3, { passive: { extraShot: 0.1 } })],
    [apN('nido', 'Nido'), cdN('silbido', 'Silbido'), N('rapaces', 'Rapaces', 'La Bandada suelta 2 halcones más por rango.', 3, { abCount: 2 })],
    [rngN('ojo_halcon', 'Ojo de halcón'), N('cazador_cielos', 'Cazador de cielos', '+20 % de daño extra contra voladores por rango.', 4, { passive: { vsAir: 0.2 } }),
      N('desgarro', 'Desgarro', 'Las garras rompen un 8 % de armadura por rango (3 s).', 3, { status: { armorBreak: { power: 0.08, duration: 3 } } })],
  ], N('reina_cielos', 'Reina de los cielos', 'Cada halcón de la Bandada golpea dos veces; +5 % de daño por rango.', 3, { dmg: 0.05 }));

  tree('hechicera_rayo', ['Voltaje', 'Tormenta', 'Estática'], [
    [dmgN('alto_voltaje', 'Alto voltaje'), spdN('arco_voltaico', 'Arco voltaico'), N('conductividad', 'Conductividad', 'El rayo salta a 1 enemigo más por rango.', 3, { chain: 1 })],
    [apN('nubarron', 'Nubarrón'), cdN('carga_estatica', 'Carga estática'), N('tormenta_perpetua', 'Tormenta perpetua', 'La Tormenta lanza 4 rayos más por rango.', 3, { abCount: 4 })],
    [rngN('pararrayos', 'Pararrayos'), N('sobrecarga', 'Sobrecarga', '+5 % de probabilidad de aturdir por rango.', 4, { status: { stun: { chance: 0.05 } } }),
      N('ojo_tormenta', 'Ojo de la tormenta', 'Los rayos de la Tormenta aturden 0,3 s por rango.', 3)],
  ], N('diosa_trueno', 'Diosa del trueno', 'Cada rayo de la Tormenta cae sobre dos enemigos; +5 % de daño por rango.', 3, { dmg: 0.05 }));

  tree('ingeniero', ['Calibre', 'Andanada', 'Ingenio'], [
    [dmgN('polvora_negra', 'Pólvora negra'), spdN('recarga_mecanica', 'Recarga mecánica'), N('onda', 'Onda expansiva', '+12 % de radio de explosión por rango.', 3, { radius: 0.12 })],
    [apN('municion', 'Munición pesada'), cdN('engranajes', 'Engranajes'), N('bateria', 'Batería', 'La Andanada dispara 2 balas más por rango.', 3, { abCount: 2 })],
    [rngN('telemetro', 'Telémetro'), N('metralla', 'Metralla', '+8 % de probabilidad de metralla por rango.', 4, { passive: { shrapnel: 0.08 } }),
      N('balas_incendiarias', 'Balas incendiarias', 'Los cañonazos queman (12 % del daño por segundo por rango, 3 s).', 3, { status: { burn: { dpsMul: 0.12, duration: 3 } } })],
  ], N('gran_canon', 'Gran cañón', 'Cada 4.º impacto provoca una explosión gigante (60 % +40 % por rango del daño).', 3));

  tree('ballestero', ['Puntería', 'Virote', 'Acecho'], [
    [dmgN('virotes_pesados', 'Virotes pesados'), spdN('mecanismo', 'Mecanismo de recarga'), N('atravesar', 'Atravesar', 'Los virotes atraviesan a 1 enemigo más por rango.', 3, { pierce: 1 })],
    [apN('arco_reforzado', 'Arco reforzado'), cdN('tension_maxima', 'Tensión máxima'), N('virote_explosivo', 'Virote explosivo', 'El Virote Perforante estalla al final (40 % del daño por rango).', 3)],
    [N('mira', 'Mira', '+3 % de alcance por rango.', 5, { range: 0.03 }), N('disparo_mortal', 'Disparo mortal', '+4 % de crítico y +0,2 de multiplicador por rango.', 4, { crit: 0.04, critMul: 0.2 }),
      N('cazarrecompensas', 'Cazarrecompensas', '+15 % de daño contra curanderos y tiradores por rango.', 3, { passive: { bounty: 0.15 } })],
  ], N('tirador_elite', 'Tirador de élite', 'El Virote Perforante dispara también a los voladores y hace +10 % de daño; +10 % de daño de ataque por rango.', 3, { dmg: 0.1 }));

  tree('martillo', ['Fuerza', 'Sismo', 'Aturdir'], [
    [dmgN('brazos_hierro', 'Brazos de hierro'), spdN('impulso', 'Impulso'), N('onda_choque', 'Onda de choque', '+20 % de radio de impacto por rango.', 3, { radius: 0.2 })],
    [apN('terremoto', 'Terremoto'), cdN('furia_enana', 'Furia enana'), N('fallas', 'Fallas', 'El sismo deja grietas que ralentizan un 40 % durante 3 s (+1 s por rango).', 3)],
    [N('contundente', 'Contundente', '+4 % de probabilidad de aturdir por rango.', 5, { passive: { stunChance: 0.04 } }),
      N('conmocion', 'Conmoción', 'Los aturdimientos duran 0,1 s más por rango.', 4, { passive: { stunDur: 0.1 } }),
      N('rompehuesos', 'Rompehuesos', 'Los aturdidos reciben +8 % de daño por rango.', 3)],
  ], N('martillo_dioses', 'Martillo de los dioses', 'El Martillo Sísmico golpea dos veces (la segunda al 50 % +25 % por rango).', 3));

  tree('sacerdote', ['Fe', 'Bendición', 'Plegaria'], [
    [dmgN('luz_divina', 'Luz divina'), spdN('fervor', 'Fervor'), N('castigo', 'Castigo', 'Sus golpes hacen que el enemigo reciba +5 % de daño por rango (3 s).', 3, { status: { curse: { power: 0.05, duration: 3 } } })],
    [apN('gracia', 'Gracia'), cdN('devocion', 'Devoción'), N('muro_sagrado', 'Muro sagrado', 'La Bendición repara un 8 % de la muralla por rango.', 3)],
    [N('oracion', 'Oración', '+15 % de curación de la pasiva por rango.', 5, { passive: { heal: 0.15 } }),
      N('escudo_fe', 'Escudo de fe', '+12 % de escudo de la Bendición por rango.', 4, { passive: { shield: 0.12 } }),
      N('milagro', 'Milagro', 'Si el castillo baja del 40 %, se cura un 10 % (+5 % por rango). Cada 20 s.', 3)],
  ], N('santo', 'Santo', 'La Bendición da +15 % de daño a todos los héroes durante 6 s por rango.', 3));

  tree('druida', ['Espinas', 'Raíces', 'Naturaleza'], [
    [dmgN('espinas_afiladas', 'Espinas afiladas'), N('savia_toxica', 'Savia tóxica', '+8 % de daño de veneno por rango.', 4, { status: { poison: { dpsMul: 0.08 } } }),
      N('zarzal', 'Zarzal', '+1 dosis máxima de veneno por rango.', 3, { status: { poison: { maxStacks: 1 } } })],
    [apN('raices_profundas', 'Raíces profundas'), cdN('crecimiento', 'Crecimiento'), N('abrazo_bosque', 'Abrazo del bosque', '+12 % de radio y +0,5 s de raíces por rango.', 3)],
    [rngN('brote', 'Brote'), N('abrojos', 'Abrojos', '+5 % de ralentización por rango.', 4, { status: { slow: { power: 0.05 } } }),
      N('savia_vital', 'Savia vital', 'Cada enemigo atrapado por las Raíces cura un 0,5 % del castillo por rango.', 3)],
  ], N('ira_bosque', 'Ira del bosque', 'Las Raíces hacen +40 % de daño por rango y derriban a los voladores (aturden 1 s).', 3));

  tree('alquimista', ['Ácido', 'Lluvia', 'Laboratorio'], [
    [dmgN('acido_concentrado', 'Ácido concentrado'), N('corrosion', 'Corrosión', '+5 % de rotura de armadura por rango.', 4, { status: { armorBreak: { power: 0.05 } } }),
      N('salpicadura', 'Salpicadura', '+15 % de radio por rango.', 3, { radius: 0.15 })],
    [apN('alambique', 'Alambique'), cdN('destilacion', 'Destilación'), N('diluvio_acido', 'Diluvio ácido', 'La Lluvia Ácida suelta 4 frascos más por rango.', 3, { abCount: 4 })],
    [spdN('manos_rapidas', 'Manos rápidas', 5), N('mezcla_volatil', 'Mezcla volátil', '+5 % de probabilidad de efecto aleatorio por rango.', 4, { passive: { volatile: 0.05 } }),
      N('gas_nervioso', 'Gas nervioso', 'La Lluvia Ácida ralentiza un 15 % por rango.', 3)],
  ], N('piedra_filosofal', 'Piedra filosofal', '+10 % de daño y el ácido hace que el enemigo reciba +10 % de daño por rango.', 3, { dmg: 0.1, status: { curse: { power: 0.1, duration: 3 } } }));

  tree('bardo', ['Melodía', 'Himno', 'Aura'], [
    [dmgN('acordes', 'Acordes'), spdN('ritmo', 'Ritmo'), N('disonancia', 'Disonancia', 'Sus notas hacen que el enemigo reciba +4 % de daño por rango (3 s).', 3, { status: { curse: { power: 0.04, duration: 3 } } })],
    [apN('estribillo', 'Estribillo'), cdN('compas', 'Compás'), N('balada_eterna', 'Balada eterna', 'El Himno dura 1,5 s más por rango.', 3)],
    [N('melodia', 'Melodía', 'El aura da +3 % de velocidad de ataque más por rango.', 5, { aura: { atkSpeed: 0.03 } }),
      N('cancion_valor', 'Canción de valor', 'El aura da +3 % de daño por rango a todos los héroes.', 4, { aura: { dmg: 0.03 } }),
      N('coro', 'Coro', 'El Himno cura al castillo un 4 % por rango.', 3)],
  ], N('opera', 'Ópera', 'El Himno reduce un 10 % por rango la recarga restante de las demás habilidades.', 3));

  tree('granadero', ['Pólvora', 'Barril', 'Demolición'], [
    [dmgN('polvora_fina', 'Pólvora fina'), spdN('mecha_rapida', 'Mecha rápida'), N('expansiva', 'Expansiva', '+12 % de radio de explosión por rango.', 3, { radius: 0.12 })],
    [apN('barril_grande', 'Barril grande'), cdN('tonelero', 'Tonelero'), N('racimo', 'Racimo', 'El barril suelta 2 bombas pequeñas por rango al estallar.', 3)],
    [rngN('brazo_fuerte', 'Brazo fuerte'), N('fragmentos', 'Fragmentos', '+6 % de probabilidad de segunda explosión por rango.', 4, { passive: { frag: 0.06 } }),
      N('napalm', 'Napalm', 'Las bombas queman (10 % del daño por segundo por rango, 3 s).', 3, { status: { burn: { dpsMul: 0.1, duration: 3 } } })],
  ], N('gran_estallido', 'Gran estallido', '+15 % de radio por rango en todas las explosiones; el Barril aturde 0,5 s más por rango.', 3, { radius: 0.15 }));

  tree('envenenadora', ['Toxinas', 'Nube', 'Ponzoña'], [
    [dmgN('dardos', 'Dardos afilados'), spdN('cerbatana', 'Cerbatana'), N('acumulacion', 'Acumulación', '+1 dosis máxima de veneno por rango.', 3, { status: { poison: { maxStacks: 1 } } })],
    [apN('miasma', 'Miasma'), cdN('fermento', 'Fermento'), N('nube_espesa', 'Nube espesa', 'La Nube dura 1 s más, es un 10 % mayor y ralentiza un 10 % por rango.', 3)],
    [N('veneno_potente', 'Veneno potente', '+8 % de daño de veneno por rango.', 5, { status: { poison: { dpsMul: 0.08 } } }),
      N('toxina_letal', 'Toxina letal', '+1 % de daño por dosis del objetivo por rango.', 4, { passive: { perStack: 0.01 } }),
      N('contagio', 'Contagio', 'Si sus dardos rematan a un envenenado, el veneno salta a los cercanos.', 3)],
  ], N('reina_venenos', 'Reina de los venenos', 'La Nube persigue a los enemigos; +10 % de veneno de ataque y +20 % de la Nube por rango.', 3, { status: { poison: { dpsMul: 0.1 } } }));

  tree('cazadora', ['Caza', 'Arpón', 'Trofeos'], [
    [dmgN('filo', 'Filo'), spdN('agilidad', 'Agilidad'), N('lanzas_gemelas', 'Lanzas gemelas', '+10 % de probabilidad de una lanza extra por rango.', 3, { passive: { extraShot: 0.1 } })],
    [apN('arpon_dentado', 'Arpón dentado'), cdN('carrete', 'Carrete'), N('marca_presa', 'Marca de la presa', 'La marca del Arpón da +10 % de daño recibido y dura 2 s más por rango.', 3)],
    [rngN('rastreo', 'Rastreo'), N('matagigantes', 'Matagigantes', '+12 % de daño contra grandes por rango.', 4, { passive: { vsBig: 0.12 } }),
      N('desgarro_caza', 'Desgarro', 'Las lanzas rompen un 6 % de armadura por rango (4 s).', 3, { status: { armorBreak: { power: 0.06, duration: 4 } } })],
  ], N('leyenda_caza', 'Leyenda de la caza', 'El Arpón alcanza a 1 enemigo fuerte más por rango y hace +20 % a jefes por rango.', 3));

  tree('monje_viento', ['Ráfaga', 'Tornado', 'Equilibrio'], [
    [dmgN('palma', 'Palma del viento'), spdN('respiracion', 'Respiración'), N('vendaval', 'Vendaval', '+10 de empuje por rango.', 3, { knockback: 10 })],
    [apN('torbellino', 'Torbellino'), cdN('meditacion', 'Meditación'), N('huracan', 'Huracán', 'El Tornado es un 20 % más grande y dura 0,5 s más por rango.', 3)],
    [N('horizonte', 'Horizonte', '+5 % de alcance por rango.', 5, { range: 0.05 }), N('viento_frio', 'Viento frío', '+5 % de ralentización por rango.', 4, { status: { slow: { power: 0.05 } } }),
      N('ojo_huracan', 'Ojo del huracán', 'El Tornado arrastra también a los voladores (+25 % de daño contra ellos por rango).', 3)],
  ], N('avatar_viento', 'Avatar del viento', 'Lanza un segundo tornado (50 % +25 % por rango de fuerza).', 3));

  tree('brujo', ['Sombras', 'Maldición', 'Oscuridad'], [
    [dmgN('sombras', 'Sombras'), N('sifon', 'Sifón', '+4 % de drenaje de vida por rango.', 4, { passive: { drain: 0.04 } }),
      N('almas', 'Almas errantes', '+10 % de probabilidad de un orbe extra por rango.', 3, { passive: { extraShot: 0.1 } })],
    [apN('maleficio', 'Maleficio'), cdN('pacto', 'Pacto'), N('condena', 'Condena', 'La Maldición da +5 % de daño recibido y dura 1,5 s más por rango.', 3)],
    [rngN('ojo_oscuro', 'Ojo oscuro'), N('debilitar', 'Debilitar', 'Sus orbes hacen que el enemigo reciba +3 % de daño por rango (3 s).', 4, { status: { curse: { power: 0.03, duration: 3 } } }),
      N('cosecha', 'Cosecha', 'La Maldición cura al castillo el 25 % del daño que hace, por rango.', 3)],
  ], N('senor_sombras', 'Señor de las sombras', 'La Maldición cae sobre dos zonas y ralentiza un 15 % por rango.', 3));

  tree('mosquetera', ['Pólvora', 'Certero', 'Precisión'], [
    [dmgN('calibre', 'Calibre'), spdN('recarga_veloz', 'Recarga veloz'), N('bala_perforante', 'Bala perforante', 'Las balas atraviesan a 1 enemigo más por rango.', 3, { pierce: 1 })],
    [apN('mira_telescopica', 'Mira telescópica'), cdN('pulso', 'Pulso firme'), N('rebote', 'Rebote', 'El Disparo Certero rebota a 1 enemigo más por rango (60 %).', 3)],
    [N('puntos_debiles', 'Puntos débiles', '+3 % de crítico por rango.', 5, { crit: 0.03 }), N('letal', 'Letal', '+0,2 de multiplicador crítico por rango.', 4, { critMul: 0.2 }),
      N('remate', 'Remate', '+15 % de daño de remate por rango.', 3, { passive: { execute: 0.15 } })],
  ], N('leyenda', 'Leyenda del mosquete', '−5 % de recarga por rango; el Disparo Certero marca al objetivo (+15 % de daño recibido por rango).', 3, { cd: 0.05 }));

  tree('arcano', ['Arcanos', 'Torrente', 'Resonancia'], [
    [dmgN('poder_arcano', 'Poder arcano'), spdN('flujo', 'Flujo'), N('misil_doble', 'Misil doble', '+12 % de probabilidad de un misil extra por rango.', 3, { passive: { extraShot: 0.12 } })],
    [apN('torrente', 'Torrente'), cdN('canalizar', 'Canalizar'), N('sobrecarga_arcana', 'Sobrecarga', 'El Torrente lanza 5 misiles más por rango.', 3, { abCount: 5 })],
    [rngN('concentracion_arcana', 'Concentración'), N('resonancia', 'Resonancia', '+25 % de daño de la esfera por rango.', 4, { passive: { sphere: 0.25 } }),
      N('eco', 'Eco', 'La esfera sale 1 misil antes por rango.', 3, { passive: { sphereEvery: 1 } })],
  ], N('singularidad', 'Singularidad', 'Al acabar el Torrente se abre una singularidad que atrapa y daña 3 s (+1 s por rango).', 3));

  tree('sacerdotisa_sol', ['Luz', 'Sol', 'Fe solar'], [
    [dmgN('resplandor', 'Resplandor'), spdN('fervor_solar', 'Fervor solar'), N('prisma', 'Prisma', 'Los rayos atraviesan a 1 enemigo más por rango.', 3, { pierce: 1 })],
    [apN('sol_naciente', 'Sol naciente'), cdN('cenit', 'Cénit'), N('amanecer', 'Amanecer', 'El Rayo Solar barre el campo y dura 0,4 s más por rango.', 3)],
    [rngN('halo', 'Halo'), N('purificar', 'Purificar', '+15 % de daño contra no-muertos por rango.', 4, { passive: { undead: 0.15 } }),
      N('calor', 'Calor', 'Sus rayos queman (10 % del daño por segundo por rango, 3 s).', 3, { status: { burn: { dpsMul: 0.1, duration: 3 } } })],
  ], N('eclipse', 'Eclipse', 'El Rayo Solar ralentiza y cura al castillo un 1 % por enemigo abrasado por rango (máx. 15 %).', 3));

  // ================================================================ estadísticas de héroe
  const RES_KEYS = ['dmg', 'atkSpeed', 'range', 'crit', 'critMul', 'radius', 'chain', 'pierce', 'knockback', 'cd', 'ap', 'abRadius', 'abDur', 'abCount'];
  function nodeMap(id) { const m = {}; for (const n of (BB.data.talents[id] || [])) m[n.id] = n; return m; }
  function cleanTalents(id, talents) {
    const out = {}, map = nodeMap(id);
    for (const k in (talents || {})) { const n = map[k]; const r = Math.min(n ? n.max : 0, Math.max(0, talents[k] | 0)); if (n && r > 0) out[k] = r; }
    return out;
  }
  function aggregate(id, talents) {
    const agg = { status: {}, passive: {}, aura: {} };
    RES_KEYS.forEach(k => { agg[k] = 0; });
    for (const n of (BB.data.talents[id] || [])) {
      const r = talents[n.id] | 0;
      if (!r) continue;
      const ef = n.effect || {};
      for (const k in ef) {
        const v = ef[k];
        if (k === 'status') {
          for (const kind in v) {
            const s = agg.status[kind] || (agg.status[kind] = {});
            for (const f in v[kind]) { if (f === 'duration') s.duration = v[kind][f]; else s[f] = (s[f] || 0) + v[kind][f] * r; }
          }
        } else if (k === 'passive' || k === 'aura') { for (const f in v) agg[k][f] = (agg[k][f] || 0) + v[f] * r; }
        else if (k === 'prefer') agg.prefer = v;
        else if (typeof v === 'number') agg[k] = (agg[k] || 0) + v * r;
      }
    }
    return agg;
  }
  function slotsOf(save) { return 3 + Math.max(0, Math.min(7, ((save && save.castle && save.castle.huecos) | 0))); }
  function deployed(save) {
    const n = slotsOf(save), out = [], seen = {};
    const lineup = (save && save.lineup) || [];
    for (let i = 0; i < Math.min(n, lineup.length); i++) {
      const id = lineup[i];
      if (id && !seen[id] && save.heroes && save.heroes[id] && save.heroes[id].owned && BB.data.heroes && BB.data.heroes[id]) { seen[id] = 1; out.push(id); }
    }
    return out;
  }
  function bardAura(save) {
    if (!save || deployed(save).indexOf('bardo') < 0) return null;
    const def = BB.data.heroes.bardo;
    const agg = aggregate('bardo', cleanTalents('bardo', save.heroes.bardo.talents));
    return { atkSpeed: ((def.aura && def.aura.atkSpeed) || 0) + (agg.aura.atkSpeed || 0), dmg: ((def.aura && def.aura.dmg) || 0) + (agg.aura.dmg || 0) };
  }
  function heroLevel(save, id) {
    const h = save && save.heroes && save.heroes[id];
    return Math.max(1, Math.min(bal() ? bal().HERO_MAX_LEVEL : 100, (h && h.level) | 0 || 1));
  }

  // BB.heroStats(id, save, override?) → override: { level, talents } para previsualizar
  BB.heroStats = function (id, save, override) {
    const def = BB.data.heroes && BB.data.heroes[id];
    if (!def) return null;
    save = save || saveData() || {};
    override = override || {};
    const hs = (save.heroes && save.heroes[id]) || {};
    const level = override.level ? Math.max(1, override.level | 0) : heroLevel(save, id);
    const talents = cleanTalents(id, override.talents || hs.talents);
    const agg = aggregate(id, talents);
    const aura = override.noAura ? null : bardAura(save);
    const a = def.attack;
    const lvlMul = bal() ? bal().heroDmg(level) : 1;
    const damage = a.damage * lvlMul * (1 + agg.dmg + (aura ? aura.dmg : 0));
    const interval = a.interval / (1 + agg.atkSpeed + (aura ? aura.atkSpeed : 0));
    const attack = {
      damage, interval, range: Math.round(a.range * (1 + agg.range)), type: a.type, projectile: a.projectile, speed: a.speed,
      arc: a.arc || 0, radius: a.radius ? Math.round(a.radius * (1 + agg.radius)) : 0,
      pierce: Math.round((a.pierce || 0) + agg.pierce), chain: Math.round((a.chain || 0) + agg.chain),
      air: !!a.air, ground: a.ground !== false, prefer: agg.prefer || a.prefer || 'front',
      crit: Math.min(0.9, (a.crit || 0) + agg.crit), critMul: (a.critMul || 2) + agg.critMul,
      knockback: (a.knockback || 0) + agg.knockback, color: a.color, size: a.size, status: [],
    };
    // Estados: base del héroe + talentos. Los de probabilidad < 1 pasan a "procs" (los aplica la pasiva).
    const sts = {};
    for (const s of (a.status || [])) sts[s.kind] = Object.assign({}, s);
    for (const kind in agg.status) {
      const m = agg.status[kind];
      const s = sts[kind] || (sts[kind] = { kind, duration: m.duration || 3 });
      for (const f in m) if (f !== 'duration') s[f] = (s[f] || 0) + m[f];
    }
    const procs = [];
    for (const kind in sts) {
      const s = sts[kind], o = { kind, duration: s.duration || 2 };
      if (s.power) o.power = Math.min(0.85, s.power);
      if (s.dpsMul) o.dps = damage * s.dpsMul;
      else if (s.dps) o.dps = s.dps;
      if (s.maxStacks) o.maxStacks = Math.round(s.maxStacks);
      if (s.chance && s.chance < 1) { o.chance = s.chance; procs.push(o); } else attack.status.push(o);
    }
    const cdBase = def.ability.cooldown || 15;
    const st = {
      id, level, rarity: def.rarity, attack, procs,
      abilityCooldown: Math.round(cdBase * Math.max(0.4, 1 - agg.cd) * 100) / 100,
      abilityPower: lvlMul * (1 + agg.ap),
      abilityMods: { radius: 1 + agg.abRadius, duration: 1 + agg.abDur, count: agg.abCount },
      passiveMods: agg.passive, talents, aura: aura || null,
    };
    st.dps = estimateDps(st);
    st.power = Math.round(st.dps * 10 + (def.ability.value || 250) * st.abilityPower / st.abilityCooldown * 5);
    return st;
  };
  function estimateDps(st) {
    const a = st.attack;
    let targets = 1 + (a.radius > 0 ? a.radius / 55 : 0) + a.chain * 0.7 + a.pierce * 0.45 + (a.projectile === 'wind' ? 2 : 0);
    let dps = a.damage * (1 + a.crit * (a.critMul - 1)) / a.interval * targets;
    for (const s of a.status) {
      if (s.kind === 'burn') dps += s.dps * 0.7 * targets;
      if (s.kind === 'poison') dps += s.dps * Math.min(s.maxStacks || 1, 3) * 0.6;
    }
    return Math.round(dps * 10) / 10;
  }
  BB.heroAbilityDetail = function (id, stats) {
    const def = BB.data.heroes[id];
    stats = stats || BB.heroStats(id);
    try { return def.ability.detail ? def.ability.detail(stats) : []; } catch (err) { return []; }
  };

  // ================================================================ API de héroes
  function heroEntry(id) {
    const d = saveData();
    if (!d || !BB.data.heroes || !BB.data.heroes[id]) return null;
    d.heroes = d.heroes || {};
    return d.heroes[id] || (d.heroes[id] = { owned: false, level: 1, talents: {}, points: 0 });
  }
  function spent(h) { let s = 0; for (const k in (h.talents || {})) s += h.talents[k] | 0; return s; }
  function earned(h) { return Math.floor(Math.max(1, h.level | 0) / (bal() ? bal().LEVELS_PER_TALENT_POINT : 2)); }
  function syncPoints(h) { h.points = Math.max(0, earned(h) - spent(h)); return h.points; }
  const RESET_COST = { gems: 20 };

  BB.heroes = {
    list() { return (BB.data.heroOrder || Object.keys(BB.data.heroes || {})).slice(); },
    isOwned(id) { const h = heroEntry(id); return !!(h && h.owned); },
    unlockCost(id) { const def = BB.data.heroes[id]; return def ? { gold: def.unlock.gold || 0, gems: def.unlock.gems || 0 } : null; },
    unlockStatus(id) {
      const def = BB.data.heroes[id], h = heroEntry(id), d = saveData();
      if (!def || !h) return { ok: false, reason: 'Héroe desconocido' };
      if (h.owned) return { ok: false, owned: true, reason: 'Ya es tuyo' };
      const need = def.unlock.level || 0;
      if (need && (d.maxLevel || 1) < need) return { ok: false, levelLocked: true, reason: 'Llega al nivel ' + need };
      if (!afford(this.unlockCost(id))) return { ok: false, poor: true, reason: 'Te faltan recursos' };
      return { ok: true, reason: '' };
    },
    canUnlock(id) { return this.unlockStatus(id).ok; },
    unlock(id) {
      if (!this.canUnlock(id)) return false;
      if (!pay(this.unlockCost(id))) return false;
      const h = heroEntry(id), d = saveData();
      h.owned = true; h.level = Math.max(1, h.level | 0); h.talents = h.talents || {}; syncPoints(h);
      // Si hay un hueco libre disponible, lo coloca
      const n = slotsOf(d);
      if (d.lineup.indexOf(id) < 0) { const i = d.lineup.slice(0, n).indexOf(null); if (i >= 0) d.lineup[i] = id; }
      commit();
      return true;
    },
    levelCost(id) {
      const h = heroEntry(id), def = BB.data.heroes[id];
      if (!h || !def || h.level >= bal().HERO_MAX_LEVEL) return null;
      return { gold: bal().heroLevelCost(h.level, def.rarity) };
    },
    canLevelUp(id) { const h = heroEntry(id), c = this.levelCost(id); return !!(h && h.owned && c && afford(c)); },
    levelUp(id) {
      if (!this.canLevelUp(id)) return false;
      if (!pay(this.levelCost(id))) return false;
      const h = heroEntry(id);
      h.level++; syncPoints(h); stat('heroLevelUps');
      commit();
      return true;
    },
    pointsLeft(id) { const h = heroEntry(id); return h ? Math.max(0, earned(h) - spent(h)) : 0; },
    pointsSpent(id) { const h = heroEntry(id); return h ? spent(h) : 0; },
    talentInfo(id, nodeId) {
      const h = heroEntry(id), node = nodeMap(id)[nodeId];
      if (!h || !node) return { ok: false, rank: 0, max: 0, reason: 'Talento desconocido' };
      const rank = (h.talents && h.talents[nodeId]) | 0;
      const r = { ok: false, rank, max: node.max, node, reason: '' };
      if (!h.owned) r.reason = 'Desbloquea antes al héroe';
      else if (rank >= node.max) r.reason = 'Rango máximo';
      else if (spent(h) < (node.minPoints || 0)) r.reason = 'Requiere ' + node.minPoints + ' puntos en el árbol';
      else if ((node.req || []).some(q => !((h.talents || {})[q] > 0))) r.reason = 'Requiere «' + node.req.map(q => nodeMap(id)[q].name).join('», «') + '»';
      else if (this.pointsLeft(id) < 1) r.reason = 'Sin puntos de talento (1 cada ' + bal().LEVELS_PER_TALENT_POINT + ' niveles)';
      else r.ok = true;
      return r;
    },
    canTalent(id, nodeId) { return this.talentInfo(id, nodeId).ok; },
    talentUp(id, nodeId) {
      if (!this.canTalent(id, nodeId)) return false;
      const h = heroEntry(id);
      h.talents = h.talents || {};
      h.talents[nodeId] = (h.talents[nodeId] | 0) + 1;
      syncPoints(h);
      commit();
      return true;
    },
    resetCost() { return Object.assign({}, RESET_COST); },
    canReset(id) { const h = heroEntry(id); return !!(h && h.owned && spent(h) > 0 && afford(RESET_COST)); },
    resetTalents(id) {
      if (!this.canReset(id) || !pay(RESET_COST)) return false;
      const h = heroEntry(id);
      h.talents = {}; syncPoints(h);
      commit();
      return true;
    },
    // Coloca un héroe en un hueco del castillo (null = vaciar). Si ya estaba en otro hueco, se mueve.
    place(slot, id) {
      const d = saveData();
      if (!d || slot < 0 || slot >= 10) return false;
      if (id && (!this.isOwned(id) || slot >= slotsOf(d))) return false;
      if (id) { const j = d.lineup.indexOf(id); if (j >= 0) d.lineup[j] = d.lineup[slot] || null; }   // intercambio
      d.lineup[slot] = id || null;
      commit();
      return true;
    },
    deployed(save) { return deployed(save || saveData()); },
  };

  // ================================================================ castillo
  const HUECOS_COST = [{ gold: 300, gems: 5 }, { gold: 1500, gems: 15 }, { gold: 5000, gems: 30 }, { gold: 12000, gems: 50 },
    { gold: 25000, gems: 80 }, { gold: 45000, gems: 120 }, { gold: 80000, gems: 180 }];
  const gc = (id) => (lvl) => ({ gold: bal().castleCost(id, lvl) });
  const tapDamage = (l) => Math.round(12 * (1 + 0.12 * l + 0.0025 * l * l));
  const tapCooldown = (l) => Math.max(0.12, Math.round((0.25 - 0.0022 * l) * 1000) / 1000);
  const wallArmor = (l) => Math.min(0.55, Math.round((0.1 + 0.0075 * l) * 1000) / 1000);
  BB.data.castleUpgrades = [
    { id: 'torreon', name: 'Torreón', icon: 'torreon', desc: 'Aumenta la vida máxima del castillo.', max: 60, cost: gc('torreon'),
      value: (l) => Math.round(600 * (1 + 0.12 * l + 0.0035 * l * l)), text: (v) => fmt(v) + ' de vida' },
    { id: 'muralla', name: 'Muralla', icon: 'muralla', desc: 'Más vida y armadura para la muralla que frena a los enemigos de tierra.', max: 60, cost: gc('muralla'),
      value: (l) => Math.round(400 * (1 + 0.13 * l + 0.004 * l * l)), armor: wallArmor,
      text: (v, l) => fmt(v) + ' de vida · ' + pct(wallArmor(l)) + ' de armadura' },
    { id: 'huecos', name: 'Huecos de héroe', icon: 'huecos', desc: 'Abre un hueco más en el castillo para colocar a otro héroe (de 3 a 10).', max: 7,
      cost: (l) => Object.assign({}, HUECOS_COST[Math.min(6, l)]), value: (l) => 3 + l, text: (v) => v + ' huecos' },
    { id: 'ballesta', name: 'Ballesta del castillo', icon: 'ballesta', desc: 'Más daño y más cadencia para el disparo al tocar el campo de batalla.', max: 60, cost: gc('ballesta'),
      value: tapDamage, cooldown: tapCooldown, text: (v, l) => fmt(v) + ' de daño · cada ' + String(tapCooldown(l)).replace('.', ',') + ' s' },
    { id: 'tesoro', name: 'Tesoro', icon: 'tesoro', desc: 'Ganas más oro de los enemigos en cada batalla.', max: 25, cost: gc('tesoro'),
      value: (l) => Math.round(l * 0.03 * 100) / 100, text: (v) => '+' + pct(v) + ' de oro' },
    { id: 'reparacion', name: 'Taller de reparación', icon: 'reparacion', desc: 'El castillo se regenera solo durante el combate.', max: 30, cost: gc('reparacion'),
      value: (l) => Math.round(l * 0.0004 * 10000) / 10000, text: (v) => String(Math.round(v * 1000) / 10).replace('.', ',') + ' % de vida/s' },
  ];
  const CU = () => { const m = {}; for (const u of BB.data.castleUpgrades) m[u.id] = u; return m; };
  function castleLv(save, id) { const u = CU()[id]; return Math.max(0, Math.min(u ? u.max : 0, ((save && save.castle && save.castle[id]) | 0))); }

  BB.castleStats = function (save) {
    save = save || saveData() || {};
    const u = CU(), L = (id) => castleLv(save, id);
    const maxHp = u.torreon.value(L('torreon'));
    let total = 0;
    for (const k in u) total += L(k);
    const tier = total >= 130 ? 5 : total >= 70 ? 4 : total >= 30 ? 3 : total >= 8 ? 2 : 1;
    const w = L('muralla');
    return {
      maxHp, wallHp: u.muralla.value(w), wallArmor: wallArmor(w), slots: u.huecos.value(L('huecos')),
      tapDamage: tapDamage(L('ballesta')), tapCooldown: tapCooldown(L('ballesta')), goldBonus: u.tesoro.value(L('tesoro')),
      regen: Math.round(maxHp * u.reparacion.value(L('reparacion')) * 10) / 10,
      tier, wallTier: w >= 40 ? 3 : w >= 15 ? 2 : 1, totalUpgrades: total,
    };
  };
  BB.castle = {
    level(id) { return castleLv(saveData(), id); },
    cost(id) { const u = CU()[id], l = this.level(id); return !u || l >= u.max ? null : u.cost(l); },
    canUpgrade(id) { const c = this.cost(id); return !!c && afford(c); },
    upgrade(id) {
      const c = this.cost(id);
      if (!c || !afford(c) || !pay(c)) return false;
      const d = saveData();
      d.castle[id] = this.level(id) + 1;
      stat('castleUpgrades');
      commit();
      return true;
    },
  };

  // ================================================================ torres y trampas
  function tStats(B, t) { return t.stats || (t.stats = BB.towerStats(t.id, B.save || saveData())); }
  BB.data.towers = {
    flechas: { id: 'flechas', name: 'Torre de Flechas', kind: 'tower', size: 130, sprite: 'tower_flechas', unlock: { gold: 500, level: 5 },
      desc: 'Disparo rápido contra enemigos de tierra y voladores.',
      attack: { damage: 7, interval: 0.6, range: 880, type: 'physical', projectile: 'arrow', speed: 1100, air: true, ground: true, prefer: 'front' } },
    pinchos: { id: 'pinchos', name: 'Trampa de Pinchos', kind: 'trap', size: 60, sprite: 'tower_pinchos', unlock: { gold: 700, level: 8 },
      desc: 'Daña a los enemigos de tierra que la pisan, incluso a los topos que pasan bajo tierra (+50 %).',
      trap: { width: 100, dps: 16,
        onEnemy(B, t, e) {
          const d = e.data || (e.data = {}), key = 'spk' + t.slot;
          if ((d[key] || 0) > B.t) return;
          d[key] = B.t + 0.5;
          const st = tStats(B, t).trap || this;
          B.damage(e, st.dps * 0.5 * (e.burrowed ? 1.5 : 1), { type: 'physical', source: 'trap', burrowed: true });
          if (B.fx && B.fx.particles) B.fx.particles(e.x, BB.WORLD.GROUND - 6, { n: 3, color: ['#d6dde7', '#ff4a3d'], speed: 90, up: 80, life: 0.3, size: 3 });
        } } },
    barricada: { id: 'barricada', name: 'Barricada', kind: 'block', size: 90, sprite: 'tower_barricada', unlock: { gold: 1200, level: 11 },
      desc: 'Frena a los enemigos de tierra mientras aguanta. Los jinetes de lobo la saltan.', block: { hp: 450 } },
    catapulta: { id: 'catapulta', name: 'Catapulta', kind: 'tower', size: 120, sprite: 'tower_catapulta', unlock: { gold: 2500, level: 16 },
      desc: 'Lanza piedras en parábola muy lejos: daño en área, solo a enemigos de tierra (no puede disparar muy cerca).',
      attack: { damage: 30, interval: 3.2, range: 1150, minRange: 140, type: 'physical', projectile: 'rock', speed: 600, arc: 260, radius: 90, air: false, ground: true, prefer: 'front', size: 12 } },
    rayos: { id: 'rayos', name: 'Torre de Rayos', kind: 'tower', size: 130, sprite: 'tower_rayos', unlock: { gold: 5000, level: 24 },
      desc: 'Rayo en cadena que salta entre enemigos de tierra y aire.',
      attack: { damage: 13, interval: 1.7, range: 720, type: 'lightning', projectile: 'lightning', chain: 3, air: true, ground: true, prefer: 'front' } },
    brea: { id: 'brea', name: 'Pozo de Brea', kind: 'trap', size: 60, sprite: 'tower_brea', unlock: { gold: 8000, level: 30 },
      desc: 'Ralentiza mucho a quien lo pisa. Si le llega fuego (un enemigo en llamas o un ataque de fuego), arde y quema a todos.',
      trap: { width: 130, slow: 0.45, burnDps: 12,
        onEnemy(B, t, e) {
          const st = tStats(B, t).trap || this;
          B.applyStatus(e, 'slow', { power: st.slow, duration: 0.4 });
          const d = t.data || (t.data = {});
          if (e.status && e.status.burn && !(d.fireUntil > B.t)) BB.data.towers.brea.ignite(B, t);
          if (d.fireUntil > B.t) B.applyStatus(e, 'burn', { dps: st.burnDps, duration: 1.5 });
        } },
      ignite(B, t) {
        const d = t.data || (t.data = {});
        if (d.fireUntil > B.t + 1) return;
        d.fireUntil = B.t + 6;
        if (B.fx && B.fx.zone) B.fx.zone(t.x, BB.WORLD.GROUND, 75, { color: 'rgba(255,110,30,0.55)', dur: 6 });
        if (typeof B.sound === 'function') B.sound('fireball');
      },
      onUpdate(B, t) {
        const d = t.data || (t.data = {});
        if (!(d.fireUntil > B.t) || B.headless || !B.fx || !B.fx.particles) return;
        if ((d.flameT || 0) > B.t) return;
        d.flameT = B.t + 0.1;
        B.fx.particles(t.x + (Math.random() - 0.5) * 110, BB.WORLD.GROUND, { n: 2, kind: 'fire', color: ['#ffe46b', '#ffa02e', '#ff5a1c'], speed: 30, up: 120, gravity: -80, life: 0.6, size: 10, add: true });
      } },
  };
  BB.data.towerOrder = ['flechas', 'pinchos', 'barricada', 'catapulta', 'rayos', 'brea'];
  function towerLv(save, id) { const t = save && save.towers && save.towers[id]; return Math.max(1, Math.min(bal() ? bal().TOWER_MAX_LEVEL : 40, (t && t.level) | 0 || 1)); }

  BB.towerStats = function (id, save) {
    const def = BB.data.towers[id];
    if (!def) return null;
    save = save || saveData() || {};
    const level = towerLv(save, id), mul = bal() ? bal().towerDmg(level) : 1, x = level - 1;
    const out = { id, level, dmgMul: mul, attack: null, trap: null, hp: 0 };
    if (def.attack) out.attack = Object.assign({}, def.attack, { damage: def.attack.damage * mul, interval: def.attack.interval / (1 + 0.006 * x) });
    if (def.trap) out.trap = { width: def.trap.width, dps: (def.trap.dps || 0) * mul, slow: def.trap.slow ? Math.min(0.65, def.trap.slow + 0.005 * x) : 0, burnDps: (def.trap.burnDps || 0) * mul };
    if (def.block) out.hp = Math.round(def.block.hp * (1 + 0.2 * x + 0.006 * x * x));
    const a = out.attack;
    out.dps = a ? a.damage / a.interval * (1 + (a.radius ? a.radius / 55 : 0) + (a.chain || 0) * 0.7) : out.trap ? out.trap.dps + out.trap.burnDps * 0.5 : out.hp / 60;
    out.power = Math.round(out.dps * 8);
    return out;
  };
  function towerEntry(id) {
    const d = saveData();
    if (!d || !BB.data.towers[id]) return null;
    d.towers = d.towers || {};
    return d.towers[id] || (d.towers[id] = { owned: false, level: 0 });
  }
  BB.towersApi = {
    list() { return BB.data.towerOrder.slice(); },
    cost(id) {
      const t = towerEntry(id), def = BB.data.towers[id];
      if (!t) return null;
      if (!t.owned) return { gold: def.unlock.gold || 0, gems: def.unlock.gems || 0 };
      return t.level >= bal().TOWER_MAX_LEVEL ? null : { gold: bal().towerLevelCost(t.level) };
    },
    canUnlock(id) {
      const t = towerEntry(id), d = saveData(), def = BB.data.towers[id];
      return !!(t && !t.owned && (d.maxLevel || 1) >= (def.unlock.level || 0) && afford(this.cost(id)));
    },
    unlock(id) {
      if (!this.canUnlock(id) || !pay(this.cost(id))) return false;
      const t = towerEntry(id), d = saveData();
      t.owned = true; t.level = Math.max(1, t.level | 0);
      if (d.traps.indexOf(id) < 0) { const i = d.traps.indexOf(null); if (i >= 0) d.traps[i] = id; }
      commit();
      return true;
    },
    canLevelUp(id) { const t = towerEntry(id), c = this.cost(id); return !!(t && t.owned && c && afford(c)); },
    levelUp(id) {
      if (!this.canLevelUp(id) || !pay(this.cost(id))) return false;
      towerEntry(id).level++;
      commit();
      return true;
    },
    // Coloca una torre/trampa en un hueco del suelo (null = quitar). Una misma torre solo en un hueco.
    place(slot, id) {
      const d = saveData();
      if (!d || slot < 0 || slot > 3) return false;
      if (id) { const t = towerEntry(id); if (!t || !t.owned) return false; const j = d.traps.indexOf(id); if (j >= 0) d.traps[j] = null; }
      d.traps[slot] = id || null;
      commit();
      return true;
    },
  };

  // ================================================================ poder del ejército
  BB.armyPower = function (save) {
    save = save || saveData();
    if (!save) return 0;
    const cs = BB.castleStats(save);
    let p = 0;
    for (const id of deployed(save)) { const st = BB.heroStats(id, save); if (st) p += st.power; }
    for (const id of (save.traps || [])) { if (id && save.towers && save.towers[id] && save.towers[id].owned) { const ts = BB.towerStats(id, save); if (ts) p += ts.power; } }
    p += (cs.maxHp + cs.wallHp * (1 + cs.wallArmor)) / 20 + cs.tapDamage / cs.tapCooldown * 0.5 + cs.regen * 20;
    return Math.round(p);
  };
  // Poder orientativo recomendado para el nivel L (misma escala que BB.armyPower)
  BB.recommendedPower = function (L) {
    const b = bal();
    return Math.round(560 * Math.pow(b.enemyHp(L), 0.85) * (1 + 0.012 * (L - 1)));
  };

  // ================================================================ guardado
  BB.ensureSaveDefaults = function (save) {
    if (!save || typeof save !== 'object') return save;
    const heroes = BB.data.heroes || {};
    save.heroes = save.heroes && typeof save.heroes === 'object' ? save.heroes : {};
    for (const id in heroes) {
      const h = save.heroes[id] || (save.heroes[id] = {});
      if (typeof h.owned !== 'boolean') h.owned = !!heroes[id].starter;
      if (heroes[id].starter) h.owned = true;
      h.level = Math.max(1, Math.min(bal() ? bal().HERO_MAX_LEVEL : 100, h.level | 0 || 1));
      h.talents = cleanTalents(id, h.talents && typeof h.talents === 'object' ? h.talents : {});
      if (spent(h) > earned(h)) h.talents = {};
      syncPoints(h);
    }
    if (!Array.isArray(save.lineup)) save.lineup = [];
    while (save.lineup.length < 10) save.lineup.push(null);
    save.lineup.length = 10;
    const seen = {};
    for (let i = 0; i < 10; i++) {
      const id = save.lineup[i];
      if (!id || !heroes[id] || !save.heroes[id].owned || seen[id]) save.lineup[i] = null; else seen[id] = 1;
    }
    if (!save.lineup.some(Boolean)) ['arquera', 'mago_fuego', 'maga_hielo'].forEach((id, i) => { if (heroes[id]) save.lineup[i] = id; });
    save.castle = save.castle && typeof save.castle === 'object' ? save.castle : {};
    for (const u of BB.data.castleUpgrades) save.castle[u.id] = Math.max(0, Math.min(u.max, save.castle[u.id] | 0));
    save.towers = save.towers && typeof save.towers === 'object' ? save.towers : {};
    for (const id in BB.data.towers) {
      const t = save.towers[id] || (save.towers[id] = { owned: false, level: 0 });
      t.owned = !!t.owned;
      t.level = t.owned ? Math.max(1, Math.min(bal() ? bal().TOWER_MAX_LEVEL : 40, t.level | 0 || 1)) : 0;
    }
    if (!Array.isArray(save.traps)) save.traps = [];
    while (save.traps.length < 4) save.traps.push(null);
    save.traps.length = 4;
    const tseen = {};
    for (let i = 0; i < 4; i++) {
      const id = save.traps[i];
      if (!id || !save.towers[id] || !save.towers[id].owned || tseen[id]) save.traps[i] = null; else tseen[id] = 1;
    }
    return save;
  };

  BB.data.upgrades = {
    heroMaxLevel: () => bal().HERO_MAX_LEVEL, levelsPerTalentPoint: () => bal().LEVELS_PER_TALENT_POINT,
    talentRowPoints: ROW_POINTS.slice(), talentResetCost: Object.assign({}, RESET_COST), huecosCost: HUECOS_COST,
  };
})();
