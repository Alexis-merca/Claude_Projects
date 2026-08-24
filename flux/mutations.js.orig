/* ============================================================================
   Diagramme de flux — traduction des interactions en opérations de base
   ============================================================================

   Fonctions pures. Elles reçoivent l'état courant des étapes et rendent la
   liste des écritures à faire ; elles ne touchent ni au DOM ni au réseau.
   C'est ce qui les rend testables sans navigateur et sans base, et c'est là
   que vit toute la logique délicate — l'appelant n'a plus qu'à exécuter.

   Chaque fonction rend un objet `{ ecritures, ordre }` :
     ecritures : [{ id, champs }]  — un UPDATE par étape touchée
     ordre     : [id, …] ou null   — appel à reordonner_etapes(), qui doit
                                     passer par la fonction SQL dédiée et non
                                     par des écritures ligne à ligne.

   La sémantique est reprise de diagnostic-os.html, y compris ses règles non
   évidentes — celle du dépôt qui fait adopter la phase du voisin, notamment.
   ========================================================================= */

import { listeSupports, ORDRE_LIENS } from './moteur.js';

const RIEN = { ecritures: [], ordre: null };

const phaseDe = (et) => (et && et.phase) || '';

/** Nom d'échelle encore libre dans le processus. */
export function nomEchelleLibre(etapes) {
  const pris = etapes.map(phaseDe);
  const racine = 'Nouvelle échelle';
  if (!pris.includes(racine)) return racine;
  let n = 2;
  while (pris.includes(`${racine} ${n}`)) n++;
  return `${racine} ${n}`;
}

/* ---------------------------------------------------------------------------
   Nature du lien
   ------------------------------------------------------------------------- */

/** Clic sur une flèche : non qualifié → manuel → automatique → …

    Le lien est porté par l'étape qui REÇOIT la flèche, donc `index` est celui
    de l'étape d'arrivée. Le tracé émet déjà `data-i` avec cette convention. */
export function cyclerLien(etapes, index) {
  const et = etapes[index];
  if (!et) return RIEN;
  const rang = ORDRE_LIENS.indexOf(et.lien || '');
  const suivant = ORDRE_LIENS[(rang + 1) % ORDRE_LIENS.length];
  return { ecritures: [{ id: et.id, champs: { lien: suivant } }], ordre: null };
}

/* ---------------------------------------------------------------------------
   Texte
   ------------------------------------------------------------------------- */

export function changerTexte(etapes, index, texte) {
  const et = etapes[index];
  if (!et || (et.texte || '') === texte) return RIEN;
  return { ecritures: [{ id: et.id, champs: { texte } }], ordre: null };
}

/* ---------------------------------------------------------------------------
   Supports et outils
   ------------------------------------------------------------------------- */

/** Retire le k-ième support d'une étape. */
export function retirerSupport(etapes, index, k) {
  const et = etapes[index];
  if (!et) return RIEN;
  const liste = listeSupports(et.supports);
  if (k < 0 || k >= liste.length) return RIEN;
  liste.splice(k, 1);
  return { ecritures: [{ id: et.id, champs: { supports: liste.join(', ') } }], ordre: null };
}

/**
 * Ajoute un support à une étape.
 *
 * `inscrireAuClient` vaut pour un outil saisi à la main : il rejoint la liste
 * des outils du site, sinon il ne serait proposé nulle part ailleurs et chacun
 * le retaperait avec une orthographe différente. L'appelant reçoit alors
 * `outilClient` — une écriture sur le client, pas sur l'étape.
 */
export function ajouterSupport(etapes, index, nom, inscrireAuClient) {
  const et = etapes[index];
  const propre = (nom || '').trim();
  if (!et || !propre) return RIEN;
  const liste = listeSupports(et.supports);
  if (liste.includes(propre)) return RIEN;
  liste.push(propre);
  const m = { ecritures: [{ id: et.id, champs: { supports: liste.join(', ') } }], ordre: null };
  if (inscrireAuClient) m.outilClient = propre;
  return m;
}

/* ---------------------------------------------------------------------------
   Colonnes partagées
   ------------------------------------------------------------------------- */

const partageDe = (et) => Boolean(et && et.colonne_partagee);

/** Bascule « cette étape occupe la colonne de la précédente ».

    La première étape n'a pas de précédente : le moteur ignore sa valeur, on
    refuse donc le geste plutôt que d'écrire un drapeau sans effet. */
export function basculerPartageColonne(etapes, index) {
  const et = etapes[index];
  if (!et) return RIEN;
  if (index === 0) {
    return { ...RIEN, refus: "La première étape ne peut pas partager la colonne d'une précédente." };
  }
  return {
    ecritures: [{ id: et.id, champs: { colonne_partagee: !partageDe(et) } }],
    ordre: null,
  };
}

/** Recadrage après un geste STRUCTUREL (insertion, suppression, déplacement).

    Le drapeau est relatif : l'étape qui SUIVAIT celle qu'on retire ou devant
    laquelle on insère change de voisine, et son « la même colonne que la
    précédente » désignerait alors une autre étape — une colonne se recomposerait
    toute seule, sans geste de l'utilisateur et sans rien à l'écran qui le dise.
    On le remet donc à faux : la colonne se défait, ce qui est visible. */
function detacher(etape) {
  return partageDe(etape) ? [{ id: etape.id, champs: { colonne_partagee: false } }] : [];
}

/* ---------------------------------------------------------------------------
   Déplacement
   ------------------------------------------------------------------------- */

/**
 * Dépôt d'une étape sur un couloir ou sur une frontière entre deux couloirs.
 *
 * @param {object[]} etapes   étapes du processus, dans l'ordre
 * @param {number} source     index de l'étape déplacée
 * @param {number} colonne    index de la colonne visée
 * @param {string} role       couloir visé — rôle du haut si c'est une frontière
 * @param {string} [role2]    couloir du bas, uniquement pour une frontière
 */
export function deposerEtape(etapes, source, colonne, role, role2) {
  const et = etapes[source];
  if (!et) return RIEN;

  const liste = etapes.slice();
  liste.splice(source, 1);
  /* La cellule d'ajout en fin de couloir vaut « à la fin ». */
  const destination = Math.min(colonne, liste.length);
  liste.splice(destination, 0, et);

  const champs = {};
  if (role != null) champs.role = role;
  /* Déposée sur un couloir : un seul rôle. Sur une frontière : les deux. */
  const second = role2 && role2 !== role ? role2 : '';
  if ((et.role2 || '') !== second) champs.role2 = second;

  /* L'étape adopte la phase de sa nouvelle place. Sans cela un simple
     déplacement fragmenterait le bandeau : « Avant J1 | J1 | Avant J1 ». */
  const voisin = liste[destination - 1] || liste[destination + 1];
  if (voisin) {
    const reprise = phaseDe(voisin);
    if (phaseDe(et) !== reprise) champs.phase = reprise;
  }

  /* Une étape déposée prend une colonne à part : son ancien partage désignait
     une voisine qu'elle vient de quitter. */
  if (partageDe(et)) champs.colonne_partagee = false;

  const ecritures = Object.keys(champs).length ? [{ id: et.id, champs }] : [];
  const suivante = etapes[source + 1];
  if (suivante && suivante.id !== et.id) ecritures.push(...detacher(suivante));
  const bouge = liste.some((x, i) => x.id !== etapes[i].id);
  return { ecritures, ordre: bouge ? liste.map((x) => x.id) : null };
}

/* ---------------------------------------------------------------------------
   Échelles de temps
   ------------------------------------------------------------------------- */

/** Renommer l'échelle d'un groupe : `span` étapes à partir de `debut`. */
export function renommerEchelle(etapes, debut, span, libelle) {
  const ecritures = [];
  for (let k = debut; k < debut + span && k < etapes.length; k++) {
    if (phaseDe(etapes[k]) !== libelle) {
      ecritures.push({ id: etapes[k].id, champs: { phase: libelle } });
    }
  }
  return { ecritures, ordre: null };
}

/**
 * Couper : l'étape visée ouvre une nouvelle échelle, qui court jusqu'à la fin
 * du groupe auquel elle appartenait.
 *
 * Rend `{ refus }` si l'étape ouvre déjà une échelle — couper là ne
 * produirait rien, et l'utilisateur doit savoir pourquoi son clic est resté
 * sans effet.
 */
export function couperEchelle(etapes, index) {
  const et = etapes[index];
  if (!et) return RIEN;
  const ancienne = phaseDe(et);
  if (index === 0 || phaseDe(etapes[index - 1]) !== ancienne) {
    return {
      ...RIEN,
      refus: "Cette étape ouvre déjà une échelle de temps. Choisissez-en une autre pour couper.",
    };
  }
  const nom = nomEchelleLibre(etapes);
  const ecritures = [];
  for (let k = index; k < etapes.length && phaseDe(etapes[k]) === ancienne; k++) {
    ecritures.push({ id: etapes[k].id, champs: { phase: nom } });
  }
  return { ecritures, ordre: null };
}

/** Supprimer une échelle : ses étapes rejoignent la précédente, sinon la
    suivante, sinon aucune. Elles ne sont jamais supprimées. */
export function supprimerEchelle(etapes, debut, span) {
  const avant = debut > 0 ? phaseDe(etapes[debut - 1]) : null;
  const apres = debut + span < etapes.length ? phaseDe(etapes[debut + span]) : null;
  const reprise = avant != null ? avant : (apres != null ? apres : '');
  return renommerEchelle(etapes, debut, span, reprise);
}

/**
 * Ajouter une échelle en fin de frise. Elle naît avec une étape vierge : une
 * échelle sans étape n'aurait aucune colonne où s'afficher.
 *
 * Rend `{ creation }` plutôt qu'une écriture — l'appelant doit insérer, pas
 * mettre à jour.
 */
export function ajouterEchelle(etapes, roleParDefaut) {
  return {
    ...RIEN,
    creation: {
      ordre: etapes.length + 1,
      role: roleParDefaut || '',
      role2: '',
      texte: '',
      phase: nomEchelleLibre(etapes),
      supports: '',
      lien: '',
      colonne_partagee: false,
    },
  };
}
