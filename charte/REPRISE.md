# Diagnostic OS — prompt de reprise

*Écrit le 13/08/2026 pour qu'une session neuve reprenne sans cette conversation.*

Ce document est fait pour être **collé tel quel** au début d'une nouvelle
session. Il dit ce qu'est le produit, où vivent les choses, **comment on
travaille** — c'est la partie la moins évidente et la plus coûteuse à
réapprendre —, ce qui est fait, et ce qui vient.

---

## 1. Le produit

**Diagnostic OS** est un outil interne Mercateam. Des consultants partent deux
jours en usine, relèvent des processus industriels à la main, et doivent en
ressortir une restitution qui tienne devant un client.

Un **client** (nom, site, date de visite) porte plusieurs **processus** — un par
use case audité. Chaque processus a des rôles, des **étapes** ordonnées (rôle,
texte, phase, supports utilisés), des **frictions** rattachées à des étapes, et
des **chiffres clés**. Le tout se rend en diagramme de flux, et s'exporte en PDF
16:9 et en PPTX.

Deux notions structurent le reste :

- **La trame** (`clients.trame` = `existant` ou `cible`) est un client
  particulier qui sert de modèle. À la création d'un site, les use cases cochés
  sont **recopiés** depuis la trame. Ensuite chaque site vit sa vie : un relevé
  de terrain doit pouvoir contredire la trame.
- **Le bilan de déploiement** : les mêmes lignes, d'autres colonnes. Une fois
  Mercateam déployé, on repasse sur le relevé pour dire ce qui a changé.

**Le livrable final est une restitution client.** C'est le critère qui tranche
la plupart des arbitrages : ce qui se voit en salle prime, et il vaut mieux
sous-vendre que survendre.

---

## 2. Où vit quoi — et le risque à connaître

| Quoi | Où | Comment y toucher |
|---|---|---|
| Code de l'application | Projet **Lovable** `mercaudit` (« Diagnostic OS »), workspace `FC1RrQFlzq4xY5YAG3jf` | **Uniquement** par le MCP Lovable : `read_file`, `send_message`, `get_diff` |
| Base de données | Supabase du même projet | `query_database` par le MCP Lovable |
| Application publiée | `https://mercaudit.lovable.app` | Connexion Google restreinte au domaine `merca.team` |
| Charte, méthode, mesures | Dépôt git `alexis-merca/claude_projects`, branche `claude/diagnostic-os-mercateam-server-3x0ela` | Git normal |

L'identifiant exact du projet Lovable se retrouve par `list_projects` sur le
workspace ci-dessus.

**Le risque de portabilité, à dire tout de suite : le code de l'application
n'est synchronisé avec aucun dépôt GitHub.** Il vit uniquement dans le git
interne de Lovable. Le dépôt git ne contient que la charte, les mesures et les
trames — pas une ligne de `src/`. Conséquences :

- on ne modifie jamais le code directement, **on écrit des briefs** ;
- on n'a aucune prise sur l'index git de Lovable (voir « Pièges connus ») ;
- si l'accès Lovable se ferme, le code part avec.

**Connecter le projet Lovable à GitHub est la première amélioration
structurelle à proposer.** Elle rendrait le projet portable, lui donnerait un
historique lisible ailleurs que dans le journal, et permettrait de lire et
modifier les sources directement.

### Les documents à lire, dans cet ordre

1. `charte/PASSE-STATIQUE.md` — **le journal**, tenu par sections numérotées.
   Chaque entrée cite son commit et sa mesure. C'est la mémoire du projet, et
   **sa dernière section est le point de reprise**.
2. `charte/INSPECTION-PARCOURS.md` — les onze points du parcours attendu
   confrontés au code réel, avec les défauts **A** à **J**. C'est la carte des
   dettes.
3. `charte/FEUILLE-DE-ROUTE.md` — ce qui est livré, ce qui reste, et une règle
   de tenue : aucune ligne ne vaut si elle n'a pas été vérifiée contre le code
   ou la base.
4. `charte/RECETTE-NAVIGATEUR.md` — 24 points de recette, **jamais parcourus**.
5. `charte/tokens.css` — la charte graphique en clair.

---

## 3. La démarche — la partie qui compte

On ne code pas directement : on écrit des briefs à l'agent Lovable, et **on
vérifie ce qu'il rend**. Ce qui suit n'est pas du style, c'est ce qui a
effectivement attrapé des défauts.

**Un envoi, une préoccupation.** Découper base / saisie / restitution plutôt que
tout livrer d'un bloc. Un diff vérifiable vaut mieux qu'un gros diff survolé.
Toujours écrire explicitement ce qu'il ne faut **pas** toucher.

**Exiger des mesures, jamais des affirmations.** « La base est inchangée » ne
vaut rien ; « 393 étapes avant et après » vaut quelque chose. Demander le compte
avant/après à chaque envoi.

**Vérifier soi-même les affirmations qui, fausses, coûteraient cher.** L'agent
est honnête mais il se trompe. Exemples réels : la clef de la `Map` des marques
(indexée par `ordre`, pas par `id` — sinon l'étiquette ne s'affiche jamais, sans
erreur) ; l'export PPTX (photographie du DOM, donc les pages neuves entrent
seules) ; l'existence de `--rouge-fonce` dans la charte (sinon texte blanc sur
fond transparent). Trois lectures de trente secondes, trois pannes silencieuses
évitées.

**Pour une garde, exiger la preuve du refus, pas seulement du succès.** Une
garde qu'on n'a jamais vue refuser n'est pas une garde vérifiée. Le motif qui
marche : appeler avec la bonne version → succès ; rappeler avec la version
périmée → doit renvoyer `null`.

**Poser une condition plutôt qu'une instruction quand on ne peut pas voir.** Le
logo Mercateam devait remplacer le mot sur l'étiquette « si et seulement si » il
restait lisible à 14 px et suivait `currentColor`. Les deux conditions ont
échoué — couleurs figées, `viewBox` 346×48 — et le mot a été conservé. Une
instruction sèche aurait produit un pavé invisible.

**Demander qu'on décrive le problème plutôt que de le bricoler.** Quand un doute
porte sur quelque chose d'invisible depuis ici (largeur d'un bandeau, débordement
d'une page), demander une description et une proposition, pas une rustine.

**Dicter le texte exact pour un commentaire ou un libellé.** Moins cher qu'un
aller-retour de reformulation.

**Journaliser dans `PASSE-STATIQUE.md`** à chaque envoi : ce qui a été fait, ce
qui a été mesuré, **ce qui reste faux**, et les décisions avec leur raison. La
section « ce qui reste faux ou non vu » est la plus utile du journal.

**Ne pas maquiller les écarts.** Quand un brief annonce « zéro migration » et
que la solution en exige une, le dire et corriger. Quand une régression a été
introduite par soi-même, l'écrire comme telle.

---

## 4. Les invariants — ne pas les casser

Chacun a coûté cher à établir. Ils sont écrits dans le code, à l'endroit où on
risque de les défaire.

### L'APPLICATION EST EN PRODUCTION — 25/08/2026

Des utilisateurs qu'on ne connaît pas s'en servent. **Aucune donnée n'est
modifiée, hors deux exceptions nommées par l'utilisateur** :

- `test-06-08`, le site jetable ;
- `sekurit-float-france`, autorisé explicitement.

Tout le reste est en lecture seule : pas d'écriture, pas de suppression, et
**pas de création non plus** — un client d'essai apparaît dans la liste de tout
le monde le temps qu'il existe.

**LA CONTRAINTE DOIT PARTIR DANS CHAQUE ENVOI À LOVABLE.** C'est l'agent qui
écrit le plus : les briefs lui demandent régulièrement des démonstrations —
concurrence sur une fonction de fusion, import d'un fichier, aller-retour du
retour/avant — et **c'est lui qui choisit son terrain**. La contrainte ne
protège rien si elle ne s'applique qu'à la session.

Ce que ça coûte, et qu'il faut assumer : certaines preuves ne se font plus sur
la donnée qui les rendrait convaincantes. On les fait sur `test-06-08`, on dit
que c'est un substitut, et on ne présente pas un essai en bac à sable comme une
vérification en production.

**`src/flux/` : Lovable est la source, le dépôt est un miroir.** Décision du
18/08/2026. Jusque-là le moteur du diagramme était maintenu dans ce dépôt et
`src/flux/` en était un import intouchable ; c'est **inversé**. On corrige
désormais dans Lovable, et `flux/` ici suit.

Conséquence à ne pas manquer : `flux/geometrie.test.cjs` compare les tracés du
moteur à ceux de `diagnostic-os.html`. Toute correction de géométrie doit donc
être reportée **dans le mono-fichier aussi**, sinon le test compare deux
algorithmes différents et désigne la correction comme la régression.

**Les trois modes d'écran écrivent des champs disjoints.** `lecture`,
`modifier`, `bilan`. Le mode modifier écrit le relevé ; le mode bilan écrit
`etapes.bilan`, `etapes.cible`, `frictions.bilan` et la maturité de bilan. C'est
ce qui garantit que les deux vues ne peuvent pas s'écraser — **jamais de gel**.
C'est aussi pourquoi `cible` s'écrit en mode bilan et non en mode modifier.

**Une marque de bilan ne repose jamais sur la couleur seule.** Ces pages
s'impriment en noir et blanc : barré, contour pointillé, étiquette écrite. On
peut ajouter une couleur, jamais la substituer.

**`en_cours` ne compte pas comme migré** dans `etapesApresBilan`. Une étape en
cours garde ses supports actuels, comme « inchangée ». Sinon un site où tout est
en cours afficherait un environnement IT entièrement déployé — un avant/après
flatteur et faux. **On sous-vend plutôt que de survendre.**

**Une étape passée sous Mercateam garde ses systèmes de référence** (ERP, SIRH,
GTA, GED) et perd le générique et l'inconnu. Mercateam s'y branche, il ne les
remplace pas.

**Tout champ neuf doit entrer dans `client_json` dans la même migration.** Sinon
tout instantané pris ensuite l'omet, et restaurer un instantané du jour même
l'efface en silence. Vaut aussi pour `importer_client_json` et
`echange-json.ts`, qui doivent tolérer son absence.

**Le processus est l'unité de concurrence.** Les enfants n'ont pas de colonne
`version` ; c'est celle du processus qu'un trigger incrémente. Les écritures
passent par des fonctions SQL `maj_*` / `appliquer_mutation_flux` qui comparent
et écrivent dans la **même instruction**. Elles renvoient la **version fraîche**
— ne pas « simplifier » cette signature, sinon un consultant seul enchaînant
deux champs se met en conflit avec lui-même.

**La vue d'impression ne déborde jamais, elle rétrécit.** Elle compose à 1600 px
puis met à l'échelle pour tenir dans le 16:9. Un tableau trop long ne dépasse
pas : il devient illisible, sans aucun signe. C'est le mode de panne à
surveiller sur tout ce qui s'imprime.

**La trame est copiée à la création, puis chaque site vit sa vie.** Aucune
propagation d'une correction de trame vers les sites existants — décision
assumée, avec sa conséquence : aucun signal quand un site tourne sur une version
périmée de la trame.

---

## 5. Où on en est — **ce document ne le dit pas**

C'est délibéré. Une porte d'entrée qui décrit l'état courant vieillit en
quelques jours et devient un piège : on la lit en premier, donc on la croit sans
vérifier. Ce fichier a commis exactement cette faute entre le 13 et le 18/08 —
il annonçait un journal de 35 sections quand il en comptait 41, un chantier
« en cours » clos depuis, et deux défauts « en attente » déjà livrés.

**L'état vit ailleurs, et à un seul endroit chacun :**

| Question | Fichier |
|---|---|
| Qu'a-t-on fait, mesuré, et que reste-t-il faux ? | `PASSE-STATIQUE.md`, la dernière section |
| Que reste-t-il à faire, et dans quel ordre ? | `FEUILLE-DE-ROUTE.md` |
| Quelles dettes le code porte-t-il ? | `INSPECTION-PARCOURS.md`, défauts A à J |
| Qu'a constaté l'utilisateur en s'en servant ? | `RETOURS-USAGE.md` |
| Combien de lignes en base ? | La base elle-même — `query_database`, jamais un chiffre recopié |

**Commence toujours par lire la dernière section de `PASSE-STATIQUE.md`.** Elle
dit où le travail s'est arrêté, ce qui a été prouvé, et ce qui ne l'a pas été.

Ce fichier-ci ne porte que ce qui ne vieillit pas : le produit, la topologie, la
démarche, les invariants, les pièges, les décisions tranchées. Si tu y ajoutes
un état, une date ou un décompte, tu réintroduis le défaut.


## 6. Pièges connus

**`routeTree.gen.ts`** — généré par le plugin TanStack, désormais hors suivi.
Conséquence assumée : `tsgo --noEmit` seul échoue sur un clone neuf tant qu'un
`dev` ou un `build` n'a pas régénéré le fichier. **Aucun script de génération
n'existe dans `package.json`** : c'est un effet de bord du plugin Vite,
dépendance implicite documentée nulle part ailleurs que dans le `.gitignore`.

**Le seuil de 12 lignes par page** de la trajectoire imprimée est un calcul,
**jamais une mesure**. Le texte de l'étape n'y est pas tronqué : au-delà de deux
lignes par cellule, la page se réduit et le corps passe sous 12 px.

**Les fonctions SQL sont exécutables par `anon`** — c'est le défaut PostgreSQL
sur `PUBLIC`, pas un ajout. Neutralisé par `security invoker` : les tables
portent une politique RLS avec filtre de domaine, donc un appel anonyme se voit
refuser l'écriture. Un `revoke execute … from public` reste souhaitable.

**La version du processus monte par ligne, pas par geste** : un réordonnancement
de 17 étapes l'incrémente de 18. C'est un jeton de concurrence, pas un compteur
d'activité.

**`db/schema.sql` dérive en silence.** Régénéré le 07/08 après une semaine
d'écart : une table entière, huit colonnes, sept contraintes, cinq fonctions, et
une affirmation fausse sur la sécurité. Tant que ce contrôle est manuel, il ne
sera pas fait.

---

## 7. Décisions déjà tranchées — ne pas les rouvrir

- **Le processus est l'unité de concurrence**, pas la ligne. Arbitré par
  l'utilisateur : pas de colonne `version` sur les enfants, pas de migration sur
  trois tables. Contrepartie acceptée : deux consultants dans le même use case
  peuvent recevoir un bandeau de conflit même sur deux étapes différentes.
- **`cible` s'écrit en mode bilan**, pas en mode modifier — pour préserver
  l'invariant des champs disjoints.
- **Le logo Mercateam reste le mot** sur l'étiquette, faute d'une variante
  monochrome lisible à 14 px. Le changer suppose un travail de charte, pas de
  code.
- **Pas de propagation d'une correction de trame** vers les sites déjà créés.
- **Pas de création de processus cible** à la sélection des use cases : la trame
  `cible` est une source de comparaison, pas un générateur.
- **`createEtape` reste sans garde** dans ses trois chemins de création en masse
  (`modele-processus.ts`, `trame-use-case.ts`, `duplication.ts`) : chacun crée
  le processus juste avant d'y insérer ses étapes, personne d'autre ne peut le
  détenir, la garde n'aurait rien à comparer. Exception raisonnée, pas oubli.

---

## 8. Ton et exigences de l'utilisateur

Il veut **la vérité sur l'état réel**, pas des comptes rendus rassurants. Ce qui
lui est utile : les écarts signalés, les approximations annoncées comme telles,
les régressions attribuées franchement. Il tranche vite quand on lui présente un
arbitrage clair avec une recommandation — pas un catalogue d'options.

Le code et les commentaires sont **en français**, y compris les noms de
variables et de fonctions SQL. Les commentaires expliquent **pourquoi**, pas
quoi — et notamment pourquoi une chose qui semble redondante ne l'est pas, pour
empêcher qu'on la « simplifie » six mois plus tard.

### Les messages, eux, doivent être courts — demandé le 24/08/2026

Sans perdre un fait. Ce qui les allongeait n'était pas la longueur des phrases
mais **la redite** : chaque idée était dite, puis reformulée.

Six règles :

1. **Une idée, une fois.** Pas de « ce n'est pas A, c'est B » quand « c'est B »
   suffit.
2. **La mesure, puis rien.** Le chiffre porte l'argument ; ne le paraphrase pas.
3. **Le contrefactuel s'écrit seulement s'il EST la trouvaille.** « Sans ça on
   aurait… » est du remplissage, sauf quand c'est le défaut qu'on vient
   d'éviter.
4. **Aucun récapitulatif** de ce qu'on vient de faire, sauf si ça a changé.
5. **On garde tout ce qui est vérifiable** : chiffres, noms de fichiers, de
   fonctions, de commits. C'est le détail, et il ne coûte rien.
6. **Le gras sur un mot, pas sur une proposition.**

Ce qui ne change pas : les défauts se disent, les erreurs s'attribuent, les
approximations s'annoncent. Court ne veut pas dire lisse.
