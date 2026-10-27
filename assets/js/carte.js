// Le Registre d'Isidoro — carte interactive de Faerûn.
// Les lieux viennent de la liste de la page (li[data-carte]) : nom, coordonnées, niveau de zoom, savoir.
// Coordonnées : repère du fond de carte (data-cadre = x0 y0 largeur hauteur).
(function () {
  'use strict';
  var carte = document.getElementById('carte');
  if (!carte) return;
  var vue = carte.querySelector('.carte__vue');
  var plan = carte.querySelector('.carte__plan');
  var calque = carte.querySelector('.carte__calque');
  var fiche = carte.querySelector('.carte__fiche');
  var ficheCorps = carte.querySelector('.carte__fiche-corps');
  var c = carte.getAttribute('data-cadre').split(' ').map(Number);
  var X0 = c[0], Y0 = c[1], CW = c[2], CH = c[3];

  var k = 1, tx = 0, ty = 0, kmin = 1, kmax = 14;

  // ------------------------------------------------------------ tuiles du fond (niveau L : 2^L pixels par unité, 512 px)
  var DOSSIER = carte.getAttribute('data-tuiles');
  var GRILLES = JSON.parse(carte.getAttribute('data-niveaux') || '{}');
  var NMAX = Math.max.apply(null, Object.keys(GRILLES).map(Number).concat([0]));
  var tuiles = carte.querySelector('.carte__tuiles');
  var couches = {}, posees = {};
  function couche(L) {
    if (!couches[L]) {
      var d = document.createElement('div');
      d.className = 'carte__couche';
      d.style.zIndex = L;
      tuiles.appendChild(d);
      couches[L] = d;
    }
    return couches[L];
  }
  function majTuiles() {
    if (!DOSSIER) return;
    var dpr = window.devicePixelRatio || 1;
    var voulu = Math.max(1, Math.min(NMAX, Math.ceil(Math.log2(k * dpr) - 0.15)));
    var a = versCarte(-64, -64), b = versCarte(vue.clientWidth + 64, vue.clientHeight + 64);
    for (var L = 1; L <= NMAX; L++) {
      var g = GRILLES[L];
      var montre = L <= voulu && L >= voulu - 1;
      if (couches[L]) couches[L].style.display = montre ? '' : 'none';
      if (!montre || !g) continue;
      var u = 512 / Math.pow(2, L);
      var i0 = Math.max(g[0], Math.floor((a.x - X0) / u)), i1 = Math.min(g[2] - 1, Math.floor((b.x - X0) / u));
      var j0 = Math.max(g[1], Math.floor((a.y - Y0) / u)), j1 = Math.min(g[3] - 1, Math.floor((b.y - Y0) / u));
      for (var i = i0; i <= i1; i++) for (var j = j0; j <= j1; j++) {
        var cle = L + '/' + i + '_' + j;
        if (posees[cle]) continue;
        var img = new Image();
        img.className = 'carte__tuile'; img.alt = ''; img.draggable = false; img.decoding = 'async';
        img.style.left = (i * u) + 'px'; img.style.top = (j * u) + 'px';
        img.style.width = img.style.height = (u + 1 / Math.pow(2, L)) + 'px';
        img.onload = function () { this.classList.add('carte__tuile--ok'); };
        img.src = DOSSIER + '/' + cle + '.webp';
        couche(L).appendChild(img);
        posees[cle] = img;
      }
    }
  }
  var attenteTuiles = null;
  function planifieTuiles() {
    if (attenteTuiles) return;
    attenteTuiles = setTimeout(function () { attenteTuiles = null; majTuiles(); }, 120);
  }
  // Seuils de zoom (relatifs à la vue d'ensemble) pour les niveaux 2, 3 et 4.
  var SEUILS = [0, 0, 1.7, 3, 5.2];
  var TYPES = { region: 'Région', mer: 'Mer et lac', relief: 'Relief et forêt', capitale: 'Capitale', ville: 'Cité',
    ruine: 'Ruines', campagne: 'Lieu de la campagne', repaire: 'Repaire' };
  var CALQUE_DE = { campagne: 'campagne', repaire: 'campagne', capitale: 'villes', ville: 'villes', ruine: 'villes', region: 'regions', mer: 'nature', relief: 'nature' };

  // ------------------------------------------------------------ étiquettes
  var lieux = [];
  var sansAccents = function (s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, ' '); };
  document.querySelectorAll('li[data-carte]').forEach(function (li) {
    var nom = li.querySelector('.lieu__nom').textContent;
    var type = li.getAttribute('data-carte');
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'etiquette etiquette--' + type + ' etiquette--' + (li.getAttribute('data-pos') || (type === 'region' || type === 'mer' || type === 'relief' ? 'c' : 'd'));
    b.setAttribute('data-niv', li.getAttribute('data-niv') || '1');
    b.setAttribute('data-calque', CALQUE_DE[type] || 'villes');
    if (li.hasAttribute('data-savoir')) b.setAttribute('data-savoir', li.getAttribute('data-savoir'));
    var rot = li.getAttribute('data-rot');
    b.innerHTML = '<span class="etiquette__point" aria-hidden="true"></span><span class="etiquette__nom"' + (rot ? ' style="--rot:' + rot + 'deg"' : '') + '>' + nom + '</span>';
    b.setAttribute('aria-label', nom + ' (' + (TYPES[type] || 'lieu') + ')');
    var l = { li: li, el: b, nom: nom, cle: sansAccents(nom), x: +li.getAttribute('data-x'), y: +li.getAttribute('data-y'), niv: +li.getAttribute('data-niv') || 1, type: type };
    b.addEventListener('click', function (ev) { ev.stopPropagation(); choisir(l, true); });
    calque.appendChild(b);
    lieux.push(l);
    // Dans la liste : un lien « sur la carte »
    var aller = document.createElement('a');
    aller.href = '#' + li.id;
    aller.className = 'lieu__voir';
    aller.textContent = 'Voir sur la carte';
    aller.addEventListener('click', function (ev) { ev.preventDefault(); history.replaceState(null, '', '#' + li.id); carte.scrollIntoView({ behavior: 'smooth', block: 'start' }); choisir(l, true); });
    li.appendChild(aller);
  });
  var noms = carte.querySelector('#carte-noms');
  if (noms) noms.innerHTML = lieux.map(function (l) { return '<option value="' + l.nom.replace(/"/g, '&quot;') + '">'; }).join('');

  // ------------------------------------------------------------ vue
  // Quand la fiche est ouverte, la partie de la carte qu'elle couvre peut accueillir le bord de la carte.
  function marges() {
    if (fiche.hidden) return { d: 0, b: 0 };
    return getComputedStyle(fiche).bottom === '0px' ? { d: 0, b: fiche.offsetHeight } : { d: fiche.offsetWidth + 24, b: 0 };
  }
  function bornes() {
    var m = marges();
    var vw = vue.clientWidth, vh = vue.clientHeight;
    var lw = CW * k, lh = CH * k;
    tx = lw <= vw - m.d ? (vw - m.d - lw) / 2 : Math.min(0, Math.max(vw - m.d - lw, tx));
    ty = lh <= vh - m.b ? (vh - m.b - lh) / 2 : Math.min(0, Math.max(vh - m.b - lh, ty));
  }
  var repos;
  function applique(enMouvement) {
    bornes();
    plan.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + k + ')';
    var z = k / kmin, niv = 1;
    for (var n = 2; n <= 4; n++) if (z >= SEUILS[n]) niv = n;
    if (carte.getAttribute('data-niveau') !== String(niv)) carte.setAttribute('data-niveau', niv);
    var vw = vue.clientWidth, vh = vue.clientHeight;
    for (var i = 0; i < lieux.length; i++) {
      var l = lieux[i];
      var px = tx + (l.x - X0) * k, py = ty + (l.y - Y0) * k;
      var dehors = px < -200 || py < -60 || px > vw + 200 || py > vh + 60;
      l.el.classList.toggle('etiquette--dehors', dehors);
      if (!dehors) l.el.style.transform = 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px)';
    }
    planifieTuiles();
    if (enMouvement) {
      carte.classList.add('carte--bouge');
      clearTimeout(repos);
      repos = setTimeout(function () { carte.classList.remove('carte--bouge'); }, 220);
    }
  }
  function ajuste(garderCentre) {
    var vw = vue.clientWidth, vh = vue.clientHeight;
    if (!vw || !vh) return;
    var centre = garderCentre ? versCarte(vw / 2, vh / 2) : null;
    var ancienMin = kmin;
    kmin = Math.min(vw / CW, vh / CH);
    carte.style.setProperty('--e', Math.max(.72, Math.min(1, vw / 1100)).toFixed(3));
    kmax = kmin * 10;
    if (!garderCentre) { k = kmin; tx = 0; ty = 0; }
    else { k = Math.max(kmin, Math.min(kmax, k * kmin / ancienMin)); centrer(centre.x, centre.y); }
    applique();
  }
  function versCarte(px, py) { return { x: (px - tx) / k + X0, y: (py - ty) / k + Y0 }; }
  function centrer(x, y) {
    tx = vue.clientWidth / 2 - (x - X0) * k;
    ty = vue.clientHeight / 2 - (y - Y0) * k;
  }
  function zoomeEn(px, py, f) {
    var nk = Math.max(kmin, Math.min(kmax, k * f));
    tx = px - (px - tx) * nk / k;
    ty = py - (py - ty) * nk / k;
    k = nk;
    applique(true);
  }
  var anim;
  function vole(nk, x, y, duree) {
    cancelAnimationFrame(anim);
    nk = Math.max(kmin, Math.min(kmax, nk));
    var vw = vue.clientWidth, vh = vue.clientHeight;
    var k0 = k, depart = versCarte(vw / 2, vh / 2), t0 = performance.now();
    duree = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : (duree || 600);
    (function pas(t) {
      var u = duree ? Math.min(1, (t - t0) / duree) : 1;
      var e = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      k = k0 * Math.pow(nk / k0, e);
      centrer(depart.x + (x - depart.x) * e, depart.y + (y - depart.y) * e);
      applique(true);
      if (u < 1) anim = requestAnimationFrame(pas);
    })(t0);
  }
  function cadrer(x0, y0, x1, y1) {
    var vw = vue.clientWidth, vh = vue.clientHeight;
    vole(Math.min(vw / (x1 - x0), vh / (y1 - y0)), (x0 + x1) / 2, (y0 + y1) / 2);
  }

  // ------------------------------------------------------------ fiche
  var actif = null;
  function choisir(l, deplacer) {
    if (actif) actif.el.classList.remove('etiquette--actif');
    actif = l;
    l.el.classList.add('etiquette--actif');
    var li = l.li;
    var vo = li.querySelector('.lieu__vo'), desc = li.querySelector('.lieu__desc'), liens = li.querySelector('.lieu__liens');
    ficheCorps.innerHTML =
      '<p class="carte__fiche-type">' + (TYPES[l.type] || 'Lieu') + (li.hasAttribute('data-approx') ? ' · position supposée' : '') + '</p>' +
      '<h2 class="carte__fiche-titre">' + l.nom + '</h2>' +
      (vo ? '<p class="carte__fiche-vo">VO : <span lang="en">' + vo.textContent + '</span></p>' : '') +
      (desc ? '<p class="carte__fiche-desc">' + desc.innerHTML + '</p>' : '') +
      (liens ? '<p class="carte__fiche-liens">Sources : ' + liens.innerHTML + '</p>' : '');
    fiche.hidden = false;
    if (deplacer) {
      var besoin = kmin * Math.max(SEUILS[l.niv] * 1.05, l.type === 'region' ? 1.6 : 2.2);
      var nk = Math.max(kmin, Math.min(kmax, Math.max(k, besoin)));
      // La fiche couvre une partie de la carte : le lieu se place dans la partie restée visible.
      var m = marges();
      vole(nk, l.x + m.d / 2 / nk, l.y + m.b / 2 / nk, 650);
    }
  }
  function fermer() {
    if (fiche.hidden) return;
    fiche.hidden = true;
    if (actif) actif.el.classList.remove('etiquette--actif');
    actif = null;
    applique();
  }
  carte.querySelector('.carte__fermer').addEventListener('click', fermer);

  // ------------------------------------------------------------ souris, doigts, clavier
  var pointeurs = new Map(), dernier = null, distance0 = 0, k0 = 1, glisse = false;
  vue.addEventListener('pointerdown', function (ev) {
    if (ev.target.closest('.etiquette')) return;
    vue.setPointerCapture(ev.pointerId);
    pointeurs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    cancelAnimationFrame(anim);
    glisse = false;
    if (pointeurs.size === 2) {
      var p = Array.from(pointeurs.values());
      distance0 = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); k0 = k;
    }
    dernier = { x: ev.clientX, y: ev.clientY };
  });
  vue.addEventListener('pointermove', function (ev) {
    if (!pointeurs.has(ev.pointerId)) return;
    var avant = pointeurs.get(ev.pointerId);
    pointeurs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    var r = vue.getBoundingClientRect();
    if (pointeurs.size === 2) {
      var p = Array.from(pointeurs.values());
      var d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      var mx = (p[0].x + p[1].x) / 2 - r.left, my = (p[0].y + p[1].y) / 2 - r.top;
      tx += (ev.clientX - avant.x) / 2; ty += (ev.clientY - avant.y) / 2;
      zoomeEn(mx, my, (k0 * d / distance0) / k);
      glisse = true;
    } else {
      var dx = ev.clientX - avant.x, dy = ev.clientY - avant.y;
      if (Math.abs(ev.clientX - dernier.x) + Math.abs(ev.clientY - dernier.y) > 4) glisse = true;
      tx += dx; ty += dy;
      applique(true);
    }
  });
  function lache(ev) {
    pointeurs.delete(ev.pointerId);
    if (pointeurs.size === 1) { var p = Array.from(pointeurs.values())[0]; dernier = p; }
  }
  vue.addEventListener('pointerup', lache);
  vue.addEventListener('pointercancel', lache);
  vue.addEventListener('click', function (ev) {
    if (!glisse && !ev.target.closest('.etiquette') && !fiche.contains(ev.target)) fermer();
  });
  vue.addEventListener('wheel', function (ev) {
    ev.preventDefault();
    cancelAnimationFrame(anim);
    var r = vue.getBoundingClientRect();
    var delta = ev.deltaMode === 1 ? ev.deltaY * 33 : ev.deltaY;
    zoomeEn(ev.clientX - r.left, ev.clientY - r.top, Math.exp(-delta * 0.0018));
  }, { passive: false });
  vue.addEventListener('dblclick', function (ev) {
    if (ev.target.closest('.etiquette')) return;
    var r = vue.getBoundingClientRect();
    var p = versCarte(ev.clientX - r.left, ev.clientY - r.top);
    vole(k * 2, p.x, p.y, 400);
  });
  vue.addEventListener('keydown', function (ev) {
    var pas = 80;
    if (ev.key === 'ArrowLeft') tx += pas; else if (ev.key === 'ArrowRight') tx -= pas;
    else if (ev.key === 'ArrowUp') ty += pas; else if (ev.key === 'ArrowDown') ty -= pas;
    else if (ev.key === '+' || ev.key === '=') zoomeEn(vue.clientWidth / 2, vue.clientHeight / 2, 1.5);
    else if (ev.key === '-') zoomeEn(vue.clientWidth / 2, vue.clientHeight / 2, 1 / 1.5);
    else if (ev.key === '0') ajuste(false);
    else if (ev.key === 'Escape') fermer();
    else return;
    ev.preventDefault();
    applique(true);
  });

  // ------------------------------------------------------------ outils
  carte.querySelectorAll('[data-zoom]').forEach(function (b) {
    b.addEventListener('click', function () {
      var p = versCarte(vue.clientWidth / 2, vue.clientHeight / 2);
      vole(k * (b.getAttribute('data-zoom') === '1' ? 1.8 : 1 / 1.8), p.x, p.y, 350);
    });
  });
  carte.querySelectorAll('[data-aller]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.getAttribute('data-aller') === 'vapeur') cadrer(790, 845, 1120, 1020);
      else vole(kmin, X0 + CW / 2, Y0 + CH / 2);
    });
  });
  carte.querySelectorAll('[data-calque]').forEach(function (cb) {
    if (cb.tagName !== 'INPUT') return;
    var nom = cb.getAttribute('data-calque');
    function maj() {
      if (nom === 'livre') {
        var img = plan.querySelector('.carte__livre');
        if (cb.checked && !img) {
          img = document.createElement('img');
          img.className = 'carte__livre'; img.alt = ''; img.draggable = false;
          img.width = CW; img.height = CH;
          img.src = carte.getAttribute('data-livre');
          plan.appendChild(img);
        }
        carte.classList.toggle('avec-livre', cb.checked);
      } else carte.classList.toggle('sans-' + nom, !cb.checked);
    }
    cb.addEventListener('change', maj);
    maj();
  });
  var champ = carte.querySelector('.carte__cherche input');
  function chercher() {
    var q = sansAccents(champ.value.trim());
    if (!q) return;
    var visible = function (l) { return l.el.offsetParent !== null || getComputedStyle(l.el).display !== 'none'; };
    var l = lieux.find(function (l) { return l.cle === q && visible(l); }) ||
      lieux.find(function (l) { return l.cle.indexOf(q) === 0 && visible(l); }) ||
      lieux.find(function (l) { return l.cle.indexOf(q) !== -1 && visible(l); });
    if (l) { choisir(l, true); champ.blur(); }
  }
  champ.addEventListener('change', chercher);
  champ.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); chercher(); } });

  // ------------------------------------------------------------ démarrage
  function depuisAncre() {
    var id = decodeURIComponent(location.hash.slice(1));
    var l = id && lieux.find(function (l) { return l.li.id === id; });
    if (l) { carte.scrollIntoView({ block: 'start' }); choisir(l, true); }
  }
  var pret = false;
  if ('ResizeObserver' in window) new ResizeObserver(function () { if (pret) ajuste(true); }).observe(vue);
  else window.addEventListener('resize', function () { if (pret) ajuste(true); });
  ajuste(false);
  pret = true;
  carte.classList.add('carte--prete');
  window.addEventListener('hashchange', depuisAncre);
  depuisAncre();
})();
