# Diagnostic OS — feuille de route

Fusion des pistes relevées à la lecture du code (passe du 06/08) et des deux
demandes d'Alexis : **voir un avant/après Mercateam** et **choisir les use cases
à la création d'un diagnostic**.

Rangé par vagues, pas par ordre de préférence : chaque vague ouvre la suivante.

---

## Vague 1 — en cours

Envoyé à Lovable le 06/08. Voir `PASSE-STATIQUE.md` pour la vérification.

- **Rattacher les frictions aux étapes.** `frictions.etape_id`, nullable,
  `ON DELETE SET NULL`. Le lien voyage dans le JSON sous forme d'`ordre`,
  jamais d'uuid — les identifiants ne survivent pas à `importer_client_json`.
  Pastille sur la carte du diagramme, greffée par portail : `moteur.js` reste
  intouché.
- **Niveau de maturité par processus.** `maturite` 1–5 nullable +
  `maturite_note`. Pas de moyenne dans l'en-tête : les use cases ne sont pas
  commensurables.

**Reste à trancher :** les cinq niveaux n'ont de libellé dans aucune source du
projet. Une échelle sans définition partagée dérivera d'un consultant à l'autre.

---

## Vague 2 — la trame devient un produit

> Demande d'Alexis : « quand nouveau diagnostic, demander quel process / use
> case sont audités pour donner un template prêt à l'emploi ».

Aujourd'hui, partir de la trame suppose d'exporter un fichier JSON, le
retrouver, l'importer. La trame est pourtant déjà en base (`template-use-case`,
10 processus, 141 étapes) et `duplication.ts` existe.

**Cible.** « Nouveau diagnostic » demande le nom du site, la date, puis affiche
les onze use cases avec leur nom commercial et leur périmètre. On coche ceux
qui seront audités, on obtient un diagnostic pré-rempli des seuls processus
retenus.

**Ce que ça suppose.** Une notion de *trame* distincte d'un diagnostic client :
soit un drapeau sur `clients`, soit une table à part. Le drapeau est moins cher
et suffit — mais il faut alors que les trames n'apparaissent pas dans la liste
des diagnostics, ne comptent pas dans les statistiques, et ne puissent pas être
supprimées par mégarde.

**Pourquoi cette vague avant l'avant/après.** Les processus cible Mercateam
sont du contenu de trame. Sans bibliothèque, ils n'ont nulle part où vivre.

---

## Vague 3 — l'avant / après Mercateam

> Demande d'Alexis : « voir un avant/après Mercateam des process / use case
> (support utilisé, nouveau process…) ».

C'est la demande la plus lourde, et celle qui a le plus de valeur commerciale :
elle transforme un état des lieux en démonstration.

### Le modèle

Un processus porte une **variante** : `existant` ou `cible`, et un lien vers son
jumeau. La cible est un processus ordinaire — elle hérite donc gratuitement du
diagramme, des frictions, des chiffres clés et des couloirs.

**Le gain le plus important est acquis sans une ligne de code
supplémentaire :** `calculEnvIT` déduit l'environnement IT des supports des
étapes. Si les étapes cible portent « Mercateam » là où les étapes existantes
portent « Excel » et « Papier », l'environnement IT *après* se dessine tout
seul, avec ses échanges. C'est exactement le slide attendu en restitution.

### L'ergonomie à trancher

Dix use cases audités font dix onglets. Doubler les onglets pour porter les
cibles en fait vingt, ce qui est inutilisable.

**Recommandation : un interrupteur « Existant / Cible » au niveau de la page**,
qui bascule tout le document d'un coup — dix onglets, deux états. L'impression
peut alors produire les deux jeux de pages à la suite.

### En deux temps

**3a.** Dupliquer un processus en cible, le marquer, l'éditer normalement.
Comparaison au niveau du processus : nombre d'étapes, outils employés de part
et d'autre, maturité actuelle contre maturité visée. Peu coûteux, et suffit
déjà à produire le slide IT avant/après.

**3b.** Correspondance étape à étape (`origine`, porté dans le JSON par
l'`ordre` comme pour les frictions), pour rendre sur le diagramme les étapes
**supprimées**, **dont le support change**, et **nouvelles**. C'est le rendu
que tout le monde a en tête, et c'est aussi la partie chère.

### Le vrai coût n'est pas le code

Il faut **écrire les dix processus cible Mercateam**. Ce sont dix logigrammes,
au même niveau de détail que les trames existantes. Tant qu'ils n'existent pas,
la fonctionnalité est une coquille. C'est un travail de contenu, comparable à
celui qui a produit `Templates_diagnostic_Mercateam_v2.xlsx`.

### Ce que la vague 1 apporte ici

Avec la maturité en place, l'avant/après se prolonge naturellement en
**maturité actuelle → maturité visée**, par use case. C'est l'argument ROI,
et il ne coûte rien de plus une fois les deux briques posées.

---

## Vague 4 — ce qui rend la restitution juste

**Un outil générique ne devrait pas être enfermé dans un seul bloc.**
*Envoyé à Lovable le 07/08, avec le correctif ci-dessous.*

`calculEnvIT` court-circuite sur `if (!placements.has(clef))` : le premier
processus rencontré décide pour tous les autres. Mesuré sur la trame : Excel,
Word et Mail sont étiquetés « Compétences » pour les dix use cases, parce que
UC 6 est en tête de liste. Le code fait ce qu'il annonce, mais le résultat est
faux en restitution — Excel est justement l'outil commun de tout le site — et
il dépend de l'ordre des onglets. Voir `PASSE-STATIQUE.md` §14.

Le défaut ne touche que les outils **génériques** : un outil de la table A ou un
outil inconnu se classe sans regarder le processus. `cible-mercateam` ne compte
donc aucun outil multi-blocs — c'est l'« avant » qui est faux, pas l'« après ».

L'unité de placement passe de l'outil au couple **(outil, bloc)**. Le schéma
d'échanges, lui, garde **une boîte par outil** : les positions y sont indexées
par nom, les flèches vont d'outil à outil, et six boîtes Excel multiplieraient
les flèches pour dire quelque chose de faux — c'est le même Excel qui échange
avec Padoa. Les outils répétés sont **estompés** dans la mosaïque, avec une
légende qui survit à l'impression.

**Le bloc d'un processus catalogué vient de sa clef de use case.** Corollaire
découvert en mesurant : `blocDuProcessus` devine le bloc depuis le *nom*, et
trois use cases sur dix n'y matchent rien — UC 2, UC 4, UC 5 tombaient en
« Non classé ». `processus.use_case` existe depuis la vague 1 ; une table
`uc1…uc10 → bloc` supprime la devinette. La table B reste, pour les processus
libres. Fait dans le même envoi : le multi-blocs seul n'aurait fait que
multiplier proprement un mauvais classement.

**Les frictions transverses.** Une friction isolée est un incident, la même sur
trois processus est un problème d'organisation. C'est ce que prévoyait la spec
§8 avant d'être abandonné, et c'est le croisement qui porte en salle. La vague 1
le rend bien plus fort : les frictions étant rattachées à des étapes, une
friction transverse peut désigner plusieurs points précis du flux.

**Marquer les supports déclaratifs comme une catégorie, pas par mot-clé.** Sur
la trame, 40 étapes sur 141 reposent sur « Au jugé » ou « Oral ». Sur Sekurit :
zéro, parce que le vocabulaire y est différent. Une recherche par mot-clé
donnerait donc un indicateur qui ne fonctionne que sur nos propres trames. Il
faut que « déclaratif » soit une propriété de l'outil, au même titre que
générique et spécifique. Alors « X % du processus repose sur du déclaratif »
devient un chiffre défendable devant un client.

---

## Vague 5 — confort

**Comparer deux versions.** Le panneau liste des compteurs mais ne dit pas *ce
qui* a changé. Après une séance de relecture, « qu'est-ce qui a bougé depuis
hier ? » est la question naturelle. Les deux documents sont en base.

**Remplir `auteur` et montrer qui édite.** La colonne existe et n'a jamais été
alimentée. À deux consultants sur site, la seule protection actuelle est un
bandeau de conflit après coup.

---

## Réserves ouvertes, sans rapport avec les vagues

- Le clignotement de la liste des versions au « Voir plus »
  (`placeholderData: (p) => p` le supprimerait).
- L'onglet « Transverse - Preuves » annoncé par la page de garde du classeur
  mais absent du fichier.
- Le flux Google OAuth ne se termine toujours pas.
- Les 158 points de `INVENTAIRE-FONCTIONNEL.md` restent à parcourir au
  navigateur : lisibilité du graphe, déterminisme sur deux chargements,
  convergence de l'échelle d'impression, glisser-déposer.
