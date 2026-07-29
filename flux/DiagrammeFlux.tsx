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
import { acheverRendu, baliserFlux, LIENS, tracerFleches } from "./moteur.js";
import type { EtapeFlux, ProcessusFlux } from "./moteur.js";
import "./moteur.css";

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
}

export function DiagrammeFlux({
  processus,
  etapes,
  paletteRoles,
  outils,
  edition = false,
  etapeActive = null,
  entete = true,
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
      <div ref={hote} dangerouslySetInnerHTML={{ __html: html }} />

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
