"""Captura del juego real tras ejecutar JS.  Uso: python tests/shot.py SALIDA.png "js" espera [WxH] [js2 espera2 ...]"""
import base64, pathlib, sys, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ui_cdp as C
out = sys.argv[1]
w, h = 1600, 720
args = sys.argv[2:]
if args and 'x' in args[-1] and args[-1].replace('x', '').isdigit():
    w, h = map(int, args.pop().split('x'))
p, ws = C.session(w, h)
try:
    ws.call('Page.enable')
    ws.call('Emulation.setDeviceMetricsOverride', width=w, height=h, deviceScaleFactor=1, mobile=False)
    ws.call('Page.addScriptToEvaluateOnNewDocument', source="window.__errs=[];addEventListener('error',e=>__errs.push(String(e.message)+' @'+(e.filename||'').split('/').pop()+':'+e.lineno));const _ce=console.error;console.error=function(...a){__errs.push(a.map(String).join(' '));_ce.apply(console,a)};")
    ws.call('Page.navigate', url=(C.ROOT.parent / 'index.html').as_uri())
    time.sleep(3.5)
    setup = (C.ROOT / 'recorrido.py').read_text(encoding='utf-8').split('SETUP = """')[1].split('"""')[0]
    C.evaluate(ws, setup)
    i = 0
    while i < len(args):
        print(C.evaluate(ws, args[i]))
        time.sleep(float(args[i + 1]) if i + 1 < len(args) else 2)
        i += 2
    d = ws.call('Page.captureScreenshot', format='png')
    open(out, 'wb').write(base64.b64decode(d['data']))
    print('errores:', C.evaluate(ws, "JSON.stringify(window.__errs.slice(0,20))"))
finally:
    p.kill()
