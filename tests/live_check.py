"""Comprueba la web publicada (GitHub Pages): carga de sprites, service worker y caché sin conexión.
Uso: python tests/live_check.py [url] [captura.png]"""
import base64, json, subprocess, sys, tempfile, time, urllib.request, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ui_cdp as C

url = sys.argv[1] if len(sys.argv) > 1 else 'https://hispaq.github.io/bastion-bravo/'
shot = sys.argv[2] if len(sys.argv) > 2 else None
ud = tempfile.mkdtemp()
p = subprocess.Popen([C.CHROME, '--headless=new', '--disable-gpu', '--remote-debugging-port=9344',
                      '--user-data-dir=' + ud, '--window-size=1280,640', 'about:blank'])
try:
    tabs = []
    for _ in range(80):
        try:
            tabs = [x for x in json.load(urllib.request.urlopen('http://127.0.0.1:9344/json')) if x['type'] == 'page']
            if tabs:
                break
        except Exception:
            pass
        time.sleep(0.25)
    ws = C.WS(tabs[0]['webSocketDebuggerUrl'])
    ws.call('Page.enable')
    ws.call('Emulation.setDeviceMetricsOverride', width=1280, height=640, deviceScaleFactor=1, mobile=False)
    ws.call('Page.navigate', url=url)
    time.sleep(12)
    print(C.evaluate(ws, 'JSON.stringify({sprites: Object.keys(BB.SPRITES).length, cargado: BB.assets.progress()})'))
    time.sleep(10)
    print(C.evaluate(ws, 'navigator.serviceWorker.getRegistrations().then(r => r.length + " service worker")'))
    print(C.evaluate(ws, 'caches.keys().then(k => Promise.all(k.map(n => caches.open(n).then(c => c.keys()).then(x => n + ": " + x.length + " archivos"))))'))
    if shot:
        d = ws.call('Page.captureScreenshot', format='png')
        open(shot, 'wb').write(base64.b64decode(d['data']))
finally:
    p.kill()
