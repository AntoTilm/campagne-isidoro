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

### Le point de vue (qui sait quoi)

Le sélecteur « Point de vue » du bandeau (Isidoro, Théodoric, Monde, Tout) masque ce que le personnage choisi n'est pas censé savoir. Rien n'est supprimé : la vue « Tout » montre tout. Sans étiquette, une information est commune.

- Une page entière : `savoir: theodoric` dans l'en-tête `---`.
- Une section : `## Titre {@isidoro}` (jusqu'au titre suivant de même niveau).
- Une ligne de tableau, un élément de liste ou un paragraphe : `{@theodoric}` en fin de ligne ; plusieurs : `{@isidoro @theodoric}`.
- Un encadré : `::: hors-jeu {@mj}` ; un bloc neutre : `::: bloc {@mj}`.
- Un bout de phrase : `<span data-savoir="theodoric">…</span>` (et `data-savoir="…"` dans les pages HTML).

Valeurs : `isidoro`, `theodoric`, `mj` (la vue « Monde » : MJ, hors-jeu, recoupements).

Quand Isidoro apprendra une information jusque-là réservée à Théodoric (par exemple en récupérant les documents des Lames de Tymora), il faut ajouter `@isidoro` aux étiquettes concernées : `savoir: theodoric isidoro` pour un document entier, `{@theodoric @isidoro}` pour une ligne. Rien n'est à réécrire, seulement à réétiqueter.

### Mots-clés cachés de la recherche

`src/contenu/mots-cles.txt` ajoute des mots invisibles sur le site mais trouvés par la recherche : synonymes, termes VO, questions (« combien d'or », « level up »), fautes de dictée (« Akampour », « Timora »). Le mode d'emploi est en tête du fichier. Les mots-clés respectent le point de vue ; à compléter à chaque nouvelle séance.

### Rubriques

Quatre rubriques : Journal (journal, documents), Séances (prochaine séance, résumés de séance), Le monde (personnages, lieux, chronologie, recoupements), Isidoro (fiche, progression, règles). Une page choisit sa rubrique avec `rubrique:` dans son en-tête ; les onglets sont définis en haut de `src/build.mjs`.

Pour ajouter une séance : créer `src/contenu/seances/aventure-3.md` (avec `ordre: 3`), faire de même dans `journal/`, mettre à jour « Où nous en sommes » dans `src/contenu/pages/index.html`, le pense-bête `src/contenu/pages/prochaine-seance.md` et la chronologie, puis lancer le script.

## Structure

- `assets/css`, `assets/js` : style et recherche ; `assets/js/recherche-index.js` est généré
- `assets/img` : cartes, plans, fiche du personnage, photos du Manuel des Joueurs
- `assets/pdf` : documents d'origine (polices allégées, texte identique)
- `assets/fonts` : IM Fell English, Spectral et Spectral SC (licence SIL OFL)
- `pages/le-persistant.html` : le guide de build « Le Persistant » d'origine, repris en entier dans la page `progression.html`

## À savoir

Le dépôt contient des photos de pages du Manuel des Joueurs et une impression du bestiaire de gemmaline.com : à garder privé si le dépôt est publié en ligne.
