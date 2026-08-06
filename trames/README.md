# Trame « Template use case »

`template-use-case.json` est la conversion de
`Templates_diagnostic_Mercateam_v2.xlsx` au format d'import de Diagnostic OS
(`client_json`, version 1). Il s'importe par **Importer un JSON → nouveau
diagnostic** et crée un diagnostic nommé « Template use case ».

**10 processus, 141 étapes, 0 friction, 0 chiffre clé.**

| Onglet du classeur | Processus | Étapes | Rôles |
|---|---|---|---|
| Pilotage compétences | UC 6 — Pilotage des compétences | 12 | 4 |
| Planification et gestion aléas | UC 1 — Planification des opérateurs | 17 | 5 |
| Pilotage Charge capacité | UC 2 — Adéquation charge / capacité | 17 | 9 |
| Intégration | UC 3 — Intégration des nouveaux collaborateurs | 15 | 7 |
| Transfert savoir-faire | UC 4 — Savoir-faire critiques | 23 | 10 |
| Standardisation sites | UC 5 — Standardisation multi-sites | 12 | 5 |
| Habilitations | UC 7 — Habilitations et sécurité au poste | 14 | 7 |
| Audits | UC 8 — Préparation et tenue des audits | 11 | 4 |
| Équité affectations | UC 9 — Équité et traçabilité | 10 | 5 |
| Reconnaissance | UC 10 — Reconnaissance et rémunération | 10 | 6 |

## Comment les colonnes se posent

| Classeur | Diagnostic OS | Pourquoi |
|---|---|---|
| `ACTION RELEVÉE` | `etapes[].texte` | — |
| `RÔLE` | `etapes[].role` | le couloir du logigramme |
| `SUPPORTS` | `etapes[].supports` | — |
| `QUAND` | `etapes[].phase` | le bandeau de frise au-dessus des colonnes |
| `ORDRE` | position dans le tableau | l'importeur renumérote sur l'index |
| `N°` | rien | ne sert qu'à départager deux étapes de même `ORDRE` |

**`QUAND` → `phase`** est le seul choix qui demande une justification. C'est le
seul champ libre qui reste, et c'est le bon : la frise groupe les étapes
consécutives de même libellé en bandeaux au-dessus du diagramme, ce qui rend
la fréquence lisible d'un coup d'œil. Le mode d'emploi du classeur dit que le
QUAND est « le meilleur détecteur d'irritant » — le mettre ailleurs qu'à
l'écran l'aurait enterré. Le vocabulaire concorde d'ailleurs avec celui des
phases du mono-fichier d'origine : `M-1`, `S-1`, `Jour J`, `J+X`.

## Trois règles de format qui ne se devinent pas

**Les supports se séparent par une virgule, pas par un `+`.** `listeSupports`
(`src/flux/moteur.js`) découpe sur la virgule et sur rien d'autre. Les
combinaisons du référentiel (`Papier + Mail`) sont donc réécrites en
`Papier, Mail`, sans quoi elles formeraient un seul outil fantôme dans
l'environnement IT.

**Une virgule dans un nom d'outil le coupe en deux.** `Logiciel (GED, ex VDOC)`
serait découpé en `Logiciel (GED` et `ex VDOC)`. Réécrit en `Logiciel (GED)`.
Même chose pour `Logiciel (autre, à préciser)` → `Logiciel (autre)`.

**Un rôle absent de `processus.roles` est effacé sans un mot.**
`importer_client_json` vérifie l'appartenance et remplace par la chaîne vide.
Chaque processus déclare donc tous les rôles qu'il emploie, dans l'ordre du
référentiel — le même pour les dix processus, pour qu'un rôle garde une
hauteur de couloir comparable d'un onglet à l'autre.

## Ce qui n'a pas été rempli

**Aucune friction, aucun chiffre clé.** Le classeur n'en porte pas : ce sont
les deux choses qui se relèvent en entretien. Les fabriquer aurait donné une
trame qui a l'air complète et qui ne dit rien.

**L'onglet « Transverse - Preuves » n'existe pas dans le fichier.** La table de
correspondance de la page de garde l'annonce (ligne `Transv.`, « Inventaire des
preuves de formation et d'habilitation »), et l'onglet Audits y renvoie
(« À croiser avec l'onglet Transverse - Preuves »), mais le classeur ne contient
que dix onglets use case. Rien n'a été inventé pour combler le trou.

**`si` est vide.** L'environnement IT se recalcule depuis les supports des
étapes à chaque affichage — il se remplira tout seul à l'import.

## Régénérer

```
python3 xlsx-vers-json.py     # produit le JSON
python3 verification.py       # rejoue les règles de l'importeur sur le résultat
```

`verification.py` ne fait pas confiance au JSON : il recopie `TABLE_A`,
`GENERIQUES` et `TABLE_B` de `src/lib/environnement-it.ts` et rejoue le
classement outil par outil. C'est ce qui a mis au jour la collision
`erp` / `PowerPoint` décrite ci-dessous.

## Deux réserves relevées à la vérification

**`PowerPoint` atterrit dans le bloc ERP.** Le motif `erp` de `TABLE_A` est
cherché en sous-chaîne, et `pow`**`erp`**`oint` le contient. Le défaut est dans
`src/lib/environnement-it.ts`, pas dans cette trame : le commentaire du fichier
signale déjà le même piège pour `mes` / `Messagerie`, mais `erp` y a échappé.
Aucun diagnostic existant n'utilise PowerPoint, le défaut est donc dormant
aujourd'hui — cette trame est ce qui le réveillerait.

**Une étape porte un support `Logiciel` sans précision.** Elle vient de la
combinaison `Papier + Logiciel` du référentiel (UC 7, enregistrement des titres
et CACES). Conservée telle quelle : c'est la source qui est imprécise, et
`Logiciel` en « Non classé » est le bon signal pour le consultant.

---

# Trame « cible Mercateam »

`cible-mercateam.json` porte les dix mêmes use cases, **après** déploiement.
`PROCESSUS-CIBLE.md` est le même contenu sous forme relisible.

**10 processus, 109 étapes** — contre 141 pour l'existant, soit 32 étapes de
moins pour le même périmètre.

Les **codes de processus sont identiques** de part et d'autre
(`pilotage-competences`, `habilitations`…) : c'est ce qui permettra d'apparier
existant et cible quand la variante sera en place, sans dépendre du nom, qu'un
consultant peut renommer.

## D'où viennent les étapes

Des « User Journey » de la base de connaissance Top Use Cases Mercateam. **Rien
n'a été inventé sur ce que fait le produit** : là où le journey ne décrit rien,
aucune étape n'a été ajoutée. Un processus cible court est un processus cible
honnête.

## Relecture du 06/08 : 16 étapes réécrites, 2 supprimées

Le mode d'emploi du classeur fixe la règle : « ACTION RELEVÉE — l'action telle
qu'elle se pratique aujourd'hui, **verbe au présent**, formulation routine ».
Dans un logigramme à couloirs, le sujet de la phrase doit être le rôle du
couloir. Le premier jet de la cible dérivait de cette règle : seize étapes
étaient écrites comme des promesses produit, sujet passif ou outil en sujet —
« la matrice se met à jour », « l'outil refuse d'affecter », « les preuves sont
générées ». Toutes réécrites en action du rôle.

Mesure : `0` étape sur 109 dont le sujet n'est pas le rôle, contre `0` sur 141
dans la trame de l'existant. Avant relecture, la cible en comptait 16.

**Deux étapes supprimées, pas réécrites :**

- UC 7, « Les limites de temps de travail et de temps sur poste contraignant
  sont contrôlées à l'affectation » — le *User Journey* d'UC 7 ne dit rien des
  limites de temps de travail. Elles figurent dans celui d'UC 9, où l'étape
  existe déjà. C'était une extrapolation, exactement ce que ce document
  s'interdit.
- UC 8, « Le dossier n'est pas reconstitué : il est déjà à jour » — ce n'est pas
  une action, c'est une conclusion. Une étape qui dit « on ne fait plus ça »
  n'est pas une étape : elle disparaît, et c'est précisément ce que l'avant/après
  doit montrer.

## Ce que la cible ne prétend pas remplacer

Le SIRH et la GTA restent la source des absences et des temps, l'ERP reste la
source de la charge. Mercateam s'y branche. Les faire disparaître du schéma
donnerait un avant/après flatteur et faux — et un client industriel le verrait.

## Une entrée manque dans le classement des outils

Les cinq modules Mercateam tombent aujourd'hui dans **« Non classé »** :
`TABLE_A` de `src/lib/environnement-it.ts` ne connaît pas le produit. Le schéma
« après » est donc illisible tant que ce n'est pas corrigé.

Cinq entrées suffisent, et elles tombent sur des blocs qui existent déjà :

| motif | bloc | activité |
|---|---|---|
| `mercateam (starter)` | `competence` | Référentiel postes |
| `mercateam (master)` | `competence` | Matrice de polyvalence |
| `mercateam (trainer)` | `formation` | Suivi + évaluation |
| `mercateam (planner)` | `planning` | Affectation au poste |
| `mercateam (kpis)` | `bi` | Indicateurs de polyvalence |

Attention à l'ordre : un motif `mercateam` nu capterait les cinq. S'il en faut
un comme filet, il doit venir **après** les entrées précises.

**Et cela ne suffira pas.** Un outil n'est placé qu'une fois, par le premier
processus qui l'emploie (`PASSE-STATIQUE.md` §14). Or l'argument de la cible est
précisément qu'**un seul outil couvre plusieurs blocs**. Le classement
multi-blocs, rangé en vague 4 de la feuille de route, est donc un prérequis du
rendu avant/après, pas un confort.
