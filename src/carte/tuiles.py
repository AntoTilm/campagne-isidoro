# Découpe le fond SVG en tuiles WebP : niveau L = 2^L pixels par unité de carte, tuiles de 512 px.
import os, sys, re, math, json, shutil
from PIL import Image
from playwright.sync_api import sync_playwright
X0, Y0, CW, CH = 0, 0, 1585, 1194
T = 512
ICI = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ICI, 'faerun.svg')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ICI, '..', '..', 'assets', 'carte', 'tuiles')
NIVEAUX = {0: None, 1: None, 2: None, 3: None, 4: (780, 830, 1130, 1030)}
svg = open(SRC).read()
shutil.rmtree(OUT, ignore_errors=True)
index = {}
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 2048, 'height': 2048})
    for L, zone in NIVEAUX.items():
        s = 2 ** L
        W, H = math.ceil(CW * s), math.ceil(CH * s)
        nx, ny = math.ceil(W / T), math.ceil(H / T)
        if zone:
            ix0, iy0 = int((zone[0] - X0) * s // T), int((zone[1] - Y0) * s // T)
            ix1, iy1 = math.ceil((zone[2] - X0) * s / T), math.ceil((zone[3] - Y0) * s / T)
        else:
            ix0, iy0, ix1, iy1 = 0, 0, nx, ny
        os.makedirs(f'{OUT}/{L}', exist_ok=True)
        index[L] = [ix0, iy0, ix1, iy1]
        bloc = 4  # 4 x 4 tuiles par capture
        for by in range(iy0, iy1, bloc):
            for bx in range(ix0, ix1, bloc):
                cw, ch = min(bloc, ix1 - bx) * T, min(bloc, iy1 - by) * T
                vx, vy = X0 + bx * T / s, Y0 + by * T / s
                v = re.sub(r'viewBox="[^"]+" width="[^"]+" height="[^"]+"', f'viewBox="{vx} {vy} {cw/s} {ch/s}" width="{cw}" height="{ch}"', svg, count=1)
                open(os.path.join(ICI, '_c.svg'), 'w').write(v)
                pg.set_viewport_size({'width': cw, 'height': ch})
                pg.goto('file://' + os.path.abspath(os.path.join(ICI, '_c.svg')))
                pg.screenshot(path=os.path.join(ICI, '_c.png'))
                im = Image.open(os.path.join(ICI, '_c.png')).convert('RGB')
                for j in range(ch // T):
                    for i in range(cw // T):
                        tx, ty = bx + i, by + j
                        if tx >= nx or ty >= ny: continue
                        im.crop((i * T, j * T, (i + 1) * T, (j + 1) * T)).save(f'{OUT}/{L}/{tx}_{ty}.webp', 'WEBP', quality=80, method=5)
        print('niveau', L, index[L])
    b.close()
json.dump({k: v for k, v in index.items() if k}, open(f'{OUT}/index.json', 'w'), separators=(',', ':'))
# Le niveau 0 devient l'image d'aperçu, toujours affichée sous les tuiles
apercu = Image.new('RGB', (index[0][2] * T, index[0][3] * T))
for i in range(index[0][2]):
    for j in range(index[0][3]): apercu.paste(Image.open(f'{OUT}/0/{i}_{j}.webp'), (i * T, j * T))
apercu.crop((0, 0, CW, CH)).save(os.path.join(OUT, '..', 'faerun-apercu.webp'), 'WEBP', quality=82, method=5)
shutil.rmtree(f'{OUT}/0')
for f in ('_c.svg', '_c.png'):
    if os.path.exists(os.path.join(ICI, f)): os.remove(os.path.join(ICI, f))
