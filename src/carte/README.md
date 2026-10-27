# Fond de la carte de Faerûn

Ces scripts dessinent le fond illustré de `carte.html` (côtes, reliefs, forêts, fleuves, décor) puis le découpent en tuiles.
Les **noms et les lieux** ne sont pas ici : ils sont dans `src/contenu/pages/carte.html` et se modifient comme le reste du contenu.

- `eau-photo.png` : masque mer/terre tiré de la photo de la carte des dons régionaux (redressée, repère 1600 × 1200).
- `geo.py` : corrections à la main du masque (mers intérieures, îles, lacs).
- `terrain.py` : forêts, montagnes, collines, déserts, landes, marais et fleuves (polygones dans le même repère).
- `rendu.py` : produit `faerun.svg` (sans texte).
- `tuiles.py` : produit `assets/carte/tuiles/` (niveaux 1 à 4, 512 px) et `assets/carte/faerun-apercu.webp`.

Régénérer (Python 3 avec opencv-python, numpy, Pillow et playwright + Chromium) :

```
python3 src/carte/rendu.py
python3 src/carte/tuiles.py
```

Le repère des lieux (`data-x`, `data-y`) est celui de ces scripts : le cadre de la carte va de x = 15 à 1585 et de y = 40 à 1168.
