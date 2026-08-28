/* LA TRANSCRIPTION D'UNE PAGE 16:9 EN FORMES POWERPOINT NATIVES.
 *
 * COPIE MIROIR de `src/lib/pptx-transcription.ts` du projet Lovable, à
 * l'identique — pas une ligne ne diffère. Le seul type importé
 * (`import type PptxGenJS`) est effacé à la transpilation : ce module n'a
 * aucune dépendance à l'exécution, ce qui permet de l'exercer ici, hors de
 * l'application, dans un vrai navigateur (`flux/pptx.test.cjs`).
 *
 * LA RÈGLE, ET ELLE DÉCIDE DE TOUT :
 *   ce qui est en HTML devient une forme PowerPoint native ;
 *   ce qui est en SVG reste une image, posée à sa place MESURÉE.
 *
 * CE MODULE NE REFAIT AUCUNE MISE EN PAGE. Le navigateur a déjà tout calculé :
 * `Page` pose une échelle sur `[data-toile]`, `CarteFlux` pose un `zoom` sur
 * `.flux`, le moteur pose sa grille. On LIT le résultat par
 * `getBoundingClientRect()` et on le transpose. Recalculer quoi que ce soit
 * ferait un second moteur de mise en page, qui dériverait du premier — et
 * l'écart ne se verrait qu'en réunion client.
 *
 * LE REPÈRE EST CELUI DE LA PAGE, pas la constante 1280 : on normalise par la
 * largeur MESURÉE de la page. La transcription est ainsi insensible au zoom du
 * navigateur et aux deux mises à l'échelle imbriquées (`transform: scale` sur
 * la toile, `zoom` sur le flux).
 *
 * LE CORPS DU TEXTE EST LE SEUL PIÈGE. `getComputedStyle().fontSize` est rendu
 * dans le repère PROPRE de l'élément, avant les transformations de ses
 * ancêtres. Le corps réellement vu vaut donc la valeur calculée multipliée par
 * l'échelle cumulée, qu'on déduit de la mesure elle-même (`r.width /
 * offsetWidth`) plutôt qu'en remontant la chaîne des transformations —
 * `zoom` et `transform` ne s'y comportent pas pareil. Voir `echelleVue()` :
 * la mesure décide, pas la théorie. Le fait est figé par
 * `flux/echelle-vue.test.cjs`.
 *
 * CE QUI RESTE UNE IMAGE, ET RIEN D'AUTRE : tout élément `<svg>` — le logo
 * Mercateam, le `.flux-svg` des flèches, le schéma des échanges IT, les
 * pastilles d'outils (le moteur les dessine en SVG). Ils sont sérialisés puis
 * rastérisés à fond TRANSPARENT et posés à leur place mesurée.
 */

import type PptxGenJS from "pptxgenjs";

/* ------------------------------------------------------------------ repère */

export interface Repere {
  cadre: DOMRect;
  /** px écran → pouces (10 pouces = la largeur MESURÉE de la page). */
  versPouces: number;
  /** px écran → points typographiques (720 pt = la même largeur). */
  versPt: number;
}

export function repereDe(page: HTMLElement): Repere {
  const cadre = page.getBoundingClientRect();
  return { cadre, versPouces: 10 / cadre.width, versPt: 720 / cadre.width };
}

export interface Boite {
  x: number;
  y: number;
  w: number;
  h: number;
  r: DOMRect;
}

export function boite(el: Element, rep: Repere): Boite {
  const r = el.getBoundingClientRect();
  return {
    x: (r.left - rep.cadre.left) * rep.versPouces,
    y: (r.top - rep.cadre.top) * rep.versPouces,
    w: r.width * rep.versPouces,
    h: r.height * rep.versPouces,
    r,
  };
}

/** L'échelle CUMULÉE réellement subie par l'élément, déduite de la mesure.
 *
 * `offsetWidth` est la largeur de mise en page ; `getBoundingClientRect()` est
 * la largeur VUE. Leur rapport donne l'échelle cumulée sans remonter la chaîne.
 *
 * MESURÉ, PAS SUPPOSÉ (Chromium, banc d'essai à deux échelles imbriquées —
 * `transform: scale(.72)` sur la toile, `zoom: .65` sur le flux) : une carte de
 * 241 px de large mesure 112,8 px à l'écran, soit 0,468 = 0,72 × 0,65. NI le
 * `transform` NI le `zoom` n'entrent donc dans `offsetWidth`, et le `font-size`
 * calculé reste celui d'avant les deux (15 px). La même formule vaut pour les
 * deux, et le corps vu est bien `fontSize × echelleVue`.
 *
 * Un élément sans `offsetWidth` (SVG, inline) hérite de l'échelle de son parent
 * de mise en page. */

export function echelleVue(el: Element, r: DOMRect): number {
  const h = el as HTMLElement;
  const large = typeof h.offsetWidth === "number" ? h.offsetWidth : 0;
  if (large > 0 && r.width > 0) return r.width / large;
  const parent = el.parentElement;
  return parent ? echelleVue(parent, parent.getBoundingClientRect()) : 1;
}

/* ----------------------------------------------------------------- couleurs */

const CANAL = /rgba?\(([^)]+)\)/;

/** `rgb(103, 51, 253)` → `{ hex: "6733FD", alpha: 1 }`. `null` = invisible. */
export function couleur(css: string): { hex: string; alpha: number } | null {
  const m = CANAL.exec(css || "");
  if (!m) return null;
  const n = m[1].split(/[,/]/).map((v) => parseFloat(v.trim()));
  const alpha = n.length > 3 ? n[3] : 1;
  if (!(alpha > 0.02)) return null;
  const hex = n
    .slice(0, 3)
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return { hex, alpha };
}

/* -------------------------------------------------------------------- texte */

type Run = PptxGenJS.TextProps;

/** Le texte d'un élément en RUNS pptxgenjs — le gras et l'italique survivent.
 *
 * MÊME DISCIPLINE DE LISTE BLANCHE QUE `marqueursDepuisBalisage` : on parcourt
 * l'arbre, on ne garde que gras / italique / saut de ligne, et tout le reste
 * est réduit à son texte. Les deux conversions doivent rester D'ACCORD sur ce
 * qui compte comme gras — d'où le même critère au caractère près :
 * `b`/`strong`, ou `font-weight` à `bold` ou ≥ 600 ; `i`/`em`, ou
 * `font-style: italic`. Un `<svg>` ne porte pas de texte transcriptible : il
 * part en image, ailleurs. */
export function runsDe(el: Element, exclus: Set<Element>): Run[] {
  const runs: Run[] = [];
  const couper = () => {
    const dernier = runs[runs.length - 1];
    if (dernier) dernier.options = { ...dernier.options, breakLine: true };
  };

  const lire = (n: Node, gras: boolean, ital: boolean) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = (n.nodeValue ?? "").replace(/\s+/g, " ");
      if (!t.trim() && !runs.length) return;
      if (!t) return;
      runs.push({ text: t, options: { bold: gras, italic: ital } });
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const e = n as HTMLElement;
    if (exclus.has(e)) return;
    const nom = e.tagName.toLowerCase();
    if (nom === "br") {
      couper();
      return;
    }
    if (nom === "svg" || nom === "img" || nom === "script" || nom === "style") return;
    const st = window.getComputedStyle(e);
    if (st.display === "none" || st.visibility === "hidden") return;
    const poids = Number(st.fontWeight);
    const g = gras || nom === "b" || nom === "strong" || st.fontWeight === "bold" || poids >= 600;
    const i = ital || nom === "i" || nom === "em" || st.fontStyle === "italic";
    const bloc = !st.display.startsWith("inline");
    if (bloc && runs.length) couper();
    for (const enfant of Array.from(e.childNodes)) lire(enfant, g, i);
    if (bloc) couper();
  };

  for (const enfant of Array.from(el.childNodes)) lire(enfant, false, false);

  /* Les espaces de bord d'un nœud texte n'ont pas de sens dans une zone de
     texte PowerPoint : ils décalent la première ligne. */
  while (runs.length && !(runs[0].text ?? "").trim()) runs.shift();
  while (runs.length && !(runs[runs.length - 1].text ?? "").trim()) runs.pop();
  if (runs.length) {
    runs[0].text = (runs[0].text ?? "").replace(/^\s+/, "");
    const d = runs[runs.length - 1];
    d.text = (d.text ?? "").replace(/\s+$/, "");
    d.options = { ...d.options, breakLine: false };
  }
  return runs.filter((r) => (r.text ?? "").length > 0);
}

/** La police demandée, ramenée à son premier nom (PowerPoint ne connaît pas
    les piles de repli CSS). */
function police(st: CSSStyleDeclaration): string {
  const premier = (st.fontFamily || "").split(",")[0] ?? "";
  return premier.replace(/["']/g, "").trim() || "Arial";
}

/* ------------------------------------------------------- images (SVG seuls) */

/** Un `<svg>` du document → PNG à FOND TRANSPARENT, à sa taille vue.
 *
 * On sérialise plutôt qu'on ne photographie la page : les tracés du moteur et
 * du schéma d'échanges portent leurs couleurs EN ATTRIBUTS (`stroke`, `fill`),
 * la sérialisation les emmène donc telles quelles, sans dépendre d'une feuille
 * de style externe. Le SVG est rastérisé au double de sa taille vue : la
 * diapositive s'agrandit au vidéoprojecteur. */
export async function pngDuSvg(svg: SVGSVGElement, r: DOMRect, densite = 2): Promise<string | null> {
  const st = window.getComputedStyle(svg);
  /* Le repère INTERNE du SVG : sa largeur de mise en page, hors transformation
     des ancêtres. Sans elle, un SVG posé dans un `.flux` zoomé serait rastérisé
     dans le mauvais système de coordonnées. */
  const li = parseFloat(st.width) || r.width || 1;
  const hi = parseFloat(st.height) || r.height || 1;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(li));
  clone.setAttribute("height", String(hi));
  if (!clone.getAttribute("viewBox") && !svg.getAttribute("viewBox"))
    clone.setAttribute("viewBox", `0 0 ${li} ${hi}`);
  const source = new XMLSerializer().serializeToString(clone);
  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;

  const l = Math.max(1, Math.round(r.width * densite));
  const h = Math.max(1, Math.round(r.height * densite));
  const image = new Image();
  image.decoding = "sync";
  const charge = new Promise<boolean>((ok) => {
    image.onload = () => ok(true);
    image.onerror = () => ok(false);
  });
  image.src = uri;
  if (!(await charge)) return null;
  const toile = document.createElement("canvas");
  toile.width = l;
  toile.height = h;
  const ctx = toile.getContext("2d");
  if (!ctx) return null;
  /* Aucun `fillRect` : le fond RESTE transparent, sinon la photographie des
     flèches masquerait les cartes qu'elle recouvre. */
  ctx.drawImage(image, 0, 0, l, h);
  return toile.toDataURL("image/png");
}

/* --------------------------------------------------------------- la marche */

/** Ce qu'on ne transcrit jamais : les commandes d'écran et le hors-champ. */
const IGNORE = ".ne-pas-imprimer, script, style, noscript, button[data-action]";

function invisible(st: CSSStyleDeclaration): boolean {
  return st.display === "none" || st.visibility === "hidden" || Number(st.opacity) < 0.05;
}

/** Un élément dont TOUT le contenu tient en une seule zone de texte : ses
    descendants sont inline et aucun ne porte de texte hors flux. */
function atomeTexte(el: Element, exclus: Set<Element>): boolean {
  if (!(el.textContent ?? "").trim()) return false;
  for (const enf of Array.from(el.children)) {
    if (exclus.has(enf)) continue;
    const nom = enf.tagName.toLowerCase();
    if (nom === "svg") continue; /* image, sans texte transcriptible */
    const st = window.getComputedStyle(enf);
    if (invisible(st)) continue;
    if (!st.display.startsWith("inline")) return false;
    if (!atomeTexteOuVide(enf, exclus)) return false;
  }
  return true;
}

function atomeTexteOuVide(el: Element, exclus: Set<Element>): boolean {
  return !(el.textContent ?? "").trim() || atomeTexte(el, exclus);
}

interface Contexte {
  pptx: PptxGenJS;
  slide: PptxGenJS.Slide;
  rep: Repere;
  exclus: Set<Element>;
  images: { svg: SVGSVGElement; b: Boite }[];
}

/** Le fond et le contour d'un élément, quand ils se voient.
 *
 * UN FILET N'EST PAS UN CADRE. Le pied de page, les lignes de tableau et les
 * bandeaux ne portent qu'un `border-top` ou `border-bottom` : les rendre par le
 * contour d'un rectangle PowerPoint dessinerait une BOÎTE autour du texte —
 * défaut vu au premier rendu du banc d'essai. On ne pose donc un contour de
 * rectangle que si les quatre côtés s'accordent ; sinon chaque côté présent
 * devient une ligne à sa place. */
function poserForme(el: HTMLElement, st: CSSStyleDeclaration, b: Boite, c: Contexte) {
  const fond = couleur(st.backgroundColor);
  const ech = echelleVue(el, b.r);
  const cotes = (["Top", "Right", "Bottom", "Left"] as const).map((nom) => {
    const px = parseFloat(st.getPropertyValue(`border-${nom.toLowerCase()}-width`)) || 0;
    const style = st.getPropertyValue(`border-${nom.toLowerCase()}-style`);
    const teinte = style !== "none" && px > 0 ? couleur(st.getPropertyValue(`border-${nom.toLowerCase()}-color`)) : null;
    return { nom, px, teinte, pointille: style === "dashed" || style === "dotted" };
  });
  const presents = cotes.filter((co) => co.teinte);
  if (!fond && !presents.length) return;

  const largeurPt = (px: number) => Math.max(0.5, px * ech * 0.75);
  const memes =
    presents.length === 4 &&
    presents.every(
      (co) => co.teinte!.hex === presents[0].teinte!.hex && co.px === presents[0].px && co.pointille === presents[0].pointille,
    );

  const rayonPx = parseFloat(st.borderTopLeftRadius) || 0;
  const rayon = rayonPx * ech * c.rep.versPouces;
  const arrondi = rayon > 0.005;

  if (fond || memes) {
    c.slide.addShape(arrondi ? "roundRect" : "rect", {
      x: b.x,
      y: b.y,
      w: b.w,
      h: b.h,
      ...(arrondi ? { rectRadius: Math.min(rayon, Math.min(b.w, b.h) / 2) } : {}),
      ...(fond
        ? { fill: { color: fond.hex, ...(fond.alpha < 1 ? { transparency: Math.round((1 - fond.alpha) * 100) } : {}) } }
        : { fill: { type: "none" } }),
      ...(memes
        ? {
            line: {
              color: presents[0].teinte!.hex,
              width: largeurPt(presents[0].px),
              ...(presents[0].pointille ? { dashType: "dash" as const } : {}),
            },
          }
        : { line: { type: "none" } }),
    } as PptxGenJS.ShapeProps);
  }

  if (memes) return;
  for (const co of presents) {
    const horizontal = co.nom === "Top" || co.nom === "Bottom";
    c.slide.addShape("line", {
      x: b.x,
      y: co.nom === "Bottom" ? b.y + b.h : b.y,
      w: horizontal ? b.w : 0,
      h: horizontal ? 0 : b.h,
      ...(co.nom === "Right" ? { x: b.x + b.w } : {}),
      line: {
        color: co.teinte!.hex,
        width: largeurPt(co.px),
        ...(co.pointille ? { dashType: "dash" as const } : {}),
      },
    } as PptxGenJS.ShapeProps);
  }
}


function poserTexte(el: HTMLElement, st: CSSStyleDeclaration, b: Boite, c: Contexte) {
  const runs = runsDe(el, c.exclus);
  if (!runs.length) return;
  const echelle = echelleVue(el, b.r);
  const corpsPx = (parseFloat(st.fontSize) || 12) * echelle;
  const corps = corpsPx * c.rep.versPt;
  const teinte = couleur(st.color);
  const interligne = parseFloat(st.lineHeight);
  const gras = st.fontWeight === "bold" || Number(st.fontWeight) >= 600;
  const align = st.textAlign === "center" ? "center" : st.textAlign === "right" ? "right" : "left";
  const centreVertical = st.display.includes("flex") && st.alignItems === "center";
  /* Une once de jeu horizontal : PowerPoint ne mesure pas le texte comme un
     navigateur, et une largeur au pixel près y ferait replier la dernière
     syllabe. Le PDF, lui, ne bouge pas — la divergence est assumée. */
  const jeu = 0.05;
  c.slide.addText(runs, {
    x: Math.max(0, b.x - jeu / 2),
    y: b.y,
    w: b.w + jeu,
    h: Math.max(b.h, corps / 72),
    margin: 0,
    /* PowerPoint refuse un corps sous 1 pt : la page très réduite descend
       parfois plus bas, et un fichier illisible vaut mieux qu'un fichier
       refusé. */
    fontSize: Math.max(1, Math.round(corps * 10) / 10),
    fontFace: police(st),
    bold: gras,
    italic: st.fontStyle === "italic",
    color: teinte?.hex ?? "000000",
    align,
    valign: centreVertical ? "middle" : "top",
    wrap: true,
    ...(Number.isFinite(interligne) ? { lineSpacing: interligne * echelle * c.rep.versPt } : {}),
  });
}

/* --------------------------------------------------- la page de trajectoire */

/** UN VRAI TABLEAU POWERPOINT — c'est la page qu'on retouche le plus.
 *
 * Les largeurs de colonnes et la hauteur des lignes sont MESURÉES sur le
 * tableau rendu ; le contenu passe par `runsDe`, donc le gras et l'italique du
 * texte d'étape arrivent aussi ici. */
function poserTableau(table: HTMLTableElement, c: Contexte) {
  const b = boite(table, c.rep);
  const lignes = Array.from(table.querySelectorAll("tr"));
  if (!lignes.length) return;
  const cellulesPremiere = Array.from(lignes[0].children) as HTMLElement[];
  const largeurs = cellulesPremiere.map((td) => td.getBoundingClientRect().width * c.rep.versPouces);

  const rows: PptxGenJS.TableRow[] = lignes.map((tr) => {
    const entete = tr.closest("thead") != null;
    return (Array.from(tr.children) as HTMLElement[]).map((td) => {
      const st = window.getComputedStyle(td);
      const echelle = echelleVue(td, td.getBoundingClientRect());
      const corps = (parseFloat(st.fontSize) || 12) * echelle * c.rep.versPt;
      const teinte = couleur(st.color);
      return {
        text: runsDe(td, c.exclus),
        options: {
          /* PowerPoint refuse un corps sous 1 pt : la page très réduite descend
       parfois plus bas, et un fichier illisible vaut mieux qu'un fichier
       refusé. */
    fontSize: Math.max(1, Math.round(corps * 10) / 10),
          fontFace: police(st),
          color: teinte?.hex ?? "000000",
          bold: entete || Number(st.fontWeight) >= 600,
          valign: "top",
          margin: 2,
        },
      } as PptxGenJS.TableCell;
    });
  });

  c.slide.addTable(rows, {
    x: b.x,
    y: b.y,
    w: b.w,
    colW: largeurs,
    border: { type: "solid", color: "E6E6E6", pt: 0.5 },
    autoPage: false,
  });
}

/* ------------------------------------------------------------- l'ensemble */

/** Transcrit une page `.page-16-9` sur une diapositive.
 *
 * ORDRE DE POSE : le flux normal d'abord, puis les éléments HORS FLUX
 * (position absolue ou fixe), puis les images SVG. C'est l'ordre de
 * superposition du navigateur, transposé — une pastille posée avant sa carte
 * disparaîtrait dessous. */
export async function transcrirePage(pptx: PptxGenJS, slide: PptxGenJS.Slide, page: HTMLElement) {
  const rep = repereDe(page);

  /* La liste des sous-arbres qui ne suivent pas la marche ordinaire. Elle est
     dressée AVANT, pour que la marche les saute et que `runsDe` ne les avale
     pas dans le texte de leur hôte. */
  const horsFlux: HTMLElement[] = [];
  const svgs: SVGSVGElement[] = [];
  const tables: HTMLTableElement[] = [];
  const exclus = new Set<Element>();
  for (const el of Array.from(page.querySelectorAll<HTMLElement>("*"))) {
    if (el.closest(IGNORE)) continue;
    const nom = el.tagName.toLowerCase();
    if (nom === "svg") {
      svgs.push(el as unknown as SVGSVGElement);
      exclus.add(el);
      continue;
    }
    if (nom === "table") {
      tables.push(el as HTMLTableElement);
      exclus.add(el);
      continue;
    }
    const st = window.getComputedStyle(el);
    if (st.position === "absolute" || st.position === "fixed") {
      horsFlux.push(el);
      exclus.add(el);
    }
  }

  const c: Contexte = { pptx, slide, rep, exclus, images: [] };

  const marcher = (el: HTMLElement, racine: boolean) => {
    if (!racine && exclus.has(el)) return;
    if (el.closest(IGNORE)) return;
    const st = window.getComputedStyle(el);
    if (invisible(st)) return;
    const b = boite(el, rep);
    if (b.r.width <= 0 || b.r.height <= 0) return;
    /* Hors cadre : la page rogne (`overflow: hidden`), la diapositive doit
       rogner pareil — sinon un débordement invisible au PDF paraîtrait ici. */
    if (
      b.r.right <= rep.cadre.left ||
      b.r.left >= rep.cadre.right ||
      b.r.bottom <= rep.cadre.top ||
      b.r.top >= rep.cadre.bottom
    )
      return;

    poserForme(el, st, b, c);
    if (atomeTexte(el, exclus)) {
      poserTexte(el, st, b, c);
      return;
    }
    for (const enf of Array.from(el.children)) marcher(enf as HTMLElement, false);
  };

  marcher(page, true);
  for (const el of horsFlux) marcher(el, true);
  for (const t of tables) poserTableau(t, c);

  /* Les SVG en dernier : ce sont les seules images du deck, et elles se posent
     par-dessus les formes qu'elles annotent (flèches sur les couloirs, schéma
     d'échanges sur ses tuiles). */
  for (const svg of svgs) {
    const b = boite(svg, rep);
    if (b.r.width <= 0 || b.r.height <= 0) continue;
    if (b.r.right <= rep.cadre.left || b.r.left >= rep.cadre.right) continue;
    const data = await pngDuSvg(svg, b.r);
    if (!data) continue;
    slide.addImage({ data, x: b.x, y: b.y, w: b.w, h: b.h });
  }
}
