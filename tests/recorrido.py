"""Recorrido del juego real (index.html) con Chrome headless: capturas + errores de consola.
Uso: python tests/recorrido.py SALIDA [ancho x alto]"""
import base64, pathlib, sys, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ui_cdp as C

out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
w, h = map(int, (sys.argv[2] if len(sys.argv) > 2 else '1600x720').split('x'))
INDEX = (C.ROOT.parent / 'index.html').as_uri()

SETUP = """
(() => {
  const d = BB.save.data;
  d.gold = 250000; d.gems = 900; d.maxLevel = 45;
  for (let i = 1; i < 45; i++) d.levels[i] = { stars: 1 + (i % 3), clears: 1, best: 0.9 };
  const ids = ['arquera','mago_fuego','maga_hielo','ballestero','hechicera_rayo','ingeniero','sacerdote','halconera'];
  for (const id of ids) d.heroes[id] = Object.assign(d.heroes[id] || { talents: {}, points: 0 }, { owned: true, level: 34 });
  d.lineup = ids.concat([null, null]);
  Object.assign(d.castle, { torreon: 20, muralla: 20, huecos: 5, ballesta: 10, reparacion: 5 });
  d.towers.catapulta = { owned: true, level: 10 }; d.towers.rayos = { owned: true, level: 10 }; d.towers.pinchos = { owned: true, level: 8 };
  d.traps = ['pinchos', 'catapulta', 'rayos', null];
  for (const k in BB.data.enemies) d.seen.enemies[k] = true;
  d.settings.autoSkills = true;
  BB.save.commit(true);
  return 'ok';
})()
"""

p, ws = C.session(w, h)
shots = []
def snap(name):
    d = ws.call('Page.captureScreenshot', format='png')
    f = out / f'{name}.png'; f.write_bytes(base64.b64decode(d['data'])); shots.append(f.name)
def ev(js):
    return C.evaluate(ws, js)
try:
    ws.call('Page.enable'); ws.call('Runtime.enable')
    ws.call('Emulation.setDeviceMetricsOverride', width=w, height=h, deviceScaleFactor=1, mobile=False)
    ws.call('Page.addScriptToEvaluateOnNewDocument', source="window.__errs=[];addEventListener('error',e=>__errs.push(String(e.message)+' @'+(e.filename||'').split('/').pop()+':'+e.lineno));const _ce=console.error;console.error=function(...a){__errs.push(a.map(String).join(' '));_ce.apply(console,a)};")
    ws.call('Page.navigate', url=INDEX)
    time.sleep(4); snap('01_portada')
    ev(SETUP)
    ev("BB.app.goMenu()"); time.sleep(2); snap('02_menu')
    ev("BB.ui.hideAll && BB.ui.hideAll(); BB.app.goMap()"); time.sleep(3); snap('03_mapa')
    ev("BB.app.startLevel(8)"); time.sleep(14); snap('04_batalla_n8')
    ev("BB.app.endBattle(); BB.app.startLevel(30)"); time.sleep(2.5); snap('05_intro_jefe')
    time.sleep(22); snap('06_jefe_troll')
    ev("BB.app.endBattle(); BB.app.startLevel(44)"); time.sleep(20); snap('07_batalla_n44')
    ev("BB.app.endBattle(); BB.ui.show('shop', {tab:'heroes'})"); time.sleep(2); snap('08_tienda')
    ev("BB.ui.show('hero', {id:'arquera'})"); time.sleep(2); snap('09_heroe')
    ev("BB.ui.show('army')"); time.sleep(2); snap('10_ejercito')
    print('capturas:', ', '.join(shots))
    print('errores:', ev("JSON.stringify(window.__errs.slice(0,30))"))
finally:
    p.kill()
