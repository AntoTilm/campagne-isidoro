# Calque vectoriel de la carte : routes, pistes, frontières de comtés, ruisseaux, bois, lisières.
# Lit detail/*.json (sauf regions.json et *-sources.json) et écrit assets/carte/traces.svg.
# Chaque trait porte la classe de son niveau de zoom minimal (n2 … n6) ; le style est dans assets/css/carte.css.
import os, json, numpy as np
ICI = os.path.dirname(os.path.abspath(__file__))
DET = os.path.join(ICI, 'detail')
SORTIE = os.path.join(ICI, '..', '..', 'assets', 'carte', 'traces.svg')
COUCHES = [  # couche du json, classe, niveau minimal, fermée
    ('bois', 'tr-bois', 5, True), ('lisieres', 'tr-lisiere', 5, False), ('marais', 'tr-marais', 5, True),
    ('frontieres', 'tr-frontiere', 4, False), ('ruisseaux', 'tr-ruisseau', 5, False),
    ('chemins', 'tr-chemin', 3, False), ('routes', 'tr-route', 2, False),
]
def lisse(P, ferme):
    P = np.asarray(P, float)
    if len(P) < 3: return P
    for _ in range(2):
        A = np.vstack([P, P[:1]]) if ferme else P
        Q = [] if ferme else [P[0]]
        for a, b in zip(A[:-1], A[1:]): Q += [0.75 * a + 0.25 * b, 0.25 * a + 0.75 * b]
        if not ferme: Q.append(P[-1])
        P = np.array(Q)
    return P
def d_(P, ferme):
    return 'M' + ' '.join(f'{x:.2f},{y:.2f}' for x, y in P) + ('Z' if ferme else '')
groupes = {c[0]: [] for c in COUCHES}
for f in sorted(os.listdir(DET)):
    if not f.endswith('.json') or f == 'regions.json' or f.endswith('-sources.json'): continue
    data = json.load(open(os.path.join(DET, f)))
    for couche, classe, niv, ferme in COUCHES:
        for t in data.get(couche, []):
            if len(t['pts']) < 2: continue
            n = t.get('niv', niv)
            # les routes et pistes des comtés n'apparaissent qu'au zoom des comtés
            if couche in ('routes', 'chemins') and t.get('comte') not in (None, '', 'm1'): n = max(n, 4)
            groupes[couche].append(f'<path class="{classe} n{n}" d="{d_(lisse(t["pts"], ferme), ferme)}"/>')
svg = ['<svg xmlns="http://www.w3.org/2000/svg" class="carte__traces" viewBox="0 0 1585 1194" width="1585" height="1194" aria-hidden="true">']
for couche, *_ in COUCHES:
    svg.append(f'<g class="g-{couche}">' + ''.join(groupes[couche]) + '</g>')
svg.append('</svg>')
open(SORTIE, 'w').write('\n'.join(svg))
print('traces', {k: len(v) for k, v in groupes.items()}, os.path.getsize(SORTIE) // 1024, 'Ko')
