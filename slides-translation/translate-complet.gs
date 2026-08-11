/**
 * FICHIER COMPLET — À COLLER TEL QUEL DANS UN PROJET APPS SCRIPT UNIQUE.
 *
 * Généré par concaténation de moteur.gs + glossaire.gs + jobs.gs, qui restent
 * la source de référence dans le dépôt. Ne pas éditer ce fichier à la main :
 * régénérer avec
 *
 *     cat moteur.gs glossaire.gs jobs.gs > translate-complet.gs
 */


// ===========================================================================
// ==  moteur.gs
// ===========================================================================

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
  expand(function (x) { return x.replace(/ /g, '\u00A0'); });              // tous les espaces insécables
  expand(function (x) { return x.replace(/ /g, '\u202F'); });              // tous les espaces fins
  expand(function (x) { return x.replace(/\n/g, ' '); });                  // saut dur -> espace
  expand(function (x) { return x.replace(/\n/g, '\u000B'); });             // saut dur -> saut souple

  return out;
}

// ===========================================================================
// ==  glossaire.gs
// ===========================================================================

/**
 * GLOSSAIRE — le vocabulaire Mercateam, réutilisable d'un deck à l'autre.
 *
 * C'est le seul fichier qui a de la valeur sur la durée : chaque nouveau lot
 * de decks l'enrichit, et un deck qui reprend les blocs habituels (feuille de
 * route, équipe projet, RACI, MercaNews, critères de Go Live, témoignages)
 * est déjà traduit à 80 %% rien qu'avec lui.
 *
 * Ne jamais retirer une entrée : un ancien deck pourrait en dépendre.
 *
 * Projet Apps Script "Traduction Slides Mercateam" — fichier 2 sur 3.
 * Les trois fichiers partagent la même portée globale : l'ordre n'importe pas.
 * Voir README.md pour la marche à suivre.
 */

// ---------------------------------------------------------------------------
// COMMON — entrées partagées par tous les decks de déploiement
//
// Ces blocs (feuille de route, équipe Mercateam, équipe partenaire, étapes,
// RACI, nos attentes, MercaNews) sont identiques d'un deck à l'autre. Les
// tables par deck ne portent que le contenu qui leur est propre et sont
// concaténées à celle-ci dans getJobs().
//
// Une entrée dupliquée entre COMMON et une table de deck est sans effet :
// la seconde ne trouve plus rien à remplacer. En cas de traductions
// divergentes, c'est celle de COMMON qui gagne.
// ---------------------------------------------------------------------------

var COMMON_EN = [
  // Couverture
  ['Vos collaborateurs', 'Your people'],
  ['au cœur de votre réussite.', 'at the heart of your success.'],
  ['// usine de XXX', '// XXX plant'],

  // MercaNews
  ['PRODUIT', 'PRODUCT'],
  ["Mercateam est officiellement adhérent au GIFAS. Un gage de confiance pour le secteur de l’aéro-défense.",
   'Mercateam is now officially a GIFAS member. A mark of trust for the aerospace & defence sector.'],
  ['Annonce', 'Announcement'],
  ['Événement communauté', 'Community event'],
  ["Notre rendez-vous annuel\nclients & partenaires, pour\néchanger, partager vos\npratiques et rencontrer\nl'équipe Mercateam.",
   'Our annual client & partner\ngathering, to exchange,\nshare your practices\nand meet the\nMercateam team.'],
  ['Paris – 4 novembre', 'Paris – 4 November'],
  ['ÉVÉNEMENT', 'EVENT'],
  ['MercaNews | Été 2026', 'MercaNews | Summer 2026'],
  ['WhatsApp & SMS / assistant RH', 'WhatsApp & SMS / HR assistant'],
  ['Contactez vos opérateurs instantanément, sans adresse email. Moins de friction, une communication plus fluide sur le terrain.',
   'Reach your operators instantly, without an email address. Less friction, smoother communication on the shop floor.'],
  ['Disponible', 'Available'],
  ['Pre-onboarding (onboarding J-1 )', 'Pre-onboarding (day-before onboarding)'],
  ['Vos opérateurs arrivent formés dès', 'Your operators arrive fully trained'],
  ["le premier jour. Vos équipes RH reprennent du temps sur les tâches d'intégration.",
   'on day one. Your HR teams win back time on onboarding tasks.'],
  ["Notre CEO a présenté toutes nos innovations disponibles et à venir lors d'un webinar réservé aux clients Mercateam.",
   'Our CEO presented all our available and upcoming innovations in a webinar for Mercateam customers.'],
  ['Voir le replay', 'Watch the replay'],
  ['Adrien Laurentin (Mercateam) et Mathieu Sanguinetti (DRH Isolation, Saint-Gobain): remettre les cols bleus aux commandes de leur carrière.',
   'Adrien Laurentin (Mercateam) and Mathieu Sanguinetti (HR Director, Isolation, Saint-Gobain): putting blue-collar workers back in charge of their careers.'],
  ["Écouter l’épisode", 'Listen to the episode'],
  ['Podcast Dimensions RH avec Saint-Gobain', 'Dimensions RH podcast with Saint-Gobain'],

  // Feuille de route
  ['MÉTHODOLOGIE', 'METHODOLOGY'],
  ['Feuille de route suggérée', 'Suggested roadmap'],
  ['Préparation au kick-off', 'Kick-off preparation'],
  ['COPIL, points hebdomadaires, Bilan', 'Steering committee, weekly meetings, Review'],
  ['Bilan déploiement', 'Deployment review'],
  ['Intégration des données', 'Data integration'],
  ['Intégration de données', 'Data integration'],
  ["Ateliers pratiques et prise en main de l’outil par groupes de travail",
   'Hands-on workshops and tool onboarding by working groups'],
  ["Phase d’autonomie", 'Autonomy phase'],
  ['Paramétrage technique', 'Technical configuration'],
  ['Interfaçage, SSO', 'Interfacing, SSO'],
  ['Kit de déploiement', 'Deployment kit'],
  ["Rapport d’audit", 'Audit report'],
  ['Rapport bilan & montée en maturité', 'Review report & maturity growth'],
  ['Modes opératoires', 'Standard operating procedures'],
  ['Livrables', 'Deliverables'],
  ['Gouvernance', 'Governance'],
  ['Paramétrage', 'Configuration'],
  ['Formation', 'Training'],
  ['Visite', 'Visit'],
  ['S-3', 'W-3'],
  ['S-2', 'W-2'],
  ['S-1', 'W-1'],
  ['S1', 'W1'],
  ['S2', 'W2'],
  ['S3', 'W3'],
  ['S4', 'W4'],

  // Équipe Mercateam
  ['Une équipe dédiée à chaque phase de votre projet', 'A dedicated team for every phase of your project'],
  ['ÉQUIPE MERCATEAM', 'MERCATEAM TEAM'],
  ["Notre équipe d'experts vous accompagne", 'Our team of experts supports you'],
  ["Notre équipe d'experts", 'Our team of experts'],
  ['CADRER LA RELATION', 'FRAMING THE RELATIONSHIP'],
  ['Responsable\npartenaire', 'Partnership\nLead'],
  ['Construit un partenariat aligné sur vos enjeux et vos attentes.', 'Builds a partnership aligned with your challenges and expectations.'],
  ['Aligne nos équipes sur vos enjeux', 'Aligns our teams with your challenges'],
  ['Initie et structure le partenariat', 'Initiates and structures the partnership'],
  ['Interlocuteur de référence', 'Main point of contact'],
  ['CONNECTER VOS SYSTÈMES', 'CONNECTING YOUR SYSTEMS'],
  ['Expert\nintégration & IT', 'Integration & IT\nexpert'],
  ['Connecte vos systèmes pour une donnée unique et toujours à jour.', 'Connects your systems for single, always up-to-date data.'],
  ['SSO, interfaçage SIRH / ERP', 'SSO, HRIS / ERP interfacing'],
  ['Flux de données et automatisations', 'Data flows and automations'],
  ['Support technique projet', 'Project technical support'],
  ['ACCOMPAGNER LA MATURITÉ', 'SUPPORTING MATURITY'],
  ["Pérennise l'usage et le transforme en ROI mesurable.", 'Sustains usage and turns it into measurable ROI.'],
  ['Support continu post-déploiement', 'Ongoing post-deployment support'],
  ['Atteinte de vos objectifs ROI', 'Achievement of your ROI targets'],
  ["Évolutions et nouveaux cas d'usage", 'Enhancements and new use cases'],
  ['DÉPLOYER LA SOLUTION & AUTONOMIE', 'DEPLOYING THE SOLUTION & AUTONOMY'],
  ['Consultant(s)\nimplémentation', 'Implementation\nconsultant(s)'],
  ['Transforme vos process en une plateforme adoptée sur le terrain.', 'Turns your processes into a platform adopted on the shop floor.'],
  ['Coordination globale du déploiement', 'Overall deployment coordination'],
  ['Configuration de la plateforme', 'Platform configuration'],
  ['Adaptation aux spécificités métiers', 'Adaptation to business specifics'],
  ['Prénom Nom', 'First name Last name'],

  // Équipe partenaire
  ['ÉQUIPE PARTENAIRE', 'PARTNER TEAM'],
  ['Votre équipe projet (groupe)', 'Your project team (group)'],
  ['Votre équipe projet locale', 'Your local project team'],
  ['Pilote le projet sur le terrain', 'Drives the project on the ground'],
  ['Relai entre Mercateam & équipes', 'Link between Mercateam & teams'],
  ["S'approprie & challenge le paramétrage", 'Owns & challenges the configuration'],
  ['Co-anime les ateliers de formation', 'Co-facilitates the training workshops'],
  ['Utilisateurs clés', 'Key users'],
  ["Chefs d’équipe, RH, Qualité, HSE…", 'Team leaders, HR, Quality, HSE…'],
  ["Font vivre l'outil au quotidien", 'Keep the tool alive day to day'],
  ['Mettent en lumière process actuels & cibles', 'Highlight current & target processes'],
  ['Participent aux ateliers de formation', 'Take part in the training workshops'],
  ['Assurent la cohérence des données', 'Ensure data consistency'],
  ['Référent IT', 'IT contact'],
  ['Sécurise les aspects techniques', 'Secures the technical aspects'],
  ["Échanges avec l'équipe technique Mercateam", 'Liaises with the Mercateam technical team'],
  ['Remonte risques cybersécurité / techniques', 'Escalates cybersecurity / technical risks'],
  ['Fournit infos pour SSO / interconnexion', 'Provides info for SSO / interconnection'],
  ["Porte l'ambition du projet et arbitre", 'Carries the project ambition and arbitrates'],
  ['Fixe les objectifs et incarne le projet', 'Sets the objectives and embodies the project'],
  ['Arbitre les décisions clés', 'Arbitrates key decisions'],
  ['Lève les risques signalés par le Champion', 'Clears risks raised by the Champion'],
  ['Champion Groupe', 'Group Champion'],
  ["Pilote le déploiement à l'échelle du Groupe", 'Drives the deployment at Group level'],
  ['Coordonne les projets de chaque site', "Coordinates each site's project"],
  ['Définit les standards transverses', 'Defines cross-functional standards'],
  ["Capitalise les retours d'expérience", 'Captures lessons learned'],

  // Étapes du déploiement
  ['NOTRE MÉTHODOLOGIE', 'OUR METHODOLOGY'],
  ['Les étapes du déploiement', 'The deployment stages'],
  ['Durée', 'Duration'],
  ['Prérequis', 'Prerequisites'],
  ['Parties prenantes', 'Stakeholders'],
  ['Objectifs', 'Objectives'],
  ['Gouvernance et cadrage', 'Governance and framing'],
  ['1h / semaine', '1h / week'],
  ['Définir une équipe projet', 'Define a project team'],
  ['Sponsor lors des COPIL  (1 par mois recommandé)', 'Sponsor during steering committees (1 per month recommended)'],
  ['Cadrage projet', 'Project framing'],
  ['Définition des objectifs', 'Definition of objectives'],
  ["Suivi de l'avancée du déploiement", 'Deployment progress tracking'],
  ['3 semaines', '3 weeks'],
  ["Collecter les données d'intégration et compléter le template", 'Collect integration data and complete the template'],
  ['Paramétrage de la plateforme', 'Platform configuration'],
  ['2 à 3 jours', '2 to 3 days'],
  ["Organiser la visite et préparer le questionnaire d'audit", 'Organise the visit and prepare the audit questionnaire'],
  ['Rencontre équipe projet', 'Project team meeting'],
  ['Audit des process', 'Process audit'],
  ['Formation Mercateam', 'Mercateam training'],
  ['2-3h / semaine', '2-3h / week'],
  ['Mobiliser les utilisateurs clés en autonomie', 'Mobilise key users independently'],
  ["Formation outil et réponse aux cas d'usage", 'Tool training and use-case coverage'],
  ['1 à 3h', '1 to 3h'],
  ["+  temps d'implémentation", '+ implementation time'],
  ['Définir les besoins / risques IT', 'Define IT needs / risks'],
  ['Référent IT / HR IS', 'IT / HR IS contact'],
  ['Mise en place du SSO', 'SSO setup'],
  ['Interconnexion', 'Interconnection'],
  ['Autres points techniques', 'Other technical topics'],

  // Nos attentes
  ['Une mobilisation calibrée pour chaque acteur du projet et les facteurs clés de succès',
   'A calibrated commitment for every project stakeholder, and the key success factors'],
  ['+300 sites déployés', '+300 sites deployed'],
  ['NOS ATTENTES', 'OUR EXPECTATIONS'],
  ['Engagement', 'Commitment'],
  ['Implication des parties prenantes,', 'Stakeholder involvement,'],
  ['pratique autonome entre ateliers, soutien direction', 'independent practice between workshops, management support'],
  ['Respect des délais, allocation de ressources,', 'Meeting deadlines, resource allocation,'],
  ["disponibilité de l'équipe projet", 'project team availability'],
  ['Conduite du changement', 'Change management'],
  ['Communication fréquente, vision claire,', 'Frequent communication, clear vision,'],
  ['anticipation des résistances', 'anticipating resistance'],
  ['Ateliers de réflexion', 'Thinking workshops'],
  ['Pratique autonome', 'Independent practice'],
  ['Visite Audit', 'Audit visit'],
  ['Utilisateur clé', 'Key user'],
  ['Par semaine', 'Per week'],
  ["L'équation d'un déploiement réussi", 'The equation of a successful deployment'],
  ['J/H', 'PD'],

  // RACI
  ['RESPONSABILITÉS', 'RESPONSIBILITIES'],
  ['Une matrice RACI claire pour aligner les équipes projets', 'A clear RACI matrix to align the project teams'],
  ['Approbateur', 'Accountable'],
  ['Consulté', 'Consulted'],
  ['Informé', 'Informed'],
  ['Activités du projet', 'Project activities'],
  ['Lancement du projet : disponibilités des ressources, validation de la feuille de route',
   'Project launch: resource availability, roadmap approval'],
  ['Planification projet et tenue des délais', 'Project planning and meeting deadlines'],
  ['Livrables, CR & supports', 'Deliverables, minutes & materials'],
  ['Définition et suivi des objectifs de déploiement', 'Definition and tracking of deployment objectives'],
  ['Paramétrage & formation', 'Configuration & training'],
  ['Intégration & paramétrage plateforme', 'Platform integration & configuration'],
  ['Ateliers et formation des utilisateurs', 'Workshops and user training'],
  ['Pratique autonome & support', 'Independent practice & support'],
  ['Définition des besoins IT', 'Definition of IT needs'],
  ['Planification et suivi des actions IT', 'Planning and tracking of IT actions'],
  ['Utilisateurs', 'Users'],
  ['Responsable', 'Responsible'],

  ['Merci !', 'Thank you!'],

  // --- blocs partagés par les decks Kickoff / BILAN / COPIL / Hebdomadaires ---

  ["Lien d’inscription", 'Registration link'],
  ['Feuille de route', 'Roadmap'],
  ['Prochaines étapes', 'Next steps'],

  // Échelle de maturité
  ['Échelle de maturité', 'Maturity scale'],
  ['Informel / invisible', 'Informal / invisible'],
  ['Manuel, partiel', 'Manual, partial'],
  ['Structuré, opérationnel', 'Structured, operational'],
  ['Intégré, connecté', 'Integrated, connected'],
  ['Piloté, proactif', 'Managed, proactive'],

  // Tableau enjeux / maturité
  ['Maturité\nactuelle', 'Current\nmaturity'],
  ['Maturité cible', 'Target maturity'],
  ['Besoins terrains', 'Field needs'],
  ['Niveau\ncible', 'Target\nlevel'],
  ['Gains attendus', 'Expected gains'],
  ['Enjeux et objectifs du projet', 'Project challenges and objectives'],
  ['Enjeux', 'Challenges'],
  ['Protéger et pérenniser les savoir-faire critiques', 'Protect and secure critical know-how'],
  ['Accélérer et sécuriser la montée en autonomie', 'Speed up and secure the ramp-up to autonomy'],
  ['Installer une conformité permanente', 'Establish permanent compliance'],
  ['Sécuriser la continuité opérationnelle', 'Secure operational continuity'],
  ['Charge administrative ↓', 'Administrative burden ↓'],
  ['Anticipation des pertes de savoir-faire ↑', 'Anticipation of know-how loss ↑'],
  ['Charge admin de formation ↓', 'Training admin burden ↓'],
  ["Pénalités & temps d'audit évités", 'Penalties & audit time avoided'],
  ['Risque de non-conformité ↓', 'Non-compliance risk ↓'],
  ['Temps de planning ↓', 'Scheduling time ↓'],
  ['Sous & sur-staffing ↓', 'Under & overstaffing ↓'],

  // Critères de Go Live / plan d'action
  ['Action mise à jour', 'Action updated'],
  ['Action terminée', 'Action completed'],
  ['Critères de Go Live', 'Go Live criteria'],
  ['Date\ncible', 'Target\ndate'],
  ["Plan d'action", 'Action plan'],
  ["Plan d’action", 'Action plan'],
  ['100 % des collaborateurs actifs importés', '100% of active employees imported'],
  ['Importer les intérimaires', 'Import temporary workers'],
  ['100 % des bibliothèques compétences / habilitations digitalisées', '100% of skills / certifications libraries digitalised'],
  ['Planifier un atelier', 'Schedule a workshop'],
  ['100 % des postes créés et associés aux compétences/habilitations prérequises', '100% of workstations created and linked to the required skills/certifications'],
  ['100% des utilisateurs clés formés', '100% of key users trained'],
  ['La gouvernance (RACI et droits) est définie', 'Governance (RACI and rights) is defined'],
  ['Une feuille de route post-déploiement est définie', 'A post-deployment roadmap is defined'],
  ['100 % des matrices de compétences sont à jour', '100% of skills matrices are up to date'],
  ["→ Pilote sur les postes contrôle, hastamat et CDL avec Vanessa d'ici mi-janvier",
   '→ Pilot on the inspection, hastamat and CDL workstations with Vanessa by mid-January'],
  ['Atelier aux autres équipes vers la semaine du 13 janvier — à planifier', 'Workshop for the other teams around the week of 13 January — to be scheduled'],
  ['La liste des contenus / questionnaires à intégrer est définie', 'The list of content / questionnaires to load is defined'],
  ["100 % des matrices d'habilitation sont à jour", '100% of certification matrices are up to date'],
  ['Avoir prévenu et formé les utilisateurs clés', 'Have informed and trained the key users'],
  ['Avoir prévenu et formé les autres champions', 'Have informed and trained the other champions'],
  ['Les supports de formation du(des) poste(s) X sont digitalisés', 'The training materials for workstation(s) X are digitalised'],
  ["Former les chefs d'équipes référents", 'Train the lead team leaders'],
  ['Créer les compétences au poste', 'Create the workstation skills'],
  ['Définir les niveaux → Julie va communiquer', 'Define the levels → Julie will communicate'],
  ['Remplir les matrices compétences au poste 2×8 → voir les cde non clés', 'Fill in the 2-shift workstation skills matrices → check the non-key team leaders'],
  ["Les supports d'évaluation du(des) poste(s) X sont digitalisés", 'The assessment materials for workstation(s) X are digitalised'],
  ['Opt : X formations ont été lancées et suivies sur Mercateam', 'Opt: X trainings have been launched and tracked in Mercateam'],
  ["PLAN D’ACTION", 'ACTION PLAN'],
  ['CHIFFRES CLÉS', 'KEY FIGURES'],
  ["Suivi de l’adoption", 'Adoption tracking'],
  ['CEO & co-fondateur Mercateam', 'CEO & co-founder, Mercateam'],

  // Accomplissements / points d'attention
  ['Accomplissements', 'Achievements'],
  ["Points d'attention", 'Points of attention'],
  ['→ Matrices de compétences et fiches collaborateurs à jour et centralisées.', '→ Skills matrices and employee records up to date and centralised.'],

  // Témoignages
  ['DÉPLOIEMENT MERCATEAM · RESSOURCES', 'MERCATEAM DEPLOYMENT · RESOURCES'],
  ['Témoignages', 'Testimonials'],
  ["Découvrez les cas d’usage chez nos partenaires", 'Discover the use cases at our partners'],
  ['Découvrez les retours de nos partenaires', 'Discover feedback from our partners'],
  ['Lire la vidéo', 'Play video'],
  ['Digitalisation des compétences pour anticiper la perte de savoir-faire', 'Digitalising skills to anticipate know-how loss'],
  ['Digitalisation de\nla montée en\ncompétences pour valoriser le savoir-faire', 'Digitalising\nskills growth\nto showcase know-how'],
  ['Gestion du planning et utilisation de la donnée', 'Schedule management and use of data'],
  ['Luxe', 'Luxury'],
  ['Électronique', 'Electronics'],
  ['Centralisation des données et montée en polyvalence', 'Data centralisation and growth in versatility'],
  ['Cosmétique', 'Cosmetics'],
  ['Aéronautique', 'Aerospace'],
  ['Audits simplifiés et traçabilité des compétences', 'Simplified audits and skills traceability'],
  ['Manufacture', 'Manufacturing'],
  ['Gestion des compétences et des formations pour gagner en polyvalence', 'Skills and training management to gain versatility'],
  ["“Onboarding, instruction au poste, automatisation de la formation, l’outil nous a aidés à diviser par 4 notre temps de formation et son suivi.”",
   '“Onboarding, workstation instruction, training automation — the tool helped us cut our training time and its tracking by four.”'],
  ['Directeur industriel chez Trigano', 'Industrial Director at Trigano'],
  ["“Mercateam nous permet de sécuriser la polyvalence en accompagnant et la montée en compétence des collaborateurs.”",
   '“Mercateam lets us secure versatility while supporting our people’s skills growth.”'],
  ['Responsable de site chez SEB', 'Site Manager at SEB'],
  ["“Les managers gagnent une journée par semaine sur la réalisation des planning et nous donnent accès à une data cruciale pour améliorer la performance.”",
   '“Managers save a day a week on building schedules, and it gives us crucial data to improve performance.”'],
  ['Directeur industriel chez Dior', 'Industrial Director at Dior'],
  ["“On a passé notre dernier audit NADCAP sans aucun problème grâce à Mercateam !”",
   '“We passed our last NADCAP audit without a hitch thanks to Mercateam!”'],
  ['Coordinateur qualité chez LISI', 'Quality Coordinator at LISI'],
  ["“Je n'ai plus à m'inquiéter du suivi des habilitations et compétences critiques arrivant à échéance, Mercateam m’envoie un rappel plusieurs mois avant.”",
   '“I no longer have to worry about tracking certifications and critical skills coming up for renewal — Mercateam reminds me months in advance.”'],
  ['DRH chez Exxelia', 'HR Director at Exxelia'],
  ["“On tient enfin LE logiciel qui nous permet de devenir parfaits en terme de qualité et passer tous nos audits !”",
   '“We finally have THE software that lets us be flawless on quality and pass every audit!”'],
  ['Coordinateur qualité chez Shiseido', 'Quality Coordinator at Shiseido'],

  // Repérés à la relecture des copies, absents des premières tables.
  ['Logo client', 'Client logo'],
  // Le libellé GT vient de "groupe de travail" : il doit suivre WG en anglais,
  // sinon un même deck affiche WORKING GROUPS (WG) et une colonne GT.
  ['GT1', 'WG1'],
  ['GT2', 'WG2'],
  ['GT3', 'WG3'],
  ['GT4', 'WG4'],
  ['GT', 'WG']
];

var COMMON_ES = [
  // Portada
  ['Vos collaborateurs', 'Sus colaboradores'],
  ['au cœur de votre réussite.', 'en el centro de su éxito.'],
  ['// usine de XXX', '// planta de XXX'],
  ['Client logo', 'Logo del cliente'],

  // MercaNews
  ['PRODUIT', 'PRODUCTO'],
  ["Mercateam est officiellement adhérent au GIFAS. Un gage de confiance pour le secteur de l’aéro-défense.",
   'Mercateam es oficialmente miembro del GIFAS. Una garantía de confianza para el sector aeroespacial y de defensa.'],
  ['Annonce', 'Anuncio'],
  ['Événement communauté', 'Evento comunidad'],
  ["Notre rendez-vous annuel\nclients & partenaires, pour\néchanger, partager vos\npratiques et rencontrer\nl'équipe Mercateam.",
   'Nuestra cita anual con\nclientes y socios, para\nintercambiar, compartir sus\nprácticas y conocer al\nequipo Mercateam.'],
  ['Paris – 4 novembre', 'París – 4 de noviembre'],
  ['ÉVÉNEMENT', 'EVENTO'],
  ['MercaNews | Été 2026', 'MercaNews | Verano 2026'],
  ['WhatsApp & SMS / assistant RH', 'WhatsApp y SMS / asistente RRHH'],
  ['Contactez vos opérateurs instantanément, sans adresse email. Moins de friction, une communication plus fluide sur le terrain.',
   'Contacte con sus operarios al instante, sin dirección de correo. Menos fricción, una comunicación más fluida en el terreno.'],
  ['Pre-onboarding (onboarding J-1 )', 'Pre-onboarding (incorporación D-1)'],
  ['Vos opérateurs arrivent formés dès', 'Sus operarios llegan formados'],
  ["le premier jour. Vos équipes RH reprennent du temps sur les tâches d'intégration.",
   'desde el primer día. Sus equipos de RRHH recuperan tiempo en las tareas de incorporación.'],
  ["Notre CEO a présenté toutes nos innovations disponibles et à venir lors d'un webinar réservé aux clients Mercateam.",
   'Nuestro CEO presentó todas nuestras innovaciones disponibles y futuras en un webinar reservado a los clientes Mercateam.'],
  ['Voir le replay', 'Ver la repetición'],
  ['Adrien Laurentin (Mercateam) et Mathieu Sanguinetti (DRH Isolation, Saint-Gobain): remettre les cols bleus aux commandes de leur carrière.',
   'Adrien Laurentin (Mercateam) y Mathieu Sanguinetti (Director de RRHH Isolation, Saint-Gobain): devolver a los operarios el control de su carrera.'],
  ["Écouter l’épisode", 'Escuchar el episodio'],
  ['Podcast Dimensions RH avec Saint-Gobain', 'Podcast Dimensions RH con Saint-Gobain'],

  // Hoja de ruta
  ['MÉTHODOLOGIE', 'METODOLOGÍA'],
  ['Feuille de route suggérée', 'Hoja de ruta sugerida'],
  ['Préparation au kick-off', 'Preparación del kick-off'],
  ['COPIL, points hebdomadaires, Bilan', 'Comité de dirección, reuniones semanales, Balance'],
  ['Bilan déploiement', 'Balance del despliegue'],
  ['Intégration des données', 'Integración de datos'],
  ['Intégration de données', 'Integración de datos'],
  ["Ateliers pratiques et prise en main de l’outil par groupes de travail",
   'Talleres prácticos y toma de contacto con la herramienta por grupos de trabajo'],
  ["Phase d’autonomie", 'Fase de autonomía'],
  ['Paramétrage technique', 'Configuración técnica'],
  ['Interfaçage, SSO', 'Interconexión, SSO'],
  ['Kit de déploiement', 'Kit de despliegue'],
  ["Rapport d’audit", 'Informe de auditoría'],
  ['Rapport bilan & montée en maturité', 'Informe de balance y aumento de madurez'],
  ['Modes opératoires', 'Procedimientos operativos'],
  ['Livrables', 'Entregables'],
  ['Gouvernance', 'Gobernanza'],
  ['Paramétrage', 'Configuración'],
  ['Formation', 'Formación'],
  ['Visite', 'Visita'],

  // Equipo Mercateam
  ['Une équipe dédiée à chaque phase de votre projet', 'Un equipo dedicado a cada fase de su proyecto'],
  ['ÉQUIPE MERCATEAM', 'EQUIPO MERCATEAM'],
  ["Notre équipe d'experts vous accompagne", 'Nuestro equipo de expertos le acompaña'],
  ["Notre équipe d'experts", 'Nuestro equipo de expertos'],
  ['CADRER LA RELATION', 'ENMARCAR LA RELACIÓN'],
  ['Responsable\npartenaire', 'Responsable\nde Alianza'],
  ['Construit un partenariat aligné sur vos enjeux et vos attentes.', 'Construye una alianza alineada con sus retos y expectativas.'],
  ['Aligne nos équipes sur vos enjeux', 'Alinea nuestros equipos con sus retos'],
  ['Initie et structure le partenariat', 'Inicia y estructura la alianza'],
  ['Interlocuteur de référence', 'Interlocutor de referencia'],
  ['CONNECTER VOS SYSTÈMES', 'CONECTAR SUS SISTEMAS'],
  ['Expert\nintégration & IT', 'Experto en\nintegración e IT'],
  ['Connecte vos systèmes pour une donnée unique et toujours à jour.', 'Conecta sus sistemas para un dato único y siempre actualizado.'],
  ['SSO, interfaçage SIRH / ERP', 'SSO, interconexión SIRH / ERP'],
  ['Flux de données et automatisations', 'Flujos de datos y automatizaciones'],
  ['Support technique projet', 'Soporte técnico del proyecto'],
  ['ACCOMPAGNER LA MATURITÉ', 'ACOMPAÑAR LA MADUREZ'],
  ["Pérennise l'usage et le transforme en ROI mesurable.", 'Consolida el uso y lo transforma en un ROI medible.'],
  ['Support continu post-déploiement', 'Soporte continuo tras el despliegue'],
  ['Atteinte de vos objectifs ROI', 'Consecución de sus objetivos de ROI'],
  ["Évolutions et nouveaux cas d'usage", 'Evoluciones y nuevos casos de uso'],
  ['DÉPLOYER LA SOLUTION & AUTONOMIE', 'DESPLEGAR LA SOLUCIÓN Y AUTONOMÍA'],
  ['Consultant(s)\nimplémentation', 'Consultor(es) de\nimplementación'],
  ['Transforme vos process en une plateforme adoptée sur le terrain.', 'Transforma sus procesos en una plataforma adoptada en el terreno.'],
  ['Coordination globale du déploiement', 'Coordinación global del despliegue'],
  ['Configuration de la plateforme', 'Configuración de la plataforma'],
  ['Adaptation aux spécificités métiers', 'Adaptación a las particularidades del negocio'],
  ['Prénom Nom', 'Nombre Apellido'],

  // Equipo socio
  ['ÉQUIPE PARTENAIRE', 'EQUIPO SOCIO'],
  ['Votre équipe projet (groupe)', 'Su equipo de proyecto (grupo)'],
  ['Votre équipe projet locale', 'Su equipo de proyecto local'],
  ['Update the names of the partner project team', 'Actualice los nombres del equipo de proyecto del socio'],
  ['Group project', 'Proyecto de grupo'],
  ['Site project', 'Proyecto de planta'],
  ['Pilote le projet sur le terrain', 'Lidera el proyecto en el terreno'],
  ['Relai entre Mercateam & équipes', 'Enlace entre Mercateam y los equipos'],
  ["S'approprie & challenge le paramétrage", 'Se apropia y cuestiona la configuración'],
  ['Co-anime les ateliers de formation', 'Coanima los talleres de formación'],
  ['Utilisateurs clés', 'Usuarios clave'],
  ["Chefs d’équipe, RH, Qualité, HSE…", 'Jefes de equipo, RRHH, Calidad, HSE…'],
  ["Font vivre l'outil au quotidien", 'Hacen vivir la herramienta a diario'],
  ['Mettent en lumière process actuels & cibles', 'Ponen de relieve los procesos actuales y objetivo'],
  ['Participent aux ateliers de formation', 'Participan en los talleres de formación'],
  ['Assurent la cohérence des données', 'Garantizan la coherencia de los datos'],
  ['Référent IT', 'Referente IT'],
  ['Sécurise les aspects techniques', 'Asegura los aspectos técnicos'],
  ["Échanges avec l'équipe technique Mercateam", 'Intercambios con el equipo técnico de Mercateam'],
  ['Remonte risques cybersécurité / techniques', 'Reporta riesgos de ciberseguridad / técnicos'],
  ['Fournit infos pour SSO / interconnexion', 'Aporta información para SSO / interconexión'],
  ["Porte l'ambition du projet et arbitre", 'Impulsa la ambición del proyecto y arbitra'],
  ['Fixe les objectifs et incarne le projet', 'Fija los objetivos y encarna el proyecto'],
  ['Arbitre les décisions clés', 'Arbitra las decisiones clave'],
  ['Lève les risques signalés par le Champion', 'Resuelve los riesgos señalados por el Champion'],
  ['Champion Groupe', 'Champion de Grupo'],
  ["Pilote le déploiement à l'échelle du Groupe", 'Lidera el despliegue a escala de Grupo'],
  ['Coordonne les projets de chaque site', 'Coordina los proyectos de cada planta'],
  ['Définit les standards transverses', 'Define los estándares transversales'],
  ["Capitalise les retours d'expérience", 'Capitaliza las lecciones aprendidas'],

  // Etapas del despliegue
  ['NOTRE MÉTHODOLOGIE', 'NUESTRA METODOLOGÍA'],
  ['Les étapes du déploiement', 'Las etapas del despliegue'],
  ['Durée', 'Duración'],
  ['Prérequis', 'Requisitos previos'],
  ['Parties prenantes', 'Partes interesadas'],
  ['Objectifs', 'Objetivos'],
  ['Gouvernance et cadrage', 'Gobernanza y encuadre'],
  ['1h / semaine', '1h / semana'],
  ['Définir une équipe projet', 'Definir un equipo de proyecto'],
  ['Sponsor lors des COPIL  (1 par mois recommandé)', 'Sponsor en los comités de dirección (1 al mes recomendado)'],
  ['Cadrage projet', 'Encuadre del proyecto'],
  ['Définition des objectifs', 'Definición de objetivos'],
  ["Suivi de l'avancée du déploiement", 'Seguimiento del avance del despliegue'],
  ['3 semaines', '3 semanas'],
  ["Collecter les données d'intégration et compléter le template", 'Recopilar los datos de integración y completar la plantilla'],
  ['Paramétrage de la plateforme', 'Configuración de la plataforma'],
  ['2 à 3 jours', '2 a 3 días'],
  ["Organiser la visite et préparer le questionnaire d'audit", 'Organizar la visita y preparar el cuestionario de auditoría'],
  ['Rencontre équipe projet', 'Reunión del equipo de proyecto'],
  ['Audit des process', 'Auditoría de procesos'],
  ['Formation Mercateam', 'Formación Mercateam'],
  ['2-3h / semaine', '2-3h / semana'],
  ['Mobiliser les utilisateurs clés en autonomie', 'Movilizar a los usuarios clave de forma autónoma'],
  ["Formation outil et réponse aux cas d'usage", 'Formación en la herramienta y respuesta a los casos de uso'],
  ['1 à 3h', '1 a 3h'],
  ["+  temps d'implémentation", '+ tiempo de implementación'],
  ['Définir les besoins / risques IT', 'Definir las necesidades / riesgos de IT'],
  ['Référent IT / HR IS', 'Referente IT / HR IS'],
  ['Mise en place du SSO', 'Implementación del SSO'],
  ['Interconnexion', 'Interconexión'],
  ['Autres points techniques', 'Otros aspectos técnicos'],

  // Nuestras expectativas
  ['Une mobilisation calibrée pour chaque acteur du projet et les facteurs clés de succès',
   'Una movilización calibrada para cada actor del proyecto y los factores clave de éxito'],
  ['+300 sites déployés', '+300 plantas desplegadas'],
  ['NOS ATTENTES', 'NUESTRAS EXPECTATIVAS'],
  ['Engagement', 'Compromiso'],
  ['Implication des parties prenantes,', 'Implicación de las partes interesadas,'],
  ['pratique autonome entre ateliers, soutien direction', 'práctica autónoma entre talleres, apoyo de la dirección'],
  ['Respect des délais, allocation de ressources,', 'Cumplimiento de los plazos, asignación de recursos,'],
  ["disponibilité de l'équipe projet", 'disponibilidad del equipo de proyecto'],
  ['Conduite du changement', 'Gestión del cambio'],
  ['Communication fréquente, vision claire,', 'Comunicación frecuente, visión clara,'],
  ['anticipation des résistances', 'anticipación de las resistencias'],
  ['Ateliers de réflexion', 'Talleres de reflexión'],
  ['Pratique autonome', 'Práctica autónoma'],
  ['Visite Audit', 'Visita de auditoría'],
  ['Utilisateur clé', 'Usuario clave'],
  ['Par semaine', 'Por semana'],
  ["L'équation d'un déploiement réussi", 'La ecuación de un despliegue exitoso'],

  // RACI
  ['RESPONSABILITÉS', 'RESPONSABILIDADES'],
  ['Une matrice RACI claire pour aligner les équipes projets', 'Una matriz RACI clara para alinear los equipos de proyecto'],
  ['Approbateur', 'Aprobador'],
  ['Consulté', 'Consultado'],
  ['Informé', 'Informado'],
  ['Activités du projet', 'Actividades del proyecto'],
  ['Lancement du projet : disponibilités des ressources, validation de la feuille de route',
   'Lanzamiento del proyecto: disponibilidad de recursos, validación de la hoja de ruta'],
  ['Planification projet et tenue des délais', 'Planificación del proyecto y cumplimiento de los plazos'],
  ['Livrables, CR & supports', 'Entregables, actas y materiales'],
  ['Définition et suivi des objectifs de déploiement', 'Definición y seguimiento de los objetivos de despliegue'],
  ['Paramétrage & formation', 'Configuración y formación'],
  ['Intégration & paramétrage plateforme', 'Integración y configuración de la plataforma'],
  ['Ateliers et formation des utilisateurs', 'Talleres y formación de los usuarios'],
  ['Pratique autonome & support', 'Práctica autónoma y soporte'],
  ['Définition des besoins IT', 'Definición de las necesidades de IT'],
  ['Planification et suivi des actions IT', 'Planificación y seguimiento de las acciones de IT'],
  ['Utilisateurs', 'Usuarios'],
  ['Support', 'Soporte'],
  ['Organisation', 'Organización'],
  ['Phase', 'Fase'],

  ['Merci !', '¡Gracias!'],

  // --- blocs partagés par les decks Kickoff / BILAN / COPIL / Hebdomadaires ---

  ["Lien d’inscription", 'Enlace de inscripción'],
  ['Feuille de route', 'Hoja de ruta'],
  ['Prochaines étapes', 'Próximos pasos'],
  ['Logo client', 'Logo del cliente'],

  // Escala de madurez
  ['Échelle de maturité', 'Escala de madurez'],
  ['Informel / invisible', 'Informal / invisible'],
  ['Manuel, partiel', 'Manual, parcial'],
  ['Structuré, opérationnel', 'Estructurado, operativo'],
  ['Intégré, connecté', 'Integrado, conectado'],
  ['Piloté, proactif', 'Gestionado, proactivo'],

  // Tabla retos / madurez
  ['Maturité\nactuelle', 'Madurez\nactual'],
  ['Maturité cible', 'Madurez objetivo'],
  ['Besoins terrains', 'Necesidades del terreno'],
  ['Niveau\ncible', 'Nivel\nobjetivo'],
  ['Gains attendus', 'Ganancias esperadas'],
  ['Enjeux et objectifs du projet', 'Retos y objetivos del proyecto'],
  ['Enjeux', 'Retos'],
  ['Protéger et pérenniser les savoir-faire critiques', 'Proteger y perpetuar el saber hacer crítico'],
  ['Accélérer et sécuriser la montée en autonomie', 'Acelerar y asegurar la progresión hacia la autonomía'],
  ['Installer une conformité permanente', 'Instaurar una conformidad permanente'],
  ['Sécuriser la continuité opérationnelle', 'Asegurar la continuidad operativa'],
  ['Charge administrative ↓', 'Carga administrativa ↓'],
  ['Anticipation des pertes de savoir-faire ↑', 'Anticipación de las pérdidas de saber hacer ↑'],
  ['Charge admin de formation ↓', 'Carga administrativa de formación ↓'],
  ["Pénalités & temps d'audit évités", 'Penalizaciones y tiempo de auditoría evitados'],
  ['Risque de non-conformité ↓', 'Riesgo de no conformidad ↓'],
  ['Temps de planning ↓', 'Tiempo de planificación ↓'],
  ['Sous & sur-staffing ↓', 'Infra y sobredotación ↓'],

  // Criterios de Go Live / plan de acción
  ['Action mise à jour', 'Acción actualizada'],
  ['Action terminée', 'Acción completada'],
  ['Critères de Go Live', 'Criterios de Go Live'],
  ['Date\ncible', 'Fecha\nobjetivo'],
  ["Plan d'action", 'Plan de acción'],
  ["Plan d’action", 'Plan de acción'],
  ['100 % des collaborateurs actifs importés', '100 % de los colaboradores activos importados'],
  ['Importer les intérimaires', 'Importar los trabajadores temporales'],
  ['100 % des bibliothèques compétences / habilitations digitalisées', '100 % de las bibliotecas de competencias / habilitaciones digitalizadas'],
  ['Planifier un atelier', 'Planificar un taller'],
  ['100 % des postes créés et associés aux compétences/habilitations prérequises', '100 % de los puestos creados y asociados a las competencias/habilitaciones requeridas'],
  ['100% des utilisateurs clés formés', '100 % de los usuarios clave formados'],
  ['La gouvernance (RACI et droits) est définie', 'La gobernanza (RACI y derechos) está definida'],
  ['Une feuille de route post-déploiement est définie', 'Se ha definido una hoja de ruta post-despliegue'],
  ['100 % des matrices de compétences sont à jour', '100 % de las matrices de competencias están actualizadas'],
  ["→ Pilote sur les postes contrôle, hastamat et CDL avec Vanessa d'ici mi-janvier",
   '→ Piloto en los puestos de control, hastamat y CDL con Vanessa antes de mediados de enero'],
  ['Atelier aux autres équipes vers la semaine du 13 janvier — à planifier', 'Taller para los demás equipos hacia la semana del 13 de enero — por planificar'],
  ['La liste des contenus / questionnaires à intégrer est définie', 'La lista de contenidos / cuestionarios a integrar está definida'],
  ["100 % des matrices d'habilitation sont à jour", '100 % de las matrices de habilitaciones están actualizadas'],
  ['Avoir prévenu et formé les utilisateurs clés', 'Haber informado y formado a los usuarios clave'],
  ['Avoir prévenu et formé les autres champions', 'Haber informado y formado a los demás champions'],
  ['Les supports de formation du(des) poste(s) X sont digitalisés', 'Los materiales de formación del(de los) puesto(s) X están digitalizados'],
  ["Former les chefs d'équipes référents", 'Formar a los jefes de equipo referentes'],
  ['Créer les compétences au poste', 'Crear las competencias del puesto'],
  ['Définir les niveaux → Julie va communiquer', 'Definir los niveles → Julie comunicará'],
  ['Remplir les matrices compétences au poste 2×8 → voir les cde non clés', 'Rellenar las matrices de competencias del puesto 2×8 → ver los jefes de equipo no clave'],
  ["Les supports d'évaluation du(des) poste(s) X sont digitalisés", 'Los materiales de evaluación del(de los) puesto(s) X están digitalizados'],
  ['Opt : X formations ont été lancées et suivies sur Mercateam', 'Opc.: X formaciones se han lanzado y seguido en Mercateam'],
  ["PLAN D’ACTION", 'PLAN DE ACCIÓN'],
  ['CHIFFRES CLÉS', 'CIFRAS CLAVE'],
  ["Suivi de l’adoption", 'Seguimiento de la adopción'],
  ['CEO & co-fondateur Mercateam', 'CEO y cofundador de Mercateam'],

  // Logros / puntos de atención
  ['Accomplissements', 'Logros'],
  ["Points d'attention", 'Puntos de atención'],
  ['→ Matrices de compétences et fiches collaborateurs à jour et centralisées.', '→ Matrices de competencias y fichas de colaboradores actualizadas y centralizadas.'],

  // Testimonios
  ['DÉPLOIEMENT MERCATEAM · RESSOURCES', 'DESPLIEGUE MERCATEAM · RECURSOS'],
  ['Témoignages', 'Testimonios'],
  ["Découvrez les cas d’usage chez nos partenaires", 'Descubra los casos de uso en nuestros socios'],
  ['Découvrez les retours de nos partenaires', 'Descubra las opiniones de nuestros socios'],
  ['Lire la vidéo', 'Ver el vídeo'],
  ['Digitalisation des compétences pour anticiper la perte de savoir-faire', 'Digitalización de las competencias para anticipar la pérdida de saber hacer'],
  ['Digitalisation de\nla montée en\ncompétences pour valoriser le savoir-faire', 'Digitalización del\ndesarrollo de\ncompetencias para valorizar el saber hacer'],
  ['Gestion du planning et utilisation de la donnée', 'Gestión del planning y uso del dato'],
  ['Luxe', 'Lujo'],
  ['Électronique', 'Electrónica'],
  ['Centralisation des données et montée en polyvalence', 'Centralización de los datos y aumento de la polivalencia'],
  ['Cosmétique', 'Cosmética'],
  ['Aéronautique', 'Aeronáutica'],
  ['Audits simplifiés et traçabilité des compétences', 'Auditorías simplificadas y trazabilidad de las competencias'],
  ['Manufacture', 'Manufactura'],
  ['Gestion des compétences et des formations pour gagner en polyvalence', 'Gestión de las competencias y de las formaciones para ganar polivalencia'],
  ["“Onboarding, instruction au poste, automatisation de la formation, l’outil nous a aidés à diviser par 4 notre temps de formation et son suivi.”",
   '“Onboarding, instrucción en el puesto, automatización de la formación: la herramienta nos ayudó a dividir por cuatro nuestro tiempo de formación y su seguimiento.”'],
  ['Directeur industriel chez Trigano', 'Director industrial en Trigano'],
  ["“Mercateam nous permet de sécuriser la polyvalence en accompagnant et la montée en compétence des collaborateurs.”",
   '“Mercateam nos permite asegurar la polivalencia acompañando el desarrollo de competencias de los colaboradores.”'],
  ['Responsable de site chez SEB', 'Responsable de planta en SEB'],
  ["“Les managers gagnent une journée par semaine sur la réalisation des planning et nous donnent accès à une data cruciale pour améliorer la performance.”",
   '“Los mandos ganan un día por semana en la elaboración de los plannings y nos dan acceso a datos cruciales para mejorar el rendimiento.”'],
  ['Directeur industriel chez Dior', 'Director industrial en Dior'],
  ["“On a passé notre dernier audit NADCAP sans aucun problème grâce à Mercateam !”",
   '“¡Pasamos nuestra última auditoría NADCAP sin ningún problema gracias a Mercateam!”'],
  ['Coordinateur qualité chez LISI', 'Coordinador de calidad en LISI'],
  ["“Je n'ai plus à m'inquiéter du suivi des habilitations et compétences critiques arrivant à échéance, Mercateam m’envoie un rappel plusieurs mois avant.”",
   '“Ya no tengo que preocuparme por el seguimiento de las habilitaciones y competencias críticas que vencen: Mercateam me avisa varios meses antes.”'],
  ['DRH chez Exxelia', 'Directora de RRHH en Exxelia'],
  ["“On tient enfin LE logiciel qui nous permet de devenir parfaits en terme de qualité et passer tous nos audits !”",
   '“¡Por fin tenemos EL software que nos permite ser impecables en calidad y pasar todas nuestras auditorías!”'],
  ['Coordinateur qualité chez Shiseido', 'Coordinador de calidad en Shiseido'],

  // Repéré à la relecture : seul secteur resté en français sur la slide
  // témoignages. Aucun mot franco-spécifique dedans, donc invisible au
  // détecteur de résidu.
  ['Automobile', 'Automoción']
];

// ===========================================================================
// ==  jobs.gs
// ===========================================================================

/**
 * JOBS — le lot de traduction en cours. C'est le SEUL fichier à remplacer
 * quand on traduit de nouveaux decks.
 *
 * Il porte : les copies à traiter (getJobs), les renommages éventuels
 * (RENAMES), les correctifs ponctuels (getFixups) et les tables propres aux
 * decks du lot. Tout ce qui est réutilisable appartient au glossaire.
 *
 * Projet Apps Script "Traduction Slides Mercateam" — fichier 3 sur 3.
 * Les trois fichiers partagent la même portée globale : l'ordre n'importe pas.
 * Voir README.md pour la marche à suivre.
 */

// ---------------------------------------------------------------------------
// CORRECTIFS — rattrapage des dégâts laissés par les versions précédentes
//
// Le deck 1 a été traduit par une version du moteur qui n'avait ni les
// sentinelles ni le passage en force sur les slides. Deux séquelles sont
// restées dans les copies, que ces entrées reprennent depuis l'état actuel
// (déjà traduit) et non depuis le français.
//
// À ne lancer qu'une fois, via fixupAll(). Sans effet si relancé.
// ---------------------------------------------------------------------------

function fixupAll() {
  var fixups = getFixups();

  // Annonce d'abord ce qui va être traité. Sans ça, un jobs.gs resté en
  // version précédente fait tourner d'anciens correctifs déjà appliqués : le
  // journal semble normal, les decks ne bougent pas, et rien ne le signale.
  Logger.log('LOT DE CORRECTIFS 2026-08-11-c — ' + fixups.length + ' cibles attendues :\n  - '
    + fixups.map(function (j) { return j.label; }).join('\n  - '));

  fixups.forEach(function (job) {
    Logger.log(translateOne(job));
  });
}

function getFixups() {
  // Correctifs issus de la relecture des 12 copies traduites. Ils repartent de
  // l'état actuel des decks, pas du français d'origine, et ne servent qu'une
  // fois. Ceux du premier lot ont été appliqués et retirés.
  var GT_EN = [
    ['GT1', 'WG1'], ['GT2', 'WG2'], ['GT3', 'WG3'], ['GT4', 'WG4'], ['GT', 'WG'],
    ['Logo client', 'Client logo']
  ];
  var AUTO_ES = [['Automobile', 'Automoción']];

  return [
    { label: 'CORRECTIF EN - REVIEW : fragment G2 restant',
      fileId: '1j1_FjPfrTUfOkYn-orzvfOcGZ7erSAEcqut_x5J8vLM',
      map: DECK4_EN.slice(0, 9) },
    { label: 'CORRECTIF ES - BALANCE : fragment G2 restant',
      fileId: '1M35NO0sfVBC2L1hI6zSqfTTHaT52u0nUMHbRzkLPE4k',
      map: DECK4_ES.slice(0, 9) }
  ];
}

// ---------------------------------------------------------------------------
// RENOMMAGES — harmonisation "Sitio" -> "Planta" sur les copies ES
// ---------------------------------------------------------------------------

var RENAMES = [
  {
    fileId: '1Ncedk3sKx6UaNPExB8uMdncWxgCOKQjdkJpOBT9-bwQ',
    title: 'v06.2026 - ES - 202XXXX2_Preparación Kickoff_Grupo Planta'
  },
  {
    fileId: '153SkfN3MeQZazaa8FzdEkOnuUgxe0KZg66fPkpDa8YQ',
    title: 'v06.2026 - ES - 202XXXX2_Kickoff_Grupo Planta'
  },
  {
    fileId: '1M35NO0sfVBC2L1hI6zSqfTTHaT52u0nUMHbRzkLPE4k',
    title: 'v08.2026 - ES - 202XXXX3_BALANCE_Grupo Planta'
  },
  {
    fileId: '1WsXCZY5KmyHmeta0tMmNg9VuA20oxSDviK9IO9tXpq8',
    title: 'v08.2026 - ES - 202XXXX3_Semanales de proyecto_Grupo Planta'
  },
  {
    fileId: '1xd2I9OTYRJR0e7xDETq_qu3TFzuobKj9xGTdmu5T3eE',
    title: 'v08.2026 - ES - 202XXXX3_Comité de Dirección #x_Grupo Planta'
  }
];

// ---------------------------------------------------------------------------
// JOBS — quelles copies traiter, avec quelle table
// ---------------------------------------------------------------------------

function getJobs() {
  return [
    { label: 'v06.2026 - EN - Kickoff Preparation',
      fileId: '1-74bN_wHuvtnE_pU_yUFmX1UkIKbNYJaaVLjoNQl24k',
      map: COMMON_EN.concat(DECK2_EN) },
    { label: 'v06.2026 - ES - Preparación Kickoff',
      fileId: '1Ncedk3sKx6UaNPExB8uMdncWxgCOKQjdkJpOBT9-bwQ',
      map: COMMON_ES.concat(DECK2_ES) },

    // Le Kickoff reprend les blocs du deck Préparation Kickoff (groupes de
    // travail, 10 cas d'usage, agenda de visite), d'où la double concaténation.
    { label: 'v06.2026 - EN - Kickoff',
      fileId: '11KRnojbBJGLFMD_yqf4VGhAcSM_ugBNq0Hqynh32_-g',
      map: COMMON_EN.concat(DECK2_EN, DECK3_EN) },
    { label: 'v06.2026 - ES - Kickoff',
      fileId: '153SkfN3MeQZazaa8FzdEkOnuUgxe0KZg66fPkpDa8YQ',
      map: COMMON_ES.concat(DECK2_ES, DECK3_ES) },

    { label: 'v08.2026 - EN - REVIEW',
      fileId: '1j1_FjPfrTUfOkYn-orzvfOcGZ7erSAEcqut_x5J8vLM',
      map: COMMON_EN.concat(DECK4_EN) },
    { label: 'v08.2026 - ES - BALANCE',
      fileId: '1M35NO0sfVBC2L1hI6zSqfTTHaT52u0nUMHbRzkLPE4k',
      map: COMMON_ES.concat(DECK4_ES) },

    { label: 'v08.2026 - EN - Project weeklies',
      fileId: '1HsDFaY7xDXLFEhF3av7f4HR2viJM79rvCQFqZGId328',
      map: COMMON_EN.concat(DECK5_EN) },
    { label: 'v08.2026 - ES - Semanales de proyecto',
      fileId: '1WsXCZY5KmyHmeta0tMmNg9VuA20oxSDviK9IO9tXpq8',
      map: COMMON_ES.concat(DECK5_ES) },

    { label: 'v08.2026 - EN - Steering Committee',
      fileId: '1f6HPC2V5TDCxpUb0-io4BbYfrsZuTOHJAZZd5InV8Fg',
      map: COMMON_EN.concat(DECK6_EN) },
    { label: 'v08.2026 - ES - Comité de Dirección',
      fileId: '1xd2I9OTYRJR0e7xDETq_qu3TFzuobKj9xGTdmu5T3eE',
      map: COMMON_ES.concat(DECK6_ES) }
  ];
}

// ---------------------------------------------------------------------------
// DECK 2 — "Préparation Kickoff"  (contenu propre à ce deck)
// ---------------------------------------------------------------------------

var DECK2_EN = [
  ['Préparation au Kickoff', 'Kickoff preparation'],

  ['Adopter un langage commun', 'Adopting a shared language'],
  ['Ceci est ?', 'This is?'],

  ['Contexte & objectifs', 'Context & objectives'],
  ['Enjeux du projet, maturité actuelle et cible', 'Project challenges, current and target maturity'],
  ['Périmètre', 'Scope'],
  ['Scope, accompagnement Mercateam et modules à déployer', 'Scope, Mercateam support and modules to deploy'],
  ['Feuille de route & méthodologie', 'Roadmap & methodology'],
  ["Jalons du déploiement et détail de l’accompagnement", 'Deployment milestones and support in detail'],
  ['Les équipes projet', 'The project teams'],
  ['Experts Mercateam et équipe projet à mobiliser côté partenaire', 'Mercateam experts and the project team to mobilise on the partner side'],
  ['Prochaines étapes', 'Next steps'],
  ['RACI, intégration des données et visite kick-off', 'RACI, data integration and kick-off visit'],
  ['Annexes & ressources', 'Appendices & resources'],
  ['Kit de déploiement et témoignages', 'Deployment kit and testimonials'],

  ['CONTEXTE', 'CONTEXT'],
  ["10 cas d'usage pour l'excellence industrielle", '10 use cases for industrial excellence'],
  ['Sécurité & conformité', 'Safety & compliance'],
  ['Piloter les compétences', 'Steering skills'],
  ['Visualiser en temps réel les compétences disponibles et les zones de fragilité', 'See available skills and weak spots in real time'],
  ['Opérations sûres & conformes', 'Safe & compliant operations'],
  ['Empêcher toute affectation non conforme au quotidien', 'Prevent every non-compliant assignment, day to day'],
  ['Qualité', 'Quality'],
  ['Conformité permanente', 'Permanent compliance'],
  ["Réduire structurellement la charge et le risque d'audit", 'Structurally reduce audit burden and risk'],
  ['Pérenniser les savoir-faire', 'Securing know-how'],
  ["Protéger les expertises critiques avant qu'elles ne disparaissent", 'Protect critical expertise before it disappears'],
  ['Montée en autonomie', 'Ramp-up to autonomy'],
  ['Accélérer et sécuriser le temps nécessaire pour rendre un nouvel arrivant autonome', 'Speed up and secure the time it takes to make a newcomer autonomous'],
  ['Planification fiable & réactive', 'Reliable & responsive planning'],
  ["Gérer les aléas et l'absentéisme", 'Handle disruptions and absenteeism'],
  ['Charge-capacité & optimisation des coûts', 'Workload-capacity & cost optimisation'],
  ['Anticiper la planification long terme et ajuster les ressources aux besoins réels de production', 'Plan ahead long term and match resources to real production needs'],
  ['Reconnaissance', 'Recognition'],
  ['Standardisation multi-sites', 'Multi-site standardisation'],
  ["Une gestion homogène du savoir-faire à l'échelle du groupe", 'Consistent know-how management across the group'],
  ['Progression & rémunération', 'Progression & pay'],
  ['Rendre la progression équitable, objective et pilotée', 'Make progression fair, objective and managed'],
  ['Équité des affectations', 'Fair assignments'],
  ["Ancrer une équité démontrable et structurelle dans chaque décision d’affectation", 'Embed demonstrable, structural fairness in every assignment decision'],

  ['Maturité\nactuelle', 'Current\nmaturity'],
  ['Commentaires', 'Comments'],
  ['Maturité cible', 'Target maturity'],
  ['Gains attendus', 'Expected gains'],
  ['Piloter les compétences comme levier stratégique de performance et de résilience', 'Steering skills as a strategic lever for performance and resilience'],
  ['Compétences gérées sur Excel, vision incomplète de qui maîtrise quoi, savoir-faire fragiles.', 'Skills managed in Excel, incomplete view of who masters what, fragile know-how.'],
  ['Charge administrative ↓', 'Administrative burden ↓'],
  ['Anticipation des pertes de savoir-faire ↑', 'Anticipation of know-how loss ↑'],
  ['Accélérer et sécuriser la montée en autonomie', 'Speed up and secure the ramp-up to autonomy'],
  ['Charge admin de formation ↓', 'Training admin burden ↓'],
  ['Installer une conformité permanente', 'Establish permanent compliance'],
  ["Pénalités & temps d'audit évités", 'Penalties & audit time avoided'],
  ['Risque de non-conformité ↓', 'Non-compliance risk ↓'],
  ['Sécuriser la continuité opérationnelle', 'Secure operational continuity'],
  ['Temps de planning ↓', 'Scheduling time ↓'],
  ['Sous & sur-staffing ↓', 'Under & overstaffing ↓'],
  ['Échelle de maturité', 'Maturity scale'],
  ['Informel / invisible', 'Informal / invisible'],
  ['Manuel, partiel', 'Manual, partial'],
  ['Structuré, opérationnel', 'Structured, operational'],
  ['Intégré, connecté', 'Integrated, connected'],
  ['Piloté, proactif', 'Managed, proactive'],
  ['Enjeux et objectifs du projet', 'Project challenges and objectives'],
  ['Enjeux', 'Challenges'],

  ['Employés concernés', 'Employees in scope'],
  ['Secteur ciblé', 'Target area'],
  ['20 J/H • 4 mois', '20 PD • 4 months'],
  ['Déploiement Mercateam défini', 'Defined Mercateam deployment'],
  ['Approche de déploiement', 'Deployment approach'],
  ['Pilote + Formation des formateurs', 'Pilot + Train-the-trainer'],
  ['Cadrage projet et accompagnement', 'Project framing and support'],
  ["Formation de l'équipe projet", 'Project team training'],
  ['Formation des utilisateurs clés par l’équipe projet partenaire', 'Key user training by the partner project team'],
  ['Formation des utilisateurs finaux par l’équipe projet partenaire', 'End-user training by the partner project team'],
  ['Formation des utilisateurs clés', 'Key user training'],
  ['Formation des utilisateurs finaux', 'End-user training'],
  ['Formation de tous les utilisateurs', 'Training for all users'],
  ['Formation des formateurs', 'Train-the-trainer'],
  ['Périmètre fonctionnel', 'Functional scope'],
  ['Compétences', 'Skills'],
  ['Indicateurs', 'Indicators'],
  ['Entretiens professionnels', 'Performance reviews'],
  ['PÉRIMÈTRE DU PROJET', 'PROJECT SCOPE'],
  ["Rappel de l’accompagnement sélectionné", 'Recap of the selected support package'],
  ['Interconnexion Employés, Interconnexion Absences, SSO', 'Employee interconnection, Absence interconnection, SSO'],

  ["Présenter l'outil d'intégration de données et vous accompagner dans les choix d'architecture de votre plateforme.",
   'Present the data integration tool and support you in the architecture choices for your platform.'],
  ["Fournir l’organigramme de l'usine, données collaborateurs, lien collaborateurs ⇄ compétences/habilitations.",
   'Provide the plant org chart, employee data, employee ⇄ skills/certifications links.'],
  ['Avoir parcouru le Kit de déploiement - partie Paramétrage.', 'Have gone through the Deployment kit — Configuration section.'],
  ['Définir les parties prenantes de vos process actuels : qui fait quoi ?', 'Define the stakeholders of your current processes: who does what?'],
  ["Ajuster l'agenda de visite pour rencontrer les bons acteurs.", 'Adjust the visit agenda to meet the right people.'],
  ['Avoir parcouru le Kit de déploiement - partie Lancement du projet de déploiement.', 'Have gone through the Deployment kit — Launching the deployment project section.'],
  ['2 JOURS', '2 DAYS'],
  ['Visite Kick-off', 'Kick-off visit'],
  ['Consolider la compréhension de vos process et enjeux via un audit', 'Consolidate our understanding of your processes and challenges through an audit'],
  ['Formation théorique + ateliers pratiques', 'Theory training + hands-on workshops'],
  ['Alignement objectifs et critères de Go Live', 'Alignment on objectives and Go Live criteria'],
  ['Une 1re version de la plateforme avec vos données intégrées, à valider sur site.', 'A first version of the platform with your data loaded, to be validated on site.'],
  ['Avoir parcouru le Kit de déploiement - partie Conduite du changement & formation.', 'Have gone through the Deployment kit — Change management & training section.'],
  ["Formulaire d'audit du savoir-faire rempli.", 'Know-how audit form completed.'],
  ['PROCHAINES ÉTAPES', 'NEXT STEPS'],
  ['RACI, Intégration de données et visite / kick-off', 'RACI, data integration and visit / kick-off'],

  ['Objectif : une 1re version de votre plateforme Mercateam, avec vos données, prête à être utilisée par les utilisateurs clés.',
   'Goal: a first version of your Mercateam platform, with your data, ready to be used by the key users.'],
  ['Secteurs', 'Areas'],
  ['Équipes  (⚠ 1 équipe = 1 matrice & 1 planning)', 'Teams (⚠ 1 team = 1 matrix & 1 schedule)'],
  ['Employés', 'Employees'],
  ['→ Squelette de la plateforme pour la gestion des droits.', '→ Backbone of the platform for rights management.'],
  ['Compétences / Habilitations', 'Skills / Certifications'],
  ['Compétences : bibliothèque (niveau, validité, recyclage), matrice, tuteur, évaluateur', 'Skills: library (level, validity, refresher), matrix, mentor, assessor'],
  ['Habilitations : bibliothèque, validité, matrice', 'Certifications: library, validity, matrix'],
  ['→ Cœur de Mercateam sur lequel se basent les autres fonctionnalités.', '→ The core of Mercateam, on which the other features rely.'],
  ["1 poste = un ensemble de compétences et/ou d’habilitations", '1 workstation = a set of skills and/or certifications'],
  ["Le planning est basé sur les postes de l'équipe", "The schedule is based on the team's workstations"],
  ["→ Vue agrégée pour l'usage quotidien des chefs d'équipe.", "→ Aggregated view for team leaders' daily use."],
  ['PARAMÉTRAGE', 'CONFIGURATION'],
  ['Intégration initiale de données', 'Initial data load'],
  ['Poste', 'Workstation'],

  ['Jour 1', 'Day 1'],
  ['Audit des process & supports existants', 'Audit of existing processes & materials'],
  ["45 min – 1 h / cas d'usage", '45 min – 1 h / use case'],
  ['Champion, Utilisateurs clés', 'Champion, Key users'],
  ['Bilan audit & définition des critères de Go Live', 'Audit review & definition of Go Live criteria'],
  ['Jour 2', 'Day 2'],
  ['Formation théorique', 'Theory training'],
  ['Ateliers pratiques', 'Hands-on workshops'],
  ['Bilan & prochaines étapes', 'Review & next steps'],
  ['VISITE', 'VISIT'],
  ['Agenda suggéré pour la visite sur site', 'Suggested agenda for the on-site visit'],

  ['GROUPES DE TRAVAIL (GT)', 'WORKING GROUPS (WG)'],
  ["Les acteurs à mobiliser par cas d'usage.", 'The people to mobilise per use case.'],
  ['GT Pilotage · Projet', 'WG Steering · Project'],
  ['Acteurs : Champion · Sponsor', 'People: Champion · Sponsor'],
  ['GT 1 · Cartographie & pilotage des compétences', 'WG 1 · Skills mapping & steering'],
  ['Focus : Piloter les compétences comme levier stratégique', 'Focus: Steering skills as a strategic lever'],
  ['Resp. compétences site & groupe', 'Site & group skills managers'],
  ['Resp. compétences', 'Skills manager'],
  ["Chefs d'équipe", 'Team leaders'],
  ['GT 2 · Planning & charge-capacité', 'WG 2 · Scheduling & workload-capacity'],
  ['Focus : planification fiable & réactive)', 'Focus: reliable & responsive planning)'],
  ['Charge-capacité & coûts', 'Workload-capacity & costs'],
  ['Planificateur', 'Planner'],
  ['Ordonnancement', 'Scheduling'],
  ['RRH', 'HR Manager'],
  ['GT 3 · Intégration, formation & transmission', 'WG 3 · Onboarding, training & knowledge transfer'],
  ['Focus : Montée en autonomie', 'Focus: Ramp-up to autonomy'],
  ['Pérenniser les savoir-faire critiques', 'Securing critical know-how'],
  ['Formateur', 'Trainer'],
  ['GT 4 · Conformité & sécurité au poste', 'WG 4 · Compliance & workstation safety'],
  ['Focus : Conformité permanente & audit', 'Focus: Permanent compliance & audit'],
  ['Opérations sûres et conformes', 'Safe and compliant operations'],
  ['GT 5 · Standardisation des savoir-faire multi-sites', 'WG 5 · Multi-site know-how standardisation'],
  ['Focus : Standardiser la gestion du savoir-faire', 'Focus: Standardising know-how management'],
  ['Champion groupe', 'Group champion'],
  ['GT 6 · Reconnaissance & équité', 'WG 6 · Recognition & fairness'],
  ['Focus : Progression & rémunération équitables', 'Focus: Fair progression & pay'],
  ['Direction', 'Management'],

  ['Polyvalence et formation', 'Versatility and training'],
  ['Intégration des nouveaux entrants', 'Onboarding of new joiners'],
  ['Formation réglementaire', 'Regulatory training'],
  ['Formation au poste', 'On-the-job training'],
  ['Gestion de la polyvalence', 'Versatility management'],
  ['Plan de formation', 'Training plan'],
  ['→ Cartographie de la montée en compétence, traçabilité et transmission du savoir-faire.', '→ Mapping of skills growth, traceability and know-how transfer.'],
  ["Planning d'absences", 'Absence schedule'],
  ['Prévision charge / capacité', 'Workload / capacity forecast'],
  ['Affectation S+1', 'W+1 assignment'],
  ['Construction poste / compét. / hab.', 'Building workstation / skills / certifications'],
  ['Affichage du planning', 'Schedule display'],
  ['→ Planification court et long terme des équipes.', '→ Short- and long-term team planning.'],
  ['Planification', 'Planning'],
  ['Enjeux groupe et site', 'Group and site challenges'],
  ['Situation sociale', 'Employee relations'],
  ['Système applicatif', 'Application landscape'],
  ["→ Vue d'ensemble des enjeux et des rôles.", '→ Overview of challenges and roles.'],
  ['Objectif : comprendre vos processus existants, leurs points forts et leurs limites, pour mieux vous accompagner.',
   'Goal: understand your existing processes, their strengths and their limits, to support you better.'],
  ['Audit de vos processus de gestion du savoir-faire', 'Audit of your know-how management processes'],

  ['ANNEXE', 'APPENDIX'],
  ['Annexes & supports\nde préparation kick-off', 'Appendices & kick-off\npreparation materials'],
  ['Toutes nos recommandations et supports pour mener à bien votre projet de digitalisation !',
   'All our recommendations and materials to carry your digitalisation project through!'],
  ['RESSOURCES', 'RESOURCES'],
  ['Lire la vidéo', 'Play video'],
  ['Digitalisation des compétences pour anticiper la perte de savoir-faire', 'Digitalising skills to anticipate know-how loss'],
  ['Digitalisation de\nla montée en\ncompétences pour valoriser le savoir-faire', 'Digitalising\nskills growth\nto showcase know-how'],
  ["Gestion du planning et utilisation de la donnée", 'Schedule management and use of data'],
  ['Luxe', 'Luxury'],
  ['Électronique', 'Electronics'],
  ['Centralisation des données et montée en polyvalence', 'Data centralisation and growth in versatility'],
  ['Cosmétique', 'Cosmetics'],
  ['Aéronautique', 'Aerospace'],
  ['Audits simplifiés et traçabilité des compétences', 'Simplified audits and skills traceability'],
  ['Manufacture', 'Manufacturing'],
  ['Gestion des compétences et des formations pour gagner en polyvalence', 'Skills and training management to gain versatility'],
  ["Découvrez les cas d’usage chez nos partenaires", 'Discover the use cases at our partners'],
  ['Témoignages', 'Testimonials']
];

var DECK2_ES = [
  ['Préparation au Kickoff', 'Preparación del Kickoff'],

  ['INTRODUCTION', 'INTRODUCCIÓN'],
  ['Adopter un langage commun', 'Adoptar un lenguaje común'],
  ['Ceci est ?', '¿Esto es?'],
  ['Optional', 'Opcional'],

  ['Contexte & objectifs', 'Contexto y objetivos'],
  ['Enjeux du projet, maturité actuelle et cible', 'Retos del proyecto, madurez actual y objetivo'],
  ['Périmètre', 'Alcance'],
  ['Scope, accompagnement Mercateam et modules à déployer', 'Alcance, acompañamiento Mercateam y módulos a desplegar'],
  ['Feuille de route & méthodologie', 'Hoja de ruta y metodología'],
  ["Jalons du déploiement et détail de l’accompagnement", 'Hitos del despliegue y detalle del acompañamiento'],
  ['Les équipes projet', 'Los equipos de proyecto'],
  ['Experts Mercateam et équipe projet à mobiliser côté partenaire', 'Expertos Mercateam y equipo de proyecto a movilizar del lado del socio'],
  ['Prochaines étapes', 'Próximos pasos'],
  ['RACI, intégration des données et visite kick-off', 'RACI, integración de datos y visita kick-off'],
  ['Annexes & ressources', 'Anexos y recursos'],
  ['Kit de déploiement et témoignages', 'Kit de despliegue y testimonios'],

  ['CONTEXTE', 'CONTEXTO'],
  ["10 cas d'usage pour l'excellence industrielle", '10 casos de uso para la excelencia industrial'],
  ['Sécurité & conformité', 'Seguridad y conformidad'],
  ['Piloter les compétences', 'Pilotar las competencias'],
  ['Visualiser en temps réel les compétences disponibles et les zones de fragilité', 'Visualizar en tiempo real las competencias disponibles y las zonas de fragilidad'],
  ['Opérations sûres & conformes', 'Operaciones seguras y conformes'],
  ['Empêcher toute affectation non conforme au quotidien', 'Impedir cualquier asignación no conforme en el día a día'],
  ['Qualité', 'Calidad'],
  ['Conformité permanente', 'Conformidad permanente'],
  ["Réduire structurellement la charge et le risque d'audit", 'Reducir estructuralmente la carga y el riesgo de auditoría'],
  ['Pérenniser les savoir-faire', 'Perpetuar el saber hacer'],
  ["Protéger les expertises critiques avant qu'elles ne disparaissent", 'Proteger las competencias críticas antes de que desaparezcan'],
  ['Performance', 'Rendimiento'],
  ['Montée en autonomie', 'Progresión hacia la autonomía'],
  ['Accélérer et sécuriser le temps nécessaire pour rendre un nouvel arrivant autonome', 'Acelerar y asegurar el tiempo necesario para que un recién llegado sea autónomo'],
  ['Planification fiable & réactive', 'Planificación fiable y reactiva'],
  ["Gérer les aléas et l'absentéisme", 'Gestionar los imprevistos y el absentismo'],
  ['Charge-capacité & optimisation des coûts', 'Carga-capacidad y optimización de costes'],
  ['Anticiper la planification long terme et ajuster les ressources aux besoins réels de production', 'Anticipar la planificación a largo plazo y ajustar los recursos a las necesidades reales de producción'],
  ['Reconnaissance', 'Reconocimiento'],
  ['Standardisation multi-sites', 'Estandarización multiplanta'],
  ["Une gestion homogène du savoir-faire à l'échelle du groupe", 'Una gestión homogénea del saber hacer a escala del grupo'],
  ['Progression & rémunération', 'Progresión y remuneración'],
  ['Rendre la progression équitable, objective et pilotée', 'Hacer la progresión equitativa, objetiva y gestionada'],
  ['Équité des affectations', 'Equidad de las asignaciones'],
  ["Ancrer une équité démontrable et structurelle dans chaque décision d’affectation", 'Anclar una equidad demostrable y estructural en cada decisión de asignación'],

  ['Maturité\nactuelle', 'Madurez\nactual'],
  ['Commentaires', 'Comentarios'],
  ['Maturité cible', 'Madurez objetivo'],
  ['Gains attendus', 'Ganancias esperadas'],
  ['Piloter les compétences comme levier stratégique de performance et de résilience', 'Pilotar las competencias como palanca estratégica de rendimiento y resiliencia'],
  ['Compétences gérées sur Excel, vision incomplète de qui maîtrise quoi, savoir-faire fragiles.', 'Competencias gestionadas en Excel, visión incompleta de quién domina qué, saber hacer frágil.'],
  ['Charge administrative ↓', 'Carga administrativa ↓'],
  ['Anticipation des pertes de savoir-faire ↑', 'Anticipación de las pérdidas de saber hacer ↑'],
  ['Accélérer et sécuriser la montée en autonomie', 'Acelerar y asegurar la progresión hacia la autonomía'],
  ['Charge admin de formation ↓', 'Carga administrativa de formación ↓'],
  ['Installer une conformité permanente', 'Instaurar una conformidad permanente'],
  ["Pénalités & temps d'audit évités", 'Penalizaciones y tiempo de auditoría evitados'],
  ['Risque de non-conformité ↓', 'Riesgo de no conformidad ↓'],
  ['Sécuriser la continuité opérationnelle', 'Asegurar la continuidad operativa'],
  ['Temps de planning ↓', 'Tiempo de planificación ↓'],
  ['Sous & sur-staffing ↓', 'Infra y sobredotación ↓'],
  ['Échelle de maturité', 'Escala de madurez'],
  ['Informel / invisible', 'Informal / invisible'],
  ['Manuel, partiel', 'Manual, parcial'],
  ['Structuré, opérationnel', 'Estructurado, operativo'],
  ['Intégré, connecté', 'Integrado, conectado'],
  ['Piloté, proactif', 'Gestionado, proactivo'],
  ['Enjeux et objectifs du projet', 'Retos y objetivos del proyecto'],
  ['Enjeux', 'Retos'],

  ['Employés concernés', 'Empleados afectados'],
  ['Production', 'Producción'],
  ['Secteur ciblé', 'Sector objetivo'],
  ['20 J/H • 4 mois', '20 J/H • 4 meses'],
  ['Déploiement Mercateam défini', 'Despliegue Mercateam definido'],
  ['Approche de déploiement', 'Enfoque de despliegue'],
  ['Pilote + Formation des formateurs', 'Piloto + Formación de formadores'],
  ['Cadrage projet et accompagnement', 'Encuadre del proyecto y acompañamiento'],
  ["Formation de l'équipe projet", 'Formación del equipo de proyecto'],
  ['Formation des utilisateurs clés par l’équipe projet partenaire', 'Formación de los usuarios clave por el equipo de proyecto del socio'],
  ['Formation des utilisateurs finaux par l’équipe projet partenaire', 'Formación de los usuarios finales por el equipo de proyecto del socio'],
  ['Formation des utilisateurs clés', 'Formación de los usuarios clave'],
  ['Formation des utilisateurs finaux', 'Formación de los usuarios finales'],
  ['Formation de tous les utilisateurs', 'Formación de todos los usuarios'],
  ['Formation des formateurs', 'Formación de formadores'],
  ['Périmètre fonctionnel', 'Alcance funcional'],
  ['Compétences', 'Competencias'],
  ['Indicateurs', 'Indicadores'],
  ['Entretiens professionnels', 'Entrevistas profesionales'],
  ['PÉRIMÈTRE DU PROJET', 'ALCANCE DEL PROYECTO'],
  ["Rappel de l’accompagnement sélectionné", 'Recordatorio del acompañamiento seleccionado'],
  ['Interconnexion Employés, Interconnexion Absences, SSO', 'Interconexión Empleados, Interconexión Ausencias, SSO'],

  ["Présenter l'outil d'intégration de données et vous accompagner dans les choix d'architecture de votre plateforme.",
   'Presentar la herramienta de integración de datos y acompañarle en las decisiones de arquitectura de su plataforma.'],
  ["Fournir l’organigramme de l'usine, données collaborateurs, lien collaborateurs ⇄ compétences/habilitations.",
   'Facilitar el organigrama de la planta, datos de los colaboradores, vínculo colaboradores ⇄ competencias/habilitaciones.'],
  ['Avoir parcouru le Kit de déploiement - partie Paramétrage.', 'Haber revisado el Kit de despliegue — apartado Configuración.'],
  ['Définir les parties prenantes de vos process actuels : qui fait quoi ?', 'Definir las partes interesadas de sus procesos actuales: ¿quién hace qué?'],
  ["Ajuster l'agenda de visite pour rencontrer les bons acteurs.", 'Ajustar la agenda de la visita para reunirse con los actores adecuados.'],
  ['Avoir parcouru le Kit de déploiement - partie Lancement du projet de déploiement.', 'Haber revisado el Kit de despliegue — apartado Lanzamiento del proyecto de despliegue.'],
  ['2 JOURS', '2 DÍAS'],
  ['Visite Kick-off', 'Visita Kick-off'],
  ['Consolider la compréhension de vos process et enjeux via un audit', 'Consolidar la comprensión de sus procesos y retos mediante una auditoría'],
  ['Formation théorique + ateliers pratiques', 'Formación teórica + talleres prácticos'],
  ['Alignement objectifs et critères de Go Live', 'Alineación de objetivos y criterios de Go Live'],
  ['Une 1re version de la plateforme avec vos données intégrées, à valider sur site.', 'Una primera versión de la plataforma con sus datos integrados, a validar en planta.'],
  ['Avoir parcouru le Kit de déploiement - partie Conduite du changement & formation.', 'Haber revisado el Kit de despliegue — apartado Gestión del cambio y formación.'],
  ["Formulaire d'audit du savoir-faire rempli.", 'Formulario de auditoría del saber hacer completado.'],
  ['PROCHAINES ÉTAPES', 'PRÓXIMOS PASOS'],
  ['RACI, Intégration de données et visite / kick-off', 'RACI, integración de datos y visita / kick-off'],

  ['Objectif : une 1re version de votre plateforme Mercateam, avec vos données, prête à être utilisée par les utilisateurs clés.',
   'Objetivo: una primera versión de su plataforma Mercateam, con sus datos, lista para ser utilizada por los usuarios clave.'],
  ['Architecture', 'Arquitectura'],
  ['Secteurs', 'Sectores'],
  ['Équipes  (⚠ 1 équipe = 1 matrice & 1 planning)', 'Equipos (⚠ 1 equipo = 1 matriz y 1 planning)'],
  ['Employés', 'Empleados'],
  ['→ Squelette de la plateforme pour la gestion des droits.', '→ Esqueleto de la plataforma para la gestión de derechos.'],
  ['Compétences / Habilitations', 'Competencias / Habilitaciones'],
  ['Compétences : bibliothèque (niveau, validité, recyclage), matrice, tuteur, évaluateur', 'Competencias: biblioteca (nivel, validez, reciclaje), matriz, tutor, evaluador'],
  ['Habilitations : bibliothèque, validité, matrice', 'Habilitaciones: biblioteca, validez, matriz'],
  ['→ Cœur de Mercateam sur lequel se basent les autres fonctionnalités.', '→ Núcleo de Mercateam sobre el que se basan las demás funcionalidades.'],
  ["1 poste = un ensemble de compétences et/ou d’habilitations", '1 puesto = un conjunto de competencias y/o habilitaciones'],
  ["Le planning est basé sur les postes de l'équipe", 'El planning se basa en los puestos del equipo'],
  ["→ Vue agrégée pour l'usage quotidien des chefs d'équipe.", '→ Vista agregada para el uso diario de los jefes de equipo.'],
  ['PARAMÉTRAGE', 'CONFIGURACIÓN'],
  ['Intégration initiale de données', 'Integración inicial de datos'],
  ['Poste', 'Puesto'],

  ['Jour 1', 'Día 1'],
  ['Audit des process & supports existants', 'Auditoría de los procesos y soportes existentes'],
  ["45 min – 1 h / cas d'usage", '45 min – 1 h / caso de uso'],
  ['Champion, Utilisateurs clés', 'Champion, Usuarios clave'],
  ['Bilan audit & définition des critères de Go Live', 'Balance de la auditoría y definición de los criterios de Go Live'],
  ['Jour 2', 'Día 2'],
  ['Formation théorique', 'Formación teórica'],
  ['Ateliers pratiques', 'Talleres prácticos'],
  ['Bilan & prochaines étapes', 'Balance y próximos pasos'],
  ['VISITE', 'VISITA'],
  ['Agenda suggéré pour la visite sur site', 'Agenda sugerida para la visita a planta'],

  ['GROUPES DE TRAVAIL (GT)', 'GRUPOS DE TRABAJO (GT)'],
  ["Les acteurs à mobiliser par cas d'usage.", 'Los actores a movilizar por caso de uso.'],
  ['GT Pilotage · Projet', 'GT Pilotaje · Proyecto'],
  ['Acteurs : Champion · Sponsor', 'Actores: Champion · Sponsor'],
  ['GT 1 · Cartographie & pilotage des compétences', 'GT 1 · Cartografía y pilotaje de las competencias'],
  ['Focus : Piloter les compétences comme levier stratégique', 'Enfoque: Pilotar las competencias como palanca estratégica'],
  ['Resp. compétences site & groupe', 'Resp. de competencias planta y grupo'],
  ['Resp. compétences', 'Resp. de competencias'],
  ["Chefs d'équipe", 'Jefes de equipo'],
  ['GT 2 · Planning & charge-capacité', 'GT 2 · Planning y carga-capacidad'],
  ['Focus : planification fiable & réactive)', 'Enfoque: planificación fiable y reactiva)'],
  ['Charge-capacité & coûts', 'Carga-capacidad y costes'],
  ['Planificateur', 'Planificador'],
  ['Ordonnancement', 'Programación'],
  ['RRH', 'RRHH'],
  ['GT 3 · Intégration, formation & transmission', 'GT 3 · Integración, formación y transmisión'],
  ['Focus : Montée en autonomie', 'Enfoque: Progresión hacia la autonomía'],
  ['Pérenniser les savoir-faire critiques', 'Perpetuar el saber hacer crítico'],
  ['Formateur', 'Formador'],
  ['GT 4 · Conformité & sécurité au poste', 'GT 4 · Conformidad y seguridad en el puesto'],
  ['Focus : Conformité permanente & audit', 'Enfoque: Conformidad permanente y auditoría'],
  ['Opérations sûres et conformes', 'Operaciones seguras y conformes'],
  ['GT 5 · Standardisation des savoir-faire multi-sites', 'GT 5 · Estandarización del saber hacer multiplanta'],
  ['Focus : Standardiser la gestion du savoir-faire', 'Enfoque: Estandarizar la gestión del saber hacer'],
  ['Champion groupe', 'Champion de grupo'],
  ['GT 6 · Reconnaissance & équité', 'GT 6 · Reconocimiento y equidad'],
  ['Focus : Progression & rémunération équitables', 'Enfoque: Progresión y remuneración equitativas'],
  ['Direction', 'Dirección'],

  ['Polyvalence et formation', 'Polivalencia y formación'],
  ['Intégration des nouveaux entrants', 'Integración de los nuevos incorporados'],
  ['Formation réglementaire', 'Formación reglamentaria'],
  ['Formation au poste', 'Formación en el puesto'],
  ['Gestion de la polyvalence', 'Gestión de la polivalencia'],
  ['Plan de formation', 'Plan de formación'],
  ['→ Cartographie de la montée en compétence, traçabilité et transmission du savoir-faire.', '→ Cartografía del desarrollo de competencias, trazabilidad y transmisión del saber hacer.'],
  ["Planning d'absences", 'Planning de ausencias'],
  ['Prévision charge / capacité', 'Previsión carga / capacidad'],
  ['Affectation S+1', 'Asignación S+1'],
  ['Construction poste / compét. / hab.', 'Construcción puesto / compet. / hab.'],
  ['Affichage du planning', 'Visualización del planning'],
  ['→ Planification court et long terme des équipes.', '→ Planificación a corto y largo plazo de los equipos.'],
  ['Planification', 'Planificación'],
  ['Enjeux groupe et site', 'Retos de grupo y planta'],
  ['Situation sociale', 'Situación social'],
  ['Système applicatif', 'Sistema aplicativo'],
  ["→ Vue d'ensemble des enjeux et des rôles.", '→ Visión general de los retos y de los roles.'],
  ['Objectif : comprendre vos processus existants, leurs points forts et leurs limites, pour mieux vous accompagner.',
   'Objetivo: comprender sus procesos existentes, sus puntos fuertes y sus límites, para acompañarle mejor.'],
  ['Audit de vos processus de gestion du savoir-faire', 'Auditoría de sus procesos de gestión del saber hacer'],
  ['AUDIT', 'AUDITORÍA'],

  ['ANNEXE', 'ANEXO'],
  ['Annexes & supports\nde préparation kick-off', 'Anexos y materiales\nde preparación del kick-off'],
  ['Annexes', 'Anexos'],
  ['Toutes nos recommandations et supports pour mener à bien votre projet de digitalisation !',
   '¡Todas nuestras recomendaciones y materiales para llevar a cabo su proyecto de digitalización!'],
  ['RESSOURCES', 'RECURSOS'],
  ['Lire la vidéo', 'Ver el vídeo'],
  ['Digitalisation des compétences pour anticiper la perte de savoir-faire', 'Digitalización de las competencias para anticipar la pérdida de saber hacer'],
  ['Digitalisation de\nla montée en\ncompétences pour valoriser le savoir-faire', 'Digitalización del\ndesarrollo de\ncompetencias para valorizar el saber hacer'],
  ["Gestion du planning et utilisation de la donnée", 'Gestión del planning y uso del dato'],
  ['Luxe', 'Lujo'],
  ['Électronique', 'Electrónica'],
  ['Centralisation des données et montée en polyvalence', 'Centralización de los datos y aumento de la polivalencia'],
  ['Cosmétique', 'Cosmética'],
  ['Aéronautique', 'Aeronáutica'],
  ['Audits simplifiés et traçabilité des compétences', 'Auditorías simplificadas y trazabilidad de las competencias'],
  ['Manufacture', 'Manufactura'],
  ['Gestion des compétences et des formations pour gagner en polyvalence', 'Gestión de las competencias y de las formaciones para ganar polivalencia'],
  ["Découvrez les cas d’usage chez nos partenaires", 'Descubra los casos de uso en nuestros socios'],
  ['Témoignages', 'Testimonios']
];

// ---------------------------------------------------------------------------
// DECK 5 — "Hebdomadaires projet"  (contenu propre à ce deck)
// ---------------------------------------------------------------------------

var DECK5_EN = [
  ['Point projet', 'Project review'],
  ["Lien d’inscription", 'Registration link'],

  ['Action mise à jour', 'Action updated'],
  ['Action terminée', 'Action completed'],
  ['Critères de Go Live', 'Go Live criteria'],
  ['Date\ncible', 'Target\ndate'],
  ["Plan d'action", 'Action plan'],
  ['100 % des collaborateurs actifs importés', '100% of active employees imported'],
  ['Importer les intérimaires', 'Import temporary workers'],
  ['100 % des bibliothèques compétences / habilitations digitalisées', '100% of skills / certifications libraries digitalised'],
  ['Planifier un atelier', 'Schedule a workshop'],
  ['100 % des postes créés et associés aux compétences/habilitations prérequises', '100% of workstations created and linked to the required skills/certifications'],
  ['100% des utilisateurs clés formés', '100% of key users trained'],
  ['La gouvernance (RACI et droits) est définie', 'Governance (RACI and rights) is defined'],
  ['Une feuille de route post-déploiement est définie', 'A post-deployment roadmap is defined'],
  ['100 % des matrices de compétences sont à jour', '100% of skills matrices are up to date'],
  ["→ Pilote sur les postes contrôle, hastamat et CDL avec Vanessa d'ici mi-janvier",
   '→ Pilot on the inspection, hastamat and CDL workstations with Vanessa by mid-January'],
  ['Atelier aux autres équipes vers la semaine du 13 janvier — à planifier', 'Workshop for the other teams around the week of 13 January — to be scheduled'],
  ['La liste des contenus / questionnaires à intégrer est définie', 'The list of content / questionnaires to load is defined'],
  ["100 % des matrices d'habilitation sont à jour", '100% of certification matrices are up to date'],
  ['Avoir prévenu et formé les utilisateurs clés', 'Have informed and trained the key users'],
  ['Avoir prévenu et formé les autres champions', 'Have informed and trained the other champions'],
  ['Les supports de formation du(des) poste(s) X sont digitalisés', 'The training materials for workstation(s) X are digitalised'],
  ["Former les chefs d'équipes référents", 'Train the lead team leaders'],
  ['Créer les compétences au poste', 'Create the workstation skills'],
  ['Définir les niveaux → Julie va communiquer', 'Define the levels → Julie will communicate'],
  ['Remplir les matrices compétences au poste 2×8 → voir les cde non clés',
   'Fill in the 2-shift workstation skills matrices → check the non-key team leaders'],
  ["Les supports d'évaluation du(des) poste(s) X sont digitalisés", 'The assessment materials for workstation(s) X are digitalised'],
  ['Opt : X formations ont été lancées et suivies sur Mercateam', 'Opt: X trainings have been launched and tracked in Mercateam'],
  ["PLAN D’ACTION", 'ACTION PLAN'],

  ['CHIFFRES CLÉS', 'KEY FIGURES'],
  ["Suivi de l’adoption", 'Adoption tracking'],
  ['CEO & co-fondateur Mercateam', 'CEO & co-founder, Mercateam']
];

var DECK5_ES = [
  ['Point projet', 'Punto de proyecto'],
  ["Lien d’inscription", 'Enlace de inscripción'],

  ['Action mise à jour', 'Acción actualizada'],
  ['Action terminée', 'Acción completada'],
  ['Critères de Go Live', 'Criterios de Go Live'],
  ['Date\ncible', 'Fecha\nobjetivo'],
  ["Plan d'action", 'Plan de acción'],
  ['100 % des collaborateurs actifs importés', '100 % de los colaboradores activos importados'],
  ['Importer les intérimaires', 'Importar los trabajadores temporales'],
  ['100 % des bibliothèques compétences / habilitations digitalisées', '100 % de las bibliotecas de competencias / habilitaciones digitalizadas'],
  ['Planifier un atelier', 'Planificar un taller'],
  ['100 % des postes créés et associés aux compétences/habilitations prérequises', '100 % de los puestos creados y asociados a las competencias/habilitaciones requeridas'],
  ['100% des utilisateurs clés formés', '100 % de los usuarios clave formados'],
  ['La gouvernance (RACI et droits) est définie', 'La gobernanza (RACI y derechos) está definida'],
  ['Une feuille de route post-déploiement est définie', 'Se ha definido una hoja de ruta post-despliegue'],
  ['100 % des matrices de compétences sont à jour', '100 % de las matrices de competencias están actualizadas'],
  ["→ Pilote sur les postes contrôle, hastamat et CDL avec Vanessa d'ici mi-janvier",
   '→ Piloto en los puestos de control, hastamat y CDL con Vanessa antes de mediados de enero'],
  ['Atelier aux autres équipes vers la semaine du 13 janvier — à planifier', 'Taller para los demás equipos hacia la semana del 13 de enero — por planificar'],
  ['La liste des contenus / questionnaires à intégrer est définie', 'La lista de contenidos / cuestionarios a integrar está definida'],
  ["100 % des matrices d'habilitation sont à jour", '100 % de las matrices de habilitaciones están actualizadas'],
  ['Avoir prévenu et formé les utilisateurs clés', 'Haber informado y formado a los usuarios clave'],
  ['Avoir prévenu et formé les autres champions', 'Haber informado y formado a los demás champions'],
  ['Les supports de formation du(des) poste(s) X sont digitalisés', 'Los materiales de formación del(de los) puesto(s) X están digitalizados'],
  ["Former les chefs d'équipes référents", 'Formar a los jefes de equipo referentes'],
  ['Créer les compétences au poste', 'Crear las competencias del puesto'],
  ['Définir les niveaux → Julie va communiquer', 'Definir los niveles → Julie comunicará'],
  ['Remplir les matrices compétences au poste 2×8 → voir les cde non clés',
   'Rellenar las matrices de competencias del puesto 2×8 → ver los jefes de equipo no clave'],
  ["Les supports d'évaluation du(des) poste(s) X sont digitalisés", 'Los materiales de evaluación del(de los) puesto(s) X están digitalizados'],
  ['Opt : X formations ont été lancées et suivies sur Mercateam', 'Opc.: X formaciones se han lanzado y seguido en Mercateam'],
  ["PLAN D’ACTION", 'PLAN DE ACCIÓN'],

  ['CHIFFRES CLÉS', 'CIFRAS CLAVE'],
  ["Suivi de l’adoption", 'Seguimiento de la adopción'],
  ['CEO & co-fondateur Mercateam', 'CEO y cofundador de Mercateam']
];

// ---------------------------------------------------------------------------
// DECK 3 — "Kickoff"  (contenu propre ; reprend aussi les blocs du deck 2)
// ---------------------------------------------------------------------------

var DECK3_EN = [
  ['Présentation de Mercateam', 'Introducing Mercateam'],
  ['Mission et démonstration de la plateforme.', 'Mission and platform demo.'],
  ['Jalons, phases de déploiement et équipes projet.', 'Milestones, deployment phases and project teams.'],
  ['Contexte & enjeux du projet', 'Context & project challenges'],
  ['Enjeux, maturité actuelle et cible.', 'Challenges, current and target maturity.'],
  ['Pilotage du déploiement', 'Steering the deployment'],
  ['Critères de Go Live et groupes de travail.', 'Go Live criteria and working groups.'],
  ['Kit de déploiement, formation et témoignages.', 'Deployment kit, training and testimonials.'],

  ['Gestion des compétences, plannings,\nformation pour les équipes de production',
   'Skills, scheduling and training\nmanagement for production teams'],
  ['pays', 'countries'],
  ['secteurs', 'sectors'],
  ['employés', 'employees'],
  ['Agroalimentaire', 'Food & beverage'],
  ['Pharmaceutique', 'Pharmaceutical'],
  ['Aéronautique, manufacture, BTP', 'Aerospace, manufacturing, construction'],
  ['Luxe & cosmétique', 'Luxury & cosmetics'],

  ['Affectation en fonction des compétences, absences, charge, etc.', 'Assignment based on skills, absences, workload, etc.'],
  ['PLANNING AUTOMATISÉ', 'AUTOMATED SCHEDULING'],
  ['FORMATION', 'TRAINING'],
  ['Préparation, suivi, validation et traçabilité des formations', 'Preparation, tracking, validation and traceability of training'],
  ['Centralisation et standardisation des compétences et habilitations', 'Centralisation and standardisation of skills and certifications'],
  ['MATRICE DE COMPÉTENCES', 'SKILLS MATRIX'],
  ['Une plateforme centralisée pour gérer vos équipes de production', 'One central platform to manage your production teams'],

  ['NOTRE MISSION', 'OUR MISSION'],
  ["Remettre\nl’humain au coeur de l’industrie 4.0", 'Putting people\nback at the heart of Industry 4.0'],
  ['Démonstration de Mercateam', 'Mercateam demo'],

  ['1 · Initiation', '1 · Introduction'],
  ["Comprendre l'outil", 'Understanding the tool'],
  ['→ Découvrir les fonctionnalités de base.', '→ Discover the basic features.'],
  ["« Je sais où trouver l'information et comment utiliser Mercateam »", '“I know where to find information and how to use Mercateam”'],
  ['Public : Tous les nouveaux utilisateurs', 'Audience: All new users'],
  ['⇒ Insuffisant pour une utilisation en autonomie.', '⇒ Not enough for independent use.'],
  ['2 · Autonomie', '2 · Autonomy'],
  ['Opérer au quotidien', 'Operating day to day'],
  ['→ Utiliser Mercateam dans son périmètre métier.', '→ Use Mercateam within your own business scope.'],
  ['« Je sais utiliser Mercateam pour répondre à mes besoins métiers »', '“I can use Mercateam to meet my business needs”'],
  ['Public : Managers de proximité, RH, HSE', 'Audience: Frontline managers, HR, HSE'],
  ['⇒ Niveau suffisant pour la majorité des utilisateurs.', '⇒ Enough for most users.'],
  ['3 · Maturité', '3 · Maturity'],
  ['Devenir relais et moteur', 'Becoming a champion and driver'],
  ['→ Porter les chantiers long terme : audits, routines, pilotage.', '→ Carry the long-term workstreams: audits, routines, steering.'],
  ['« Je forme les nouveaux, anime la gouvernance, contribue aux standards »', '“I train newcomers, run the governance, contribute to standards”'],
  ['Public : Utilisateurs référents, relais site, responsable transformation', 'Audience: Lead users, site champions, transformation manager'],
  ["Une montée en compétence progressive : de la découverte à la maîtrise, jusqu'au rôle de relais interne.",
   'A gradual skills journey: from discovery to mastery, through to the internal champion role.'],
  ['Vous former à Mercateam', 'Training you on Mercateam'],

  ['Progresser, à votre rythme', 'Progress at your own pace'],
  ["Centre d'aide", 'Help centre'],
  ['Articles et guides pas-à-pas accessibles à tout moment', 'Articles and step-by-step guides, available any time'],
  ['Une réponse en direct de nos équipes depuis la plateforme', 'A live answer from our teams, from within the platform'],
  ['Parcours de formation en ligne pour accompagner votre montée en compétence en autonomie',
   'Online learning paths to support your independent skills growth'],
  ["Modules de montée en compétences intégrés directement dans l'outil", 'Skills-building modules built right into the tool'],

  ['LIVRABLE', 'DELIVERABLE'],
  ['Annexes & supports', 'Appendices & materials']
];

var DECK3_ES = [
  ['Présentation de Mercateam', 'Presentación de Mercateam'],
  ['Mission et démonstration de la plateforme.', 'Misión y demostración de la plataforma.'],
  ['Jalons, phases de déploiement et équipes projet.', 'Hitos, fases del despliegue y equipos de proyecto.'],
  ['Contexte & enjeux du projet', 'Contexto y retos del proyecto'],
  ['Enjeux, maturité actuelle et cible.', 'Retos, madurez actual y objetivo.'],
  ['Pilotage du déploiement', 'Pilotaje del despliegue'],
  ['Critères de Go Live et groupes de travail.', 'Criterios de Go Live y grupos de trabajo.'],
  ['Kit de déploiement, formation et témoignages.', 'Kit de despliegue, formación y testimonios.'],

  ['Gestion des compétences, plannings,\nformation pour les équipes de production',
   'Gestión de competencias, planificación\ny formación para los equipos de producción'],
  ['sites', 'plantas'],
  ['pays', 'países'],
  ['secteurs', 'sectores'],
  ['employés', 'empleados'],
  ['Agroalimentaire', 'Agroalimentario'],
  ['Pharmaceutique', 'Farmacéutico'],
  ['Aéronautique, manufacture, BTP', 'Aeronáutica, manufactura, construcción'],
  ['Luxe & cosmétique', 'Lujo y cosmética'],

  ['Affectation en fonction des compétences, absences, charge, etc.', 'Asignación en función de las competencias, ausencias, carga, etc.'],
  ['PLANNING AUTOMATISÉ', 'PLANNING AUTOMATIZADO'],
  ['FORMATION', 'FORMACIÓN'],
  ['Préparation, suivi, validation et traçabilité des formations', 'Preparación, seguimiento, validación y trazabilidad de las formaciones'],
  ['Centralisation et standardisation des compétences et habilitations', 'Centralización y estandarización de las competencias y habilitaciones'],
  ['MATRICE DE COMPÉTENCES', 'MATRIZ DE COMPETENCIAS'],
  ['Une plateforme centralisée pour gérer vos équipes de production', 'Una plataforma centralizada para gestionar sus equipos de producción'],

  ['NOTRE MISSION', 'NUESTRA MISIÓN'],
  ["Remettre\nl’humain au coeur de l’industrie 4.0", 'Devolver a las personas\nal centro de la industria 4.0'],
  ['Démonstration de Mercateam', 'Demostración de Mercateam'],

  ['1 · Initiation', '1 · Iniciación'],
  ["Comprendre l'outil", 'Comprender la herramienta'],
  ['→ Découvrir les fonctionnalités de base.', '→ Descubrir las funcionalidades básicas.'],
  ["« Je sais où trouver l'information et comment utiliser Mercateam »", '«Sé dónde encontrar la información y cómo utilizar Mercateam»'],
  ['Public : Tous les nouveaux utilisateurs', 'Público: Todos los nuevos usuarios'],
  ['⇒ Insuffisant pour une utilisation en autonomie.', '⇒ Insuficiente para un uso autónomo.'],
  ['2 · Autonomie', '2 · Autonomía'],
  ['Opérer au quotidien', 'Operar en el día a día'],
  ['→ Utiliser Mercateam dans son périmètre métier.', '→ Utilizar Mercateam en su ámbito profesional.'],
  ['« Je sais utiliser Mercateam pour répondre à mes besoins métiers »', '«Sé utilizar Mercateam para responder a mis necesidades profesionales»'],
  ['Public : Managers de proximité, RH, HSE', 'Público: Mandos intermedios, RRHH, HSE'],
  ['⇒ Niveau suffisant pour la majorité des utilisateurs.', '⇒ Nivel suficiente para la mayoría de los usuarios.'],
  ['3 · Maturité', '3 · Madurez'],
  ['Devenir relais et moteur', 'Convertirse en relevo e impulsor'],
  ['→ Porter les chantiers long terme : audits, routines, pilotage.', '→ Liderar los proyectos a largo plazo: auditorías, rutinas, pilotaje.'],
  ['« Je forme les nouveaux, anime la gouvernance, contribue aux standards »', '«Formo a los nuevos, animo la gobernanza, contribuyo a los estándares»'],
  ['Public : Utilisateurs référents, relais site, responsable transformation', 'Público: Usuarios referentes, relevos de planta, responsable de transformación'],
  ["Une montée en compétence progressive : de la découverte à la maîtrise, jusqu'au rôle de relais interne.",
   'Un desarrollo progresivo de competencias: del descubrimiento al dominio, hasta el rol de relevo interno.'],
  ['Vous former à Mercateam', 'Formarle en Mercateam'],

  ['Progresser, à votre rythme', 'Progresar a su ritmo'],
  ["Centre d'aide", 'Centro de ayuda'],
  ['Chat support', 'Chat de soporte'],
  ['Articles et guides pas-à-pas accessibles à tout moment', 'Artículos y guías paso a paso accesibles en todo momento'],
  ['Une réponse en direct de nos équipes depuis la plateforme', 'Una respuesta en directo de nuestros equipos desde la plataforma'],
  ['Parcours de formation en ligne pour accompagner votre montée en compétence en autonomie',
   'Itinerarios de formación en línea para acompañar su desarrollo de competencias de forma autónoma'],
  ["Modules de montée en compétences intégrés directement dans l'outil", 'Módulos de desarrollo de competencias integrados directamente en la herramienta'],

  ['LIVRABLE', 'ENTREGABLE'],
  ['Annexes & supports', 'Anexos y materiales']
];

// ---------------------------------------------------------------------------
// DECK 4 — "BILAN"  (contenu propre)
// ---------------------------------------------------------------------------

var DECK4_EN = [
  // Ces textes vivent dans des zones séparées ou entourent un tiret cadratin :
  // une entrée d'un seul tenant ne les attrapait pas.
  ['Parce que vos retours d’expérience', 'Because your feedback'],
  // Un espace invisible se cache dans ces six mots : l'entrée d'un seul tenant
  // a échoué deux fois là où ses deux voisines passaient. Coupée en deux.
  ['concrets,', 'concrete,'],
  ['vécus sur le terrain', 'lived on the shop floor'],
  ['ont bien plus de poids auprès d’autres industriels que tout ce qu’on pourrait dire nous-mêmes.', 'carries far more weight with other manufacturers than anything we could say ourselves.'],
  ['COPIL', 'Steering committee'],
  ['Opérationnel', 'Operational'],
  ['Stratégique', 'Strategic'],
  ['Atelier', 'Workshop'],
  ['de valeur & ROI', 'value & ROI'],

  ['Bilan', 'Review'],

  // MercaNews printemps — variante propre à ce deck
  ['Mercateam est officiellement\nadhérent au GIFAS.', 'Mercateam is now officially\na GIFAS member.'],
  ["Un gage de confiance\npour le secteur de l’aéro-défense.", 'A mark of trust\nfor the aerospace & defence sector.'],
  ['On vient à vous', "We're coming to you"],
  ['Retrouvez-nous sur', 'Meet us at'],
  ['les salons de votre secteur :', 'the trade shows in your sector:'],
  ['Birmingham – 3-4 juin', 'Birmingham – 3-4 June'],
  ['Paris – 23-24 juin', 'Paris – 23-24 June'],
  ['MercaNews | PRINTEMPS 2026', 'MercaNews | SPRING 2026'],
  ["Notre CEO présentera toutes nos dernières innovations lors d'un webinar exclusivement réservé aux clients Mercateam.",
   'Our CEO will present all our latest innovations in a webinar exclusively for Mercateam customers.'],
  ['25 juin – Inscription', '25 June – Register'],

  ['Donnez de la voix à votre expérience', 'Give your experience a voice'],
  ['Nous avons besoin de vous !', 'We need you!'],
  ['Nous essayons de renforcer notre présence sur G2, et votre avis ferait une vraie différence. Si vous pouvez prendre 2 minutes pour nous laisser une note, cela nous aiderait beaucoup.',
   "We're working to strengthen our presence on G2, and your review would make a real difference. If you can spare 2 minutes to leave us a rating, it would help us a lot."],
  ["Parce que vos retours d’expérience — concrets, vécus sur le terrain — ont bien plus de poids auprès d’autres industriels que tout ce qu’on pourrait dire nous-mêmes.",
   'Because your feedback — concrete, lived on the shop floor — carries far more weight with other manufacturers than anything we could say ourselves.'],
  ['Un grand merci pour votre temps et votre confiance', 'Many thanks for your time and your trust'],
  ['Donnez votre avis dès maintenant sur G2 !', 'Leave your review on G2 now!'],

  ['Synthèse du projet', 'Project summary'],
  ['SYNTHÈSE DU PROJET', 'PROJECT SUMMARY'],
  ['Rappel du contexte', 'Context recap'],
  ['4 mois', '4 months'],
  ["d’accompagnement", 'of support'],
  ['Enjeux & objectifs', 'Challenges & objectives'],
  ['Piloter les compétences comme levier de performance & de résilience', 'Steering skills as a lever for performance & resilience'],
  ['Charge admin ↓ · Pertes de savoir-faire anticipées', 'Admin burden ↓ · Know-how loss anticipated'],
  ['Time-to-autonomy ↓ · Charge admin formation ↓', 'Time-to-autonomy ↓ · Training admin burden ↓'],
  ["Pénalités & temps d'audit évités · Risque de non-conformité ↓", 'Penalties & audit time avoided · Non-compliance risk ↓'],
  ['Temps de planning ↓ · Sous & sur-staffing ↓', 'Scheduling time ↓ · Under & overstaffing ↓'],
  ['Interconnexion Employés & Absences · SSO', 'Employee & Absence interconnection · SSO'],
  ['Accompagnement réalisé', 'Support delivered'],
  ['Périmètre déployé', 'Deployed scope'],
  ['Durée réelle', 'Actual duration'],
  ['Utilisateurs formés', 'Users trained'],
  ['Rappel du déroulé du déploiement', 'Recap of how the deployment unfolded'],
  ["Critères de Go Live et plan d'action", 'Go Live criteria and action plan'],

  ["Etat de l’art avant / après déploiement de Mercateam", 'State of play before / after the Mercateam deployment'],
  ['PROCESSUS INTEGRATION DES NOUVEAUX ENTRANTS : AVANT', 'NEW JOINER ONBOARDING PROCESS: BEFORE'],
  ['Diagnostic initial - JJMMAAAA', 'Initial diagnostic - DDMMYYYY'],
  ['PROCESSUS INTEGRATION DES NOUVEAUX ENTRANTS : AVEC MERCATEAM', 'NEW JOINER ONBOARDING PROCESS: WITH MERCATEAM'],
  ['Processus avec Mercateam', 'Process with Mercateam'],

  ['Votre avis compte !', 'Your feedback matters!'],
  ['Merci pour votre investissement durant ce projet', 'Thank you for your commitment throughout this project'],
  ["Dans une démarche d’amélioration continue, partagez votre ressenti et vos recommandations sur notre accompagnement",
   'As part of our continuous improvement, share your impressions and recommendations on our support'],
  ['Moins de 5 minutes à remplir', 'Under 5 minutes to complete'],

  ['PROCHAINES ETAPES', 'NEXT STEPS'],
  ['Mercateam vous accompagne post-déploiement', 'Mercateam supports you after deployment'],
  ["Tout ce qu'il faut pour être autonome et progresser, à votre rythme.", 'Everything you need to be independent and progress at your own pace.'],
  ["Centre d'aide\n& chat support", 'Help centre\n& chat support'],
  ['Articles et guides pas-à-pas accessibles à tout moment', 'Articles and step-by-step guides, available any time'],
  ['Basées sur notre expérience, nos recommandations pour continuer à optimiser vos processus de gestion du savoir-faire.',
   'Based on our experience, our recommendations to keep optimising your know-how management processes.'],
  ['Mercateam Academy\n& modes opératoires', 'Mercateam Academy\n& standard operating procedures'],
  ['Parcours de formation en ligne pour accompagner votre montée en compétence, en autonomie',
   'Online learning paths to support your skills growth, independently'],
  ['Prénom - Nom', 'First name - Last name'],
  ['Points réguliers avec votre Customer Success dédiée pour soutenir votre montée en maturité.',
   'Regular check-ins with your dedicated Customer Success manager to support your maturity growth.'],

  ["Plan d’action pour consolider l’existant", "Action plan to consolidate what's in place"],
  ['Cible', 'Target'],
  ['Cartographie des compétences', 'Skills mapping'],
  ['Fiabiliser la cartographie atelier (Overview), définir « opérationnel » par poste / Owner / Echéance',
   'Make the shop-floor mapping reliable (Overview), define “operational” per workstation / Owner / Deadline'],
  ['Action / Owner / Echéance', 'Action / Owner / Deadline'],
  ["Planning d'affectation court terme", 'Short-term assignment scheduling'],
  ['Connecter workload + absences SIRH, activer les alertes de gaps / Owner / Echéance',
   'Connect workload + HRIS absences, switch on gap alerts / Owner / Deadline'],
  ['Conformité & sécurité des affectations', 'Compliance & assignment safety'],
  ['Alertes habilitations avant affectation, surveillance des expirations / Owner / Echéance',
   'Certification alerts before assignment, expiry monitoring / Owner / Deadline'],
  ['Les nouveaux sujets à explorer', 'New topics to explore'],
  ['Echéance cible', 'Target deadline'],
  ["Nouveau cas d’usage  à déployer", 'New use case to deploy'],
  ['À définir avec le CS', 'To be defined with the CS'],

  ['Gouvernance post-déploiement', 'Post-deployment governance'],
  ['Vos rituels et accompagnement pour la suite du partenariat', 'Your rituals and support for the rest of the partnership'],
  ['COPIL\nOpérationnel', 'Steering committee\nOperational'],
  ['COPIL\nStratégique', 'Steering committee\nStrategic'],
  ['COPIL Stratégique', 'Strategic steering committee'],
  ['Atelier\nde valeur & ROI', 'Value & ROI\nworkshop'],
  ['Atelier de valeur\n& ROI', 'Value workshop\n& ROI'],
  ["Suivi de l'adoption terrain et de la feuille de route", 'Tracking field adoption and the roadmap'],
  ['Mesure de la valeur générée et définition des objectifs cibles', 'Measuring the value generated and setting target objectives'],
  ['Bilan de la trajectoire et alignement avec les enjeux industriels', 'Review of the trajectory and alignment with industrial challenges'],

  ['Employés concernés', 'Employees in scope'],
  ['Secteur ciblé', 'Target area'],
  ['Pilote + Formation des formateurs', 'Pilot + Train-the-trainer'],
  ['Périmètre fonctionnel', 'Functional scope'],
  ['Compétences', 'Skills']
];

var DECK4_ES = [
  // Ces textes vivent dans des zones séparées ou entourent un tiret cadratin :
  // une entrée d'un seul tenant ne les attrapait pas.
  ['Parce que vos retours d’expérience', 'Porque sus experiencias'],
  ['concrets,', 'concretas,'],
  ['vécus sur le terrain', 'vividas en el terreno'],
  ['ont bien plus de poids auprès d’autres industriels que tout ce qu’on pourrait dire nous-mêmes.', 'tienen mucho más peso ante otros industriales que cualquier cosa que pudiéramos decir nosotros mismos.'],
  ['COPIL', 'Comité de dirección'],
  ['Opérationnel', 'Operativo'],
  ['Stratégique', 'Estratégico'],
  ['Atelier', 'Taller'],
  ['de valeur & ROI', 'de valor y ROI'],

  ['Bilan', 'Balance'],

  ['Mercateam est officiellement\nadhérent au GIFAS.', 'Mercateam es oficialmente\nmiembro del GIFAS.'],
  ["Un gage de confiance\npour le secteur de l’aéro-défense.", 'Una garantía de confianza\npara el sector aeroespacial y de defensa.'],
  ['On vient à vous', 'Vamos a su encuentro'],
  ['Retrouvez-nous sur', 'Encuéntrenos en'],
  ['les salons de votre secteur :', 'las ferias de su sector:'],
  ['Birmingham – 3-4 juin', 'Birmingham – 3-4 de junio'],
  ['Paris – 23-24 juin', 'París – 23-24 de junio'],
  ['MercaNews | PRINTEMPS 2026', 'MercaNews | PRIMAVERA 2026'],
  ["Notre CEO présentera toutes nos dernières innovations lors d'un webinar exclusivement réservé aux clients Mercateam.",
   'Nuestro CEO presentará todas nuestras últimas innovaciones en un webinar reservado exclusivamente a los clientes Mercateam.'],
  ['25 juin – Inscription', '25 de junio – Inscripción'],

  ['Donnez de la voix à votre expérience', 'Dé voz a su experiencia'],
  ['Nous avons besoin de vous !', '¡Le necesitamos!'],
  ['Nous essayons de renforcer notre présence sur G2, et votre avis ferait une vraie différence. Si vous pouvez prendre 2 minutes pour nous laisser une note, cela nous aiderait beaucoup.',
   'Estamos reforzando nuestra presencia en G2, y su opinión marcaría una verdadera diferencia. Si puede dedicar 2 minutos a dejarnos una valoración, nos ayudaría mucho.'],
  ["Parce que vos retours d’expérience — concrets, vécus sur le terrain — ont bien plus de poids auprès d’autres industriels que tout ce qu’on pourrait dire nous-mêmes.",
   'Porque sus experiencias — concretas, vividas en el terreno — tienen mucho más peso ante otros industriales que cualquier cosa que pudiéramos decir nosotros mismos.'],
  ['Un grand merci pour votre temps et votre confiance', 'Muchas gracias por su tiempo y su confianza'],
  ['Donnez votre avis dès maintenant sur G2 !', '¡Deje su opinión ahora en G2!'],

  ['Synthèse du projet', 'Síntesis del proyecto'],
  ['SYNTHÈSE DU PROJET', 'SÍNTESIS DEL PROYECTO'],
  ['Rappel du contexte', 'Recordatorio del contexto'],
  ['4 mois', '4 meses'],
  ["d’accompagnement", 'de acompañamiento'],
  ['Enjeux & objectifs', 'Retos y objetivos'],
  ['Piloter les compétences comme levier de performance & de résilience', 'Pilotar las competencias como palanca de rendimiento y resiliencia'],
  ['Charge admin ↓ · Pertes de savoir-faire anticipées', 'Carga administrativa ↓ · Pérdidas de saber hacer anticipadas'],
  ['Time-to-autonomy ↓ · Charge admin formation ↓', 'Time-to-autonomy ↓ · Carga administrativa de formación ↓'],
  ["Pénalités & temps d'audit évités · Risque de non-conformité ↓", 'Penalizaciones y tiempo de auditoría evitados · Riesgo de no conformidad ↓'],
  ['Temps de planning ↓ · Sous & sur-staffing ↓', 'Tiempo de planificación ↓ · Infra y sobredotación ↓'],
  ['Interconnexion Employés & Absences · SSO', 'Interconexión Empleados y Ausencias · SSO'],
  ['Accompagnement réalisé', 'Acompañamiento realizado'],
  ['Périmètre déployé', 'Alcance desplegado'],
  ['Durée réelle', 'Duración real'],
  ['Utilisateurs formés', 'Usuarios formados'],
  ['Rappel du déroulé du déploiement', 'Recordatorio del desarrollo del despliegue'],
  ["Critères de Go Live et plan d'action", 'Criterios de Go Live y plan de acción'],

  ["Etat de l’art avant / après déploiement de Mercateam", 'Estado del arte antes / después del despliegue de Mercateam'],
  ['PROCESSUS INTEGRATION DES NOUVEAUX ENTRANTS : AVANT', 'PROCESO DE INTEGRACIÓN DE NUEVOS INCORPORADOS: ANTES'],
  ['Diagnostic initial - JJMMAAAA', 'Diagnóstico inicial - DDMMAAAA'],
  ['PROCESSUS INTEGRATION DES NOUVEAUX ENTRANTS : AVEC MERCATEAM', 'PROCESO DE INTEGRACIÓN DE NUEVOS INCORPORADOS: CON MERCATEAM'],
  ['Processus avec Mercateam', 'Proceso con Mercateam'],

  ['Votre avis compte !', '¡Su opinión cuenta!'],
  ['Merci pour votre investissement durant ce projet', 'Gracias por su implicación durante este proyecto'],
  ["Dans une démarche d’amélioration continue, partagez votre ressenti et vos recommandations sur notre accompagnement",
   'En un enfoque de mejora continua, comparta sus impresiones y recomendaciones sobre nuestro acompañamiento'],
  ['Moins de 5 minutes à remplir', 'Menos de 5 minutos para completar'],

  ['PROCHAINES ETAPES', 'PRÓXIMOS PASOS'],
  ['Mercateam vous accompagne post-déploiement', 'Mercateam le acompaña tras el despliegue'],
  ["Tout ce qu'il faut pour être autonome et progresser, à votre rythme.", 'Todo lo necesario para ser autónomo y progresar a su ritmo.'],
  ["Centre d'aide\n& chat support", 'Centro de ayuda\ny chat de soporte'],
  ['Articles et guides pas-à-pas accessibles à tout moment', 'Artículos y guías paso a paso accesibles en todo momento'],
  ['Basées sur notre expérience, nos recommandations pour continuer à optimiser vos processus de gestion du savoir-faire.',
   'Basadas en nuestra experiencia, nuestras recomendaciones para seguir optimizando sus procesos de gestión del saber hacer.'],
  ['Mercateam Academy\n& modes opératoires', 'Mercateam Academy\ny procedimientos operativos'],
  ['Parcours de formation en ligne pour accompagner votre montée en compétence, en autonomie',
   'Itinerarios de formación en línea para acompañar su desarrollo de competencias, de forma autónoma'],
  ['Prénom - Nom', 'Nombre - Apellido'],
  ['Points réguliers avec votre Customer Success dédiée pour soutenir votre montée en maturité.',
   'Reuniones periódicas con su Customer Success dedicada para apoyar su aumento de madurez.'],

  ["Plan d’action pour consolider l’existant", 'Plan de acción para consolidar lo existente'],
  ['Cible', 'Objetivo'],
  ['Cartographie des compétences', 'Cartografía de las competencias'],
  ['Fiabiliser la cartographie atelier (Overview), définir « opérationnel » par poste / Owner / Echéance',
   'Fiabilizar la cartografía del taller (Overview), definir «operativo» por puesto / Owner / Plazo'],
  ['Action / Owner / Echéance', 'Acción / Owner / Plazo'],
  ["Planning d'affectation court terme", 'Planning de asignación a corto plazo'],
  ['Connecter workload + absences SIRH, activer les alertes de gaps / Owner / Echéance',
   'Conectar carga de trabajo + ausencias SIRH, activar las alertas de gaps / Owner / Plazo'],
  ['Conformité & sécurité des affectations', 'Conformidad y seguridad de las asignaciones'],
  ['Alertes habilitations avant affectation, surveillance des expirations / Owner / Echéance',
   'Alertas de habilitaciones antes de la asignación, vigilancia de los vencimientos / Owner / Plazo'],
  ['Les nouveaux sujets à explorer', 'Los nuevos temas a explorar'],
  ['Echéance cible', 'Plazo objetivo'],
  ["Nouveau cas d’usage  à déployer", 'Nuevo caso de uso a desplegar'],
  ['À définir avec le CS', 'Por definir con el CS'],

  ['Gouvernance post-déploiement', 'Gobernanza tras el despliegue'],
  ['Vos rituels et accompagnement pour la suite du partenariat', 'Sus rituales y acompañamiento para la continuación de la alianza'],
  ['COPIL\nOpérationnel', 'Comité de dirección\nOperativo'],
  ['COPIL\nStratégique', 'Comité de dirección\nEstratégico'],
  ['COPIL Stratégique', 'Comité de dirección estratégico'],
  ['Atelier\nde valeur & ROI', 'Taller\nde valor y ROI'],
  ['Atelier de valeur\n& ROI', 'Taller de valor\ny ROI'],
  ["Suivi de l'adoption terrain et de la feuille de route", 'Seguimiento de la adopción en el terreno y de la hoja de ruta'],
  ['Mesure de la valeur générée et définition des objectifs cibles', 'Medición del valor generado y definición de los objetivos'],
  ['Bilan de la trajectoire et alignement avec les enjeux industriels', 'Balance de la trayectoria y alineación con los retos industriales'],

  ['Employés concernés', 'Empleados afectados'],
  ['Production', 'Producción'],
  ['Secteur ciblé', 'Sector objetivo'],
  ['Pilote + Formation des formateurs', 'Piloto + Formación de formadores'],
  ['Périmètre fonctionnel', 'Alcance funcional'],
  ['Compétences', 'Competencias']
];

// ---------------------------------------------------------------------------
// DECK 6 — "COPIL"  (contenu propre)
// ---------------------------------------------------------------------------

var DECK6_EN = [
  ['COPIL', 'Steering committee'],
  ['FEUILLE DE ROUTE', 'ROADMAP'],
  ['Points essentiels', 'Key points'],
  ['Date cible de GO Live', 'Target GO Live date'],
  ['Avancement du déploiement', 'Deployment progress'],
  ["Statut des objectifs cibles", 'Status of target objectives'],
  ['RAPPEL', 'REMINDER'],
  ['Parcours au poste', 'Workstation learning path'],
  ['Accomplissements', 'Achievements']
];

var DECK6_ES = [
  ['COPIL', 'Comité de dirección'],
  ['FEUILLE DE ROUTE', 'HOJA DE RUTA'],
  ['Points essentiels', 'Puntos esenciales'],
  ['Date cible de GO Live', 'Fecha objetivo de GO Live'],
  ['Avancement du déploiement', 'Avance del despliegue'],
  ["Statut des objectifs cibles", 'Estado de los objetivos'],
  ['RAPPEL', 'RECORDATORIO'],
  ['Parcours au poste', 'Itinerario en el puesto'],
  ['Accomplissements', 'Logros']
];
