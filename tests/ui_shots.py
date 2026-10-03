"""Capturas de la interfaz con Chrome headless.
Uso: python tests/ui_shots.py SALIDA "screen=menu" [más consultas...] [--sizes 740x360,1280x720] [--dom]
Cada consulta se abre como tests/ui.html?<consulta>&noanim. Con --dom imprime document.title (errores)."""
import os, subprocess, sys, pathlib, re

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
ROOT = pathlib.Path(__file__).resolve().parent
PAGE = (ROOT / 'ui.html').as_uri()


def run(args, timeout=60):
    return subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--allow-file-access-from-files',
                           '--host-resolver-rules=MAP * ~NOTFOUND', '--hide-scrollbars', '--mute-audio',
                           '--autoplay-policy=no-user-gesture-required'] + args,
                          capture_output=True, text=True, timeout=timeout, encoding='utf-8', errors='replace')


def main():
    out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
    sizes = ['740x360', '1280x720', '1920x1080']
    queries, dom = [], False
    it = iter(sys.argv[2:])
    for a in it:
        if a == '--sizes': sizes = next(it).split(',')
        elif a == '--dom': dom = True
        else: queries.append(a)
    for q in queries:
        url = PAGE + '?' + q + ('' if 'anim' in q else '&noanim')
        name = re.sub(r'[^a-zA-Z0-9]+', '_', q).strip('_')
        if dom:
            r = run(['--virtual-time-budget=6000', '--window-size=1280,720', '--dump-dom', url])
            m = re.search(r'<title>(.*?)</title>', r.stdout, re.S)
            print(q, '=>', m.group(1) if m else '(sin título)')
            a = re.search(r'data-audio="([^"]*)"', r.stdout)
            if a: print(a.group(1).replace(';', '\n'))
            continue
        for s in sizes:
            w, h = s.split('x')
            f = out / f'{name}_{s}.png'
            run(['--virtual-time-budget=4000', f'--window-size={w},{h}', f'--screenshot={f}', url])
            print(f)


if __name__ == '__main__':
    main()
