const {chromium} = require('playwright-core');
const fs = require('fs');

const MESURE = `(() => {
  const flux = document.querySelector('.flux');
  if (!flux) return null;
  const boite = (el) => { let x=0,y=0,cur=el;
    while (cur && cur !== flux) { x+=cur.offsetLeft; y+=cur.offsetTop; cur=cur.offsetParent; }
    y += Number(el.dataset.decalage || 0);
    return [x, y, el.offsetWidth, el.offsetHeight]; };
  const cartes = [...flux.querySelectorAll('[data-etape]')]
    .sort((a,b) => Number(a.dataset.etape) - Number(b.dataset.etape)).map(boite);
  const svg = flux.querySelector('.flux-svg');
  const traces = [...svg.querySelectorAll('path')].filter(p => !p.closest('defs'))
    .map(p => p.getAttribute('d'));
  return { cartes, traces, l: flux.scrollWidth, h: flux.offsetHeight,
           colonnes: getComputedStyle(flux).gridTemplateColumns,
           defileL: flux.parentElement.clientWidth };
})()`;

(async () => {
  const nav = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx = await nav.newContext({viewport:{width:1600,height:1000}});
  // polices externes bloquées des deux côtés : sinon la largeur du texte, donc la
  // hauteur des cartes, dépendrait du réseau et non du CSS qu'on veut comparer
  await ctx.route('**/*', (r) => {
    const u = r.request().url();
    return /fonts\.googleapis|fonts\.gstatic|fontshare/.test(u) ? r.abort() : r.continue();
  });

  const page = await ctx.newPage();
  await page.goto('file:///home/user/Claude_Projects/diagnostic-os.html', {waitUntil:'load'});
  await page.waitForTimeout(1200);
  const refs = {};
  for (const id of ['onboarding','habilitations','competences','planification']) {
    await page.evaluate((i) => { etat.procId = i; etat.zoom = 1; etat.edition = false; rendre(); }, id);
    await page.waitForTimeout(350);
    refs[id] = await page.evaluate(MESURE);
    refs[id].defileL = await page.evaluate(() => document.querySelector('.flux-defile').clientWidth);
  }
  const donnees = await page.evaluate(() => {
    const c = etat.base[0];
    return { processus: c.processus.map(p => ({p, etapes: p.etapes})), palette: rolesGlobaux(), outils: c.outils };
  });
  await page.close();

  const moteur = fs.readFileSync('/home/user/Claude_Projects/flux/moteur.js','utf8');
  const css = fs.readFileSync('/home/user/Claude_Projects/flux/moteur.css','utf8');
  const p2 = await ctx.newPage();
  let ko = 0;
  for (const {p, etapes} of donnees.processus) {
    await p2.setContent(`<!doctype html><meta charset=utf8><style>${css}
      body{margin:0} #hote{width:${refs[p.id].defileL}px}</style><div id="hote" class="carte carte--flux"></div>`);
    await p2.evaluate(async ({src, p, etapes, palette, outils}) => {
      const M = await import('data:text/javascript;base64,' + btoa(unescape(encodeURIComponent(src))));
      document.getElementById('hote').innerHTML =
        M.baliserFlux({processus: p, etapes, options: {paletteRoles: palette, outils, edition: false, zoom: 1, enveloppe: false}});
      M.acheverRendu(document.querySelector('.flux'), etapes, {edition: false});
    }, {src: moteur, p, etapes, palette: donnees.palette, outils: donnees.outils});
    await p2.waitForTimeout(250);
    const got = await p2.evaluate(MESURE);
    const ref = refs[p.id];
    const eq = (a,b) => JSON.stringify(a) === JSON.stringify(b);
    const res = [
      ['positions et tailles des cartes', eq(ref.cartes, got.cartes)],
      ['tracés des flèches', eq(ref.traces, got.traces)],
      ['gabarit de colonnes calculé', ref.colonnes === got.colonnes],
      ['largeur et hauteur du diagramme', ref.l === got.l && ref.h === got.h],
      ['largeur disponible identique', ref.defileL === got.defileL]
    ];
    console.log('\n' + p.id + '  (' + etapes.length + ' étapes, ' + ref.traces.length + ' flèches)');
    for (const [nom, cond] of res) {
      console.log((cond ? '  ok  ' : '  KO  ') + nom);
      if (!cond) { ko++; }
    }
    if (!eq(ref.cartes, got.cartes)) {
      const d = ref.cartes.map((c,i) => eq(c, got.cartes[i]) ? null : `#${i+1} ref=${c} obt=${got.cartes[i]}`).filter(Boolean);
      console.log('        ' + d.slice(0,3).join('\n        '));
    }
  }
  await nav.close();
  console.log(ko ? `\n${ko} ÉCART(S)\n` : '\nGÉOMÉTRIE IDENTIQUE — moteur + moteur.css seuls reproduisent le mono-fichier\n');
  process.exit(ko ? 1 : 0);
})();
