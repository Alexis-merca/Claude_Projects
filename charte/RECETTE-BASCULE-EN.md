# Recette de la bascule FR / EN — passe navigateur

Vingt contrôles, ordonnés par **discrétion de la panne** : ce qui casse sans
rien dire d'abord. Même critère que `RECETTE-NAVIGATEUR.md`, dont ce document
est la suite pour tout ce qui touche à la traduction.

**Tout ce qui suit est établi par lecture du code seulement.** Rien n'a jamais
été vu à l'écran : l'agent Lovable n'a pas de session navigateur, et il n'en
aura pas — voir la note de fin de `RECETTE-NAVIGATEUR.md`.

## Avant de commencer

Travailler sur un diagnostic **jetable** : plusieurs contrôles écrivent
volontairement en base, et deux d'entre eux ne valent que sur un diagnostic
**jamais ouvert en anglais** — dès la première bascule le cache se remplit et
la fenêtre de test se referme.

Candidats jetables : `xxx-xx`, `test-06-08`.
**On n'y touche pas** : `sekurit-float-france`, `decathlon-thiais`,
`template-use-case`, `cible-mercateam`, `danone-bailleul`.

Empreintes prises avant la passe — toute empreinte qui bouge sur un site non
touché est un défaut :

| site | étapes | empreinte |
|---|---|---|
| cible-mercateam | 109 | `ecd4d44a` |
| danone-bailleul | 121 | `512842fd` |
| decathlon | 0 | `d41d8cd9` |
| decathlon-thiais | 41 | `71eef4d3` |
| sekurit-float-france | 66 | `a424f3b3` |
| template-use-case | 141 | `0277335f` |
| test-06-08 | 78 | `26d10ef1` |
| xxx-xx | 17 | `8c33982e` |

(`md5` du texte, de la phase, des deux rôles et des supports de chaque étape.)

## A — Le relevé peut être détruit sans qu'on le voie

Le seul niveau où une erreur ne se rattrape pas. Règle unique à vérifier :
**taper sur un écran anglais corrige la traduction, ça ne réécrit jamais le
français.**

**A1 — Corriger un texte en anglais.** Mode Modifier, écran EN. Reformuler le
texte d'une carte, sortir du champ, repasser en FR.
*Attendu* : le français est exactement celui d'avant, au caractère près ; en EN,
la phrase anglaise est là.

**A2 — La même chose, avant que la traduction arrive.** Sur un diagnostic jamais
ouvert en anglais : basculer en EN et taper tout de suite, pendant que l'écran
est encore français. Sortir, attendre, repasser en FR.
*Attendu* : le relevé français est intact. Défaut trouvé le 20/08, il ne se
voyait que dans cette fenêtre.

**A3 — Effleurer des champs sans rien taper.** En EN, entrer et sortir de six
champs sans toucher au clavier.
*Attendu* : rien n'a bougé. Afficher ne modifie jamais.

**A4 — Écrire une étape neuve en anglais.** L'ajouter et la libeller en EN,
repasser en FR.
*Attendu* : elle s'affiche en français, traduite — l'anglais est devenu la
source, le français la vue calculée.

## B — Le geste ne fait rien, ou fait autre chose

Tout en EN, mode Modifier.

**B1 — Couper une échelle de temps.** *Attendu* : une nouvelle échelle apparaît,
comme en français. Ce geste était avalé en silence avant `0fbdd26`.

**B2 — Renommer une échelle.** *Attendu* : en FR, le nom français d'origine
revient ; en EN, le nom tapé.

**B3 — Déplacer une étape sur un autre couloir**, puis sur une frontière.
*Attendu* : en FR, l'étape est dans le bon couloir ; aucun couloir fantôme.

**B4 — Ajouter puis retirer un support.** *Attendu* : noms d'outils français en
FR, et l'environnement IT range l'outil dans son bloc habituel — pas dans
« Non classé ».

**B5 — Créer un outil à la main** (« Autre outil… »). *Attendu* : une boîte du
site, jamais celle du navigateur ; l'outil rejoint la liste du site.

## C — L'écran ment

**C1 — Les couloirs gardent leurs couleurs.** *Attendu* : chaque rôle garde
exactement sa teinte en EN. Mesuré cassé le 20/08 : les quatre couloirs
prenaient la même couleur.

**C2 — Le mode bilan est traduit.** *Attendu* : diagramme en anglais — cartes,
couloirs, badges. C'est l'écran projeté au client.

**C3 — L'environnement IT classe pareil dans les deux langues.** *Attendu* :
mêmes outils, mêmes blocs. Un outil qui glisse vers « Unclassified » signifie
qu'une traduction a atteint une clef.

**C4 — Nom du site, date de visite, nom du client.** Les modifier en EN,
recharger. *Attendu* : les valeurs tiennent — ce sont des identifiants, pas de
la prose.

**C5 — La colonne Supports de la saisie rapide.** La modifier en EN, recharger.
*Attendu* : la modification tient ; en lecture les noms s'affichent traduits.

## D — Livré, jamais affiché

Sans rapport avec la traduction. À faire en FR.

**D1 — Le popup d'étape.** Créer une friction et un chiffre depuis le popup,
écrire une note interne. *Attendu* : les panneaux du bas se mettent à jour sans
rechargement ; le chiffre est rattaché à l'étape.

**D2 — Lignes vides de l'environnement IT et « Ranger ».** *Attendu* : le
compteur de lignes repliées dit juste ; le rangement porte sur l'outil désigné,
pas sur ses voisins de ligne.

**D3 — Le nom de l'outil au survol** de l'icône dans le diagramme.

**D4 — Couleurs d'outils et teinte choisie d'un rôle.** *Attendu* : `EFIplan` et
`Effitime` ne partagent ni couleur ni initiale ; la teinte choisie tient d'un
onglet à l'autre.

**D5 — Le refus de supprimer un rôle** nomme l'étape : numéro, libellé, et
combien d'autres.

**D6 — Les libellés de chiffres clés** s'affichent en entier.

## Si la passe doit être écourtée

**A1, A2, B1, C1.** Les deux premiers protègent le relevé ; les deux autres sont
des défauts mesurés puis corrigés le 20/08, jamais revus à l'écran.
