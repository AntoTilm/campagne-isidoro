# Le Registre d'Isidoro

Site de la campagne D&D 3.5 d'Isidoro, prêtre cloîtré de Lathandre, au Lac de Vapeur (Royaumes Oubliés) : séances, journal, documents de campagne, personnages, lieux, fiche du personnage et règles.

## Utilisation

Ouvrir `index.html` dans un navigateur : aucun serveur ni connexion n'est nécessaire. Les polices sont embarquées dans `assets/fonts`, la recherche (touche `/`) fonctionne hors ligne.

## Mettre le site à jour

Le contenu se modifie dans `src/contenu`, puis on régénère les pages :

```
node src/build.mjs
```

Node 18 ou plus, sans aucune dépendance.

- `src/contenu/seances/*.md` : résumés de séance, publiés dans `seances/`
- `src/contenu/journal/*.md` : journal d'Isidoro, publié dans `journal/`
- `src/contenu/documents/*.md` : documents de campagne, publiés dans `documents/`
- `src/contenu/pages/*` : pages d'accueil et de référence (chronologie, personnages, lieux, Isidoro, recoupements, règles)

Chaque fichier commence par un en-tête `---` (titre, sous-titre, ordre, résumé…). Dans le texte, trois encadrés sont disponibles :

```
::: vision
Un futur possible vu dans les vasques.
:::

::: hors-jeu
Ce que savent les joueurs, pas les personnages.
:::

::: note
Une remarque.
:::
```

Pour ajouter une séance : créer `src/contenu/seances/aventure-3.md` (avec `ordre: 3`), faire de même dans `journal/`, mettre à jour « Où nous en sommes » dans `src/contenu/pages/index.html` et la chronologie, puis lancer le script.

## Structure

- `assets/css`, `assets/js` : style et recherche ; `assets/js/recherche-index.js` est généré
- `assets/img` : cartes, plans, fiche du personnage, photos du Manuel des Joueurs
- `assets/pdf` : documents d'origine (polices allégées, texte identique)
- `assets/fonts` : IM Fell English, Spectral et Spectral SC (licence SIL OFL)
- `pages/le-persistant.html` : le guide de build « Le Persistant »

## À savoir

Le dépôt contient des photos de pages du Manuel des Joueurs et une impression du bestiaire de gemmaline.com : à garder privé si le dépôt est publié en ligne.
