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

const NAV = [
  ['chronologie.html', 'Chronologie'],
  ['seances.html', 'Séances'],
  ['journal.html', 'Journal'],
  ['documents.html', 'Documents'],
  ['personnages.html', 'Personnages'],
  ['lieux.html', 'Lieux et cartes'],
  ['isidoro.html', 'Isidoro'],
  ['recoupements.html', 'Recoupements'],
  ['regles.html', 'Règles'],
];

const COLLECTIONS = {
  seances: { titre: 'Séances', index: 'seances.html' },
  journal: { titre: "Journal d'Isidoro", index: 'journal.html' },
  documents: { titre: 'Documents', index: 'documents.html' },
};

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

function markdown(source, titres, idsPris = new Set()) {
  const lignes = source.replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  const estVide = (l) => !l || !l.trim();
  const unique = (base) => { let id = base, n = 2; while (idsPris.has(id)) id = `${base}-${n++}`; idsPris.add(id); return id; };

  while (i < lignes.length) {
    const l = lignes[i];
    if (estVide(l)) { i++; continue; }

    let m;
    if ((m = l.match(/^:::\s*([\w-]+)\s*$/))) {
      const type = m[1];
      const bloc = [];
      i++;
      while (i < lignes.length && !/^:::\s*$/.test(lignes[i])) bloc.push(lignes[i++]);
      i++;
      const aide = AIDES[type] ? `<p class="registre__aide">${typo(AIDES[type])}</p>` : '';
      out.push(`<aside class="registre registre--${type}"><p class="registre__etiquette">${ETIQUETTES[type] || type}</p>${aide}${markdown(bloc.join('\n'), titres, idsPris)}</aside>`);
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
      const html = enLigne(m[2]);
      const id = unique(slug(m[2]));
      if (titres && (niveau === 2 || niveau === 3)) titres.push({ niveau, id, texte: html.replace(/<[^>]+>/g, '') });
      out.push(`<h${niveau} id="${id}">${html}</h${niveau}>`);
      i++; continue;
    }
    if (/^(---|\*\*\*)\s*$/.test(l)) { out.push('<hr>'); i++; continue; }

    if (l.startsWith('|') && lignes[i + 1] && /^\|[\s:|-]+\|\s*$/.test(lignes[i + 1])) {
      const cellules = (ligne) => ligne.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const tete = cellules(l);
      i += 2;
      const rangs = [];
      while (i < lignes.length && lignes[i].startsWith('|')) rangs.push(cellules(lignes[i++]));
      const avecTete = tete.some((c) => c);
      out.push('<div class="tableau"><table>' + (avecTete ? '<thead><tr>' + tete.map((c) => `<th scope="col">${enLigne(c)}</th>`).join('') + '</tr></thead>' : '') +
        '<tbody>' + rangs.map((r) => '<tr>' + r.map((c) => `<td>${enLigne(c)}</td>`).join('') + '</tr>').join('') +
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
      const lis = items.map((t) => {
        if (taches) {
          const fait = /^\[[xX]\]/.test(t);
          return `<li class="${fait ? 'fait' : 'a-faire'}">${enLigne(t.replace(/^\[[ xX]\]\s/, ''))}</li>`;
        }
        return `<li>${enLigne(t)}</li>`;
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
    if (para.length) out.push(`<p>${enLigne(para.join(' '))}</p>`);
    else { out.push(`<p>${enLigne(l)}</p>`); i++; }
  }
  return out.join('\n');
}

// ---------------------------------------------------------------- gabarit

function gabarit({ chemin, titre, description, corps, classe = '', actif = '' }) {
  const prof = chemin.split('/').length - 1;
  const r = prof ? '../'.repeat(prof) : '';
  const nav = NAV.map(([href, label]) =>
    `<li><a href="${r}${href}"${actif === href ? ' aria-current="page"' : ''}>${label}</a></li>`).join('');
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${echapper(titre)} · Le Registre d'Isidoro</title>
<meta name="description" content="${echapper(description || '')}">
<link rel="stylesheet" href="${r}assets/css/site.css">
<link rel="icon" href="${r}assets/img/soleil.svg" type="image/svg+xml">
</head>
<body class="${classe}" data-racine="${r}">
<a class="evitement" href="#contenu">Aller au contenu</a>
<header class="bandeau">
  <div class="bandeau__haut">
    <a class="marque" href="${r}index.html"><span class="marque__soleil" aria-hidden="true"></span>Le Registre d'Isidoro</a>
    <div class="recherche" role="search">
      <label class="sr" for="recherche">Rechercher dans le registre</label>
      <input id="recherche" type="search" placeholder="Rechercher un nom, un lieu…" autocomplete="off" aria-controls="recherche-resultats">
      <div id="recherche-resultats" class="recherche__resultats" hidden></div>
    </div>
  </div>
  <nav class="nav" aria-label="Sections du registre"><ul>${nav}</ul></nav>
</header>
<main id="contenu">
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
  const lis = titres.map((t) => `<li class="n${t.niveau}"><a href="#${t.id}">${t.texte}</a></li>`).join('');
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

const recherche = [];
function indexer(url, titrePage, html) {
  const morceaux = html.split(/(?=<h[23] id=")/);
  for (const m of morceaux) {
    const t = m.match(/^<h[23] id="([^"]+)">([\s\S]*?)<\/h[23]>/);
    const texte = m.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<(\/(p|li|h\d|td|th|div|dd|dt|figcaption|tr)|br\s*\/?)>/g, ' ').replace(/<[^>]+>/g, '')
      .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ').trim();
    if (!texte) continue;
    recherche.push({
      p: titrePage,
      s: t ? t[2].replace(/<[^>]+>/g, '') : '',
      u: url + (t ? '#' + t[1] : ''),
      x: texte,
    });
  }
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
    ecrire(it.url, gabarit({ chemin: it.url, titre: it.meta.titre, description: it.meta.resume, corps, classe: `page-${nom}`, actif: col.index }));
    indexer(it.url, it.meta.titre, contenu);
  });
}

// Listes générées, insérées dans les fragments par <!-- liste:nom -->
function liste(nom) {
  return `<ol class="registre-liste">` + collections[nom].map((it) => {
    const m = it.meta;
    const details = [m.periode, m.auteur].filter(Boolean).map((d) => `<span>${enLigne(d)}</span>`).join('');
    const etiquette = m.campagne || m.aventure || '';
    return `<li><a href="${it.url}"><span class="registre-liste__titre">${typo(echapper(m.titre))}</span></a>` +
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
  ecrire(sortie, gabarit({ chemin: sortie, titre: meta.titre || "Accueil", description: meta.description, corps: corpsPage, classe: `page-${basename(sortie, '.html')}`, actif: sortie }));
  indexer(sortie, meta.titre || 'Accueil', html);
}

ecrire('assets/js/recherche-index.js', '// Généré par src/build.mjs\nwindow.RECHERCHE = ' + JSON.stringify(recherche) + ';\n');
console.log(`Site généré : ${recherche.length} sections indexées.`);
