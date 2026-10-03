// Le Registre d'Isidoro — recherche hors ligne et petits confort de lecture.
(function () {
  'use strict';
  var racine = document.body.getAttribute('data-racine') || '';

  // ------------------------------------------------------------ point de vue
  // Isidoro (par défaut), Théodoric, Monde ou Tout. Chaque information étiquetée
  // data-savoir="isidoro|theodoric|mj" n'apparaît que dans les vues concernées.
  var NOMS = { isidoro: 'Isidoro', theodoric: 'Théodoric', monde: 'Monde', tout: 'Tout' };
  var ETIQUETTE_VUE = { isidoro: 'isidoro', theodoric: 'theodoric', monde: 'mj' };
  var html = document.documentElement;

  function vueCourante() {
    var v = html.getAttribute('data-vue');
    return NOMS[v] ? v : 'isidoro';
  }
  function visiblePourVue(savoir, vue) {
    if (!savoir || vue === 'tout') return true;
    return (' ' + savoir + ' ').indexOf(' ' + ETIQUETTE_VUE[vue] + ' ') !== -1;
  }
  function estCache(el) { return !el.getClientRects().length; }

  function majAvis() {
    var vue = vueCourante();
    var avis = document.querySelector('.avis-filtre');
    // Le sommaire ne propose que les sections visibles.
    document.querySelectorAll('.sommaire a').forEach(function (a) {
      var cible = document.getElementById(decodeURIComponent(a.hash.slice(1)));
      a.parentNode.hidden = !!(cible && vue !== 'tout' && estCache(cible));
    });
    if (!avis) return;
    if (vue === 'tout' || document.body.hasAttribute('data-savoir-page') && !visiblePourVue(document.body.getAttribute('data-savoir-page'), vue)) {
      avis.hidden = true; return;
    }
    var masques = 0;
    document.querySelectorAll('#contenu [data-savoir]').forEach(function (el) {
      if (visiblePourVue(el.getAttribute('data-savoir'), vue)) return;
      var parent = el.parentElement && el.parentElement.closest('[data-savoir]');
      if (parent && !visiblePourVue(parent.getAttribute('data-savoir'), vue)) return;
      masques++;
    });
    if (!masques) { avis.hidden = true; return; }
    avis.innerHTML = '<p>Point de vue <b>' + NOMS[vue] + '</b> : ' + masques + (masques > 1 ? ' informations masquées' : ' information masquée') +
      ' sur cette page. <button type="button" data-choisir-vue="tout">Tout afficher</button></p>';
    avis.hidden = false;
  }

  function choisirVue(v) {
    if (!NOMS[v]) v = 'isidoro';
    html.setAttribute('data-vue', v);
    try { localStorage.setItem('registre-vue', v); } catch (e) { /* stockage indisponible : le choix vaut pour cette page */ }
    document.querySelectorAll('.vue [data-choisir-vue]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-choisir-vue') === v ? 'true' : 'false');
    });
    majAvis();
    if (champ && champ.value) chercher(champ.value);
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-choisir-vue]');
    if (b) choisirVue(b.getAttribute('data-choisir-vue'));
  });

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
  choisirVue(vueCourante());
  if (!champ || !boite) return;

  var index = null, chargement = null, actif = -1, synonymes = {};

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
          return { p: e.p, s: e.s, u: e.u, x: e.x, v: e.v || '', n: normaliser(e.p + ' ' + e.s + ' ' + e.x + ' ' + (e.k || '')), t: normaliser(e.p + ' ' + e.s), k: normaliser(e.k || '') };
        });
        // Synonymes : groupes de mots équivalents (orthographes, fautes de dictée, termes VO).
        (window.SYNONYMES || []).forEach(function (groupe) {
          var g = groupe.map(normaliser);
          g.forEach(function (m) { synonymes[m] = (synonymes[m] || []).concat(g); });
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
  function alternatives(mot) {
    var res = [mot];
    Object.keys(synonymes).forEach(function (cle) {
      if (cle === mot || (mot.length >= 4 && cle.indexOf(mot) === 0)) res = res.concat(synonymes[cle]);
    });
    return res.filter(function (m, i) { return res.indexOf(m) === i; });
  }
  function chercher(q) {
    var mots = normaliser(q).split(/\s+/).filter(function (m) { return m.length > 1; });
    if (!mots.length) { fermer(); return; }
    charger().then(function (idx) {
      var res = [];
      var vue = vueCourante();
      idx.forEach(function (e) {
        if (!visiblePourVue(e.v, vue)) return;
        var score = 0;
        for (var i = 0; i < mots.length; i++) {
          var variantes = alternatives(mots[i]), trouve = false;
          for (var j = 0; j < variantes.length; j++) {
            var w = variantes[j];
            if (e.n.indexOf(w) === -1) continue;
            trouve = true;
            if (e.t.indexOf(w) !== -1) score += 5;
            if (e.k.indexOf(w) !== -1) score += 3;
            score += Math.min(5, e.n.split(w).length - 1);
            break;
          }
          if (!trouve) return;
        }
        res.push({ e: e, score: score });
      });
      res.sort(function (a, b) { return b.score - a.score; });
      afficher(res.slice(0, 30), mots.reduce(function (t, m) { return t.concat(alternatives(m)); }, []));
    });
  }
  function afficher(res, mots) {
    actif = -1;
    if (!res.length) {
      boite.innerHTML = '<p class="recherche__vide">Rien trouvé' + (vueCourante() !== 'tout' ? ' dans le point de vue ' + NOMS[vueCourante()] + ' (essayez « Tout »)' : '') + '. Essayez aussi une orthographe proche (Saelmur, Alcatar, Kismet…).</p>';
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
