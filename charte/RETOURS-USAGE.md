# Retours d'usage

Ce que l'utilisateur constate **en se servant réellement de l'application**.
Distinct de `RECETTE-NAVIGATEUR.md`, qui est une liste à parcourir, et de
`INSPECTION-PARCOURS.md`, qui vient de la lecture du code.

Format : où (client + écran), ce qui a été vu **vs** ce qui était attendu, et une
étiquette **CASSÉ** ou **MIEUX**. La gravité et l'ordre de traitement sont
déduits ensuite, pas demandés à l'utilisateur.

---

## 2026-08-17

### 1. Le diagramme perd sa place à chaque écriture — **CASSÉ → RÉSOLU le 18/08**

**Où** : écran de diagnostic, diagramme de flux, en mode modifier.

**Vu** : à chaque ajout d'étape, ajout de support ou modification, le
défilement horizontal repart au début et le zoom se réinitialise.

**Attendu** : rester exactement où on était.

**Ce que ça confirme** : le défaut **F** de `INSPECTION-PARCOURS.md`, écrit le
07/08 à partir du code seul, avec la réserve « à confirmer au navigateur, mais
aucun code ne s'en occupe ». **C'est confirmé.** Et c'est le premier retour
d'usage réel du projet.

L'inspection supposait le zoom correctement traité — il vit dans une `Map` par
processus, au niveau de la page, ce qui le fait survivre au démontage d'onglet
par Radix. L'usage montre qu'il se réinitialise quand même **à la mutation**.
Deux causes probables et distinctes : le moteur reconstruit le balisage, donc le
conteneur de défilement perd sa position ; et l'observateur du diagramme remet
son curseur à 100 % — comportement déjà rencontré sur la vue d'impression, où
le commentaire de `impression.$code.tsx` le documente.

**Traitement** : correction demandée dans l'enveloppe React
(`DiagrammeAvecZoom.tsx`), `src/flux/` restant intouchable. Mémoriser en continu
plutôt que capturer avant la reconstruction — quand l'observateur se déclenche,
la position est déjà perdue.

**Risque identifié dans le brief** : réécrire le curseur de zoom déclenche un
événement `input` que le moteur traite en re-rendant, ce qui réveille
l'observateur — boucle. Consigne de repli donnée : corriger le défilement seul
plutôt que de livrer un diagramme qui clignote.

**Leçon de méthode.** Ce défaut était écrit noir sur blanc depuis dix jours,
avec la mention qu'il n'avait pas été vérifié. Il a fallu qu'un humain se serve
de l'application pour qu'il devienne prioritaire. C'est l'argument le plus net
en faveur de la recette navigateur : la lecture du code trouve les défauts, elle
ne dit pas lesquels font mal.

**Résolu** (`0b6b774`, §37), et **confirmé par l'utilisateur dans le navigateur**
le 18/08 : « ça marche, plus de saut ». Premier défaut de l'inspection dont la
correction est vérifiée par l'usage et non par une mesure d'agent.

Le diagnostic mesuré a contredit l'hypothèse du brief : une seule cause, pas
deux. Le moteur ne remet rien à 100 % — le balisage neuf naît simplement sans
défilement ni zoom, et tout se joue dans la fenêtre avant que l'enveloppe les
repose.

---

## 2026-08-18

### 2. Le bouton « Saisie rapide » ne se monte pas — **CASSÉ → RÉSOLU le 18/08**

**Où** : écran de diagnostic, en-tête du diagramme de flux, mode modifier.

**Vu** : aucun bouton « Saisie rapide » dans le DOM. Le conteneur cible
`.flux__entete .rangee` existe pourtant (1 nœud), y compris après bascule
d'onglet de processus et retour.

**Attendu** : le bouton, greffé par portail depuis `BoutonSaisieRapide`.

**Trouvé par** : la seconde passe de recette navigateur, pendant l'exécution
d'un tout autre contrôle. C'est le premier défaut que la recette découvre par
elle-même, sans qu'on le cherche.

**Pourquoi c'est grave, et bien plus que le confort qu'il paraît.** La saisie
rapide est le seul endroit d'où l'on peut écrire **`etapes.cible`**. Si le
bouton ne se monte pas, la cible — livrée le 09/08, avec sa page
« Trajectoire de déploiement » à l'impression — **n'est atteignable par
personne**. Toute cette fonctionnalité serait inerte depuis sa livraison, ce qui
expliquerait qu'aucune cible ne figure en base après dix jours.

**Cause probable, à confirmer** : l'effet de `BoutonSaisieRapide` ne s'exécute
qu'au montage (`[hote]`) et lit `hote.previousElementSibling` pour trouver
`.flux__entete .rangee`. Si le diagramme n'est pas encore rendu à cet instant,
`cible` reste `null` et le portail ne se pose jamais. Le défaut serait donc
**intermittent** — dépendant de l'ordre de rendu —, ce qui est pire qu'une
panne franche : il a pu marcher une fois, sous les yeux de quelqu'un, et ne plus
jamais se reproduire.

**Cette hypothèse était fausse, et fausse du côté rassurant.** La mesure DOM
montre que `[data-diagram-slot]` contient, dans l'ordre : le diagramme, le
`div.contents` de `PastillesFrictions`, celui de `MarquesBilan`, puis l'hôte du
bouton. Le frère précédent était donc **toujours** une enveloppe de portails,
jamais le diagramme, quel que soit l'ordre de rendu. Le défaut n'était pas
intermittent, il était **total** : ce bouton n'a jamais fonctionné une seule
fois depuis qu'il a été écrit.

Conséquence : le « 0 cible en base après dix jours » n'était pas du non-usage,
comme `FEUILLE-DE-ROUTE.md` §2b le supposait, mais de l'**inatteignable**.

**Résolu** (`b2650b6`, `PASSE-STATIQUE.md` §46). La cible se cherche depuis
`hote.closest("[data-diagram-slot]")` et un `MutationObserver` la reprend à
chaque reconstruction du balisage, avec la garde de réentrance de
`PastillesFrictions`. Prouvé au navigateur jusqu'au bout du chemin réel :
bouton présent, survivant à la bascule d'onglet et à une mutation du diagramme,
0 mutation au repos ; puis clic, mode bilan, colonne Cible éditable, écriture
relue en base, remise à vide. **C'est la première fois que ce chemin est
parcouru en entier.**
