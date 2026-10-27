# Géographie de Faerûn d'après la carte VF (poster) : masques mer, forêts, jungles, montagnes, désert, fleuves.
# Repère : pixels de la carte de référence (reference.png) × ECH (1057 × 796 → 1585 × 1194).
import cv2, numpy as np, os
ICI = os.path.dirname(os.path.abspath(__file__))
ECH = 1.5
CADRE = (0, 0, 1585, 1194)

DECORS = [  # dessins et légende posés sur la mer dans la carte de référence (repère de la référence)
    (85, 385, 182, 478), (130, 82, 218, 168), (16, 660, 122, 784), (50, 505, 105, 640), (350, 680, 530, 760), (543, 700, 578, 778),
]

def classes():
    im = cv2.imread(os.path.join(ICI, 'reference.png'))
    b0, g0, r0 = [c.astype(int) for c in cv2.split(im)]
    sombre = np.maximum(np.maximum(r0, g0), b0) < 85
    m = cv2.dilate(sombre.astype(np.uint8) * 255, np.ones((3, 3), np.uint8))
    clean = cv2.inpaint(im, m, 4, cv2.INPAINT_TELEA)
    b, g, r = [c.astype(int) for c in cv2.split(cv2.GaussianBlur(clean, (0, 0), 1.0))]
    eau = ((b > 170) & (b - r > 80)) | ((b > 120) & (b - r > 90))
    desert = (r > 215) & (g > 205) & (b < 195) & (r - b > 45)
    vert = (g > r + 12) & (g > b + 12)
    mont = ((r - b > 32) & ~desert & ~vert) | ((r < 120) & (g < 115) & (r >= b) & ~eau)
    foret = (~eau) & (~desert) & (~vert) & (~mont) & (b >= r - 6) & (g - r > 6) & (np.maximum(np.maximum(r, g), b) < 215)
    for (x0, y0, x1, y1) in DECORS:
        eau[y0:y1, x0:x1] = True
        for t in (desert, vert, mont, foret): t[y0:y1, x0:x1] = False
    return eau, foret, vert, mont, desert

def nettoie(mask, minarea, ouvre=0, ferme=0):
    m = mask.astype(np.uint8)
    if ouvre: m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (ouvre, ouvre)))
    if ferme: m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (ferme, ferme)))
    n, lbl, st, _ = cv2.connectedComponentsWithStats(m, 8)
    keep = np.zeros(n, bool); keep[1:] = st[1:, cv2.CC_STAT_AREA] >= minarea
    return keep[lbl].astype(np.uint8)

def geographie():
    eau, foret, vert, mont, desert = classes()
    eau = eau.astype(np.uint8)
    # étendues d'eau (mers, lacs) sans les fleuves fins ; les fleuves à part
    larges = cv2.morphologyEx(eau, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (4, 4)))
    larges = nettoie(larges, 6)
    fleuves = (eau & (1 - cv2.dilate(larges, np.ones((3, 3), np.uint8)))).astype(np.uint8)
    fleuves = nettoie(fleuves, 12)
    terre = nettoie(1 - larges, 4)          # îlots minuscules : mer
    eau = (1 - terre).astype(np.uint8)
    z = {
        'montagne': nettoie(mont & terre, 10, ouvre=2, ferme=3),
        'resineux': nettoie(foret & terre, 12, ouvre=2, ferme=3),
        'jungle': nettoie(vert & terre, 8, ferme=3),
        'desert': nettoie(desert & terre, 30, ferme=5),
    }
    return eau, fleuves, z
