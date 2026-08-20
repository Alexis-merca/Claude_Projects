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
  /* Le nom en `<title>` : une pastille muette oblige à deviner. `role="img"` +
     `aria-label` pour que le lecteur d'écran l'annonce aussi. */
  const etiquette = echapper(nom);
  return `<svg class="badge-support" viewBox="0 0 16 16" width="16" height="16" role="img" aria-label="${etiquette}"><title>${etiquette}</title>
    <rect width="16" height="16" rx="3.6" fill="${b.fond}"/>${dedans}</svg>`;
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

/** Groupes de phase consécutifs : un bandeau de frise par groupe. */
export function groupesDePhase(etapes) {
  const groupes = [];
  etapes.forEach((et, i) => {
    const lab = et.phase || '';
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.label === lab) dernier.span += 1;
    else groupes.push({ label: lab, span: 1, debut: i });
  });
  return groupes;
}

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

  /* --- frise temporelle : un bandeau par groupe de phase --- */
  const groupes = groupesDePhase(etapes);
  const coupures = groupes.slice(1).map((g) => g.debut);
  /* Écart déduit du libellé lui-même s'il est codé (J-7, J1, S+2, M+3). */
  const jours = groupes.map((g) => jalonEnJours(g.label));

  const frise = groupes.map((g, i) => {
    const ecart = i > 0 ? ecartLisible(jours[i - 1], jours[i], t) : '';
    const corps = ed && cmd('phases')
      ? `<div class="flux__phase-edition">
           <input class="flux__phase-champ" value="${echapper(g.label)}" data-champ="phase.${g.debut}.${g.span}"
                  placeholder="${t.phasePlaceholder}" title="${t.phaseRenommerTitre(g.span)}">
           <button type="button" class="bouton--puce bouton--puce-claire" data-action="supprimer-phase"
                   data-i="${g.debut}" data-span="${g.span}" data-role="supprimer"
                   title="${t.phaseSupprimerTitre(g.span)}">×</button>
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

  /* --- cellules et cartes --- */
  const cellules = [];
  couloirs.forEach((r, i) => {
    for (let j = 0; j < n; j++) {
      const coupe = coupures.includes(j) ? ' flux__cellule--coupe' : '';
      const pos = `grid-row:${2 + i};grid-column:${2 + j}`;
      const em = emprise[j];

      if (em.ligne === i) {
        const et = etapes[j];
        const cible = ed ? ` data-cellule="${j}" data-role-nom="${echapper(r.nom)}"` : '';
        const supports = listeSupports(et.supports);
        const partage = em.cheval ? ' flux__carte--cheval' : '';
        const cellCheval = em.cheval ? ' flux__cellule--cheval' : '';
        const marqueCheval = em.cheval ? ` data-cheval="${em.cheval}"` : '';

        if (!ed) {
          cellules.push(`
            <div class="flux__cellule${coupe}${cellCheval}" style="${pos}">
              <div class="flux__carte${partage}" data-etape="${et.ordre}"${marqueCheval}>
                ${bandeauSupports(supports, options.outils)}
                <span class="flux__carte-texte">${echapper(et.texte)}</span>
              </div>
            </div>`);
        } else {
          cellules.push(`
            <div class="flux__cellule${coupe}${cellCheval}" style="${pos}"${cible}>
              <div class="flux__carte flux__carte--edition${partage}${options.etapeActive === et.ordre ? ' flux__carte--actif' : ''}"
                   data-etape="${et.ordre}" data-index="${j}"${marqueCheval}>
                ${cmd('supports') ? bandeauSupportsEdition(j, supports, t, options.outils) : bandeauSupports(supports, options.outils)}
                <div class="carte__tete">
                  ${cmd('deplacement') ? `<span class="carte__poignee" draggable="true" data-poignee="${j}"
                        title="${t.poigneeTitre}">⠿</span>` : ''}
                </div>
                <textarea class="carte__texte" rows="1" data-champ="etape.${j}.texte"
                          placeholder="${t.etapePlaceholder}">${echapper(et.texte || '')}</textarea>
                ${cmd('supports') ? vueChoixSupport(j, supports, options.outils, t) : ''}
                <div class="carte__outils">
                  ${cmd('etapes') ? `<button type="button" class="bouton--puce" data-action="gauche-etape" data-i="${j}" ${j === 0 ? 'disabled' : ''} title="${t.etapeGauche}">←</button>
                  <button type="button" class="bouton--puce" data-action="droite-etape" data-i="${j}" ${j === n - 1 ? 'disabled' : ''} title="${t.etapeDroite}">→</button>
                  <button type="button" class="bouton--puce" data-action="inserer-etape" data-i="${j}" title="${t.etapeInserer}">+</button>
                  ` : ''}${cmd('phases') ? `<button type="button" class="bouton--puce" data-action="couper-phase" data-i="${j}"
                          title="${t.phaseCouperTitre}">${ICONE_COUPURE}</button>` : ''}${cmd('etapes') ? `
                  <button type="button" class="bouton--puce" data-action="supprimer-etape" data-role="supprimer" data-i="${j}" title="${t.etapeSupprimer}">×</button>` : ''}
                </div>
              </div>
            </div>`);
        }
      } else {
        cellules.push(`<div class="flux__cellule${coupe}" style="${pos}"${
          ed ? ` data-cellule="${j}" data-role-nom="${echapper(r.nom)}"` : ''}></div>`);
      }

      /* Bande de dépôt sur la frontière avec le couloir suivant. */
      if (ed && cmd('deplacement') && i < R - 1) {
        cellules.push(`<div class="flux__frontiere" style="grid-row:${2 + i};grid-column:${2 + j}"
          data-frontiere="${j}" data-role-haut="${echapper(r.nom)}" data-role-bas="${echapper(couloirs[i + 1].nom)}"
          title="${t.frontiereTitre}"></div>`);
      }
    }

    /* colonne d'ajout en fin de couloir */
    if (ed && cmd('etapes')) {
      cellules.push(`
        <div class="flux__cellule" style="grid-row:${2 + i};grid-column:${2 + n}" data-cellule="${n}" data-role-nom="${echapper(r.nom)}">
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
           style="grid-template-columns:${gabaritColonnes(n, ed)};zoom:${zoomApplique}">
        <svg class="flux-svg" xmlns="http://www.w3.org/2000/svg"></svg>
        <svg class="flux-svg flux-svg--cibles" xmlns="http://www.w3.org/2000/svg"></svg>
        <div style="grid-row:1;grid-column:1"></div>
        ${bandes}
        ${frise}
        ${ed && cmd('phases') ? `<button type="button" class="flux__phase-ajout" data-action="ajouter-phase"
                        style="grid-row:1;grid-column:${2 + n}"
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
    const marge = 12;   /* padding vertical de la cellule */
    const decal = sens > 0
      ? cellule.offsetHeight - carte.offsetHeight / 2 - marge
      : -carte.offsetHeight / 2 - marge;
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

  for (let i = 0; i < cartes.length - 1; i++) {
    const a = boite(cartes[i]), b = boite(cartes[i + 1]);
    const x1 = a.x + a.l + 2;
    const y1 = a.y + a.h / 2;
    const x2 = b.x - 3;
    const y2 = b.y + b.h / 2;
    const dx = x2 - x1, dy = y2 - y1;
    const mx = x1 + dx / 2;
    /* Le rayon doit tenir dans l'écart horizontal ET vertical : sinon les deux
       quarts de cercle se chevauchent et la flèche part à l'envers, avec une
       pointe qui déborde sur les cartes. Sous 2 px de rayon utile, on trace
       un simple segment droit. */
    const r = Math.min(9, Math.abs(dx) / 2 - 2, Math.abs(dy) / 2);
    const s = dy > 0 ? 1 : -1;
    const d = (Math.abs(dy) < 2 || r < 2 || dx <= 0)
      ? `M${x1},${y1} L${x2},${y2}`
      : `M${x1},${y1} L${mx - r},${y1} Q${mx},${y1} ${mx},${y1 + s * r} L${mx},${y2 - s * r} Q${mx},${y2} ${mx + r},${y2} L${x2},${y2}`;


    /* Le lien est porté par l'étape qui reçoit la flèche. */
    const nature = (liste[i + 1] && liste[i + 1].lien) || '';
    const style = LIENS[nature] || LIENS[''];

    if (options.edition) {
      zonesClic.push(`<path class="fleche-cible" data-action="basculer-lien" data-i="${i + 1}" d="${d}"
        fill="none" stroke="transparent" stroke-width="16"><title>${t.flecheTitre(libelleLien(nature, t))}</title></path>`);
    }
    chemins.push(`<path d="${d}" fill="none" stroke="${style.couleur}" stroke-width="1.5"${
      style.tirets ? ` stroke-dasharray="${style.tirets}"` : ''} marker-end="url(#${style.marqueur})"/>`);
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
    cibles.innerHTML = zonesClic.join('');
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
