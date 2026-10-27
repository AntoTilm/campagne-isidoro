# Géographie de Faerûn : masque terre/mer corrigé, d'après la carte des dons régionaux (photo redressée).
# Coordonnées : repère de la photo redressée, 1600 x 1200 ; cadre utile x 15..1585, y 40..1168.
import cv2, numpy as np, os
ICI = os.path.dirname(os.path.abspath(__file__))

CADRE = (15, 40, 1585, 1168)

LACS = {  # lacs intérieurs conservés : un point dans chacun
    'mer-de-lune': (800, 160), 'ashane': (1340, 170), 'thazar': (1405, 310),
    'wyvernwater': (684, 368), 'esmel': (494, 610), 'akanamere': (1075, 600), 'unther': (1430, 735),
}

MER_DE_LUNE = [(712,160),(735,146),(770,141),(810,139),(850,131),(885,123),(910,128),(935,140),(940,154),(922,165),(896,170),(870,181),(845,180),(820,172),(790,178),(760,183),(730,178)]

def tache(cx, cy, rx, ry, rot=0, seed=0, n=40, rugo=.28):
    rng = np.random.default_rng(seed)
    a = np.linspace(0, 2*np.pi, n, endpoint=False)
    r = np.ones(n)
    for k, amp in [(2, rugo*.9), (3, rugo*.7), (5, rugo*.45), (8, rugo*.3)]:
        r += amp * np.sin(k*a + rng.uniform(0, 6.3))
    r = np.maximum(r, .35)
    x, y = rx*r*np.cos(a), ry*r*np.sin(a)
    c, s_ = np.cos(rot), np.sin(rot)
    return [(cx + c*xx - s_*yy, cy + s_*xx + c*yy) for xx, yy in zip(x, y)]

ILES = [
    # Moonshae : Gwynneth, Alaron, Moray, Norland, Snowdown, Oman
    tache(146, 486, 15, 36, .35, 1, rugo=.32), tache(140, 590, 22, 30, -.5, 2, rugo=.3), tache(160, 650, 9, 7, 0, 3),
    tache(147, 431, 7, 9, .2, 4), tache(188, 606, 7, 6, 0, 5), tache(99, 543, 7, 9, .4, 6),
    # Nélanthères
    tache(190, 702, 8, 5, .3, 11), tache(226, 721, 9, 6, -.2, 12), tache(258, 696, 6, 7, 0, 13), tache(214, 744, 7, 5, .5, 14),
    tache(193, 665, 6, 4, 0, 15), tache(246, 750, 5, 4, 0, 16), tache(166, 726, 5, 4, 0, 17), tache(276, 730, 5, 6, 0, 18),
    # Lantan
    tache(163, 845, 24, 45, -.35, 21, rugo=.25), tache(110, 843, 5, 4, 0, 22), tache(211, 903, 5, 4, 0, 23),
    # îles des Pirates (mer des Étoiles Déchues)
    tache(974, 407, 8, 5, .3, 31), tache(998, 425, 7, 5, 0, 32), tache(956, 432, 5, 4, 0, 33), tache(1032, 410, 5, 4, 0, 34),
]

def masque_eau():
    eau = (cv2.imread(os.path.join(ICI, 'eau-photo.png'), cv2.IMREAD_GRAYSCALE) > 127).astype(np.uint8)
    poly = lambda pts, v: cv2.fillPoly(eau, [np.array(pts, np.int32)], v)
    trait = lambda pts, v, e: cv2.polylines(eau, [np.array(pts, np.int32)], False, v, e)
    # mer des Épées au nord-ouest et bord ouest (vignettage de la photo)
    poly([(0,0),(25,0),(36,22),(52,40),(58,62),(72,78),(76,96),(88,110),(92,132),(101,150),(100,170),(80,185),(0,185)], 1)
    poly([(0,100),(72,100),(76,400),(72,800),(78,1200),(0,1200)], 1)
    # Mer de Lune refaite à la main
    poly([(700,110),(950,110),(950,200),(700,200)], 0)
    poly(MER_DE_LUNE, 1)
    # Lac des Dragons relié à la mer, Bief de Vilhon continu jusqu'à la mer
    trait([(815,412),(850,412),(885,420)], 1, 16)
    poly([(885,495),(965,495),(1000,535),(960,560),(900,548)], 0)
    cv2.circle(eau,(982,522),17,1,-1)
    trait([(1000,505),(985,520),(965,548),(930,572),(895,592),(860,612),(825,625),(790,630),(745,626),(700,618),(684,612)], 1, 22)
    # médaillon de la boussole (dans la mer Étincelante)
    poly([(398,958),(440,945),(485,965),(495,1005),(470,1040),(430,1045),(400,1020)], 1)
    # passe du Lac de Vapeur vers la mer Étincelante
    trait([(722,850),(733,875),(742,905)], 1, 38)
    # côte sud-est (Luiren et la Grande Mer) redessinée
    poly([(1440,600),(1600,600),(1600,1200),(1290,1200),(1290,1060),(1440,960)], 0)
    poly([(1290,1200),(1295,1108),(1306,1102),(1318,1090),(1332,1088),(1345,1072),(1368,1070),(1392,1062),(1418,1058),(1440,1050),(1452,1036),(1468,1022),(1471,1004),(1482,985),(1494,970),(1498,948),(1512,930),(1520,905),(1536,894),(1548,872),(1562,858),(1568,832),(1580,818),(1585,800),(1600,790),(1600,1200)], 1)
    # lacs dessinés à la main
    poly([(1290,95),(1305,85),(1318,100),(1325,130),(1345,150),(1365,160),(1385,175),(1388,200),(1370,212),(1350,200),(1330,185),(1312,175),(1300,150),(1292,120)], 1)
    poly([(668,358),(685,352),(700,360),(698,378),(682,386),(668,376)], 1)
    poly([(480,605),(495,598),(510,604),(506,618),(490,622)], 1)
    # anse parasite (étiquette « Lac de vapeur » de la photo) au nord du lac
    poly([(757,762),(800,760),(806,786),(792,797),(770,795),(757,786)], 0)
    poly([(742,770),(760,760),(764,792),(746,790)], 0)
    # cadre : terre sur les bords hors photo
    poly([(0,0),(1600,0),(1600,38),(0,38)], 0)
    poly([(0,380),(262,380),(262,770),(0,770)], 1); poly([(60,770),(195,770),(195,900),(60,900)], 1)  # archipels refaits
    for il in ILES: poly(il, 0)
    # composantes : on garde l'océan (touchant le bord ouest) et les lacs nommés
    n, lbl = cv2.connectedComponents(eau, 8)
    garde = {lbl[600, 20]}
    for (x, y) in LACS.values():
        if lbl[y, x]: garde.add(lbl[y, x])
    # les mers intérieures : la mer des Étoiles Déchues (un point au large)
    for (x, y) in [(1000, 380), (760, 840), (1450, 1100)]:
        if lbl[y, x]: garde.add(lbl[y, x])
    eau = np.isin(lbl, list(garde)).astype(np.uint8)
    # petits îlots parasites
    n, lbl, st, _ = cv2.connectedComponentsWithStats(1 - eau, 8)
    for k in range(1, n):
        if st[k, cv2.CC_STAT_AREA] < 30: eau[lbl == k] = 1
    return eau

