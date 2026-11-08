# Outils de vectorisation des cartes dessinées à la main : couleurs, squelette, polylignes.
import cv2, numpy as np
from skimage.morphology import skeletonize
V8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

def combler(m):
    m = m.astype(np.uint8)
    n, lbl, st, _ = cv2.connectedComponentsWithStats(1 - m, 4)
    bord = set(np.unique(np.r_[lbl[0], lbl[-1], lbl[:, 0], lbl[:, -1]]))
    out = m.copy()
    for i in range(1, n):
        if i not in bord: out[lbl == i] = 1
    return out

def papier(im):
    hsv = cv2.cvtColor(cv2.GaussianBlur(im, (0, 0), 3), cv2.COLOR_BGR2HSV).astype(int)
    m = ((hsv[..., 2] > 140) & (hsv[..., 1] < 80)).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41)))
    n, lbl, st, _ = cv2.connectedComponentsWithStats(m, 8)
    m = (lbl == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    return cv2.erode(combler(m), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))

def classes_couleur(im):
    hsv = cv2.cvtColor(cv2.GaussianBlur(im, (0, 0), 1), cv2.COLOR_BGR2HSV).astype(int)
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    p = papier(im).astype(bool)
    c = {'vert_fonce': p & (H >= 55) & (H <= 95) & (S >= 50) & (V < 200),
         'vert_clair': p & (H >= 28) & (H < 55) & (S >= 70),
         'bleu': p & (H >= 96) & (H <= 128) & (S >= 65),
         'brun': p & ((H <= 18) | (H >= 165)) & (S >= 90) & (V < 185)}
    c['noir'] = p & (V < 95) & ~c['bleu'] & ~c['vert_fonce']
    return c

def chaines(sq):
    ys, xs = np.nonzero(sq)
    pts = set(zip(ys.tolist(), xs.tolist()))
    vois = lambda q: [(q[0] + a, q[1] + b) for a, b in V8 if (q[0] + a, q[1] + b) in pts]
    deg = {q: len(vois(q)) for q in pts}
    vu = set(); res = []
    for d in [q for q in pts if deg[q] != 2] + list(pts):
        for n in vois(d):
            if (d, n) in vu or (n, d) in vu: continue
            ch = [d, n]; vu.add((d, n)); prev, cur = d, n
            while deg[cur] == 2:
                nx = [q for q in vois(cur) if q != prev]
                if not nx or (cur, nx[0]) in vu or (nx[0], cur) in vu: break
                vu.add((cur, nx[0])); prev, cur = cur, nx[0]; ch.append(cur)
                if cur == d: break
            res.append(ch)
    return res, deg

def longueur(ch):
    P = np.array(ch, float)
    return float(np.hypot(*np.diff(P, axis=0).T).sum()) if len(P) > 1 else 0.

def elaguer(sq, lmin, tours=3):
    sq = sq.copy().astype(np.uint8)
    for _ in range(tours):
        chs, deg = chaines(sq)
        enleve = False
        for ch in chs:
            a, b = deg.get(ch[0], 0), deg.get(ch[-1], 0)
            if (a == 1) != (b == 1) and longueur(ch) < lmin:
                for (y, x) in (ch[:-1] if b != 1 else ch[1:]): sq[y, x] = 0
                enleve = True
        sq = skeletonize(sq > 0).astype(np.uint8)
        if not enleve: break
    return sq

def vectoriser(masque, lier=0, lmin=60, eperon=25, simpl=2.5, fermer=0):
    m = masque.astype(np.uint8)
    if fermer: m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (fermer, fermer)))
    if lier: m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (lier, lier)))
    sq = elaguer(skeletonize(m > 0).astype(np.uint8), max(eperon, lier * .8))
    chs, _ = chaines(sq)
    out = []
    for ch in chs:
        if longueur(ch) < lmin: continue
        P = np.array([(x, y) for y, x in ch], np.float32).reshape(-1, 1, 2)
        out.append(cv2.approxPolyDP(P, simpl, False)[:, 0, :].astype(float))
    return fusionner(out, max(6, lier * .6))

def fusionner(polys, tol):
    polys = [np.array(p, float) for p in polys]
    change = True
    while change:
        change = False
        for i in range(len(polys)):
            for j in range(i + 1, len(polys)):
                A, B = polys[i], polys[j]
                for ea, eb in ((-1, 0), (-1, -1), (0, 0), (0, -1)):
                    if np.hypot(*(A[ea] - B[eb])) < tol:
                        A2 = A if ea == -1 else A[::-1]; B2 = B if eb == 0 else B[::-1]
                        polys[i] = np.vstack([A2, B2]); polys.pop(j); change = True; break
                if change: break
            if change: break
    return polys
