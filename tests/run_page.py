"""Abre una página de tests/ en Chrome headless, espera a que document.title sea 'done' e imprime el texto.
Uso: python tests/run_page.py campana.html[?query] [segundos_max]"""
import sys, time, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ui_cdp as C
page = sys.argv[1]
limit = float(sys.argv[2]) if len(sys.argv) > 2 else 1200
name, _, q = page.partition('?')
p, ws = C.session(1100, 700)
try:
    ws.call('Page.enable')
    ws.call('Page.navigate', url=(C.ROOT / name).as_uri() + ('?' + q if q else ''))
    t0 = time.time()
    while time.time() - t0 < limit:
        time.sleep(3)
        try:
            if C.evaluate(ws, 'document.title') == 'done': break
        except Exception:
            pass
    print(C.evaluate(ws, 'document.body.innerText'))
finally:
    p.kill()
