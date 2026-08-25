/* ============================================================================
   Routage des flèches — le critère mécanique du lot C
   ============================================================================

   UN SEUL CRITÈRE, ET IL SE CALCULE : **aucun tracé ne coupe le rectangle d'une
   carte**. C'est ce qui rend ce sujet vérifiable malgré son apparence
   esthétique — on échantillonne chaque chemin SVG et on teste l'appartenance
   aux boîtes des cartes.

   Deux autres propriétés sont vérifiées ici :

   - **les poignées de retrait tombent hors carte.** Elles étaient posées au
     milieu géométrique du tracé, donc parfois sur une pastille de support :
     illisibles. Elles se placent désormais sur un segment de gouttière ou de
     couloir ;
   - **le pont prend la profondeur la plus faible qui suffit.** Une flèche qui
     saute une seule carte passe juste dessous, pas sous tout le diagramme.

   LES DONNÉES SONT RÉELLES. C'est le processus « Intégration des nouveaux
   collaborateurs » de `sekurit-float-france`, avec la flèche que l'utilisateur
   a tirée à la main (étape 2 → étape 4, par-dessus l'étape 3). C'est ce cas qui
   a produit les deux défauts signalés en capture le 25/08 ; le figer ici est ce
   qui empêche qu'ils reviennent.

   POURQUOI UN SERVEUR HTTP : le moteur est un module ES, et un `import` depuis
   `file://` est refusé par la politique d'origine du navigateur. Trois lignes de
   serveur coûtent moins qu'un moteur transformé pour les besoins d'un test.

   Prérequis : `npm install --no-save playwright-core`. Chromium est déjà présent
   sous `/opt/pw-browsers`.
   ========================================================================= */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const RACINE = path.join(__dirname, '..');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* Le relevé réel, tel qu'il est en base le 25/08/2026. La flèche va de l'étape
   2 (couloir RH) à l'étape 4 (couloir EHS) : elle enjambe donc l'étape 3, qui
   est la carte qu'elle doit contourner. */
const CAS = {
  processus: { id: 'p-test', roles: ['RH', 'EHS', 'Chef de quart / manager', 'Collaborateur'] },
  etapes: [
    { id: 'e1', ordre: 1, role: 'RH', role2: '', texte: 'Budget intérim en Année -1', phase: 'Avant J1', supports: 'Papier, SharePoint', lien: '', colonne_partagee: false },
    { id: 'e2', ordre: 2, role: 'RH', role2: '', texte: "Définition de l'orga cible (DIR)", phase: 'Avant J1', supports: 'Excel', lien: 'auto', colonne_partagee: false },
    { id: 'e3', ordre: 3, role: 'EHS', role2: '', texte: 'Accueil EHS (1 h) : PPT + vidéo + évaluation QCM', phase: 'Avant J1', supports: 'BOOST, SharePoint', lien: 'manuel', colonne_partagee: false },
    { id: 'e4', ordre: 4, role: 'EHS', role2: '', texte: 'Remise des EPI', phase: 'Avant J1', supports: 'Kronos / Cronos', lien: '', colonne_partagee: false },
    { id: 'e5', ordre: 5, role: 'Collaborateur', role2: '', texte: 'Modules BOOST — pas de délai de visionnage', phase: 'J1', supports: '', lien: 'manuel', colonne_partagee: false },
    { id: 'e6', ordre: 6, role: 'RH', role2: '', texte: 'Checklist contractuelle', phase: 'J1', supports: '', lien: '', colonne_partagee: false },
    { id: 'e7', ordre: 7, role: 'Chef de quart / manager', role2: '', texte: 'Accueil EHS au poste, sur papier (risques au poste + bons EPI)', phase: 'J1', supports: '', lien: '', colonne_partagee: false },
    { id: 'e8', ordre: 8, role: 'Collaborateur', role2: '', texte: "Journée d'intégration (dernière édition fin 2021 avec l'école SG) — beaucoup de personnes en même temps", phase: 'Après J1', supports: '', lien: '', colonne_partagee: false },
  ],
  fleches: [
    { id: 'f1', de_id: 'e2', vers_id: 'e4', nature: '', masquee: false, decalage: null },
  ],
};

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/charte/tokens.css"><link rel="stylesheet" href="/flux/moteur.css">
<style>body{margin:0;font-family:sans-serif;font-size:15px}</style>
</head><body><div id="hote"></div>
<script type="module">
import * as M from '/flux/moteur.js';
window.rendre = (arg, edition) => {
  const sup = edition
    ? { edition: true, commandes: { fleches: true, etapes: true, phases: true, roles: true,
        supports: true, deplacement: true, colonnes: true, tableau: true } }
    : {};
  const opts = { fleches: arg.fleches, ...sup };
  const h = document.getElementById('hote');
  h.innerHTML = M.baliserFlux({ processus: arg.processus, etapes: arg.etapes, options: opts });
  const flux = h.querySelector('.flux');
  M.acheverRendu(flux, arg.etapes, opts);
  const f = flux.getBoundingClientRect();
  const rel = (r) => ({ x: r.left - f.left, y: r.top - f.top, l: r.width, h: r.height });
  const traces = Array.from(flux.querySelectorAll('.flux-svg:not(.flux-svg--cibles) > path[d]'));
  return {
    hauteur: flux.offsetHeight,
    cartes: Array.from(flux.querySelectorAll('[data-etape]')).map((c) => rel(c.getBoundingClientRect())),
    puces: Array.from(flux.querySelectorAll('.fleche-retirer')).map((p) => {
      const r = p.getBoundingClientRect();
      return [r.left - f.left + r.width / 2, r.top - f.top + r.height / 2];
    }),
    ds: traces.map((p) => p.getAttribute('d')),
    /* 400 points par tracé : au pas du pixel sur nos longueurs, donc un segment
       ne peut pas traverser une carte entre deux échantillons. */
    pts: traces.map((p) => {
      const L = p.getTotalLength(); const out = [];
      for (let i = 0; i <= 400; i++) { const q = p.getPointAtLength(L * i / 400); out.push([q.x, q.y]); }
      return out;
    }),
  };
};
window.pret = true;
</script></body></html>`;

let echecs = 0;
const ok = (nom, vrai, detail) => {
  console.log(`  ${vrai ? 'ok ' : 'KO '} ${nom}${vrai || !detail ? '' : `\n        → ${detail}`}`);
  if (!vrai) echecs += 1;
};

const dedans = (p, c) => p[0] > c.x && p[0] < c.x + c.l && p[1] > c.y && p[1] < c.y + c.h;

(async () => {
  const serveur = http.createServer((req, rep) => {
    const url = req.url.split('?')[0];
    if (url === '/page.html') { rep.writeHead(200, { 'Content-Type': 'text/html' }); return rep.end(PAGE); }
    const fichier = path.join(RACINE, url);
    if (!fichier.startsWith(RACINE) || !fs.existsSync(fichier)) { rep.writeHead(404); return rep.end(); }
    const type = url.endsWith('.css') ? 'text/css' : 'text/javascript';
    rep.writeHead(200, { 'Content-Type': type });
    rep.end(fs.readFileSync(fichier));
  });
  await new Promise((r) => serveur.listen(8766, r));

  const nav = await chromium.launch({ executablePath: CHROME });
  const page = await nav.newPage({ viewport: { width: 1600, height: 1200 } });
  await page.goto('http://127.0.0.1:8766/page.html');
  await page.waitForFunction(() => window.pret);

  console.log("\nrelevé réel · Sekurit — intégration des nouveaux collaborateurs\n");

  for (const edition of [false, true]) {
    const r = await page.evaluate(([a, e]) => window.rendre(a, e), [CAS, edition]);
    const mode = edition ? 'édition' : 'lecture';

    let coupes = 0;
    r.pts.forEach((tr) => { coupes += tr.filter((p) => r.cartes.some((c) => dedans(p, c))).length; });
    ok(`${mode} · aucun tracé ne coupe une carte`, coupes === 0, `${coupes} point(s) dans une carte`);

    if (edition) {
      const dehors = r.puces.filter((p) => !r.cartes.some((c) => dedans(p, c))).length;
      ok(`${mode} · poignées de retrait hors carte`, r.puces.length > 0 && dehors === r.puces.length,
        `${r.puces.length - dehors} poignée(s) sur ${r.puces.length} dans une carte`);
    }

    /* DÉTERMINISME : deux rendus des mêmes données donnent les mêmes chemins.
       Sans lui, deux captures d'écran d'une même restitution ne coïncident
       plus, et le PDF d'hier ne ressemble plus à celui d'aujourd'hui. */
    const r2 = await page.evaluate(([a, e]) => window.rendre(a, e), [CAS, edition]);
    ok(`${mode} · deux rendus, mêmes tracés`, JSON.stringify(r.ds) === JSON.stringify(r2.ds));

    if (!edition) {
      /* LA PROFONDEUR DU PONT. La flèche manuelle enjambe l'étape 3 : elle doit
         passer JUSTE sous cette carte, pas sous tout le diagramme. Le défaut
         signalé en capture le 25/08 la faisait descendre au bas de la grille.

         Le tracé du pont est le DERNIER : `flechesEffectives` sort d'abord les
         flèches calculées, puis les dessinées. Et la carte à franchir est la
         plus basse de celles que le pont surplombe — la chercher plutôt que la
         désigner par son index, l'ordre du DOM étant celui des couloirs et non
         celui des étapes. */
      const pontPts = r.pts[r.pts.length - 1];
      const pont = Math.max(...pontPts.map((p) => p[1]));
      const x0 = Math.min(...pontPts.map((p) => p[0]));
      const x1 = Math.max(...pontPts.map((p) => p[0]));
      const surplombees = r.cartes.filter((c) => c.x + c.l > x0 && c.x < x1);
      const aFranchir = Math.max(...surplombees.map((c) => c.y + c.h));
      ok('le pont passe juste sous la carte enjambée, pas sous le diagramme',
        pont > aFranchir && pont < aFranchir + 40 && pont < r.hauteur * 0.6,
        `pont à ${Math.round(pont)}, carte enjambée finit à ${Math.round(aFranchir)}, diagramme à ${r.hauteur}`);
    }
  }

  await nav.close();
  await new Promise((r) => serveur.close(r));

  console.log(echecs === 0
    ? '\nROUTAGE CONFORME — aucun tracé ne coupe une carte, poignées atteignables\n'
    : `\n${echecs} ÉCHEC(S)\n`);
  process.exit(echecs === 0 ? 0 : 1);
})();
