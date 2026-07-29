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
   ========================================================================= */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, FormEvent, MouseEvent } from "react";
import { acheverRendu, baliserFlux, LIENS, tracerFleches } from "./moteur.js";
import type { EtapeFlux, ProcessusFlux } from "./moteur.js";
import {
  ajouterEchelle, changerTexte, couperEchelle, cyclerLien,
  deposerEtape, renommerEchelle, supprimerEchelle,
} from "./mutations.js";
import type { Mutation } from "./mutations.js";
import "./moteur.css";

/* Seules ces commandes sont traitées ici. Le moteur n'émet donc que celles-là :
   un bouton visible mais inerte est pire que son absence. */
const COMMANDES = { texte: true, phases: true, deplacement: true } as const;

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
  /** Appelé pour chaque interaction d'édition. Le composant ne parle pas à la
      base : il dit ce qu'il faut écrire, l'hôte décide comment. `ordre` doit
      passer par `reordonner_etapes()` — jamais par des écritures ligne à
      ligne, ni par un upsert partiel qui viderait les colonnes absentes. */
  onMutation?: (m: Mutation) => void;
}

export function DiagrammeFlux({
  processus,
  etapes,
  paletteRoles,
  outils,
  edition = false,
  etapeActive = null,
  entete = true,
  onMutation,
}: DiagrammeFluxProps) {
  const hote = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

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
          commandes: COMMANDES,
        },
      }),
    [processus, etapes, paletteRoles, outils, edition, etapeActive],
  );

  const fluxNode = () => hote.current?.querySelector<HTMLElement>(".flux") ?? null;

  /* Après chaque reconstruction : placer les cartes partagées, ajuster les
     zones de texte, tracer. Avant la peinture, pour éviter un saut visible. */
  useLayoutEffect(() => {
    const flux = fluxNode();
    if (!flux) return;
    flux.style.setProperty("zoom", String(zoom));
    acheverRendu(flux, etapes, { edition });
    // `zoom` volontairement hors dépendances : l'effet suivant s'en charge,
    // sans reconstruire le DOM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);

  /* Le zoom seul : on repose la propriété et on retrace. Pas de reconstruction,
     donc focus et caret survivent. */
  useLayoutEffect(() => {
    const flux = fluxNode();
    if (!flux) return;
    flux.style.setProperty("zoom", String(zoom));
    tracerFleches(flux, etapes, { edition });
  }, [zoom, etapes, edition]);

  /* Redimensionnement et arrivée des polices. */
  useEffect(() => {
    const n = hote.current;
    if (!n) return;

    let vivant = true;
    let dernierL = n.clientWidth;
    let enAttente = 0;

    const retracer = () => {
      const flux = n.querySelector<HTMLElement>(".flux");
      if (flux && vivant) acheverRendu(flux, etapes, { edition });
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
  }, [etapes, edition]);

  /* Les étapes changent à chaque frappe ; une ref évite de recréer tous les
     gestionnaires, et surtout d'en attacher un par rendu. */
  const vues = useRef(etapes);
  vues.current = etapes;
  const emettre = useRef(onMutation);
  emettre.current = onMutation;

  const appliquer = useCallback((m: Mutation) => {
    if (!m) return;
    if (m.refus || m.creation || m.ordre || m.ecritures.length) emettre.current?.(m);
  }, []);

  /* Un seul gestionnaire délégué par type d'évènement, posé sur l'hôte : le
     sous-arbre est réécrit à chaque rendu, des écouteurs individuels seraient
     perdus. */
  const surClic = useCallback((ev: MouseEvent) => {
    const cible = (ev.target as HTMLElement).closest?.("[data-action]") as HTMLElement | null;
    if (!cible) return;
    const et = vues.current;
    const i = cible.dataset.i != null ? Number(cible.dataset.i) : null;
    switch (cible.dataset.action) {
      case "basculer-lien":
        if (i != null) appliquer(cyclerLien(et, i));
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
    }
  }, [appliquer, processus.roles]);

  /* `change` et non `input` : on écrit à la sortie du champ, pas à chaque
     frappe. Une écriture par caractère saturerait le réseau et ferait avancer
     la version du processus en continu, rejetant les collègues sans raison. */
  const surChangement = useCallback((ev: FormEvent) => {
    const champ = (ev.target as HTMLElement).dataset?.champ;
    if (!champ) return;
    const valeur = (ev.target as HTMLInputElement | HTMLTextAreaElement).value;
    const [type, a, b] = champ.split(".");
    if (type === "etape" && b === "texte") appliquer(changerTexte(vues.current, Number(a), valeur));
    else if (type === "phase") appliquer(renommerEchelle(vues.current, Number(a), Number(b), valeur));
  }, [appliquer]);

  /* Glisser-déposer. L'index source vit dans une ref : le sous-arbre est
     réécrit entre le `dragstart` et le `drop`, un état React serait perdu. */
  const glisse = useRef<number | null>(null);

  const surDebutGlisse = useCallback((ev: DragEvent) => {
    const poignee = (ev.target as HTMLElement).closest?.("[data-poignee]") as HTMLElement | null;
    if (!poignee) return;
    glisse.current = Number(poignee.dataset.poignee);
    ev.dataTransfer.effectAllowed = "move";
    ev.dataTransfer.setData("text/plain", String(glisse.current));
    const carte = poignee.closest("[data-index]");
    if (carte) {
      ev.dataTransfer.setDragImage(carte, 24, 20);
      carte.classList.add("flux__carte--glissee");
    }
    fluxNode()?.classList.add("flux--glisse");
  }, []);

  const nettoyerGlisse = useCallback(() => {
    glisse.current = null;
    const n = hote.current;
    if (!n) return;
    fluxNode()?.classList.remove("flux--glisse");
    n.querySelectorAll(".flux__carte--glissee")
      .forEach((el) => el.classList.remove("flux__carte--glissee"));
    n.querySelectorAll(".flux__cellule--cible, .flux__frontiere--cible")
      .forEach((el) => el.classList.remove("flux__cellule--cible", "flux__frontiere--cible"));
  }, []);

  const surSurvol = useCallback((ev: DragEvent) => {
    if (glisse.current === null) return;
    const t = ev.target as HTMLElement;
    const frontiere = t.closest?.("[data-frontiere]") as HTMLElement | null;
    const zone = frontiere || (t.closest?.("[data-cellule]") as HTMLElement | null);
    if (!zone) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = "move";
    hote.current?.querySelectorAll(".flux__cellule--cible, .flux__frontiere--cible")
      .forEach((el) => {
        if (el !== zone) el.classList.remove("flux__cellule--cible", "flux__frontiere--cible");
      });
    zone.classList.add(frontiere ? "flux__frontiere--cible" : "flux__cellule--cible");
  }, []);

  const surDepot = useCallback((ev: DragEvent) => {
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
  }, [appliquer, nettoyerGlisse]);

  /** Règle le zoom pour que tout le diagramme tienne dans la largeur offerte.
      Le pas de 5 % évite un curseur à valeur illisible. */
  const ajuster = useCallback(() => {
    const flux = fluxNode();
    const defile = flux?.parentElement;
    if (!flux || !defile) return;
    const courant = Number(flux.style.zoom) || 1;
    const naturelle = flux.getBoundingClientRect().width / courant;
    const dispo = defile.clientWidth - 4;
    if (naturelle <= 0) return;
    setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.floor((dispo / naturelle) * 20) / 20)));
  }, []);

  return (
    <div className="carte carte--flux">
      {entete ? (
        <div className="flux__entete">
          <span className="libelle libelle--large">Diagramme de flux — l'existant</span>
          <div className="rangee" style={{ gap: 14 }}>
            {etapes.length > 0 ? (
              <div className="flux__zoom ne-pas-imprimer">
                <button type="button" className="bouton bouton--mini" onClick={ajuster}
                        title="Régler le zoom pour tout afficher">
                  Ajuster
                </button>
                <input
                  type="range" min={ZOOM_MIN * 100} max={ZOOM_MAX * 100} step={5}
                  value={Math.round(zoom * 100)}
                  onChange={(ev) => setZoom(Number(ev.target.value) / 100)}
                  aria-label="Zoom du diagramme"
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
      <div
        ref={hote}
        onClick={edition ? surClic : undefined}
        onChange={edition ? surChangement : undefined}
        onDragStart={edition ? surDebutGlisse : undefined}
        onDragEnd={edition ? nettoyerGlisse : undefined}
        onDragOver={edition ? surSurvol : undefined}
        onDrop={edition ? surDepot : undefined}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {etapes.length > 0 ? (
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
                {LIENS[k].libelle}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default DiagrammeFlux;
