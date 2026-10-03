/* Bastión Bravo · las 10 zonas del mapa de progresión (10 niveles cada una; el 10.º es el jefe).
   Solo datos. La paleta la usa el renderizador del combate (vista lateral):
     sky / skyLow  → degradado del cielo (arriba / horizonte)
     groundTop     → franja superior del suelo (hierba, arena, nieve…)
     ground / groundDark → tierra por donde caminan las unidades (arriba / abajo)
     accent        → color de realce de la zona (flores, cristales, brasas…)
     fog           → velo de ambiente sobre el fondo (sutil)
   `mapStyle` lo usa el mapa de progresión para dibujar el terreno visto desde arriba. */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  BB.data = BB.data || {};

  const DEFS = [
    {
      id: 'bosque', name: 'Bosque Esmeralda', boss: 'rey_goblin', decor: 'grass', weather: 'leaves',
      desc: 'Praderas verdes y robles centenarios. Aquí empezó la invasión goblin.',
      palette: { sky: '#62bdf0', skyLow: '#d3f0fb', groundTop: '#7fd04c', ground: '#8f6c3e', groundDark: '#5a4026', accent: '#ffd84a', fog: 'rgba(225,248,255,0.06)' },
      mapStyle: { base: '#6cbf48', light: '#9adf66', dark: '#3f8a30', water: '#48b6e6', prop: '#2f7a2b', prop2: '#57a83a', trunk: '#7a4b22' },
    },
    {
      id: 'pantano', name: 'Pantano Brumoso', boss: 'chaman_gigante', decor: 'reeds', weather: 'fireflies',
      desc: 'Aguas turbias, niebla espesa y chamanes que acechan entre los juncos.',
      palette: { sky: '#7e9e95', skyLow: '#cfdcc4', groundTop: '#7d9c45', ground: '#5e5a36', groundDark: '#37341f', accent: '#c3f05a', fog: 'rgba(205,228,210,0.16)' },
      mapStyle: { base: '#5f7b3d', light: '#87a755', dark: '#3b5228', water: '#3d7d6c', prop: '#3e5a2a', prop2: '#6f8f3f', trunk: '#4e3a26' },
    },
    {
      id: 'montanas', name: 'Picos Grises', boss: 'troll_piedra', decor: 'rocks', weather: 'dust',
      desc: 'Desfiladeros de roca donde los trolls bajan de las cumbres.',
      palette: { sky: '#7fb0de', skyLow: '#e0ebf3', groundTop: '#a5b199', ground: '#7d7771', groundDark: '#4d4945', accent: '#eef6fb', fog: 'rgba(232,240,248,0.10)' },
      mapStyle: { base: '#8e978a', light: '#b9c1b0', dark: '#5c645d', water: '#6fb5d9', prop: '#3f6b46', prop2: '#6e766f', trunk: '#5a4430' },
    },
    {
      id: 'desierto', name: 'Desierto de Ámbar', boss: 'escorpion', decor: 'sand', weather: 'dust',
      desc: 'Dunas doradas bajo un sol abrasador. Cuidado con lo que se esconde bajo la arena.',
      palette: { sky: '#f2bb62', skyLow: '#fde6b2', groundTop: '#f6d084', ground: '#dda65a', groundDark: '#a8723a', accent: '#ff8b3d', fog: 'rgba(255,232,185,0.08)' },
      mapStyle: { base: '#e9b964', light: '#f8d98f', dark: '#c38a3e', water: '#4cc2d6', prop: '#4f9a3c', prop2: '#c9873c', trunk: '#8a5a24' },
    },
    {
      id: 'volcan', name: 'Volcán Ardiente', boss: 'senor_fuego', decor: 'lava', weather: 'embers',
      desc: 'Ríos de lava y ceniza ardiente. Los orcos forjan aquí su furia.',
      palette: { sky: '#4e2323', skyLow: '#c75a2c', groundTop: '#6b4a3c', ground: '#47302a', groundDark: '#22161a', accent: '#ff6b1a', fog: 'rgba(255,120,55,0.08)' },
      mapStyle: { base: '#4a3631', light: '#6e5248', dark: '#2a1d1b', water: '#ff7a1f', prop: '#2b201e', prop2: '#5b4038', trunk: '#2a1a14' },
    },
    {
      id: 'oscuras', name: 'Tierras Oscuras', boss: 'senor_guerra', decor: 'ash', weather: 'ash',
      desc: 'Un páramo sin sol donde marchan los ejércitos del Señor de la Guerra.',
      palette: { sky: '#3a3254', skyLow: '#7d6188', groundTop: '#5e5670', ground: '#3f3849', groundDark: '#211d29', accent: '#b98cff', fog: 'rgba(125,105,160,0.10)' },
      mapStyle: { base: '#443d53', light: '#635a76', dark: '#28232f', water: '#5a3f8c', prop: '#2a2433', prop2: '#57506b', trunk: '#2a2230' },
    },
    {
      id: 'hielo', name: 'Cumbres Heladas', boss: 'gigante_escarcha', decor: 'snow', weather: 'snow',
      desc: 'Picos nevados y ventiscas heladas. Hasta el aliento se congela.',
      palette: { sky: '#93cdf4', skyLow: '#eaf8ff', groundTop: '#f4fbff', ground: '#c9e2f2', groundDark: '#8fb2cc', accent: '#56cfff', fog: 'rgba(238,249,255,0.12)' },
      mapStyle: { base: '#dcedf8', light: '#ffffff', dark: '#a4c6de', water: '#7fd3f7', prop: '#2f6b5a', prop2: '#9dc0d8', trunk: '#5a4636' },
    },
    {
      id: 'ruinas', name: 'Ruinas Malditas', boss: 'nigromante', decor: 'bones', weather: 'wisps',
      desc: 'Templos derrumbados donde los muertos no descansan.',
      palette: { sky: '#47565c', skyLow: '#93a69b', groundTop: '#7a8a5e', ground: '#5e5a4a', groundDark: '#34312a', accent: '#7dffb2', fog: 'rgba(150,205,175,0.10)' },
      mapStyle: { base: '#5d6a4e', light: '#7d8b66', dark: '#38412f', water: '#3e6a5c', prop: '#9c9a8c', prop2: '#6f7a5c', trunk: '#3d3428' },
    },
    {
      id: 'forja', name: 'Forja de Hierro', boss: 'golem', decor: 'gears', weather: 'sparks',
      desc: 'Talleres goblin, engranajes y vapor: la máquina de guerra nunca para.',
      palette: { sky: '#47403c', skyLow: '#a0714b', groundTop: '#7a6d62', ground: '#55493f', groundDark: '#2c2622', accent: '#ffb23f', fog: 'rgba(255,170,95,0.07)' },
      mapStyle: { base: '#57504a', light: '#7a7068', dark: '#332d29', water: '#ff9a2e', prop: '#6b6f78', prop2: '#8d6a45', trunk: '#2b221c' },
    },
    {
      id: 'dragon', name: 'Nido del Dragón', boss: 'dragon', decor: 'embers', weather: 'embers',
      desc: 'La guarida final. Ceniza, oro y el rugido de Skarnoth.',
      palette: { sky: '#3b1d2c', skyLow: '#b8452e', groundTop: '#6e4033', ground: '#4a2a22', groundDark: '#251513', accent: '#ffcd3a', fog: 'rgba(255,105,70,0.09)' },
      mapStyle: { base: '#4d2e27', light: '#734236', dark: '#2b1814', water: '#ff5a1f', prop: '#2e1a16', prop2: '#7a4a3a', trunk: '#2a1510' },
    },
  ];

  BB.data.zones = DEFS.map((d, i) => Object.assign({
    index: i,
    num: i + 1,
    levels: [i * 10 + 1, i * 10 + 10],
    bossLevel: i * 10 + 10,
    bg: 'bg_' + d.id,
    map: 'map_' + d.id,
    music: d.id,
  }, d));

  BB.data.zoneById = {};
  for (const z of BB.data.zones) BB.data.zoneById[z.id] = z;
})();
