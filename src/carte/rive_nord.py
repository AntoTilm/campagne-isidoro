# Rive nord du Lac de Vapeur : vectorise les cartes du MJ (comtés) et les cale dans le repère du site.
# Entrée : detail/rive-nord-sources.json (points de calage, tracés et lieux relevés à la main) + photos des cartes du MJ.
# Sortie : detail/rive-nord.json (unités de carte).
# usage : python3 src/carte/rive_nord.py DOSSIER_DES_PHOTOS
import sys, os, json, numpy as np, cv2
from scipy.interpolate import RBFInterpolator
ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
from vecto import vectoriser, fusionner, classes_couleur

SRC = json.load(open(os.path.join(ICI, 'detail', 'rive-nord-sources.json')))
PHOTOS = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ICI, 'sources')

def tps(calage, lissage=0.0):
    a = np.array([c[1] for c in calage], float); b = np.array([c[2] for c in calage], float)
    return RBFInterpolator(a, b, kernel='thin_plate_spline', smoothing=lissage)

def lisse(calage, degre=2, lissage=30.0):
    """Transformation douce : polynôme ajusté aux moindres carrés, puis petite correction en plaque mince."""
    a = np.array([c[1] for c in calage], float); b = np.array([c[2] for c in calage], float)
    def base(P):
        x, y = P[:, 0] / 1000, P[:, 1] / 1000
        cols = [np.ones_like(x), x, y] + ([x * x, x * y, y * y] if degre >= 2 else [])
        return np.stack(cols, 1)
    M, *_ = np.linalg.lstsq(base(a), b, rcond=None)
    r = RBFInterpolator(a, b - base(a) @ M, kernel='thin_plate_spline', smoothing=lissage)
    return lambda P: base(np.atleast_2d(P)) @ M + r(np.atleast_2d(P))

m1_vers_carte = lisse([c for c in SRC['m1']['calage'] if not c[0].startswith(('haut du', 'Bain Épineux (amont', 'nord-ouest'))], 2, 0.5)
def chaine(f):
    return lambda P: m1_vers_carte(f(np.asarray(P, float)))

out = {k: [] for k in ('rivieres', 'ruisseaux', 'routes', 'chemins', 'frontieres', 'lisieres', 'bois', 'marais', 'lieux')}
def ajoute(couche, pts, nom='', comte='', extra=None):
    P = [[round(float(x), 2), round(float(y), 2)] for x, y in pts]
    d = {'nom': nom, 'comte': comte, 'pts': P}
    if extra: d.update(extra)
    out[couche].append(d)

# --- m1 : tracés relevés à la main
for couche in ('rivieres', 'routes', 'chemins', 'frontieres'):
    for nom, pts in SRC['m1'].get(couche, []):
        ajoute(couche, m1_vers_carte(np.array(pts, float)), nom, 'm1')
for nom, typ, p in SRC['m1']['lieux']:
    q = m1_vers_carte(np.array([p], float))[0]
    out['lieux'].append({'nom': nom, 'type': typ, 'x': round(float(q[0]), 1), 'y': round(float(q[1]), 1), 'comte': ''})

# --- comtés : vectorisation des couleurs
REGLES = {
 # comte : options de vectorisation par classe
 'clos': {}, 'bridgestone': {'minta': True}, 'arsogne': {}, 'saelmur': {'points_bruns_frontieres': True, 'pas_de_bleu_plein': True},
 'mintar': {'pas_de_bleu_plein': True},
}
for comte, opt in REGLES.items():
    S = SRC[comte]
    chemin = os.path.join(PHOTOS, S['photo'])
    if not os.path.exists(chemin):
        print('photo absente :', chemin); continue
    im = cv2.imread(chemin)
    f = chaine(tps(S['calage'], 2.0))
    c = classes_couleur(im)
    # composantes : longues (traits pleins) / courtes (pointillés, tirets)
    def separer(m, seuil):
        n, lbl, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 8)
        longue = np.zeros(n, bool); longue[1:] = np.maximum(st[1:, cv2.CC_STAT_WIDTH], st[1:, cv2.CC_STAT_HEIGHT]) >= seuil
        courte = np.zeros(n, bool); courte[1:] = ~longue[1:] & (st[1:, cv2.CC_STAT_AREA] >= 8) & (st[1:, cv2.CC_STAT_AREA] <= 900)
        return longue[lbl], courte[lbl]
    brun_l, brun_c = separer(c['brun'], 160)
    bleu_l, bleu_c = separer(c['bleu'], 170)
    noir_l, noir_c = separer(c['noir'], 99999)
    for P in vectoriser(brun_l, lmin=80, fermer=5): ajoute('routes', f(P), '', comte)
    for P in vectoriser(brun_c, lier=46, lmin=90): ajoute('frontieres' if opt.get('points_bruns_frontieres') else 'chemins', f(P), '', comte)
    for P in vectoriser(noir_c, lier=62, lmin=120): ajoute('frontieres', f(P), '', comte)
    for P in vectoriser(bleu_c, lier=44, lmin=70): ajoute('ruisseaux', f(P), '', comte)
    if not opt.get('pas_de_bleu_plein') and not opt.get('minta'):
        for P in vectoriser(bleu_l, lmin=120, fermer=5): ajoute('rivieres', f(P), '', comte)
    for P in vectoriser(c['vert_fonce'], lmin=120, fermer=5): ajoute('lisieres', f(P), '', comte)
    # bois : contours clairs fermés
    vc = cv2.morphologyEx(c['vert_clair'].astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)))
    cs, _ = cv2.findContours(vc, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for k in cs:
        if cv2.contourArea(k) < 2500: continue
        P = cv2.approxPolyDP(k, 4, True)[:, 0, :].astype(float)
        ajoute('bois', f(P), '', comte)
    for nom, typ, p in S['lieux']:
        q = f(np.array([p], float))[0]
        out['lieux'].append({'nom': nom, 'type': typ, 'x': round(float(q[0]), 1), 'y': round(float(q[1]), 1), 'comte': comte})
    print(comte, {k: len(v) for k, v in out.items()})

# --- doublons : un trait de comté qui suit un tracé de la carte d'ensemble (routes, rivières) est retiré
def echantillon(P, pas=0.5):
    P = np.asarray(P, float); out_ = [P[0]]
    for a, b in zip(P[:-1], P[1:]):
        n = max(1, int(np.hypot(*(b - a)) / pas)); out_ += [a + (b - a) * t for t in np.linspace(0, 1, n + 1)[1:]]
    return np.array(out_)
for couche, tol in (('routes', 2.2), ('rivieres', 2.5)):
    ref = [echantillon(f['pts']) for f in out[couche] if f['comte'] == 'm1']
    if not ref: continue
    R = np.vstack(ref)
    garde = []
    for f in out[couche]:
        if f['comte'] == 'm1': garde.append(f); continue
        E_ = echantillon(f['pts'], 1.0)
        d = np.sqrt(((E_[:, None, :] - R[None, :, :]) ** 2).sum(-1)).min(1)
        if (d < tol).mean() < 0.6: garde.append(f)
    out[couche] = garde
for f in out['rivieres']:
    if f['comte'] == 'm1': f['ep'] = 1.25 if f['nom'] else 0.9
json.dump(out, open(os.path.join(ICI, 'detail', 'rive-nord.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('ok')
