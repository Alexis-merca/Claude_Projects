/* ============================================================================
   Vérifie la traduction des interactions en opérations de base.

   Ces fonctions sont pures : on peut les éprouver sans navigateur ni base,
   et c'est là que vit la logique qui casse en silence — l'adoption de phase
   au dépôt, le refus de couper une échelle déjà ouverte, la reprise de
   l'échelle voisine à la suppression.

   Usage :  node flux/mutations.test.mjs
   ========================================================================= */

import {
  cyclerLien, changerTexte, deposerEtape,
  renommerEchelle, couperEchelle, supprimerEchelle, ajouterEchelle,
  nomEchelleLibre,
} from './mutations.js';

let ko = 0;
const ok = (nom, cond, detail = '') => {
  console.log((cond ? '  ok  ' : '  KO  ') + nom + (cond ? '' : '\n        → ' + detail));
  if (!cond) ko++;
};
const J = (v) => JSON.stringify(v);

/** Étapes de travail : deux échelles, quatre couloirs. */
const faire = () => [
  { id: 'a', ordre: 1, role: 'RH',  role2: '', texte: 'un',     phase: 'Avant J1', lien: '' },
  { id: 'b', ordre: 2, role: 'RH',  role2: '', texte: 'deux',   phase: 'Avant J1', lien: '' },
  { id: 'c', ordre: 3, role: 'EHS', role2: '', texte: 'trois',  phase: 'J1',       lien: 'manuel' },
  { id: 'd', ordre: 4, role: 'EHS', role2: '', texte: 'quatre', phase: 'J1',       lien: '' },
  { id: 'e', ordre: 5, role: 'Col', role2: '', texte: 'cinq',   phase: 'J1',       lien: '' },
];

/* ==========================================================================
   Nature du lien
   ========================================================================== */
{
  const et = faire();
  ok('lien : non qualifié → manuel',
    J(cyclerLien(et, 1).ecritures) === J([{ id: 'b', champs: { lien: 'manuel' } }]));
  ok('lien : manuel → automatique',
    J(cyclerLien(et, 2).ecritures) === J([{ id: 'c', champs: { lien: 'auto' } }]));
  const auto = faire(); auto[3].lien = 'auto';
  ok('lien : automatique → non qualifié (le cycle boucle)',
    J(cyclerLien(auto, 3).ecritures) === J([{ id: 'd', champs: { lien: '' } }]));
  ok('lien : index hors bornes → aucune écriture', cyclerLien(et, 99).ecritures.length === 0);
}

/* ==========================================================================
   Texte
   ========================================================================== */
{
  const et = faire();
  ok('texte : modifié → une écriture',
    J(changerTexte(et, 0, 'neuf').ecritures) === J([{ id: 'a', champs: { texte: 'neuf' } }]));
  ok('texte : identique → aucune écriture, la version du processus ne bouge pas',
    changerTexte(et, 0, 'un').ecritures.length === 0);
}

/* ==========================================================================
   Déplacement
   ========================================================================== */
{
  const et = faire();
  const r = deposerEtape(et, 4, 1, 'RH');           // « cinq » en 2e position, couloir RH
  ok('dépôt : nouvel ordre complet', J(r.ordre) === J(['a', 'e', 'b', 'c', 'd']), J(r.ordre));
  const ch = r.ecritures[0].champs;
  ok('dépôt : rôle du couloir visé', ch.role === 'RH', J(ch));
  ok('dépôt : phase adoptée du voisin — sinon le bandeau se fragmente',
    ch.phase === 'Avant J1', J(ch));
}
{
  const et = faire();
  const r = deposerEtape(et, 0, 3, 'EHS', 'Col');   // sur la frontière EHS / Col
  ok('dépôt sur frontière : les deux rôles',
    r.ecritures[0].champs.role === 'EHS' && r.ecritures[0].champs.role2 === 'Col',
    J(r.ecritures[0].champs));
}
{
  const et = faire(); et[0].role2 = 'EHS';
  const r = deposerEtape(et, 0, 2, 'RH');           // d'une frontière vers un couloir simple
  ok('dépôt sur couloir : le second rôle est effacé',
    r.ecritures[0].champs.role2 === '', J(r.ecritures[0].champs));
}
{
  const et = faire();
  const r = deposerEtape(et, 1, 99, 'Col');         // colonne au-delà de la fin
  ok('dépôt au-delà de la fin : placé en dernier',
    J(r.ordre) === J(['a', 'c', 'd', 'e', 'b']), J(r.ordre));
}
{
  const et = faire();
  const r = deposerEtape(et, 2, 2, 'EHS');          // même place, même rôle
  ok('dépôt sans déplacement : aucun réordonnancement demandé', r.ordre === null, J(r.ordre));
}

/* ==========================================================================
   Échelles de temps
   ========================================================================== */
{
  const et = faire();
  const r = renommerEchelle(et, 0, 2, 'Amont');
  ok('renommer : les deux étapes du groupe, et elles seules',
    J(r.ecritures) === J([{ id: 'a', champs: { phase: 'Amont' } },
                          { id: 'b', champs: { phase: 'Amont' } }]), J(r.ecritures));
  ok('renommer avec le même libellé : aucune écriture',
    renommerEchelle(et, 0, 2, 'Avant J1').ecritures.length === 0);
}
{
  const et = faire();
  const r = couperEchelle(et, 3);                   // « quatre » ouvre une échelle
  ok('couper : court jusqu\'à la fin du groupe',
    J(r.ecritures.map((x) => x.id)) === J(['d', 'e']), J(r.ecritures));
  ok('couper : nom d\'échelle libre',
    r.ecritures[0].champs.phase === 'Nouvelle échelle', J(r.ecritures[0].champs));
}
{
  const et = faire();
  const r = couperEchelle(et, 2);                   // « trois » ouvre déjà « J1 »
  ok('couper une échelle déjà ouverte : refusé, et le refus est expliqué',
    r.ecritures.length === 0 && typeof r.refus === 'string' && r.refus.length > 10, J(r));
  ok('couper à l\'index 0 : refusé aussi', couperEchelle(et, 0).refus !== undefined);
}
{
  const et = faire();
  const r = supprimerEchelle(et, 2, 3);             // le groupe « J1 » rejoint « Avant J1 »
  ok('supprimer : reprise de l\'échelle précédente',
    r.ecritures.every((x) => x.champs.phase === 'Avant J1') && r.ecritures.length === 3,
    J(r.ecritures));
}
{
  const et = faire();
  const r = supprimerEchelle(et, 0, 2);             // pas de précédente : on prend la suivante
  ok('supprimer le premier groupe : reprise de l\'échelle suivante',
    r.ecritures.every((x) => x.champs.phase === 'J1') && r.ecritures.length === 2, J(r.ecritures));
}
{
  const seule = [{ id: 'a', ordre: 1, role: 'RH', texte: 'x', phase: 'J1' }];
  const r = supprimerEchelle(seule, 0, 1);          // ni avant ni après
  ok('supprimer l\'unique échelle : elle devient vide, l\'étape survit',
    J(r.ecritures) === J([{ id: 'a', champs: { phase: '' } }]), J(r.ecritures));
}
{
  const et = faire();
  const r = ajouterEchelle(et, 'RH');
  ok('ajouter : une création, pas une mise à jour',
    r.ecritures.length === 0 && r.creation != null, J(r));
  ok('ajouter : étape vierge en fin de frise, échelle nommée',
    r.creation.ordre === 6 && r.creation.role === 'RH'
    && r.creation.texte === '' && r.creation.phase === 'Nouvelle échelle', J(r.creation));
}
{
  const et = faire();
  et[0].phase = 'Nouvelle échelle';
  ok('nom d\'échelle libre : évite la collision',
    nomEchelleLibre(et) === 'Nouvelle échelle 2', nomEchelleLibre(et));
  et[1].phase = 'Nouvelle échelle 2';
  ok('nom d\'échelle libre : et la suivante',
    nomEchelleLibre(et) === 'Nouvelle échelle 3', nomEchelleLibre(et));
}

/* ==========================================================================
   Rien n'est muté au passage
   ========================================================================== */
{
  const et = faire();
  const avant = J(et);
  cyclerLien(et, 1); changerTexte(et, 0, 'zzz'); deposerEtape(et, 4, 0, 'RH');
  renommerEchelle(et, 0, 2, 'X'); couperEchelle(et, 3); supprimerEchelle(et, 2, 3);
  ajouterEchelle(et, 'RH');
  ok('les étapes fournies ne sont jamais modifiées', J(et) === avant);
}

console.log(ko ? `\n${ko} ÉCHEC(S)\n` : '\nTRADUCTION DES INTERACTIONS CONFORME\n');
process.exit(ko ? 1 : 0);
