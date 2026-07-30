/* ============================================================================
   Est-ce que les interactions ATTEIGNENT quelque chose ?
   ============================================================================

   Les bancs existants comparent du balisage (`moteur.test.mjs`) et de la
   géométrie (`geometrie.test.cjs`). Aucun des deux n'aurait vu les défauts
   remontés en recette : un balisage juste et des flèches au bon endroit ne
   prouvent pas qu'un clic ou une saisie déclenche une écriture. Celui-ci
   monte le vrai composant et vérifie la chaîne entière — évènement du DOM,
   gestionnaire, mutation émise.

   Il contient aussi le diagnostic qui justifie le câblage retenu. React
   reconstruit le chemin de propagation à partir de la fibre la plus proche de
   la cible ; un nœud injecté par `dangerouslySetInnerHTML` n'en a pas, c'est
   donc celle de l'hôte qui sert. Le clic s'en accommode. `change` non : son
   greffon exige que la cible ELLE-MÊME porte une fibre et un suivi de valeur,
   et sans cela il abandonne SANS RIEN SIGNALER. D'où la ligne attendue
   « React onChange : muet » — ce n'est pas un défaut qu'on subit, c'est le
   fait qui interdit `onChange` ici et impose des écouteurs natifs.

   Préparation (une fois) :
     npm install react@18 react-dom@18 esbuild playwright-core
   puis, si ces paquets ne sont pas à la racine du dépôt :
     MODULES=/chemin/vers/node_modules node flux/react-evenements.test.cjs
   ========================================================================= */

const fs = require('fs');
const os = require('os');
const path = require('path');

const DEPOT = path.resolve(__dirname, '..');
const MODULES = process.env.MODULES || path.join(DEPOT, 'node_modules');
const NAVIGATEUR = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

for (const p of ['react', 'react-dom', 'esbuild', 'playwright-core']) {
  if (!fs.existsSync(path.join(MODULES, p))) {
    console.error(`  Paquet manquant : ${p} sous ${MODULES}\n` +
                  `  npm install react@18 react-dom@18 esbuild playwright-core\n` +
                  `  puis MODULES=<…>/node_modules node flux/react-evenements.test.cjs`);
    process.exit(2);
  }
}

const { chromium } = require(path.join(MODULES, 'playwright-core'));
const esbuild = require(path.join(MODULES, 'esbuild'));

/* ---------------------------------------------------------------------------
   Le composant, compilé pour de bon
   ------------------------------------------------------------------------- */

/* Un point d'entrée dédié : React, ReactDOM et le composant doivent partager
   la MÊME instance de React, sinon les crochets ne s'exécutent pas. */
const ENTREE = `
import { createRoot } from "react-dom/client";
import { DiagrammeFlux } from ${JSON.stringify(path.join(__dirname, 'DiagrammeFlux.tsx'))};

window.__mutations = [];

window.monter = (el, props) => {
  createRoot(el).render(
    <DiagrammeFlux {...props} onMutation={(m) => window.__mutations.push(m)} />
  );
};
`;

const atelier = fs.mkdtempSync(path.join(os.tmpdir(), 'flux-react-'));
const entree = path.join(atelier, 'entree.tsx');
fs.writeFileSync(entree, ENTREE);

esbuild.buildSync({
  entryPoints: [entree],
  bundle: true,
  format: 'iife',
  jsx: 'automatic',
  outfile: path.join(atelier, 'paquet.js'),
  loader: { '.css': 'css' },
  define: { 'process.env.NODE_ENV': '"development"' },
  nodePaths: [MODULES],
  logLevel: 'silent',
});

const paquet = fs.readFileSync(path.join(atelier, 'paquet.js'), 'utf8');
const styles = fs.readFileSync(path.join(atelier, 'paquet.css'), 'utf8');

const react = fs.readFileSync(path.join(MODULES, 'react/umd/react.development.js'), 'utf8');
const reactDom = fs.readFileSync(path.join(MODULES, 'react-dom/umd/react-dom.development.js'), 'utf8');

/* ------------------------------------------------------------------------- */

let echecs = 0;
const ok = (nom, condition, detail) => {
  if (!condition) echecs++;
  console.log((condition ? '  ok  ' : '  KO  ') + nom +
              (condition ? '' : '  → ' + JSON.stringify(detail)));
};

(async () => {
  const nav = await chromium.launch({ executablePath: NAVIGATEUR });
  const page = await (await nav.newContext({ viewport: { width: 1400, height: 900 } })).newPage();

  /* ==== 1. Le composant réel ============================================= */

  await page.setContent(
    `<!doctype html><meta charset=utf8><style>${styles}</style><div id="racine"></div>`
  );
  await page.addScriptTag({ content: paquet });

  const vrai = await page.evaluate(async () => {
    const etapes = [
      { id: 'e1', ordre: 1, role: 'RH',   texte: 'saisir la demande', supports: 'Excel' },
      { id: 'e2', ordre: 2, role: 'EHS',  texte: 'valider' },
      { id: 'e3', ordre: 3, role: 'Chef', texte: 'planifier' },
    ];
    window.monter(document.getElementById('racine'), {
      processus: { id: 'p1', roles: ['RH', 'EHS', 'Chef'] },
      etapes,
      outils: ['Excel', 'Papier', 'SAP'],
      edition: true,
      entete: false,
    });

    /* Rendu, puis effets : les écouteurs sont posés dans un `useEffect`. */
    await new Promise((r) => setTimeout(r, 120));

    const prises = () => window.__mutations.splice(0);
    const resultat = {};

    /* --- sélection d'un support : le défaut signalé en recette ----------- */
    const sel = document.querySelector('.carte__support-choix');
    resultat.selecteurPresent = !!sel;
    if (sel) {
      sel.value = 'SAP';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      resultat.support = prises();
      resultat.selecteurRemisAZero = sel.value;
    }

    /* --- saisie du texte d'une carte : même cause, pas encore rencontrée - */
    const zone = document.querySelector('[data-champ="etape.1.texte"]');
    resultat.zonePresente = !!zone;
    if (zone) {
      zone.value = 'valider et signer';
      zone.dispatchEvent(new Event('change', { bubbles: true }));
      resultat.texte = prises();
    }

    /* --- clic sur une flèche : marchait déjà, ne doit pas régresser ------ */
    const fleche = document.querySelector('[data-action="basculer-lien"]');
    resultat.flechePresente = !!fleche;
    if (fleche) {
      fleche.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      resultat.lien = prises();
    }

    /* --- retrait d'un support -------------------------------------------- */
    const retirer = document.querySelector('[data-action="supprimer-support"]');
    if (retirer) {
      retirer.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      resultat.retrait = prises();
    }
    return resultat;
  });

  console.log("\n  Le composant réel, monté, en mode édition\n");
  ok('sélecteur de support rendu', vrai.selecteurPresent, vrai);
  ok('choisir un support émet une écriture',
     vrai.support?.length === 1, vrai.support);
  ok('   … sur la bonne étape, supports cumulés',
     JSON.stringify(vrai.support?.[0]?.ecritures) ===
     JSON.stringify([{ id: 'e1', champs: { supports: 'Excel, SAP' } }]),
     vrai.support?.[0]?.ecritures);
  ok('   … et le sélecteur revient à vide',
     vrai.selecteurRemisAZero === '', vrai.selecteurRemisAZero);

  ok('zone de saisie du texte rendue', vrai.zonePresente, vrai);
  ok('modifier le texte d\'une carte émet une écriture',
     JSON.stringify(vrai.texte?.[0]?.ecritures) ===
     JSON.stringify([{ id: 'e2', champs: { texte: 'valider et signer' } }]),
     vrai.texte);

  ok('clic sur une flèche émet une écriture (non régression)',
     vrai.lien?.length === 1, vrai.lien);
  ok('retirer un support émet une écriture (non régression)',
     JSON.stringify(vrai.retrait?.[0]?.ecritures) ===
     JSON.stringify([{ id: 'e1', champs: { supports: '' } }]),
     vrai.retrait);

  /* ==== 2. Le diagnostic : pourquoi pas `onChange` ======================== */

  await page.setContent('<!doctype html><meta charset=utf8><div id="racine"></div>');
  await page.addScriptTag({ content: react });
  await page.addScriptTag({ content: reactDom });

  const compare = await page.evaluate(() => {
    const h = React.createElement;
    const HTML =
      '<div><button data-action="x">flèche</button>' +
      '<select data-champ="s"><option value=""></option><option value="Excel">Excel</option></select>' +
      '<textarea data-champ="t"></textarea></div>';
    const journal = [];

    function ParReact() {
      return h('div', {
        ref: (n) => { window.hoteReact = n; },
        onClick: () => journal.push('click'),
        onChange: () => journal.push('change'),
        dangerouslySetInnerHTML: { __html: HTML },
      });
    }
    function ParEcouteurs() {
      const hote = React.useRef(null);
      React.useEffect(() => {
        const n = hote.current;
        const c = () => journal.push('click');
        const g = () => journal.push('change');
        n.addEventListener('click', c);
        n.addEventListener('change', g);
        return () => { n.removeEventListener('click', c); n.removeEventListener('change', g); };
      }, []);
      return h('div', {
        ref: (n) => { hote.current = n; window.hoteNatif = n; },
        dangerouslySetInnerHTML: { __html: HTML },
      });
    }

    ReactDOM.createRoot(document.getElementById('racine'))
      .render(h('div', null, h(ParReact), h(ParEcouteurs)));

    return new Promise((resolve) => setTimeout(() => {
      const mesurer = (hote) => {
        const tirer = (el, ev) => { journal.length = 0; el.dispatchEvent(ev); return journal.slice(); };
        const sel = hote.querySelector('select');
        const zone = hote.querySelector('textarea');
        sel.value = 'Excel';
        zone.value = 'x';
        return {
          clic: tirer(hote.querySelector('button'), new MouseEvent('click', { bubbles: true })),
          select: tirer(sel, new Event('change', { bubbles: true })),
          zone: tirer(zone, new Event('change', { bubbles: true })),
        };
      };
      resolve({ react: mesurer(window.hoteReact), natif: mesurer(window.hoteNatif) });
    }, 60));
  });

  console.log('\n  Le diagnostic — ce que React fait, et ne fait pas, sur un nœud injecté\n');
  ok('React onClick : atteint', compare.react.clic.length === 1, compare.react.clic);
  ok('React onChange sur un select : MUET', compare.react.select.length === 0, compare.react.select);
  ok('React onChange sur une textarea : MUET', compare.react.zone.length === 0, compare.react.zone);
  ok('écouteur natif, clic : atteint', compare.natif.clic.length === 1, compare.natif.clic);
  ok('écouteur natif, change select : atteint', compare.natif.select.length === 1, compare.natif.select);
  ok('écouteur natif, change textarea : atteint', compare.natif.zone.length === 1, compare.natif.zone);

  await nav.close();
  fs.rmSync(atelier, { recursive: true, force: true });
  console.log(echecs ? `\n  ${echecs} échec(s)\n` : '\n  Tout passe.\n');
  process.exit(echecs ? 1 : 0);
})();
