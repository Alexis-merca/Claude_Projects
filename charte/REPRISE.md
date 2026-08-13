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
- on n'a aucune prise sur l'index git de Lovable (voir §7, `routeTree.gen.ts`) ;
- si l'accès Lovable se ferme, le code part avec.

**Connecter le projet Lovable à GitHub est la première amélioration
structurelle à proposer.** Elle rendrait le projet portable, lui donnerait un
historique lisible ailleurs que dans le journal, et permettrait de lire et
modifier les sources directement.

### Les documents à lire, dans cet ordre

1. `charte/PASSE-STATIQUE.md` — **le journal**, §1 à §35. Chaque entrée cite son
   commit et sa mesure. C'est la mémoire du projet.
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

**`src/flux/` est intouchable.** `moteur.js`, `moteur.css`, `mutations.js` : le
moteur du diagramme. On peut greffer autour (portails React), jamais dedans.

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

## 5. Où on en est

### Livré et vérifié

- **Le bloc bilan complet** (§31–32) : quatrième état `en_cours`, bilan des
  frictions (`resolue` / `persistante`), `cible` en texte libre par étape ;
  saisie à l'écran et page « Trajectoire de déploiement » à l'impression.
- **`routeTree.gen.ts` sorti du suivi** (§33). Il oscillait à chaque commit.
  Attention : `.gitignore` seul ne dé-suit pas un fichier déjà suivi — il a
  fallu le supprimer du disque pour qu'il quitte l'index.
- **Point E, garde de concurrence** (§34–35) : les mises à jour des enfants sont
  gardées par les deux chemins — champ à champ (`maj_etape`, `maj_friction`,
  `maj_chiffre`) et diagramme (`appliquer_mutation_flux`, qui rend au passage un
  geste du diagramme **atomique** : plus de diagramme à moitié muté).

### En cours au moment d'écrire

**Point E, troisième envoi** — créations et suppressions d'enfants
(`creer_friction`, `creer_chiffre`, `supprimer_friction`, `supprimer_chiffre`),
garde de version sur `deleteProcessus`, retrait de `deleteEtape` devenue code
mort, et **correction du commentaire de tête de `diagnostic.ts`** qui affirme
« cet invariant EST appliqué » alors que ce n'est vrai que des mises à jour.

À vérifier au retour : `tsgo` à 0, la preuve du refus **avant** celle du succès,
la base rendue à l'identique, et les droits des nouvelles fonctions
(`security invoker`, exécutable par `authenticated`).

### Chiffres de référence de la base

410 étapes, 16 frictions, 5 clients, 11 chiffres clés, 1 étape au bilan
(Sekurit), 0 friction évaluée, 0 cible. Le client `xxx-xx` est une création
manuelle de test. `test-06-08` est le client de test : **c'est là qu'on écrit
des jeux d'essai, jamais sur Sekurit ni sur les trames.**

---

## 6. Prochaines étapes, dans l'ordre

**1. Finir le point E** (envoi 3 en cours), puis relire le commentaire de
`diagnostic.ts` pour vérifier qu'il ne promet plus que ce qu'il tient.

**2. La recette navigateur.** C'est le plus gros trou. `RECETTE-NAVIGATEUR.md`
est écrit, 24 points ordonnés par discrétion de la panne, **jamais parcouru**.
Tout ce qui est écrit dans `PASSE-STATIQUE.md` vient de la lecture du code et de
mesures en base. L'utilisateur a confirmé le 13/08 que l'édition fonctionne à
l'écran — c'est le seul point vérifié dans un navigateur à ce jour.

**Contrainte à connaître : cette application n'est vérifiable visuellement que
par un humain connecté.** Un rendu sans tête est bloqué par le garde
`_authenticated`. Le déblocage : que l'utilisateur se connecte dans la fenêtre
de préversion Lovable, la session devient alors disponible au tour suivant.

**3. Les retours d'usage.** L'utilisateur a commencé à parcourir l'application
et va envoyer des points d'amélioration. Format convenu : en vrac, une ligne par
point, avec **où** (client + écran), **ce qu'il a vu vs ce qu'il attendait**, et
une seule étiquette **CASSÉ** ou **MIEUX**. À ranger dans
`charte/RETOURS-USAGE.md` en les croisant avec l'inspection — plusieurs seront
des confirmations terrain de défauts déjà connus.

**4. Les défauts ouverts de l'inspection**, par ordre de gravité :

- **D** — la projection « après » hérite des corrections de l'« avant ». Les
  deux blocs `EnvironnementIT` reçoivent le même `client.si`, clefé
  `outil|bloc` sans notion d'avant/après. Un outil masqué à la main dans le
  relevé est aussi masqué dans la projection.
- **G** — aucune page ne confronte le relevé du site à **son propre bilan**. La
  page « Cible de référence » compare à la trame générique.
  `synthese(comparaison, "bilan")` est écrite dans `trame-cible.ts` et **jamais
  appelée** depuis l'impression.
- **F** — le défilement du diagramme n'est mémorisé nulle part, et le zoom vit
  dans un `useRef` perdu au rechargement.
- **I** — l'échelle d'impression abandonne après 40 tours (~14 s) sans le dire ;
  la capture PPTX a un délai de 30 s par page et un repli en définition simple
  qui ne prévient pas non plus.
- **J** — l'ordre des onglets (`processus.rang`) n'est pas modifiable, alors que
  l'ordre de restitution est un choix éditorial.

**5. Les dettes de cohérence** (§3 de la feuille de route) : le déclaratif comme
catégorie d'outil plutôt que mot-clé (coût faible, forte valeur client), puis
l'unification des clefs dans la couche schéma — **la seule entrée vraiment
chère**, qui casse quatre choses dont deux avec perte silencieuse, et qui ne se
tente pas sans recette préalable.

---

## 7. Pièges connus

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

## 8. Décisions déjà tranchées — ne pas les rouvrir

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

## 9. Ton et exigences de l'utilisateur

Il veut **la vérité sur l'état réel**, pas des comptes rendus rassurants. Ce qui
lui est utile : les écarts signalés, les approximations annoncées comme telles,
les régressions attribuées franchement. Il tranche vite quand on lui présente un
arbitrage clair avec une recommandation — pas un catalogue d'options.

Le code et les commentaires sont **en français**, y compris les noms de
variables et de fonctions SQL. Les commentaires expliquent **pourquoi**, pas
quoi — et notamment pourquoi une chose qui semble redondante ne l'est pas, pour
empêcher qu'on la « simplifie » six mois plus tard.
