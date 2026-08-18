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

/** 8 couleurs de tag de la charte : surface claire + texte foncé. */
export const PASTELS = [
  ['#D4DEF9', '#2D5BAE'], ['#D4F3E9', '#337572'], ['#DBEEFA', '#256F9A'], ['#DEF3CC', '#107558'],
  ['#F8EAC1', '#CE6700'], ['#F5E4D9', '#A3512B'], ['#FFCFCF', '#AA2D46'], ['#F9DBF4', '#AA2B89']
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

/** Défaut : fenêtre de navigateur — la plupart des supports nommés sont des applis web. */
export const BADGE_DEFAUT = {
  fond: '#5A6ACF',
  glyphe: '<rect x="3" y="4" width="10" height="8" rx="1.2" fill="#fff"/><path d="M3 6.5h10" stroke="#5A6ACF" stroke-width="1.1"/><circle cx="4.7" cy="5.25" r=".55" fill="#5A6ACF"/>'
};

/** Barre verticale pointillée : le même signe que la séparation de phase du diagramme. */
export const ICONE_COUPURE = `<svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor"
  stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M6 1.5v9" stroke-dasharray="2 2"/></svg>`;

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

export function badgeSupport(nom) {
  const clef = String(nom || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const b = BADGES_SUPPORT.find((x) => x.motifs.some((m) => clef.includes(m))) || BADGE_DEFAUT;
  const dedans = b.glyphe
    ? b.glyphe
    : `<text x="8" y="11.4" text-anchor="middle" fill="#fff"
             font-family="Overpass, sans-serif" font-size="9.5" font-weight="700">${echapper(b.lettre)}</text>`;
  return `<svg class="badge-support" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <rect width="16" height="16" rx="3.6" fill="${b.fond}"/>${dedans}</svg>`;
}

/** Supports de l'étape, en rangée à cheval sur la bordure haute de la carte. */
export function bandeauSupports(liste) {
  if (!liste.length) return '';
  const montrees = liste.slice(0, 4);
  const reste = liste.length - montrees.length;
  return `<span class="supports-bordure" title="${echapper(liste.join(' · '))}">
    ${montrees.map((sup) => badgeSupport(sup)).join('')}
    ${reste ? `<span class="supports-bordure__reste">+${reste}</span>` : ''}
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
export function ecartLisible(depuis, vers) {
  if (depuis == null || vers == null) return '';
  const j = vers - depuis;
  if (j === 0) return '';
  const signe = j > 0 ? '+' : '−';
  const a = Math.abs(j);
  if (a % 30 === 0) return `${signe}${a / 30} mois`;
  if (a % 7 === 0) return `${signe}${a / 7} sem`;
  return `${signe}${a} j`;
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

/** Badges retirables, à cheval sur la bordure haute de la carte. */
function bandeauSupportsEdition(j, supports) {
  if (!supports.length) return '';
  return `<span class="supports-bordure supports-bordure--edition">
    ${supports.map((sup, k) => `
      <span class="support-modif" title="${echapper(sup)}">
        ${badgeSupport(sup)}
        <button class="bouton--retirer" data-action="supprimer-support" data-i="${j}" data-s="${k}"
                title="Retirer ${echapper(sup)}">×</button>
      </span>`).join('')}
  </span>`;
}

/** Liste déroulante d'ajout, alimentée par les outils déjà relevés sur le site. */
function vueChoixSupport(j, supports, outils) {
  const dispo = (outils || []).filter((o) => o && !supports.includes(o));
  const options = ['<option value="">＋ support…</option>']
    .concat(dispo.map((o) => `<option value="${echapper(o)}">${echapper(o)}</option>`))
    .concat(['<option value="__autre__">Autre outil…</option>']);
  return `<select class="carte__support-choix" data-champ="support-ajout.${j}"
                  title="Choisir le support ou l'outil utilisé pour cette étape">${options.join('')}</select>`;
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
 * @returns {string} HTML
 */
export function baliserFlux({ processus: p, etapes, options = {} }) {
  const ed = Boolean(options.edition) && !options.impression;
  const avecEntete = options.entete !== false;

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
      <button class="bouton bouton--mini" data-action="zoom-ajuster" title="Régler le zoom pour tout afficher">Ajuster</button>
      <input type="range" min="40" max="100" step="5" value="${Math.round(zoomAffiche * 100)}"
             data-champ="zoom" aria-label="Zoom du diagramme">
      <span class="flux__zoom-valeur">${Math.round(zoomAffiche * 100)} %</span>
    </div>`;

  const entete = `
    <div class="flux__entete">
      <span class="libelle libelle--large">Diagramme de flux — l'existant</span>
      <div class="rangee" style="gap:14px">
        ${n ? zoom : ''}
        ${ed && cmd('tableau') ? `<button class="bouton bouton--mini ne-pas-imprimer" data-action="basculer-tableau">${
          options.tableauVisible ? 'Masquer la saisie rapide' : 'Saisie rapide'}</button>` : ''}
      </div>
    </div>`;

  if (!n) {
    return `
    <div class="carte carte--flux">
      ${avecEntete ? entete : ''}
      <div class="vide">
        <span class="vide__titre">Aucune étape pour ce processus</span>
        <span class="sourdine">${ed
          ? 'Ajoutez la première étape avec le bouton ci-dessous.'
          : 'Passez en mode édition et ajoutez la première étape du flux.'}</span>
        ${ed && cmd('etapes') ? '<button class="bouton bouton--mini" data-action="ajouter-etape">+ Première étape</button>' : ''}
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
    const ecart = i > 0 ? ecartLisible(jours[i - 1], jours[i]) : '';
    const corps = ed && cmd('phases')
      ? `<div class="flux__phase-edition">
           <input class="flux__phase-champ" value="${echapper(g.label)}" data-champ="phase.${g.debut}.${g.span}"
                  placeholder="nommer cette échelle" title="Renomme l'échelle de temps des ${g.span} étape(s) de ce groupe">
           <button class="bouton--puce bouton--puce-claire" data-action="supprimer-phase"
                   data-i="${g.debut}" data-span="${g.span}" data-role="supprimer"
                   title="Supprimer cette échelle de temps — ses ${g.span} étape(s) rejoignent l'échelle voisine">×</button>
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
      ? `<input class="flux__role-champ" value="${echapper(role)}" data-champ="role.${iRole}" title="Renommer le rôle"
                style="--chip-fond:${fond};--chip-encre:${encre}">
         <div class="flux__role-outils">
           <button class="bouton--puce" data-action="monter-role" data-i="${iRole}" ${iRole === 0 ? 'disabled' : ''} title="Monter la ligne">↑</button>
           <button class="bouton--puce" data-action="descendre-role" data-i="${iRole}" ${iRole === p.roles.length - 1 ? 'disabled' : ''} title="Descendre la ligne">↓</button>
           <button class="bouton--puce" data-action="supprimer-role" data-role="supprimer" data-i="${iRole}" title="Supprimer le rôle">×</button>
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
                ${bandeauSupports(supports)}
                <span class="flux__carte-texte">${echapper(et.texte)}</span>
              </div>
            </div>`);
        } else {
          cellules.push(`
            <div class="flux__cellule${coupe}${cellCheval}" style="${pos}"${cible}>
              <div class="flux__carte flux__carte--edition${partage}${options.etapeActive === et.ordre ? ' flux__carte--actif' : ''}"
                   data-etape="${et.ordre}" data-index="${j}"${marqueCheval}>
                ${cmd('supports') ? bandeauSupportsEdition(j, supports) : bandeauSupports(supports)}
                <div class="carte__tete">
                  ${cmd('deplacement') ? `<span class="carte__poignee" draggable="true" data-poignee="${j}"
                        title="Glisser sur un autre couloir, ou sur la frontière entre deux couloirs pour dire que les deux sont concernés">⠿</span>` : ''}
                </div>
                <textarea class="carte__texte" rows="1" data-champ="etape.${j}.texte"
                          placeholder="Action relevée…">${echapper(et.texte || '')}</textarea>
                ${cmd('supports') ? vueChoixSupport(j, supports, options.outils) : ''}
                <div class="carte__outils">
                  ${cmd('etapes') ? `<button class="bouton--puce" data-action="gauche-etape" data-i="${j}" ${j === 0 ? 'disabled' : ''} title="Décaler à gauche">←</button>
                  <button class="bouton--puce" data-action="droite-etape" data-i="${j}" ${j === n - 1 ? 'disabled' : ''} title="Décaler à droite">→</button>
                  <button class="bouton--puce" data-action="inserer-etape" data-i="${j}" title="Insérer une étape après">+</button>
                  ` : ''}${cmd('phases') ? `<button class="bouton--puce" data-action="couper-phase" data-i="${j}"
                          title="Commencer une nouvelle échelle de temps à partir de cette étape">${ICONE_COUPURE}</button>` : ''}${cmd('etapes') ? `
                  <button class="bouton--puce" data-action="supprimer-etape" data-role="supprimer" data-i="${j}" title="Supprimer l'étape">×</button>` : ''}
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
          title="Déposer ici : les deux rôles sont concernés"></div>`);
      }
    }

    /* colonne d'ajout en fin de couloir */
    if (ed && cmd('etapes')) {
      cellules.push(`
        <div class="flux__cellule" style="grid-row:${2 + i};grid-column:${2 + n}" data-cellule="${n}" data-role-nom="${echapper(r.nom)}">
          <button class="flux__ajout" data-action="ajouter-etape-role" data-role-nom="${echapper(r.nom)}"
                  title="Ajouter une étape sur cette ligne">+ Étape</button>
        </div>`);
    }
  });

  const legende = `
    <div class="flux__legende">
      ${['auto', 'manuel', ''].map((k) => `
        <span class="flux__legende-item">
          <span class="flux__legende-trait" style="border-top-color:${LIENS[k].couleur};border-top-style:${LIENS[k].tirets ? 'dashed' : 'solid'}"></span>
          ${LIENS[k].libelle}
        </span>`).join('')}
      ${ed ? '<span class="sourdine" style="font-size:13px">— cliquez une flèche pour changer</span>' : ''}
    </div>`;

  /* Sans saut de ligne d'ouverture, contrairement à `entete` : l'appel est déjà
     indenté dans le gabarit final. En ajouter un ici insérerait une ligne vide
     que l'original n'a pas, et la comparaison stricte au balisage d'origine
     échouerait — c'est exactement ce qu'elle est là pour attraper. */
  const pied = `<div class="flux__pied">
      ${legende}
      ${ed && cmd('roles') ? `<button class="bouton bouton--mini pousse-droite" data-action="ajouter-role">+ Rôle</button>` : ''}
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
        ${ed && cmd('phases') ? `<button class="flux__phase-ajout" data-action="ajouter-phase"
                        style="grid-row:1;grid-column:${2 + n}"
                        title="Ajouter une échelle de temps en fin de frise">+ Échelle</button>` : ''}
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

/** Hauteur des zones de saisie ajustée à leur contenu. */
export function ajusterZonesDeTexte(zone) {
  if (!zone) return;
  zone.querySelectorAll('.carte__texte').forEach((z) => {
    z.style.height = 'auto';
    z.style.height = z.scrollHeight + 'px';
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
        fill="none" stroke="transparent" stroke-width="16"><title>Lien ${style.libelle} — cliquer pour changer</title></path>`);
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
