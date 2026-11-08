# Fond de la carte de Faerûn

Ces scripts dessinent le fond illustré de `carte.html` (côtes, fleuves, forêts, jungles, montagnes, désert, décor), le calque des routes et le découpent en tuiles.
Les **noms et les lieux** ne sont pas ici : ils sont dans `src/contenu/pages/carte.html` et se modifient comme le reste du contenu.

- `reference.png` : la carte de Faerûn en version française fournie par Antoine. Tout le tracé général en est tiré.
- `geo.py` : lit la référence et en tire les masques (mer, fleuves, forêts, jungles, montagnes, désert), en effaçant les dessins posés sur la mer (poissons volants, galion, ancre, serpent, légende).
- `detail/` : les régions redessinées d'après des cartes plus précises, qui remplacent la référence dans leur cadre.
  - `regions.json` : pour chaque région, sa carte de classes (0 hors zone, 1 terre, 2 eau, 3 forêt, 4 forêt du sud, 5 montagnes, 6 désert ; `montagnes: true` quand la région fournit ses propres montagnes), son cadre, le cadre du niveau de tuiles 5 (`zoom`) et la zone où les glyphes sont deux fois plus petits (`glyphes_fins`).
  - `lac-vapeur.png` et `lac-vapeur.json` : le Lac de Vapeur d'après la carte imprimée photographiée par Antoine (côtes, forêts, Route dorée, pistes, la Scelptar). La photo elle-même n'est pas dans le dépôt.
  - `rive-nord-sources.json` : les points de calage et les noms relevés sur les cartes dessinées par le MJ (la rive nord, et les comtés du Clos, de Bridgestone, d'Arsogne, de Saelmur et de Mintar).
  - `rive-nord.json` : produit par `rive_nord.py` (rivières, ruisseaux, routes, sentiers, frontières, lisières, bois et lieux, en unités de carte).
  - `haute-foret-sources.json`, `haute-foret.png`, `haute-foret.json` : la Haute-Forêt, le Nord et la lisière de l'Anauroch jusqu'à Evereska, d'après la carte régionale officielle photographiée par Antoine (points de calage, polygones des forêts, montagnes, eaux et désert relevés à la main ; rivières et routes relevées sur la photo).
  - `cormyr-sources.json`, `cormyr.png`, `cormyr.json` : le Cormyr, les Vaux, le Cormanthor et la Mer de Lune, de même.
- `region_officielle.py` : régénère la carte des classes d'une de ces régions depuis ses sources (`python3 src/carte/region_officielle.py haute-foret`), et, si on lui donne la photo (nord en haut), ses rivières et routes (`python3 src/carte/region_officielle.py cormyr PHOTO.jpg`). Les photos des cartes imprimées ne sont pas dans le dépôt.
- `vecto.py` : outils de vectorisation des cartes dessinées à la main (couleur → squelette → tracés lissés).
- `rive_nord.py` : vectorise les photos des cartes du MJ et les recale sur la carte (`python3 src/carte/rive_nord.py DOSSIER_DES_PHOTOS`, photos `m1_rive_nord.jpg`, `c_clos.jpg`, `c_bridgestone.jpg`, `c_arsogne.jpg`, `c_saelmur.jpg`, `c_mintar.jpg`).
- `rendu.py` : produit `faerun.svg` (sans texte), dans le style parchemin.
- `traces.py` : produit `assets/carte/traces.svg`, le calque vectoriel (routes, sentiers, ruisseaux, frontières, bois) posé sur les tuiles ; chaque tracé porte la classe du niveau de zoom où il apparaît (`n3` à `n6`).
- `tuiles.py` : produit `assets/carte/tuiles/` (niveaux 1 à 3 sur toute la carte, 4 sur les régions détaillées, 5 sur les comtés ; tuiles de 512 px) et `assets/carte/faerun-apercu.webp`. Recopier ensuite le contenu de `assets/carte/tuiles/index.json` dans l'attribut `data-niveaux` de `carte.html`.

Régénérer (Python 3 avec opencv-python, numpy, scipy, scikit-image, Pillow et playwright + Chromium) :

```
python3 src/carte/rendu.py
python3 src/carte/traces.py
python3 src/carte/tuiles.py
```

Repère des lieux (`data-x`, `data-y`) : 1,5 unité par pixel de `reference.png`, soit un cadre de 1585 × 1194. Pour placer un lieu, repérer son point sur la référence et multiplier ses coordonnées par 1,5. Les lieux des comtés sont dans `detail/rive-nord.json` (champ `lieux`).
