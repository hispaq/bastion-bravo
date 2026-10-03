"""Recorre pantallas de tests/ui.html, informa de errores y hace capturas a varios tamaños.
Uso: python tests/ui_run.py SALIDA [--sizes 740x360,1280x720,1920x1080] consulta1 consulta2 ..."""
import base64, pathlib, re, sys, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ui_cdp as C

out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
args = sys.argv[2:]
sizes = ['740x360', '1280x720', '1920x1080']
if args and args[0] == '--sizes': sizes = args[1].split(','); args = args[2:]
wait = 2.8
p, ws = C.session()
try:
    ws.call('Page.enable')
    for q in args:
        for s in sizes:
            w, h = map(int, s.split('x'))
            ws.call('Emulation.setDeviceMetricsOverride', width=w, height=h, deviceScaleFactor=1, mobile=False)
            url = q if q.startswith(('file:', 'http')) else (C.ROOT / 'ui.html').as_uri() + '?' + q + ('' if 'anim' in q else '&noanim')
            ws.call('Page.navigate', url=url)
            time.sleep(wait)
            t = C.evaluate(ws, "document.title + (window.__errs && __errs.length ? ' :: ' + __errs.join(' || ') : '')")
            name = re.sub(r'[^a-zA-Z0-9]+', '_', q).strip('_')[:60]
            f = out / f'{name}_{s}.png'
            d = ws.call('Page.captureScreenshot', format='png')
            f.write_bytes(base64.b64decode(d['data']))
            print(f'{q} @{s}: {t}')
finally:
    p.kill()
