"""Capturas de la galería de personajes (tests/rig.html).  Uso: python tests/rig_shot.py SALIDA_DIR nombre=k1,k2 nombre2=k3,k4 ..."""
import base64, pathlib, sys, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ui_cdp as C
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
p, ws = C.session(1600, 900)
try:
    ws.call('Page.enable')
    ws.call('Emulation.setDeviceMetricsOverride', width=1600, height=900, deviceScaleFactor=1, mobile=False)
    ws.call('Page.addScriptToEvaluateOnNewDocument', source="window.__errs=[];addEventListener('error',e=>__errs.push(e.message+' :'+e.lineno));const _ce=console.error;console.error=function(...a){__errs.push(a.map(String).join(' '));_ce.apply(console,a)};")
    for arg in sys.argv[2:]:
        name, keys = arg.split('=', 1)
        ws.call('Page.navigate', url=(C.ROOT / 'rig.html').as_uri() + '?k=' + keys)
        time.sleep(1.5)
        d = ws.call('Page.captureScreenshot', format='png')
        (out / f'{name}.png').write_bytes(base64.b64decode(d['data']))
        print(name, C.evaluate(ws, "document.title + ' ' + JSON.stringify(window.__errs.slice(0,5))"))
finally:
    p.kill()
