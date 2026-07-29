/* ============================================================================
   Vérifie que le moteur extrait produit exactement ce que produisait
   diagnostic-os.html.

   La méthode : charger les fonctions du mono-fichier dans Node (elles sont
   pures pour tout ce qui produit du balisage), appeler l'original et le moteur
   sur les mêmes données, comparer les chaînes caractère par caractère.

   C'est le seul test qui prouve qu'une extraction n'a rien changé. Comparer des
   captures d'écran laisserait passer un attribut perdu ; comparer « à peu près »
   laisserait passer le décalage d'une carte à cheval.

   Usage :  node flux/moteur.test.mjs
   ========================================================================= */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { baliserFlux, rolesCouloirs, empriseDesEtapes, groupesDePhase,
         couleursRole, jalonEnJours, ecartLisible, listeSupports, PASTELS } from './moteur.js';

const ici = dirname(fileURLToPath(import.meta.url));
const MONO = join(ici, '..', 'diagnostic-os.html');

/* --- charge les fonctions du mono-fichier dans ce processus ---------------- */
function chargerOriginal() {
  const html = readFileSync(MONO, 'utf8');
  const debut = html.indexOf('<script>') + '<script>'.length;
  const corps = html.slice(debut, html.lastIndexOf('</script>'));
  /* On s'arrête avant le bloc DÉMARRAGE : au-delà, le script touche au DOM. */
  const coupe = corps.indexOf('/* ==========================================================================\n   DÉMARRAGE');

  const rien = () => {};
  const faux = {
    addEventListener: rien, innerHTML: '', style: {}, dataset: {},
    classList: { add: rien, remove: rien },
    getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0 }),
    querySelector: () => null, querySelectorAll: () => [],
    appendChild: rien, remove: rien, click: rien
  };
  const prelude = `
    const document = { getElementById: () => faux, querySelector: () => null,
      querySelectorAll: () => [], createElement: () => faux, body: faux,
      addEventListener: () => {}, fonts: null };
    const window = { addEventListener: () => {}, print: () => {} };
    const localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    const alert = () => {}; const confirm = () => true;
  `;
  const fabrique = new Function('faux', 'rien',
    prelude + corps.slice(0, coupe)
    + '\nreturn { vueFlux, etat, rolesGlobaux, trierBase, clone, BASE_SOURCE };');
  return fabrique(faux, rien);
}

const O = chargerOriginal();

let ko = 0;
const ok = (nom, cond, detail = '') => {
  console.log((cond ? '  ok  ' : '  KO  ') + nom + (cond ? '' : '\n        → ' + detail));
  if (!cond) ko++;
};

/** Premier écart entre deux chaînes, avec son contexte — sinon un diff de
    30 000 caractères est illisible. */
function premierEcart(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  if (i === n && a.length === b.length) return '';
  const fen = (s) => JSON.stringify(s.slice(Math.max(0, i - 60), i + 90));
  return `position ${i}\n          original : ${fen(a)}\n          moteur   : ${fen(b)}`;
}

const base = O.trierBase(O.clone(O.BASE_SOURCE));
const client = base[0];
O.etat.base = base;
O.etat.clientId = client.id;

console.log(`\ndonnées : ${client.nom} — ${client.processus.length} processus, `
  + `${client.processus.reduce((n, p) => n + p.etapes.length, 0)} étapes\n`);

/* ==========================================================================
   1. Égalité stricte du balisage, dans les trois modes
   ========================================================================== */
const MODES = [
  { nom: 'lecture',    etat: { edition: false, impression: false, zoom: 1,    tableau: false } },
  { nom: 'lecture 60%',etat: { edition: false, impression: false, zoom: 0.6,  tableau: false } },
  { nom: 'édition',    etat: { edition: true,  impression: false, zoom: 1,    tableau: false } },
  { nom: 'édition + saisie rapide', etat: { edition: true, impression: false, zoom: 0.85, tableau: true } },
  { nom: 'impression', etat: { edition: false, impression: true,  zoom: 0.47, tableau: false } },
  /* Le cas piège : en impression le zoom doit être forcé à 1 même si l'écran
     était dézoomé, et les contrôles d'édition doivent disparaître. */
  { nom: 'impression depuis le mode édition',
    etat: { edition: true, impression: true, zoom: 0.5, tableau: true } }
];

for (const mode of MODES) {
  Object.assign(O.etat, mode.etat);
  O.etat.etapeActive = null;

  for (const p of client.processus) {
    O.etat.procId = p.id;
    const attendu = O.vueFlux(p);
    const obtenu = baliserFlux({
      processus: p,
      etapes: p.etapes,
      options: {
        paletteRoles: O.rolesGlobaux(),
        outils: client.outils,
        edition: mode.etat.edition,
        impression: mode.etat.impression,
        zoom: mode.etat.zoom,
        etapeActive: null,
        tableauVisible: mode.etat.tableau
      }
    });
    ok(`${mode.nom} · ${p.id}`, attendu === obtenu, premierEcart(attendu, obtenu));
  }
}

/* ==========================================================================
   2. L'étape mise en avant
   ========================================================================== */
Object.assign(O.etat, { edition: true, impression: false, zoom: 1, tableau: false });
{
  const p = client.processus[0];
  O.etat.procId = p.id;
  O.etat.etapeActive = 3;
  const attendu = O.vueFlux(p);
  const obtenu = baliserFlux({
    processus: p, etapes: p.etapes,
    options: { paletteRoles: O.rolesGlobaux(), outils: client.outils,
      edition: true, zoom: 1, etapeActive: 3, tableauVisible: false }
  });
  ok('étape active mise en avant', attendu === obtenu, premierEcart(attendu, obtenu));
  O.etat.etapeActive = null;
}

/* ==========================================================================
   3. Processus vide
   ========================================================================== */
for (const ed of [false, true]) {
  Object.assign(O.etat, { edition: ed, impression: false, zoom: 1, tableau: false });
  const vide = { id: 'vide', roles: ['RH'], etapes: [], frictions: [], chiffres: [] };
  client.processus.push(vide);
  O.etat.procId = 'vide';
  const attendu = O.vueFlux(vide);
  const obtenu = baliserFlux({
    processus: vide, etapes: [],
    options: { paletteRoles: O.rolesGlobaux(), outils: client.outils, edition: ed, zoom: 1 }
  });
  ok(`processus sans étape (${ed ? 'édition' : 'lecture'})`, attendu === obtenu, premierEcart(attendu, obtenu));
  client.processus.pop();
}

/* ==========================================================================
   4. Cartes à cheval — le cas que le mono-fichier gère et qu'une réécriture
      casserait en premier. Les données Sekurit n'en contiennent aucune : on en
      fabrique une, sinon ce chemin ne serait jamais couvert.
   ========================================================================== */
Object.assign(O.etat, { edition: false, impression: false, zoom: 1, tableau: false });
{
  const p = JSON.parse(JSON.stringify(client.processus[0]));
  p.etapes[2].role2 = p.roles[3];   // chevauche vers le bas
  p.etapes[5].role = p.roles[3];
  p.etapes[5].role2 = p.roles[1];   // chevauche vers le haut
  client.processus.push(p);
  O.etat.procId = p.id;

  const attendu = O.vueFlux(p);
  const obtenu = baliserFlux({
    processus: p, etapes: p.etapes,
    options: { paletteRoles: O.rolesGlobaux(), outils: client.outils, edition: false, zoom: 1 }
  });
  ok('cartes à cheval sur deux couloirs', attendu === obtenu, premierEcart(attendu, obtenu));

  const em = empriseDesEtapes(p.etapes, rolesCouloirs(p.roles));
  ok('  sens du chevauchement : bas puis haut',
    em[2].cheval === 1 && em[5].cheval === -1,
    JSON.stringify([em[2], em[5]]));
  ok('  les autres étapes ne chevauchent pas',
    em.filter((x) => x.cheval !== 0).length === 2);
  client.processus.pop();
}

/* ==========================================================================
   5. Natures de lien et supports — jamais présents dans les données Sekurit
   ========================================================================== */
{
  const p = JSON.parse(JSON.stringify(client.processus[1]));
  p.etapes[1].lien = 'manuel';
  p.etapes[2].lien = 'auto';
  p.etapes[3].supports = 'Excel, papier, Padoa, BOOST, SharePoint';  // 5 → « +1 »
  p.etapes[4].supports = 'Kronos / Cronos';
  client.processus.push(p);
  O.etat.procId = p.id;

  for (const ed of [false, true]) {
    Object.assign(O.etat, { edition: ed, impression: false, zoom: 1, tableau: false });
    const attendu = O.vueFlux(p);
    const obtenu = baliserFlux({
      processus: p, etapes: p.etapes,
      options: { paletteRoles: O.rolesGlobaux(), outils: client.outils, edition: ed, zoom: 1 }
    });
    ok(`liens et supports (${ed ? 'édition' : 'lecture'})`, attendu === obtenu, premierEcart(attendu, obtenu));
  }
  client.processus.pop();
}

/* ==========================================================================
   6. Frise : libellés codés, écarts déduits, groupes
   ========================================================================== */
Object.assign(O.etat, { edition: false, impression: false, zoom: 1, tableau: false });
{
  const p = JSON.parse(JSON.stringify(client.processus[0]));
  ['J-7', 'J-7', 'J1', 'J1', 'S+2', 'S+2', 'M+3', 'M+3'].forEach((ph, i) => {
    if (p.etapes[i]) p.etapes[i].phase = ph;
  });
  client.processus.push(p);
  O.etat.procId = p.id;
  const attendu = O.vueFlux(p);
  const obtenu = baliserFlux({
    processus: p, etapes: p.etapes,
    options: { paletteRoles: O.rolesGlobaux(), outils: client.outils, edition: false, zoom: 1 }
  });
  ok('frise à libellés codés (J-7 → M+3)', attendu === obtenu, premierEcart(attendu, obtenu));

  const g = groupesDePhase(p.etapes);
  ok('  4 groupes de 2 étapes',
    g.length === 4 && g.every((x) => x.span === 2),
    JSON.stringify(g.map((x) => [x.label, x.span])));
  client.processus.pop();
}

/* ==========================================================================
   7. Fonctions pures, aux limites
   ========================================================================== */
ok('jalon J1 → 1 jour', jalonEnJours('J1') === 1);
ok('jalon S+2 → 14 jours', jalonEnJours('S+2') === 14);
ok('jalon M+3 → 90 jours', jalonEnJours('M+3') === 90);
ok('jalon J sans nombre → 0', jalonEnJours('J') === 0);
ok('libellé libre → aucun jalon', jalonEnJours('Avant J1') === null);
ok('écart 0 → vide', ecartLisible(0, 0) === '');
ok('écart en mois', ecartLisible(0, 90) === '+3 mois');
ok('écart en semaines', ecartLisible(0, 14) === '+2 sem');
ok('écart en jours', ecartLisible(0, 3) === '+3 j');
ok('écart négatif au signe typographique', ecartLisible(10, 8) === '−2 j', ecartLisible(10, 8));
ok('7 jours s\'expriment en semaine', ecartLisible(10, 3) === '−1 sem', ecartLisible(10, 3));
ok('écart indéterminé si un jalon manque', ecartLisible(null, 5) === '');

ok('supports découpés et élagués',
  JSON.stringify(listeSupports(' Excel ,, papier , ')) === JSON.stringify(['Excel', 'papier']));
ok('supports vides → liste vide', listeSupports('').length === 0 && listeSupports(null).length === 0);

ok('Transverse a sa teinte propre',
  JSON.stringify(couleursRole('Transverse', ['RH'])) === JSON.stringify(['#EFEFEF', '#2B2B2B']));
ok('rôle inconnu retombe sur la première teinte',
  JSON.stringify(couleursRole('Inexistant', ['RH', 'EHS'])) === JSON.stringify(PASTELS_0()));
function PASTELS_0() { return ['#D4DEF9', '#2D5BAE']; }

/* La couleur suit l'index dans la palette du CLIENT, pas celle du processus :
   c'est ce qui garde un rôle de la même couleur d'un onglet à l'autre. */
{
  const palette = O.rolesGlobaux();
  const memes = client.processus.every((p) => p.roles.every((r) =>
    JSON.stringify(couleursRole(r, palette))
      === JSON.stringify(couleursRole(r, palette))));
  ok('couleur stable pour un même rôle entre processus', memes);
  const iEHS = palette.indexOf('EHS');
  ok('  teinte tirée de l\'index client', iEHS >= 0
    && JSON.stringify(couleursRole('EHS', palette)) === JSON.stringify(PASTELS[iEHS % PASTELS.length]));
}

ok('couloirs dédoublonnés en gardant l\'index réel',
  JSON.stringify(rolesCouloirs(['RH', 'EHS', 'RH', 'Qualité']))
    === JSON.stringify([{ nom: 'RH', iRole: 0 }, { nom: 'EHS', iRole: 1 }, { nom: 'Qualité', iRole: 3 }]));

/* ==========================================================================
   8. Le moteur ne lit aucune globale
   ========================================================================== */
{
  /* Commentaires retirés d'abord : l'en-tête du moteur cite justement les
     globales dont il s'est débarrassé, et les compter serait absurde. */
  const source = readFileSync(join(ici, 'moteur.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const interdits = ['etat.', 'proc()', 'client()', 'racine', 'document.querySelector(',
                     'localStorage', 'window.'];
  const trouves = interdits.filter((g) => source.includes(g));
  ok('aucune globale de l\'application référencée', trouves.length === 0, trouves.join(', '));
}


console.log(ko ? `\n${ko} ÉCHEC(S)\n` : '\nMOTEUR CONFORME À L\'ORIGINAL — balisage identique au caractère près\n');
process.exit(ko ? 1 : 0);
