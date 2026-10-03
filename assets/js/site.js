// Le Registre d'Isidoro — recherche hors ligne et petits confort de lecture.
(function () {
  'use strict';
  var racine = document.body.getAttribute('data-racine') || '';

  // ------------------------------------------------------------ sommaire
  var sommaire = document.querySelector('.sommaire details');
  if (sommaire && window.matchMedia('(max-width: 1099px)').matches) sommaire.removeAttribute('open');

  var liens = Array.prototype.slice.call(document.querySelectorAll('.sommaire a'));
  if (liens.length && 'IntersectionObserver' in window) {
    var parId = {};
    liens.forEach(function (a) { parId[decodeURIComponent(a.hash.slice(1))] = a; });
    var visibles = new Set();
    var obs = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) { if (e.isIntersecting) visibles.add(e.target.id); else visibles.delete(e.target.id); });
      var titres = document.querySelectorAll('.texte h2[id], .texte h3[id]');
      var courant = null;
      for (var i = 0; i < titres.length; i++) {
        if (titres[i].getBoundingClientRect().top < window.innerHeight * 0.35) courant = titres[i].id;
      }
      liens.forEach(function (a) { a.classList.remove('actif'); });
      if (courant && parId[courant]) parId[courant].classList.add('actif');
    }, { rootMargin: '0px 0px -60% 0px' });
    document.querySelectorAll('.texte h2[id], .texte h3[id]').forEach(function (h) { obs.observe(h); });
  }

  // ------------------------------------------------------------ recherche
  var champ = document.getElementById('recherche');
  var boite = document.getElementById('recherche-resultats');
  if (!champ || !boite) return;

  var index = null, chargement = null, actif = -1;

  function normaliser(s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, "'");
  }
  function charger() {
    if (index) return Promise.resolve(index);
    if (chargement) return chargement;
    chargement = new Promise(function (ok, ko) {
      var s = document.createElement('script');
      s.src = racine + 'assets/js/recherche-index.js';
      s.onload = function () {
        index = (window.RECHERCHE || []).map(function (e) {
          return { p: e.p, s: e.s, u: e.u, x: e.x, n: normaliser(e.p + ' ' + e.s + ' ' + e.x), t: normaliser(e.p + ' ' + e.s) };
        });
        ok(index);
      };
      s.onerror = ko;
      document.head.appendChild(s);
    });
    return chargement;
  }
  function echapper(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function extrait(texte, mots) {
    var n = normaliser(texte);
    var pos = -1;
    for (var i = 0; i < mots.length && pos < 0; i++) pos = n.indexOf(mots[i]);
    var debut = Math.max(0, pos - 70);
    var morceau = texte.slice(debut, debut + 220);
    var nm = normaliser(morceau);
    var marques = [];
    mots.forEach(function (m) {
      var j = 0;
      while ((j = nm.indexOf(m, j)) !== -1) { marques.push([j, j + m.length]); j += m.length; }
    });
    marques.sort(function (a, b) { return a[0] - b[0]; });
    var html = '', curseur = 0;
    marques.forEach(function (m) {
      if (m[0] < curseur) return;
      html += echapper(morceau.slice(curseur, m[0])) + '<mark>' + echapper(morceau.slice(m[0], m[1])) + '</mark>';
      curseur = m[1];
    });
    html += echapper(morceau.slice(curseur));
    return (debut > 0 ? '… ' : '') + html + (debut + 220 < texte.length ? ' …' : '');
  }
  function chercher(q) {
    var mots = normaliser(q).split(/\s+/).filter(function (m) { return m.length > 1; });
    if (!mots.length) { fermer(); return; }
    charger().then(function (idx) {
      var res = [];
      idx.forEach(function (e) {
        var score = 0;
        for (var i = 0; i < mots.length; i++) {
          if (e.n.indexOf(mots[i]) === -1) return;
          if (e.t.indexOf(mots[i]) !== -1) score += 5;
          score += Math.min(5, e.n.split(mots[i]).length - 1);
        }
        res.push({ e: e, score: score });
      });
      res.sort(function (a, b) { return b.score - a.score; });
      afficher(res.slice(0, 30), mots);
    });
  }
  function afficher(res, mots) {
    actif = -1;
    if (!res.length) {
      boite.innerHTML = '<p class="recherche__vide">Rien trouvé. Essayez un autre nom ou une orthographe proche (Saelmur, Alcatar, Kismet…).</p>';
    } else {
      boite.innerHTML = '<ol>' + res.map(function (r) {
        var lieu = r.e.p + (r.e.s && r.e.s !== r.e.p ? ' — ' + r.e.s : '');
        return '<li><a href="' + racine + r.e.u + '"><span class="recherche__lieu">' + echapper(lieu) + '</span><span class="recherche__extrait">' + extrait(r.e.x, mots) + '</span></a></li>';
      }).join('') + '</ol>';
    }
    boite.hidden = false;
    champ.setAttribute('aria-expanded', 'true');
  }
  function fermer() { boite.hidden = true; boite.innerHTML = ''; champ.setAttribute('aria-expanded', 'false'); }
  function deplacer(d) {
    var items = boite.querySelectorAll('a');
    if (!items.length) return;
    if (actif >= 0) items[actif].classList.remove('actif');
    actif = (actif + d + items.length) % items.length;
    items[actif].classList.add('actif');
    items[actif].scrollIntoView({ block: 'nearest' });
  }

  var minuterie;
  champ.addEventListener('focus', function () { charger(); });
  champ.addEventListener('input', function () {
    clearTimeout(minuterie);
    var q = champ.value;
    minuterie = setTimeout(function () { chercher(q); }, 120);
  });
  champ.addEventListener('keydown', function (ev) {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); deplacer(1); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); deplacer(-1); }
    else if (ev.key === 'Enter') {
      var items = boite.querySelectorAll('a');
      if (items.length) { ev.preventDefault(); window.location.href = items[Math.max(0, actif)].href; }
    } else if (ev.key === 'Escape') { fermer(); champ.blur(); }
  });
  document.addEventListener('click', function (ev) {
    if (!ev.target.closest || !ev.target.closest('.recherche')) fermer();
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === '/' && document.activeElement !== champ && !/input|textarea/i.test(document.activeElement.tagName)) {
      ev.preventDefault(); champ.focus();
    }
  });
})();
