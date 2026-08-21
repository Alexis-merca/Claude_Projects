# L'écran d'administration — cadrage

Demandé le 21/08/2026. **Un écran ouvert à tout le monde** — pas de rôle
applicatif, décision de l'utilisateur — avec quatre onglets.

Ce document dit ce qui est su, ce qui doit être décidé, et dans quel ordre
avancer. Il ne décrit pas une mise en page : à ce stade, tout le coût est dans
le modèle de données, pas dans l'écran.

---

## Les quatre onglets, et ce que chacun coûte vraiment

### 1. Clients et sites

**Ce qui existe** : une ligne de `clients` **est** un site. Elle porte `nom`,
`site`, `date_visite` et `code` ensemble. Aucun lien entre deux sites d'un même
groupe.

**Ce qui est demandé** : `Sekurit Float France` devient un site du client
`Saint-Gobain`.

**Attention — la hiérarchie réelle a trois niveaux, pas deux.** Aujourd'hui
`nom` vaut « Sekurit » (la marque) et `site` vaut « Usine FLOAT France ». En
plaçant Saint-Gobain au-dessus, la marque doit descendre quelque part : dans le
libellé du site, ou dans un troisième niveau. **Seul l'utilisateur peut trancher
cette répartition, et il faut le lui demander site par site** — sept lignes,
c'est faisable à la main, et aucune règle automatique ne devinerait que Sekurit
est une marque de Saint-Gobain.

**Chemin recommandé : une colonne texte `groupe` sur `clients`**, pas une table.
Le groupe ne porte aujourd'hui aucune donnée propre — ni notes, ni réglages, ni
trame. Une colonne suffit, et le jour où il lui faut des attributs, la
transformer en table est mécanique. Une table tout de suite ajouterait une
politique d'accès, une clef étrangère et une question de plus à l'import (que
faire quand le groupe du fichier n'existe pas ?) pour aucun gain.

**Le piège à ne pas rater** : toute colonne nouvelle doit entrer **dans le même
envoi** dans `client_json` et `importer_client_json`. Sinon un export perd le
groupe en silence — c'est exactement le défaut trouvé le 21/08 sur
`lireFichier`, qui repartait de `{}` et perdait `si.traductions`.

### 2. Trame des use cases, éditable en FR / EN, et les niveaux de maturité

Deux choses de nature différente sous un seul onglet.

**Les deux lignes de trame** (`template-use-case`, `cible-mercateam`) sont des
lignes de `clients` ordinaires, avec leurs processus et leurs étapes. Elles sont
**déjà éditables**, en français comme en anglais : la machinerie de traduction
s'y applique comme partout. L'onglet est donc surtout un raccourci — et la
garde qui les empêche d'être supprimées existe déjà.

**Les dix échelles de maturité** sont **du code** (`src/lib/maturite.ts`), en
français et en anglais, cinq niveaux chacune. Les rendre éditables, c'est les
faire passer de code à donnée.

- Ce qui est sûr : `processus.maturite` stocke un **entier**. Les notes déjà
  posées survivent à n'importe quelle réécriture des libellés.
- Ce qui ne doit pas bouger : les **clefs** de use case (`clefUseCase`,
  `processus.use_case`). Seuls les libellés deviennent de la donnée.
- Ce qui est en jeu : ces libellés sont la méthode telle qu'elle est montrée au
  client. Un formulaire les rend modifiables sans relecture.

### 3. Bibliothèque des outils déjà classés

**Ce qui existe** : la liste par site (`clients.outils` — de la donnée) et les
tables de classement (`TABLE_A`, `GENERIQUES`, `TABLE_B` dans
`src/lib/environnement-it.ts` — du **code**, et des **clefs**).

**Ce qui est demandé** : une base partagée, qu'on incrémente à chaque nouveau
client, et dans laquelle on récupère l'existant.

**Le risque, nommé** : le classement se calcule à l'affichage depuis le nom de
l'outil. Une bibliothèque modifiable change donc l'environnement IT de **tous
les sites à la fois, rétroactivement**, sans qu'aucun écran ne le signale.

**Deux propriétés le rendent acceptable, et elles existent déjà :**

1. **La bibliothèque complète les tables de code, elle ne les remplace pas.**
   Lecture : bibliothèque d'abord, code ensuite. Une entrée absente ou cassée
   retombe sur le comportement d'aujourd'hui, jamais sur « Non classé ».
2. **Les corrections par site l'emportent sur le calcul.** `siAvecVue`
   enregistre la structure affichée et les écarts au calcul, pas les outils :
   un site rangé à la main est donc immunisé contre un changement de
   bibliothèque.

**La boucle demandée** : depuis « Non classé » d'un site, un geste qui verse
l'outil et son rangement dans la bibliothèque. C'est ce qui fait que le travail
d'un audit sert au suivant.

### 4. Les traductions, corrigées une seule fois

**Ce qui existe** : `clients.si.traductions`, **par site**. 279 entrées sur deux
sites. Corriger « depending on PU » sur un site laisse la faute sur tous les
autres.

**Ce qui est demandé** : une liste éditable, partagée.

**Ordre de lecture proposé** : entrée du site, puis bibliothèque partagée, puis
calcul. Un site garde ainsi le droit de traduire un terme à sa façon — un
verbatim d'opérateur n'a pas à suivre le glossaire — tout en profitant du
partage par défaut.

**Décision nécessaire** : quand on corrige au crayon dans un diagnostic, la
correction part-elle dans la **bibliothèque partagée** (c'est le sens de
« corriger une seule fois ») ou reste-t-elle **sur le site** ? Recommandation :
le partagé par défaut, un choix explicite pour le local.

**Amorçage** : les 279 entrées existantes peuvent alimenter la bibliothèque. Les
corrections humaines priment sur les automatiques en cas de collision.

---

## Où vivent les deux bibliothèques

Ni la bibliothèque d'outils ni celle des traductions n'appartiennent à un site.
Il n'existe aujourd'hui **aucun endroit pour une donnée globale** — chaque ligne
de `clients` est un site, et détourner `template-use-case` en sac de réglages
serait un bricolage qu'on paierait longtemps.

**Chemin recommandé** : une table `reglages(clef, valeur jsonb, version)`, une
ligne par bibliothèque. Elle sert les deux onglets, garde la même garde de
version optimiste que le reste, et n'ajoute qu'une politique d'accès.

---

## Ce qui doit être décidé avant d'écrire

1. **La répartition groupe / marque / site des sept lignes existantes.** Aucune
   règle ne la devine. À demander ligne par ligne.
2. **La cible du crayon de correction** : bibliothèque partagée ou site.
3. **Les libellés de maturité passent-ils vraiment en donnée**, ou l'onglet se
   contente-t-il de les afficher pour relecture ?

## Ordre d'avancement proposé

Du moins bloqué au plus bloqué, pour ne pas attendre une décision pour
commencer :

1. **La table `reglages` et la bibliothèque de traductions** (onglet 4) — aucune
   décision de modèle, valeur immédiate, et elle amorce l'écran.
2. **La bibliothèque d'outils** (onglet 3), qui réutilise la même table.
3. **Les clients et sites** (onglet 1), une fois la répartition tranchée.
4. **La trame et la maturité** (onglet 2) — le raccourci d'abord, le passage des
   libellés en donnée seulement s'il est confirmé.
