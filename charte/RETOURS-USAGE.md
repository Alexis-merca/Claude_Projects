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

---

## 2026-08-18 — deuxième série, sur usage réel

Neuf retours d'un même passage sur l'application, avec captures. Sept écrans.
L'utilisateur venait de créer un vrai diagnostic (`danone-bailleul`) et
d'essayer la note interne livrée le jour même.

### 3. Le nom du support n'apparaît nulle part — **CASSÉ**

**Où** : cartes du diagramme, pastilles de support.

**Vu** : une icône, sans nom, sans infobulle, sans légende.

**Attendu** : savoir de quel outil il s'agit sans le deviner.

**Où ça vit** : `badgeSupport()` dans `moteur.js`. La fonction produit un SVG
sans `title` ni `aria-label`. **Zone moteur.**

### 4. Les libellés des chiffres clés sont coupés — **CASSÉ** *(écran 1)*

**Vu** : « collaborateurs sur », « rotation du personn… », « temps de
construct… », « préparation des en… » — six libellés sur six tronqués.

**Où ça vit** : `PanneauChiffres`, champ de largeur fixe. **Zone à nous.**
Le plus petit correctif de toute la liste.

### 5. Un rôle refuse de se supprimer sans dire où il sert — **CASSÉ** *(écran 2)*

**Vu** : « Le rôle *Manager service et expérience client* est encore utilisé par
une étape. Réaffectez-la avant de le supprimer. » Le couloir paraît vide à
l'écran.

**Lecture de l'utilisateur** : « il est utilisé dans un autre UC ». C'est
**impossible** — `processus.roles` est propre à chaque processus, un rôle de
même nom dans un autre use case est une autre donnée. L'étape fautive est donc
dans CE processus, hors du champ visible, ou désignée par `role2`.

**Ce que ça révèle, et qui vaut plus que le défaut** : le refus est juste mais
**muet sur le lieu**. Un garde qui dit « quelque chose vous en empêche » sans
dire quoi transforme une protection en impasse — l'utilisateur a conclu à un
bug du produit. **Le message doit nommer l'étape** (numéro et texte).

### 6. Pas de retour arrière — **MANQUE**

Aucun annuler / refaire. Les instantanés de version existent (`versions`,
`PanneauVersions`) mais se prennent une fois par jour : ils rattrapent une
séance, pas un geste.

### 7. L'environnement IT occupe tout l'écran — **CASSÉ** *(écran 3)*

**Vu** : douze blocs, chacun avec ses lignes « aucun outil », sur plusieurs
écrans de haut.

**Ce qui existe déjà** : `sansLignesVides()` — écrite, utilisée à l'impression
et en PPTX, **jamais à l'écran**. Le choix était délibéré (« une ligne vide dit
ce qui n'a pas encore été relevé ») mais il n'a jamais été confronté à douze
blocs réels.

### 8. Le bloc « Non classé » affiche chaque nom deux fois — **CASSÉ** *(écran 4)*

**Vu** : `MyGame` en libellé de ligne ET en pastille sur la même ligne, dix
fois de suite. Et aucun moyen de ranger ces outils dans un vrai bloc.

**Pourquoi c'est structurel** : `classer()` rend `{ bloc: "non-classe",
etape: outil }` pour un outil inconnu — le nom de l'outil **est** le nom de
l'activité. Le doublon n'est pas un bug d'affichage, c'est le modèle qui
transparaît.

### 9. Tous les outils clients ont la même icône — **CASSÉ** *(écran 5)*

**Vu** : `MyGame`, `EFIplan`, `GPLine`, `PeopleSync`, `Info Sociale`,
`Decathlon University` — tous la même fenêtre indigo.

**Pourquoi** : `BADGES_SUPPORT` couvre sept familles par motifs (Excel,
PowerPoint, SharePoint, Word/papier, mail, vidéo, oral) ; tout le reste tombe
sur `BADGE_DEFAUT`. Or **un outil maison ne sera jamais dans une liste de
motifs** : allonger la liste ne règle rien, c'est le repli qui doit changer.

Piste : une couleur **dérivée du nom**, comme `paletteStable` le fait déjà pour
les rôles — fonction pure, donc `EFIplan` garde sa teinte partout et d'un
client à l'autre. **Zone moteur.**

### 10. On écrit à l'aveugle dans les cartes — **CASSÉ** *(écran 6)*

**Vu** : le `textarea` d'une carte montre deux mots à la fois.

**Où ça vit** : `carte__texte`, `rows="1"`, dans `moteur.js`. **Zone moteur.**

### 11. Il faut une bascule FR / EN — **MANQUE, et c'est le gros morceau** *(écran 7)*

**Demandé** : l'interface en anglais, le contenu saisi inchangé.

**Ce que la lecture du code apprend :**

- **Les blocs IT ont déjà clef et libellé séparés** (`clef: "sirh"`,
  `nom: "SIRH & GTA"`) — traduisibles. Réserve : dès qu'un site enregistre sa
  structure, le libellé français est **figé dans `clients.si`**.
- **Les activités, non.** `TABLE_A` range un outil vers `"Visites médicales"`,
  et `vueEnvIT` apparie sur `normaliser(sujet)`. Traduire ces chaînes casserait
  le classement. **La traduction doit donc être un habillage d'affichage,
  jamais un renommage** — sinon on ouvre §3a de la feuille de route, la seule
  entrée que ce document qualifie de vraiment chère.
- **Le moteur parle français en dur** : « Ajuster », « Saisie rapide »,
  « Autre outil… », « + Première étape », « Décaler à gauche », « Insérer une
  étape après », « Déposer ici », « + Rôle »… **Zone moteur.**
- Les **échelles de temps** (`À L'EMBAUCHE`, `1ER JOUR`…) sont du contenu
  (`etapes.phase`) : elles ne se traduisent pas.
- Les **dix échelles de maturité** (50 libellés) sont de l'outil : à traduire.

**Verdict** : quatre des neuf retours — 3, 9, 10 et une part de 11 — tombent
dans `src/flux/`, tenu pour intouchable et copié en **trois** exemplaires
(`src/flux/` chez Lovable, `flux/` et `diagnostic-os.html` au dépôt). C'est la
décision à prendre avant toute autre.

### Retiré de la liste

Le **glisser-déposer d'une étape vers un autre acteur** figurait dans la série.
Vérification faite avant d'y toucher : il est **entièrement implémenté** —
`deposerEtape()` dans `mutations.js` (avec adoption de la phase du voisin et
gestion du dépôt sur une frontière à deux rôles), poignée `draggable` posée par
`moteur.js:375`, infobulle « Glisser sur un autre couloir… ». L'utilisateur a
confirmé ensuite : **« ça fonctionne bien »**.

Une minute de lecture a évité de reconstruire une fonctionnalité existante.
