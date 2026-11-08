# Régions redessinées d'après les cartes régionales officielles (photos d'Antoine) :
#   python3 src/carte/region_officielle.py REGION            -> detail/REGION.png (classes) depuis detail/REGION-sources.json
#   python3 src/carte/region_officielle.py REGION PHOTO.jpg  -> en plus, rivières et routes relevées sur la photo -> detail/REGION.json
# REGION : haute-foret ou cormyr. Les photos (cartes imprimées) ne sont pas dans le dépôt ; elles doivent être nord en haut.
import sys, os, json, cv2, numpy as np
from scipy.interpolate import RBFInterpolator, griddata
ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
DET = os.path.join(ICI, 'detail')
REGIONS = {'haute-foret': (385, 0, 850, 415), 'cormyr': (830, 180, 1160, 610)}   # cadres, en unités de carte
NOM = sys.argv[1]
S = json.load(open(os.path.join(DET, NOM + '-sources.json')))
X0, Y0, X1, Y1 = REGIONS[NOM]; PX = 5          # pixels par unité
W, H = (X1 - X0) * PX, (Y1 - Y0) * PX

def en_carte(p):
    if p['vue'] == 'carte': return np.array(p['pts'], float)
    v = S['vues'][p['vue']]; (ox, oy), k = v['origine'], v['px_par_unite']
    return np.array([(ox + x / k, oy + y / k) for x, y in p['pts']], float)

def px(P): return np.round((np.asarray(P) - (X0, Y0)) * PX).astype(np.int32)

# ------------------------------------------------------------ carte des classes
cls = np.zeros((H, W), np.uint8)
zone = np.zeros((H, W), np.uint8); cv2.fillPoly(zone, [px(S['zone'])], 1)
cls[zone == 1] = 1
for c in (6, 3, 5, 2, 0):
    for p in S['polygones']:
        if p['classe'] == c: cv2.fillPoly(cls, [px(en_carte(p))], c)
cls[zone == 0] = 0
cv2.imwrite(os.path.join(DET, NOM + '.png'), cls)
print('classes', {int(k): int(v) for k, v in zip(*np.unique(cls, return_counts=True))})

# ------------------------------------------------------------ rivières et routes (photo)
if len(sys.argv) > 2:
    from vecto import vectoriser
    im = cv2.imread(sys.argv[2])
    cal = S['calage']
    Pp = np.array([v['photo'] for v in cal.values()], float); Pc = np.array([v['carte'] for v in cal.values()], float)
    fwd = RBFInterpolator(Pp, Pc, kernel='thin_plate_spline', smoothing=0, degree=1)
    h, w = im.shape[:2]
    gx, gy = np.meshgrid(np.arange(0, w + 1, 8), np.arange(0, h + 1, 8))
    G = np.c_[gx.ravel(), gy.ravel()].astype(float); FG = fwd(G)
    u, v = np.meshgrid(X0 + (np.arange(W) + .5) / PX, Y0 + (np.arange(H) + .5) / PX)
    mx = np.nan_to_num(griddata(FG, G[:, 0], (u, v), method='linear'), nan=-1).astype(np.float32)
    my = np.nan_to_num(griddata(FG, G[:, 1], (u, v), method='linear'), nan=-1).astype(np.float32)
    R = cv2.remap(im, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(255, 255, 255))
    dedans = cv2.erode(zone, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31))) > 0
    g = cv2.cvtColor(R, cv2.COLOR_BGR2GRAY).astype(np.float32)
    fond = cv2.GaussianBlur(cv2.dilate(g, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))), (0, 0), 5)
    bh = cv2.morphologyEx(g, cv2.MORPH_BLACKHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
    noir = (g < 0.55 * fond) & (bh > 28) & dedans
    B, G_, Rr = [R[..., i].astype(np.float32) for i in range(3)]
    bleu = ((B - Rr) > -8) & ((G_ - Rr) > -12) & (g < 0.92 * fond) & dedans & (cls != 6)
    def carte(P): return [[round(X0 + x / PX, 2), round(Y0 + y / PX, 2)] for x, y in P]
    Z = np.array(S['zone'], np.float32)
    def bord(P):  # trait qui longe le bord de la photo (ombre du papier) : on l'écarte
        Q = np.asarray(P, float) / PX + (X0, Y0)
        return max(cv2.pointPolygonTest(Z, (float(x), float(y)), True) for x, y in Q) < 14
    out = {'_': "Rivières et routes relevées automatiquement sur la carte régionale (photo d'Antoine) ; voir region_officielle.py.",
           'rivieres': [], 'routes': []}
    from vecto import fusionner
    riv = [P for P in vectoriser(bleu, lier=3, lmin=80, eperon=25, simpl=2.0, fermer=5) if not bord(P)]
    riv = fusionner(riv, 9 * PX)   # les noms coupent les rivières : on recoud les bouts proches
    for P in riv:
        L = np.linalg.norm(np.diff(P, axis=0), axis=1).sum() / PX
        out['rivieres'].append({'nom': '', 'ep': 1.1 if L > 60 else 0.85, 'pts': carte(P)})
    rts = [P for P in vectoriser(noir, lier=3, lmin=110, eperon=30, simpl=2.0, fermer=3) if not bord(P)]
    for P in fusionner(rts, 6 * PX):
        out['routes'].append({'nom': '', 'niv': 3, 'pts': carte(P)})
    out['chemins'] = [{'nom': c['nom'], 'niv': 4, 'pts': c['pts']} for c in S.get('chemins', [])]
    json.dump(out, open(os.path.join(DET, NOM + '.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    cv2.imwrite(f'/tmp/{NOM}_redresse.jpg', R, [cv2.IMWRITE_JPEG_QUALITY, 85])
    print('rivières', len(out['rivieres']), 'routes', len(out['routes']))
