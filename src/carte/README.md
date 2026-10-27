# Fond de la carte de Faerûn

Ces scripts dessinent le fond illustré de `carte.html` (côtes, fleuves, forêts, jungles, montagnes, désert, décor) puis le découpent en tuiles.
Les **noms et les lieux** ne sont pas ici : ils sont dans `src/contenu/pages/carte.html` et se modifient comme le reste du contenu.

- `reference.png` : la carte de Faerûn en version française fournie par Antoine. Tout le tracé en est tiré.
- `geo.py` : lit la référence et en tire les masques (mer, fleuves, forêts, jungles, montagnes, désert), en effaçant les dessins posés sur la mer (poissons volants, galion, ancre, serpent, légende).
- `rendu.py` : produit `faerun.svg` (sans texte), dans le style parchemin.
- `tuiles.py` : produit `assets/carte/tuiles/` (niveaux 1 à 4, 512 px ; le niveau 4 seulement autour du Lac de Vapeur) et `assets/carte/faerun-apercu.webp`.

Régénérer (Python 3 avec opencv-python, numpy, scikit-image, Pillow et playwright + Chromium) :

```
python3 src/carte/rendu.py
python3 src/carte/tuiles.py
```

Repère des lieux (`data-x`, `data-y`) : 1,5 unité par pixel de `reference.png`, soit un cadre de 1585 × 1194. Pour placer un lieu, repérer son point sur la référence et multiplier ses coordonnées par 1,5.
