"""Evalúa expresiones JS en el juego real (index.html) y las imprime.
Uso: python tests/eval.py "expr1" "expr2" ...   (cada una puede devolver una promesa)"""
import pathlib, sys, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ui_cdp as C
p, ws = C.session(1280, 640)
try:
    ws.call('Page.enable')
    ws.call('Page.addScriptToEvaluateOnNewDocument', source="window.__errs=[];addEventListener('error',e=>__errs.push(e.message+' @'+(e.filename||'').split('/').pop()+':'+e.lineno));const _ce=console.error;console.error=function(...a){__errs.push(a.map(String).join(' '));_ce.apply(console,a)};")
    ws.call('Page.navigate', url=(C.ROOT.parent / 'index.html').as_uri())
    time.sleep(3)
    for e in sys.argv[1:]:
        print(C.evaluate(ws, e))
    print('errores:', C.evaluate(ws, "JSON.stringify(window.__errs.slice(0,10))"))
finally:
    p.kill()
