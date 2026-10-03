"""Mini cliente CDP (sin dependencias) para evaluar JS en tests/ui.html con Chrome headless.
Uso: python tests/ui_cdp.py "screen=menu" "expresión JS" [espera_s] [ancho x alto] [captura.png]"""
import base64, json, os, socket, struct, subprocess, sys, time, urllib.request, pathlib, tempfile

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
ROOT = pathlib.Path(__file__).resolve().parent


class WS:
    def __init__(self, url):
        host, rest = url[5:].split('/', 1)
        h, p = host.split(':')
        self.s = socket.create_connection((h, int(p)))
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.send(f'GET /{rest} HTTP/1.1\r\nHost: {host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n'.encode())
        buf = b''
        while b'\r\n\r\n' not in buf: buf += self.s.recv(4096)
        self.extra = buf.split(b'\r\n\r\n', 1)[1]
        self.id = 0

    def _recv(self, n):
        while len(self.extra) < n:
            self.extra += self.s.recv(1 << 20)
        d, self.extra = self.extra[:n], self.extra[n:]
        return d

    def send(self, obj):
        data = json.dumps(obj).encode()
        hdr = bytearray([0x81])
        n = len(data)
        if n < 126: hdr.append(0x80 | n)
        elif n < 65536: hdr.append(0x80 | 126); hdr += struct.pack('>H', n)
        else: hdr.append(0x80 | 127); hdr += struct.pack('>Q', n)
        mask = os.urandom(4)
        self.s.send(bytes(hdr) + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

    def recv(self):
        msg = b''
        while True:
            b1, b2 = self._recv(2)
            n = b2 & 0x7f
            if n == 126: n = struct.unpack('>H', self._recv(2))[0]
            elif n == 127: n = struct.unpack('>Q', self._recv(8))[0]
            msg += self._recv(n)
            if b1 & 0x80: return json.loads(msg)

    def call(self, method, **params):
        self.id += 1
        self.send({'id': self.id, 'method': method, 'params': params})
        while True:
            m = self.recv()
            if m.get('id') == self.id: return m.get('result', m)


def session(w=1280, h=720, port=9333):
    ud = tempfile.mkdtemp(prefix='bbcdp')
    p = subprocess.Popen([CHROME, '--headless=new', '--disable-gpu', '--allow-file-access-from-files', '--host-resolver-rules=MAP * ~NOTFOUND',
                          f'--remote-debugging-port={port}', f'--user-data-dir={ud}', f'--window-size={w},{h}', '--hide-scrollbars', 'about:blank'])
    for _ in range(80):
        try:
            tabs = json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json'))
            pg = [t for t in tabs if t['type'] == 'page']
            if pg: return p, WS(pg[0]['webSocketDebuggerUrl'])
        except Exception: pass
        time.sleep(0.25)
    raise RuntimeError('sin Chrome')


def evaluate(ws, expr):
    r = ws.call('Runtime.evaluate', expression=expr, awaitPromise=True, returnByValue=True)
    return r.get('result', {}).get('value', r)


if __name__ == '__main__':
    q, expr = sys.argv[1], sys.argv[2]
    wait = float(sys.argv[3]) if len(sys.argv) > 3 else 2.5
    w, h = (sys.argv[4].split('x') if len(sys.argv) > 4 else ('1280', '720'))
    shot = sys.argv[5] if len(sys.argv) > 5 else None
    p, ws = session(int(w), int(h))
    try:
        url = q if q.startswith(('file:', 'http')) else (ROOT / 'ui.html').as_uri() + '?' + q
        ws.call('Page.enable')
        ws.call('Page.navigate', url=url)
        time.sleep(wait)
        print(evaluate(ws, expr))
        if shot:
            d = ws.call('Page.captureScreenshot', format='png')
            open(shot, 'wb').write(base64.b64decode(d['data']))
            print(shot)
    finally:
        p.kill()
