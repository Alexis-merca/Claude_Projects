/* ============================================================================
   Diagramme de flux — moteur autonome
   ============================================================================

   Extrait de diagnostic-os.html pour servir de source unique au diagramme,
   côté mono-fichier comme côté React.

   Deux règles tiennent tout le fichier :

   1. AUCUNE VARIABLE GLOBALE. L'original lisait `etat`, `proc()`, `client()` et
      `racine`. Tout passe désormais en argument. C'est ce qui rend le moteur
      testable hors navigateur et réutilisable dans un composant React, où ces
      globales n'existent pas.

   2. LE BALISAGE EST INCHANGÉ, AU CARACTÈRE PRÈS. Mêmes classes, mêmes
      `data-*`, même ordre d'attributs. La feuille de style existante
      fonctionne sans retouche, et l'égalité stricte avec la sortie de
      l'original est vérifiable — c'est ce que fait moteur.test.mjs.

   La géométrie n'est pas réécrite mais transposée : calcul du gabarit de
   colonnes, décalage des cartes à cheval, tracé orthogonal des flèches en
   coordonnées de mise en page. Ce code est éprouvé et validé à l'impression ;
   le réécrire « proprement » n'aurait rien changé pour l'utilisateur et aurait
   rouvert ses bugs.
   ========================================================================= */

/* ---------------------------------------------------------------------------
   Constantes de rendu
   ------------------------------------------------------------------------- */

/** Couleurs de tag de la charte : surface claire + texte foncé.

    20 paires, et non 8 : un diagnostic réel porte jusqu'à 20 rôles distincts
    (`danone-bailleul`), et la répartition par empreinte donnait alors deux ou
    trois rôles par teinte — arithmétique, pas accidentel.

    LA PALETTE S'ALLONGE PAR LA FIN, JAMAIS PAR RÉORDONNANCEMENT. Les couleurs
    choisies à la main sont enregistrées par INDEX dans `clients.si` : insérer
    ou permuter une paire repeindrait ces choix en silence. Ajouter, oui ;
    déplacer, jamais.

    Copie stricte de `PASTELS` dans `src/lib/roles.ts` : les deux doivent rester
    identiques au caractère près, sinon la pastille du diagramme et celle des
    panneaux React divergent sur le même rôle. */
export const PASTELS = [
  ['#D4DEF9', '#2D5BAE'], ['#D4F3E9', '#337572'], ['#DBEEFA', '#256F9A'], ['#DEF3CC', '#107558'],
  ['#F8EAC1', '#CE6700'], ['#F5E4D9', '#A3512B'], ['#FFCFCF', '#AA2D46'], ['#F9DBF4', '#AA2B89'],
  ['#DCD8FB', '#4B32C3'], ['#CFE9E9', '#166E6E'], ['#E8E1F7', '#6A3FB5'], ['#FBE0EC', '#A82264'],
  ['#DDE4EE', '#3B4A63'], ['#F7E2C8', '#8A5A12'], ['#E6E3DA', '#5F5A4A'], ['#FADFD5', '#93401F'],
  ['#EFDCEA', '#7A2A63'], ['#CDDCF3', '#26467F'], ['#F6D9DE', '#8E2740'], ['#E2DFF0', '#413B7A']
];

/** Nature du lien entre deux étapes — couleur et style de la flèche. */
export const LIENS = {
  '':       { couleur: '#C7B4FE', tirets: '',    marqueur: 'pointe-neutre', libelle: 'non qualifié' },
  'auto':   { couleur: '#6733FD', tirets: '',    marqueur: 'pointe-auto',   libelle: 'automatique' },
  'manuel': { couleur: '#CE6700', tirets: '5 4', marqueur: 'pointe-manuel', libelle: 'manuel' }
};

export const ORDRE_LIENS = ['', 'manuel', 'auto'];

export const BADGES_SUPPORT = [
  { motifs: ['excel', 'tableur', 'xls', 'csv', 'sheet', 'tableau', 'matrice'],
    fond: '#217346', lettre: 'X' },
  { motifs: ['powerpoint', 'ppt', 'slide', 'presentation', 'diaporama'],
    fond: '#C43E1C', lettre: 'P' },
  { motifs: ['sharepoint', 'onedrive', 'drive', 'teams', 'intranet', 'partage', 'serveur', 'reseau', 'cloud'],
    fond: '#038387', lettre: 'S' },
  { motifs: ['word', 'papier', 'imprime', 'livret', 'carton', 'formulaire', 'checklist',
             'fiche', 'feuille', 'attestation', 'classeur', 'dossier', 'registre', 'cahier'],
    fond: '#2B579A', glyphe: '<rect x="4.2" y="3.4" width="7.6" height="9.2" rx="1" fill="#fff"/><path d="M5.9 5.8h4.2M5.9 8h4.2M5.9 10.2h2.8" stroke="#2B579A" stroke-width="1.1" stroke-linecap="round"/>' },
  { motifs: ['mail', 'email', 'courriel', 'outlook', 'messagerie'],
    fond: '#0F6CBD', glyphe: '<rect x="3" y="4.6" width="10" height="6.8" rx="1" fill="#fff"/><path d="M3.6 5.4L8 8.7l4.4-3.3" stroke="#0F6CBD" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' },
  { motifs: ['video', 'film', 'tuto', 'e-learning', 'elearning'],
    fond: '#D13438', glyphe: '<path d="M6.4 5.1l4.6 2.9-4.6 2.9z" fill="#fff"/>' },
  { motifs: ['oral', 'reunion', 'brief', 'entretien', 'verbal', 'telephone', 'point'],
    fond: '#CA8A04', glyphe: '<path d="M12.6 8.5a2.3 2.3 0 0 1-2.3 2.3H6.9L4.2 12.4V5.6a2.3 2.3 0 0 1 2.3-2.3h3.8a2.3 2.3 0 0 1 2.3 2.3z" fill="#fff"/>' }
];

/** Palette de repli pour les outils inconnus.

    Un outil maison ne sera jamais dans `BADGES_SUPPORT` : la liste de motifs ne
    peut couvrir que les familles universelles. Le repli ne doit donc pas être
    une couleur unique — sur un diagnostic réel, `MyGame`, `EFIplan` et `GPLine`
    devenaient trois fois la même fenêtre indigo. La teinte vaut donc la
    POSITION de l'outil dans la liste du site (`options.outils`) ; l'empreinte
    du nom ne sert plus que de repli, pour un outil absent de cette liste.

    LA PALETTE S'ALLONGE PAR LA FIN, JAMAIS PAR RÉORDONNANCEMENT : permuter une
    entrée repeindrait tous les diagnostics existants. Les douze premières sont
    celles d'origine, dans l'ordre.

    Aucune de ces teintes ne s'approche des sept marques reconnues (vert Excel,
    orange PowerPoint, sarcelle SharePoint, bleus Word et mail, rouge vidéo,
    ambre oral) : un outil client qui ressemblerait à Excel serait pire que
    l'indigo uniforme. Pas de vert, pas de sarcelle, pas d'ambre. */
export const PALETTE_OUTILS = [
  '#5A6ACF', '#4338CA', '#7E22CE', '#B5179E',
  '#DB2777', '#9F1239', '#475569', '#5B3A29',
  '#1E3A8A', '#6D28D9', '#7C2D12', '#334155',
  '#8E24AA', '#2D5BAE', '#A82264', '#3B4A63',
  '#5E35B1', '#93401F', '#26467F', '#7A2A63'
];


/** Empreinte FNV-1a 32 bits du nom normalisé — pure, sans dépendance. Le moteur
    reste autonome (aucun import de `src/lib/`), c'est ce qui permet à ses trois
    copies de rester identiques au caractère près. */
export function empreinteNom(nom) {
  const v = String(nom || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  let h = 0x811c9dc5;
  for (let i = 0; i < v.length; i++) {
    h ^= v.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Badge de repli : initiale en lettre, teinte tirée de la POSITION de l'outil
    dans la liste du site (`options.outils`).

    L'empreinte du nom ne suffisait pas : sur les onze outils réels d'un site,
    elle produisait `EFIplan` et `Effitime` en même teinte ET même initiale —
    deux pastilles indiscernables. La position garantit l'absence de collision
    tant que le site compte moins d'outils que la palette, et reste stable
    puisque la liste ne fait que s'allonger (un outil saisi est ajouté en fin).

    L'empreinte reste le repli du repli, pour un outil absent de la liste —
    le cas d'un support relevé sur une étape mais jamais inscrit au client. */
export function badgeDerive(nom, outils) {
  const propre = String(nom || '').trim();
  const lettre = (propre.match(/[\p{L}\p{N}]/u) || ['?'])[0].toUpperCase();
  const clef = normaliserOutil(propre);
  const rang = (outils || []).findIndex((o) => normaliserOutil(o) === clef);
  const i = rang >= 0 ? rang : empreinteNom(propre);
  return { fond: PALETTE_OUTILS[i % PALETTE_OUTILS.length], lettre };
}

/** Comparaison de noms d'outils : accents et casse ignorés, comme partout. */
export function normaliserOutil(nom) {
  return String(nom || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

/** Barre verticale pointillée : le même signe que la séparation de phase du diagramme. */
export const ICONE_COUPURE = `<svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor"
  stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M6 1.5v9" stroke-dasharray="2 2"/></svg>`;

/** Deux cartes empilées dans une seule colonne : le signe du partage de colonne. */
export const ICONE_PARTAGE = `<svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor"
  stroke-width="1.2" aria-hidden="true"><rect x="2.5" y="1.6" width="7" height="3.4" rx="1"/><rect x="2.5" y="7" width="7" height="3.4" rx="1"/></svg>`;

/* ---------------------------------------------------------------------------
   Les mots du moteur
   ---------------------------------------------------------------------------

   Le moteur reçoit ses libellés, il ne les possède plus : tant qu'ils étaient
   écrits en dur, aucune bascule de langue ne pouvait être complète, et le
   diagramme est le centre de l'écran.

   `MOTS_FR` est le dictionnaire par défaut : sans `options.mots`, la sortie est
   rigoureusement celle d'avant, mot pour mot — c'est ce qui permet au
   mono-fichier, qui n'en passe aucun, de continuer sans retouche.

   LE DICTIONNAIRE EST DU CODE, JAMAIS UNE DONNÉE. Ses valeurs sont insérées
   dans le balisage SANS échappement (voir plus bas) : un dictionnaire qui
   viendrait de la base, d'un réglage utilisateur ou d'une URL ouvrirait une
   injection HTML. Les traductions se déclarent en dur, à côté de celle-ci.

   Ne sont PAS ici, parce que ce sont des valeurs et non de l'interface :
   `'Transverse'` (valeur par défaut du rôle d'une friction, écrite en base),
   `'manuel'` / `'auto'` (valeurs contraintes de `etapes.lien` — seul leur
   `libelle` d'affichage est traduisible), et `'Nouvelle échelle'` de
   `mutations.js`, qui est écrit dans `etapes.phase` et part donc dans le PDF
   client : c'est du contenu, à trancher à part. */
export const MOTS_FR = {
  titre: "Diagramme de flux — l'existant",
  zoomAjuster: 'Ajuster',
  zoomAjusterTitre: 'Régler le zoom pour tout afficher',
  zoomAria: 'Zoom du diagramme',
  saisieRapide: 'Saisie rapide',
  masquerSaisieRapide: 'Masquer la saisie rapide',
  videTitre: 'Aucune étape pour ce processus',
  videEdition: 'Ajoutez la première étape avec le bouton ci-dessous.',
  videLecture: 'Passez en mode édition et ajoutez la première étape du flux.',
  premiereEtape: '+ Première étape',
  phasePlaceholder: 'nommer cette échelle',
  /** Reçoit le nombre d'étapes du groupe. */
  phaseRenommerTitre: (n) => `Renomme l'échelle de temps des ${n} étape(s) de ce groupe`,
  phaseSupprimerTitre: (n) =>
    `Supprimer cette échelle de temps — ses ${n} étape(s) rejoignent l'échelle voisine`,
  phaseAjouter: '+ Échelle',
  phaseAjouterTitre: 'Ajouter une échelle de temps en fin de frise',
  phaseCouperTitre: 'Commencer une nouvelle échelle de temps à partir de cette étape',
  colonnePartagerTitre: 'Mettre cette étape dans la colonne de la précédente',
  colonneSeparerTitre: 'Redonner une colonne à part à cette étape',
  roleRenommerTitre: 'Renommer le rôle',
  roleMonter: 'Monter la ligne',
  roleDescendre: 'Descendre la ligne',
  roleSupprimer: 'Supprimer le rôle',
  roleAjouter: '+ Rôle',
  poigneeTitre:
    'Glisser sur un autre couloir, ou sur la frontière entre deux couloirs pour dire que les deux sont concernés',
  etapePlaceholder: 'Action relevée…',
  etapeGauche: 'Décaler à gauche',
  etapeDroite: 'Décaler à droite',
  etapeInserer: 'Insérer une étape après',
  etapeSupprimer: "Supprimer l'étape",
  etapeAjouter: '+ Étape',
  etapeAjouterTitre: 'Ajouter une étape sur cette ligne',
  frontiereTitre: 'Déposer ici : les deux rôles sont concernés',
  supportAjouter: '＋ support…',
  supportAutre: 'Autre outil…',
  supportChoisirTitre: "Choisir le support ou l'outil utilisé pour cette étape",
  supportRetirer: (nom) => `Retirer ${nom}`,
  supportSaisirNom: "Nom du support ou de l'outil :",

  legendeAide: '— cliquez une flèche pour changer',
  flecheTitre: (libelle) => `Lien ${libelle} — cliquer pour changer`,
  /* Mots des FLÈCHES MANUELLES. Ils n'apparaissent que sous la commande
     optionnelle `fleches` : le chemin par défaut n'en émet aucun, et reste donc
     identique au mono-fichier au caractère près. */
  flecheTirerTitre: 'Tirer une flèche vers une autre étape',
  flecheRetirerTitre: 'Retirer cette flèche dessinée',
  flecheMasquerTitre: 'Masquer cette flèche calculée',
  flechePassageTitre: 'Faire passer cette flèche par un point — clic pour désigner, clic à nouveau pour revenir au calcul',
  flechePassageNoeudTitre: 'Faire passer la flèche par ici',

  /** Libellés d'affichage des natures de lien. Les CLÉS sont les valeurs en
      base (`etapes.lien`) et ne se traduisent pas. */
  liens: { '': 'non qualifié', auto: 'automatique', manuel: 'manuel' },

  ecartMois: 'mois',
  ecartSemaines: 'sem',
  ecartJours: 'j'
};

/** Dictionnaire anglais. Mêmes clés que `MOTS_FR`, aucune valeur en moins :
    l'hôte le passe tel quel dans `options.mots`.

    Ne sont pas ici, pour les mêmes raisons qu'en français : `'Transverse'`,
    valeur écrite en base ; les CLÉS de `liens` (`''` / `'auto'` / `'manuel'`),
    valeurs contraintes de `etapes.lien` dont seul le libellé se traduit ; et
    `'Nouvelle échelle'` de `mutations.js`, écrit dans `etapes.phase`, donc du
    contenu. */
export const MOTS_EN = {
  titre: 'Process flow — current state',
  zoomAjuster: 'Fit',
  zoomAjusterTitre: 'Set the zoom to show everything',
  zoomAria: 'Diagram zoom',
  saisieRapide: 'Quick entry',
  masquerSaisieRapide: 'Hide quick entry',
  videTitre: 'No steps in this process',
  videEdition: 'Add the first step with the button below.',
  videLecture: 'Switch to edit mode and add the first step of the flow.',
  premiereEtape: '+ First step',
  phasePlaceholder: 'name this time band',
  phaseRenommerTitre: (n) => `Rename the time band of the ${n} step(s) in this group`,
  phaseSupprimerTitre: (n) =>
    `Delete this time band — its ${n} step(s) move to the neighbouring band`,
  phaseAjouter: '+ Time band',
  phaseAjouterTitre: 'Add a time band at the end of the timeline',
  phaseCouperTitre: 'Start a new time band at this step',
  colonnePartagerTitre: 'Move this step into the previous step’s column',
  colonneSeparerTitre: 'Give this step its own column again',
  roleRenommerTitre: 'Rename the role',
  roleMonter: 'Move the lane up',
  roleDescendre: 'Move the lane down',
  roleSupprimer: 'Delete the role',
  roleAjouter: '+ Role',
  poigneeTitre:
    'Drag onto another lane, or onto the boundary between two lanes to show that both are involved',
  etapePlaceholder: 'Observed action…',
  etapeGauche: 'Shift left',
  etapeDroite: 'Shift right',
  etapeInserer: 'Insert a step after',
  etapeSupprimer: 'Delete the step',
  etapeAjouter: '+ Step',
  etapeAjouterTitre: 'Add a step on this lane',
  frontiereTitre: 'Drop here: both roles are involved',
  supportAjouter: '＋ tool…',
  supportAutre: 'Other tool…',
  supportChoisirTitre: 'Choose the medium or tool used for this step',
  supportRetirer: (nom) => `Remove ${nom}`,
  supportSaisirNom: 'Name of the medium or tool:',

  legendeAide: '— click an arrow to change it',
  flecheTitre: (libelle) => `${libelle} link — click to change`,
  flecheTirerTitre: 'Drag an arrow to another step',
  flecheRetirerTitre: 'Remove this drawn arrow',
  flecheMasquerTitre: 'Hide this computed arrow',
  flechePassageTitre: 'Route this arrow through a point — click to pick, click again to go back to the computed route',
  flechePassageNoeudTitre: 'Route the arrow through here',

  liens: { '': 'unqualified', auto: 'automated', manuel: 'manual' },

  ecartMois: 'mo',
  ecartSemaines: 'wk',
  ecartJours: 'd'
};

/** Dictionnaire effectif : le défaut français, complété par ce que l'hôte passe. */
export function mots(fournis) {
  if (!fournis) return MOTS_FR;
  return { ...MOTS_FR, ...fournis, liens: { ...MOTS_FR.liens, ...(fournis.liens || {}) } };
}

/** Libellé d'affichage d'une nature de lien. */
export function libelleLien(nature, m) {
  const d = m || MOTS_FR;
  return d.liens[nature] != null ? d.liens[nature] : d.liens[''];
}


/* ---------------------------------------------------------------------------
   Utilitaires
   ------------------------------------------------------------------------- */

/** Échappement HTML. Nommé en clair : dans l'original il s'appelait `e`, ce qui
    passait pour un compteur de boucle au premier coup d'œil. */
export const echapper = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Découpe la chaîne « Excel, SharePoint » en étiquettes affichables. */
export function listeSupports(brut) {
  return String(brut || '').split(',').map((s) => s.trim()).filter(Boolean);
}

export function badgeSupport(nom, outils) {
  const clef = String(nom || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  /* Les sept familles connues d'abord : elles se reconnaissent d'un coup d'œil,
     c'est tout leur intérêt. Le reste tombe sur une teinte dérivée du nom. */
  const b = BADGES_SUPPORT.find((x) => x.motifs.some((m) => clef.includes(m))) || badgeDerive(nom, outils);
  const dedans = b.glyphe
    ? b.glyphe
    : `<text x="8" y="11.4" text-anchor="middle" fill="#fff"
             font-family="Overpass, sans-serif" font-size="9.5" font-weight="700">${echapper(b.lettre)}</text>`;
  /* PAS DE `<title>` : il produisait l'infobulle NATIVE, lente (≈1 s) et noire.
     Le nom passe en `data-outil` sur une ENVELOPPE — un `<svg>` ne peut pas
     porter de `::after`, d'où le `<span>` — et `.pastille-outil::after` dans
     `moteur.css` dessine l'infobulle de charte. `role="img"` + `aria-label`
     restent la seule annonce au lecteur d'écran, inchangée. */
  const etiquette = echapper(nom);
  return `<span class="pastille-outil" data-outil="${etiquette}"><svg class="badge-support" viewBox="0 0 16 16" width="16" height="16" role="img" aria-label="${etiquette}">
    <rect width="16" height="16" rx="3.6" fill="${b.fond}"/>${dedans}</svg></span>`;
}


/** Supports de l'étape, en rangée à cheval sur la bordure haute de la carte.

    PAS DE `title` SUR LE CONTENEUR : une infobulle d'ancêtre couvre toute la
    rangée, y compris les pastilles, et le navigateur retient alors la sienne au
    lieu du `<title>` de chaque `<svg>` — on lisait « Excel · SharePoint » (ou
    rien) au lieu du nom survolé. Une seule source d'infobulle : la pastille.
    Le compteur « +N », lui, n'est pas une pastille : il garde la liste des noms
    cachés, seule information qu'il puisse porter. */
export function bandeauSupports(liste, outils) {
  if (!liste.length) return '';
  const montrees = liste.slice(0, 4);
  const caches = liste.slice(4);
  return `<span class="supports-bordure">
    ${montrees.map((sup) => badgeSupport(sup, outils)).join('')}
    ${caches.length ? `<span class="supports-bordure__reste" title="${echapper(caches.join(' · '))}">+${caches.length}</span>` : ''}
  </span>`;
}

/** Jalon « J-7 », « J1 », « S+2 », « M+3 » → décalage en jours, ou null. */
export function jalonEnJours(libelle) {
  const m = String(libelle || '').trim().match(/^([JSM])\s*([+-]?\d+)?$/i);
  if (!m) return null;
  const n = m[2] ? Number(m[2]) : 0;
  const unite = m[1].toUpperCase();
  return unite === 'J' ? n : unite === 'S' ? n * 7 : n * 30;
}

/** Écart entre deux jalons, dans l'unité la plus lisible. */
export function ecartLisible(depuis, vers, m) {
  const d = m || MOTS_FR;
  if (depuis == null || vers == null) return '';
  const j = vers - depuis;
  if (j === 0) return '';
  const signe = j > 0 ? '+' : '−';
  const a = Math.abs(j);
  if (a % 30 === 0) return `${signe}${a / 30} ${d.ecartMois}`;
  if (a % 7 === 0) return `${signe}${a / 7} ${d.ecartSemaines}`;
  return `${signe}${a} ${d.ecartJours}`;
}


/** Couloirs affichés : les rôles du processus, dédoublonnés, avec leur index réel. */
export function rolesCouloirs(roles) {
  const out = [];
  (roles || []).forEach((r, i) => { if (roles.indexOf(r) === i) out.push({ nom: r, iRole: i }); });
  return out;
}

/** Couleur d'un rôle.

    `paletteRoles` est la liste des rôles de TOUT le client, dans l'ordre — pas
    celle du seul processus affiché. C'est l'index dans cette liste qui fixe la
    teinte : un même rôle garde ainsi la même couleur d'un onglet à l'autre.
    Passer les rôles du processus ferait glisser les couleurs entre processus,
    et un lecteur croirait à deux rôles différents. */
export function couleursRole(role, paletteRoles) {
  if (role === 'Transverse') return ['#EFEFEF', '#2B2B2B'];
  const i = Math.max(0, (paletteRoles || []).indexOf(role));
  return PASTELS[i % PASTELS.length];
}

export function chipRole(role, paletteRoles, variante) {
  const [fond, encre] = couleursRole(role, paletteRoles);
  const suffixe = variante ? ` chip--${variante}` : '';
  return `<span class="chip${suffixe}" style="--chip-fond:${fond};--chip-encre:${encre}">${echapper(role)}</span>`;
}

/* ---------------------------------------------------------------------------
   Géométrie
   ------------------------------------------------------------------------- */

/** Emprise de chaque étape : sa ligne, et de quel côté elle chevauche.

    Une étape partagée reste dans le couloir de son rôle principal et garde sa
    taille ; elle est simplement décalée pour se centrer sur la frontière avec
    le couloir du second rôle. `cheval` vaut +1 (vers le bas) ou −1 (vers le
    haut), 0 si l'étape ne concerne qu'un rôle. */
export function empriseDesEtapes(etapes, couloirs) {
  const rangDe = (nom) => {
    const i = couloirs.findIndex((r) => r.nom === nom);
    return i < 0 ? 0 : i;
  };
  return etapes.map((et) => {
    const a = rangDe(et.role);
    if (!et.role2 || et.role2 === et.role) return { ligne: a, cheval: 0 };
    return { ligne: a, cheval: rangDe(et.role2) > a ? 1 : -1 };
  });
}

/** Colonnes du diagramme, déduites d'un booléen RELATIF porté par l'étape.

    `colonne_partagee` dit « j'occupe la colonne de la précédente ». Aucun numéro
    de colonne n'est stocké : la déduction se refait à chaque rendu, donc rien
    n'est à renuméroter quand on insère, supprime ou réordonne. C'est exactement
    le motif de `groupesDePhase`, qui regroupe déjà par suites consécutives.

    LA PREMIÈRE ÉTAPE NE PEUT PAS PARTAGER : elle n'a pas de précédente, sa
    valeur est ignorée quoi qu'elle porte.

    Rend, pour chaque colonne, les INDEX D'ÉTAPES qu'elle contient — dans
    l'ordre du tableau, qui reste la seule vérité de position. */
export function colonnesDesEtapes(etapes) {
  const colonnes = [];
  (etapes || []).forEach((et, i) => {
    if (i > 0 && et && et.colonne_partagee) colonnes[colonnes.length - 1].indices.push(i);
    else colonnes.push({ indices: [i] });
  });
  return colonnes;
}

/** Index de colonne de chaque étape. Sert au refus « même colonne » côté hôte
    et à savoir si une flèche revient en arrière. */
export function colonneParEtape(etapes) {
  const m = new Map();
  colonnesDesEtapes(etapes).forEach((col, k) => col.indices.forEach((j) => m.set(j, k)));
  return m;
}

/**
 * LES FLÈCHES : LE CALCUL RESTE LE CALCUL, ON N'ENREGISTRE QUE LES ÉCARTS.
 *
 * Le tracé implicite — chaque étape d'une colonne vers chaque étape de la
 * suivante — reste la règle. `ecarts` (la table `fleches`) ne porte que ce qui
 * s'en écarte :
 *   - `masquee: false` → une flèche AJOUTÉE à la main, qui n'existerait pas ;
 *   - `masquee: true`  → une flèche IMPLICITE MASQUÉE, qui existerait sans elle.
 *
 * D'où la propriété qu'on tient : AUCUN ÉCART ⇒ exactement les paires d'avant,
 * dans le même ordre. Ne remplace pas ce modèle par « tout devient explicite au
 * premier dessin » : la première flèche manuelle effacerait le diagramme.
 *
 * @param {object[]} etapes    étapes du processus, dans l'ordre
 * @param {object[]} [ecarts]  lignes de `fleches` : { id, de_id, vers_id, nature, masquee }
 * @returns {object[]} { de, vers, id, nature, manuelle, retour } — index d'étapes
 */
export function flechesEffectives(etapes, ecarts) {
  const liste = etapes || [];
  const colonnes = colonnesDesEtapes(liste);
  const colonne = colonneParEtape(liste);

  const indexParId = new Map();
  liste.forEach((et, j) => { if (et && et.id != null) indexParId.set(String(et.id), j); });

  const masquees = new Set();
  const ajoutees = [];
  (ecarts || []).forEach((f) => {
    const ja = indexParId.get(String(f.de_id));
    const jb = indexParId.get(String(f.vers_id));
    /* Un écart dont une extrémité n'est pas affichée est simplement ignoré :
       la table le garde, le tracé n'en tient pas compte. */
    if (ja == null || jb == null) return;
    if (f.masquee) { masquees.add(ja + '>' + jb); return; }
    ajoutees.push({
      de: ja, vers: jb, id: f.id, nature: f.nature || '', manuelle: true,
      /* LE RÉGLAGE À LA MAIN EST STRUCTUREL : un point de passage en coordonnées
         de GRILLE — « passe par cette bande, à cette colonne » — et non un
         décalage en pixels. Un nombre de pixels ne veut plus rien dire dès qu'une
         carte grandit d'une ligne ou qu'une colonne apparaît ; une bande, si.
         `null` (les deux colonnes absentes) = tracé calculé, état par défaut. */
      passage: f.passage_bande == null || f.passage_colonne == null
        ? null
        : { bande: Number(f.passage_bande), colonne: Number(f.passage_colonne) },
    });

  });
  const dessinees = new Set(ajoutees.map((f) => f.de + '>' + f.vers));

  const sortie = [];
  for (let k = 0; k < colonnes.length - 1; k++) {
    for (const ja of colonnes[k].indices) {
      for (const jb of colonnes[k + 1].indices) {
        const clef = ja + '>' + jb;
        if (masquees.has(clef) || dessinees.has(clef)) continue;
        /* NATURE D'UNE FLÈCHE IMPLICITE : celle de l'étape qui REÇOIT. Toutes
           les implicites qui arrivent sur une même carte partagent donc la
           même — correct pour un calcul. Voir juste dessous : une flèche
           MANUELLE porte la sienne. N'unifie pas les deux lectures, on
           repeindrait des flèches que personne n'a touchées. */
        sortie.push({
          de: ja, vers: jb, id: null,
          nature: (liste[jb] && liste[jb].lien) || '',
          manuelle: false, retour: false,
        });
      }
    }
  }
  for (const f of ajoutees) {
    /* NATURE D'UNE FLÈCHE MANUELLE : la sienne, portée par la ligne en base.
       Elle vient peut-être d'ailleurs que de la colonne précédente : lire le
       lien de l'étape reçue la peindrait comme une voisine qu'elle n'est pas. */
    const ka = colonne.get(f.de);
    const kb = colonne.get(f.vers);
    sortie.push({ ...f, retour: !(ka < kb) });
  }
  return sortie;
}

/**
 * ATTRIBUTION DE VOIES — un seul mécanisme, employé sur DEUX axes.
 *
 * Le problème est le même dans les deux cas : plusieurs tracés se disputent un
 * même espace libre, et il faut leur donner des positions distinctes.
 *   - verticalement, dans la gouttière entre deux colonnes : chaque flèche y
 *     reçoit son ABSCISSE ;
 *   - horizontalement, dans le couloir sous les bandes : chaque flèche longue
 *     ou de retour y reçoit sa PROFONDEUR.
 *
 * D'où le choix de rendre des DÉCALAGES et non des coordonnées : l'appelant
 * ajoute le décalage à sa propre référence, et le mécanisme ignore l'axe.
 *
 * DEUX PROPRIÉTÉS À NE PAS PERDRE :
 *   1. `n <= 1` rend `[0]`. Une flèche seule garde donc EXACTEMENT le tracé
 *      d'avant, au caractère près — c'est la règle « le routage ne s'active que
 *      sur conflit », et c'est elle que vérifient la comparaison au mono-fichier
 *      et la géométrie en navigateur sur les diagrammes linéaires.
 *   2. Si la place manque, on rend des zéros — donc le tracé d'avant, avec son
 *      chevauchement. Un chevauchement lisible vaut mieux qu'un peigne à deux
 *      pixels d'écart, et surtout mieux qu'un tracé qui coupe une carte.
 *
 * @param {number} n         nombre de tracés à placer
 * @param {number} place     largeur utile de la bande, en pixels
 * @param {object} [opts]    { ecartMin, pas, centre }
 * @returns {number[]} n décalages, en pixels
 */
export function voies(n, place, opts = {}) {
  if (!(n > 1)) return [0];
  const ecartMin = opts.ecartMin == null ? 8 : opts.ecartMin;
  const pasVoulu = opts.pas == null ? 16 : opts.pas;
  const centre = opts.centre !== false;
  /* Centré : n voies tiennent dans la bande, donc n intervalles.
     Non centré (le couloir, qui ne va que vers le bas) : n-1 intervalles. */
  const pas = Math.floor(Math.min(pasVoulu, place / (centre ? n : n - 1)));
  if (!(pas >= ecartMin)) return new Array(n).fill(0);
  return Array.from({ length: n }, (_, i) => (centre ? i - (n - 1) / 2 : i) * pas);
}

/** Groupes de phase consécutifs : un bandeau de frise par groupe.

    LE REGROUPEMENT SE FAIT PAR COLONNE, pas par étape : un bandeau s'étend sur
    des colonnes de grille. Mais il RENVOIE AUSSI la plage d'étapes
    correspondante (`debutEtape`, `spanEtapes`), et c'est elle que le balisage
    émet dans `data-champ="phase.debut.span"`, `data-i` et `data-span` — sans
    quoi renommer une phase écrirait sur les mauvaises étapes dès qu'une colonne
    en porte deux, sans aucune erreur visible. La conversion colonne → plage
    d'étapes se fait donc ICI, une seule fois.

    La phase d'une colonne est celle de sa PREMIÈRE étape : deux étapes
    simultanées appartiennent au même moment, donc à la même échelle de temps.

    `colonnes` absent : une colonne par étape, et la sortie est celle d'avant. */
export function groupesDePhase(etapes, colonnes) {
  const cols = colonnes || colonnesDesEtapes(etapes);
  const groupes = [];
  cols.forEach((col, k) => {
    const lab = (etapes[col.indices[0]] && etapes[col.indices[0]].phase) || '';
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.label === lab) {
      dernier.span += 1;
      dernier.spanEtapes += col.indices.length;
    } else {
      groupes.push({
        label: lab,
        span: 1,
        debut: k,
        debutEtape: col.indices[0],
        spanEtapes: col.indices.length,
      });
    }
  });
  return groupes;
}

/** `n` est le nombre de COLONNES, qui n'est plus le nombre d'étapes. */
export function gabaritColonnes(n, edition) {
  return `var(--couloir) repeat(${n}, fit-content(var(--colonne-max)))${edition ? ' 150px' : ''}`;
}

/* ---------------------------------------------------------------------------
   Balisage
   ------------------------------------------------------------------------- */

/* Les libellés du dictionnaire sont insérés SANS `echapper` : ils remplacent
   des littéraux qui n'étaient pas échappés non plus, et échapper « l'outil »
   produirait `&#39;` — même rendu, mais sortie différente au caractère près,
   ce que la comparaison stricte au mono-fichier est là pour attraper. Les
   valeurs venant des données, elles, sont échappées AVANT d'entrer dans le
   libellé.

   Corollaire, écrit plus haut et répété ici parce qu'il se perd : LE
   DICTIONNAIRE EST DU CODE. Le jour où il viendrait d'ailleurs, ces
   interpolations deviendraient une injection. */

/** Badges retirables, à cheval sur la bordure haute de la carte. */
function bandeauSupportsEdition(j, supports, t, outils) {
  if (!supports.length) return '';
  return `<span class="supports-bordure supports-bordure--edition">
    ${supports.map((sup, k) => `
      <span class="support-modif">
        ${badgeSupport(sup, outils)}
        <button type="button" class="bouton--retirer" data-action="supprimer-support" data-i="${j}" data-s="${k}"
                title="${t.supportRetirer(echapper(sup))}">×</button>
      </span>`).join('')}
  </span>`;
}

/** Liste déroulante d'ajout, alimentée par les outils déjà relevés sur le site. */
function vueChoixSupport(j, supports, outils, t) {
  const dispo = (outils || []).filter((o) => o && !supports.includes(o));
  const options = [`<option value="">${t.supportAjouter}</option>`]
    .concat(dispo.map((o) => `<option value="${echapper(o)}">${echapper(o)}</option>`))
    .concat([`<option value="__autre__">${t.supportAutre}</option>`]);
  return `<select class="carte__support-choix" data-champ="support-ajout.${j}"
                  title="${t.supportChoisirTitre}">${options.join('')}</select>`;
}



/**
 * Produit le balisage complet du diagramme.
 *
 * @param {object} arg
 * @param {object} arg.processus            { id, roles }
 * @param {object[]} arg.etapes             étapes ordonnées : { ordre, role, role2, texte, phase, supports, lien }
 * @param {object} [arg.options]
 * @param {string[]} [arg.options.paletteRoles]  rôles de tout le client, pour la stabilité des couleurs
 * @param {string[]} [arg.options.outils]        outils du site, pour le sélecteur de support
 * @param {boolean}  [arg.options.edition]       contrôles d'édition
 * @param {boolean}  [arg.options.impression]    zoom figé à 1, aucun contrôle
 * @param {number}   [arg.options.zoom]          zoom écran (0.4 → 1)
 * @param {number}   [arg.options.etapeActive]   `ordre` de l'étape mise en avant
 * @param {boolean}  [arg.options.tableauVisible] état du bouton « Saisie rapide »
 * @param {boolean}  [arg.options.entete]        false pour laisser l'hôte fournir en-tête et pied
 * @param {object}   [arg.options.mots]          libellés d'interface ; défaut `MOTS_FR`
 * @returns {string} HTML
 */
export function baliserFlux({ processus: p, etapes, options = {} }) {
  const ed = Boolean(options.edition) && !options.impression;
  const avecEntete = options.entete !== false;
  /* Le moteur ne possède plus ses mots : sans `options.mots`, il retombe sur
     `MOTS_FR` et sa sortie est celle d'avant, mot pour mot. */
  const t = mots(options.mots);

  /* Deux zooms, et non un seul : le curseur montre le réglage d'écran, le
     diagramme applique 1 à l'impression, où il est mis à l'échelle autrement.
     L'original faisait déjà cette distinction — sans qu'elle se voie, puisque
     le curseur porte `ne-pas-imprimer`. La conserver garde l'équivalence
     stricte ; l'unifier « proprement » aurait fait mentir le curseur sur ce que
     l'utilisateur a réglé dès qu'il rouvre le panneau après une impression. */
  /* Commandes émises. Absent : tout est émis, et la sortie reste identique à
     l'original. Présent : seules les clés à `true` le sont — un bouton qui
     n'est pas traité par l'hôte ne doit pas apparaître, un contrôle inerte
     étant pire que son absence. */
  const cmd = (nom) => !options.commandes || options.commandes[nom] === true;

  /* Commande NOUVELLE, donc à opt-in STRICT : absente de `options.commandes`,
     elle ne rend rien. Sans ça, le chemin par défaut — celui que la comparaison
     caractère par caractère avec le mono-fichier emprunte — gagnerait un bouton
     et cesserait d'être identique à l'original. */
  const cmdOptionnelle = (nom) => Boolean(options.commandes && options.commandes[nom] === true);

  const zoomAffiche = options.zoom == null ? 1 : options.zoom;
  const zoomApplique = options.impression ? 1 : zoomAffiche;
  const palette = options.paletteRoles || p.roles || [];
  const n = etapes.length;

  const zoom = `
    <div class="flux__zoom ne-pas-imprimer">
      <button type="button" class="bouton bouton--mini" data-action="zoom-ajuster" title="${t.zoomAjusterTitre}">${t.zoomAjuster}</button>
      <input type="range" min="40" max="100" step="5" value="${Math.round(zoomAffiche * 100)}"
             data-champ="zoom" aria-label="${t.zoomAria}">
      <span class="flux__zoom-valeur">${Math.round(zoomAffiche * 100)} %</span>
    </div>`;

  const entete = `
    <div class="flux__entete">
      <span class="libelle libelle--large">${t.titre}</span>
      <div class="rangee" style="gap:14px">
        ${n ? zoom : ''}
        ${ed && cmd('tableau') ? `<button type="button" class="bouton bouton--mini ne-pas-imprimer" data-action="basculer-tableau">${
          options.tableauVisible ? t.masquerSaisieRapide : t.saisieRapide}</button>` : ''}
      </div>
    </div>`;

  if (!n) {
    return `
    <div class="carte carte--flux">
      ${avecEntete ? entete : ''}
      <div class="vide">
        <span class="vide__titre">${t.videTitre}</span>
        <span class="sourdine">${ed
          ? t.videEdition
          : t.videLecture}</span>
        ${ed && cmd('etapes') ? `<button type="button" class="bouton bouton--mini" data-action="ajouter-etape">${t.premiereEtape}</button>` : ''}
      </div>
    </div>`;
  }


  const couloirs = rolesCouloirs(p.roles);
  const R = couloirs.length;
  const emprise = empriseDesEtapes(etapes, couloirs);

  /* --- colonnes : plusieurs étapes peuvent occuper la même --- */
  const colonnes = colonnesDesEtapes(etapes);
  const nc = colonnes.length;

  /* --- frise temporelle : un bandeau par groupe de phase --- */
  const groupes = groupesDePhase(etapes, colonnes);
  /* Traits de séparation : des index de COLONNE. */
  const coupures = groupes.slice(1).map((g) => g.debut);
  /* Écart déduit du libellé lui-même s'il est codé (J-7, J1, S+2, M+3). */
  const jours = groupes.map((g) => jalonEnJours(g.label));

  const frise = groupes.map((g, i) => {
    const ecart = i > 0 ? ecartLisible(jours[i - 1], jours[i], t) : '';
    /* `data-champ`, `data-i` et `data-span` restent des INDEX D'ÉTAPES : c'est
       une plage d'étapes que l'hôte renomme. Le bandeau, lui, s'étend sur des
       colonnes. Mélanger les deux poserait les libellés de phase à côté dès
       qu'une colonne porte deux étapes, sans aucune erreur. */
    const corps = ed && cmd('phases')
      ? `<div class="flux__phase-edition">
           <input class="flux__phase-champ" value="${echapper(g.label)}" data-champ="phase.${g.debutEtape}.${g.spanEtapes}"
                  placeholder="${t.phasePlaceholder}" title="${t.phaseRenommerTitre(g.spanEtapes)}">
           <button type="button" class="bouton--puce bouton--puce-claire" data-action="supprimer-phase"
                   data-i="${g.debutEtape}" data-span="${g.spanEtapes}" data-role="supprimer"
                   title="${t.phaseSupprimerTitre(g.spanEtapes)}">×</button>
         </div>`
      : `<span class="flux__phase-libelle">${echapper(g.label)}</span>`;
    return `
      <div class="flux__phase${g.label || ed ? '' : ' flux__phase--vide'}${i > 0 ? ' flux__phase--coupe' : ''}"
           style="grid-row:1;grid-column:${2 + g.debut} / span ${g.span}">
        ${ecart ? `<span class="flux__ecart">${echapper(ecart)}</span>` : ''}
        ${corps}
      </div>`;
  }).join('');


  /* --- fonds de couloir, tirés sur toute la largeur --- */
  const bandes = couloirs.map((r, i) => `
    <div class="flux__bande${i % 2 ? ' flux__bande--paire' : ''}" style="grid-row:${2 + i};grid-column:1 / -1"></div>`).join('');

  /* --- étiquettes de rôle --- */
  const etiquettes = couloirs.map(({ nom: role, iRole }, i) => {
    const [fond, encre] = couleursRole(role, palette);
    const fondBande = i % 2 ? 'var(--blanc-casse)' : 'var(--blanc)';
    const corps = ed && cmd('roles')
      ? `<input class="flux__role-champ" value="${echapper(role)}" data-champ="role.${iRole}" title="${t.roleRenommerTitre}"
                style="--chip-fond:${fond};--chip-encre:${encre}">
         <div class="flux__role-outils">
           <button type="button" class="bouton--puce" data-action="monter-role" data-i="${iRole}" ${iRole === 0 ? 'disabled' : ''} title="${t.roleMonter}">↑</button>
           <button type="button" class="bouton--puce" data-action="descendre-role" data-i="${iRole}" ${iRole === p.roles.length - 1 ? 'disabled' : ''} title="${t.roleDescendre}">↓</button>
           <button type="button" class="bouton--puce" data-action="supprimer-role" data-role="supprimer" data-i="${iRole}" title="${t.roleSupprimer}">×</button>
         </div>`

      : chipRole(role, palette);
    return `
      <div class="flux__etiquette${ed ? ' flux__etiquette--edition' : ''}"
           style="grid-row:${2 + i};grid-column:1;background:${fondBande}">${corps}</div>`;
  }).join('');

  /* --- cellules et cartes ---

     UNE CELLULE = (couloir, colonne), et elle contient ZÉRO, UNE OU PLUSIEURS
     cartes : deux étapes du même couloir dans la même colonne s'y empilent.

     `data-cellule` et `data-frontiere` restent des INDEX D'ÉTAPES — celui de la
     PREMIÈRE étape de la colonne visée. C'est ce que `deposerEtape` attend :
     une position d'insertion dans le tableau, pas un numéro de colonne.
     `data-index`, `data-poignee` et tous les `data-i` des boutons de carte
     restent l'index de LEUR étape. */
  const cellules = [];
  couloirs.forEach((r, i) => {
    for (let k = 0; k < nc; k++) {
      const dansColonne = colonnes[k].indices;
      /* Position d'insertion associée à la colonne : sa première étape. */
      const ancre = dansColonne[0];
      const coupe = coupures.includes(k) ? ' flux__cellule--coupe' : '';
      const pos = `grid-row:${2 + i};grid-column:${2 + k}`;
      const ici = dansColonne.filter((j) => emprise[j].ligne === i);

      if (ici.length) {
        const cible = ed ? ` data-cellule="${ancre}" data-role-nom="${echapper(r.nom)}"` : '';
        const cellCheval = ici.some((j) => emprise[j].cheval) ? ' flux__cellule--cheval' : '';
        const empilee = ici.length > 1 ? ' flux__cellule--empilee' : '';

        const cartes = ici.map((j) => {
          const et = etapes[j];
          const em = emprise[j];
          const supports = listeSupports(et.supports);
          const partage = em.cheval ? ' flux__carte--cheval' : '';
          const marqueCheval = em.cheval ? ` data-cheval="${em.cheval}"` : '';

          if (!ed) {
            return `
              <div class="flux__carte${partage}" data-etape="${et.ordre}"${marqueCheval}>
                ${bandeauSupports(supports, options.outils)}
                <span class="flux__carte-texte">${echapper(et.texte)}</span>
              </div>`;
          }
          return `
              <div class="flux__carte flux__carte--edition${partage}${options.etapeActive === et.ordre ? ' flux__carte--actif' : ''}"
                   data-etape="${et.ordre}" data-index="${j}"${marqueCheval}>
                ${cmd('supports') ? bandeauSupportsEdition(j, supports, t, options.outils) : bandeauSupports(supports, options.outils)}
                <div class="carte__tete">
                  ${cmd('deplacement') ? `<span class="carte__poignee" draggable="true" data-poignee="${j}"
                        title="${t.poigneeTitre}">⠿</span>` : ''}${cmdOptionnelle('fleches') ? `
                  <span class="carte__tirage" data-tirage="${j}" title="${t.flecheTirerTitre}">→</span>` : ''}
                </div>
                <textarea class="carte__texte" rows="1" data-champ="etape.${j}.texte"
                          placeholder="${t.etapePlaceholder}">${echapper(et.texte || '')}</textarea>
                ${cmd('supports') ? vueChoixSupport(j, supports, options.outils, t) : ''}
                <div class="carte__outils">
                  ${cmd('etapes') ? `<button type="button" class="bouton--puce" data-action="gauche-etape" data-i="${j}" ${j === 0 ? 'disabled' : ''} title="${t.etapeGauche}">←</button>
                  <button type="button" class="bouton--puce" data-action="droite-etape" data-i="${j}" ${j === n - 1 ? 'disabled' : ''} title="${t.etapeDroite}">→</button>
                  <button type="button" class="bouton--puce" data-action="inserer-etape" data-i="${j}" title="${t.etapeInserer}">+</button>
                  ` : ''}${cmd('phases') ? `<button type="button" class="bouton--puce" data-action="couper-phase" data-i="${j}"
                          title="${t.phaseCouperTitre}">${ICONE_COUPURE}</button>` : ''}${cmdOptionnelle('colonnes') ? `
                  <button type="button" class="bouton--puce${et.colonne_partagee ? ' bouton--puce-tenu' : ''}" data-action="partager-colonne" data-i="${j}" ${j === 0 ? 'disabled' : ''}
                          title="${et.colonne_partagee ? t.colonneSeparerTitre : t.colonnePartagerTitre}">${ICONE_PARTAGE}</button>` : ''}${cmd('etapes') ? `
                  <button type="button" class="bouton--puce" data-action="supprimer-etape" data-role="supprimer" data-i="${j}" title="${t.etapeSupprimer}">×</button>` : ''}
                </div>
              </div>`;
        }).join('');

        cellules.push(`
            <div class="flux__cellule${coupe}${cellCheval}${empilee}" style="${pos}"${cible}>${cartes}
            </div>`);
      } else {
        cellules.push(`<div class="flux__cellule${coupe}" style="${pos}"${
          ed ? ` data-cellule="${ancre}" data-role-nom="${echapper(r.nom)}"` : ''}></div>`);
      }

      /* Bande de dépôt sur la frontière avec le couloir suivant. */
      if (ed && cmd('deplacement') && i < R - 1) {
        cellules.push(`<div class="flux__frontiere" style="grid-row:${2 + i};grid-column:${2 + k}"
          data-frontiere="${ancre}" data-role-haut="${echapper(r.nom)}" data-role-bas="${echapper(couloirs[i + 1].nom)}"
          title="${t.frontiereTitre}"></div>`);
      }
    }

    /* colonne d'ajout en fin de couloir */
    if (ed && cmd('etapes')) {
      cellules.push(`
        <div class="flux__cellule" style="grid-row:${2 + i};grid-column:${2 + nc}" data-cellule="${n}" data-role-nom="${echapper(r.nom)}">
          <button type="button" class="flux__ajout" data-action="ajouter-etape-role" data-role-nom="${echapper(r.nom)}"
                  title="${t.etapeAjouterTitre}">${t.etapeAjouter}</button>
        </div>`);
    }

  });

  const legende = `
    <div class="flux__legende">
      ${['auto', 'manuel', ''].map((k) => `
        <span class="flux__legende-item">
          <span class="flux__legende-trait" style="border-top-color:${LIENS[k].couleur};border-top-style:${LIENS[k].tirets ? 'dashed' : 'solid'}"></span>
          ${libelleLien(k, t)}
        </span>`).join('')}
      ${ed ? `<span class="sourdine" style="font-size:13px">${t.legendeAide}</span>` : ''}
    </div>`;


  /* Sans saut de ligne d'ouverture, contrairement à `entete` : l'appel est déjà
     indenté dans le gabarit final. En ajouter un ici insérerait une ligne vide
     que l'original n'a pas, et la comparaison stricte au balisage d'origine
     échouerait — c'est exactement ce qu'elle est là pour attraper. */
  const pied = `<div class="flux__pied">
      ${legende}
      ${ed && cmd('roles') ? `<button type="button" class="bouton bouton--mini pousse-droite" data-action="ajouter-role">${t.roleAjouter}</button>` : ''}
    </div>`;

  /* Le corps seul, sans enveloppe : l'hôte React possède la carte et fournit
     son propre en-tête, sinon les deux se dupliqueraient. Le chemin par défaut
     reste rigoureusement identique à l'original, indentation comprise — c'est
     ce que vérifie la comparaison stricte. */
  const corps = `<div class="flux-defile">
      <div class="flux${ed ? ' flux--edition' : ''}" data-proc="${echapper(p.id)}"
           style="grid-template-columns:${gabaritColonnes(nc, ed)};zoom:${zoomApplique}">
        <svg class="flux-svg" xmlns="http://www.w3.org/2000/svg"></svg>
        <svg class="flux-svg flux-svg--cibles" xmlns="http://www.w3.org/2000/svg"></svg>
        <div style="grid-row:1;grid-column:1"></div>
        ${bandes}
        ${frise}
        ${ed && cmd('phases') ? `<button type="button" class="flux__phase-ajout" data-action="ajouter-phase"
                        style="grid-row:1;grid-column:${2 + nc}"
                        title="${t.phaseAjouterTitre}">${t.phaseAjouter}</button>` : ''}
        ${etiquettes}
        ${cellules.join('')}
      </div>
    </div>`;

  if (options.enveloppe === false) return corps;

  return `
  <div class="carte carte--flux">
    ${avecEntete ? entete : ''}
    ${corps}
    ${avecEntete ? pied : ''}
  </div>`;
}

/* ---------------------------------------------------------------------------
   Après la mise en page — ces trois fonctions ont besoin du DOM
   ------------------------------------------------------------------------- */

/** Hauteur maximale d'une zone de saisie d'étape, en pixels.

    Une carte qui grandit sans limite déforme la grille, et le tracé des flèches
    mesure les cartes : au-delà, la zone défile au lieu de pousser. 160 px ≈ 7
    lignes à 15/1.4 — assez pour voir ce qu'on écrit, trop peu pour bousculer la
    géométrie du diagramme. */
export const HAUTEUR_MAX_TEXTE = 160;

/** Met chaque zone de saisie à la hauteur de son contenu, dans la limite.
    Appelée après rendu ET à chaque frappe par l'hôte : sinon on écrit à
    l'aveugle dans un `rows="1"`. */
export function ajusterZonesDeTexte(zone) {
  if (!zone) return;
  zone.querySelectorAll('.carte__texte').forEach((z) => {
    z.style.height = 'auto';
    const voulue = z.scrollHeight;
    z.style.height = Math.min(voulue, HAUTEUR_MAX_TEXTE) + 'px';
    z.style.overflowY = voulue > HAUTEUR_MAX_TEXTE ? 'auto' : 'hidden';
  });
}


/** Centre les cartes « à cheval » sur la frontière entre leurs deux couloirs.
    Le décalage est mémorisé sur la carte pour que les flèches le suivent :
    `offsetTop` ignore les `transform`, le tracé ne le verrait pas autrement. */
export function placerCartesACheval(zone) {
  if (!zone) return;
  zone.querySelectorAll('[data-cheval]').forEach((carte) => {
    const sens = Number(carte.dataset.cheval);
    const cellule = carte.parentElement;
    /* Le décalage est calculé DEPUIS LA POSITION DÉJÀ OCCUPÉE par la carte dans
       sa cellule (`offsetTop`), pas depuis le haut de la cellule. Dans une
       cellule empilée, une carte à cheval est déjà poussée vers le bas par ses
       voisines : partir du haut de la cellule cumulerait les deux décalages et
       la carte sortirait du diagramme. Pour une cellule à une seule carte,
       `offsetTop` vaut le padding et le résultat est celui d'avant, au pixel. */
    const h = carte.offsetHeight;
    const vise = sens > 0 ? cellule.offsetHeight - h / 2 : -h / 2;
    const decal = vise - carte.offsetTop;
    carte.style.transform = `translateY(${decal}px)`;
    carte.dataset.decalage = String(decal);
  });
}

/**
 * Trace les flèches d'un diagramme, une fois la grille posée.
 *
 * Les positions sont lues en `offsetLeft`/`offsetTop` et non en
 * `getBoundingClientRect` : ce sont des coordonnées de mise en page, dans le
 * même repère que le SVG. Le tracé reste donc juste quand le diagramme est
 * dézoomé par `zoom` CSS — ce qui est le cas à l'écran comme à l'impression.
 *
 * @param {Element} zone      le `.flux`
 * @param {object[]} etapes   les étapes du processus, dans l'ordre
 * @param {object} [options]  { edition } pour les zones de clic
 */
export function tracerFleches(zone, etapes, options = {}) {
  const t = mots(options.mots);
  const svg = zone && zone.querySelector('.flux-svg');
  if (!zone || !svg) return;


  const cibles = zone.querySelector('.flux-svg--cibles');
  const liste = etapes || [];
  const cartes = Array.from(zone.querySelectorAll('[data-etape]'))
    .sort((a, b) => Number(a.dataset.etape) - Number(b.dataset.etape));
  const chemins = [];
  const zonesClic = [];

  /* Cumule les offsets jusqu'au diagramme : on ne dépend ainsi d'aucun
     choix de positionnement CSS dans les niveaux intermédiaires. */
  const boite = (el) => {
    let x = 0, y = 0, cur = el;
    while (cur && cur !== zone) { x += cur.offsetLeft; y += cur.offsetTop; cur = cur.offsetParent; }
    /* offsetTop ignore les transform : on rajoute le décalage des cartes à cheval. */
    y += Number(el.dataset.decalage || 0);
    return { x, y, l: el.offsetWidth, h: el.offsetHeight };
  };

  /* Retrouver la carte d'une étape par son `ordre`, et non par sa position dans
     le document : une colonne partagée casse la correspondance index ↔ carte. */
  const parOrdre = new Map();
  cartes.forEach((c) => parOrdre.set(String(c.dataset.etape), c));
  const carteDe = (j) => parOrdre.get(String(liste[j] && liste[j].ordre)) || cartes[j];

  /* Tout ce qui est dans la colonne k précède tout ce qui est dans la colonne
     k+1 : on trace donc CHAQUE carte de k vers CHAQUE carte de k+1. Deux fois
     deux font quatre flèches, et c'est la sémantique voulue pour les flèches
     implicites. Le tracé ne traverse aucune carte : il quitte le bord droit de
     la carte de départ, ne monte ou descend que dans la gouttière entre les
     deux colonnes, puis entre par le bord gauche de l'arrivée.
     `flechesEffectives` rend ces paires, plus les écarts enregistrés : sans
     écart, la liste et son ordre sont ceux d'avant. */
  const fleches = flechesEffectives(liste, options.fleches);
  /* Poignées de retrait : commande OPTIONNELLE, opt-in strict. Sans elle, rien
     de neuf n'est émis et `cibles.innerHTML` reste caractère pour caractère
     celui du mono-fichier. */
  const retraits = Boolean(
    options.edition && options.commandes && options.commandes.fleches === true,
  );
  const puces = [];

  /* ---- LE ROUTAGE ----------------------------------------------------------

     Deux problèmes, un seul mécanisme (`voies`), appelé sur deux axes.

     1. Plusieurs flèches dans une même gouttière tournaient TOUTES à
        `x1 + dx/2` : les cartes d'une colonne ont la même emprise horizontale,
        donc sur un croisement 2×2 les quatre verticales coïncidaient
        exactement — un trait au lieu de quatre liens. Chaque flèche de la
        gouttière reçoit désormais son abscisse.

     2. Une flèche qui enjambe PLUS D'UNE colonne tournait au milieu, c'est-à-dire
        DANS les colonnes traversées : elle coupait leurs cartes. Elle passe
        maintenant par le couloir sous les bandes, comme une boucle de retour, et
        ne monte ou descend que dans des gouttières.

     LA RÈGLE : le routage ne s'active QUE sur conflit. Une flèche seule dans sa
     gouttière reçoit le décalage 0 et garde le `d` d'avant, au caractère près. */
  const colonnes = colonnesDesEtapes(liste);
  const colonne = colonneParEtape(liste);
  const boites = new Map();
  const boiteDe = (j) => {
    if (!boites.has(j)) {
      const c = carteDe(j);
      boites.set(j, c ? boite(c) : null);
    }
    return boites.get(j);
  };

  /* Bords de chaque colonne : l'emprise de ses cartes. La gouttière `k` est
     l'espace libre entre la colonne k-1 et la colonne k ; `k = 0` désigne
     l'espace à gauche de la première colonne, `k = nc` celui à droite de la
     dernière. C'est là — et nulle part ailleurs — qu'un tracé peut monter ou
     descendre sans rencontrer de carte. */
  const bordG = [], bordD = [];
  colonnes.forEach((col, k) => {
    let g = Infinity, dr = -Infinity;
    col.indices.forEach((j) => {
      const r = boiteDe(j);
      if (r) { g = Math.min(g, r.x); dr = Math.max(dr, r.x + r.l); }
    });
    bordG[k] = g === Infinity ? 0 : g;
    bordD[k] = dr === -Infinity ? 0 : dr;
  });
  const gouttiere = (k) => {
    if (k <= 0) return { centre: bordG[0] - 12, place: 20 };
    if (k >= colonnes.length) return { centre: bordD[colonnes.length - 1] + 12, place: 20 };
    return {
      centre: (bordD[k - 1] + bordG[k]) / 2,
      /* 4 px retirés : le tracé ne doit pas frôler le bord d'une carte. */
      place: Math.max(0, bordG[k] - bordD[k - 1] - 4),
    };
  };

  /* LE CRITÈRE DU LOT, RENDU EXÉCUTABLE DANS LE MOTEUR : aucun tracé ne coupe le
     rectangle d'une carte. `coupe` teste un segment orthogonal contre TOUTES les
     cartes, marge comprise. Il ne sert qu'à CHOISIR un trajet, jamais à en
     déformer un : quand rien ne coupe, le `d` est celui d'avant, au caractère. */
  const MARGE_CARTE = 1.5;
  let toutesBoites = null;
  const boitesCartes = () => {
    if (!toutesBoites) {
      toutesBoites = liste.map((_, j) => boiteDe(j)).filter(Boolean);
    }
    return toutesBoites;
  };
  const coupe = (xa, ya, xb, yb) => boitesCartes().some((r) =>
    Math.min(xa, xb) < r.x + r.l - MARGE_CARTE && Math.max(xa, xb) > r.x + MARGE_CARTE &&
    Math.min(ya, yb) < r.y + r.h - MARGE_CARTE && Math.max(ya, yb) > r.y + MARGE_CARTE);

  /* Classement des tracés. `direct` : le TRAJET D'AUJOURD'HUI — bord droit de la
     carte de départ, virage dans la gouttière, bord gauche de l'arrivée. Il n'est
     remis en cause que s'il coupe une carte, ou si un point de passage a été
     désigné à la main. C'EST LA RÈGLE QUI TIENT TOUT : pas de recherche sans
     conflit, donc un diagramme linéaire garde son balisage au caractère. */
  const traces = fleches.map((f, i) => {
    const ka = colonne.get(f.de), kb = colonne.get(f.vers);
    const a = boiteDe(f.de), b = boiteDe(f.vers);
    /* Une flèche dont les deux cartes sont à la même hauteur est un SEGMENT
       DROIT : elle n'a pas de verticale, donc rien à disputer dans la
       gouttière. L'en exclure est ce qui laisse la place aux flèches qui
       tournent vraiment — sur un croisement 2×2, deux au lieu de quatre. */
    const droite = !a || !b || Math.abs((b.y + b.h / 2) - (a.y + a.h / 2)) < 2;
    return {
      f, i, ka, kb, droite,
      /* Voisines et de gauche à droite : c'est le seul cas où le trajet direct a
         un sens à essayer sans le tester d'abord — les autres le sont aussi,
         mais après mesure (voir la passe de sûreté). */
      voisines: !f.retour && kb - ka === 1,
      direct: true, parLeBas: false, voie: 0, prof: 0,
      /* Point de passage en coordonnées de grille, ou `null`. */
      passage: f.passage || null,
    };

  });

  /* LE COUDE AU MILIEU DU SEGMENT N'EST PAS TOUJOURS LIBRE : dans une colonne
     empilée, ou dès qu'une carte voisine est plus large, la verticale calculée
     tombe DANS une tuile — c'est ce que montrait la capture. `sur(tr, x)` teste
     les trois segments réellement tracés pour une abscisse de coude donnée. */
  const sur = (tr, x) => {
    const a = boiteDe(tr.f.de), b = boiteDe(tr.f.vers);
    if (!a || !b) return false;
    const y1 = a.y + a.h / 2, y2 = b.y + b.h / 2;
    const x1 = a.x + a.l + 2, x2 = b.x - 3;
    return coupe(x, y1, x, y2) || coupe(x1, y1, x, y1) || coupe(x, y2, x2, y2);
  };

  /* Axe VERTICAL : une abscisse par flèche dans chaque gouttière encombrée.
     L'ordre est celui de l'ordonnée d'arrivée, ce qui évite des croisements
     gratuits, et il est déterministe — deux rendus des mêmes données donnent
     les mêmes `d`, sans quoi deux captures d'une même restitution ne
     coïncideraient plus. */
  const parGouttiere = new Map();
  traces.forEach((tr) => {
    if (!tr.voisines || tr.droite) return;
    const clef = tr.ka;
    if (!parGouttiere.has(clef)) parGouttiere.set(clef, []);
    parGouttiere.get(clef).push(tr);
  });

  parGouttiere.forEach((groupe, k) => {
    const g = gouttiere(k + 1);
    const cle = (tr) => {
      const b = boiteDe(tr.f.vers), a = boiteDe(tr.f.de);
      return [b ? b.y : 0, a ? a.y : 0, tr.i];
    };
    groupe.sort((u, v) => {
      const cu = cle(u), cv = cle(v);
      return cu[0] - cv[0] || cu[1] - cv[1] || cu[2] - cv[2];
    });
    const decalages = voies(groupe.length, g.place);
    groupe.forEach((tr, r) => {
      tr.voie = decalages[r];
      /* Plus d'une flèche : toutes tournent autour du MÊME centre, celui de la
         gouttière. Sinon deux cartes de largeurs différentes replaceraient les
         voies l'une sur l'autre. Une seule flèche : pas de centre commun, donc
         le milieu du segment, donc le `d` d'avant. */
      if (groupe.length > 1) tr.centreGouttiere = g.centre;
    });
  });

  /* PASSE DE SÛRETÉ — LE CRITÈRE DU LOT, APPLIQUÉ AU TRACÉ FINAL. Elle vient
     APRÈS l'attribution des voies, donc elle juge l'abscisse réellement tracée,
     voie comprise. Deux essais seulement, du moins au plus intrusif : le coude
     calculé (le `d` d'avant), puis le centre de la gouttière. Si les deux
     coupent, la flèche part à la RECHERCHE — plus de règle écrite à la main.

     Les flèches longues et les boucles de retour passent ici aussi : elles ne
     sont PLUS envoyées d'office au couloir. Leur trajet direct est mesuré, et
     s'il est libre il est pris tel quel — c'est la même règle pour tout le
     monde, et c'est ce qui évite le grand tour pour une flèche qui n'avait
     personne devant elle. */
  traces.forEach((tr) => {
    const a = boiteDe(tr.f.de), b = boiteDe(tr.f.vers);
    if (!a || !b) return;
    /* Un point de passage est une CONSIGNE, pas une préférence : il force la
       recherche, sinon le trajet direct le mangerait en silence. */
    if (tr.passage) { tr.direct = false; return; }
    const milieu = ((a.x + a.l + 2) + (b.x - 3)) / 2;
    if (!tr.voisines || tr.droite) {
      if (!sur(tr, milieu)) return;
      tr.direct = false;
      return;
    }
    const base = tr.centreGouttiere == null ? milieu : tr.centreGouttiere;
    if (!sur(tr, base + tr.voie)) return;
    const g = gouttiere(tr.ka + 1).centre;
    if (!sur(tr, g)) { tr.centreGouttiere = g; tr.voie = 0; return; }
    tr.direct = false;
  });

  /* Axe HORIZONTAL — LA PROFONDEUR LA PLUS FAIBLE QUI SUFFIT.
     Le lot C posait TOUTES les flèches de couloir sous le bas du diagramme
     entier (`fond()`), mesuré sur toutes les cellules et toutes les cartes :
     une flèche qui sautait une seule tuile descendait donc sous trois couloirs
     de rôle pour rien. Ce n'est pas le critère : le tracé ne doit franchir que
     ce qu'il RENCONTRE, c'est-à-dire les cartes dont l'emprise horizontale
     croise son propre segment de couloir. Les bandes de rôle ne comptent pas —
     un segment qui traverse une bande entre deux cartes ne coupe rien, et les
     verticales de gouttière le font déjà.

     Le fond global reste mesuré, mais pour une SEULE chose : la réserve de
     hauteur en bas du diagramme, qui ne vaut que si un couloir descend plus bas
     que le contenu. */
  let fondCouloir = null;
  const fond = () => {
    if (fondCouloir == null) {
      let m = 0;
      zone.querySelectorAll('.flux__cellule').forEach((cel) => {
        const r = boite(cel);
        m = Math.max(m, r.y + r.h);
      });
      boitesCartes().forEach((r) => { m = Math.max(m, r.y + r.h); });
      fondCouloir = m;
    }
    return fondCouloir;
  };

  /* Bas des cartes dont l'emprise horizontale croise [xa, xb] : la profondeur
     minimale qui suffit à ce tracé-là. Les deux cartes d'extrémité en font
     partie par construction, puisque les descentes partent de leurs bords. */
  const basCroise = (xa, xb) => {
    const g = Math.min(xa, xb) - MARGE_CARTE, dr = Math.max(xa, xb) + MARGE_CARTE;
    let m = 0;
    boitesCartes().forEach((r) => {
      if (r.x < dr && r.x + r.l > g) m = Math.max(m, r.y + r.h);
    });
    return m;
  };

  /* ---- LA RECHERCHE DE CHEMIN LIBRE ---------------------------------------

     Elle ne part QUE pour les flèches en conflit (`direct === false`). Ce n'est
     pas une optimisation : c'est ce qui garantit qu'un diagramme linéaire garde
     le balisage d'aujourd'hui, au caractère près.

     LA GRILLE EXISTE DÉJÀ, on ne fait que la LIRE. Le diagramme est un damier
     couloirs × colonnes :
       - OCCUPÉ : la boîte d'une carte (c'est `coupe`, marge comprise) ;
       - LIBRE  : les gouttières entre colonnes, les bandes entre couloirs, les
                  cellules vides, et les marges autour de la grille ;
       - NŒUDS  : les intersections gouttière × bande, plus les lignes propres aux
                  deux extrémités (milieu et centre de chaque carte, qui portent
                  les quatre accroches) ;
       - ARÊTES : les segments entre nœuds voisins d'une même ligne, retenus
                  seulement s'ils ne coupent aucune carte.

     COÛT : la longueur, PLUS une pénalité par virage. Sans cette pénalité on
     obtient des escaliers — les plus courts, et illisibles en salle.

     Une flèche peut croiser une AUTRE FLÈCHE : les tracés ne sont jamais des
     obstacles, seules les cartes le sont. C'est la décision « diagramme dense ».

     La grille est BORNÉE aux deux extrémités plus une colonne de marge de chaque
     côté : la recherche ne balaie pas le diagramme entier à chaque rendu. */
  const PENALITE_VIRAGE = 45;
  /* Ordre de départage des côtés, ÉCRIT et fixe. À coût et nombre de virages
     égaux, c'est lui qui tranche — puis, en dernier ressort, la suite des points
     comparée comme du texte. Deux rendus des mêmes données donnent donc le même
     tracé, sinon deux captures d'une même restitution ne coïncident plus. */
  const COTES = ['droite', 'bas', 'haut', 'gauche'];

  /* LES BANDES : les ordonnées où un tracé peut filer horizontalement. Une par
     frontière entre deux rangées de rôle, plus une au-dessus de la première et
     une sous la dernière — ce sont elles qui rendent le « par le haut » possible.
     L'index d'une bande est stable tant que les rôles ne bougent pas : c'est la
     coordonnée qu'on enregistre pour un point de passage. */
  let bandesY = null;
  const bandes = () => {
    if (bandesY) return bandesY;
    const rangs = [];
    zone.querySelectorAll('.flux__cellule').forEach((cel) => {
      const r = boite(cel);
      const haut = r.y, bas = r.y + r.h;
      const ex = rangs.find((u) => Math.abs(u.haut - haut) < 4);
      if (ex) { ex.haut = Math.min(ex.haut, haut); ex.bas = Math.max(ex.bas, bas); }
      else rangs.push({ haut, bas });
    });
    rangs.sort((u, v) => u.haut - v.haut);
    const ys = [];
    if (rangs.length) {
      ys.push(rangs[0].haut - 12);
      for (let k = 1; k < rangs.length; k++) ys.push((rangs[k - 1].bas + rangs[k].haut) / 2);
      ys.push(rangs[rangs.length - 1].bas + 12);
    }
    bandesY = ys;
    return ys;
  };

  const trier = (v) => v
    .map(Number).filter((x) => Number.isFinite(x))
    .sort((p, q) => p - q)
    .filter((x, i, t) => i === 0 || x - t[i - 1] > 1);

  /* Les quatre accroches d'une carte. Le côté est choisi par la RECHERCHE, pas
     écrit ici : `haut` et `bas` sortent au centre horizontal, `gauche` et
     `droite` à mi-hauteur — exactement les points d'aujourd'hui pour la droite et
     la gauche, ce qui laisse le trajet direct inchangé. */
  const accroche = (r, cote) => (
    cote === 'droite' ? { x: r.x + r.l + 2, y: r.y + r.h / 2, cote }
      : cote === 'gauche' ? { x: r.x - 3, y: r.y + r.h / 2, cote }
        : cote === 'haut' ? { x: r.x + r.l / 2, y: r.y - 2, cote }
          : { x: r.x + r.l / 2, y: r.y + r.h + 2, cote });

  const grilleDe = (tr) => {
    const a = boiteDe(tr.f.de), b = boiteDe(tr.f.vers);
    const kmin = Math.max(0, Math.min(tr.ka, tr.kb) - 1);
    const kmax = Math.min(colonnes.length, Math.max(tr.ka, tr.kb) + 2);
    const xs = [], ys = bandes().slice();
    const gouttieres = [];
    for (let k = kmin; k <= kmax; k++) { xs.push(gouttiere(k).centre); gouttieres.push(k); }
    if (tr.passage) {
      const k = Math.max(0, Math.min(colonnes.length, tr.passage.colonne));
      if (!gouttieres.includes(k)) { xs.push(gouttiere(k).centre); gouttieres.push(k); }
    }
    /* Les lignes propres aux extrémités : sans elles, aucune sortie par le haut
       ou par le bas n'est atteignable, puisque ces accroches ne tombent sur
       aucune gouttière. */
    [a, b].forEach((r) => {
      if (!r) return;
      COTES.forEach((c) => { const p = accroche(r, c); xs.push(p.x); ys.push(p.y); });
    });
    return { xs: trier(xs), ys: trier(ys), gouttieres };
  };

  /* Dijkstra sur (nœud, orientation) : l'orientation est dans l'état, c'est ce
     qui permet de faire payer un virage sans fausser le plus court chemin.

     UNE SEULE exploration par point de DÉPART, relue pour les quatre accroches
     d'arrivée : seize explorations par flèche coûteraient seize fois le même
     travail, sur une grille qu'on vient justement de borner. */
  const explorer = (g, dep) => {
    const nx = g.xs.length, ny = g.ys.length;
    const ix = (v) => g.xs.findIndex((x) => Math.abs(x - v) < 1.5);
    const iy = (v) => g.ys.findIndex((y) => Math.abs(y - v) < 1.5);
    const xa = ix(dep.x), ya = iy(dep.y);
    if (xa < 0 || ya < 0) return null;
    const N = nx * ny;
    const num = (i, j) => i + j * nx;
    const cout = new Float64Array(N * 2).fill(Infinity);
    const vira = new Int32Array(N * 2);
    const prec = new Int32Array(N * 2).fill(-1);
    const vu = new Uint8Array(N * 2);
    const source = num(xa, ya);
    cout[source * 2] = 0; cout[source * 2 + 1] = 0;
    for (;;) {
      let s = -1, meilleur = Infinity;
      for (let k = 0; k < N * 2; k++) if (!vu[k] && cout[k] < meilleur) { meilleur = cout[k]; s = k; }
      if (s < 0) break;
      vu[s] = 1;
      const n = s >> 1, o = s & 1;
      const i = n % nx, j = (n - (n % nx)) / nx;
      const voisins = [[i - 1, j, 0], [i + 1, j, 0], [i, j - 1, 1], [i, j + 1, 1]];
      for (const [i2, j2, o2] of voisins) {
        if (i2 < 0 || j2 < 0 || i2 >= nx || j2 >= ny) continue;
        const x1 = g.xs[i], y1 = g.ys[j], x2 = g.xs[i2], y2 = g.ys[j2];
        if (coupe(x1, y1, x2, y2)) continue;
        const t2 = num(i2, j2) * 2 + o2;
        /* Le premier pas ne paie pas de virage : l'accroche n'a pas d'orientation
           entrante. Les deux états de la source portent donc le coût 0. */
        const virage = prec[s] < 0 ? 0 : (o2 !== o ? 1 : 0);
        const c = cout[s] + Math.abs(x2 - x1) + Math.abs(y2 - y1) + virage * PENALITE_VIRAGE;
        if (c < cout[t2] - 0.0001) { cout[t2] = c; vira[t2] = vira[s] + virage; prec[t2] = s; }
      }
    }
    return { g, nx, cout, vira, prec, num, ix, iy };
  };

  const extraire = (ex, arr) => {
    if (!ex) return null;
    const i = ex.ix(arr.x), j = ex.iy(arr.y);
    if (i < 0 || j < 0) return null;
    const but = ex.num(i, j);
    const fin = ex.cout[but * 2] <= ex.cout[but * 2 + 1] ? but * 2 : but * 2 + 1;
    if (!Number.isFinite(ex.cout[fin])) return null;
    const pts = [];
    for (let s = fin; s >= 0; s = ex.prec[s]) {
      const n = s >> 1, i2 = n % ex.nx, j2 = (n - (n % ex.nx)) / ex.nx;
      pts.unshift({ x: ex.g.xs[i2], y: ex.g.ys[j2] });
      if (ex.prec[s] < 0) break;
    }
    return { pts, cout: ex.cout[fin], virages: ex.vira[fin] };
  };

  /* Points alignés successifs : un seul segment. Sans cette réduction, le `d`
     porterait des coudes de rayon nul et le nombre de virages serait faux. */
  const reduire = (pts) => {
    const out = [];
    for (const p of pts) {
      const n = out.length;
      if (n >= 2) {
        const u = out[n - 2], v = out[n - 1];
        if ((Math.abs(u.x - v.x) < 0.5 && Math.abs(v.x - p.x) < 0.5)
          || (Math.abs(u.y - v.y) < 0.5 && Math.abs(v.y - p.y) < 0.5)) { out[n - 1] = p; continue; }
      }
      if (n && Math.abs(out[n - 1].x - p.x) < 0.5 && Math.abs(out[n - 1].y - p.y) < 0.5) continue;
      out.push(p);
    }
    return out;
  };

  const noeudPassage = (g, p) => {
    const ys = bandes();
    const b = ys[Math.max(0, Math.min(ys.length - 1, p.bande))];
    const k = Math.max(0, Math.min(colonnes.length, p.colonne));
    if (b == null) return null;
    return { x: gouttiere(k).centre, y: b };
  };

  const chercher = (tr) => {
    const a = boiteDe(tr.f.de), b = boiteDe(tr.f.vers);
    if (!a || !b) return null;
    const g = grilleDe(tr);
    const par = tr.passage ? noeudPassage(g, tr.passage) : null;
    /* Avec un point de passage, le chemin est fait de deux moitiés : l'exploration
       depuis le point de passage sert les quatre arrivées, celle depuis chaque
       accroche de départ sert le point de passage. Le reste du chemin est donc
       bien RECALCULÉ autour du passage, pas plaqué dessus. */
    const depuisPassage = par ? explorer(g, par) : null;
    const candidats = [];
    for (const cd of COTES) {
      const p = accroche(a, cd);
      const ex = explorer(g, p);
      if (!ex) continue;
      const amont = par ? extraire(ex, par) : null;
      if (par && !amont) continue;
      for (const cv of COTES) {
        const q = accroche(b, cv);
        const aval = extraire(par ? depuisPassage : ex, q);
        if (!aval) continue;
        const r = par
          ? {
            pts: amont.pts.concat(aval.pts.slice(1)),
            cout: amont.cout + aval.cout,
            virages: amont.virages + aval.virages,
          }
          : aval;
        if (r.pts.length < 2) continue;
        const pts = reduire(r.pts);
        candidats.push({
          pts,
          cout: Math.round(r.cout * 10) / 10,
          virages: Math.max(0, pts.length - 2),
          coteDepart: cd,
          coteArrivee: cv,
          clef: pts.map((p2) => Math.round(p2.x) + ',' + Math.round(p2.y)).join(' '),
        });
      }
    }
    if (!candidats.length) return null;
    /* LE DÉPARTAGE, DANS L'ORDRE : coût, puis nombre de virages, puis côté de
       départ dans l'ordre de `COTES`, puis côté d'arrivée, puis la suite des
       points comparée comme du texte. Total, donc déterministe. */
    candidats.sort((u, v) => u.cout - v.cout
      || u.virages - v.virages
      || COTES.indexOf(u.coteDepart) - COTES.indexOf(v.coteDepart)
      || COTES.indexOf(u.coteArrivee) - COTES.indexOf(v.coteArrivee)
      || (u.clef < v.clef ? -1 : u.clef > v.clef ? 1 : 0));
    return candidats[0];
  };

  traces.forEach((tr) => {
    if (tr.direct) return;
    const r = chercher(tr);
    if (r) { tr.chemin = r.pts; tr.coteDepart = r.coteDepart; tr.coteArrivee = r.coteArrivee; }
    /* AUCUN CHEMIN LIBRE : on retombe sur le pont par le couloir sous le
       diagramme, qui reste le seul trajet qui existe toujours. Ce n'est pas un
       joli tracé, mais il ne coupe aucune carte — et il annonce visiblement que
       la place manque. */
    else tr.parLeBas = true;
  });

  /* DEUX FLÈCHES SUR LE MÊME CÔTÉ D'UNE CARTE NE PARTAGENT PAS LEUR POINT.
     C'est l'attribution de voies du lot C (`voies`), appliquée au BORD au lieu de
     la gouttière — pas un second mécanisme. Le décalage n'est retenu que s'il
     laisse le tracé hors des cartes : la sûreté passe avant la lisibilité. */
  const parBord = new Map();
  traces.forEach((tr) => {
    if (!tr.chemin) return;
    [[tr.f.de, tr.coteDepart, 'd'], [tr.f.vers, tr.coteArrivee, 'a']].forEach(([j, cote, bout]) => {
      const clef = j + '|' + cote;
      if (!parBord.has(clef)) parBord.set(clef, []);
      parBord.get(clef).push({ tr, bout, j, cote });
    });
  });
  parBord.forEach((groupe) => {
    if (groupe.length < 2) return;
    groupe.sort((u, v) => u.tr.i - v.tr.i);
    const r = boiteDe(groupe[0].j);
    if (!r) return;
    const vertical = groupe[0].cote === 'haut' || groupe[0].cote === 'bas';
    const place = Math.max(0, (vertical ? r.l : r.h) - 10);
    const decalages = voies(groupe.length, place);
    groupe.forEach((e, rang) => {
      const d = decalages[rang];
      if (!d) return;
      const pts = e.tr.chemin;
      const i0 = e.bout === 'd' ? 0 : pts.length - 1;
      const i1 = e.bout === 'd' ? 1 : pts.length - 2;
      if (i1 < 0 || i1 >= pts.length) return;
      const bouge = (p) => (vertical ? { x: p.x + d, y: p.y } : { x: p.x, y: p.y + d });
      const p0 = bouge(pts[i0]), p1 = bouge(pts[i1]);
      const i2 = e.bout === 'd' ? 2 : pts.length - 3;
      const voisin = pts[i2];
      if (coupe(p0.x, p0.y, p1.x, p1.y)) return;
      if (voisin && coupe(p1.x, p1.y, voisin.x, voisin.y)) return;
      pts[i0] = p0; pts[i1] = p1;
    });
  });

  /* Le `d` d'un chemin de recherche : segments droits, coudes arrondis comme
     ceux du trajet direct (rayon 9 px, rogné par la place réelle). */
  const arrondir = (pts) => {
    const n1 = (v) => Math.round(v * 10) / 10;
    if (pts.length < 3) return `M${n1(pts[0].x)},${n1(pts[0].y)} L${n1(pts[pts.length - 1].x)},${n1(pts[pts.length - 1].y)}`;
    let d = `M${n1(pts[0].x)},${n1(pts[0].y)}`;
    for (let k = 1; k < pts.length - 1; k++) {
      const p = pts[k], av = pts[k - 1], ap = pts[k + 1];
      const lav = Math.abs(p.x - av.x) + Math.abs(p.y - av.y);
      const lap = Math.abs(p.x - ap.x) + Math.abs(p.y - ap.y);
      const r = Math.min(9, lav / 2, lap / 2);
      if (r < 2) { d += ` L${n1(p.x)},${n1(p.y)}`; continue; }
      const vers = (q, l) => ({
        x: p.x + Math.sign(q.x - p.x) * (Math.abs(q.x - p.x) > 0.5 ? l : 0),
        y: p.y + Math.sign(q.y - p.y) * (Math.abs(q.y - p.y) > 0.5 ? l : 0),
      });
      const e = vers(av, r), s = vers(ap, r);
      d += ` L${n1(e.x)},${n1(e.y)} Q${n1(p.x)},${n1(p.y)} ${n1(s.x)},${n1(s.y)}`;
    }
    const f = pts[pts.length - 1];
    return d + ` L${n1(f.x)},${n1(f.y)}`;
  };

  /* LE GESTE DU PASSAGE. `options.designation` porte la CLEF de la flèche en
     cours de désignation — l'identifiant d'une flèche dessinée, ou « de>vers »
     pour une flèche calculée. Absente, rien n'est émis : le diagramme au repos ne
     porte aucun nœud, et le balisage reste celui du mono-fichier. */
  const clefFleche = (f) => (f.manuelle && f.id ? String(f.id) : f.de + '>' + f.vers);
  const designee = (f) => Boolean(options.designation) && String(options.designation) === clefFleche(f);
  const dansCarte = (x, y) => boitesCartes().some(
    (r) => x > r.x - 3 && x < r.x + r.l + 3 && y > r.y - 3 && y < r.y + r.h + 3,
  );
  const noeudsDesignables = (tr, couleur) => {
    const g = grilleDe(tr);
    const ys = bandes();
    const out = [];
    g.gouttieres.forEach((k) => {
      const x = gouttiere(k).centre;
      ys.forEach((y, b) => {
        if (dansCarte(x, y)) return;
        const pose = tr.passage && tr.passage.bande === b && tr.passage.colonne === k;
        out.push(`<circle class="flux-noeud${pose ? ' flux-noeud--pose' : ''}" data-action="poser-passage"${
          tr.f.manuelle ? ` data-fleche="${echapper(tr.f.id)}"` : ''} data-de="${tr.f.de}" data-vers="${
          tr.f.vers}" data-bande="${b}" data-colonne="${k}" cx="${Math.round(x)}" cy="${Math.round(y)}" r="5"
          fill="#FFFFFF" stroke="${couleur}" stroke-width="1.2"><title>${t.flechePassageNoeudTitre}</title></circle>`);
      });
    });
    return out.join('');
  };

  const auCouloir = traces.filter((tr) => tr.parLeBas)
    .sort((u, v) => u.ka - v.ka || u.kb - v.kb || u.i - v.i);

  /* Les descentes se placent AVANT la profondeur, parce que c'est leur abscisse
     qui dit quelles cartes le couloir doit franchir. Elles sont vérifiées
     contre une descente jusqu'au fond global — le cas le plus défavorable —
     pour que le choix ne dépende pas de la profondeur qu'il détermine. */
  const libre = (k, bordee, ya, yb) => {
    const c = gouttiere(k).centre;
    if (!coupe(c, ya, c, yb)) return c;
    for (const x of [bordee + 4, bordee - 4]) if (!coupe(x, ya, x, yb)) return x;
    return c;
  };
  const placees = [];
  for (const tr of auCouloir) {
    const a = boiteDe(tr.f.de), b = boiteDe(tr.f.vers);
    if (!a || !b) continue;
    tr.y1 = a.y + a.h / 2;
    tr.y2 = b.y + b.h / 2;
    const plancher = fond() + 12;
    tr.xg1 = libre(tr.ka + 1, a.x + a.l + 4, tr.y1, plancher);
    tr.xg2 = libre(tr.kb, b.x - 4, tr.y2, plancher);
    /* Une profondeur par flèche, mais seulement entre flèches qui se
       DISPUTENT vraiment la place : deux ponts dont les segments de couloir ne
       se croisent pas peuvent partager la même profondeur sans se superposer.
       On décale de 10 px tant qu'un pont déjà posé et chevauchant est trop
       proche — déterministe, et minimal par construction. */
    let yc = basCroise(tr.xg1, tr.xg2) + 12;
    const chevauche = (o) =>
      Math.min(o.xg1, o.xg2) < Math.max(tr.xg1, tr.xg2) &&
      Math.max(o.xg1, o.xg2) > Math.min(tr.xg1, tr.xg2);
    for (let garde = 0; garde < 40; garde++) {
      const gene = placees.find((o) => chevauche(o) && Math.abs(o.yc - yc) < 10);
      if (!gene) break;
      yc = gene.yc + 10;
    }
    tr.yc = yc;
    placees.push(tr);
  }


  /* Le bas réellement PEINT, tous tracés confondus : c'est lui qui commande la
     réserve de hauteur, et rien d'autre. Zéro ⇒ aucune réserve, donc la hauteur
     d'avant, au pixel. */
  let basPeint = 0;

  for (const tr of traces) {
    const f = tr.f;
    const ja = f.de, jb = f.vers;
    const ca = carteDe(ja), cb = carteDe(jb);
    if (!ca || !cb) continue;
    const a = boite(ca), b = boite(cb);
    let d, cx, cy;

    if (tr.chemin) {
      /* CHEMIN TROUVÉ PAR LA RECHERCHE. Les côtés de sortie et d'entrée sont ceux
         qu'elle a choisis : haut, bas, gauche ou droite. C'est le cas de la
         capture — le dessous étant occupé, le chemin le plus court passe par le
         dessus, et la flèche quitte sa carte par le haut. */
      d = arrondir(tr.chemin);
      /* Poignée sur le PLUS LONG segment du chemin : tous les segments sont
         libres par construction (une arête retenue ne coupe aucune carte), le plus
         long est simplement celui où la puce gêne le moins. */
      let mieux = -1;
      for (let k = 1; k < tr.chemin.length; k++) {
        const p = tr.chemin[k - 1], q = tr.chemin[k];
        const l = Math.abs(q.x - p.x) + Math.abs(q.y - p.y);
        if (l > mieux) { mieux = l; cx = (p.x + q.x) / 2; cy = (p.y + q.y) / 2; }
      }
      tr.chemin.forEach((p) => { basPeint = Math.max(basPeint, p.y); });
    } else if (tr.parLeBas) {
      /* AUCUN CHEMIN LIBRE — le pont par le couloir, dernier recours. Sortie par
         le bord droit, descente dans la gouttière qui suit la colonne de départ,
         parcours du couloir, remontée dans la gouttière qui précède la colonne
         d'arrivée, entrée par le bord gauche. Il ne coupe aucune carte, et il se
         voit : c'est ainsi qu'un diagramme sans place l'annonce. */
      const x1 = a.x + a.l + 2;
      const y1 = tr.y1;
      const x2 = b.x - 3;
      const y2 = tr.y2;
      const xg1 = tr.xg1, xg2 = tr.xg2;
      const yc = Math.max(basCroise(xg1, xg2) + 8, tr.yc);
      tr.ycTrace = yc;
      d = `M${x1},${y1} L${xg1},${y1} L${xg1},${yc} L${xg2},${yc} L${xg2},${y2} L${x2},${y2}`;
      /* Poignée AU MILIEU DU SEGMENT DE COULOIR — hors carte par construction. */
      cx = (xg1 + xg2) / 2;
      cy = yc;
      basPeint = Math.max(basPeint, yc);
    } else {
      const x1 = a.x + a.l + 2;
      const y1 = a.y + a.h / 2;
      const x2 = b.x - 3;
      const y2 = b.y + b.h / 2;
      const dx = x2 - x1, dy = y2 - y1;
      /* Sans conflit, `centreGouttiere` est absent et `voie` vaut 0 : `mx` est
         le milieu du segment, exactement comme avant ce lot. */
      const mx = (tr.centreGouttiere == null ? x1 + dx / 2 : tr.centreGouttiere) + tr.voie;
      /* Le rayon doit tenir dans l'écart horizontal ET vertical : sinon les deux
         quarts de cercle se chevauchent et la flèche part à l'envers, avec une
         pointe qui déborde sur les cartes. Sous 2 px de rayon utile, on trace
         un simple segment droit. La forme `min(mx - x1, x2 - mx) - 2` vaut
         `|dx|/2 - 2` quand la voie est nulle : le tracé d'avant est intact. */
      const r = Math.min(9, Math.min(mx - x1, x2 - mx) - 2, Math.abs(dy) / 2);
      const s = dy > 0 ? 1 : -1;
      const droit = Math.abs(dy) < 2 || r < 2 || dx <= 0;
      d = droit
        ? `M${x1},${y1} L${x2},${y2}`
        : `M${x1},${y1} L${mx - r},${y1} Q${mx},${y1} ${mx},${y1 + s * r} L${mx},${y2 - s * r} Q${mx},${y2} ${mx + r},${y2} L${x2},${y2}`;
      /* Poignée SUR LA VERTICALE DE GOUTTIÈRE, jamais au milieu géométrique : la
         verticale est le seul segment dont on sait qu'il ne rencontre pas de
         carte. Tracé droit (pas de verticale) : son milieu est déjà entre les
         deux cartes, donc dans la gouttière. */
      cx = mx;
      cy = y1 + dy / 2;
    }


    /* La nature vient de la flèche : lien de l'étape reçue si elle est
       implicite, colonne `nature` de la ligne si elle est dessinée. Le clic doit
       donc agir sur la bonne SOURCE — d'où `data-fleche` au lieu de `data-i`
       pour une flèche manuelle. */
    const nature = f.nature || '';
    const style = LIENS[nature] || LIENS[''];

    const cible = options.edition
      ? `<path class="fleche-cible" data-action="basculer-lien"${
        f.manuelle ? ` data-fleche="${echapper(f.id)}"` : ` data-i="${jb}"`} d="${d}"
        fill="none" stroke="transparent" stroke-width="16"><title>${t.flecheTitre(libelleLien(nature, t))}</title></path>`
      : '';
    if (retraits) {
      /* Retirer une flèche est un geste À PART du changement de nature : deux
         cibles distinctes, jamais un clic qui devine. La puce est posée sur un
         segment de gouttière ou de couloir — hors carte PAR CONSTRUCTION.

         Zone de clic et poignée sont GROUPÉES : c'est ce groupe que la feuille
         de style survole, donc une seule poignée paraît à la fois. `tabindex`
         la rend atteignable au clavier — la seule commande de flèche qui le
         soit : changer la nature reste au pointeur. */
      const commun = `${f.manuelle ? ` data-fleche="${echapper(f.id)}"` : ''} data-de="${ja}" data-vers="${jb}"`;
      /* L'ÉPINGLE — « fais passer par ici ». Le réglage n'est plus un décalage en
         pixels : un clic sur l'épingle ouvre la DÉSIGNATION, et le clic suivant
         choisit une intersection bande × colonne. Quand la flèche porte déjà un
         passage, l'épingle le RETIRE et rend la flèche au calcul — comme
         « revenir au libellé livré » de l'onglet maturité. */
      const epingle = `<g class="fleche-passage${tr.passage ? ' fleche-passage--pose' : ''}" tabindex="0" role="button" data-action="designer-passage"${
        commun} transform="translate(${Math.round(cx)},${Math.round(cy - 20)})"><title>${t.flechePassageTitre}</title>
        <circle r="7.5" fill="#FFFFFF" stroke="${style.couleur}" stroke-width="1.2"></circle>
        <path d="M0,-3.5 L0,3.5 M-3.5,0 L3.5,0" stroke="${style.couleur}" stroke-width="1.4" stroke-linecap="round" fill="none"></path></g>`;
      /* LES NŒUDS DÉSIGNABLES : seulement pour la flèche en cours de désignation,
         et seulement les intersections libres. Ils ne sont émis que sous cette
         commande — un diagramme au repos n'en porte aucun. */
      const noeuds = designee(f) ? noeudsDesignables(tr, style.couleur) : '';
      puces.push(`<g class="fleche${designee(f) ? ' fleche--designation' : ''}">${cible}${epingle}<g class="fleche-retirer" tabindex="0" role="button" data-action="retirer-fleche"${
        f.manuelle ? ` data-fleche="${echapper(f.id)}"` : ''} data-de="${ja}" data-vers="${jb}"
        transform="translate(${Math.round(cx)},${Math.round(cy)})"><title>${
        f.manuelle ? t.flecheRetirerTitre : t.flecheMasquerTitre}</title>
        <circle r="7.5" fill="#FFFFFF" stroke="${style.couleur}" stroke-width="1.2"></circle>
        <path d="M-3,-3 L3,3 M3,-3 L-3,3" stroke="${style.couleur}" stroke-width="1.4" stroke-linecap="round" fill="none"></path></g>${noeuds}</g>`);
    } else if (cible) {
      zonesClic.push(cible);
    }
    chemins.push(`<path d="${d}" fill="none" stroke="${style.couleur}" stroke-width="1.5"${
      style.tirets ? ` stroke-dasharray="${style.tirets}"` : ''} marker-end="url(#${style.marqueur})"/>`);
  }

  /* LA RÉSERVE N'EXISTE QUE SI ELLE SERT. Un chemin de recherche ou un pont de
     couloir peut descendre sous la dernière rangée : sans réserve, son tracé
     serait rogné par le débordement. Mais cette hauteur nourrit la pagination de
     l'impression — un diagramme dont aucun tracé ne descend sous le contenu doit
     donc garder EXACTEMENT la hauteur d'avant. D'où une réserve posée en style en
     ligne, et RETIRÉE dès qu'elle ne sert plus. Elle n'entre pas dans le
     balisage : la comparaison au mono-fichier reste caractère pour caractère.
     Elle ne déplace pas non plus les cellules, donc les mesures ci-dessus restent
     valables.

     Elle est calculée sur le bas RÉELLEMENT peint, et RELATIVEMENT au bas du
     contenu : un tracé qui reste dans la grille ne demande aucune réserve. */
  if (basPeint > 0) {
    const creux = Math.max(0, basPeint + 10 - fond());
    if (creux > 0) zone.style.paddingBottom = Math.ceil(creux) + 'px';
    else zone.style.removeProperty('padding-bottom');
  } else if (zone.style.paddingBottom) {
    zone.style.removeProperty('padding-bottom');
  }



  const pointe = (id, couleur) =>
    `<marker id="${id}" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto">
       <path d="M0,0 L6,3 L0,6 z" fill="${couleur}"></path>
     </marker>`;

  const largeur = zone.scrollWidth + 'px';
  const hauteur = zone.offsetHeight + 'px';
  svg.style.width = largeur;
  svg.style.height = hauteur;
  svg.innerHTML = `
    <defs>
      ${pointe('pointe-neutre', '#A485FE')}
      ${pointe('pointe-auto', '#6733FD')}
      ${pointe('pointe-manuel', '#CE6700')}
    </defs>${chemins.join('')}`;

  if (cibles) {
    cibles.style.width = largeur;
    cibles.style.height = hauteur;
    /* La classe de désignation vit sur la COUCHE DE CIBLES, pas sur le tracé :
       c'est elle qui porte les nœuds, et c'est elle qui doit estomper les autres
       flèches pendant qu'on choisit. Retirée dès la sortie du mode, sinon un
       diagramme au repos reste à moitié éteint. */
    cibles.classList.toggle('flux-designation', Boolean(options.designation));
    cibles.innerHTML = zonesClic.join('') + puces.join('');
  }
}

/** Enchaînement complet après un rendu : place les cartes partagées, ajuste les
    zones de texte, puis trace. L'ordre compte — le tracé lit les décalages
    posés par `placerCartesACheval`, et les hauteurs finales des cartes. */
export function acheverRendu(zone, etapes, options = {}) {
  ajusterZonesDeTexte(zone);
  placerCartesACheval(zone);
  tracerFleches(zone, etapes, options);
}
