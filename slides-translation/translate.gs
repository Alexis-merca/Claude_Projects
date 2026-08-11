/**
 * Traduction des copies EN / ES de présentations Google Slides.
 *
 * Principe : les copies ont déjà été créées dans le dossier "WIP Alexis trad".
 * Ce script ne fait que remplacer le texte français par sa traduction,
 * dans les copies uniquement. Les originaux ne sont jamais ouverts.
 *
 * Utilisation : voir README.md
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

/** Traite tous les jobs déclarés dans getJobs(). */
function translateAll() {
  getJobs().forEach(function (job) {
    Logger.log(translateOne(job));
  });
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
 * Applique une table de traduction à une présentation.
 * Les chaînes les plus longues sont traitées en premier, pour qu'une expression
 * comme "Déploiement module Formation" soit remplacée avant le simple "Formation".
 */
function translateOne(job) {
  var pres = SlidesApp.openById(job.fileId);
  var pairs = job.map.slice().sort(function (a, b) {
    return b[0].length - a[0].length;
  });

  // Le texte de chaque cible est relevé UNE fois, avant de remplacer quoi que
  // ce soit, pour n'appeler l'API que là où la chaîne existe. Sans ce filtrage
  // il faudrait un appel par entrée et par page — des milliers d'appels,
  // presque tous pour rien, et un dépassement de la limite de 6 minutes.
  var scan = { chars: 0, elements: 0, errors: [] };

  var slidesText = '';
  pres.getSlides().forEach(function (slide) {
    slidesText += '\n' + pageText(slide, scan);
  });

  // pres.replaceAllText() couvre toutes les slides en un seul appel. Les notes,
  // masques et mises en page se traitent page par page.
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

  // Le filtrage n'est qu'une optimisation : si le relevé a échoué, mieux vaut
  // être lent que de ne rien traduire. On repasse alors en force sur les
  // slides, qui portent la quasi-totalité du texte.
  var brute = slidesText.replace(/\s/g, '').length === 0;

  var hits = 0;
  var misses = [];
  var errors = [];

  pairs.forEach(function (pair) {
    var found = 0;

    variants(pair[0]).forEach(function (v) {
      if (brute || slidesText.indexOf(v) !== -1) {
        try {
          found += pres.replaceAllText(v, pair[1], true);
        } catch (e) {
          errors.push('slides — ' + pair[0] + ' (' + e.message + ')');
        }
      }
      extras.forEach(function (e) {
        if (e.text && e.text.indexOf(v) !== -1) {
          try {
            found += e.page.replaceAllText(v, pair[1], true);
          } catch (err) {
            errors.push(e.label + ' — ' + pair[0] + ' (' + err.message + ')');
          }
        }
      });
    });

    hits += found;
    if (found === 0) misses.push(pair[0]);
  });

  pres.saveAndClose();

  var report = [
    '=== ' + job.label + ' (' + job.fileId + ') ===',
    'relevé : ' + scan.elements + ' éléments, ' + scan.chars + ' caractères'
      + (brute ? '  → AUCUN TEXTE RELEVÉ SUR LES SLIDES, passage en mode force' : ''),
    hits + ' remplacements effectués sur ' + pairs.length + ' entrées.',
    misses.length
      ? 'NON TROUVÉ (' + misses.length + ') :\n  - ' + misses.join('\n  - ')
      : 'Aucune entrée manquée.'
  ];
  if (scan.errors.length) {
    report.push('RELEVÉ INCOMPLET (' + scan.errors.length + ') :\n  - '
      + dedupe(scan.errors).join('\n  - '));
  }
  if (errors.length) {
    report.push('ERREURS TOLÉRÉES (' + errors.length + ') :\n  - ' + errors.join('\n  - '));
  }
  return report.join('\n');
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
  expand(function (x) { return x.replace(/\n/g, ' '); });                  // saut dur -> espace
  expand(function (x) { return x.replace(/\n/g, '\u000B'); });             // saut dur -> saut souple

  return out;
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
    {
      label: '052026 - EN - Deployment presentation',
      fileId: '1bkXygGzUiBcKVJC8OfS-i8oPG3GcxMJU72ogyP9Yrt8',
      map: DECK1_EN
    },
    {
      label: '052026 - ES - Presentación de despliegue',
      fileId: '12k1HgDvDlUqQTM70kwDpGXUIyyR8bP43fWQpoEZ_vfY',
      map: DECK1_ES
    }
  ];
}

// ---------------------------------------------------------------------------
// DECK 1 — "052026 - FR - Présentation déploiement"  →  EN
// ---------------------------------------------------------------------------

var DECK1_EN = [
  // Couverture
  ['DÉPLOIEMENT MERCATEAM', 'MERCATEAM DEPLOYMENT'],
  ['Présentation du déploiement Mercateam', 'Mercateam deployment overview'],
  ["Le déploiement de Mercateam est exemplaire. L'équipe nous a permis de questionner nos anciennes pratiques et de les moderniser.",
   'The Mercateam deployment is exemplary. The team helped us challenge our old practices and modernise them.'],
  ['Responsable de Production', 'Production Manager'],
  ['La clé du succès : un accompagnement sur mesure', 'The key to success: tailored support'],

  // Sommaire
  ['Table des matières', 'Table of contents'],
  ["Notre équipe d'experts", 'Our team of experts'],
  ["L’équipe Mercateam qui vous accompagnent", 'The Mercateam team supporting you'],
  ['Accompagnements proposés', 'Support packages'],
  ['3 formules adaptées à vos attentes et besoins', '3 packages tailored to your expectations and needs'],
  ['Feuille de route standard', 'Standard roadmap'],
  ["Les jalons du  projet en un coup d'œil", 'The project milestones at a glance'],
  ['Méthodologie par site', 'Methodology per site'],
  ['Les 5 phases du déploiement', 'The 5 deployment phases'],
  ['Équipe projet recommandée', 'Recommended project team'],
  ['Les acteurs à mobiliser côté partenaire', 'The stakeholders to mobilise on the partner side'],
  ['Estimation de la charge partenaire', 'Estimated partner workload'],
  ['Et facteurs clés de succès', 'And key success factors'],
  ['RACI du projet', 'Project RACI'],
  ['Qui fait quoi à chaque étape', 'Who does what at each stage'],
  ['Notre offre', 'Our offer'],
  ["Détail de l'offre d'accompagnement", 'Support offer in detail'],

  // Équipe Mercateam
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
  ['Une équipe dédiée à chaque phase de votre projet', 'A dedicated team for every phase of your project'],
  ['ÉQUIPE MERCATEAM', 'MERCATEAM TEAM'],
  ["Notre équipe d'experts vous accompagne", 'Our team of experts supports you'],
  ['Prénom Nom', 'First name Last name'],

  // Feuille de route
  ['MÉTHODOLOGIE', 'METHODOLOGY'],
  ['Feuille de route suggérée', 'Suggested roadmap'],
  ['Préparation au kick-off', 'Kick-off preparation'],
  ['COPIL, points hebdomadaires, Bilan', 'Steering committee, weekly meetings, Review'],
  ['Bilan déploiement', 'Deployment review'],
  ['Intégration des données', 'Data integration'],
  ['Intégration de données', 'Data integration'],
  ["Ateliers pratiques et prise en main de l’outil par groupes de travail", 'Hands-on workshops and tool onboarding by working groups'],
  ["Phase d’autonomie", 'Autonomy phase'],
  ['Paramétrage technique', 'Technical configuration'],
  ['Interfaçage, SSO', 'Interfacing, SSO'],
  ['Kit de déploiement', 'Deployment kit'],
  ["Rapport d’audit", 'Audit report'],
  ['Rapport bilan & montée en maturité', 'Review report & maturity growth'],
  ['Livrables', 'Deliverables'],
  ['Modes opératoires', 'Standard operating procedures'],
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
  ['Utilisateurs clés', 'Key users'],
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

  // Équipe partenaire
  ['ÉQUIPE PARTENAIRE', 'PARTNER TEAM'],
  ['Votre équipe projet (groupe)', 'Your project team (group)'],
  ['Pilote le projet sur le terrain', 'Drives the project on the ground'],
  ['Relai entre Mercateam & équipes', 'Link between Mercateam & teams'],
  ["S'approprie & challenge le paramétrage", 'Owns & challenges the configuration'],
  ['Co-anime les ateliers de formation', 'Co-facilitates the training workshops'],
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

  // Annexes
  ['Annexes', 'Appendices'],
  ['SERVICES ADDITIONNELS', 'ADDITIONAL SERVICES'],
  ['Modulez votre accompagnement selon les besoins de votre site', "Tailor your support to your site's needs"],
  ['Intégration de données partenaires', 'Partner data integration'],
  ['Base : 100 employés', 'Basis: 100 employees'],
  ['Support définition / mapping', 'Support for defining / mapping'],
  ['des matrices de compétences', 'skills matrices'],
  ['Jour de visite supplémentaire', 'Additional visit day'],
  ['+ Frais de transport', '+ Travel expenses'],
  ['1 jour · 1 consultant', '1 day · 1 consultant'],
  ['Heures de formation additionnelles', 'Additional training hours'],
  ['8 heures de formation', '8 training hours'],
  ['Déploiement module Formation', 'Training module deployment'],
  ["Jusqu'à 5 utilisateurs", 'Up to 5 users'],
  ['Déploiement module Planning (*par planning à digitaliser)', 'Planning module deployment (*per schedule to digitise)'],
  ['1 planning à digitaliser', '1 schedule to digitise'],
  ['Tous les services sont cumulables et adaptables à votre déploiement', 'All services can be combined and adapted to your deployment'],
  ['0,5 J/H', '0.5 PD'],
  ['1,5 J/H*', '1.5 PD*'],
  ['1,5 J/H', '1.5 PD'],
  ['1 J/H', '1 PD'],
  ['2 J/H', '2 PD'],
  ['J/H', 'PD'],

  // Remerciements
  ['Merci !', 'Thank you!']
];

// ---------------------------------------------------------------------------
// DECK 1 — "052026 - FR - Présentation déploiement"  →  ES
// ---------------------------------------------------------------------------

var DECK1_ES = [
  // Portada
  ['DÉPLOIEMENT MERCATEAM', 'DESPLIEGUE MERCATEAM'],
  ['Présentation du déploiement Mercateam', 'Presentación del despliegue Mercateam'],
  ["Le déploiement de Mercateam est exemplaire. L'équipe nous a permis de questionner nos anciennes pratiques et de les moderniser.",
   'El despliegue de Mercateam es ejemplar. El equipo nos permitió cuestionar nuestras antiguas prácticas y modernizarlas.'],
  ['Responsable de Production', 'Responsable de Producción'],
  ['La clé du succès : un accompagnement sur mesure', 'La clave del éxito: un acompañamiento a medida'],

  // Índice
  ['Table des matières', 'Índice'],
  ["Notre équipe d'experts", 'Nuestro equipo de expertos'],
  ["L’équipe Mercateam qui vous accompagnent", 'El equipo Mercateam que le acompaña'],
  ['Accompagnements proposés', 'Modalidades de acompañamiento'],
  ['3 formules adaptées à vos attentes et besoins', '3 fórmulas adaptadas a sus expectativas y necesidades'],
  ['Feuille de route standard', 'Hoja de ruta estándar'],
  ["Les jalons du  projet en un coup d'œil", 'Los hitos del proyecto de un vistazo'],
  ['Méthodologie par site', 'Metodología por planta'],
  ['Les 5 phases du déploiement', 'Las 5 fases del despliegue'],
  ['Équipe projet recommandée', 'Equipo de proyecto recomendado'],
  ['Les acteurs à mobiliser côté partenaire', 'Los actores a movilizar del lado del socio'],
  ['Estimation de la charge partenaire', 'Estimación de la carga del socio'],
  ['Et facteurs clés de succès', 'Y factores clave de éxito'],
  ['RACI du projet', 'RACI del proyecto'],
  ['Qui fait quoi à chaque étape', 'Quién hace qué en cada etapa'],
  ['Notre offre', 'Nuestra oferta'],
  ["Détail de l'offre d'accompagnement", 'Detalle de la oferta de acompañamiento'],

  // Equipo Mercateam
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
  ['Une équipe dédiée à chaque phase de votre projet', 'Un equipo dedicado a cada fase de su proyecto'],
  ['ÉQUIPE MERCATEAM', 'EQUIPO MERCATEAM'],
  ["Notre équipe d'experts vous accompagne", 'Nuestro equipo de expertos le acompaña'],
  ['Prénom Nom', 'Nombre Apellido'],
  ['Client logo', 'Logo del cliente'],

  // Hoja de ruta
  ['MÉTHODOLOGIE', 'METODOLOGÍA'],
  ['Feuille de route suggérée', 'Hoja de ruta sugerida'],
  ['Préparation au kick-off', 'Preparación del kick-off'],
  ['COPIL, points hebdomadaires, Bilan', 'Comité de dirección, reuniones semanales, Balance'],
  ['Bilan déploiement', 'Balance del despliegue'],
  ['Intégration des données', 'Integración de datos'],
  ['Intégration de données', 'Integración de datos'],
  ["Ateliers pratiques et prise en main de l’outil par groupes de travail", 'Talleres prácticos y toma de contacto con la herramienta por grupos de trabajo'],
  ["Phase d’autonomie", 'Fase de autonomía'],
  ['Paramétrage technique', 'Configuración técnica'],
  ['Interfaçage, SSO', 'Interconexión, SSO'],
  ['Kit de déploiement', 'Kit de despliegue'],
  ["Rapport d’audit", 'Informe de auditoría'],
  ['Rapport bilan & montée en maturité', 'Informe de balance y aumento de madurez'],
  ['Livrables', 'Entregables'],
  ['Modes opératoires', 'Procedimientos operativos'],
  ['Gouvernance', 'Gobernanza'],
  ['Paramétrage', 'Configuración'],
  ['Formation', 'Formación'],
  ['Visite', 'Visita'],

  // Etapas del despliegue
  ['NOTRE MÉTHODOLOGIE', 'NUESTRA METODOLOGÍA'],
  ['Les étapes du déploiement', 'Las etapas del despliegue'],
  ['Phase', 'Fase'],
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
  ['Utilisateurs clés', 'Usuarios clave'],
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

  // Equipo socio
  ['ÉQUIPE PARTENAIRE', 'EQUIPO SOCIO'],
  ['Votre équipe projet (groupe)', 'Su equipo de proyecto (grupo)'],
  ['Update the names of the partner project team', 'Actualice los nombres del equipo de proyecto del socio'],
  ['Group project', 'Proyecto de grupo'],
  ['Site project', 'Proyecto de planta'],
  ['Pilote le projet sur le terrain', 'Lidera el proyecto en el terreno'],
  ['Relai entre Mercateam & équipes', 'Enlace entre Mercateam y los equipos'],
  ["S'approprie & challenge le paramétrage", 'Se apropia y cuestiona la configuración'],
  ['Co-anime les ateliers de formation', 'Coanima los talleres de formación'],
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

  // Nuestras expectativas
  ['Une mobilisation calibrée pour chaque acteur du projet et les facteurs clés de succès',
   'Una movilización calibrada para cada actor del proyecto y los factores clave de éxito'],
  ['+300 sites déployés', '+300 plantas desplegadas'],
  ['NOS ATTENTES', 'NUESTRAS EXPECTATIVAS'],
  ['Engagement', 'Compromiso'],
  ['Implication des parties prenantes,', 'Implicación de las partes interesadas,'],
  ['pratique autonome entre ateliers, soutien direction', 'práctica autónoma entre talleres, apoyo de la dirección'],
  ['Organisation', 'Organización'],
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

  // Anexos
  ['Annexes', 'Anexos'],
  ['SERVICES ADDITIONNELS', 'SERVICIOS ADICIONALES'],
  ['Modulez votre accompagnement selon les besoins de votre site', 'Adapte su acompañamiento a las necesidades de su planta'],
  ['Intégration de données partenaires', 'Integración de datos del socio'],
  ['Base : 100 employés', 'Base: 100 empleados'],
  ['Support définition / mapping', 'Soporte para definición / mapeo'],
  ['des matrices de compétences', 'de las matrices de competencias'],
  ['Jour de visite supplémentaire', 'Día de visita adicional'],
  ['+ Frais de transport', '+ Gastos de desplazamiento'],
  ['1 jour · 1 consultant', '1 día · 1 consultor'],
  ['Heures de formation additionnelles', 'Horas de formación adicionales'],
  ['8 heures de formation', '8 horas de formación'],
  ['Déploiement module Formation', 'Despliegue del módulo Formación'],
  ["Jusqu'à 5 utilisateurs", 'Hasta 5 usuarios'],
  ['Déploiement module Planning (*par planning à digitaliser)', 'Despliegue del módulo Planning (*por planning a digitalizar)'],
  ['1 planning à digitaliser', '1 planning a digitalizar'],
  ['Tous les services sont cumulables et adaptables à votre déploiement', 'Todos los servicios son acumulables y adaptables a su despliegue'],

  // Agradecimientos
  ['Merci !', '¡Gracias!']
];
