/* ============================================================================
   Une étape à cheval sur deux rôles — le critère se mesure
   ============================================================================

   LE CRITÈRE, ET IL EST GÉOMÉTRIQUE : **le centre vertical d'une carte à cheval
   tombe sur la frontière entre ses deux couloirs**. C'est tout le sens du geste
   — « cette étape concerne les deux » — et c'est vérifiable au pixel, sans
   jugement esthétique.

   POURQUOI CE TEST EXISTE. L'utilisateur a signalé le 25/08 qu'il n'arrivait pas
   à mettre une étape entre deux rôles. Le dépôt sur la frontière écrit pourtant
   bien `role` et `role2` — mesuré — et le moteur pose bien la classe
   `flux__carte--cheval`. Ce qui manquait était le PLACEMENT : la carte
   atterrissait ailleurs que sur la frontière, et de plus en plus loin à mesure
   qu'on descendait dans les couloirs.

   La cause : `placerCartesACheval` calcule
       vise  = cellule.offsetHeight - hauteur / 2      (repère de la CELLULE)
       decal = vise - carte.offsetTop                  (repère du .flux)
   `.flux__cellule` ne porte aucun `position`, donc le parent de décalage d'une
   carte est `.flux` tout entier. Les deux longueurs ne vivent pas dans le même
   repère, et l'erreur vaut exactement l'ordonnée du couloir. D'où un premier
   couloir qui marchait — son ordonnée est presque nulle — et tous les autres
   qui ne marchaient pas.

   Le test couvre donc TOUTES les frontières, pas une seule : c'est la seule
   forme qui distingue un placement juste d'un placement juste par accident.

   Prérequis : `npm install --no-save playwright-core`.
   ========================================================================= */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const RACINE = path.join(__dirname, '..');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const ROLES = ['RH', 'EHS', 'Chef de quart', 'Collaborateur'];

let echecs = 0;
const ok = (nom, vrai, detail) => {
  console.log(`  ${vrai ? 'ok ' : 'KO '} ${nom}${vrai || !detail ? '' : `\n        → ${detail}`}`);
  if (!vrai) echecs += 1;
};

(async () => {
  const moteur = fs.readFileSync(path.join(RACINE, 'flux/moteur.js'), 'utf8');
  const css = fs.readFileSync(path.join(RACINE, 'flux/moteur.css'), 'utf8');
  const tokens = fs.readFileSync(path.join(RACINE, 'charte/tokens.css'), 'utf8');

  const nav = await chromium.launch({ executablePath: CHROME });
  const page = await (await nav.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  await page.setContent(`<!doctype html><meta charset=utf8><style>${tokens}\n${css}</style>
    <div id="h" class="carte carte--flux"></div>`);

  console.log('\nétape à cheval — le centre doit tomber sur la frontière\n');

  /* Une mesure par frontière : rôle i sur rôle i+1. Chaque cas est rendu seul,
     pour que la hauteur des couloirs ne dépende pas des autres essais. */
  for (let i = 0; i < ROLES.length - 1; i++) {
    const r = await page.evaluate(async ({ src, haut, bas, roles }) => {
      const M = await import('data:text/javascript;base64,'
        + btoa(unescape(encodeURIComponent(src))));
      const processus = { id: 'x', roles };
      /* Une étape par couloir, pour que tous existent et aient une hauteur ; la
         DEUXIÈME est celle qu'on met à cheval. */
      const etapes = roles.map((role, k) => ({
        id: 'e' + k, ordre: k + 1, role, role2: '', texte: 'étape ' + (k + 1),
        phase: 'P', supports: '', lien: '',
      }));
      const j = roles.indexOf(haut);
      etapes[j].role2 = bas;

      document.getElementById('h').innerHTML = M.baliserFlux({
        processus, etapes,
        options: {
          paletteRoles: roles, edition: true, zoom: 1, enveloppe: false,
          commandes: { texte: true, phases: true, deplacement: true, supports: true },
        },
      });
      const flux = document.querySelector('.flux');
      M.acheverRendu(flux, etapes, { edition: true });

      const f = flux.getBoundingClientRect();
      const rel = (el) => {
        const q = el.getBoundingClientRect();
        return { haut: q.top - f.top, bas: q.bottom - f.top, centre: q.top - f.top + q.height / 2 };
      };
      const couloirs = Array.from(flux.querySelectorAll('.flux__bande')).map(rel);
      const carte = flux.querySelector('.flux__carte--cheval');
      return {
        acheval: Boolean(carte),
        carte: carte ? rel(carte) : null,
        /* La frontière visée : le bas du couloir du haut. */
        frontiere: couloirs[j] ? couloirs[j].bas : null,
        couloirs: couloirs.map((c) => [Math.round(c.haut), Math.round(c.bas)]),
      };
    }, { src: moteur, haut: ROLES[i], bas: ROLES[i + 1], roles: ROLES });

    const nom = `${ROLES[i]} / ${ROLES[i + 1]}`;
    if (!r.acheval) {
      ok(`${nom} · la carte porte la marque « à cheval »`, false, 'aucune carte marquée');
      continue;
    }
    const ecart = Math.abs(r.carte.centre - r.frontiere);
    ok(`${nom} · le centre de la carte tombe sur la frontière`, ecart <= 2,
      `centre à ${Math.round(r.carte.centre)}, frontière à ${Math.round(r.frontiere)}`
      + ` — ${Math.round(ecart)} px d'écart · couloirs ${JSON.stringify(r.couloirs)}`);
  }

  await nav.close();
  console.log(echecs === 0
    ? '\nCHEVAL CONFORME — toute carte à cheval est centrée sur sa frontière\n'
    : `\n${echecs} ÉCHEC(S)\n`);
  process.exit(echecs === 0 ? 0 : 1);
})();
