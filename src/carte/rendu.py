# Fond de carte illustré de Faerûn (SVG, sans texte) : côtes, reliefs, forêts, fleuves, décor.
import cv2, numpy as np, base64, math, random, json, sys, os
from geo import masque_eau, CADRE
from terrain import ZONES, FLEUVES

random.seed(7); np.random.seed(7)
X0, Y0, X1, Y1 = CADRE
eau = masque_eau()
H, W = eau.shape

# ------------------------------------------------------------ côtes lissées
S = 4
big = cv2.resize(eau.astype(np.float32), (W * S, H * S), interpolation=cv2.INTER_LINEAR)
big = cv2.GaussianBlur(big, (0, 0), 2.0 * S)
bm = (big > 0.5).astype(np.uint8)
terre = (1 - bm).astype(np.uint8)
terre1 = cv2.resize(terre, (W, H), interpolation=cv2.INTER_AREA)
dist = cv2.distanceTransform(terre1, cv2.DIST_L2, 5)  # distance à la mer (en px)

def bruit1d(n, amp, seed):
    rng = np.random.default_rng(seed)
    t = np.arange(n)
    v = np.zeros(n)
    for k, a in [(n / 14, 1.0), (n / 30, .7), (n / 70, .45), (n / 160, .3), (n / 400, .2)]:
        if k < 1: continue
        f = 2 * math.pi * max(1, round(k)) / n
        v += a * np.sin(f * t + rng.uniform(0, 6.3))
    v += rng.normal(0, .25, n)
    v = np.convolve(np.r_[v[-2:], v, v[:2]], np.ones(5) / 5, 'valid')
    return amp * v / 1.6

def ondule(pts, amp=0.55, pas=1.2, seed=0, ferme=True):
    P = np.array(pts, float)
    if ferme: P = np.vstack([P, P[:1]])
    seg = np.hypot(*np.diff(P, axis=0).T)
    L = np.r_[0, np.cumsum(seg)]
    if L[-1] < 3: return P
    n = max(8, int(L[-1] / pas))
    u = np.linspace(0, L[-1], n, endpoint=not ferme)
    Q = np.c_[np.interp(u, L, P[:, 0]), np.interp(u, L, P[:, 1])]
    d = np.gradient(Q, axis=0)
    nn = np.c_[-d[:, 1], d[:, 0]]
    nn /= np.maximum(np.hypot(*nn.T), 1e-6)[:, None]
    Q += nn * bruit1d(len(Q), amp, seed)[:, None]
    return Q

def chemin(Q, ferme=True):
    s = 'M' + ' '.join(f'{x:.1f},{y:.1f}' for x, y in Q)
    return s + ('Z' if ferme else '')

cs, _ = cv2.findContours(terre, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
cotes = []
for i, c in enumerate(cs):
    a = cv2.contourArea(c) / (S * S)
    if a < 6: continue
    ap = cv2.approxPolyDP(c, 0.35 * S, True)[:, 0, :] / S
    amp = 1.25 if a > 400 else 0.5
    cotes.append(chemin(ondule(ap, amp=amp, seed=i)))
d_terre = ' '.join(cotes)

# ------------------------------------------------------------ outils
def lisse_poly(pts, rayon=3):
    P = np.array(pts, float)
    for _ in range(3):  # Chaikin
        Q = []
        for a, b in zip(P, np.roll(P, -1, axis=0)):
            Q += [0.75 * a + 0.25 * b, 0.25 * a + 0.75 * b]
        P = np.array(Q)
    return P

def masque_poly(pts, seed=0):
    m = np.zeros((H, W), np.uint8)
    Q = ondule(lisse_poly(pts), amp=5.5, pas=2, seed=seed)
    cv2.fillPoly(m, [np.round(Q).astype(np.int32)], 1)
    return m, Q

def poisson(m, r, essais=40):
    ys, xs = np.nonzero(m)
    if not len(xs): return []
    idx = np.random.permutation(len(xs))
    pts = []
    grille = {}
    cell = r / math.sqrt(2)
    for k in idx[: min(len(idx), int(len(xs) * 1.0))]:
        x, y = xs[k] + random.random(), ys[k] + random.random()
        gx, gy = int(x / cell), int(y / cell)
        ok = True
        for i in range(gx - 2, gx + 3):
            for j in range(gy - 2, gy + 3):
                q = grille.get((i, j))
                if q and (q[0] - x) ** 2 + (q[1] - y) ** 2 < r * r: ok = False; break
            if not ok: break
        if ok:
            grille[(gx, gy)] = (x, y); pts.append((x, y))
    return pts

# ------------------------------------------------------------ glyphes
ENCRE = '#4a3a28'
glyphes = []   # (y, svg)
teintes = []
occupe = np.zeros((H, W), np.uint8)

PARAMS = {
    'montagne': dict(r=8.5, marge=4), 'colline': dict(r=7.5, marge=3), 'foret': dict(r=4.6, marge=2.5),
    'resineux': dict(r=4.4, marge=2.5), 'jungle': dict(r=4.8, marge=2.5), 'desert': dict(r=6.5, marge=2),
    'lande': dict(r=7, marge=2), 'marais': dict(r=6, marge=2),
}
TEINTE = {'foret': '#a9b77c', 'resineux': '#9aac78', 'jungle': '#93ab6c', 'montagne': '#c8b48c', 'colline': '#d6c296',
          'desert': '#e6c98a', 'lande': '#cfc79a', 'marais': '#b6bf96'}
ordre = ['montagne', 'colline', 'desert', 'lande', 'marais', 'resineux', 'foret', 'jungle']
for typ in ordre:
    for k, (t, nom, pts) in enumerate([z for z in ZONES if z[0] == typ]):
        P = PARAMS[t]
        zone, Q = masque_poly(pts, seed=100 + k + 37 * ordre.index(typ))
        ok = zone & (dist > P['marge']).astype(np.uint8)
        if t in ('foret', 'resineux', 'jungle', 'lande', 'marais', 'desert'):
            ok = ok & (occupe == 0)
        teintes.append(f'<path d="{chemin(Q)}" fill="{TEINTE[t]}" opacity="{.3 if t != "desert" else .5}"/>')
        bord = cv2.distanceTransform(zone, cv2.DIST_L2, 5)
        for (x, y) in poisson(ok, P['r']):
            pr = min(1, .2 + bord[int(y), int(x)] / (2.4 * P['r']))
            if random.random() > pr: continue
            s = random.uniform(.85, 1.2) * (0.8 + 0.2 * pr)
            if t == 'montagne':
                v = random.randint(1, 3); s *= 1.15
                glyphes.append((y, f'<use href="#mt{v}" transform="translate({x:.1f} {y:.1f}) scale({s:.2f})"/>'))
            elif t == 'colline':
                glyphes.append((y, f'<use href="#co" transform="translate({x:.1f} {y:.1f}) scale({s:.2f})"/>'))
            elif t == 'foret':
                v = random.randint(1, 2)
                glyphes.append((y, f'<use href="#ar{v}" transform="translate({x:.1f} {y:.1f}) scale({s:.2f})"/>'))
            elif t == 'resineux':
                v = 'sa' if random.random() < .75 else 'ar1'
                glyphes.append((y, f'<use href="#{v}" transform="translate({x:.1f} {y:.1f}) scale({s:.2f})"/>'))
            elif t == 'jungle':
                v = 'pa' if random.random() < .3 else 'ju'
                glyphes.append((y, f'<use href="#{v}" transform="translate({x:.1f} {y:.1f}) scale({s:.2f})"/>'))
            elif t == 'desert':
                glyphes.append((y, f'<use href="#{"du" if random.random() < .35 else "pt"}" transform="translate({x:.1f} {y:.1f}) scale({s:.2f})"/>'))
            elif t == 'lande':
                glyphes.append((y, f'<use href="#to" transform="translate({x:.1f} {y:.1f}) scale({s:.2f})"/>'))
            elif t == 'marais':
                glyphes.append((y, f'<use href="#ma" transform="translate({x:.1f} {y:.1f}) scale({s:.2f})"/>'))
        occupe |= zone
libre = ((occupe == 0) & (dist > 6)).astype(np.uint8)
for (x, y) in poisson(libre, 16):
    r = random.random()
    if r < .5: glyphes.append((y, f'<use href="#to" transform="translate({x:.1f} {y:.1f}) scale({random.uniform(.7,1):.2f})" opacity=".55"/>'))
    elif r < .58: glyphes.append((y, f'<use href="#co" transform="translate({x:.1f} {y:.1f}) scale({random.uniform(.7,.95):.2f})" opacity=".8"/>'))
glyphes.sort(key=lambda g: g[0])

# ------------------------------------------------------------ fleuves
def prolonge_jusqu_a_la_mer(pts):
    P = [np.array(p, float) for p in pts]
    d = P[-1] - P[-2]; d /= np.hypot(*d)
    q = P[-1].copy()
    for _ in range(60):
        xi, yi = int(round(q[0])), int(round(q[1]))
        if 0 <= xi < W and 0 <= yi < H and terre1[yi, xi] == 0: break
        q = q + d
    P.append(q)
    return P

def lisse_ouvert(P):
    P = np.array(P, float)
    for _ in range(3):
        Q = [P[0]]
        for a, b in zip(P[:-1], P[1:]):
            Q += [0.75 * a + 0.25 * b, 0.25 * a + 0.75 * b]
        Q.append(P[-1]); P = np.array(Q)
    return P

fleuves = []
for i, (nom, pts) in enumerate(FLEUVES):
    P = prolonge_jusqu_a_la_mer(pts)
    Q = ondule(lisse_ouvert(P), amp=1.6, pas=1.2, seed=500 + i, ferme=False)
    m = len(Q)
    for a, b, w in [(0, m // 3 + 1, .6), (m // 3, 2 * m // 3 + 1, .9), (2 * m // 3, m, 1.25)]:
        fleuves.append(f'<path d="{chemin(Q[a:b], False)}" stroke-width="{w}"/>')

# ------------------------------------------------------------ texture du papier
def texture(n=384, seed=3):
    rng = np.random.default_rng(seed)
    v = np.zeros((n, n))
    for octave, a in [(4, 1), (8, .6), (16, .4), (48, .25), (128, .18)]:
        g = rng.normal(0, 1, (octave, octave))
        g = np.tile(g, (3, 3))
        up = cv2.resize(g, (n * 3, n * 3), interpolation=cv2.INTER_CUBIC)[n:2 * n, n:2 * n]
        v += a * up
    v += rng.normal(0, .35, (n, n))
    v = (v - v.min()) / (v.max() - v.min())
    img = np.uint8(np.clip(185 + 70 * v, 0, 255))
    ok, png = cv2.imencode('.png', img)
    return base64.b64encode(png).decode()

TEX = texture()

# ------------------------------------------------------------ décor
def rose(cx, cy, r):
    out = [f'<g transform="translate({cx} {cy})" stroke="{ENCRE}" stroke-width=".5">',
           f'<circle r="{r*1.02:.1f}" fill="none" stroke-width=".8"/><circle r="{r*.94:.1f}" fill="none" stroke-width=".35"/>']
    for k in range(32):
        a = k * math.pi / 16
        l = r * (.94 if k % 2 else .86)
        out.append(f'<line x1="{r*.8*math.cos(a):.1f}" y1="{r*.8*math.sin(a):.1f}" x2="{l*math.cos(a):.1f}" y2="{l*math.sin(a):.1f}" stroke-width=".35"/>')
    for k, (l, w) in enumerate([(r * .72, r * .1)] * 4 + [(r * .78, r * .14)] * 4):
        a = (k % 4) * math.pi / 2 + (math.pi / 4 if k < 4 else 0) - math.pi / 2
        px, py = l * math.cos(a), l * math.sin(a)
        qx, qy = w * math.cos(a + math.pi / 2), w * math.sin(a + math.pi / 2)
        sombre = '#7a2e22' if (k == 4) else ENCRE
        out.append(f'<path d="M{px:.1f},{py:.1f} L{qx:.1f},{qy:.1f} L0,0Z" fill="#f2e6c8"/>')
        out.append(f'<path d="M{px:.1f},{py:.1f} L{-qx:.1f},{-qy:.1f} L0,0Z" fill="{sombre}"/>')
    out.append(f'<circle r="{r*.07:.1f}" fill="#b8892e"/></g>')
    return ''.join(out)

def navire(x, y, s):
    return (f'<g transform="translate({x} {y}) scale({s})" stroke="{ENCRE}" stroke-width=".6" stroke-linejoin="round">'
            '<path d="M-14,2 Q-10,8 0,8 Q10,8 15,1 L9,2 L-9,2 Z" fill="#8a6a46"/>'
            '<path d="M-1,2 L-1,-20 M6,2 L6,-14 M-8,2 L-8,-12" fill="none"/>'
            '<path d="M-1,-19 Q5,-13 -1,-6 Z M-1,-6 Q6,-1 -1,1 Z M6,-13 Q11,-8 6,-3 Z M-8,-11 Q-3,-7 -8,-2 Z" fill="#f4ead2"/>'
            '<path d="M-1,-20 L4,-22 L-1,-23" fill="#a3271e" stroke-width=".3"/>'
            '<path d="M-20,9 q3,-2 6,0 t6,0 M10,9 q3,-2 6,0 t6,0" fill="none" stroke-width=".4"/></g>')

def serpent(x, y, s):
    return (f'<g transform="translate({x} {y}) scale({s})" stroke="{ENCRE}" stroke-width=".7" fill="#6f8f7a">'
            '<path d="M-30,4 q4,-10 9,0 Z M-12,4 q5,-13 11,0 Z M7,4 q4,-10 9,0 Z"/>'
            '<path d="M18,4 q2,-9 7,-12 q6,-2 7,3 q-2,1 -5,1 q-3,2 -4,8 Z"/>'
            '<circle cx="28" cy="-6" r=".9" fill="' + ENCRE + '"/>'
            '<path d="M-38,5 q4,-2 8,0 t8,0 t8,0 t8,0 t8,0 t8,0 t8,0 t8,0 t8,0" fill="none" stroke-width=".45"/></g>')

def cadre():
    x0, y0, x1, y1 = X0, Y0, X1, Y1
    out = [f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" fill="none" stroke="{ENCRE}" stroke-width="3"/>',
           f'<rect x="{x0+7}" y="{y0+7}" width="{x1-x0-14}" height="{y1-y0-14}" fill="none" stroke="{ENCRE}" stroke-width=".7"/>']
    # bande graduée alternée
    pas = 20
    for i, x in enumerate(np.arange(x0 + 7, x1 - 7, pas)):
        w = min(pas, x1 - 7 - x)
        if i % 2 == 0:
            out.append(f'<rect x="{x:.1f}" y="{y0+2}" width="{w:.1f}" height="3.5" fill="{ENCRE}"/><rect x="{x:.1f}" y="{y1-5.5}" width="{w:.1f}" height="3.5" fill="{ENCRE}"/>')
    for i, y in enumerate(np.arange(y0 + 7, y1 - 7, pas)):
        h = min(pas, y1 - 7 - y)
        if i % 2 == 0:
            out.append(f'<rect x="{x0+2}" y="{y:.1f}" width="3.5" height="{h:.1f}" fill="{ENCRE}"/><rect x="{x1-5.5}" y="{y:.1f}" width="3.5" height="{h:.1f}" fill="{ENCRE}"/>')
    return ''.join(out)

DEFS = f'''
<pattern id="papier" patternUnits="userSpaceOnUse" width="160" height="160"><image href="data:image/png;base64,{TEX}" width="160" height="160"/></pattern>
<pattern id="houle" patternUnits="userSpaceOnUse" width="26" height="14"><path d="M2,9 q3,-3 6,0 t6,0" fill="none" stroke="#5f8790" stroke-width=".45" opacity=".55"/></pattern>
<radialGradient id="vignette" cx="50%" cy="50%" r="72%"><stop offset="62%" stop-color="#6b4a22" stop-opacity="0"/><stop offset="100%" stop-color="#6b4a22" stop-opacity=".38"/></radialGradient>
<clipPath id="cadre"><rect x="{X0}" y="{Y0}" width="{X1-X0}" height="{Y1-Y0}"/></clipPath>
<clipPath id="terre"><path d="{d_terre}" clip-rule="evenodd"/></clipPath>
<symbol id="mt1" overflow="visible"><path d="M-6.5,0 L-1,-8.5 L1.2,-6 L2.4,-7.4 L6.5,0Z" fill="#efe1bd"/><path d="M-1,-8.5 L0,-3.5 L-1.4,0 L6.5,0 L2.4,-7.4 L1.2,-6Z" fill="#b39c74"/><path d="M-6.5,0 L-1,-8.5 L1.2,-6 L2.4,-7.4 L6.5,0" fill="none" stroke="{ENCRE}" stroke-width=".55" stroke-linejoin="round"/><path d="M1.5,-4 l1.5,1.6 M2.6,-2.6 l1.6,1.7 M3.8,-4.6 l1.2,1.4" stroke="{ENCRE}" stroke-width=".3"/></symbol>
<symbol id="mt2" overflow="visible"><path d="M-7,0 L0,-10 L7,0Z" fill="#efe1bd"/><path d="M0,-10 L1,-4 L-.5,0 L7,0Z" fill="#ad9670"/><path d="M-7,0 L0,-10 L7,0" fill="none" stroke="{ENCRE}" stroke-width=".55" stroke-linejoin="round"/><path d="M-1.6,-7.7 L0,-10 L1.6,-7.7 L.5,-8.2 L-.4,-7.4Z" fill="#fbf7ee" stroke="{ENCRE}" stroke-width=".25"/><path d="M2.2,-4.4 l1.5,1.6 M3.5,-2.8 l1.6,1.7" stroke="{ENCRE}" stroke-width=".3"/></symbol>
<symbol id="mt3" overflow="visible"><path d="M-6,0 L-2.6,-5.2 L-1,-4 L1.6,-7.4 L6,0Z" fill="#efe1bd"/><path d="M1.6,-7.4 L2,-3.2 L.8,0 L6,0Z" fill="#b39c74"/><path d="M-6,0 L-2.6,-5.2 L-1,-4 L1.6,-7.4 L6,0" fill="none" stroke="{ENCRE}" stroke-width=".55" stroke-linejoin="round"/><path d="M3,-3.3 l1.4,1.5" stroke="{ENCRE}" stroke-width=".3"/></symbol>
<symbol id="co" overflow="visible"><path d="M-5,0 Q-2,-4.2 1.2,-3.4 Q4,-2.6 5,0" fill="#e5d3a8" stroke="{ENCRE}" stroke-width=".5"/><path d="M1.5,-2 l1,1.2 M3,-1.6 l.8,1" stroke="{ENCRE}" stroke-width=".3"/></symbol>
<symbol id="ar1" overflow="visible"><path d="M0,0 L0,-1.6" stroke="{ENCRE}" stroke-width=".5"/><path d="M-2.3,-1.8 q-1,-1.8 .5,-2.8 q.4,-1.6 1.9,-1.2 q1.6,-.3 1.9,1.3 q1.3,1.1 .2,2.7 q-.8.8 -2.2.5 q-1.4.4 -2.3-.5Z" fill="#8fa864" stroke="{ENCRE}" stroke-width=".42"/><path d="M.6,-4.6 q.9,.6 .8,1.8" fill="none" stroke="#5c7040" stroke-width=".35"/></symbol>
<symbol id="ar2" overflow="visible"><path d="M0,0 L0,-1.4" stroke="{ENCRE}" stroke-width=".5"/><circle cx="0" cy="-3.2" r="2.2" fill="#9db46f" stroke="{ENCRE}" stroke-width=".42"/><path d="M.4,-4.6 q1,.5 .9,1.7" fill="none" stroke="#5c7040" stroke-width=".35"/></symbol>
<symbol id="sa" overflow="visible"><path d="M0,0 L0,-1.2" stroke="{ENCRE}" stroke-width=".5"/><path d="M0,-6.6 L2.1,-1.4 L-2.1,-1.4Z" fill="#6f8d5c" stroke="{ENCRE}" stroke-width=".42" stroke-linejoin="round"/><path d="M0,-6.6 L.6,-1.4 L2.1,-1.4Z" fill="#4f6b44"/></symbol>
<symbol id="ju" overflow="visible"><path d="M0,0 L0,-1.4" stroke="{ENCRE}" stroke-width=".5"/><path d="M-2.6,-2 q-.9,-1.7 .4,-2.7 q.2,-1.7 1.9,-1.4 q1.4,-.9 2.3,.5 q1.4.8.4,2.6 q-1.2,1 -2.4.4 q-1.4.8 -2.6.6Z" fill="#6f9a52" stroke="{ENCRE}" stroke-width=".42"/></symbol>
<symbol id="pa" overflow="visible"><path d="M0,0 Q.6,-2.5 0,-5" fill="none" stroke="{ENCRE}" stroke-width=".55"/><path d="M0,-5 q-2,-.8 -3,.6 M0,-5 q2,-.8 3,.6 M0,-5 q-1.4,-1.6 -2.6,-1.2 M0,-5 q1.4,-1.6 2.6,-1.2" fill="none" stroke="#3f6a3a" stroke-width=".55" stroke-linecap="round"/></symbol>
<symbol id="pt" overflow="visible"><circle r=".45" fill="{ENCRE}" opacity=".55"/><circle cx="2.4" cy="1.1" r=".35" fill="{ENCRE}" opacity=".45"/><circle cx="-2" cy="1.6" r=".3" fill="{ENCRE}" opacity=".45"/></symbol>
<symbol id="du" overflow="visible"><path d="M-4,0 q2,-2.4 4.5,-1.6 q1.8.6 3.5,1.6" fill="none" stroke="#8a6a3a" stroke-width=".5"/><path d="M.5,-1.6 q1.2,1 .9,1.6" fill="none" stroke="#8a6a3a" stroke-width=".3"/></symbol>
<symbol id="to" overflow="visible"><path d="M-1.5,0 L-.6,-2.2 M0,0 L0,-2.8 M1.5,0 L.6,-2.2 M-2.6,0 L2.6,0" stroke="#6b6436" stroke-width=".45" stroke-linecap="round"/></symbol>
<symbol id="ma" overflow="visible"><path d="M-3,0 L3,0 M-1.8,1.4 L2,1.4" stroke="#5f8790" stroke-width=".5"/><path d="M-.6,0 L-.9,-2 M0,0 L0,-2.6 M.6,0 L.9,-2" stroke="#6b6436" stroke-width=".4"/></symbol>
'''

out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{X0} {Y0} {X1-X0} {Y1-Y0}" width="{X1-X0}" height="{Y1-Y0}">',
       f'<defs>{DEFS}</defs>',
       '<g clip-path="url(#cadre)">',
       # mer
       f'<rect x="{X0}" y="{Y0}" width="{X1-X0}" height="{Y1-Y0}" fill="#b9cfc8"/>',
       f'<rect x="{X0}" y="{Y0}" width="{X1-X0}" height="{Y1-Y0}" fill="url(#houle)"/>',
       # lignes de côte concentriques (côté mer)
       f'<g fill="none" stroke-linejoin="round">'
       f'<path d="{d_terre}" stroke="#7da0a4" stroke-width="15" opacity=".22"/>'
       f'<path d="{d_terre}" stroke="#a7c2bd" stroke-width="12.6"/>'
       f'<path d="{d_terre}" stroke="#6f949a" stroke-width="9" opacity=".55"/>'
       f'<path d="{d_terre}" stroke="#b9cfc8" stroke-width="7.8"/>'
       f'<path d="{d_terre}" stroke="#6f949a" stroke-width="4.6" opacity=".75"/>'
       f'<path d="{d_terre}" stroke="#c4d8d0" stroke-width="3.6"/></g>',
       # terre
       f'<path d="{d_terre}" fill="#efe0bb" fill-rule="evenodd"/>',
       f'<g clip-path="url(#terre)">{"".join(teintes)}</g>',
       f'<g fill="none" stroke="#4c7884" stroke-linecap="round" stroke-linejoin="round">{"".join(fleuves)}</g>',
       f'<path d="{d_terre}" fill="none" stroke="{ENCRE}" stroke-width=".65" stroke-linejoin="round"/>',
       f'<g>{"".join(g for _, g in glyphes)}</g>',
       rose(470, 985, 46), navire(205, 330, .85), navire(1010, 455, .6), serpent(640, 975, .9), serpent(60, 770, .7),
       f'<rect x="{X0}" y="{Y0}" width="{X1-X0}" height="{Y1-Y0}" fill="url(#papier)" style="mix-blend-mode:multiply" opacity=".55"/>',
       f'<rect x="{X0}" y="{Y0}" width="{X1-X0}" height="{Y1-Y0}" fill="url(#vignette)"/>',
       '</g>', cadre(), '</svg>']
svg = '\n'.join(out)
open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'faerun.svg'), 'w').write(svg)
print('glyphes', len(glyphes), 'taille', len(svg) // 1024, 'Ko')
