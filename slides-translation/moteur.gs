/**
 * MOTEUR — stable. À ne modifier que pour corriger le moteur lui-même.
 * Aucune traduction ici : il ne connaît que des tables qu'on lui passe.
 *
 * Projet Apps Script "Traduction Slides Mercateam" — fichier 1 sur 3.
 * Les trois fichiers partagent la même portée globale : l'ordre n'importe pas.
 * Voir README.md pour la marche à suivre.
 */

// ---------------------------------------------------------------------------
// MOTEUR
// ---------------------------------------------------------------------------

/**
 * POINT D'ENTRÉE PRINCIPAL — c'est cette fonction qu'il faut exécuter.
 * Renomme les copies à harmoniser, puis applique les traductions.
 */
function runAll() {
  renameAll();
  translateAll();
}

// Apps Script coupe une exécution à 6 minutes. Un deck coûte de 600 à 1100
// appels API, soit 1 h 30 à 3 minutes selon la latence du jour — trop variable
// pour un seuil fixe. On mesure donc la durée réelle des jobs déjà passés et on
// ne démarre le suivant que s'il a le temps de finir. Les jobs terminés sont
// retenus pour que la relance reprenne où elle s'était arrêtée.
var SAFE_DEADLINE_MS = 330 * 1000;   // 5 min 30, marge sur la coupure à 6 min
var DUREE_SUPPOSEE_MS = 180 * 1000;  // estimation tant qu'aucun job n'a tourné

/**
 * Traite les jobs de getJobs() qui ne l'ont pas déjà été.
 * Relancer autant de fois que le journal le demande.
 */
function translateAll() {
  var props = PropertiesService.getScriptProperties();
  var done = JSON.parse(props.getProperty('jobsDone') || '[]');
  var t0 = new Date().getTime();
  var pending = [];
  var pire = DUREE_SUPPOSEE_MS;

  getJobs().forEach(function (job) {
    if (done.indexOf(job.fileId) !== -1) {
      Logger.log('déjà traité, ignoré : ' + job.label);
      return;
    }
    var debut = new Date().getTime();
    if (pending.length || debut - t0 + pire > SAFE_DEADLINE_MS) {
      pending.push(job.label);
      return;
    }
    Logger.log(translateOne(job));
    pire = Math.max(pire, new Date().getTime() - debut);
    done.push(job.fileId);
    props.setProperty('jobsDone', JSON.stringify(done));
  });

  Logger.log(pending.length
    ? '>>> TEMPS ÉCOULÉ — relancer runAll pour continuer. Reste : ' + pending.join(', ')
    : '>>> Tous les jobs sont traités.');
}

/** Oublie les jobs déjà traités, pour tout reprendre de zéro. */
function resetProgress() {
  PropertiesService.getScriptProperties().deleteProperty('jobsDone');
  Logger.log('progression remise à zéro');
}

/**
 * Harmonise les titres des copies ES : "Sitio" -> "Planta".
 * Idempotent : relancer le script ne renomme pas deux fois.
 */
function renameAll() {
  RENAMES.forEach(function (r) {
    var file = DriveApp.getFileById(r.fileId);
    var before = file.getName();
    if (before === r.title) {
      Logger.log('titre déjà à jour : ' + before);
      return;
    }
    file.setName(r.title);
    Logger.log('renommé : ' + before + '  ->  ' + r.title);
  });
}

/**
 * Applique une table de traduction à une présentation, en deux passes.
 *
 * Passe 1 : chaque texte français est remplacé par une sentinelle unique.
 * Passe 2 : chaque sentinelle est remplacée par sa traduction.
 *
 * Le détour par les sentinelles est indispensable : la recherche de l'API
 * Slides ignore les accents, si bien qu'une entrée courte peut réécrire la
 * traduction déjà posée par une entrée longue. "Informé" -> "Informado"
 * mordait ainsi sur le "Informe de auditoría" produit juste avant. Une
 * sentinelle en ASCII ne peut être touchée par aucune entrée française.
 */
function translateOne(job) {
  var t0 = new Date().getTime();
  var pres = SlidesApp.openById(job.fileId);
  // COMMON et les tables de deck se recouvrent volontairement. Sans ce filtre,
  // chaque doublon coûterait deux appels API pour ne rien trouver.
  var vus = {};
  var pairs = job.map.filter(function (pair) {
    if (vus[pair[0]]) return false;
    vus[pair[0]] = true;
    return true;
  }).sort(function (a, b) {
    return b[0].length - a[0].length;
  });

  var scan = newScan();
  var extras = collectExtras(pres, scan);
  var errors = [];

  // Passe 1 — français vers sentinelles.
  //
  // Sur les slides, aucun filtrage : pres.replaceAllText() les couvre toutes
  // en un seul appel, et filtrer sur le texte relevé ferait sauter tout ce que
  // le relevé n'a pas su lire. C'est ce qui avait laissé les "S1 / S2 / S3" de
  // la feuille de route en français, alors que le "S4" présent ailleurs dans
  // une forme lisible, lui, passait.
  //
  // Sur les notes, masques et mises en page, le filtrage reste nécessaire —
  // un appel par page et par entrée serait bien trop lent — et on note quelles
  // pages ont reçu quelle sentinelle pour que la passe 2 les retrouve.
  var placed = [];

  pairs.forEach(function (pair, i) {
    var token = sentinel(i);
    placed[i] = [];
    variants(pair[0]).forEach(function (v) {
      replaceOn(pres, 'slides', v, token, errors);
      extras.forEach(function (e) {
        if (e.text && e.text.indexOf(v) !== -1) {
          replaceOn(e.page, e.label, v, token, errors);
          if (placed[i].indexOf(e) === -1) placed[i].push(e);
        }
      });
    });
  });

  // Passe 2 — sentinelles vers traductions. Sans filtrage : une sentinelle
  // posée dans une forme illisible doit être retirée coûte que coûte, sinon
  // elle resterait affichée telle quelle dans la présentation.
  pairs.forEach(function (pair, i) {
    var token = sentinel(i);
    replaceOn(pres, 'slides', token, pair[1], errors);
    placed[i].forEach(function (e) {
      replaceOn(e.page, e.label, token, pair[1], errors);
    });
  });

  pres.saveAndClose();

  // Vérification par relecture. Le compte renvoyé par replaceAllText n'est pas
  // fiable — il vaut 0 alors que le remplacement a bien eu lieu — donc on
  // rouvre la présentation et on regarde ce qui reste réellement.
  var after = newScan();
  var check = SlidesApp.openById(job.fileId);
  var text = '';
  check.getSlides().forEach(function (slide) { text += '\n' + pageText(slide, after); });

  var untranslated = pairs.filter(function (pair) {
    return text.indexOf(pair[0]) !== -1;
  }).map(function (pair) { return pair[0]; });

  var stuck = text.indexOf(SENTINEL_MARK) !== -1;
  var seconds = Math.round((new Date().getTime() - t0) / 1000);

  // Le contrôle ci-dessus ne voit que le français pour lequel une entrée
  // existe : une phrase oubliée dans la table resterait invisible. Ce second
  // passage cherche des mots franco-spécifiques, absents de l'anglais comme de
  // l'espagnol, pour signaler ce qui manque encore à traduire.
  var suspects = text.split('\n').map(function (l) { return l.trim(); })
    .filter(function (l) {
      return l && /(^|[^A-Za-zÀ-ÿ])(des|du|aux|vos|votre|leurs|qui|avec|pour|être|chaque|selon|toutes)([^A-Za-zÀ-ÿ]|$)/.test(l);
    });
  suspects = dedupe(suspects);

  var report = [
    '=== ' + job.label + ' (' + job.fileId + ') ===',
    'terminé en ' + seconds + ' s — ' + pairs.length + ' entrées appliquées, '
      + 'vérification sur ' + after.elements + ' éléments relus',
    untranslated.length
      ? 'ENCORE EN FRANÇAIS (' + untranslated.length + ') :\n  - ' + untranslated.join('\n  - ')
      : 'Plus aucun texte français détecté.'
  ];
  if (stuck) {
    report.push('!!! SENTINELLES RESTANTES DANS LA PRÉSENTATION — lancer cleanupSentinels()');
  }
  if (suspects.length) {
    report.push('RÉSIDU FRANÇAIS POSSIBLE — texte sans entrée dans la table ('
      + suspects.length + ') :\n  ~ ' + suspects.slice(0, 15).join('\n  ~ '));
  }
  if (scan.errors.length || after.errors.length) {
    report.push('RELEVÉ INCOMPLET — ' + (scan.errors.length + after.errors.length)
      + ' éléments illisibles, leur contenu ne peut pas être vérifié :\n  - '
      + dedupe(scan.errors.concat(after.errors)).join('\n  - '));
  }
  if (errors.length) {
    report.push('ERREURS TOLÉRÉES (' + errors.length + ') :\n  - '
      + dedupe(errors).join('\n  - '));
  }
  return report.join('\n');
}

var SENTINEL_MARK = '@@zz';

/** Jeton unique et purement ASCII, insensible aux accents et à la casse. */
function sentinel(i) {
  return SENTINEL_MARK + (1000 + i) + '@@';
}

/** Un remplacement tolérant : une page qui refuse n'arrête pas le traitement. */
function replaceOn(target, label, find, replace, errors) {
  try {
    target.replaceAllText(find, replace, true);
  } catch (e) {
    errors.push(label + ' : ' + e.message);
  }
}

/**
 * Retire les sentinelles qu'un plantage en cours de route aurait laissées.
 * À ne lancer qu'en cas de message "SENTINELLES RESTANTES".
 */
function cleanupSentinels() {
  getJobs().concat(getFixups()).forEach(function (job) {
    var pres = SlidesApp.openById(job.fileId);
    var pairs = job.map.slice().sort(function (a, b) { return b[0].length - a[0].length; });
    pairs.forEach(function (pair, i) {
      try { pres.replaceAllText(sentinel(i), pair[1], true); } catch (e) {}
    });
    pres.saveAndClose();
    Logger.log('sentinelles nettoyées : ' + job.label);
  });
}

function newScan() {
  return { chars: 0, elements: 0, errors: [] };
}

/** Notes, masques et mises en page, avec leur texte relevé une fois pour toutes. */
function collectExtras(pres, scan) {
  var extras = [];
  pres.getSlides().forEach(function (slide, i) {
    var notes = slide.getNotesPage();
    if (notes) extras.push({ page: notes, label: 'notes slide ' + (i + 1) });
  });
  pres.getMasters().forEach(function (master, i) {
    extras.push({ page: master, label: 'masque ' + (i + 1) });
    master.getLayouts().forEach(function (layout, j) {
      extras.push({ page: layout, label: 'mise en page ' + (i + 1) + '.' + (j + 1) });
    });
  });
  extras.forEach(function (e) { e.text = pageText(e.page, scan); });
  return extras;
}

function dedupe(list) {
  var seen = {};
  return list.filter(function (x) {
    if (seen[x]) return false;
    seen[x] = true;
    return true;
  });
}

/** Relève tout le texte d'une page (slide, notes, masque ou mise en page). */
function pageText(page, scan) {
  var out = [];
  try {
    collectText(page.getPageElements(), out, scan);
  } catch (e) {
    scan.errors.push('getPageElements : ' + e.message);
  }
  var text = out.join('\n');
  scan.chars += text.length;
  return text;
}

/**
 * Parcourt les éléments d'une page, en descendant dans les groupes.
 *
 * Le type est comparé via String() et non par identité : les valeurs
 * d'énumération d'Apps Script ne survivent pas à une comparaison ===, ce qui
 * ferait silencieusement renvoyer un relevé vide.
 */
function collectText(elements, out, scan) {
  elements.forEach(function (el) {
    scan.elements++;
    var type = 'inconnu';
    try {
      type = String(el.getPageElementType());
      if (type === 'SHAPE') {
        out.push(el.asShape().getText().asString());
      } else if (type === 'TABLE') {
        var t = el.asTable();
        for (var r = 0; r < t.getNumRows(); r++) {
          for (var c = 0; c < t.getNumColumns(); c++) {
            out.push(t.getCell(r, c).getText().asString());
          }
        }
      } else if (type === 'GROUP') {
        collectText(el.asGroup().getChildren(), out, scan);
      }
      // IMAGE, LINE, VIDEO, SHEETS_CHART, WORD_ART : aucun texte remplaçable
    } catch (e) {
      scan.errors.push(type + ' : ' + e.message);
    }
  });
}

/**
 * Génère les variantes typographiques d'une chaîne à chercher.
 *
 * Google Slides mélange apostrophes droites et courbes, espaces fines
 * insécables avant la ponctuation double, et sauts de ligne durs (\n) ou
 * souples (\v). Une recherche exacte échouerait sur ces différences
 * invisibles : on essaie donc toutes les formes plausibles.
 */
function variants(s) {
  var out = [s];

  function expand(fn) {
    out.slice().forEach(function (x) {
      var y = fn(x);
      if (y !== x && out.indexOf(y) === -1) out.push(y);
    });
  }

  expand(function (x) { return x.replace(/'/g, '\u2019'); });              // ' -> apostrophe courbe
  expand(function (x) { return x.replace(/\u2019/g, "'"); });              // apostrophe courbe -> '
  expand(function (x) { return x.replace(/ ([:;!?])/g, '\u00A0$1'); });    // espace insecable
  expand(function (x) { return x.replace(/ ([:;!?])/g, '\u202F$1'); });    // espace fine insecable
  expand(function (x) { return x.replace(/ (\u2014) /g, '\u00A0$1\u00A0'); }); // tiret cadratin, espaces insécables
  expand(function (x) { return x.replace(/ (\u2014) /g, '\u202F$1\u202F'); }); // tiret cadratin, espaces fines
  expand(function (x) { return x.replace(/\n/g, ' '); });                  // saut dur -> espace
  expand(function (x) { return x.replace(/\n/g, '\u000B'); });             // saut dur -> saut souple

  return out;
}
