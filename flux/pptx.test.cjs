/* ============================================================================
   LA TRANSCRIPTION PPTX, EXERCÉE POUR DE BON.

   L'export PowerPoint est ce qui part chez le client. Il n'est pourtant
   vérifiable nulle part : la vue d'impression vit sous `_authenticated`, et
   personne — ni l'agent, ni moi — ne peut l'ouvrir. Cette suite contourne le
   mur au lieu d'attendre qu'il tombe.

   CE QUI EST AUTHENTIQUE ICI : le diagramme. Il est produit par le VRAI moteur
   (`flux/moteur.js`), avec le vrai `moteur.css`, sur les vraies données du
   mono-fichier — mêmes cartes, mêmes couloirs, mêmes flèches, même géométrie.
   Et la transcription exercée est la COPIE CONFORME de celle de l'application
   (`flux/pptx-transcription.ts`).

   CE QUI EST RECONSTITUÉ, ET QU'IL FAUT LIRE COMME TEL : l'habillage de la page
   — en-tête, logo, pied de page, colonne d'annexes, tableau de trajectoire.
   Il reproduit la STRUCTURE de `impression.$code.tsx` (les deux mises à
   l'échelle imbriquées, le filet du pied, la grille 80/20) sans en être le
   code. Un défaut propre aux composants React de la page échapperait donc à
   cette suite.

   À LA PLACE DE pptxgenjs : un ENREGISTREUR. On ne fabrique pas de fichier, on
   note chaque `addShape` / `addText` / `addTable` / `addImage` avec ses
   arguments. C'est plus sévère qu'ouvrir le .pptx : on voit ce qui a été
   demandé, y compris ce qui ne s'y serait pas vu.

   CE QUE LA SUITE ÉTABLIT :
     1. chaque carte du diagramme a sa forme, à sa place mesurée ;
     2. AUCUN TEXTE VISIBLE À L'ÉCRAN NE DISPARAÎT du deck — c'est le compteur
        d'éléments perdus que le lot n'a pas livré, reconstruit ici de
        l'extérieur ;
     3. aucun marqueur `**` ni `_` ne survit dans un run ;
     4. le gras posé par le consultant arrive en `bold: true` ;
     5. les seules images sont des SVG, une par SVG, et rien d'autre ;
     6. un filet n'est pas un cadre — un `border-top` seul ne dessine pas de
        boîte autour du texte.

   Usage :  node flux/pptx.test.cjs
   ========================================================================= */

const { chromium } = require('playwright-core');
const { execFileSync } = require('child_process');
const fs = require('fs');

const RACINE = '/home/user/Claude_Projects';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* Les deux échelles de la vue d'impression : `Page` réduit la toile,
   `CarteFlux` zoome le flux. C'est leur empilement qui rend la transcription
   difficile, et c'est donc ainsi qu'il faut l'exercer. */
const TOILE = 0.72;
const ZOOM_FLUX = 0.65;

let ko = 0;
const ok = (nom, cond, detail = '') => {
  console.log((cond ? '  ok  ' : '  KO  ') + nom + (cond ? '' : '\n        → ' + detail));
  if (!cond) ko++;
};
const mesure = (quoi, valeur) => console.log('        · ' + quoi + ' : ' + valeur);

const TRANSCRIPTION = execFileSync(
  `${RACINE}/node_modules/.bin/esbuild`,
  [`${RACINE}/flux/pptx-transcription.ts`, '--format=esm'],
  { encoding: 'utf8' },
);

(async () => {
  const nav = await chromium.launch({ executablePath: CHROME });
  const ctx = await nav.newContext({ viewport: { width: 1600, height: 1000 } });
  await ctx.route('**/*', (r) =>
    /fonts\.googleapis|fonts\.gstatic|fontshare/.test(r.request().url()) ? r.abort() : r.continue(),
  );

  /* --- les vraies données, prises au mono-fichier ------------------------- */
  const source = await ctx.newPage();
  await source.goto(`file://${RACINE}/diagnostic-os.html`, { waitUntil: 'load' });
  await source.waitForTimeout(1200);
  const donnees = await source.evaluate(() => {
    const c = etat.base[0];
    const p = c.processus.find((x) => x.etapes.length >= 8) ?? c.processus[0];
    return { p, etapes: p.etapes, palette: rolesGlobaux(), outils: c.outils, client: c.nom };
  });
  await source.close();

  /* Une étape porte du gras et de l'italique — comme en base aujourd'hui. */
  const etapes = donnees.etapes.map((e, i) =>
    i === 0 ? { ...e, texte: '**Budget intérim en Ann**_ée -1_' } : e,
  );

  const moteur = fs.readFileSync(`${RACINE}/flux/moteur.js`, 'utf8');
  const css = fs.readFileSync(`${RACINE}/flux/moteur.css`, 'utf8');

  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('        (console) ' + m.text());
  });
  await page.setContent(`<!doctype html><meta charset=utf8><style>
    ${css}
    body { margin: 0; font-family: system-ui, sans-serif }
    .page-16-9 { width: 1280px; height: 720px; overflow: hidden; background: #fff;
                 position: relative; box-sizing: border-box; padding: 28px 40px;
                 display: flex; flex-direction: column }
    .tete { display: flex; align-items: flex-end; justify-content: space-between;
            border-bottom: 1px solid #E6E6E6; padding-bottom: 12px }
    .tete h2 { font: 600 24px/1.2 system-ui; color: #2B2B2B; margin: 0 }
    .tete p  { font: 400 13px/1.4 system-ui; color: #6B6B6B; margin: 4px 0 0 }
    /* Le pied ne porte QU'UN filet haut : c'est le cas qui distingue un filet
       d'un cadre, et le défaut que l'agent dit avoir corrigé. */
    .pied { border-top: 1px solid #E6E6E6; padding-top: 8px;
            font: 400 11px/1.4 system-ui; color: #6B6B6B }
    .zone { position: relative; flex: 1; min-height: 0; overflow: hidden; padding-top: 12px }
    .toile { position: absolute; left: 0; top: 12px; width: 1600px;
             transform: scale(${TOILE}); transform-origin: top left }
    .grille { display: grid; grid-template-columns: 1fr 340px; gap: 20px; align-items: start }
    .annexes { display: grid; gap: 14px }
    .annexe { border: 1px solid #E6E6E6; border-radius: 8px; padding: 10px;
              font: 400 15px/1.4 system-ui; color: #2B2B2B }
    .annexe h3 { font: 600 13px/1.4 system-ui; margin: 0 0 6px; color: #6B6B6B }
    table { width: 100%; border-collapse: collapse; font: 400 16px/1.4 system-ui }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #E6E6E6 }
  </style>
  <section class="page-16-9" id="page">
    <header class="tete">
      <div><h2 id="titre">Planification</h2><p id="stitre">Maturité 2/5 — pilotage au tableur</p></div>
      <svg id="logo" viewBox="0 0 80 48" width="60" height="36" role="img">
        <path d="M 31 4 L 1 35 L 49 35 Z" fill="rgb(103,51,253)"/>
      </svg>
    </header>
    <div class="zone">
      <div class="toile">
        <div class="grille">
          <div class="colonne-flux" id="hote"></div>
          <div class="annexes">
            <div class="annexe"><h3>Frictions</h3><span id="friction">Ressaisie du planning dans deux outils</span></div>
            <div class="annexe"><h3>Chiffres clés</h3><span>3 h par semaine perdues</span></div>
          </div>
        </div>
      </div>
    </div>
    <footer class="pied" id="pied">${donnees.client} · Planification — page 1</footer>
  </section>`);

  await page.evaluate(
    async ({ src, p, etapes, palette, outils, zoom }) => {
      const M = await import('data:text/javascript;base64,' + btoa(unescape(encodeURIComponent(src))));
      const hote = document.getElementById('hote');
      hote.innerHTML = M.baliserFlux({
        processus: p,
        etapes,
        options: { paletteRoles: palette, outils, edition: false, zoom: 1, enveloppe: false },
      });
      const flux = document.querySelector('.flux');
      flux.style.zoom = String(zoom);
      M.acheverRendu(flux, etapes, { edition: false });
    },
    { src: moteur, p: donnees.p, etapes, palette: donnees.palette, outils: donnees.outils, zoom: ZOOM_FLUX },
  );
  await page.waitForTimeout(400);

  /* --- l'enregistreur, à la place de pptxgenjs ---------------------------- */
  const releve = await page.evaluate(async (src) => {
    const T = await import('data:text/javascript;base64,' + btoa(unescape(encodeURIComponent(src))));
    const journal = { shapes: [], texts: [], tables: [], images: [] };
    const slide = {
      addShape: (forme, o) => journal.shapes.push({ forme, ...o }),
      addText: (runs, o) => journal.texts.push({ runs, ...o }),
      addTable: (rows, o) => journal.tables.push({ rows, ...o }),
      addImage: (o) => journal.images.push(o),
    };
    const page = document.getElementById('page');
    await T.transcrirePage({}, slide, page);

    const cadre = page.getBoundingClientRect();
    const versPouces = 10 / cadre.width;

    /* Les cartes telles que le NAVIGATEUR les a posées : la référence. */
    const cartes = [...page.querySelectorAll('.flux__carte')].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        etape: el.dataset.etape,
        cx: (r.left + r.width / 2 - cadre.left) * versPouces,
        cy: (r.top + r.height / 2 - cadre.top) * versPouces,
        texte: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      };
    });

    /* TOUT LE TEXTE VISIBLE de la page, feuille par feuille : le compteur de
       perte que le lot n'a pas livré. Un nœud texte non vide, dans un élément
       visible et non ignoré, DOIT se retrouver dans un run. */
    const attendus = [];
    const promeneur = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
    for (let n = promeneur.nextNode(); n; n = promeneur.nextNode()) {
      const t = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
      if (!t) continue;
      const parent = n.parentElement;
      if (!parent || parent.closest('.ne-pas-imprimer, script, style, noscript')) continue;
      if (parent.closest('svg')) continue; /* part en image, par la règle */
      const st = getComputedStyle(parent);
      if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) < 0.05) continue;
      const r = parent.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (r.right <= cadre.left || r.left >= cadre.right || r.bottom <= cadre.top || r.top >= cadre.bottom) continue;
      attendus.push(t);
    }

    const svgs = [...page.querySelectorAll('svg')].length;
    const piedRect = document.getElementById('pied').getBoundingClientRect();
    return { journal, cartes, attendus, svgs, versPouces, cadre: { l: cadre.width, h: cadre.height },
             pied: { x: (piedRect.left - cadre.left) * versPouces, y: (piedRect.top - cadre.top) * versPouces,
                     w: piedRect.width * versPouces, h: piedRect.height * versPouces } };
  }, TRANSCRIPTION);

  const J = releve.journal;
  console.log(`\ndonnées : ${donnees.client} · ${donnees.p.id} — ${etapes.length} étapes, ${releve.cartes.length} cartes`);
  console.log(`relevé  : ${J.shapes.length} formes, ${J.texts.length} zones de texte, `
    + `${J.tables.length} tableaux, ${J.images.length} images\n`);

  /* --- 1. chaque carte a sa forme, à sa place ----------------------------- */
  const centres = J.shapes.map((s) => ({ cx: s.x + s.w / 2, cy: s.y + s.h / 2 }));
  const enPx = 1 / releve.versPouces;
  let pire = 0;
  let manquantes = 0;
  for (const c of releve.cartes) {
    let d = Infinity;
    for (const s of centres) d = Math.min(d, Math.hypot(s.cx - c.cx, s.cy - c.cy));
    if (!Number.isFinite(d)) { manquantes++; continue; }
    pire = Math.max(pire, d * enPx);
  }
  mesure('écart MAXIMUM entre centre de forme et centre de carte', `${pire.toFixed(2)} px`);
  ok('chaque carte du diagramme a une forme à sa place (< 2 px)',
    manquantes === 0 && pire < 2, `${manquantes} carte(s) sans forme, écart max ${pire.toFixed(2)} px`);

  /* --- 2. aucun texte visible ne disparaît -------------------------------- */
  const tousRuns = [
    ...J.texts.flatMap((t) => t.runs.map((r) => r.text || '')),
    ...J.tables.flatMap((t) => t.rows.flat().flatMap((c) => (c.text || []).map((r) => r.text || ''))),
  ];
  const paille = tousRuns.join('  ').replace(/\s+/g, ' ');
  const perdus = releve.attendus.filter((t) => !paille.includes(t));
  mesure('fragments de texte visibles à l\'écran', String(releve.attendus.length));
  mesure('fragments retrouvés dans le deck', String(releve.attendus.length - perdus.length));
  ok('AUCUN texte visible ne disparaît du deck', perdus.length === 0,
    perdus.slice(0, 8).map((t) => JSON.stringify(t)).join('\n          → ')
      + (perdus.length > 8 ? `\n          → … et ${perdus.length - 8} autre(s)` : ''));

  /* --- 3. aucun marqueur ne survit ---------------------------------------- */
  const avecMarqueurs = tousRuns.filter((t) => /\*\*|__/.test(t));
  ok('aucun `**` ni `__` dans un run', avecMarqueurs.length === 0,
    avecMarqueurs.map((t) => JSON.stringify(t)).join(', '));

  /* --- 4. le gras du consultant arrive ------------------------------------ */
  const gras = tousRuns.length && J.texts.some((t) => t.runs.some((r) => r.options?.bold && /Budget/.test(r.text || '')));
  const ital = J.texts.some((t) => t.runs.some((r) => r.options?.italic && /ée -1/.test(r.text || '')));
  const runsCarte = J.texts.find((t) => t.runs.some((r) => /Budget/.test(r.text || '')));
  mesure('runs de la carte mise en forme',
    runsCarte ? JSON.stringify(runsCarte.runs.map((r) => [r.text, r.options?.bold ? 'G' : '', r.options?.italic ? 'I' : ''])) : '(aucun)');
  ok('le gras posé par le consultant arrive en `bold: true`', Boolean(gras), 'aucun run gras portant « Budget »');
  ok('l\'italique arrive en `italic: true`', Boolean(ital), 'aucun run italique portant « ée -1 »');

  /* --- 5. les seules images sont des SVG ---------------------------------- */
  mesure('éléments <svg> dans la page', String(releve.svgs));
  ok('une image par SVG, et rien d\'autre', J.images.length === releve.svgs,
    `${J.images.length} image(s) pour ${releve.svgs} SVG`);
  ok('toutes les images sont des PNG produits par la transcription',
    J.images.every((i) => typeof i.data === 'string' && i.data.startsWith('data:image/png')),
    J.images.map((i) => String(i.data).slice(0, 24)).join(', '));

  /* --- 6. un filet n'est pas un cadre ------------------------------------- */
  const pres = (a, b) => Math.abs(a - b) < 0.02;
  const filet = J.shapes.find((s) => s.forme === 'line' && pres(s.y, releve.pied.y) && pres(s.x, releve.pied.x));
  const boiteAutourDuPied = J.shapes.find(
    (s) => s.forme !== 'line' && pres(s.y, releve.pied.y) && pres(s.h, releve.pied.h) && s.line && s.line.type !== 'none',
  );
  ok('le filet haut du pied de page devient une ligne', Boolean(filet),
    'aucune forme `line` au bord haut du pied');
  ok('et NE dessine PAS de cadre autour du texte', !boiteAutourDuPied,
    boiteAutourDuPied ? JSON.stringify(boiteAutourDuPied) : '');

  await nav.close();
  console.log(ko ? `\n${ko} ÉCHEC(S)\n`
    : '\nTRANSCRIPTION CONFORME — cartes en place, aucun texte perdu, aucun marqueur, images SVG seules\n');
  process.exit(ko ? 1 : 0);
})();
