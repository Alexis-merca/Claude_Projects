/* ============================================================================
   `zoom` ET `transform` N'ENTRENT PAS DANS `offsetWidth`.

   Ce fait de navigateur porte tout le corps du texte de l'export PPTX. La
   transcription (`src/lib/pptx-transcription.ts`, fonction `echelleVue`) ne
   remonte pas la chaîne des transformations : elle déduit l'échelle réellement
   subie par un élément du rapport entre sa largeur VUE et sa largeur de mise en
   page —

       echelle = rect.width / offsetWidth

   — puis multiplie le `font-size` calculé par ce rapport, parce que
   `getComputedStyle().fontSize` est rendu dans le repère PROPRE de l'élément,
   avant les transformations de ses ancêtres.

   La vue d'impression empile DEUX mises à l'échelle de natures différentes :
   `transform: scale()` sur la toile (`[data-toile]`, posée par `Page`) et
   `zoom` sur le diagramme (`.flux`, posé par `CarteFlux`). Si l'une des deux
   entrait dans `offsetWidth`, le rapport ne vaudrait plus le produit des
   échelles et le texte des cartes partirait à la mauvaise taille dans le deck —
   d'un facteur 1/0,65, soit +54 %, sur le cas mesuré ici.

   POURQUOI UN TEST ET PAS UN COMMENTAIRE : `zoom` a longtemps été une extension
   propriétaire, il est devenu une propriété standardisée, et son interaction
   avec les métriques de mise en page a déjà changé. Ce n'est pas une loi, c'est
   un comportement de version. Le jour où il changera, cette suite le dira au
   lieu de laisser un deck partir chez un client avec un texte hors de ses
   cartes.

   Usage :  node flux/echelle-vue.test.cjs
   ========================================================================= */

const { chromium } = require('playwright-core');

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* Les valeurs de la vue d'impression, pas des nombres ronds : une carte du
   moteur fait 241 px, le texte d'étape 15 px, et les deux échelles sont dans
   l'ordre de grandeur que produisent `Page` et `CarteFlux` sur un processus
   large. */
const CARTE = 241;
const TOILE = 0.72;
const FLUX = 0.65;

let ko = 0;
const ok = (nom, cond, detail) => {
  console.log((cond ? '  ok  ' : '  KO  ') + nom + '\n        · ' + detail);
  if (!cond) ko++;
};

(async () => {
  const nav = await chromium.launch({ executablePath: CHROME });
  const page = await nav.newPage();
  console.log('\nnavigateur : Chromium ' + (await nav.version()));

  await page.setContent(`<!doctype html><meta charset=utf8>
    <style>
      body { margin: 0 }
      .toile { transform: scale(${TOILE}); transform-origin: top left; width: 1600px }
      .flux  { zoom: ${FLUX} }
      .carte, .zoom-seul, .transform-seul { width: ${CARTE}px; font-size: 15px }
      .zoom-seul { zoom: ${FLUX} }
      .transform-seul { transform: scale(${TOILE}); transform-origin: top left }
    </style>
    <div class="toile"><div class="flux"><div class="carte" id="deux">x</div></div></div>
    <div class="zoom-seul" id="z">x</div>
    <div class="transform-seul" id="t">x</div>`);

  const mesures = await page.evaluate(() => {
    const lire = (id) => {
      const el = document.getElementById(id);
      const r = el.getBoundingClientRect();
      return {
        offsetWidth: el.offsetWidth,
        vue: Number(r.width.toFixed(3)),
        rapport: Number((r.width / el.offsetWidth).toFixed(4)),
        corps: getComputedStyle(el).fontSize,
      };
    };
    return { deux: lire('deux'), zoom: lire('z'), transform: lire('t') };
  });

  const cas = [
    ['transform seul', mesures.transform, TOILE],
    ['zoom seul', mesures.zoom, FLUX],
    ['les deux empilés', mesures.deux, TOILE * FLUX],
  ];
  for (const [nom, m, attendu] of cas) {
    ok(
      `${nom} : le rapport vaut l'échelle`,
      Math.abs(m.rapport - attendu) < 0.002,
      `offsetWidth=${m.offsetWidth}  vue=${m.vue}  rapport=${m.rapport}  attendu=${attendu.toFixed(4)}`,
    );
  }

  /* Le pendant du rapport : si le corps calculé suivait déjà l'échelle, le
     multiplier une seconde fois le doublerait. */
  const corps = [mesures.deux.corps, mesures.zoom.corps, mesures.transform.corps];
  ok(
    'le `font-size` calculé ignore les deux échelles',
    corps.every((c) => c === '15px'),
    corps.join(' / ') + '  (attendu 15px partout)',
  );

  await nav.close();
  console.log(
    ko
      ? `\n${ko} ÉCHEC(S) — la formule d'échelle de la transcription PPTX est fausse\n`
      : "\nÉCHELLE VUE CONFORME — `rect.width / offsetWidth` donne bien l'échelle cumulée\n",
  );
  process.exit(ko ? 1 : 0);
})();
