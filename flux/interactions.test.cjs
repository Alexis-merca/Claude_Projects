const {chromium}=require('playwright-core'); const fs=require('fs');
(async()=>{
  const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const page=await(await nav.newContext({viewport:{width:1400,height:900}})).newPage();
  const moteur=fs.readFileSync('/home/user/Claude_Projects/flux/moteur.js','utf8');
  const css=fs.readFileSync('/home/user/Claude_Projects/flux/moteur.css','utf8');
  await page.setContent(`<!doctype html><meta charset=utf8><style>${css}</style><div id="h" class="carte carte--flux"></div>`);
  const r=await page.evaluate(async ({src})=>{
    const M=await import('data:text/javascript;base64,'+btoa(unescape(encodeURIComponent(src))));
    const p={id:'x',roles:['RH','EHS','Chef']};
    const et=[{ordre:1,role:'RH',texte:'un',supports:'Excel'},{ordre:2,role:'EHS',texte:'deux'},{ordre:3,role:'Chef',texte:'trois'}];
    document.getElementById('h').innerHTML=M.baliserFlux({processus:p,etapes:et,
      options:{paletteRoles:p.roles,outils:['Excel','Papier'],edition:true,zoom:1,enveloppe:false,
               commandes:{texte:true,phases:true,deplacement:true,supports:true}}});
    const flux=document.querySelector('.flux');
    M.acheverRendu(flux,et,{edition:true});

    const cible=document.querySelector('.fleche-cible');
    const front=document.querySelector('.flux__frontiere');
    flux.classList.add('flux--glisse');
    const frontGlisse=getComputedStyle(front).pointerEvents;
    flux.classList.remove('flux--glisse');
    return {
      nbFleches: document.querySelectorAll('.fleche-cible').length,
      fleche_pointer: cible?getComputedStyle(cible).pointerEvents:'ABSENTE',
      fleche_cursor: cible?getComputedStyle(cible).cursor:'-',
      svg_pointer: getComputedStyle(document.querySelector('.flux-svg')).pointerEvents,
      frontiere_repos: front?getComputedStyle(front).pointerEvents:'ABSENTE',
      frontiere_glisse: frontGlisse,
      nbFrontieres: document.querySelectorAll('.flux__frontiere').length,
      selecteur_support: document.querySelectorAll('.carte__support-choix').length,
      retirer_support: document.querySelectorAll('[data-action="supprimer-support"]').length,
      poignees: document.querySelectorAll('[data-poignee]').length
    };
  },{src:moteur});
  const ok=(n,c,d)=>console.log((c?'  ok  ':'  KO  ')+n+(c?'':'  → '+d));
  ok('zones de clic des flèches présentes', r.nbFleches===2, r.nbFleches);
  ok('flèche : pointer-events = stroke', r.fleche_pointer==='stroke', r.fleche_pointer);
  ok('flèche : curseur main', r.fleche_cursor==='pointer', r.fleche_cursor);
  ok('svg de fond : pointer-events = none (comme attendu)', r.svg_pointer==='none', r.svg_pointer);
  ok('frontière au repos : inerte', r.frontiere_repos==='none', r.frontiere_repos);
  ok('frontière pendant un glisser : réceptive', r.frontiere_glisse==='auto', r.frontiere_glisse);
  ok('frontières entre couloirs présentes', r.nbFrontieres===6, r.nbFrontieres);
  ok('sélecteur de support présent', r.selecteur_support===3, r.selecteur_support);
  ok('bouton retirer un support présent', r.retirer_support===1, r.retirer_support);
  ok('poignées de déplacement présentes', r.poignees===3, r.poignees);
  await nav.close();
})();
