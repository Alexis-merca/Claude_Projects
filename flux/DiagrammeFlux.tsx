/* ============================================================================
   Diagramme de flux — composant React
   ============================================================================

   Enveloppe mince autour du moteur. React possède les données, l'état et les
   contrôles ; le moteur garde l'impératif là où il est indispensable — la
   géométrie ne se calcule qu'après la mise en page, ce que JSX ne sait pas
   exprimer.

   Trois choses méritent l'attention, et elles sont la raison de ce fichier :

   1. LE ZOOM NE RECONSTRUIT PAS LE DOM. Il est posé sur le nœud, pas passé au
      moteur. Régénérer le balisage à chaque cran de curseur perdrait le focus
      et le caret dans les zones de saisie — le défaut que le mono-fichier
      traînait, puisqu'il réécrivait tout à chaque frappe.

   2. LE REDESSIN SUIT LA LARGEUR, PAS N'IMPORTE QUEL CHANGEMENT. Une colonne
      `fit-content` absorbe l'espace libre : sa largeur dépend de la place
      disponible dès que le diagramme tient dans son conteneur. Il faut donc
      retracer au redimensionnement — mais en ne réagissant qu'à la largeur,
      car `acheverRendu` modifie lui-même des hauteurs et rappellerait
      l'observateur en boucle.

   3. LES POLICES ARRIVENT APRÈS. La largeur du texte fixe la hauteur des
      cartes, que les flèches suivent. Tracer avant `document.fonts.ready`
      donne des flèches décalées de quelques pixels, sans rien signaler.

   4. LES ÉVÈNEMENTS SONT POSÉS À LA MAIN, PAS PAR `onClick` / `onChange`.
      React reconstruit le chemin de propagation à partir de la fibre la plus
      proche de la cible ; pour un nœud injecté par `dangerouslySetInnerHTML`
      il n'y en a pas, et c'est celle de l'hôte qui sert. Les évènements
      simples — clic, glisser — survivent à cette substitution. `change` non :
      son greffon exige que la cible elle-même porte une fibre et un suivi de
      valeur, faute de quoi il abandonne SANS RIEN SIGNALER. Le sélecteur de
      support et la saisie des cartes restaient donc muets. Un écouteur natif
      sur l'hôte n'a pas cette exigence ; tout passe par là, pour que le
      fonctionnement ne dépende pas de la catégorie d'évènement.
   ========================================================================= */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  acheverRendu,
  baliserFlux,
  flechesEffectives,
  HAUTEUR_MAX_TEXTE,
  libelleLien,
  LIENS,
  mots,
  tracerFleches,
} from "./moteur.js";
import type { EcartFleche, EtapeFlux, MotsFlux, ProcessusFlux } from "./moteur.js";


import {
  ajouterEchelle,
  ajouterEtape,
  ajouterSupport,
  changerTexte,
  basculerPartageColonne,
  couperEchelle,
  cyclerLien,
  cyclerLienFleche,
  reglerFleche,
  deposerEtape,
  insererEtape,
  renommerEchelle,
  retirerFleche,
  retirerSupport,
  supprimerEchelle,
  supprimerEtape,
  tirerFleche,
} from "./mutations.js";
import type { Mutation } from "./mutations.js";


/** ORIGINE DES CHAÎNES DE TEXTE D'UNE MUTATION (`texte`, `phase`).

    UNE CHAÎNE NE PORTE PAS SON INTENTION, et la deviner est faux : quand un
    geste FABRIQUE un libellé (`couperEchelle` écrit « Nouvelle échelle », un
    nom choisi précisément parce qu'aucune étape ne le porte), une frontière de
    traduction qui raisonne par reconnaissance le prend pour une frappe et
    avale le geste — écran en anglais, le clic reste sans effet.

    Le seul endroit qui connaît l'intention est ici : on sait quelle action du
    moteur vient de tirer. On la dit donc explicitement.

    - `"saisie"` : l'utilisateur a tapé la chaîne (`changerTexte`,
      `renommerEchelle`) — c'est peut-être une traduction.
    - `"valeur"` : la chaîne est recopiée ou fabriquée par le moteur — elle
      part en base, ramenée à sa source si elle est reconnue.

    LE REPLI EST `"valeur"`, ET C'EST VOULU : un geste ajouté demain sans
    mention écrira en base plutôt que de disparaître en silence. */
export type OrigineTexte = "saisie" | "valeur";

export type MutationHote = Mutation & { origineTexte: OrigineTexte };
import "./moteur.css";

/* Seules ces commandes sont traitées ici. Le moteur n'émet donc que celles-là :
   un bouton visible mais inerte est pire que son absence.

   `fleches` n'y est PAS : elle s'ajoute uniquement quand l'hôte passe la prop
   `fleches`, c'est-à-dire quand il sait lire la table et exécuter les mutations
   correspondantes. Un hôte qui ne l'a pas câblée garde le diagramme d'avant, au
   balisage près. */
const COMMANDES = {
  texte: true,
  phases: true,
  deplacement: true,
  supports: true,
  etapes: true,
  colonnes: true,
} as const;


const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1;

export interface DiagrammeFluxProps {
  processus: ProcessusFlux;
  etapes: EtapeFlux[];
  /** Rôles de tout le client, dans l'ordre : garde la teinte d'un rôle stable
      d'un processus à l'autre. Sans lui, les couleurs glissent entre onglets. */
  paletteRoles?: string[];
  outils?: string[];
  edition?: boolean;
  etapeActive?: number | null;
  /** Titre et légende, fournis par le composant. `false` pour s'en passer. */
  entete?: boolean;
  /** Légende des liens, dans le pied. `false` quand l'hôte rend la sienne —
      sans quoi elle paraîtrait deux fois. DÉFAUT `true` : le comportement
      historique, pour qu'un autre hôte continue de fonctionner sans rien
      changer. */
  legende?: boolean;
  /** Zoom contrôlé par l'hôte. Absent, le composant garde son propre état. */
  zoom?: number;
  onZoom?: (z: number) => void;
  /** Libellés d'interface, passés tels quels au moteur et utilisés pour
      l'en-tête et la légende portés ici. Absent : français par défaut. */
  mots?: MotsFlux;

  /** Saisie du nom d'un nouvel outil (« Autre outil… »). L'hôte la fournit avec
      la boîte de dialogue du site ; sans elle, repli sur `window.prompt`.

      CE N'EST PAS UN LUXE DE CHARTE. La préversion s'affiche dans une iframe :
      un navigateur y ignore `prompt()` sans rien dire, donc le seul chemin qui
      inscrit un outil dans `clients.outils` retournait toujours « rien saisi ».
      Une boîte native est de surcroît intraduisible, alors que tous les autres
      mots du composant sont désormais fournis. */
  demanderNomOutil?: () => Promise<string | null>;

  /** ÉCARTS AU TRACÉ CALCULÉ : lignes de la table `fleches`. Absente, les
      flèches à la main sont ÉTEINTES — ni poignée, ni puce de retrait — et le
      tracé est celui d'avant, au pixel. Passer un tableau vide les allume. */
  fleches?: EcartFleche[];

  /** Appelé pour chaque interaction d'édition. Le composant ne parle pas à la
      base : il dit ce qu'il faut écrire, l'hôte décide comment. `ordre` doit
      passer par `reordonner_etapes()` — jamais par des écritures ligne à
      ligne, ni par un upsert partiel qui viderait les colonnes absentes. */
  onMutation?: (m: MutationHote) => void;
}

export function DiagrammeFlux({
  processus,
  etapes,
  paletteRoles,
  outils,
  edition = false,
  etapeActive = null,
  entete = true,
  legende = true,
  zoom: zoomPropose,
  onZoom,
  mots: motsFournis,
  demanderNomOutil,
  fleches,
  onMutation,
}: DiagrammeFluxProps) {

  /* Un seul dictionnaire pour le moteur et pour ce qui est porté ici, sinon
     l'en-tête et le diagramme pourraient parler deux langues. */
  const t = useMemo(() => mots(motsFournis), [motsFournis]);
  const hote = useRef<HTMLDivElement>(null);

  /* Contrôlé si l'hôte fournit `zoom` : c'est lui qui le garde d'un rendu à
     l'autre. Sinon repli sur un état local. */
  const [zoomLocal, setZoomLocal] = useState(1);
  const zoom = zoomPropose ?? zoomLocal;
  const setZoom = useCallback(
    (z: number) => {
      setZoomLocal(z);
      onZoom?.(z);
    },
    [onZoom],
  );

  /* Le balisage complet — `.flux-defile` compris — est réinjecté à chaque
     changement d'`etapes` : le conteneur de défilement est détruit et son
     `scrollLeft` repart à zéro. On relève la valeur en continu et on la repose
     avant la peinture. */
  const defilement = useRef(0);
  useEffect(() => {
    const n = hote.current;
    if (!n) return;
    const noter = (ev: Event) => {
      const c = ev.target as HTMLElement;
      if (c?.classList?.contains("flux-defile")) defilement.current = c.scrollLeft;
    };
    n.addEventListener("scroll", noter, true);
    return () => n.removeEventListener("scroll", noter, true);
  }, []);

  /* Opt-in strict : la commande `fleches` n'apparaît que si l'hôte a passé la
     prop. La dépendance est le BOOLÉEN, pas le tableau : les écarts changent à
     chaque relecture, et reconstruire le balisage pour eux perdrait le focus. */
  const flechesActives = fleches !== undefined;
  const commandes = useMemo(
    () => (flechesActives ? { ...COMMANDES, fleches: true } : COMMANDES),
    [flechesActives],
  );

  /* Le balisage ne dépend pas du zoom : celui-ci est posé sur le nœud. */
  const html = useMemo(
    () =>
      baliserFlux({
        processus,
        etapes,
        options: {
          paletteRoles: paletteRoles ?? processus.roles,
          outils,
          edition,
          etapeActive,
          zoom: 1,
          entete: false,
          enveloppe: false,
          commandes,
          mots: t,
        },
      }),
    [processus, etapes, paletteRoles, outils, edition, etapeActive, commandes, t],

  );

  const fluxNode = () => hote.current?.querySelector<HTMLElement>(".flux") ?? null;

  /* Options du TRACÉ, à jour à chaque rendu : le tracé, lui, doit suivre les
     écarts — c'est lui qui dessine les flèches dessinées et masquées. */
  const trace = useMemo(
    () => ({ edition, mots: t, commandes, ...(fleches ? { fleches } : {}) }),
    [edition, t, commandes, fleches],
  );
  /* Le geste de tirage lit les écarts hors cycle de rendu. */
  const ecarts = useRef(fleches);
  ecarts.current = fleches;
  const traceRef = useRef(trace);
  traceRef.current = trace;


  /* Après chaque reconstruction : placer les cartes partagées, ajuster les
     zones de texte, tracer. Avant la peinture, pour éviter un saut visible. */
  useLayoutEffect(() => {
    const flux = fluxNode();
    if (!flux) return;
    flux.style.setProperty("zoom", String(zoom));
    acheverRendu(flux, etapes, trace);
    const defile = hote.current?.querySelector<HTMLElement>(".flux-defile");
    if (defile && defilement.current) defile.scrollLeft = defilement.current;
    // `zoom` volontairement hors dépendances : l'effet suivant s'en charge,
    // sans reconstruire le DOM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);

  /* Le zoom seul : on repose la propriété et on ACHÈVE LE RENDU, les trois
     fonctions, pas seulement le tracé.

     POURQUOI LES TROIS. Un changement de zoom change la largeur disponible en
     pixels CSS à l'intérieur des cartes, donc l'enroulement du texte, donc la
     hauteur des cartes. `placerCartesACheval` mémorise son décalage en
     `data-decalage` à partir de `carte.offsetHeight`, et c'est CE nombre que le
     tracé lit — `offsetTop` ignore les `transform`, il ne le verrait pas
     autrement. Retracer sans replacer trace donc à partir d'un état périmé :
     les flèches partent d'un point où la carte n'est plus. C'était le défaut
     « cliquer Ajuster décale les flèches ».

     ET RIEN DE PLUS N'EST RECONSTRUIT, contrairement à ce que disait le
     commentaire d'avant (« pas de reconstruction, donc focus et caret
     survivent ») : sur les trois fonctions, seule `tracerFleches` écrit du
     balisage (`svg.innerHTML` et les zones de clic) — c'est-à-dire celle que le
     raccourci appelait déjà. `ajusterZonesDeTexte` ne pose qu'une hauteur en
     style, `placerCartesACheval` qu'un `transform`. Focus et caret survivent
     exactement comme avant. */
  useLayoutEffect(() => {
    const flux = fluxNode();
    if (!flux) return;
    flux.style.setProperty("zoom", String(zoom));
    acheverRendu(flux, etapes, trace);
  }, [zoom, etapes, trace]);

  /* Redimensionnement et arrivée des polices. */
  useEffect(() => {
    const n = hote.current;
    if (!n) return;

    let vivant = true;
    let dernierL = n.clientWidth;
    let enAttente = 0;

    const retracer = () => {
      const flux = n.querySelector<HTMLElement>(".flux");
      if (flux && vivant) acheverRendu(flux, etapes, trace);
    };

    /* On ne réagit qu'à la largeur. `acheverRendu` ajuste des hauteurs, ce qui
       rappellerait l'observateur : filtrer sur la largeur coupe la boucle. */
    const obs = new ResizeObserver(() => {
      const L = n.clientWidth;
      if (L === dernierL) return;
      dernierL = L;
      cancelAnimationFrame(enAttente);
      enAttente = requestAnimationFrame(retracer);
    });
    obs.observe(n);

    /* La largeur du texte fixe la hauteur des cartes, que les flèches suivent :
       tracer avant l'arrivée des polices donne un décalage silencieux. */
    document.fonts?.ready.then(() => {
      if (vivant) retracer();
    });

    return () => {
      vivant = false;
      cancelAnimationFrame(enAttente);
      obs.disconnect();
    };
  }, [etapes, trace]);

  /* La carte respire à la frappe. `input` sert UNIQUEMENT à la hauteur : rien
     n'est écrit ici, l'écriture reste sur `change`, à la sortie du champ. Sans
     lui, on tape à l'aveugle dans un `rows="1"` — la hauteur n'était ajustée
     qu'au rendu suivant, c'est-à-dire jamais pendant qu'on écrit. */
  useEffect(() => {
    const n = hote.current;
    if (!n || !edition) return;
    const grandir = (ev: Event) => {
      const z = ev.target as HTMLTextAreaElement;
      if (!z.classList?.contains("carte__texte")) return;
      z.style.height = "auto";
      const voulue = z.scrollHeight;
      z.style.height = Math.min(voulue, HAUTEUR_MAX_TEXTE) + "px";
      z.style.overflowY = voulue > HAUTEUR_MAX_TEXTE ? "auto" : "hidden";
      /* La hauteur d'une carte déplace les flèches : les retracer tout de
         suite, sinon elles pointent à côté jusqu'à la sortie du champ. */
      const flux = fluxNode();
      if (flux) tracerFleches(flux, vues.current, traceRef.current);
    };
    n.addEventListener("input", grandir);
    return () => n.removeEventListener("input", grandir);
  }, [edition, t]);

  /* Les étapes changent à chaque frappe ; une ref évite de recréer tous les
     gestionnaires, et surtout d'en attacher un par rendu. */
  const vues = useRef(etapes);
  vues.current = etapes;
  const emettre = useRef(onMutation);
  emettre.current = onMutation;

  /* `origineTexte` par défaut à `"valeur"` : seuls les deux gestes de saisie
     l'annoncent, tout le reste écrit en base.

     LA LISTE DES CHAMPS EST LA GARDE : une mutation vide ne part pas. Tout
     nouveau champ de mutation doit y être ajouté, sinon le geste est avalé en
     silence — c'est exactement ce qui arrive aux flèches sans les trois lignes
     `fleche*`. */
  const appliquer = useCallback((m: Mutation, origineTexte: OrigineTexte = "valeur") => {
    if (!m) return;
    if (
      m.refus ||
      m.creation ||
      m.suppression ||
      m.ordre ||
      m.ecritures.length ||
      m.flecheCreer ||
      m.flecheSupprimer ||
      m.flecheMaj
    )
      emettre.current?.({ ...m, origineTexte });
  }, []);


  /* Un seul gestionnaire délégué par type d'évènement, posé sur l'hôte : le
     sous-arbre est réécrit à chaque rendu, des écouteurs individuels seraient
     perdus. Ce sont des évènements du DOM, pas les synthétiques de React —
     voir le point 4 en tête de fichier. */
  const surClic = useCallback(
    (ev: MouseEvent) => {
      const cible = (ev.target as HTMLElement).closest?.("[data-action]") as HTMLElement | null;
      if (!cible) return;
      const et = vues.current;
      const i = cible.dataset.i != null ? Number(cible.dataset.i) : null;
      /* Une flèche DESSINÉE porte sa nature en base : le clic doit agir sur la
         ligne, pas sur l'étape d'arrivée — sinon il repeindrait aussi les
         flèches calculées qui aboutissent au même endroit. */
      const idFleche = cible.dataset.fleche;
      const tracee = () =>
        flechesEffectives(vues.current, ecarts.current ?? null).find((f) =>
          idFleche
            ? f.id === idFleche
            : f.de === Number(cible.dataset.de) && f.vers === Number(cible.dataset.vers),
        ) ?? null;
      switch (cible.dataset.action) {
        case "basculer-lien":
          if (idFleche) {
            const f = tracee();
            if (f) appliquer(cyclerLienFleche(f));
          } else if (i != null) appliquer(cyclerLien(et, i));
          break;
        case "retirer-fleche": {
          const f = tracee();
          if (f) appliquer(retirerFleche(et, f));
          break;
        }

        case "partager-colonne":
          if (i != null) appliquer(basculerPartageColonne(et, i));
          break;
        case "couper-phase":
          if (i != null) appliquer(couperEchelle(et, i));
          break;
        case "supprimer-phase":
          if (i != null) appliquer(supprimerEchelle(et, i, Number(cible.dataset.span)));
          break;
        case "ajouter-phase":
          appliquer(ajouterEchelle(et, processus.roles[0] || ""));
          break;
        case "inserer-etape":
          if (i != null) appliquer(insererEtape(et, i));
          break;
        case "supprimer-etape":
          if (i != null) appliquer(supprimerEtape(et, i));
          break;
        case "gauche-etape":
          if (i != null && i > 0)
            appliquer(deposerEtape(et, i, i - 1, et[i].role, et[i].role2 || ""));
          break;
        case "droite-etape":
          if (i != null && i < et.length - 1)
            appliquer(deposerEtape(et, i, i + 1, et[i].role, et[i].role2 || ""));
          break;
        case "ajouter-etape":
          appliquer(ajouterEtape(et, processus.roles[0] || ""));
          break;
        case "ajouter-etape-role":
          appliquer(ajouterEtape(et, cible.dataset.roleNom || processus.roles[0] || ""));
          break;
        case "supprimer-support":
          if (i != null) appliquer(retirerSupport(et, i, Number(cible.dataset.s)));
          break;
      }
    },
    [appliquer, processus.roles],
  );

  /* `change` et non `input` : on écrit à la sortie du champ, pas à chaque
     frappe. Une écriture par caractère saturerait le réseau et ferait avancer
     la version du processus en continu, rejetant les collègues sans raison. */
  const surChangement = useCallback(
    (ev: Event) => {
      const champ = (ev.target as HTMLElement).dataset?.champ;
      if (!champ) return;
      const valeur = (ev.target as HTMLInputElement | HTMLTextAreaElement).value;
      const [type, a, b] = champ.split(".");
      /* LES DEUX SEULS GESTES QUI PORTENT UNE SAISIE. Le libellé vient du
         clavier, dans la langue de l'écran : c'est peut-être une traduction. */
      if (type === "etape" && b === "texte")
        appliquer(changerTexte(vues.current, Number(a), valeur), "saisie");
      else if (type === "phase")
        appliquer(renommerEchelle(vues.current, Number(a), Number(b), valeur), "saisie");
      else if (type === "support-ajout") {
        /* `__autre__` : l'outil est saisi à la main et rejoint la liste du site
           (`inscrireAuClient`), sinon chacun le retaperait avec une orthographe
           différente et il ne serait proposé nulle part ailleurs. */
        const saisi = valeur === "__autre__";
        const index = Number(a);
        /* Le sélecteur revient à vide TOUT DE SUITE : il sert à ajouter, pas à
           porter un état, et la saisie qui suit est asynchrone. */
        (ev.target as HTMLSelectElement).value = "";
        if (!saisi) {
          if (valeur) appliquer(ajouterSupport(vues.current, index, valeur, false));
          return;
        }
        const demande = demanderNomOutil
          ? demanderNomOutil()
          : Promise.resolve(window.prompt(t.supportSaisirNom));
        void demande.then((rep) => {
          const nom = (rep || "").trim();
          /* `vues.current` et non une copie capturée : le diagramme a pu être
             réécrit pendant que la boîte était ouverte. */
          if (nom) appliquer(ajouterSupport(vues.current, index, nom, true));
        });
      }
    },
    /* `t` et `demanderNomOutil` DOIVENT figurer ici : sans eux la fermeture
       reste celle du premier rendu, et un changement de dictionnaire ou de
       boîte de saisie n'aurait aucun effet — en silence. */
    [appliquer, t, demanderNomOutil],
  );

  /* Glisser-déposer. L'index source vit dans une ref : le sous-arbre est
     réécrit entre le `dragstart` et le `drop`, un état React serait perdu. */
  const glisse = useRef<number | null>(null);

  const surDebutGlisse = useCallback((ev: DragEvent) => {
    const poignee = (ev.target as HTMLElement).closest?.("[data-poignee]") as HTMLElement | null;
    const paquet = ev.dataTransfer;
    if (!poignee || !paquet) return;
    glisse.current = Number(poignee.dataset.poignee);
    paquet.effectAllowed = "move";
    paquet.setData("text/plain", String(glisse.current));
    const carte = poignee.closest("[data-index]");
    if (carte) {
      paquet.setDragImage(carte, 24, 20);
      carte.classList.add("flux__carte--glissee");
    }
    fluxNode()?.classList.add("flux--glisse");
  }, []);

  const nettoyerGlisse = useCallback(() => {
    glisse.current = null;
    const n = hote.current;
    if (!n) return;
    fluxNode()?.classList.remove("flux--glisse");
    n.querySelectorAll(".flux__carte--glissee").forEach((el) =>
      el.classList.remove("flux__carte--glissee"),
    );
    n.querySelectorAll(".flux__cellule--cible, .flux__frontiere--cible").forEach((el) =>
      el.classList.remove("flux__cellule--cible", "flux__frontiere--cible"),
    );
  }, []);

  const surSurvol = useCallback((ev: DragEvent) => {
    if (glisse.current === null) return;
    const t = ev.target as HTMLElement;
    const frontiere = t.closest?.("[data-frontiere]") as HTMLElement | null;
    const zone = frontiere || (t.closest?.("[data-cellule]") as HTMLElement | null);
    if (!zone) return;
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
    hote.current
      ?.querySelectorAll(".flux__cellule--cible, .flux__frontiere--cible")
      .forEach((el) => {
        if (el !== zone) el.classList.remove("flux__cellule--cible", "flux__frontiere--cible");
      });
    zone.classList.add(frontiere ? "flux__frontiere--cible" : "flux__cellule--cible");
  }, []);

  const surDepot = useCallback(
    (ev: DragEvent) => {
      const t = ev.target as HTMLElement;
      const frontiere = t.closest?.("[data-frontiere]") as HTMLElement | null;
      const zone = frontiere || (t.closest?.("[data-cellule]") as HTMLElement | null);
      const source = glisse.current;
      if (!zone || source === null) return;
      ev.preventDefault();
      const colonne = Number(frontiere ? frontiere.dataset.frontiere : zone.dataset.cellule);
      const role = frontiere ? frontiere.dataset.roleHaut : zone.dataset.roleNom;
      const role2 = frontiere ? frontiere.dataset.roleBas : "";
      nettoyerGlisse();
      appliquer(deposerEtape(vues.current, source, colonne, role || "", role2));
    },
    [appliquer, nettoyerGlisse],
  );

  /* TIRAGE D'UNE FLÈCHE : évènements de POINTEUR, pas glisser-déposer HTML5.
     Deux raisons, et elles ne sont pas cosmétiques. D'abord le glisser HTML5 est
     déjà pris par le déplacement d'étape : deux `dragstart` sur la même carte se
     disputeraient la cible de dépôt. Ensuite le tracé se fait au pointeur dans
     `SchemaEchanges`, et un consultant apprend un geste, pas deux.

     La cible est la CARTE (`[data-index]`), y compris en arrière — une flèche de
     retour est licite. Le refus « même colonne » est montré pendant le geste,
     avant le relâchement : c'est le seul moment où il est encore corrigeable. */
  const tirage = useRef<number | null>(null);

  const nettoyerTirage = useCallback(() => {
    tirage.current = null;
    hote.current
      ?.querySelectorAll(".flux__carte--cible-fleche, .flux__carte--refus-fleche")
      .forEach((el) =>
        el.classList.remove("flux__carte--cible-fleche", "flux__carte--refus-fleche"),
      );
  }, []);

  const carteSous = (ev: PointerEvent): HTMLElement | null => {
    const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
    return (el?.closest?.("[data-index]") as HTMLElement | null) ?? null;
  };

  const surTirage = useCallback(
    (ev: PointerEvent) => {
      const poignee = (ev.target as HTMLElement).closest?.("[data-tirage]") as HTMLElement | null;
      if (!poignee) return;
      ev.preventDefault();
      const source = Number(poignee.dataset.tirage);
      tirage.current = source;

      const bouger = (e: PointerEvent) => {
        nettoyerTirage();
        tirage.current = source;
        const carte = carteSous(e);
        if (!carte) return;
        const cible = Number(carte.dataset.index);
        if (cible === source) return;
        const essai = tirerFleche(vues.current, source, cible, ecarts.current ?? null);
        carte.classList.add(
          essai.refus ? "flux__carte--refus-fleche" : "flux__carte--cible-fleche",
        );
      };

      const lacher = (e: PointerEvent) => {
        window.removeEventListener("pointermove", bouger);
        window.removeEventListener("pointerup", lacher);
        window.removeEventListener("pointercancel", fin);
        const carte = carteSous(e);
        nettoyerTirage();
        if (!carte) return;
        const cible = Number(carte.dataset.index);
        appliquer(tirerFleche(vues.current, source, cible, ecarts.current ?? null));
      };

      const fin = () => {
        window.removeEventListener("pointermove", bouger);
        window.removeEventListener("pointerup", lacher);
        window.removeEventListener("pointercancel", fin);
        nettoyerTirage();
      };

      window.addEventListener("pointermove", bouger);
      window.addEventListener("pointerup", lacher);
      window.addEventListener("pointercancel", fin);
    },
    [appliquer, nettoyerTirage],
  );

  /* RÉGLAGE À LA MAIN DU TRACÉ — on attrape le segment mobile et on le pousse.
     Ce qui est enregistré est un DÉCALAGE en pixels par rapport au tracé calculé,
     et non un point de passage : le moteur peut donc corriger son routage sans
     que les réglages d'hier deviennent des positions absurdes.

     Le déplacement est divisé par le zoom : l'écart se lit à l'écran, en pixels
     zoomés, mais le décalage s'enregistre dans les unités du diagramme. Sans ça,
     un réglage fait à 60 % de zoom sauterait au rechargement.

     Aucune borne ici : c'est le MOTEUR qui rogne le décalage pour ne jamais
     couper une carte (voir `voies`). La borne doit vivre là où vit la géométrie,
     sinon deux règles divergent et c'est l'écran qui tranche. */
  const surReglage = useCallback(
    (ev: PointerEvent) => {
      const prise = (ev.target as HTMLElement).closest?.(
        '[data-action="regler-fleche"]',
      ) as HTMLElement | null;
      if (!prise) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      const axe = prise.dataset.axe === "voie" ? "x" : "y";
      const depart = axe === "x" ? ev.clientX : ev.clientY;
      const idFleche = prise.dataset.fleche;
      const de = Number(prise.dataset.de);
      const vers = Number(prise.dataset.vers);
      const retrouver = () =>
        flechesEffectives(vues.current, ecarts.current ?? null).find((f) =>
          idFleche ? f.id === idFleche : f.de === de && f.vers === vers,
        ) ?? null;

      const lacher = (e: PointerEvent) => {
        window.removeEventListener("pointermove", suivre);
        window.removeEventListener("pointerup", lacher);
        window.removeEventListener("pointercancel", fin);
        prise.classList.remove("fleche-regler--actif");
        const delta = ((axe === "x" ? e.clientX : e.clientY) - depart) / (zoom || 1);
        /* Sous le seuil, c'est un clic, pas un glissé : ne rien écrire évite de
           faire avancer la version du processus — et de mettre un collègue en
           conflit — pour un geste que l'utilisateur n'a pas voulu. */
        if (Math.abs(delta) < 2) return;
        const f = retrouver();
        if (f) appliquer(reglerFleche(vues.current, f, delta));
      };

      /* Aperçu pendant le glissé : on translate le GROUPE de la flèche, sans
         retracer. Retracer à chaque `pointermove` réécrirait le sous-arbre sous
         le doigt, et le geste se perdrait au premier rendu. */
      const groupe = prise.closest(".fleche") as SVGGElement | null;
      const suivre = (e: PointerEvent) => {
        const d = ((axe === "x" ? e.clientX : e.clientY) - depart) / (zoom || 1);
        if (groupe) {
          groupe.style.transform = axe === "x" ? `translateX(${d}px)` : `translateY(${d}px)`;
        }
      };

      const fin = () => {
        window.removeEventListener("pointermove", suivre);
        window.removeEventListener("pointerup", lacher);
        window.removeEventListener("pointercancel", fin);
        if (groupe) groupe.style.transform = "";
        prise.classList.remove("fleche-regler--actif");
      };

      prise.classList.add("fleche-regler--actif");
      window.addEventListener("pointermove", suivre);
      window.addEventListener("pointerup", lacher);
      window.addEventListener("pointercancel", fin);
    },
    [appliquer, zoom],
  );

  /* Double-clic sur le segment mobile : RETOUR AU TRACÉ CALCULÉ. On remet le
     décalage à `null` plutôt que d'y recopier la valeur calculée — sinon le
     réglage figerait un tracé qui ne suivrait plus les corrections du moteur. */
  const surDoubleClic = useCallback(
    (ev: MouseEvent) => {
      const prise = (ev.target as HTMLElement).closest?.(
        '[data-action="regler-fleche"]',
      ) as HTMLElement | null;
      if (!prise) return;
      const idFleche = prise.dataset.fleche;
      const de = Number(prise.dataset.de);
      const vers = Number(prise.dataset.vers);
      const f =
        flechesEffectives(vues.current, ecarts.current ?? null).find((x) =>
          idFleche ? x.id === idFleche : x.de === de && x.vers === vers,
        ) ?? null;
      if (f) appliquer(reglerFleche(vues.current, f, null));
    },
    [appliquer],
  );


  /* Pose des écouteurs. Hors édition on n'en pose aucun : le diagramme est
     alors une image, et un `dragstart` qui traîne suffirait à donner
     l'impression qu'on peut déplacer une carte. */
  useEffect(() => {
    const n = hote.current;
    if (!n || !edition) return;
    const paires = [
      ["click", surClic],
      ["change", surChangement],
      ["dragstart", surDebutGlisse],
      ["dragend", nettoyerGlisse],
      ["dragover", surSurvol],
      ["drop", surDepot],
      ["pointerdown", surTirage],
      /* Deux écouteurs `pointerdown` sur le MÊME hôte : `stopPropagation` n'y
         suffirait pas, d'où `stopImmediatePropagation` côté réglage — sinon le
         glissé du segment serait aussi lu comme un tirage de nouvelle flèche. */
      ["pointerdown", surReglage],
      ["dblclick", surDoubleClic],
    ] as const;

    paires.forEach(([nom, fn]) => n.addEventListener(nom, fn as EventListener));
    return () => paires.forEach(([nom, fn]) => n.removeEventListener(nom, fn as EventListener));
  }, [
    edition,
    surClic,
    surChangement,
    surDebutGlisse,
    nettoyerGlisse,
    surSurvol,
    surDepot,
    surTirage,
    surReglage,
    surDoubleClic,
  ]);


  /** Règle le zoom pour que tout le diagramme tienne dans la largeur offerte.
      Le pas de 5 % évite un curseur à valeur illisible.

      LES DEUX MESURES SONT PRISES SANS DÉPENDRE D'UNE BARRE DE DÉFILEMENT, et
      c'est le fond du « parfois » :

      1. LA LARGEUR NATURELLE. `.flux` est une grille FLUIDE (`min-width:
         min-content`, largeur auto) : dès que le diagramme tient, elle
         s'étire à la largeur du conteneur. La mesurer telle quelle rendait
         donc la largeur du CONTENEUR, pas la sienne — le rapport valait
         alors « à peu près le zoom courant », et suffisait à tomber d'un cran
         selon le côté de l'arrondi. On la mesure en `max-content` et hors
         échelle, le temps d'une lecture, puis on repose les styles : rien
         n'est peint entre les deux, tout se joue dans la même tâche. Même
         raisonnement que la vue d'impression, qui mesurait déjà ainsi.

      2. LA LARGEUR DISPONIBLE. `clientWidth` moins les vraies marges
         intérieures, au lieu d'un retrait forfaitaire de 4 px qui ne
         correspondait à aucune longueur du style (la marge droite en vaut 24).
         À noter, contre l'hypothèse la plus naturelle : la barre du conteneur
         est HORIZONTALE (`overflow-x: auto`), elle mange de la HAUTEUR, jamais
         de la largeur — `clientWidth` ne bouge donc pas quand elle
         apparaît. */
  const ajuster = useCallback(() => {
    const flux = fluxNode();
    const defile = flux?.parentElement;
    if (!flux || !defile) return;

    const zoomAvant = flux.style.zoom;
    const largeurAvant = flux.style.width;
    flux.style.zoom = "1";
    flux.style.width = "max-content";
    const naturelle = flux.scrollWidth;
    flux.style.zoom = zoomAvant;
    flux.style.width = largeurAvant;
    if (naturelle <= 0) return;

    const st = getComputedStyle(defile);
    const dispo =
      defile.clientWidth - (parseFloat(st.paddingLeft) || 0) - (parseFloat(st.paddingRight) || 0);

    setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.floor((dispo / naturelle) * 20) / 20)));
  }, [setZoom]);

  return (
    <div className="carte carte--flux">
      {entete ? (
        <div className="flux__entete">
          <span className="libelle libelle--large">{t.titre}</span>
          <div className="rangee" style={{ gap: 14 }}>
            {etapes.length > 0 ? (
              <div className="flux__zoom ne-pas-imprimer">
                <button
                  type="button"
                  className="bouton bouton--mini"
                  onClick={ajuster}
                  title={t.zoomAjusterTitre}
                >
                  {t.zoomAjuster}
                </button>
                <input
                  type="range"
                  min={ZOOM_MIN * 100}
                  max={ZOOM_MAX * 100}
                  step={5}
                  value={Math.round(zoom * 100)}
                  onChange={(ev) => setZoom(Number(ev.target.value) / 100)}
                  aria-label={t.zoomAria}
                />
                <span className="flux__zoom-valeur">{Math.round(zoom * 100)} %</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Le moteur produit du HTML : React lui cède ce sous-arbre et n'y
          touche plus. C'est ce qui permet au tracé d'écrire dans les SVG sans
          que la réconciliation l'efface. */}
      <div ref={hote} dangerouslySetInnerHTML={{ __html: html }} />

      {etapes.length > 0 && legende ? (
        <div className="flux__pied">
          <div className="flux__legende">
            {["auto", "manuel", ""].map((k) => (
              <span className="flux__legende-item" key={k || "neutre"}>
                <span
                  className="flux__legende-trait"
                  style={{
                    borderTopColor: LIENS[k].couleur,
                    borderTopStyle: LIENS[k].tirets ? "dashed" : "solid",
                  }}
                />
                {libelleLien(k, t)}
              </span>
            ))}
          </div>

        </div>
      ) : null}
    </div>
  );
}

export default DiagrammeFlux;
