# Diagnostic OS — feuille de route

Réécrite le 07/08/2026, **après lecture du code et de la base** plutôt que du
document précédent. Mise à jour le 11/08/2026 : le bloc « bilan de déploiement »
est passé en production, et la tentative de le vérifier à l'écran a échoué pour
une raison qui méritait d'être écrite (2a).

**Mise à jour du 24/08/2026** — et elle referme trois entrées d'un coup : la
bascule FR/EN est livrée et recettée, l'espace d'administration (G1) aussi, et
la passe navigateur (2a) a enfin eu lieu. Le document retardait sur son produit,
ce que sa propre règle de tenue interdit. L'ordre proposé pour la suite est en
fin de document.

> La version antérieure annonçait comme « à faire » quatre chantiers déjà en
> production : les vagues 1, 2, 3a et la moitié de la 4. Elle décrivait aussi
> un « reste à trancher » — les libellés des cinq niveaux de maturité — résolu
> depuis, les dix échelles étant rédigées dans `src/lib/maturite.ts`.
> **Une feuille de route qui retarde sur son produit fait perdre plus de temps
> qu'elle n'en fait gagner** : on y relit des décisions déjà prises et on
> propose de construire l'existant. D'où la règle nouvelle ci-dessous.

**Règle de tenue.** Aucune ligne de ce document ne vaut si elle n'a pas été
vérifiée contre le code ou la base. Une entrée « fait » cite son commit ou sa
mesure ; une entrée « à faire » dit ce qui a été constaté et où.

---

## Livré

| Sujet | Où c'est, comment c'est vérifié |
|---|---|
| **Frictions rattachées aux étapes** | `frictions.etape_id`, clé **composite** `(etape_id, processus_id)` : l'étape désignée appartient forcément au même processus. `on delete set null` sur la seule colonne `etape_id` — supprimer l'étape détache la friction sans l'emporter. |
| **Maturité par processus** | `processus.maturite` 1–5 + note, et `maturite_bilan` pour la fin de déploiement. **Dix échelles rédigées**, cinq niveaux chacune, aucune échelle générique de repli, aucune moyenne entre use cases. |
| **La trame est un produit** | `clients.trame` (`existant` / `cible`), sélecteur des dix use cases à la création, pré-remplissage par `creerUseCases` → `recopier`. Rattachement par `processus.use_case` **uniquement**, jamais par le nom. Trame repliée hors de la liste et non supprimable. Unicité garantie en base (`clients_trame_unique`, `bf90edc`). |
| **Avant / après** | Comparaison **par ensembles** — outils, rôles, nombre d'étapes, maturités — sans appariement étape à étape, les deux jeux ayant été écrits indépendamment. Plus un mode bilan à **quatre** positions sur l'étape (`etapes.bilan`). |
| **Environnement IT juste** | Placement multi-blocs `(outil, bloc)`, bloc déduit de la clef de use case, outils répétés estompés avec légende. Mesuré : 14 outils / 35 placements sur la trame, contre 14 / 14 avant. `PASSE-STATIQUE.md` §24–26. |
| **L'« après » ne ment plus** | Une étape passée sous Mercateam **garde ses systèmes de référence** (ERP, SIRH, GTA, GED) et perd le générique et l'inconnu. Mesuré : 7 outils au lieu de 1 en simulation sur la trame (`b09ccf0`, §28). |
| **Le bilan de déploiement, complet** | Quatrième état `en_cours` sur l'étape, bilan à deux états sur la friction (`resolue` / `persistante`), `cible` en texte libre par étape ; saisie à l'écran, et page « Trajectoire de déploiement » à l'impression, conditionnée à la présence d'au moins une cible. Les trois champs entrent dans `client_json` **dès la migration** — sans quoi tout instantané pris ensuite les aurait omis, et une restauration du jour même les aurait effacés en silence. `100cfe4`, `75eed5e`, `40898e8` ; §31–32. **Rendu à l'écran par personne** (voir 2b). |
| **Bascule FR / EN à double sens** | L'interface et **le contenu saisi**. La source d'un texte est la langue dans laquelle il a été tapé ; l'autre langue est une vue calculée, corrigeable. Les trois règles de frappe vivent dans `frappe()` et nulle part ailleurs. Recette navigateur passée, **20/20**. |
| **Glossaire métier partagé** | `reglages.glossaire`, **135 termes**, versés depuis trois sources classées par force (code livré, cache constant, terme d'industrie déclaré comme proposition — `charte/GLOSSAIRE.md`). Il entre dans la consigne du modèle ; il ne remplace jamais un mot dans sa sortie. |
| **L'écran d'administration, quatre onglets** | Clients et sites, trames et maturité, bibliothèque d'outils, glossaire. Tous sur `reglages`, tous tenant la même propriété : **la donnée partagée complète le code, elle ne le remplace pas** — magasin vide = écran d'avant, à l'identique. §58. |
| **L'accueil, c'est l'écran d'administration** | `/` et `/clients` y redirigent en réacheminant `search` et `hash` — le fragment porte les jetons de connexion Google. Les cinq gestes de l'ancienne liste (créer, dupliquer, supprimer avec son décompte, marquer comme trame, déconnecter) ont été rendus un par un. §59. Testé par l'utilisateur le 24/08. |
| *Hors plan* | Versions complètes (prise, liste, restauration elle-même annulable), export PPTX, et **filtre de sécurité par domaine** `est_mercateam()` — sans lui, tout compte OAuth authentifié voyait tous les diagnostics. |

---

## À faire

### 1. Justesse du livrable — ce qu'un client voit

**1a. Les supports déclaratifs doivent être une catégorie, pas un mot-clé.**
40 étapes sur 141 de la trame reposent sur « Au jugé » ou « Oral » ; sur
Sekurit, zéro, parce que le vocabulaire y est différent. Une détection par
mot-clé donnerait donc un indicateur qui ne fonctionne que sur nos propres
trames. Il faut que « déclaratif » soit une propriété de l'outil, au même titre
que générique et spécifique — alors « X % du processus repose sur du
déclaratif » devient un chiffre défendable devant un client.
*Coût faible : la machinerie `estGenerique` / `estSpecifique` existe déjà.*

**1b. Les frictions transverses.** Une friction isolée est un incident, la même
sur trois processus est un problème d'organisation. Les frictions étant
désormais rattachées à des étapes, une friction transverse peut désigner
plusieurs points précis du flux. C'est le croisement qui porte en salle.

**1c. L'arbitrage de survie des outils, au niveau du use case.** La règle
automatique de `etapesApresBilan` se trompe encore dans les deux sens : sur la
trame, `Réseau` et `Logiciel (GED)` survivent alors que la cible écrite à la
main les supprime, et `TV / écran atelier` — que la cible **ajoute** — ne peut
apparaître par aucune règle dérivée de l'existant. Un cochage étape par étape
ne couvre que la moitié du problème : il sait retirer et conserver, pas
ajouter. L'arbitrage se joue donc au niveau du use case, où il tient en
quelques décisions, et non de l'étape, où il en faudrait des dizaines.
*Non engagé — à concevoir avant de coder.*

### 1bis. Quatre retours d'usage sur le diagramme — 25/08/2026

Relevés par l'utilisateur en travaillant, à traiter plus tard. Chacun porte ce
qui est déjà su, pour éviter de le redécouvrir.

**1bis-a. Regrouper les étapes par macro-étape**, avec un fond de couleur ou un
libellé. Exemple donné pour le planning : *gestion de la charge*, *des
titulaires*, *des remplacements*, *des intérimaires*, *des temps*, *des
absences*.

> **Ne pas réutiliser `etapes.phase`.** Elle porte déjà l'échelle de TEMPS
> (« Avant J1 », « J1 »), et la frise se calcule dessus. Le regroupement demandé
> est **thématique**, donc une seconde dimension : deux étapes du même thème
> peuvent être à deux moments, et l'inverse. Un champ de plus, et un rendu qui
> ne se dispute pas la ligne 1 de la grille avec la frise — le fond de cellule
> est probablement la bonne piste.

**1bis-b. Bug : impossible de mettre une étape entre deux rôles.** Le mécanisme
**existe** — `etapes.role2`, les cellules `flux__frontiere` avec
`data-frontiere`, et le décalage à cheval de `placerCartesACheval`. C'est donc
un défaut, pas une fonctionnalité manquante. **À reproduire avant de corriger** :
la bande de dépôt n'est émise que si `edition && cmd('deplacement') && i < R-1`.

**1bis-c. Réordonner les rôles au glisser-déposer.** Aujourd'hui deux boutons
`monter-role` / `descendre-role`. Confort, pas capacité nouvelle.

**1bis-d. Le sélecteur d'outils est un `<select>` natif.** `vueChoixSupport`
émet un `<select>` : d'où le surlignage bleu système de la capture, hors charte.
Le styler vraiment demande de le remplacer par un vrai menu (le catalogue shadcn
en a un) — un `<select>` natif ne se met pas à la charte, c'est le système qui
dessine sa liste.

### 2. Vérification — ~~le trou le plus large~~, refermé le 21/08

> **2a est clos.** La passe navigateur a eu lieu le 21/08 : « tout fonctionne
> comme on l'espérait, pas de bugs visuels à noter, les fonctionnalités
> délivrent l'attendu » — **20/20**. Une seconde passe, sur l'écran
> d'administration, a suivi le 24/08 (`RECETTE-ADMIN.md`, 26 points). La phrase
> qui ouvrait cette section pendant trois semaines — *personne n'a vu cette
> application fonctionner* — n'est plus vraie.
>
> **Ce que le déblocage a coûté à comprendre** : la session de l'agent était
> `signed_out` parce que la préversion et l'éditeur ne partageaient pas leur
> connexion. C'est la plateforme qui l'a corrigé le 24/08 en courtisant la
> session par `postMessage` (§58.4) — après un mois où la question revenait à
> chaque envoi.
>
> Ce qui reste vrai, et qu'il faut garder : **cette application n'est
> vérifiable visuellement que par un humain connecté.** Chaque gros lot mérite
> donc sa liste de contrôle écrite d'avance, pas une inspection improvisée.

*Texte d'origine, conservé pour la mémoire du problème :*

**2a. Aucune passe navigateur n'a jamais été faite.** Liste de contrôle prête :
`RECETTE-NAVIGATEUR.md`, 24 points ordonnés par discrétion de la panne.
Débloquée le 07/08 par la réparation de la connexion Google. Les 158 points de
`INVENTAIRE-FONCTIONNEL.md` n'ont pas été parcourus : lisibilité du graphe,
déterminisme du schéma sur deux chargements, convergence de l'échelle
d'impression, glisser-déposer, rendu PPTX. Tout ce qui est écrit dans
`PASSE-STATIQUE.md` vient de la lecture du code et de mesures sur la base.
**Personne n'a vu cette application fonctionner.**

Tentative du 09/08, et son résultat : le rendu sans tête de
`/impression/test-06-08` a été **bloqué par le garde `_authenticated`**, le
navigateur de test n'ayant aucune session
(`LOVABLE_BROWSER_AUTH_STATUS=signed_out`). Aucun contournement n'a été tenté.
Le constat dépasse cette page — **cette application n'est vérifiable
visuellement que par un humain connecté**, et c'est la raison structurelle pour
laquelle cette entrée traîne depuis l'origine. Le déblocage est connu et tient
en une action : se connecter dans la fenêtre de préversion, la session devient
alors disponible au tour suivant. `PASSE-STATIQUE.md` §33.5.

**2b. Trois fonctionnalités livrées n'ont aucun jeu d'essai.** La trame ne porte
ni friction ni chiffre clé — le classeur n'en contient pas, ils se relèvent en
entretien. Et le bilan n'a **quasiment jamais servi**, mesuré le 11/08 sur
393 étapes et 16 frictions : **1 étape marquée** (Sekurit, `mercateam`),
**0 friction évaluée**, **0 cible**. Les trois champs livrés ce week-end sont
donc justes par construction et exercés par personne ; la page « Trajectoire de
déploiement » n'a jamais été affichée une seule fois.

> **Correction du 18/08 — le zéro sur les cibles ne voulait pas dire ce qu'on
> croyait.** Il n'était pas dû au non-usage mais à une panne : le bouton
> « Saisie rapide », seul point d'entrée de `etapes.cible`, ne se montait
> jamais. La fonctionnalité était **inatteignable**, pas délaissée. Corrigé et
> prouvé au navigateur (`b2650b6`, `PASSE-STATIQUE.md` §46). Reste vrai pour
> les frictions évaluées et la maturité de bilan, dont la saisie, elle,
> fonctionne. **Un compteur à zéro admet deux lectures ; on avait retenu la
> rassurante sans la vérifier.**

### 3. Dette de cohérence

**3a. Clef et libellé dans la couche schéma.** `isoles` teste `!poids.has(o)`,
`positions` et `data-outil` sont clefés sur le nom exact : toute la couche
schéma compare caractère à caractère, là où la couche environnement compare par
`normaliser`. Corriger naïvement casse quatre choses dont deux avec perte
silencieuse — positions déplacées à la main devenues introuvables, échanges
fusionnés dont les fréquences s'additionnent. Chemin recommandé : clef
normalisée en interne, libellé d'affichage conservé, repli de lecture sur
l'ancienne clef, réécriture opportuniste à la première sauvegarde. **La seule
entrée vraiment chère de ce document.** Détail en `PASSE-STATIQUE.md` §26.3.

**3b. Trois fonctions `normaliser`.** `environnement-it.ts`, `trame-cible.ts`
(qui compacte les espaces en plus) et une copie privée dans `roles.ts`. La plus
robuste est celle de `trame-cible.ts`, mais unifier change des clefs
enregistrées : dépend de 3a.

**3c. Les tables de classement sont recopiées hors du code.**
`trames/verification.py` et `mesures/recette.py` dupliquent `TABLE_A`,
`GENERIQUES` et `TABLE_B` pour rejouer le classement indépendamment. C'est ce
qui permet de vérifier une livraison sans croire son auteur sur parole — mais
rien ne signale la dérive quand une table bouge côté application.

**3d. `db/schema.sql` dérive en silence.** Régénéré le 07/08 après une semaine
d'écart : une table entière (`versions`), huit colonnes, sept contraintes, cinq
fonctions, et **une affirmation fausse sur la sécurité** — le fichier annonçait
un accès ouvert à tout utilisateur authentifié. `db/README.md` porte désormais
les requêtes de comparaison. **Tant que ce contrôle est manuel, il ne sera pas
fait.**

**3e. Trois approximations laissées dans le code du 09/08, toutes signalées sur
place plutôt que dissimulées.** Le seuil de **12 lignes par page** de la
trajectoire imprimée est un calcul, jamais une mesure (§32.2) : la première
recette navigateur le confirmera ou le fera descendre. Le **texte de l'étape
n'y est pas tronqué** — au-delà de deux lignes par cellule, la page se réduit et
le corps passe sous 12 px (§32.3). Enfin, **aucun script de génération n'existe
dans `package.json`** : depuis que `routeTree.gen.ts` est sorti du suivi
(`906daf7`, §33), il n'est plus régénéré que par effet de bord du plugin Vite —
dépendance implicite, documentée nulle part ailleurs que dans le commentaire du
`.gitignore`. Conséquence assumée : `tsgo --noEmit` seul échoue sur un clone
neuf tant qu'un `dev` ou un `build` n'a pas tourné.

### 4. Confort

- **Comparer deux versions** en disant *ce qui* a changé. Le panneau liste des
  compteurs ; après une séance de relecture, « qu'est-ce qui a bougé depuis
  hier ? » est la question naturelle, et les deux documents sont en base.
- **Montrer qui édite en direct.** `versions.auteur` est désormais alimenté
  depuis le JWT, mais à deux consultants sur site la seule protection reste un
  bandeau de conflit après coup.
- Clignotement de la liste des versions (`placeholderData: (p) => p`).
- L'onglet « Transverse - Preuves » annoncé par la page de garde du classeur et
  absent du fichier — rien n'a été inventé pour combler le trou.
- ~~L'état du flux Google OAuth~~ — **réparé et vérifié en production le
  07/08** (`d3b60d9` + `aa71a16`, publié). Connexion confirmée par
  l'utilisateur sur `mercaudit.lovable.app`. Voir `PASSE-STATIQUE.md` §30.
- Retirer, quand le flux aura tenu quelques jours, les traces de mise au point
  `[auth] …` de `src/lib/auth.tsx` et `src/routes/index.tsx`. Elles ne
  divulguent que des noms de paramètres et des longueurs, jamais de valeur —
  donc rien d'urgent, mais ce sont des échafaudages.

---

## Ce que ce document ne tranche pas

**La propagation d'une correction de trame vers les sites déjà créés** a été
écartée le 07/08 : la copie se fait à la création, puis chaque site vit sa vie.
C'est le bon défaut pour un audit — un relevé de terrain doit pouvoir
contredire la trame. La conséquence assumée est qu'**aucun signal n'existe**
quand un site tourne sur une version périmée de la trame.

**La création des processus cible à la sélection des use cases** a été écartée
en même temps. La trame `cible` reste une source de comparaison, pas un
générateur.

---

## Les trois grands chantiers — annoncés le 20/08/2026

Déclarés par l'utilisateur comme ses trois grosses améliorations à venir. Rien
n'est engagé : ce qui suit note ce qui est su, et surtout ce qui reste à
trancher avant d'écrire une ligne.

### G1. Un espace d'administration — **LIVRÉ, 21 au 24/08**

Quatre onglets, et il est devenu l'accueil. Détail en `charte/ADMIN.md` et
`PASSE-STATIQUE.md` §57–59.

**Ce que la mesure a répondu aux quatre inconnues ci-dessous :**

- *Client et site ne sont pas deux objets* → ils l'étaient déjà. **Sept lignes
  sur neuf** employaient `nom` comme client et `site` comme site, sans qu'aucun
  code ne l'exige. Une seule divergeait, faute d'avoir écrit la convention
  quelque part. **Aucune colonne ajoutée**, donc aucun risque de la perdre à
  l'export.
- *Le « paramétrage » n'existe nulle part comme objet* → il existe maintenant :
  `reglages(clef, valeur jsonb, version)`, une ligne par bibliothèque, une
  fonction de fusion gardée par clef pour chacune.
- *Les tables de classement sont du code, et c'est délibéré* → elles le
  restent. La bibliothèque **complète** `TABLE_A`, elle ne la remplace pas, et
  les corrections par site l'emportent sur les deux. Un magasin vide rend
  l'écran d'avant, à l'identique — c'est la preuve exigée à chaque envoi.
- *Il n'y a aucun rôle applicatif* → on assume que tout le monde y entre.
  Décision de l'utilisateur : l'accès est déjà borné par `est_mercateam()` en
  base, et un garde-fou d'interface qui ne repose sur aucune politique ne
  protégerait rien.

*Contexte d'origine, avant que la mesure ne tranche :*

- **Client et site ne sont pas deux objets.** `clients` porte `nom`, `site`,
  `date_visite` et `code` dans la même ligne : deux sites d'un même groupe sont
  deux lignes sans lien entre elles. Un espace d'administration qui présente
  « un client, plusieurs sites » demande donc soit une colonne de rattachement,
  soit une table de plus — c'est **la première décision**, et elle touche
  `client_json`, l'import et les instantanés.
- **Le « paramétrage » n'existe nulle part comme objet.** Ce qui s'en approche
  vit dans trois endroits sans parenté : la trame des use cases
  (`clients.trame`, `template-use-case`), les tables de classement des outils
  (`TABLE_A`, `GENERIQUES`, `TABLE_B`, dans le code), et `clients.si` —
  structure de l'environnement IT, couleurs de rôle, traductions. Décider ce
  qu'« administrer le paramétrage » recouvre est un travail de cadrage, pas de
  code.
- **Les tables de classement sont du code, et c'est délibéré.** Les rendre
  éditables à chaud reviendrait à faire dépendre le classement de tous les
  diagnostics d'une donnée qu'un utilisateur peut casser. Si ce chantier doit
  les toucher, la question à trancher d'abord est : *qui rattrape un classement
  devenu faux, et comment le voit-on ?*
- **Il n'y a aucun rôle applicatif.** L'accès est binaire : tout compte du
  domaine voit et modifie tout (`est_mercateam()`). Un « espace admin » suppose
  soit une distinction consultant / administrateur — donc une notion nouvelle
  en base et dans les politiques d'accès —, soit d'assumer que tout le monde y
  entre.

### G2. Boutons retour / avant — **DEMANDÉ DEUX FOIS, JAMAIS ENGAGÉ**

Écarté du gros envoi du 19/08, puis reporté en faveur de la bascule FR/EN.

Le point dur est connu : **les écritures partent à la sortie de champ, une par
une, gardées par la version du processus.** Un « retour » n'est donc pas un
`undo` d'interface mais l'inverse d'une écriture déjà en base, potentiellement
concurrente de celle d'un collègue. Deux chemins existent, et ils ne coûtent pas
la même chose : une pile d'inverses côté client (rapide, faux dès qu'on est
deux), ou un journal d'écritures en base (juste, et c'est un vrai chantier).
`versions` existe déjà et sait restaurer — c'est le grain qui manque, pas le
mécanisme.

### G3. Refonte du module d'export — **MIS DE CÔTÉ, PÉRIMÈTRE CONNU**

À reprendre en bloc. Ce qui est constaté aujourd'hui, et qui doit servir de
point de départ plutôt qu'une idée neuve :

- le PPTX s'ouvre **flou et inexploitable** dans Google Slides, diagramme et
  frictions illisibles ; l'utilisateur contourne en photographiant l'écran
  (`RETOURS-USAGE.md` 15) ;
- la vue d'impression **n'honore pas** les couleurs de rôle choisies à la main ;
- **la vue d'impression n'a JAMAIS lu le magasin de traductions.** Elle lit la
  base directement. Conséquence, mesurée le 21/08 : tout le travail de la
  bascule FR/EN — l'interface, le contenu saisi, le glossaire de 135 termes —
  **n'atteint pas le livrable**. Une restitution en anglais est aujourd'hui
  impossible, alors que c'est ce pour quoi la bascule a été demandée. Et
  l'inverse est vrai aussi : un champ dont la source est l'anglais sort en
  anglais dans un PDF français ;
- le seuil de **12 lignes par page** de la trajectoire imprimée est un calcul,
  jamais une mesure ;
- le texte d'étape n'y est pas tronqué : au-delà de deux lignes par cellule, la
  page se réduit et le corps passe sous 12 px.

### Ce que ces trois chantiers ne recouvrent pas

Le reste de la liste tenue au 20/08 : les frictions transverses, l'arbitrage de
survie des outils au niveau du use case, la catégorie « déclaratif » (le
meilleur rapport effort/valeur de la liste, et le seul qui change ce qu'on
montre au client), la dette clef/libellé de la couche schéma, et les deux
recettes navigateur — dont celle de la bascule FR/EN, jamais commencée.

> **Mise à jour du 24/08 :** les deux recettes navigateur sont faites (2a), et
> G1 est livré. Restent G2 et G3, plus la liste ci-dessus.

---

## L'ordre proposé au 24/08

Un seul critère tranche, et c'est celui qui tranche depuis l'origine : **le
livrable est une restitution client.**

**1. G3 — la refonte de l'export.** C'est le plus gros écart entre l'outil et
ce qu'il produit. Deux faits le disent mieux qu'un argument : l'utilisateur
**photographie son écran** parce que le PPTX est inexploitable, et **la vue
d'impression n'a jamais lu le magasin de traductions** — donc la bascule FR/EN,
qui a occupé une semaine entière, s'arrête à la porte du livrable.

Premier pas recommandé : **mesurer avant de refondre**. Le seuil de 12 lignes
par page est un calcul, le flou du PPTX n'a jamais été caractérisé, et la
traduction à l'impression est un chemin de code, pas un réglage. Une passe de
constat, puis un plan — pas une réécriture à l'aveugle.

**2. La catégorie « déclaratif » (1a).** Petit, et c'est le seul de la liste qui
change un **chiffre montré au client** : « X % du processus repose sur du
déclaratif ». La machinerie `estGenerique` / `estSpecifique` existe déjà.

**3. G2 — retour / avant.** Demandé deux fois, jamais engagé. Le point dur n'a
pas bougé : les écritures partent une par une, gardées par la version ; un
« retour » est l'inverse d'une écriture déjà en base, peut-être concurrente de
celle d'un collègue. **Et depuis le 21/08 on sait que ce n'est plus théorique** :
deux personnes écrivent réellement dans la base en même temps.

**4. Les frictions transverses (1b)**, puis l'arbitrage de survie des outils
(1c), qui demande d'être conçu avant d'être codé.

**La dette (3a–3e) ne passe pas devant** tant qu'elle ne fait rien perdre. Elle
coûtera plus cher plus tard ; elle ne coûte rien à un client aujourd'hui.
