// Génère le site du Registre d'Isidoro à partir de src/contenu.
// Usage : node src/build.mjs   (aucune dépendance, Node 18 ou plus)
//
//   src/contenu/pages/*.html       fragments HTML (accueil, personnages, lieux…)
//   src/contenu/seances/*.md       résumés de séance        -> seances/<nom>.html
//   src/contenu/journal/*.md       journal d'Isidoro        -> journal/<nom>.html
//   src/contenu/documents/*.md     documents de campagne    -> documents/<nom>.html
//
// Chaque fichier commence par un en-tête « --- clé: valeur --- ».

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENU = join(RACINE, 'src', 'contenu');

// Cinq rubriques dans la barre de navigation ; chacune peut avoir des onglets.
const RUBRIQUES = {
  journal: { lien: 'journal.html', titre: 'Journal', onglets: [['journal.html', "Journal d'Isidoro"], ['documents.html', 'Documents de Théodoric']] },
  prochaine: { lien: 'prochaine-seance.html', titre: 'Prochaine séance', onglets: [['prochaine-seance.html', 'Pense-bête'], ['recoupements.html', 'Recoupements']] },
  seances: { lien: 'seances.html', titre: 'Séances', onglets: [] },
  monde: { lien: 'personnages.html', titre: 'Le monde', onglets: [['personnages.html', 'Personnages'], ['lieux.html', 'Lieux et cartes'], ['chronologie.html', 'Chronologie']] },
  isidoro: { lien: 'isidoro.html', titre: 'Isidoro', onglets: [['isidoro.html', 'Fiche'], ['progression.html', 'Progression'], ['regles.html', 'Règles']] },
};

const COLLECTIONS = {
  seances: { titre: 'Séances', index: 'seances.html', rubrique: 'seances' },
  journal: { titre: "Journal d'Isidoro", index: 'journal.html', rubrique: 'journal' },
  documents: { titre: 'Documents de Théodoric', index: 'documents.html', rubrique: 'journal' },
};

// ---------------------------------------------------------------- savoir (filtre « point de vue »)
// Chaque information peut être étiquetée selon qui la connaît : {@isidoro}, {@theodoric}, {@mj}.
// Sans étiquette, elle est commune et s'affiche toujours.

const SAVOIRS = {
  isidoro: { nom: 'Isidoro', voile: 'Cette page relève de la table d’Isidoro' },
  theodoric: { nom: 'Théodoric', voile: 'Cette page relève de la table de Théodoric : Isidoro ne la connaît pas' },
  mj: { nom: 'Monde', voile: 'Cette page croise les deux tables et les informations du MJ : ce n’est le savoir d’aucun personnage' },
};

function lireSavoir(brut, ou) {
  const jetons = String(brut || '').replace(/[{}]/g, ' ').split(/[\s,]+/).map((t) => t.replace(/^@/, '')).filter(Boolean);
  for (const j of jetons) if (!SAVOIRS[j]) throw new Error(`Étiquette de savoir inconnue « ${j} » (${ou}). Valeurs possibles : ${Object.keys(SAVOIRS).join(', ')}.`);
  return jetons.join(' ');
}
// Retire une étiquette {@…} d'un texte et la renvoie.
const ETIQUETTE = /\s*\{(@[\w-]+(?:\s+@[\w-]+)*)\}\s*/;
function extraireSavoir(texte) {
  const m = String(texte).match(ETIQUETTE);
  if (!m) return { texte, savoir: '' };
  return { texte: String(texte).replace(ETIQUETTE, ' ').trim(), savoir: lireSavoir(m[1], texte.slice(0, 50)) };
}
const attrSavoir = (s) => (s ? ` data-savoir="${s}"` : '');

// ---------------------------------------------------------------- utilitaires

const echapper = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const sansAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

const slug = (s) => sansAccents(String(s).replace(/<[^>]+>/g, '').replace(/\*/g, '').replace(/œ/g, 'oe').replace(/Œ/g, 'Oe'))
  .toLowerCase().replace(/['’]/g, '-').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  .slice(0, 60) || 'section';

// Espaces fines insécables de la typographie française.
const typoHtml = (html) => html.replace(/>([^<]+)</g, (m, t) => '>' + typo(t) + '<');
const typo = (s) => s
  .replace(/([A-Za-zÀ-ÿ])'/g, '$1’')
  .replace(/(\d) - (\d)/g, '$1 – $2')
  .replace(/(\d) (\d{3})(?!\d)/g, '$1\u202F$2')
  .replace(/ ([;:!?»])/g, ' $1')
  .replace(/« /g, '« ');

function lireEnTete(source) {
  const meta = {};
  let corps = source;
  if (source.startsWith('---\n')) {
    const fin = source.indexOf('\n---\n', 4);
    for (const ligne of source.slice(4, fin).split('\n')) {
      const i = ligne.indexOf(':');
      if (i > 0) meta[ligne.slice(0, i).trim()] = ligne.slice(i + 1).trim();
    }
    corps = source.slice(fin + 5);
  }
  return { meta, corps };
}

// ---------------------------------------------------------------- markdown

function enLigne(texte) {
  const reserves = [];
  const garder = (html) => { reserves.push(html); return `\u0000${reserves.length - 1}\u0000`; };
  // Quelques balises en ligne sont autorisées telles quelles.
  let s = String(texte).replace(/<\/?(span|em|strong|abbr|kbd|br|small|sup|mark)(\s[^>]*)?>/g, (t) => garder(t));
  s = echapper(s);
  s = s.replace(/`([^`]+)`/g, (_, c) => garder(`<code>${c}</code>`));
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => garder(`<img src="${src}" alt="${alt}" loading="lazy">`));
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, href) => garder(`<a href="${href}">${typo(t)}</a>`));
  s = typo(s);
  s = s.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => reserves[+i]);
  return s;
}

const ETIQUETTES = { vision: 'Vision', 'hors-jeu': 'Hors-jeu', note: 'Note' };
const AIDES = {
  vision: 'Un futur possible vu dans les vasques du Cœur Radieux. Rien ne garantit qu’il se réalise.',
  'hors-jeu': 'Savoir de joueur : les personnages ne le connaissent pas.',
  note: '',
};

function markdown(source, titres, idsPris = new Set(), herite = '') {
  const lignes = source.replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  const estVide = (l) => !l || !l.trim();
  const unique = (base) => { let id = base, n = 2; while (idsPris.has(id)) id = `${base}-${n++}`; idsPris.add(id); return id; };

  while (i < lignes.length) {
    const l = lignes[i];
    if (estVide(l)) { i++; continue; }

    let m;
    if ((m = l.match(/^:::\s*([\w-]+)\s*(\{[^}]*\})?\s*$/))) {
      const type = m[1];
      const savoir = m[2] ? lireSavoir(m[2], l) : '';
      const bloc = [];
      i++;
      while (i < lignes.length && !/^:::\s*$/.test(lignes[i])) bloc.push(lignes[i++]);
      i++;
      const interieur = markdown(bloc.join('\n'), titres, idsPris, savoir || herite);
      if (type === 'bloc') { out.push(`<div class="bloc-savoir"${attrSavoir(savoir)}>${interieur}</div>`); continue; }
      const aide = AIDES[type] ? `<p class="registre__aide">${typo(AIDES[type])}</p>` : '';
      out.push(`<aside class="registre registre--${type}"${attrSavoir(savoir)}><p class="registre__etiquette">${ETIQUETTES[type] || type}</p>${aide}${interieur}</aside>`);
      continue;
    }
    if (/^<[a-zA-Z!\/]/.test(l)) {
      const bloc = [];
      while (i < lignes.length && !estVide(lignes[i])) bloc.push(lignes[i++]);
      out.push(typoHtml(bloc.join('\n')));
      continue;
    }
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) {
      const niveau = m[1].length;
      const { texte, savoir } = extraireSavoir(m[2]);
      const html = enLigne(texte);
      const id = unique(slug(texte));
      if (titres && (niveau === 2 || niveau === 3)) titres.push({ niveau, id, texte: html.replace(/<[^>]+>/g, ''), savoir: savoir || herite });
      const titre = `<h${niveau} id="${id}">${html}</h${niveau}>`;
      i++;
      if (!savoir) { out.push(titre); continue; }
      // Un titre étiqueté emporte toute sa section, jusqu'au prochain titre de même niveau ou plus haut.
      const section = [];
      let dansBloc = false;
      while (i < lignes.length) {
        const s = lignes[i];
        if (/^:::/.test(s)) dansBloc = /^:::\s*[\w-]/.test(s) ? true : false;
        const t = !dansBloc && s.match(/^(#{1,4})\s/);
        if (t && t[1].length <= niveau) break;
        section.push(s); i++;
      }
      out.push(`<section class="section-savoir"${attrSavoir(savoir)}>${titre}\n${markdown(section.join('\n'), titres, idsPris, savoir)}</section>`);
      continue;
    }
    if (/^(---|\*\*\*)\s*$/.test(l)) { out.push('<hr>'); i++; continue; }

    if (l.startsWith('|') && lignes[i + 1] && /^\|[\s:|-]+\|\s*$/.test(lignes[i + 1])) {
      const cellules = (ligne) => ligne.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const tete = cellules(l);
      i += 2;
      const rangs = [];
      while (i < lignes.length && lignes[i].startsWith('|')) {
        const { texte, savoir } = extraireSavoir(lignes[i++]);
        rangs.push({ cellules: cellules(texte), savoir });
      }
      const avecTete = tete.some((c) => c);
      out.push('<div class="tableau"><table>' + (avecTete ? '<thead><tr>' + tete.map((c) => `<th scope="col">${enLigne(c)}</th>`).join('') + '</tr></thead>' : '') +
        '<tbody>' + rangs.map((r) => `<tr${attrSavoir(r.savoir)}>` + r.cellules.map((c) => `<td>${enLigne(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table></div>');
      continue;
    }

    const puce = /^[-*]\s+(.*)$/;
    const numero = /^(\d+)\.\s+(.*)$/;
    if (puce.test(l) || numero.test(l)) {
      const ordonnee = numero.test(l);
      const motif = ordonnee ? numero : puce;
      const items = [];
      const debut = ordonnee ? +l.match(numero)[1] : 1;
      while (i < lignes.length) {
        if (estVide(lignes[i])) {
          let j = i; while (j < lignes.length && estVide(lignes[j])) j++;
          if (j < lignes.length && motif.test(lignes[j])) { i = j; continue; }
          break;
        }
        const mm = lignes[i].match(motif);
        if (!mm) { items[items.length - 1] += ' ' + lignes[i].trim(); i++; continue; }
        items.push(ordonnee ? mm[2] : mm[1]);
        i++;
      }
      const taches = items.every((t) => /^\[[ xX]\]\s/.test(t));
      const lis = items.map((brut) => {
        const { texte: t, savoir } = extraireSavoir(brut);
        if (taches) {
          const fait = /^\[[xX]\]/.test(t);
          return `<li class="${fait ? 'fait' : 'a-faire'}"${attrSavoir(savoir)}>${enLigne(t.replace(/^\[[ xX]\]\s/, ''))}</li>`;
        }
        return `<li${attrSavoir(savoir)}>${enLigne(t)}</li>`;
      }).join('');
      if (ordonnee) out.push(`<ol${debut !== 1 ? ` start="${debut}"` : ''}>${lis}</ol>`);
      else out.push(`<ul${taches ? ' class="taches"' : ''}>${lis}</ul>`);
      continue;
    }

    if (l.startsWith('>')) {
      const bloc = [];
      while (i < lignes.length && lignes[i].startsWith('>')) bloc.push(lignes[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${markdown(bloc.join('\n'), null, idsPris)}</blockquote>`);
      continue;
    }

    const para = [];
    while (i < lignes.length && !estVide(lignes[i]) &&
      !/^(#{1,4}\s|:::|[-*]\s|\d+\.\s|\||>|---\s*$)/.test(lignes[i])) para.push(lignes[i++].trim());
    const { texte: contenuPara, savoir: savoirPara } = extraireSavoir(para.length ? para.join(' ') : l);
    out.push(`<p${attrSavoir(savoirPara)}>${enLigne(contenuPara)}</p>`);
    if (!para.length) i++;
  }
  return out.join('\n');
}

// ---------------------------------------------------------------- gabarit

const VUES = [
  ['isidoro', 'Isidoro', 'Ce que sait Isidoro : ses séances, son journal, ses visions.'],
  ['theodoric', 'Théodoric', 'Ce que sait la table de Théodoric : ses séances et les documents trouvés.'],
  ['monde', 'Monde', 'Les informations du MJ, le savoir hors-jeu et les recoupements entre les deux tables.'],
  ['tout', 'Tout', 'Tout afficher, avec la provenance de chaque information.'],
];

function onglets(rubrique, actif, r) {
  const rub = RUBRIQUES[rubrique];
  if (!rub || rub.onglets.length < 2) return '';
  return `<nav class="onglets" aria-label="${echapper(rub.titre)}"><ul>` + rub.onglets.map(([href, label]) =>
    `<li><a href="${r}${href}"${actif === href ? ' aria-current="page"' : ''}>${typo(echapper(label))}</a></li>`).join('') + `</ul></nav>`;
}

function voile(savoirPage) {
  if (!savoirPage) return '';
  const premier = savoirPage.split(' ')[0];
  return `<div class="voile" role="note"><p class="voile__titre">${typo(SAVOIRS[premier].voile)}.</p>` +
    `<p>Le point de vue choisi masque cette page. Rien n’est supprimé : elle reste là, pour qui veut la lire.</p>` +
    `<p><button type="button" class="voile__bouton" data-choisir-vue="tout">Afficher en vue « Tout »</button></p></div>`;
}

function gabarit({ chemin, titre, description, corps, classe = '', rubrique = '', actif = '', savoirPage = '' }) {
  const prof = chemin.split('/').length - 1;
  const r = prof ? '../'.repeat(prof) : '';
  const nav = Object.entries(RUBRIQUES).map(([cle, rub]) =>
    `<li><a href="${r}${rub.lien}"${cle === rubrique ? ' aria-current="page"' : ''}>${typo(echapper(rub.titre))}</a></li>`).join('');
  const vues = VUES.map(([cle, label, aide]) =>
    `<button type="button" data-choisir-vue="${cle}" aria-pressed="false"><b>${label}</b><span>${typo(echapper(aide))}</span></button>`).join('');
  return `<!doctype html>
<html lang="fr" data-vue="isidoro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${echapper(titre)} · Le Registre d'Isidoro</title>
<meta name="description" content="${echapper(description || '')}">
<script>try{var v=localStorage.getItem('registre-vue');if(v)document.documentElement.setAttribute('data-vue',v);}catch(e){}</script>
<link rel="stylesheet" href="${r}assets/css/site.css">
<link rel="icon" href="${r}assets/img/soleil.svg" type="image/svg+xml">
</head>
<body class="${classe}" data-racine="${r}"${savoirPage ? ` data-savoir-page="${savoirPage}"` : ''}>
<a class="evitement" href="#contenu">Aller au contenu</a>
<header class="bandeau">
  <div class="bandeau__haut">
    <a class="marque" href="${r}index.html"><span class="marque__soleil" aria-hidden="true"></span>Le Registre d'Isidoro</a>
    <div class="bandeau__outils">
      <details class="vue">
        <summary aria-label="Point de vue : quelles informations afficher"><span class="vue__titre">Point de vue</span> <b class="vue__courante">Isidoro</b><span class="vue__fleche" aria-hidden="true"></span></summary>
        <div class="vue__panneau" role="group" aria-label="Point de vue">
          <p class="vue__intro">Masque ce que le personnage choisi n’est pas censé savoir. Rien n’est supprimé.</p>
          ${vues}
          <p class="vue__compte" aria-live="polite"></p>
        </div>
      </details>
      <div class="recherche" role="search">
        <label class="sr" for="recherche">Rechercher dans le registre</label>
        <input id="recherche" type="search" placeholder="Rechercher un nom, un lieu…" autocomplete="off" aria-controls="recherche-resultats">
        <div id="recherche-resultats" class="recherche__resultats" hidden></div>
      </div>
    </div>
  </div>
  <nav class="nav" aria-label="Rubriques du registre"><ul>${nav}</ul></nav>
</header>
<main id="contenu">
${onglets(rubrique, actif, r)}${voile(savoirPage)}
${corps}
</main>
<footer class="pied">
  <p>Campagne D&amp;D 3.5 au Lac de Vapeur. Registre tenu pour Antoine et sa table ; généré par <code>src/build.mjs</code>.</p>
</footer>
<script src="${r}assets/js/site.js"></script>
</body>
</html>
`;
}

function enteteDePage({ rubrique, rubriqueHref, titre, sousTitre, r }) {
  const fil = rubrique ? `<p class="fil"><a href="${r}${rubriqueHref}">${rubrique}</a></p>` : '';
  return `<div class="entete">${fil}<h1>${typo(echapper(titre))}</h1>${sousTitre ? `<p class="entete__sous">${enLigne(sousTitre)}</p>` : ''}</div>`;
}

function sommaire(titres) {
  if (titres.length < 3) return '';
  const lis = titres.map((t) => `<li class="n${t.niveau}"${attrSavoir(t.savoir)}><a href="#${t.id}">${t.texte}</a></li>`).join('');
  return `<nav class="sommaire" aria-label="Sommaire"><details open><summary>Sommaire</summary><ol>${lis}</ol></details></nav>`;
}

function ficheProvenance(meta, r) {
  const champs = [['auteur', 'Auteur'], ['destinataire', 'Destinataire'], ['periode', 'Période'], ['provenance', 'Provenance'], ['regard', 'Regard']];
  const dl = champs.filter(([k]) => meta[k]).map(([k, l]) => `<dt>${l}</dt><dd>${enLigne(meta[k])}</dd>`).join('');
  let original = '';
  if (meta.pdf) original = `<dt>Original</dt><dd><a href="${r}assets/pdf/${meta.pdf}">Ouvrir le PDF</a></dd>`;
  if (meta.image) original = `<dt>Original</dt><dd><a href="${r}assets/img/${meta.image}">Voir la photo</a></dd>`;
  return `<aside class="provenance" aria-label="Fiche de provenance"><p class="provenance__titre">Fiche de provenance</p><dl>${dl}${original}</dl></aside>`;
}

// ---------------------------------------------------------------- génération

// La recherche respecte le point de vue : chaque morceau étiqueté est indexé à part, avec son savoir.
const recherche = [];

// Sépare les éléments portant data-savoir du reste du HTML (en tenant compte de l'imbrication).
function separerSavoirs(html) {
  const morceaux = [];
  let reste = '';
  let curseur = 0;
  const ouvrante = /<([a-z][a-z0-9]*)\b[^>]*\sdata-savoir="([^"]+)"[^>]*>/gi;
  let m;
  while ((m = ouvrante.exec(html))) {
    const nom = m[1].toLowerCase();
    const debutInterieur = m.index + m[0].length;
    const balises = new RegExp(`<(/?)${nom}\\b[^>]*>`, 'gi');
    balises.lastIndex = debutInterieur;
    let profondeur = 1, b, fin = html.length, finInterieur = html.length;
    while ((b = balises.exec(html))) {
      profondeur += b[1] ? -1 : 1;
      if (profondeur === 0) { finInterieur = b.index; fin = b.index + b[0].length; break; }
    }
    // Ancre : le dernier titre rencontré avant l'élément.
    const avant = html.slice(0, m.index);
    const titres = [...avant.matchAll(/<h[23] id="([^"]+)">([\s\S]*?)<\/h[23]>/g)];
    const dernier = titres[titres.length - 1];
    reste += html.slice(curseur, m.index) + ' ';
    morceaux.push({ savoir: m[2], html: html.slice(debutInterieur, finInterieur), ancre: dernier ? { id: dernier[1], titre: dernier[2] } : null });
    curseur = fin;
    ouvrante.lastIndex = fin;
  }
  reste += html.slice(curseur);
  return { reste, morceaux };
}

function texteBrut(html) {
  return html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<(\/(p|li|h\d|td|th|div|dd|dt|figcaption|tr)|br\s*\/?)>/g, ' ').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim();
}

function indexer(url, titrePage, html, savoir = '', ancre = null) {
  const { reste, morceaux } = separerSavoirs(html);
  for (const m of reste.split(/(?=<h[23] id=")/)) {
    const t = m.match(/^<h[23] id="([^"]+)">([\s\S]*?)<\/h[23]>/);
    const texte = texteBrut(m);
    if (!texte) continue;
    const id = t ? t[1] : ancre && ancre.id;
    const sous = t ? t[2] : ancre ? ancre.titre : '';
    const entree = { p: titrePage, s: sous.replace(/<[^>]+>/g, ''), u: url + (id ? '#' + id : ''), x: texte };
    if (savoir) entree.v = savoir;
    recherche.push(entree);
  }
  for (const m of morceaux) indexer(url, titrePage, m.html, m.savoir, m.ancre || ancre);
}

function ecrire(chemin, html) {
  const cible = join(RACINE, chemin);
  mkdirSync(dirname(cible), { recursive: true });
  writeFileSync(cible, html);
}

function chargerCollection(nom) {
  const dossier = join(CONTENU, nom);
  return readdirSync(dossier).filter((f) => f.endsWith('.md')).map((f) => {
    const { meta, corps } = lireEnTete(readFileSync(join(dossier, f), 'utf8'));
    return { nom: basename(f, '.md'), meta, corps, url: `${nom}/${basename(f, '.md')}.html` };
  }).sort((a, b) => (+a.meta.ordre || 0) - (+b.meta.ordre || 0));
}

const collections = Object.fromEntries(Object.keys(COLLECTIONS).map((n) => [n, chargerCollection(n)]));

for (const [nom, items] of Object.entries(collections)) {
  const col = COLLECTIONS[nom];
  items.forEach((it, k) => {
    const r = '../';
    const titres = [];
    const contenu = markdown(it.corps, titres);
    const prec = items[k - 1], suiv = items[k + 1];
    const suite = `<nav class="suite" aria-label="Pages voisines">${prec ? `<a class="suite__prec" href="${prec.nom}.html"><span>Précédent</span>${echapper(prec.meta.titre)}</a>` : '<span></span>'}${suiv ? `<a class="suite__suiv" href="${suiv.nom}.html"><span>Suivant</span>${echapper(suiv.meta.titre)}</a>` : ''}</nav>`;
    const cote = (nom === 'documents' ? ficheProvenance(it.meta, r) : '') + sommaire(titres);
    const lienPdf = nom !== 'documents' && it.meta.pdf ? `<p class="original"><a href="${r}assets/pdf/${it.meta.pdf}">Ouvrir le document d'origine (PDF)</a></p>` : '';
    const corps = `<article class="lecture lecture--${nom}">
${enteteDePage({ rubrique: col.titre, rubriqueHref: col.index, titre: it.meta.titre, sousTitre: it.meta['sous-titre'], r })}
<div class="lecture__grille">
<div class="lecture__cote">${cote}</div>
<div class="texte">${lienPdf}${contenu}</div>
</div>
${suite}
</article>`;
    const savoirPage = lireSavoir(it.meta.savoir, it.url);
    ecrire(it.url, gabarit({ chemin: it.url, titre: it.meta.titre, description: it.meta.resume, corps, classe: `page-${nom}`, rubrique: col.rubrique, actif: col.index, savoirPage }));
    indexer(it.url, it.meta.titre, contenu, savoirPage);
  });
}

// Listes générées, insérées dans les fragments par <!-- liste:nom -->
function liste(nom) {
  return `<ol class="registre-liste">` + collections[nom].map((it) => {
    const m = it.meta;
    const details = [m.periode, m.auteur].filter(Boolean).map((d) => `<span>${enLigne(d)}</span>`).join('');
    const etiquette = m.campagne || m.aventure || '';
    return `<li${attrSavoir(lireSavoir(m.savoir, it.url))}><a href="${it.url}"><span class="registre-liste__titre">${typo(echapper(m.titre))}</span></a>` +
      (etiquette ? `<span class="registre-liste__etiquette">${echapper(etiquette)}</span>` : '') +
      `<p class="registre-liste__resume">${enLigne(m.resume || '')}</p>` +
      (details ? `<p class="registre-liste__details">${details}</p>` : '') + `</li>`;
  }).join('') + `</ol>`;
}

for (const f of readdirSync(join(CONTENU, 'pages')).filter((f) => /\.(html|md)$/.test(f))) {
  const { meta, corps } = lireEnTete(readFileSync(join(CONTENU, 'pages', f), 'utf8'));
  const sortie = meta.sortie || f.replace(/\.md$/, '.html');
  const source = f.endsWith('.md') ? markdown(corps, []) : typoHtml(corps);
  let html = source.replace(/<!--\s*liste:(\w+)\s*-->/g, (_, n) => liste(n));
  const entete = meta.titre && meta.entete !== 'non'
    ? enteteDePage({ titre: meta.titre, sousTitre: meta['sous-titre'], r: '' }) : '';
  const corpsPage = meta.cadre === 'non' ? html : `<div class="page">${entete}${html}</div>`;
  const savoirPage = lireSavoir(meta.savoir, f);
  ecrire(sortie, gabarit({ chemin: sortie, titre: meta.titre || "Accueil", description: meta.description, corps: corpsPage, classe: `page-${basename(sortie, '.html')}`, rubrique: meta.rubrique || '', actif: sortie, savoirPage }));
  indexer(sortie, meta.titre || 'Accueil', html, savoirPage);
}

// ---------------------------------------------------------------- mots-clés cachés
// src/contenu/mots-cles.txt : des mots invisibles sur le site, mais trouvés par la recherche.
//   [page.html#ancre] @isidoro     -> les lignes suivantes (mots séparés par des virgules) s'attachent à cette section,
//                                     pour le savoir indiqué (sans étiquette : la partie commune de la section)
//   = mot, variante, synonyme      -> une recherche sur l'un trouve aussi les autres (orthographes, fautes de dictée, VO)

const trierSavoir = (s) => (s || '').split(' ').filter(Boolean).sort().join(' ');
const synonymes = [];
const fichierMots = join(CONTENU, 'mots-cles.txt');
if (existsSync(fichierMots)) {
  let cible = null;
  const blocs = [];
  readFileSync(fichierMots, 'utf8').replace(/\r/g, '').split('\n').forEach((ligne, n) => {
    const l = ligne.trim();
    if (!l || l.startsWith('#')) { if (!l) cible = null; return; }
    let m;
    if (l.startsWith('=')) { synonymes.push(l.slice(1).split(',').map((s) => s.trim()).filter(Boolean)); return; }
    if ((m = l.match(/^\[([^\]]+)\]\s*(.*)$/))) { cible = { u: m[1].trim(), v: trierSavoir(lireSavoir(m[2], `mots-cles.txt, ligne ${n + 1}`)), mots: [] }; blocs.push(cible); return; }
    if (!cible) throw new Error(`mots-cles.txt, ligne ${n + 1} : des mots-clés sans [page#ancre] au-dessus.`);
    cible.mots.push(...l.split(',').map((s) => s.trim()).filter(Boolean));
  });
  for (const b of blocs) {
    let memePage = recherche.filter((e) => e.u === b.u);
    if (!memePage.length) {
      const sections = recherche.filter((e) => e.u.startsWith(b.u + '#'));
      if (!sections.length) { console.warn(`mots-cles.txt : la cible « ${b.u} » n'existe pas dans le site.`); continue; }
      memePage = [{ p: sections[0].p, s: '', u: b.u }];
    }
    const visees = memePage.filter((e) => 'x' in e && trierSavoir(e.v) === b.v);
    if (visees.length) visees.forEach((e) => { e.k = ((e.k ? e.k + ', ' : '') + b.mots.join(', ')); });
    else {
      const entree = { p: memePage[0].p, s: memePage[0].s, u: b.u, x: '', k: b.mots.join(', ') };
      if (b.v) entree.v = b.v;
      recherche.push(entree);
    }
  }
}

ecrire('assets/js/recherche-index.js', '// Généré par src/build.mjs\nwindow.RECHERCHE = ' + JSON.stringify(recherche) + ';\nwindow.SYNONYMES = ' + JSON.stringify(synonymes) + ';\n');
console.log(`Site généré : ${recherche.length} sections indexées.`);
