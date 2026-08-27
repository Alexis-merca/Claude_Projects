/* Gras et italique dans un texte d'étape — la partie React.
 *
 * COPIE MIROIR de `src/lib/texte-riche.tsx` du projet Lovable. Seul l'import du
 * moteur diffère (`./moteur.js` au lieu de `@/flux/moteur.js`), parce que ce
 * dépôt n'a pas l'alias de chemin. Tout le reste doit rester identique.
 *
 * LE STOCKAGE EST DU TEXTE BRUT, avec des marqueurs : `**gras**`, `_italique_`.
 * La conversion en balisage vit dans `moteur.js` (`texteRiche`), parce que
 * c'est le moteur qui rend le texte en lecture. Ce fichier ne la redéfinit PAS :
 * deux implémentations divergeraient, et l'écran finirait par rendre autrement
 * que la restitution — qui est la seule vue qui compte en salle.
 *
 * `dangerouslySetInnerHTML` est ici un choix mesuré, pas une facilité :
 * `texteRiche` ÉCHAPPE D'ABORD et convertit ENSUITE, donc la chaîne remise à
 * React ne contient que du texte échappé plus `<strong>` et `<em>`. Ne jamais
 * inverser cet ordre, et ne jamais passer ici une chaîne d'une autre source.
 */

import { texteRiche } from "./moteur.js";

/** Rendu de lecture d'un texte d'étape. */
export function TexteRiche({ texte, className }: { texte: string; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: texteRiche(texte) }} />;
}

/** Bascule d'un marqueur sur une sélection de `<textarea>`.
 *
 * Trois cas, dans cet ordre :
 *   1. la sélection est DÉJÀ entourée des marqueurs (dedans ou dehors) → on les
 *      retire — un second clic défait le premier, comme dans un traitement de
 *      texte ;
 *   2. sélection non vide → on l'entoure ;
 *   3. sélection vide → on pose la paire et on place le curseur entre les deux.
 *
 * Retourne le texte suivant et la sélection à reposer : c'est l'appelant qui
 * écrit dans le champ, parce que lui seul sait s'il doit aussi prévenir React. */
export function basculerMarqueur(
  texte: string,
  debut: number,
  fin: number,
  marqueur: "**" | "_",
): { texte: string; debut: number; fin: number } {
  const n = marqueur.length;
  const dedans = texte.slice(debut, fin);

  /* Marqueurs INCLUS dans la sélection : « **gras** » sélectionné en entier. */
  if (dedans.length >= 2 * n && dedans.startsWith(marqueur) && dedans.endsWith(marqueur)) {
    const nu = dedans.slice(n, -n);
    return { texte: texte.slice(0, debut) + nu + texte.slice(fin), debut, fin: debut + nu.length };
  }

  /* Marqueurs JUSTE AUTOUR : « gras » sélectionné entre ses deux étoiles. */
  if (
    texte.slice(Math.max(0, debut - n), debut) === marqueur &&
    texte.slice(fin, fin + n) === marqueur
  ) {
    return {
      texte: texte.slice(0, debut - n) + dedans + texte.slice(fin + n),
      debut: debut - n,
      fin: fin - n,
    };
  }

  const suivant = texte.slice(0, debut) + marqueur + dedans + marqueur + texte.slice(fin);
  return { texte: suivant, debut: debut + n, fin: fin + n + dedans.length };
}

/** Le geste complet sur une zone de saisie : bascule, réécriture, sélection
    reposée, et un évènement `input` pour que la hauteur de la carte suive.

    L'ÉCRITURE PASSE PAR LE SETTER NATIF, PAS PAR `zone.value`. React installe
    un suivi de valeur sur les champs qu'il contrôle ; écrire directement sur la
    propriété le contourne et l'évènement `change` qui suit part alors avec une
    valeur que React croit inchangée. Le champ des cartes n'est pas contrôlé par
    React aujourd'hui, mais cette précaution ne coûte rien et évite un défaut
    silencieux le jour où il le deviendrait. */
export function appliquerMarqueur(zone: HTMLTextAreaElement, marqueur: "**" | "_") {
  const r = basculerMarqueur(zone.value, zone.selectionStart, zone.selectionEnd, marqueur);
  const poser = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  if (poser) poser.call(zone, r.texte);
  else zone.value = r.texte;
  zone.setSelectionRange(r.debut, r.fin);
  zone.dispatchEvent(new Event("input", { bubbles: true }));
  zone.focus();
}
