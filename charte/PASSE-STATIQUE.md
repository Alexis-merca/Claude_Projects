# Passe statique — lecture du code Lovable

Relevé par lecture du code source, sans exécution : le réseau de cet
environnement refuse l'aperçu Lovable (`403 to CONNECT`, refus de politique).
Ce document dit ce que le code fait, jamais qu'il marche.

Fichiers lus : `routes/_authenticated/clients.$code.tsx`, `clients.index.tsx`,
`impression.$code.tsx`, `components/diagnostic/EnvironnementIT.tsx`,
`SchemaEchanges.tsx`, `lib/environnement-it.ts`, `lib/schema-outils.ts`,
`lib/diagnostic.ts`, `lib/roles-processus.ts`.

---

## 1. Défauts confirmés

### 1.1 Glisser une boîte du schéma écrit en base à chaque mouvement de souris

Le plus lourd. La chaîne est directe :

`onPositions` → `ecrire` → `onPatch` → `patchClient.mutate` →
`updateClientRow(id, version, patch)`

et `updateClientRow` garde l'écriture par `.eq("version", version)`, en levant
`ConflitDeVersion` si aucune ligne ne correspond.

Or `onPositions` est appelé depuis `bouger`, branché sur `pointermove`. Donc :

1. chaque pixel parcouru déclenche un `UPDATE` sur la table `clients` ;
2. la première écriture réussit et fait avancer la version côté serveur ;
3. `client.version` en mémoire reste périmé jusqu'à ce que le `invalidateQueries`
   ait rechargé — plusieurs dizaines de millisecondes ;
4. le `pointermove` suivant part avec l'ancienne version, ne correspond à rien,
   et lève **« Ce diagnostic a été modifié par quelqu'un d'autre »**.

Déplacer une boîte devrait donc afficher le bandeau rouge de conflit après
quelques pixels, et la position ne pas tenir. Le point `L37` échouera.

Le correctif est de garder la position en état local pendant le glissement et
de n'écrire qu'au relâchement — un seul `UPDATE` par déplacement.

### 1.2 Suppression d'un diagnostic sans aucune confirmation

`clients.index.tsx` : `onClick={() => remove.mutate(c.id)}`.

Un clic sur la corbeille détruit le client, ses processus, ses étapes, ses
frictions et ses chiffres. Aucune boîte de dialogue, aucun rattrapage. Le
mono-fichier demandait confirmation en nommant le client. Sur une base
d'audits terrain non ré-exportables, c'est le défaut le plus coûteux de la
liste après le 1.1.

### 1.3 Suppression d'un processus sans confirmation ni garde-fou

`clients.$code.tsx` : `onSupprimer={() => supprimerProcessus.mutate(p.id)}`.

Pas de confirmation chiffrant les étapes perdues (`F3`), et rien n'empêche de
supprimer le dernier processus (`F4`).

### 1.4 La synthèse n'existe nulle part — et n'existera pas

`Synthese.tsx` et `lib/synthese.ts` sont présents mais ne sont importés par
aucune des trois routes. La vue d'impression enchaîne : une page par processus,
puis Environnement IT (blocs), puis Environnement IT (schéma). Pas de page
synthèse.

**Tranché le 31/07 : la synthèse est abandonnée.** Ce n'est donc plus un
manque mais du code mort, à supprimer. L'enchaînement d'impression reste celui
ci-dessus, et le travail fait sur l'environnement IT — mosaïque statique,
schéma des échanges, placement déterministe, tables de dérivation — est validé
et n'est pas touché.

### 1.5 Aucun import JSON, et un export non réimportable

L'export existe (`exporter`, un `Blob` téléchargé), l'import non. Points `B8`
à `B12` absents.

Le format y est pour quelque chose. L'export déverse les lignes brutes —

```js
const donnees = { ...client, processus: processus.map((p) => ({ ...p, ...parProcessus[p.id] })) };
```

— donc les `id`, `client_id`, `processus_id`, `version`, `cree_le` et `maj_le`.
Ces colonnes sont internes : réimportées, elles entrent en collision ou mentent.
Le fichier est lisible par un humain, inutilisable en entrée.

Forme portable, dérivée des tables telles qu'elles sont : les clés naturelles
`client.code` et `processus.code`, la hiérarchie `client → processus → étapes /
frictions / chiffres`, `outils` et `si` sur le client, et rien d'interne.
`ordre` et `rang` sont renumérotés en 1..n depuis la position dans le tableau
plutôt que repris du fichier.

Deux contraintes d'écriture à l'import : le processus s'insère **avant** ses
étapes, la base contrôlant que `etapes.role` appartient à `processus.roles` ;
et l'opération doit être atomique, donc côté Postgres — la base expose déjà
`client_json(p_code)`, à regarder avant d'écrire un troisième chemin.

### 1.6 Les rôles ne se réordonnent pas, et la couleur suit la position

`roles-processus.ts` expose `ajouterRole`, `renommerRole`, `supprimerRole`.
Rien pour monter ou descendre un couloir : `H19` et `H20` absents. L'ordre des
couloirs commande pourtant la lisibilité du diagramme, et un rôle ajouté en
cours d'audit reste coincé en bas.

Le blocage n'était pas là. La teinte d'un rôle vient de son index dans
`palette`, construit par ordre de rencontre :

```js
for (const p of processus) for (const r of p.roles) if (!out.includes(r)) out.push(r);
```

Réordonner les couloirs repeindrait donc tout le diagramme, et un lecteur
croirait voir d'autres rôles. Inacceptable dans un document de restitution :
c'est ce qui rendait le réordonnancement impossible à livrer seul.

**Tranché le 31/07 : la couleur est attachée au rôle, pas à sa position.**
Empreinte déterministe du nom normalisé projetée sur la liste de pastels, et
en cas de collision entre deux rôles d'un même client, départage par
`localeCompare` sur le **nom** — jamais sur la position, sinon le problème
revient par la fenêtre. Un seul helper partagé par le diagramme,
`GestionRoles`, `PanneauFrictions` et `SaisieRapide`.

Critère : monter un rôle, en ajouter un, en supprimer un — aucune de ces trois
actions ne change la couleur d'un autre rôle.

### 1.7 Un processus peut se retrouver sans aucun rôle

`ajouterProcessus` crée avec `roles: []`, et `supprimerRole` ne refuse pas le
dernier. Le mono-fichier refusait, en invitant à renommer plutôt qu'à
supprimer (`H22`).

### 1.8 Un nom de rôle contenant une virgule casse la suppression

```
.or(`role.eq.${nom},role2.eq.${nom}`)
```

Le libellé est interpolé tel quel dans un filtre PostgREST, dont la virgule est
le séparateur. Un rôle nommé `Chef d'équipe, adjoint` — plausible — produit
quatre fragments au lieu de deux, dont un invalide.

Précision sur la gravité : le cas courant est un **400 de PostgREST**. La
requête est rejetée, l'erreur remonte brute dans un toast, et le rôle devient
impossible à supprimer sans qu'on comprenne pourquoi. Gênant et incompréhensible,
pas dangereux. Le scénario silencieux — un filtre valide mais différent de celui
voulu — demande des parenthèses dans le nom, que PostgREST interprète comme des
groupes ; beaucoup moins probable. C'est donc un défaut de robustesse, pas un
risque pour les données.

Correctif : deux requêtes séparées plutôt qu'un `or` bâti par concaténation.

### 1.9 Le motif `mes` de la table A attrape « Messagerie »

`{ motifs: ["mes", "aveva", "wonderware"], bloc: "production", etape: "Suivi de ligne" }`

La correspondance est par sous-chaîne : `messagerie` contient `mes`. Un outil
nommé « Messagerie » atterrit donc dans **Production & MES / Suivi de ligne**.
Latent — il ne se déclenche que si le mot apparaît dans un nom d'outil — mais
c'est le seul motif de trois lettres de la table, et le seul à ce risque.

### 1.10 La nature des échanges est décalée d'un cran

`environnementIT` lit `etapes[i].lien` pour qualifier l'échange entre l'étape
`i` et l'étape `i+1`. Or dans le moteur du diagramme, la flèche entre `i` et
`i+1` porte `etapes[i+1].lien` — c'est ce que lit `tracerFleches`.

Ce n'est pas une régression : le mono-fichier ne déduisait pas la nature du
tout, il la laissait vide. C'est un comportement neuf, décalé. Symptôme
visible : la nature affichée sur le schéma ne correspond pas à la flèche
tracée entre les deux mêmes étapes du diagramme.

### 1.11 On ne peut pas sélectionner une flèche sans changer sa nature

Le gestionnaire de clic fait les deux :

```js
onClick={() => {
  setSelection(a.clef);
  if (edition) surPaire(a, (e) => ({ ...e, nature: suivante(a.nature) }));
}}
```

En mode édition, ouvrir l'éditeur pour lire ou corriger « ce qui passe » impose
donc de modifier la nature. Il faut trois clics pour revenir à la valeur de
départ.

La consigne est en cause, et elle est retirée : le cycle au clic avait été
demandé par cohérence avec le diagramme de flux, sans voir que l'éditeur de
flèche porte déjà une liste déroulante des trois natures. Les deux font le même
travail, l'un des deux gêne. Le clic ne fait plus que sélectionner.

---

## 2. Manques mineurs

- `L3` — le compteur « N domaine(s) · N outil(s) · N échange(s) » n'existe pas
- `L4` — la mention « Classement proposé » / « ajusté à la main » n'existe pas
- `L8` — l'infobulle d'un outil donne son nom, pas le nombre d'étapes où il sert
- `B5`, `B7`, `B13` — exports `clients-data.js` et base entière, réinitialisation :
  absents, et sans objet maintenant que les données vivent en base

---

## 3. Conforme, et bien fait

Le placement du schéma tient l'exigence de déterminisme, et pas seulement de
nom : aucun `Math.random()`, aucune simulation animée, un calcul synchrone en
un passage sur des emplacements fixes, et **tout parcours part d'un tri
explicite** — y compris le choix de l'ancre, qui trie les nœuds déjà posés
avant de chercher le voisin le plus lié. C'est le détail qu'on oublie et qui
suffit à rendre une image instable.

Le reste des points tenus :

- épaisseur `1,5 → 6 px`, linéaire, tous au plus fin si les fréquences sont
  égales — exactement la formule demandée
- l'épaisseur code la fréquence, la couleur la nature, jamais l'inverse
- échange réciproque : une ligne, deux pointes (`sens: "double"`)
- bande `Sans échange relevé` pour les outils isolés
- `<h2>` « Les outils du site »
- mosaïque de blocs statique, plus aucune flèche entre blocs
- tables A et B transcrites fidèlement, génériques compris
- `etapes.phase` n'est lue nulle part dans la section — le commentaire le dit
  et le code le tient
- `src/flux/` n'est pas modifié : le bouton « Saisie rapide » est greffé dans
  l'en-tête du diagramme **par un portail** plutôt qu'en retouchant le
  composant. C'est la bonne réponse à la contrainte.
- le renommage d'un rôle propage sur `etapes.role`, `etapes.role2` **et**
  `frictions.role`
- « Recalculer » et « Replacer automatiquement » demandent confirmation et
  annoncent qu'ils écrasent
- les anciens échanges entre blocs sont écartés à la relecture, par
  vérification que les deux extrémités sont des outils connus

---

## 4. Différences assumées — ne pas signaler

- **Impression en 16:9**, une page par processus mise à l'échelle, au lieu de
  pages A4. Format de restitution, pas de rapport.
- **Export PowerPoint** (`export-pptx.ts`), qui n'existait pas.
- **Authentification et travail à plusieurs**, avec verrouillage optimiste par
  version et bandeau de conflit. Absent du mono-fichier, et c'est ce qui
  protège les données d'audit.
- **Recherche et filtre** sur la liste des clients.
- **Pas de tiroir** : une page `/clients` tient ce rôle.
- **Suppression d'un rôle refusée** tant qu'une étape s'y réfère, au lieu de
  réaffecter après confirmation. Plus sûr, mais impose de vider le couloir à la
  main — à trancher à l'usage.
- **Édition des outils dans chaque bloc**, au lieu de la liste « Classement des
  outils » à sélecteurs.

---

## 5. Ce que la lecture ne peut pas dire

À vérifier à l'écran, la lecture n'y donne pas accès :

- `L29` — le déterminisme **observé** : le code ne peut pas tirer au hasard,
  mais seuls deux chargements comparés le prouvent
- la lisibilité du graphe : chevauchements et croisements sur un site très
  outillé
- la convergence de la mise à l'échelle à l'impression — la boucle de réglage
  s'arrête après deux passages stables **ou 40 tours** ; ce plafond ne se voit
  qu'en le dépassant
- `G12`, l'écart entre jalons, et le glisser-déposer des étapes : ils vivent
  dans `src/flux/`, non modifié, donc probablement intacts — « probablement »
  n'est pas « vérifié »
- `O4`/`O5`, focus et curseur pendant la frappe : sans objet ici, React ne
  réécrit pas la page entière. Mais `ChampEnPlace` valide au `blur` : reste à
  voir si la saisie est fluide et si une valeur non validée peut se perdre.

---

## 6. Vérification après correctifs — 31/07

Relecture des fichiers touchés. Même réserve qu'en tête de document : ceci dit
ce que le code fait, pas qu'il marche.

**Les onze points sont traités.**

| Point | État | Preuve dans le code |
|---|---|---|
| 1.1 glissement | corrigé | `glisse` en état local, `onPositions` appelé dans `finir` seulement |
| 1.2 suppression client | corrigé | `AlertDialog` nommant le client, décompte par `compterContenuClient` |
| 1.3 suppression processus | corrigé | `AlertDialog` chiffré + refus si `processus.length <= 1` |
| 1.4 synthèse | supprimée | `Synthese.tsx` et `lib/synthese.ts` absents de l'arborescence |
| 1.5 import/export | corrigé | `lib/echange-json.ts`, `client_json` réécrite, `importer_client_json` |
| 1.6 rôles | corrigé | `monterRole` / `descendreRole` + `lib/roles.ts` |
| 1.7 dernier rôle | corrigé | `if (p.roles.length <= 1) throw`, création avec `roles: ["Rôle 1"]` |
| 1.8 virgule | corrigé | deux `.eq()` séparés, le `.or()` concaténé a disparu |
| 1.9 motif `mes` | corrigé | retiré, avec le commentaire qui dit pourquoi |
| 1.10 décalage | corrigé | `etapes[i + 1].lien`, commentaire citant `tracerFleches` |
| 1.11 clic sur flèche | corrigé | `onClick={() => setSelection(a.clef)}`, `suivante` supprimée |

### Deux solutions qui méritent d'être notées

`lib/roles.ts` résout la couleur sans toucher au moteur. Celui-ci calcule
`PASTELS[paletteRoles.indexOf(role) % 8]` : plutôt que de le modifier, on lui
passe une **palette de places** où l'index d'un rôle vaut la pastille qu'on lui
a attribuée par empreinte de son nom, les trous bouchés par des jetons inertes.
La contrainte « ne pas écrire dans `src/flux/` » est tenue sans contournement.

`echange-json.ts` ajoute une précaution qui n'était pas demandée : à la lecture,
le rôle d'une étape est vidé s'il ne figure pas parmi les couloirs déclarés du
processus. Cela désamorce en amont la contrainte de base qui aurait fait échouer
l'import, et la fonction SQL refait la même vérification de son côté.

### Résidus

**La stabilité des couleurs n'est pas absolue.** Elle l'est contre le
réordonnancement — c'était l'objectif, et il est atteint : la palette est
calculée sur l'ensemble trié des noms, donc indifférente à l'ordre. Mais si
deux rôles tombent sur la même pastille, le départage dépend de l'ensemble
présent : supprimer le premier des deux fait glisser le second sur la pastille
libérée. Le critère « zéro changement à l'ajout et à la suppression » n'est
donc tenu qu'en l'absence de collision. C'est inhérent à huit pastilles et une
empreinte ; seule une attribution persistée serait exacte. À accepter ou à
traiter plus tard.

**Un point que la lecture ne tranche pas.** En mode injection,
`importer_client_json` fait `delete from public.processus where client_id = ...`
et compte sur un `ON DELETE CASCADE` vers les étapes, frictions et chiffres. Les
définitions de clés étrangères que j'ai lues n'exposent pas la règle de
suppression. Si la cascade manque, l'injection échouera sur une violation de
contrainte — la transaction annulera tout, donc sans dégât, mais la fonction
sera inutilisable. Le premier essai d'injection le dira.

**Deux traces obsolètes**, cosmétiques. Le `head` de la route
`clients.$code.tsx` annonce encore « chiffres clés et synthèse du site » dans sa
description, et le commentaire au-dessus de `palette` affirme toujours que la
teinte d'un rôle est son index. Ni l'un ni l'autre ne change le comportement.

---

## 7. Zoom et défilement — vérification du 31/07

### Le défilement horizontal

Corrigé, et la cause était bien celle annoncée. `DiagrammeFlux` relève désormais
`scrollLeft` en continu, par un écouteur `scroll` en phase de capture posé sur
l'hôte — les évènements de défilement ne remontent pas, mais la capture les
atteint. La valeur est reposée dans le `useLayoutEffect` déclenché par le
changement de balisage, donc avant la peinture : aucun saut ne se voit.

Portée exacte : le défilement survit aux **reconstructions** — ajout de support,
saisie, déplacement d'étape. Il ne survit pas au changement d'onglet, la
référence mourant avec le composant. C'est conforme à la demande, mais autant
le savoir.

### Le zoom

Sorti du diagramme, comme demandé, et un cran au-delà. `DiagrammeFlux` accepte
`zoom` et `onZoom` et devient contrôlé, avec repli sur son état local si l'hôte
ne fournit rien. La page tient une `Map` par processus dans une référence, et
`SectionProcessus` en garde une copie locale pour redessiner.

Ce détour par une référence n'est pas une coquetterie : Radix démonte l'onglet
inactif. Un zoom porté par le diagramme, ou même par l'état de la section,
repartirait donc à 100 % à chaque aller-retour entre processus. Là, chacun
retrouve le sien.

L'ancien rattrapage a disparu de `DiagrammeAvecZoom`, qui ne fait plus que
rejouer `acheverRendu` après reconstruction.

### Une fausse alerte, levée

`ajuster` est déclaré `useCallback(..., [])` alors qu'il appelle `setZoom`, qui
dépend lui-même de `onZoom`. C'est une violation d'`exhaustive-deps` : le bouton
« Ajuster » capture les fonctions du premier rendu et ne les met jamais à jour.

Vérification faite, **c'est sans effet aujourd'hui**. La chaîne qu'il capture
n'atteint que `zooms.current` — une référence, donc toujours à jour — et
`setZoomVu`, un poseur d'état stable. Une copie périmée se comporte exactement
comme la copie fraîche.

Cela reste un piège : le jour où `onZoom` lira une valeur d'état plutôt qu'une
référence, le bouton « Ajuster » se mettra à écrire depuis un instantané périmé,
sans rien signaler. Ajouter `setZoom` aux dépendances coûte un caractère.

### Deux commentaires devenus faux

Le commentaire au-dessus du bouton de saisie rapide affirme encore que
`src/flux/` ne se modifie pas, alors que `DiagrammeFlux.tsx` vient de l'être —
la règle réelle distingue le moteur, intouchable, de l'enveloppe React. Et celui
au-dessus de `palette` dit toujours que la teinte d'un rôle est son index, ce
qui n'est plus vrai depuis `lib/roles.ts`. Sans effet sur le comportement, mais
ce sont les commentaires qui égarent la prochaine lecture.

### Clôture — 31/07, 11 h 59

Les trois retouches de texte et la dépendance sont faites, mesures à zéro :
`tsgo --noEmit` → 0 erreur, `eslint --max-warnings 0` sur `DiagrammeFlux.tsx`
→ 0, occurrences de « synthèse » dans `clients.$code.tsx` → 0.

Le balayage a trouvé une quatrième mention que je n'avais pas relevée : le
commentaire au-dessus de `enfants` disait encore « les KPI **comme la synthèse**
en dépendent ». Chercher le mot valait mieux que corriger les endroits nommés.

Une nuance sur le second chiffre : le fichier porte toujours un
`eslint-disable-next-line react-hooks/exhaustive-deps`, sur l'effet qui ne doit
pas dépendre du zoom sous peine de reconstruire le DOM à chaque cran de curseur.
Il est délibéré et motivé en commentaire. Le zéro porte sur les avertissements
réellement levés, pas sur l'absence de toute suppression.

---

## 8. L'export JSON — vérifié sur la base réelle

Cette fois, pas de lecture de code : la fonction a été exécutée contre la base,
sur `sekurit-float-france`.

### La forme

```
racine     : client, exporte_le, format, version
client     : code, date_visite, nom, notes, outils, processus, si, site
processus  : chiffres, code, etapes, frictions, nom, rang, roles, soustitre
etapes     : lien, ordre, phase, role, role2, supports, texte
frictions  : rang, role, texte
chiffres   : libelle, rang, valeur
```

`format` vaut `diagnostic-os`, `version` vaut 1, le fichier pèse 12,5 ko.

Exactement les clés déclarées dans `echange-json.ts`, ni plus ni moins. **Aucun
`id`, `client_id`, `processus_id`, `cree_le` ni `maj_le` nulle part** — le seul
`version` est celui du format, à la racine, et l'import l'ignore.

### Rien ne se perd

| | base | export |
|---|---|---|
| processus | 4 | 4 |
| étapes | 49 | 49 |
| frictions | 16 | 16 |
| chiffres clés | 11 | 11 |

Et `si` porte bien sa clé `environnement_it`, donc les blocs, les échanges et
les positions du schéma voyagent avec le reste.

### Chaque clé lue par l'import existe dans l'export

Confrontation des deux listes : `importer_client_json` lit `nom`, `site`,
`date_visite`, `notes`, `outils`, `si`, `code` sur le client ; `code`, `nom`,
`soustitre`, `roles` et les trois collections sur le processus ; `role`,
`role2`, `texte`, `phase`, `supports`, `lien` sur l'étape. Toutes sont
présentes.

`ordre` et `rang` font exception : ils sont **écrits** par l'export mais
**ignorés** par l'import, qui renumérote depuis la position dans le tableau.
C'est voulu — le fichier reste lisible par un humain sans que l'import ait à
faire confiance à des numéros éventuellement trafiqués.

### La cascade existe

Question laissée ouverte au § 1.5, désormais tranchée. Les quatre clés
étrangères sont en `ON DELETE CASCADE` :

```
processus → clients     CASCADE
etapes    → processus   CASCADE
frictions → processus   CASCADE
chiffres  → processus   CASCADE
```

Le `delete from processus` de l'injection emporte donc bien les étapes,
frictions et chiffres, et la suppression d'un client emporte tout l'arbre.

---

## 9. L'import — exécuté pour de bon

Le dernier maillon non prouvé. Testé sur la base réelle, avec une précaution :
plutôt que d'écrire dans `test-alexis` comme prévu, j'ai constaté qu'il ne
contenait que 4 étapes, aucune friction et aucun chiffre — il n'aurait rien
exercé. J'ai donc importé le JSON de Sekurit **comme nouveau diagnostic**, ce
qui a produit un bac à sable riche, et j'ai malmené celui-là. Ni Sekurit ni
`test-alexis` n'ont été modifiés.

### Aller-retour, chemin « nouveau diagnostic »

`importer_client_json(client_json('sekurit-float-france'), null)` a rendu
`sekurit-float-france-2` — le code déjà pris a bien été suffixé plutôt
qu'écrasé.

Comparaison des deux exports, `exporte_le` et `client.code` neutralisés
puisqu'ils doivent légitimement différer :

**`identiques → true`**

Égalité `jsonb` sur le document entier, pas seulement sur des compteurs. 4
processus, 49 étapes, 16 frictions, 11 chiffres de part et d'autre. Le fichier
exporté reconstitue donc le diagnostic à l'identique.

### Injection, le chemin destructif

J'ai ensuite injecté dans cette copie le contenu **différent** de `test-alexis`,
pour vérifier que l'injection remplace au lieu de fusionner — le risque étant
que les anciens processus survivent à côté des nouveaux.

| | avant injection | après |
|---|---|---|
| étapes | 49 | 4 |
| frictions | 16 | 0 |
| chiffres | 11 | 0 |

**`contenu_identique_a_test_alexis → true`**, `code` conservé
(`sekurit-float-france-2`), `nom` remplacé par « Test Alexis ». L'ancien contenu
a bien été détruit.

Et le contrôle qui compte vraiment : **zéro étape orpheline, zéro friction
orpheline** dans toute la base. La cascade fait son travail, rien ne reste
accroché à un processus disparu.

### Nettoyage

Le bac à sable est supprimé. La base est revenue à ses deux diagnostics, avec
leurs compteurs d'origine — Sekurit 4/49/16/11, `test-alexis` 4/4/0/0, sa
version toujours à 1, donc jamais écrit.

### Bilan

La chaîne export → fichier → import est vérifiée de bout en bout, par
l'exécution et non par la lecture. Le point `1.5` est clos, ainsi que la
réserve sur la cascade.

---

## 10. Trame de blocs et insertion d'étape — vérification du 31/07

Lecture de `lib/environnement-it.ts` et de `flux/mutations.d.ts`, plus l'état
réel de la base.

### Ce qui est tenu

**La trame** : douze blocs, dans l'ordre demandé, avec leurs activités. Table A
réalignée — `padoa` → `suivi-medical / Visites médicales`, `caces` →
`habilitation / Habilitations et recyclages`, `sap` → `erp / Données de
référence`. Table B suit, et le motif `medical` a été retiré de la ligne
`habilitation` pour ne pas entrer en concurrence avec le nouveau bloc.

**La séparation structure / contenu / corrections**, qui était le cœur du
sujet. `EnvITStock` n'enregistre que la structure, les corrections, les
échanges et les positions — **jamais les outils**. `calculEnvIT` ne lit que les
supports des étapes ; `vueEnvIT` remplit la structure avec ce calcul puis
applique les corrections. L'affichage est donc toujours à jour.

Deux détails valent d'être notés. `envITEnregistre` **ignore délibérément** la
structure figée des versions antérieures — le commentaire le dit et le code le
fait. Et `siAvecVue` ne demande pas d'évènement « j'ai déplacé cet outil » : il
**déduit** les corrections en comparant la vue affichée au calcul. Un outil
absent de la vue alors que le calcul le place quelque part est enregistré comme
masqué. C'est plus robuste qu'un journal de gestes.

**Les lignes vides** : `sansLignesVides` filtre lignes et blocs vides pour
l'impression et le PPTX. **Le compteur** : `stats` porte les quatre nombres.

**Les mutations manquantes** : `insererEtape`, `supprimerEtape`, `ajouterEtape`
existent, avec un champ `suppression` sur `Mutation` et un jeton `CREATION` qui
tient la place de l'étape créée dans le tableau d'ordre — détail nécessaire que
je n'avais pas spécifié.

### La donnée figée a été effacée

`si` valait `{}` sur Sekurit après l'opération, contre un `environnement_it`
complet auparavant. La structure périmée — deux blocs, BOOST et SharePoint
absents — a donc été supprimée, et tout se recalcule. C'est le bon choix de
migration, mais **c'était de la donnée client** : les blocs qui y avaient été
ajustés à la main sont perdus. Ils étaient périmés, ce qui limite la casse.

### Deux réserves

**Le gel des échanges reste une porte à sens unique.** `stock.echanges` vaut
`null` tant que personne n'y touche, et les échanges se recalculent. Dès qu'un
utilisateur change une nature, en ajoute ou en supprime un, le tableau est
enregistré — et **plus rien ne le remet à `null`**. « Recalculer »
(`siSansCorrections`) n'efface que les corrections, pas les échanges. Un support
ajouté plus tard ne produira donc jamais de nouvel échange.

C'est exactement le défaut qu'on vient de corriger sur les blocs, resté intact
sur l'autre moitié de la section. Le correctif est symétrique : que
« Recalculer » remette aussi `echanges` à `null`, ou qu'un second bouton le
fasse.

**Le bloc Qualité & QHSE a disparu**, et c'est mon erreur : ma trame de douze
blocs ne le comportait pas. Les motifs `qms`, `qualite`, `non-conformite` ont
donc quitté la table A. Un outil qualité tombera dans « Non classé ». À
rajouter si vos audits en rencontrent.

### Ce que je n'ai pas vérifié

Le câblage des composants. J'ai lu la couche modèle et le contrat des
mutations, pas `EnvironnementIT.tsx` ni les boutons du diagramme. Que les
fonctions existent et soient justes ne dit pas qu'elles sont appelées.

### Les deux correctifs — vérifiés

**Le gel des échanges est levé.** `siSansCorrections` remet désormais
`echanges` à `null` en plus d'effacer les corrections, et laisse `positions`
intact — les réglages d'affichage ne sont pas des données de constat.

**Et la confirmation ne ment pas**, ce qui était la moitié de la demande :

> Recalculer efface les corrections de classement des outils et les ajustements
> d'échanges (natures, ajouts, suppressions de flèches). Les positions des
> boîtes du schéma sont conservées. Continuer ?

Le libellé du bouton suit — « Recalculer (efface corrections et échanges) ».

**Le bloc Qualité & QHSE est rétabli**, entre Maintenance et GED, avec ses trois
activités. La trame compte treize blocs. Les entrées `qms`, `qualite`,
`non-conformite`, `r43` en table A et `qualite`, `audit`, `conformite` en table B
sont placées **en dernier**, chacune avec le commentaire qui dit pourquoi : un
outil médical ou d'habilitation dont le nom contient un mot qualité doit tomber
dans son domaine propre, pas dans Qualité.

### Un choix que je n'avais pas spécifié, et qui est juste

Les outils du bandeau de titre d'un bloc ne sont plus retirables. Le commentaire
l'explique : ce bandeau est la **réunion** des outils des lignes, donc une
valeur dérivée. Un outil se déplace ligne à ligne ; le retirer du bandeau
n'aurait eu aucun sens et aurait produit une correction incohérente.

Le compteur d'avancement est en place et masqué à l'impression, et le composant
reçoit une propriété `impression` qui déclenche `sansLignesVides`.

### Deux points de vigilance, sans gravité

Le motif `visite` de la table B envoie vers `Suivi médical`. C'est juste dans un
contexte industriel — une visite y est médicale neuf fois sur dix — mais un
processus nommé « Visite de sécurité » ou « Visite client » y tomberait aussi.
Même famille que le motif `mes` qui attrapait « Messagerie », en moins probable.

**La trame est capturée à la première retouche.** Dès qu'un bloc est renommé ou
qu'une activité est ajoutée, `structure` est enregistrée. Un enrichissement
ultérieur de `TRAME` — un quatorzième bloc — n'atteindra donc pas les
diagnostics déjà édités. C'est inhérent au modèle et acceptable ; il faut juste
le savoir avant de s'étonner qu'un nouveau bloc n'apparaisse pas partout.

---

## 11. Authentification Google restreinte à `@merca.team` — 31/07

### Le point de départ

`src/routes/auth.tsx` exposait `supabase.auth.signUp` **sans aucun filtre**,
avec une bascule « Créer un accès ». Quiconque connaissait l'URL pouvait se
créer un compte, et les politiques se contentant de `auth.uid() IS NOT NULL`,
lire et écrire tous les diagnostics — des relevés nominatifs de sites
industriels clients. C'était le vrai trou, plus encore que l'absence de Google.

### Vérifié en base

Les cinq tables portent une politique unique en `est_mercateam()`, en `USING`
comme en `WITH CHECK`, visant `authenticated`. Plus aucune occurrence
d'`auth.uid() IS NOT NULL`. La fonction est exactement celle demandée :

```sql
select split_part(lower(coalesce(auth.jwt() ->> 'email', '')), '@', 2) = 'merca.team';
```

Comparaison exacte sur la partie après l'arobase plutôt qu'un motif
`like '%@merca.team'` : le motif serait correct mais une retouche l'aurait
rendu faux, un `%merca.team` sans arobase acceptant `contact@faux-merca.team`.

`client_json`, `importer_client_json`, `reordonner_etapes` et `est_mercateam`
sont toutes en droits de l'appelant — **aucune n'est `SECURITY DEFINER`**, donc
aucune ne contourne les politiques.

### Vérifié côté navigateur

L'ancien formulaire a disparu : `auth.tsx` n'est plus qu'une route rendant
`CarteConnexion`. Ni `signUp`, ni `signInWithPassword`, ni champ mot de passe.
La garde ne laisse passer que l'état `authenticated`.

Un détail de mise en œuvre mérite d'être noté. Au refus, l'état passe à
`denied` **puis** la session est fermée côté serveur ; la fermeture rappelle
l'observateur avec une session nulle, et la transition préserve `denied` au lieu
de retomber sur `signed_out`. Sans cette précaution, le message de refus
disparaîtrait aussitôt affiché et l'utilisateur ne saurait pas pourquoi il est
bloqué.

### Une substitution non demandée

La connexion passe par `lovable.auth.signInWithOAuth` — le paquet
`@lovable.dev/cloud-auth-js` — et non par `supabase.auth.signInWithOAuth`. Le
courtier mène le parcours Google puis pose la session dans Supabase.

C'est une réponse légitime au point bloquant que j'avais signalé : plus besoin
d'un identifiant et d'un secret OAuth Google Cloud. Mais l'arrangement de
confiance change. L'authentification est courtée par l'application OAuth de
Lovable, pas par un client Google appartenant à Mercateam — contrairement à
« Deployment Internal OS ». L'écran de consentement vu par l'utilisateur est
celui de Lovable, et la connexion dépend de son service.

**Conséquence qui rachète tout** : même si ce courtier admet un compte Google
quelconque, la base refuse tout. `est_mercateam()` lit l'adresse dans le jeton
Supabase, quelle qu'en soit l'origine. Un compte extérieur obtient une session
valide et ne peut lire ni écrire une seule ligne. C'est précisément pourquoi il
fallait la vérification en base et pas seulement dans le navigateur.

### Deux réserves

**Le périmètre Google n'est pas vérifiable.** J'avais spécifié exactement
`openid email profile`. `lovable.auth.signInWithOAuth` n'accepte pas de
paramètre de périmètre : c'est celui de l'application OAuth de Lovable qui
s'applique. À lire sur l'écran de consentement à la première connexion.

**Retirer l'écran ne désactive pas le fournisseur.** Les deux comptes
e-mail / mot de passe existent toujours dans `auth.users`, et si le fournisseur
mot de passe reste actif côté Supabase, `signInWithPassword` fonctionne encore
par appel direct à l'API — l'absence de bouton ne ferme rien. Ces deux comptes
étant `@merca.team`, ce n'est pas une brèche ; mais la surface n'est réellement
réduite à Google que le jour où le fournisseur mot de passe est désactivé dans
la console Supabase.

---

## 12. Versionnement des diagnostics — 31/07

### Ce qui est en place

**La table.** Neuf colonnes conformes, RLS active, une politique en
`est_mercateam()`. Et **zéro clé étrangère** — la décision a tenu. Un
diagnostic supprimé laisse ses versions derrière lui, `code_client` et
`nom_client` recopiés permettant de les identifier et de les restaurer. Sans
ça, la suppression d'un client serait restée le seul cas irrécupérable, c'est-à-dire
le plus coûteux.

**`prendre_version`.** Recherche du client, idempotence du motif `quotidien` sur
des bornes de journée correctes, appel à `client_json`, auteur pris dans
`auth.jwt()`. Rend `null` plutôt que d'échouer quand il n'y a rien à faire.

**`restaurer_version`.** Prend un instantané `avant_restauration` **avant**
d'agir : se tromper de restauration n'est pas définitif. Si le client n'existe
plus, elle bascule en création — `importer_client_json(contenu, null)` — et
recrée le diagnostic depuis une version orpheline.

**Dans `importer_client_json`**, l'appel `prendre_version(v_id,
'avant_injection', '')` est placé immédiatement avant le `delete from
processus`. Même fonction plpgsql, donc même transaction : il ne peut pas y
avoir d'écrasement sans filet.

**Les compteurs** viennent d'un `versions_liste` calculé en base — le document
lui-même ne descend jamais au navigateur pour afficher une liste.

**L'ordre à la suppression d'un client**, qui était le point à ne pas rater :

```ts
await prendreVersion(id, "avant_suppression_client");
await deleteClientRow(id);
```

Séquentiel, instantané d'abord. Et l'enchaînement échoue du bon côté : si
l'instantané échoue, l'exception empêche la suppression.

### La recette a tourné contre la base réelle

Cinq versions sur Sekurit, les cinq motifs exercés, et **un seul `quotidien`**
malgré deux appels — l'idempotence tient. Un processus a été supprimé puis
restauré : le diagnostic est revenu à 4 processus, 49 étapes, 16 frictions,
11 chiffres, identique à son état d'origine. Taille d'une version : 9 à 12 ko.

### Trois réserves

**`auteur` est nul sur les cinq lignes.** Les appels de recette sont partis en
SQL direct, où `auth.jwt()` n'existe pas. Ce n'est pas un défaut, c'est un
chemin non exercé : la colonne se remplira dès qu'un utilisateur agira depuis
l'application. À vérifier au premier usage réel.

**Deux points d'appel ne sont pas prouvés.** Aucune ligne `avant_recalcul`
n'existe, et le `quotidien` observé peut venir du SQL de recette plutôt que de
l'ouverture d'un diagnostic en édition.

**Le panneau « Versions » n'a pas été lu.** La couche base et la bibliothèque
d'accès sont vérifiées ; l'écran qui les expose ne l'est pas.

---

## 13. Le panneau « Versions » — lecture, deux correctifs, vérification

La réserve qui fermait le §12 est levée : `PanneauVersions.tsx` a été lu. Deux
angles morts en sont sortis, aucun des deux n'étant un bug visible.

### 13.1 La liste n'avait aucune limite

`versions_liste` se terminait sur `order by v.cree_le desc` sans `LIMIT`, et le
panneau rendait toutes les lignes. Avec un instantané quotidien plus un par
opération risquée, un diagnostic suivi un an accumule des centaines de lignes.
Les lignes sont légères — les compteurs sont calculés en base, `contenu` ne
descend jamais — donc c'était un mur d'usage, pas de performance.

Corrigé : `p_limite int default 20`, `limit greatest(p_limite, 0)`, et un
bouton « Voir plus » par tranches de 20. Aucune purge automatique n'a été
ajoutée : une version supprimée est une restauration devenue impossible, la
décision appartient à l'utilisateur et pas à une règle de rétention muette.

Mesuré en base sur Sekurit (5 versions) :

| appel | lignes rendues |
|---|---|
| défaut (20) | 5 |
| `p_limite = 2` | 2 |
| `p_limite = 0` | 0 |
| `p_limite = -5` | 0 |

Le dernier cas justifie le `greatest` : `limit -5` est une erreur Postgres, pas
un ensemble vide. L'ancienne signature `versions_liste(uuid)` a été supprimée —
`pg_proc` n'en rend plus qu'une seule, il ne reste aucune surcharge ambiguë.
La fonction reste `STABLE`, invoker, `search_path` fixé à `public`.

### 13.2 La garde d'édition était chez l'appelant, pas dans le composant

Le composant ne portait pas de propriété `edition`. **Ce n'était pas un trou :**
le site de montage dans `clients.$code.tsx` enveloppait déjà le panneau dans
`{edition ? … : null}`, et le bouton « Restaurer » n'était donc pas accessible
en lecture. La protection était simplement au mauvais endroit — une condition
écrite chez l'appelant plutôt qu'une propriété du composant.

Corrigé : `edition: boolean` **obligatoire**. Un défaut permissif aurait
reproduit exactement le problème. En lecture, la liste des versions reste
visible — consulter l'historique est une lecture légitime — mais « Restaurer »
et « Marquer cette version » ne sont pas rendus du tout, pas seulement grisés.

Vérifié : un seul site de montage dans tout le projet, `clients.$code.tsx`, qui
passe `edition={edition}` et conserve son enveloppe. La vue d'impression
`impression.$code.tsx` n'importe pas le panneau.

### 13.3 Réserve restante

Le changement de `limite` change la clé de requête TanStack. Au clic sur
« Voir plus », la nouvelle clé n'a pas de données en cache : `isLoading` repasse
à vrai et la liste est remplacée par « Chargement… » le temps de l'aller-retour,
bouton compris. Clignotement, pas perte de données. `placeholderData: (p) => p`
le supprimerait. À grouper avec un prochain lot, ça ne vaut pas un aller-retour
seul.

Les réserves du §12 restent ouvertes : `auteur` toujours nul faute d'écriture
depuis l'application, `avant_recalcul` et `quotidien` non exercés par leurs
points d'appel réels.

---

## 14. Le classement `erp` / PowerPoint

`classer()` cherchait les motifs de `TABLE_A` en sous-chaîne. Le motif `erp` est
contenu dans `pow`**`erp`**`oint` : un outil nommé PowerPoint atterrissait dans
le bloc ERP, activité « Données de référence ». Le fichier connaissait déjà le
piège — il écarte explicitement le motif `mes` à cause de « Messagerie » — mais
`erp` était passé au travers.

Le balayage de tous les motifs de `TABLE_A` sur un vocabulaire d'outils
plausible a rendu trois correspondances situées au milieu d'un mot :
`erp`→PowerPoint (faux positif), `drive`→OneDrive (correct, et couvert par le
motif `onedrive`), `qms`→eQMS (correct mais fragile).

**Correctif** : un helper unique `correspond(motif, valeur)` qui teste
`\b` + motif — début de mot, pas mot entier, pour que `habilitation` continue
d'attraper « habilitations ». Appliqué à `TABLE_A`, `TABLE_B`, `GENERIQUES` et
`MOTIFS_LOGO`. Plus l'ajout du motif `eqms`, seule régression que le balayage
avait trouvée. Vérifié : plus aucun `.includes(` sur une liste de motifs.

**Rejeu indépendant sur 25 outils**, ancienne règle contre nouvelle, dans le
contexte d'un processus donné : **une seule ligne change**, PowerPoint passant
de `erp` à `non-classe`. eQMS reste dans `qualite`, OneDrive dans `ged`, les 22
autres sont identiques.

### Ce que le rejeu a révélé au passage

Un outil **générique** est placé une fois pour toutes, par le **premier
processus** qui l'emploie — `calculEnvIT` court-circuite sur
`if (!placements.has(clef))`. Sur la trame des dix use cases :

| outil | bloc | décidé par |
|---|---|---|
| Excel, Word, Mail | Compétences | UC 6, premier de la liste |
| Oral, Papier | Planning | UC 1 |
| PowerPoint | Non classé | UC 2, qui ne correspond à aucun motif de `TABLE_B` |

Excel est classé « Compétences » pour les dix use cases alors qu'il est
l'outil commun de tout le site. Ce n'est pas un défaut d'implémentation — le
code fait ce qu'il annonce — mais le résultat est faux en restitution, et il
dépend de l'ordre des processus. Consigné comme piste d'évolution, pas comme
correctif.

---

## 15. Les modules Mercateam dans le classement, et la vague frictions / maturité

### 15.1 Six entrées pour Mercateam

`TABLE_A` ne connaissait pas le produit : les cinq modules tombaient en
« Non classé », rendant illisible le schéma de la trame cible. Six entrées
ajoutées — cinq précises, plus un repli sur `mercateam` nu, parce que sur le
terrain personne ne tape « Mercateam (Planner) ».

**Rejeu indépendant**, en recopiant la table depuis le fichier :

| outil saisi | bloc | activité |
|---|---|---|
| Mercateam (Starter) | `competence` | Référentiel postes |
| Mercateam (Master) | `competence` | Matrice de polyvalence |
| Mercateam (Trainer) | `formation` | Suivi + évaluation |
| Mercateam (Planner) | `planning` | Affectation au poste |
| Mercateam (KPIs) | `bi` | Indicateurs de polyvalence |
| Mercateam · mercateam · MERCATEAM (PLANNER) | repli, casse normalisée | — |

Les cinq libellés d'activité sont **présents au caractère près dans `TRAME`** —
vérifié : `vueEnvIT` rapproche les lignes par nom normalisé, un libellé
approchant aurait créé une ligne en double.

Les huit outils déjà classés (SharePoint, Teams, OneDrive, Padoa, BOOST,
Kronos, SAP, Qlik) : **zéro changement**. `Teams` reste dans `ged` — c'était le
cas à surveiller, « mercateam » ne le capte pas, et le motif `teams` ne capte
pas « mercateam » faute de frontière de mot.

Le piège d'ordre est évité : placé avant les cinq, le repli nu les aurait tous
captés. Vérifié en rejouant l'ordre inverse — `Mercateam (Planner)` serait alors
tombé dans `competence` au lieu de `planning`.

**Une limite connue.** `Mercateam Planner`, sans parenthèses, tombe sur le repli
et atterrit dans `competence`. Les motifs exigent la forme parenthésée. C'est
une saisie plausible sur le terrain, à surveiller.

### 15.2 La vague frictions / maturité a atterri

Vérifié en base, pas sur parole :

- **PostgreSQL 17.6**, donc la forme demandée est disponible et a bien été
  utilisée : `FOREIGN KEY (etape_id, processus_id) REFERENCES etapes(id,
  processus_id) ON DELETE SET NULL (etape_id)`. La liste de colonnes est là —
  `processus_id`, qui est `not null`, n'est pas touché.
- `frictions.etape_id` nullable, `processus.maturite` smallint nullable,
  `processus.maturite_note` text not null.
- Contrainte `processus_maturite_plage` :
  `(maturite IS NULL) OR (maturite >= 1 AND maturite <= 5)`.
- **Sekurit : 16 frictions avant, 16 après, les 16 détachées.** Rien n'a été
  perdu à la migration.
- `template-use-case` : 141 étapes, inchangé.
- **Trois clients en base** : le diagnostic bac à sable de la recette
  d'aller-retour a bien été supprimé, aucun résidu.
- Le seul déclencheur sur `frictions` est `frictions_touche_parent`, celui qui
  existait déjà pour faire avancer la version du processus parent.
- `client_json` porte désormais `maturite` et `maturite_note` sur le processus,
  et `etape` sur la friction — `null` quand elle n'est rattachée à rien.

**Ce que je n'ai pas vérifié :** l'écran. La pastille sur les cartes du
diagramme en lecture, en édition et à l'impression demande un navigateur. Reste
à faire côté Alexis.

---

## 16. Les libellés de maturité, et la clef de use case

### 16.1 Ce qui a été livré

`src/lib/maturite.ts` (nouveau) porte les **dix échelles, cinquante niveaux**,
plus `clefUseCase`, `libelleNiveau` et `intituleUseCase`. Contenu éditorial dans
le code, comme `TRAME` — pas en base.

`processus.use_case text null`, contrainte `processus_use_case_valide` :
`use_case is null or use_case in ('uc1'…'uc10')`. Vérifié en base, la liste est
exactement celle demandée.

### 16.2 Les cinquante libellés

Comparés un à un avec `charte/MATURITE.md` : **conformes, y compris la
ponctuation** — les guillemets français de « qui sait faire quoi », les
deux-points de « Gestion proactive : … », le tiret de « ramp-up ». Aucune
reformulation.

### 16.3 Rien n'a été rempli automatiquement

**18 processus en base, 0 avec un `use_case`.** C'était la mesure qui
m'intéressait le plus : la tentation de déduire la clef du nom (« UC 6 - … »)
était forte, et c'est précisément ce dont on voulait cesser de dépendre. Le
`client_json` de Sekurit rend bien `"use_case": null`.

Données intactes : 3 clients, 16 frictions, 194 étapes.

### 16.4 L'écran

`Maturite.tsx` fait ce qu'il faut, vérifié à la lecture :

- en lecture, `maturite == null` rend `null` — rien du tout, pas de « —/5 » ;
- le libellé du niveau s'affiche sous la pastille, la justification en dessous ;
- en édition, les cinq niveaux portent chacun **leur libellé**, pas seulement
  leur chiffre ;
- sans use case : cinq niveaux nus et la mention « Choisir un use case pour
  afficher l'échelle » — **aucune échelle générique inventée** ;
- deux façons de revenir à « non évalué » : le lien explicite, et un second clic
  sur le niveau actif.

**L'impression** compose le libellé dans le sous-titre de la page du processus.
**Le PPTX n'avait pas besoin d'être modifié** : `exporterPptx` photographie les
`.page-16-9` de la vue d'impression, il hérite donc du libellé. Le diff ne
touche pas `export-pptx.ts`, et c'est correct — vérifié en lisant le fichier,
pas supposé.

### 16.5 L'aller-retour du format

`client_json` porte `use_case`, `maturite`, `maturite_note` sur le processus et
`etape` sur la friction. `importer_client_json` tient une correspondance
`ordre → id` (`v_ordres`) remplie à l'insertion des étapes, et y résout le champ
`etape` des frictions — c'est la seule façon correcte, les identifiants ne
survivant pas à un import.

**Une tolérance à noter.** L'importeur ramène silencieusement à `null` une
`maturite` hors de 1–5 et un `use_case` hors catalogue, au lieu d'échouer.
C'était demandé pour les frictions (« un fichier édité à la main ne doit pas
casser l'import ») et a été généralisé. Raisonnable, mais une faute de frappe
dans un fichier retouché perd la valeur sans un mot.

### 16.6 Un changement non demandé

`src/routeTree.gen.ts` perd son bloc `declare module '@tanstack/react-start'`.
Fichier généré, et `tsgo` reste à zéro erreur — mais c'est une modification que
personne n'a demandée. À surveiller si un typage de routeur se met à manquer.

### 16.7 Toujours pas vérifié

La pastille de friction sur les cartes du diagramme, en lecture, en édition et à
l'impression. Elle demande un navigateur.

---

## 17. Le use case devient l'unité du diagnostic

### 17.1 Ce qui a été livré

- `clients.trame text null`, contrainte `clients_trame_valide` :
  `trame is null or trame in ('existant','cible')`.
- `src/lib/trame-use-case.ts` (nouveau) : lecture de la trame, recopie d'un
  processus, création d'un use case ou d'un processus libre.
- `src/components/diagnostic/SelecteurUseCase.tsx` (nouveau) : les dix use
  cases avec intitulé et périmètre, les déjà audités grisés, « Autre
  processus » en fin de liste.
- Création d'un diagnostic : liste à cocher des dix use cases, plus « aucun
  pour l'instant ».
- Liste des diagnostics : les trames sortent dans une section repliée, portent
  une pastille, et leur bouton de suppression est désactivé.

`moteur.js` et `moteur.css` ne figurent pas dans le diff.

### 17.2 Vérifié en base

**Aucune donnée touchée** : 3 clients, 18 processus, 194 étapes, 16 frictions —
les mêmes qu'avant. `trame` à `null` partout, `use_case` à `null` partout.
Aucun diagnostic d'essai laissé derrière.

### 17.3 Le point délicat, correctement traité

`recopier()` remappe `etape_id` des frictions vers **les copies** des étapes, en
passant par l'`ordre` :

```ts
const ordreDe = new Map(etapes.map((e) => [e.id, e.ordre]));
etape_id: ordre != null ? (parOrdre.get(ordre) ?? null) : null
```

Sans ce détour, les frictions de la trame auraient pointé vers les étapes de la
trame elle-même, et une suppression dans la trame aurait détaché des frictions
chez un client. C'est le même raisonnement que pour l'import : les identifiants
ne traversent pas une copie.

Le rattachement trame → use case passe uniquement par `processus.use_case`,
jamais par le nom. Conforme.

### 17.4 Une divergence éditoriale à trancher

`PERIMETRES` dans `src/lib/maturite.ts` est **du texte neuf**. Je n'avais pas
fourni les périmètres, Lovable les a donc rédigés. Ils sont justes, mais ils
décrivent une seconde fois ce que le classeur de diagnostic décrit déjà — et
les deux formulations diffèrent :

| source | UC 6 |
|---|---|
| classeur (`soustitre` de la trame) | « Référentiel de compétences par poste, cartographie des niveaux réels, mise à jour, usage dans les décisions du quotidien, suivi de la couverture et de la polyvalence. » |
| `PERIMETRES` (code) | « Référentiel de compétences, matrice de polyvalence et évaluation au poste. » |

Une constante en code se justifie : le sélecteur doit afficher un périmètre
**avant** de consulter la trame, et la trame peut ne pas exister. Ce qui ne se
justifie pas, c'est que le texte diverge de la source. À aligner sur le
classeur, ou à assumer comme version courte propre au sélecteur.

### 17.5 Deux gestes avant que le pré-remplissage fonctionne

Le chemin de pré-remplissage n'est pas exerçable aujourd'hui, et pas à cause du
code :

1. **Aucun diagnostic n'est marqué comme trame** — volontaire, je l'avais
   interdit à Lovable.
2. **Les dix processus de `template-use-case` ont `use_case` à `null`**, ayant
   été importés avant l'existence de la colonne. `processusDeTrame()` les
   indexe par clef : il rendrait une table vide même une fois la trame marquée.

Il faut donc **réinjecter le JSON régénéré** (qui porte les clefs) dans le
diagnostic existant, puis le marquer comme trame « existant ». L'injection
prend un instantané de version avant d'agir.

Jusque-là, le repli documenté s'applique : le use case est créé avec sa clef et
son intitulé, mais vide. Pas d'erreur, pas de blocage.

### 17.6 Toujours pas vérifié

La pastille de friction sur les cartes du diagramme. Elle demande un navigateur.

---

## 18. Les périmètres alignés sur le classeur

`PERIMETRES` portait dix phrases rédigées par Lovable, faute que je les aie
fournies. Elles étaient justes mais décrivaient une seconde fois ce que le
classeur décrit déjà — deux sources de vérité pour la même chose.

### 18.1 Vérifié en dérivant l'attendu depuis la source

Le contrôle ne compare pas le livré à mon brief : il repart du `soustitre` de
chaque processus de la trame — donc du classeur — retire la queue prévue, et
compare. **Zéro écart sur les dix**, longueurs de 77 à 166 caractères.

### 18.2 Trois queues retirées, et ce qu'elles sont devenues

| use case | queue du classeur | traitement |
|---|---|---|
| uc8 | « À croiser avec l'onglet Transverse - Preuves. » | **supprimée** — l'onglet n'existe ni dans l'application ni dans le classeur |
| uc9 | « Use case Advanced : à maturité 1 à 2, vérifier d'abord qu'un process existe. » | déplacée dans `NOTES_METHODE` |
| uc10 | « Use case Advanced : … l'entretien annuel et la négociation salariale. » | déplacée dans `NOTES_METHODE` |

Vérifié : `PERIMETRES.uc8` ne contient plus « Transverse ».

`NOTES_METHODE` est un `Partial<Record<ClefUseCase, string>>` à **deux entrées**
— pas dix dont huit vides. Affichée sous le périmètre, en italique précédée
d'un fanion, dans le sélecteur « + Use case » **et** dans la liste à cocher de
la création. C'est le bon moment : la note dit s'il faut dérouler ou
questionner, et c'est au choix du use case qu'on en a besoin.

Les `soustitre` de la trame n'ont pas été touchés : c'est une transcription du
classeur, elle reste fidèle à sa source, référence pendante d'uc8 comprise. Le
catalogue de l'application, lui, n'a pas à propager une référence morte.

### 18.3 La trame est en service

Constaté en base à cette occasion, l'état a changé depuis le §17 :

- `template-use-case` est marqué `trame = 'existant'` ;
- ses **dix processus portent chacun une clef distincte**, `uc1` à `uc10` ;
- les comptes d'étapes par use case sont ceux de la trame générée — 12, 17, 17,
  15, 23, 12, 14, 11, 10, 10, soit 141.

`processusDeTrame()` rendra donc une table de dix entrées, et choisir un use
case pré-remplira réellement. Le chemin décrit au §17.5 comme non exerçable
l'est désormais.

Reste inchangé : 3 clients, 18 processus, 194 étapes, 16 frictions.

---

## 19. La trame cible importée en base

Importée sur demande explicite d'Alexis, par `importer_client_json(payload, null)`
— le chemin qu'emprunte le bouton « Importer » de l'application, pas des
`INSERT` à la main.

| code | trame | processus | étapes | clefs use case |
|---|---|---|---|---|
| `sekurit-float-france` | — | 4 | 49 | 0 |
| `test-alexis` | — | 4 | 4 | 0 |
| `template-use-case` | `existant` | 10 | 141 | 10 |
| `cible-mercateam` | `cible` | 10 | 109 | 10 |

Le code obtenu est `cible-mercateam`, **sans suffixe** : aucune collision, la
boucle de dédoublonnage de l'importeur n'a pas eu à intervenir.

Répartition vérifiée processus par processus : 10, 13, 13, 12, 15, 9, 9, 9, 9,
10 — soit 109, exactement le contenu généré. Les dix clefs `uc1` … `uc10` sont
posées, et les **codes de processus sont identiques à ceux de l'existant**,
ce qui rendra l'appariement trivial quand la variante arrivera.

`maturite` reste `null` sur les dix : la trame décrit un processus cible, elle
ne prétend pas noter un site.

### Marquée `trame = 'cible'`

Fait dans la foulée, avec `version + 1` et `maj_le` pour rester cohérent avec
la façon dont l'application écrit. Sans ce marquage, une trame apparaîtrait
dans la liste des diagnostics client, ce qu'elle n'est pas.

Cela ne change rien au pré-remplissage : `trameExistante()` ne lit que
`trame = 'existant'`. La valeur `'cible'` n'est encore lue par personne — elle
était prévue pour ne pas remigrer le jour de l'avant/après.

Réversible d'un clic depuis la liste.

---

## 20. Le mode bilan

Recadrage d'Alexis : l'« après » n'est pas une trame partagée, c'est une saisie
propre à chaque client, faite en fin de déploiement, **à partir de l'avant**.
Ce détail crée la correspondance étape à étape que le §19 déclarait absente —
l'après descend d'une copie de l'avant, donc chaque étape connaît son origine.

### 20.1 Vérifié en base

- `processus.variante text not null`, contrainte `processus_variante_valide` :
  `variante = any (array['audit','bilan'])`.
- `processus.origine_id` → `processus(id) on delete cascade` : détruire le
  relevé détruit son bilan, ce qui est le bon sens de la dépendance.
- `etapes.origine_id` → `etapes(id) on delete set null` : une étape d'audit
  supprimée ne détruit pas l'étape de bilan qui en descendait, elle la
  détache. C'est la même règle que pour `frictions.etape_id`.
- **Aucune donnée touchée** : 4 clients, 28 processus, 303 étapes, 16
  frictions. `variante` vaut `'audit'` partout, 0 jumeau, 0 étape avec origine.
  Aucun diagnostic d'essai laissé derrière.

### 20.2 Le format

`client_json` porte `variante` et `origine` sur le processus, `origine` sur
chaque étape — vérifié sur la sortie réelle, `"variante":"audit"` et
`"origine":null` partout. `importer_client_json` traite les deux.

Sans cela l'export/import perdrait le bilan, et le versionnement aussi
puisqu'il passe par `client_json`.

### 20.3 Le piège de l'environnement IT, évité au bon endroit

C'était le risque principal : `calculEnvIT` lit les supports de **tous** les
processus. Sans filtre, les outils du bilan se seraient mélangés à ceux du
relevé, et l'environnement IT aurait affiché Mercateam à côté d'Excel comme
s'ils coexistaient aujourd'hui.

Le filtrage est fait **en un seul point**, et c'est ce qui le rend sûr :

```ts
const tousProcessus = useMemo(() => procQ.data ?? [], [procQ.data]);
const processus = useMemo(() => processusAudit(tousProcessus), [tousProcessus]);
```

`processus` alimente les onglets, les KPI, le sélecteur et l'environnement IT —
aucun de ces appels n'a eu besoin d'être modifié. `parProcessus`, lui, reste
construit sur `tousProcessus` : les données des jumeaux doivent être chargées
pour être éditables, et les clefs supplémentaires sont sans effet puisque
`calculEnvIT` parcourt la liste qu'on lui donne.

La palette est calculée sur `tousProcessus` : un même rôle garde sa teinte des
deux côtés.

### 20.4 Le gel

`fige={!modeBilan && jumeau ? MESSAGE_FIGE : null}` : dès qu'un use case porte
un jumeau, le mode modifier refuse d'écrire dessus et affiche le motif. La
sortie existe — supprimer le jumeau rend le relevé modifiable.

Le jumeau naît avec `maturite: null` plutôt qu'en copiant celle de l'audit :
la maturité atteinte se constate, elle ne se recopie pas.

Un instantané `avant_bilan` précède la création du **premier** jumeau d'un
diagnostic, pas de chacun.

### 20.5 Non vérifié

**Le chemin n'a jamais été exercé** : zéro jumeau en base. Le mode, le gel, la
recopie et la comparaison relevé-contre-bilan demandent un navigateur et un
diagnostic d'essai. Reste à faire côté Alexis, avec la pastille de friction du
§16 qui attend toujours.

Le marquage étape par étape sur les cartes — inchangée, outil changé,
supprimée, nouvelle — n'a volontairement pas été demandé. `etapes.origine_id`
le rend désormais possible.

---

## 21. Le marquage étape par étape

### 21.1 La règle, vérifiée par lecture

`marquerBilan(audit, jumeau)` dans `src/lib/bilan.ts` : fonction pure, deux
cartes de marques indexées par `ordre`.

- étape de bilan sans `origine_id` → `nouvelle`, sur la carte **bilan** ;
- étape d'audit sans descendant → `supprimee`, sur la carte **audit** ;
- couple dont les ensembles de supports diffèrent → `outil`, **sur les deux** ;
- ensembles identiques → `continue` avant toute marque, même si le texte a
  changé. La reformulation ne va qu'en infobulle.

Les deux pièges du cahier des charges tiennent, vérifiés sur le chemin de code :
`listeSupports` découpe sur la virgule puis `normaliser` abaisse la casse,
retire les accents et compacte les espaces — `« Papier , excel »` et
`« Excel, Papier »` produisent le même ensemble, donc aucune marque. Et
plusieurs descendants sont triés par `ordre`, le premier l'emporte, le nombre
part en infobulle : le rendu reste reproductible.

### 21.2 Un piège que Lovable a vu et que je n'avais pas signalé

`PastillesFrictions` repère son conteneur par `hote.previousElementSibling`.
Recopier ce patron tel quel aurait échoué : la pastille de friction s'intercale
désormais entre le diagramme et le nouveau composant, et son enveloppe
`display: contents` reste un élément dans l'arbre. `MarquesBilan` prend donc
`hote.parentElement`, avec le commentaire qui l'explique. C'est exactement le
genre de détail qu'un copier-coller aurait cassé silencieusement.

### 21.3 La collision, et le noir et blanc

Pastille de friction en `top: -7; right: -7`, marque de bilan en
`left: 6; bottom: -9` — coins opposés, plus `margin-bottom: 10px` sur les
cartes marquées pour que l'étiquette ne morde pas la rangée suivante.

Aucune marque ne repose sur la couleur : texte barré pour `supprimée`, contour
appuyé (`inset box-shadow`) pour `nouvelle`, étiquette écrite dans les trois
cas. Les classes sont posées depuis `styles.css`, pas dans le moteur, et
retirées au démontage. `moteur.js` et `moteur.css` ne figurent pas au diff.

Le marquage s'affiche en lecture (marques d'audit), en mode bilan (marques du
jumeau), et à l'impression — jamais en mode modifier :
`modeBilan ? marquage.bilan : edition ? null : marquage.audit`.

### 21.4 Ce que la base raconte de la passe navigateur

Alexis a exercé le mode bilan pour de vrai. Les instantanés le datent :

| diagnostic | motif | auteur | heure |
|---|---|---|---|
| `sekurit-float-france` | `avant_bilan` | alexis@merca.team | 00:11:48 |
| `test-alexis` | `avant_suppression_client` | alexis@merca.team | 00:22:11 |
| `test-06-08` | `avant_bilan` | alexis@merca.team | 00:28:17 |

**`auteur` est enfin renseigné.** La colonne existait depuis le §12 et n'avait
jamais été alimentée — réserve levée : elle se remplit dès qu'un utilisateur
agit depuis l'application authentifiée.

**`test-alexis` a été supprimé par Alexis, pas par Lovable.** Le compte de
clients est resté à 4, ce qu'une recette qui ne vérifie qu'un nombre aurait
validé sans voir le remplacement. L'instantané `avant_suppression_client`
existe : le diagnostic est récupérable.

**Un bilan subsiste sur `sekurit-float-france`**, sur le use case Onboarding.
Créé par Alexis à 00:11. Conséquence à connaître : ce use case est désormais
**figé en mode modifier** tant que le jumeau existe. À supprimer si l'essai
était exploratoire — le bouton est là.

### 21.5 Non vérifié, et pourquoi

**Aucune marque n'a jamais été rendue.** Les deux jumeaux en base sont des
copies conformes : `onboarding-bilan` (8 étapes, 8 origines, 0 support changé,
0 texte changé) et `uc10-bilan` (10 étapes, 10 origines, 0 changement). Le
marquage n'a donc rien eu à afficher — ce qui valide le point 1 de la recette
(0, 0, 0 juste après démarrage) et laisse les points 2 à 7 non observés.

Pour les exercer : sur `test-06-08`, en mode bilan, supprimer deux étapes, en
ajouter une, changer les supports de trois autres, et regarder.

---

## 22. Le mode bilan, refondu — et `moteur.js` reformaté

### 22.1 Le modèle correspond enfin à la demande

Le jumeau est retiré. À sa place, trois colonnes sur les lignes existantes :
`etapes.bilan` (`mercateam` / `inchangee` / `supprimee`, `null` = non évalué),
`processus.maturite_bilan` et `maturite_bilan_note`. Contraintes vérifiées en
base, conformes.

**Les deux modes écrivent des champs disjoints**, donc le gel disparaît :
`updateEtape(v.id, { bilan: v.etat })` est la seule écriture du mode bilan.

Migration mesurée : processus 32 → 30, étapes 411 → 393. `variante`,
`processus.origine_id` et `etapes.origine_id` sont supprimées, et l'importeur
n'en porte plus trace. `client_json` rend `bilan` sur l'étape, `maturite_bilan`
et `maturite_bilan_note` sur le processus. Zéro ligne renseignée
automatiquement.

**Ma prévision de recette était fausse sur un point** : j'annonçais les
frictions inchangées, elles passent de 19 à 16. Les jumeaux portaient trois
frictions recopiées, parties avec eux. Sekurit retrouve ses 16 d'origine — le
comportement est juste, c'est mon attente qui ne l'était pas.

### 22.2 Une réalisation meilleure que ce que j'avais demandé

J'avais demandé une variante de `calculEnvIT`. Lovable a fait mieux :
`etapesApresBilan()` transforme les étapes — exclut les `supprimee`, ramène les
`mercateam` au seul support `« Mercateam »` — puis passe le résultat au
`calculEnvIT` **inchangé**. La logique de classement reste à une seule source,
et l'environnement IT « après » n'est qu'un second appel du même calcul.
`environnement-it.ts` ne reçoit aucun ajout fonctionnel.

### 22.3 `src/flux/moteur.js` a été reformaté

C'est la seule interdiction absolue du projet, et elle est franchie. **378
lignes** touchées : guillemets simples passés en doubles, retours à la ligne,
virgules finales. Un passage de Prettier sur tout le dépôt — 44 fichiers au
total, dont `eslint.config.js` et `.prettierignore`.

**Le changement est prouvé sans effet sur le comportement.** En concaténant
toutes les lignes retirées d'un côté, ajoutées de l'autre, puis en normalisant
espaces, style de guillemets et virgules finales, la divergence se réduit à :

| fichier | divergence |
|---|---|
| `moteur.js` | **4 guillemets** — Prettier a déquoté les clefs `'auto'` et `'manuel'` |
| `mutations.js` | **une paire de parenthèses** redondantes |

`{auto: x}` et `{'auto': x}` sont le même objet en JavaScript. Tout le reste est
identique caractère pour caractère. `moteur.css` n'a pas été touché.

**Ce qui est perdu n'est pas le comportement, c'est la provenance.** Le portage
n'est plus comparable octet à octet à l'original de `diagnostic-os.html` : un
futur diff contre la source sera noyé sous 378 lignes de bruit de mise en
forme, et la garantie « vérifié au pixel » n'est plus attestable par
comparaison.

`.prettierignore` gagne `src/flux` **dans le même commit** : le garde-fou a été
posé, mais après le passage du formateur.

**À faire** : restaurer `src/flux/moteur.js` et `src/flux/mutations.js` dans
leur état d'avant ce commit. `src/flux` étant désormais ignoré par Prettier, la
restauration tient.

---

## 23. Restauration de `moteur.js` — vérifiée contre la copie de référence

Correctif reçu le 07/08. **Quatre fichiers touchés, aucun autre** :
`src/flux/moteur.js`, `src/flux/mutations.js`, `src/routeTree.gen.ts`,
`src/integrations/supabase/types.ts`. `moteur.css` n'apparaît ni dans ce diff
ni dans le précédent.

### 23.1 La méthode : ne pas relire, comparer

Constater que les guillemets sont redevenus simples ne prouve rien — Prettier
inversé n'est pas l'original. La copie de référence du dépôt,
`flux/moteur.js` (commit `2222b3f`, 583 lignes, antérieure à tout passage de
formateur), sert donc d'étalon.

Pour chacun des **23 hunks** du diff, le côté « après » (lignes `context` +
`add`) est extrait et confronté à la copie locale **au décalage de ligne
annoncé** — pas cherché ailleurs dans le fichier.

| fichier | hunks | identiques à la référence |
|---|---|---|
| `moteur.js` | 23 | **23** |
| `mutations.js` | 11 | 8 + 3 hors périmètre (voir 23.2) |

23 hunks qui retombent tous sur la bonne ligne, du n° 30 au n° 574 d'un fichier
qui en compte 583, c'est aussi la preuve que la numérotation est redevenue
celle de l'original : le côté Prettier, lui, courait jusqu'à la ligne 704.

Contrôle de sens inverse : 663 guillemets doubles retirés, 217 rendus. Les 217
sont ceux que l'original portait déjà — attributs HTML dans les gabarits
(`class="…"`). Les clefs `'auto'` et `'manuel'` de `LIENS`, seule divergence
sémantique relevée en §22.3, sont de nouveau quotées.

### 23.2 Les trois hunks « divergents » de `mutations.js` ne le sont pas

Ils portent sur les lignes 213 à 273, au-delà des 209 lignes de la copie locale.
`mutations.js` est du code projet, modifiable, et il a grandi depuis le 30/07 —
la référence est simplement plus vieille que le fichier. Leur contenu est lu
ligne à ligne : `"@creation"` → `'@creation'`, `role: et.role || ""` →
`|| ''`, et rien d'autre. Restauration de guillemets, aucun ajout.

### 23.3 Deux effets de bord, tous deux favorables

**`routeTree.gen.ts` retrouve son bloc `declare module '@tanstack/react-start'`**
— dix lignes réapparaissent. C'était le point resté en surveillance depuis la
passe précédente : il est clos, et il s'explique. Le fichier est listé dans
`.prettierignore` ; le passage de Prettier l'avait quand même amputé, la
restauration le rétablit.

**`types.ts` revient au style du générateur Supabase** (pas de point-virgule,
union `Json` sur plusieurs lignes). C'est un fichier généré : son style est
celui de son générateur, pas celui du dépôt.

### 23.4 Les deux garde-fous tiennent

`.prettierignore` porte toujours `src/flux` (et `routeTree.gen.ts`).
`eslint.config.js` ignore `src/flux` **globalement**, avant toute règle ;
`eslint-plugin-prettier/recommended` est bien chargé à la racine, mais ne peut
pas atteindre un chemin ignoré. Deux garde-fous indépendants, pas un.

**Reste exposé** : `src/integrations/supabase/types.ts` n'est ignoré nulle
part. Un prochain passage de formateur le reformatera de nouveau. Le fichier
est régénéré à chaque migration, l'enjeu est le bruit de diff, pas le
comportement.

### 23.5 La base n'a pas bougé — et le marquage a écrit pour de bon

4 clients, 30 processus, 393 étapes, 16 frictions : identique à la §22.

Un chiffre est nouveau : **une étape porte un `bilan`**. Sekurit Float France,
UC 1, étape 6 (« Ajuste le plan de roulement selon les contraintes des
opérateurs »), état `mercateam`. C'est la première écriture du marquage
étape par étape à atteindre la base — la greffe par portail sur les cartes du
diagramme fonctionne de bout en bout, et elle y survit après restauration du
moteur.

`maturite_bilan` reste à 0 ligne renseignée, `use_case` à 26 sur 30.

---

## 24. Classement multi-blocs et bloc par use case

Trois fichiers touchés, aucun autre : `src/lib/environnement-it.ts`,
`src/components/diagnostic/EnvironnementIT.tsx`, et `package.json`
(`@lovable.dev/vite-tanstack-config` 2.9.0 → 2.9.1, bump de plateforme non
demandé, sans rapport avec le correctif). `git diff --stat src/flux/` vide.

### 24.1 Les chiffres, vérifiés par deux implémentations indépendantes

J'avais calculé les attendus **avant** d'envoyer le brief, en rejouant les
tables de classement en Python sur les données réelles (`mesures/recette.py`).
Lovable a mesuré autrement : en important le module TypeScript réel et sa
version d'avant (`git show a6f0c29`), et en les faisant tourner sur un export
de la base. Les deux séries coïncident case par case.

| diagnostic | état | outils | placements | « Non classé » | activités | renseignées | outils au schéma¹ |
|---|---|---|---|---|---|---|---|
| template-use-case | avant | 14 | 14 | 3 | 40 | 8 | 14 |
| template-use-case | **après** | 14 | **35** | **2** | 43 | **11** | 14 |
| sekurit-float-france | avant | 9 | 9 | 1 | 38 | 7 | 9 |
| sekurit-float-france | **après** | 9 | **12** | 1 | 39 | **8** | 9 |
| cible-mercateam | avant | 9 | 9 | 1 | 36 | 8 | 9 |
| cible-mercateam | **après** | 9 | 9 | 1 | 36 | 8 | 9 |

¹ Cette colonne compte la **liste d'outils candidats** passée au schéma, et non
les boîtes réellement dessinées — je l'avais mal nommée, voir §26. Les deux
diffèrent : `sekurit-float-france` a 9 candidats mais 8 boîtes, Padoa n'entrant
dans aucun échange et n'apparaissant qu'en pastille « Sans échange relevé ».

Deux implémentations écrites séparément qui tombent sur les mêmes 42 nombres,
c'est ce qui distingue une recette d'une déclaration. Les trois garde-fous
tiennent : **le nombre d'outils ne bouge pas** (on ne crée pas d'outil, on le
place plusieurs fois), **la liste d'outils du schéma ne bouge pas**, et
**`cible-mercateam` est identique en tout point** — les cinq modules Mercateam
étant classés par la table A, ils ne dépendent pas du processus.

Les non classés se comportent comme voulu : PowerPoint en sort (générique, il
suit désormais le bloc de son use case), `Au jugé`, `Logiciel` et
`TV / écran atelier` y restent. Un correctif qui nettoie trop est aussi faux
qu'un correctif qui ne nettoie pas.

Répétitions sur `template-use-case` : Excel 6 blocs, Mail 5, Oral 5, Papier 5,
Word 4, PowerPoint 2. **6 outils estompés sur 14** — le marquage distingue,
il ne délave pas la page.

### 24.2 Ce que la réalisation fait mieux que ma demande

J'avais décrit la différence d'ensembles de `siAvecVue` sans en tirer la
conséquence sur l'ordre. Lovable l'a vue : les masquages sont écrits **avant**
les ajouts, sans quoi un déplacement d'outil à l'intérieur d'un même bloc
(renommer la ligne qui le porte) produirait deux écritures sur la même clef
`outil|bloc` et le masquage effacerait l'ajout. Le commentaire du code le dit
explicitement. C'est le seul cas où les deux moitiés de la différence
retombent sur la même clef, et il est traité.

La migration au format neuf se fait **à la première écriture** : `siAvecVue`
reconstruit `corrections` intégralement, les clefs de l'ancien format
disparaissent d'elles-mêmes. Rien à migrer, rien à programmer.

### 24.3 Deux réserves, aucune bloquante

~~**Le marquage des répétitions compare avec `toLowerCase()`**, pas avec le
`normaliser()` du module (qui retire aussi les accents).~~ **Corrigé le 07/08,
voir §25.**

**Un outil ne peut toujours pas figurer deux fois dans le même bloc.** La clef
de correction est `outil|bloc` et non `outil|bloc|activité` : ajouter Excel à
une seconde ligne de « Compétences » le retirerait de la première au rendu
suivant. Ce n'est **pas une régression** — avant, la clef était le seul nom
d'outil et la limite était plus stricte encore (une seule ligne dans tout le
schéma). Le champ « + outil » permet de l'atteindre en mode édition.

### 24.4 Base inchangée

4 clients, 30 processus, 393 étapes, 16 frictions, 1 étape marquée. **Aucun
diagnostic ne porte de corrections d'environnement IT** (0 sur 4) : le
changement de format des clefs ne s'est appliqué à rien. C'était le bon moment
pour le faire.

---

## 25. `toLowerCase` → `normaliser` dans le marquage des répétitions

Correctif de cohérence demandé le 07/08, reçu en `416a45f`. **Quatre lignes,
deux fichiers, rien d'autre.**

| fichier | changement |
|---|---|
| `src/lib/environnement-it.ts` | `function normaliser` → `export function normaliser` |
| `src/components/diagnostic/EnvironnementIT.tsx` | import de `normaliser` ; `repetes.get(o.toLowerCase())` → `repetes.get(normaliser(o))` ; `const clef = o.toLowerCase()` → `const clef = normaliser(o)` |

Ni `package.json`, ni `src/flux/`, ni aucune table de classement. Diff relu
ligne à ligne, pas seulement le compte-rendu de l'agent.

**Le défaut.** Le marquage des outils répétés indexait par `toLowerCase()`,
qui met en minuscules sans retirer les accents, alors que tout le reste du
module compare par `normaliser()`. `Réseau` et `Reseau` étaient donc fusionnés
partout ailleurs et comptés comme deux outils par le seul marquage — aucun des
deux n'aurait été estompé. La cause n'était pas une inattention : `normaliser`
n'était pas exporté, le composant n'y avait pas accès.

**Le piège du correctif.** Les deux occurrences devaient changer ensemble.
N'en corriger qu'une désaligne la clef d'écriture et la clef de lecture de la
`Map`, et **plus aucun outil n'est estompé** — panne silencieuse, sans erreur
de compilation, invisible autrement qu'en regardant la page. Le brief l'a dit
explicitement ; le diff montre les deux.

**Hors périmètre, volontairement.** Le `useMemo` `outils`, juste au-dessus,
dédoublonne par `!vus.includes(o)` en comparaison exacte. La même substitution
y serait tentante — mais ~~c'est lui qui fixe le nombre de boîtes du schéma
d'échanges~~ **(faux, voir §26 : les boîtes viennent des échanges)**, l'un des
trois garde-fous du §24. Je l'ai mis hors périmètre pour qu'il ne voyage pas en
passager clandestin d'un correctif de trois lignes. À traiter séparément, avec
sa propre recette.

**Contrôle de non-changement.** Cette correction est préventive : aucun outil
des trois diagnostics ne porte aujourd'hui de graphie accentuée en double, donc
le résultat attendu était l'identité. `template-use-case` : 14 outils, 35
placements, **6 outils estompés** (Excel 6 blocs, Mail 5, Oral 5, Papier 5,
Word 4, PowerPoint 2), légende affichée. Identique au §24. `tsgo --noEmit` :
0 erreur. J'avais demandé à Lovable de ne rien corriger et de me signaler tout
écart — un chiffre différent aurait voulu dire que la substitution touchait
autre chose que ce qu'on croyait.

---

## 26. `outils` dédoublonné par `normaliser` — et une erreur de lecture de ma part

Correctif reçu en `8f58282`. **Un seul `useMemo`, un seul fichier**
(`src/components/diagnostic/EnvironnementIT.tsx`) : le dédoublonnage par
`!vus.includes(o)` devient un `Set` de clefs `normaliser(o)`, la **première
graphie rencontrée** étant conservée puisque c'est elle qui s'affiche. Tri par
`localeCompare` inchangé. `git diff` vide sur `src/flux/`, `package.json`,
`schema-outils.ts` et `SchemaEchanges.tsx`. `tsgo --noEmit` : 0 erreur.

### 26.1 Ce que j'avais écrit et qui était faux

Aux §24 et §25 j'ai justifié la mise hors périmètre de ce `useMemo` en écrivant
qu'il **fixait le nombre de boîtes du schéma d'échanges**. C'est faux, et la
lecture de `src/lib/schema-outils.ts` le montre sans ambiguïté :

```
ordre  ←  relies = [...poids.keys()]  ←  poids  ←  aretes  ←  echanges
```

Les boîtes dessinées viennent des **extrémités des échanges**. `outils` ne sert
qu'à deux choses : calculer `isoles = outils.filter(o => !poids.has(o))`, les
pastilles « Sans échange relevé », et décider si la section s'affiche
(`outils.length ?`). Un outil qui n'échange avec rien n'est jamais un nœud.

La preuve est dans les données, pas dans le raisonnement :
**`sekurit-float-france` a 9 outils candidats et 8 boîtes** — Padoa n'entre
dans aucun échange. J'avais donc aussi mal nommé une colonne du tableau du §24,
corrigée en « outils au schéma ».

Ma prudence portait sur le mauvais risque. Le correctif était plus anodin que
je ne l'ai annoncé.

### 26.2 Contrôle de non-changement

Préventif là encore — aucun outil ne porte deux graphies aujourd'hui.

| diagnostic | outils avant | outils après | boîtes | sans échange relevé |
|---|---|---|---|---|
| template-use-case | 14 | 14 | 14 | 0 |
| sekurit-float-france | 9 | 9 | 8 | 1 — Padoa |
| cible-mercateam | 9 | 9 | 9 | 0 |

### 26.3 L'incohérence qui reste, et pourquoi je n'y touche pas

Toute la couche schéma compare les noms d'outils **caractère à caractère** :
`isoles` teste `!poids.has(o)`, `positions` et `data-outil` sont clefés sur le
nom exact, `clefPaire` trie des noms bruts. La couche environnement, elle,
compare par `normaliser`. Les deux ne se rejoignent nulle part.

Corrigé naïvement — indexer sur `normaliser(nom)` — cela casserait quatre
choses, dont deux avec perte silencieuse :

- **Les `positions` enregistrées** deviennent introuvables : toute boîte
  déplacée à la main repart au placement automatique, sur tous les diagnostics
  existants.
- **Les `echanges` enregistrés** fusionnent quand deux graphies coexistent :
  les fréquences s'additionnent et la nature comme le libellé se résolvent au
  premier rencontré — perte silencieuse.
- **Le déterminisme du rendu** : la fusion change `ordre`, donc le placement,
  donc l'image produite en PDF et en PPTX. Or `schema-outils.ts` s'ouvre sur un
  engagement explicite de reproductibilité.
- **L'export/import JSON**, où les noms circulent tels quels.

Le chemin le moins risqué : **clef normalisée en interne, libellé d'affichage
conservé**, avec repli de lecture sur l'ancienne clef et réécriture
opportuniste à la première sauvegarde. Aucune migration destructive. Non
engagé — c'est une passe à part entière, avec sa propre recette sur les
positions et le déterminisme du rendu.

---

## 27. Unicité de la trame, et `db/schema.sql` régénéré

### 27.1 Trame unique — `bf90edc`

Index unique partiel `clients_trame_unique on clients (trame) where trame is
not null` : au plus une trame `existant` **et** une trame `cible`, l'unicité
portant sur la valeur. Le défaut était symétrique — `trameExistante()` et
`chargerTrameCible()` lisent toutes deux
`.eq("trame", …).order("maj_le" desc).limit(1)`, donc deux diagnostics marqués
auraient fait basculer la source de pré-remplissage **en silence**, selon qui a
édité en dernier.

`marquerTrame` intercepte la violation `23505` et va lire en base le nom du
détenteur pour rédiger : « "Template use case" est déjà la trame "existant".
Sortez-la des trames avant d'en désigner une autre. » **La contrainte reste
l'autorité** : pas de contrôle préalable, qui laisserait passer deux marquages
simultanés. Données avant et après : `existant 1`, `cible 1`.

Deux pistes explicitement écartées, et non préparées : la propagation d'une
correction de trame vers les diagnostics déjà créés, et la création des
processus cible à la sélection des use cases.

### 27.2 Ce que la vague 2 n'avait pas besoin d'être

En allant lire le code plutôt que la feuille de route, il apparaît que
**l'essentiel de la « vague 2 » est déjà construit** : `clients.trame`,
`trameExistante()`, `processusDeTrame()`, `creerUseCases()` → `recopier()`, le
sélecteur des dix use cases à la création, la trame repliée hors de la liste et
protégée de la suppression. Le rattachement passe uniquement par
`processus.use_case`, jamais par le nom. Le bilan ne se recopie jamais.

La feuille de route décrivait donc comme « à faire » une fonctionnalité en
production. Elle est en retard sur l'application, pas l'inverse.

### 27.3 `db/schema.sql` régénéré depuis la base réelle

Le fichier décrivait la base du 31/07. Manquaient : la table **`versions`**,
huit colonnes (`clients.trame`, `etapes.bilan`, `frictions.etape_id`,
`processus.use_case`, `maturite`, `maturite_note`, `maturite_bilan`,
`maturite_bilan_note`), sept contraintes, l'index unique de trame, cinq
fonctions (`est_mercateam`, `importer_client_json`, `prendre_version`,
`restaurer_version`, `versions_liste`), le `set search_path` de toutes les
fonctions, et **le format de `client_json`, entièrement différent**.

Le plus grave n'était pas une omission mais une affirmation fausse : le fichier
et le README annonçaient un accès ouvert à **tout utilisateur authentifié**,
alors que les politiques filtrent désormais sur `est_mercateam()` — le domaine
`@merca.team` lu dans le JWT. Un document de sécurité périmé est pire qu'absent.

Deux constats méritent d'être gardés, découverts en relisant la base :

- **`versions` n'a aucune clé étrangère vers `clients`**, volontairement : avec
  une clé en cascade, l'instantané « avant suppression » partirait avec ce
  qu'il est censé sauver.
- **La clé de `frictions.etape_id` est composite** `(etape_id, processus_id)` :
  elle garantit que l'étape désignée appartient au même processus, ce qu'une
  clé simple ne saurait pas dire. Le `on delete set null` ne porte que sur
  `etape_id` : supprimer l'étape détache la friction sans l'emporter.

`db/README.md` porte maintenant les requêtes de comparaison. **Tant que ce
contrôle est manuel, il ne sera pas fait** — l'automatiser est en feuille de
route.

### 27.4 Trois `normaliser`, pas deux

Relevé sans modification : `environnement-it.ts` (NFD + minuscules),
`trame-cible.ts` (idem + espaces compactés + trim), et une troisième copie
privée dans `roles.ts`. Sur « Power␣␣BI » les deux premières divergent.

La plus robuste est celle de `trame-cible.ts` — compacter et trimmer est un
sur-ensemble sans perte. Mais unifier ne se réduit pas à remplacer une
fonction : `environnement-it.ts` sert de **clef de placement** (`outil|bloc`)
et `schema-outils.ts` clefe sur le nom exact. Changer la normalisation change
des clefs enregistrées. Cela relève de la refonte clef/libellé du §26.3.

---

## 28. L'« après » n'efface plus les systèmes de référence — `b09ccf0`

### 28.1 Le défaut, et la preuve de la règle

`etapesApresBilan` remplaçait les supports d'une étape marquée `mercateam` par
la seule chaîne `"Mercateam"`. Tout tombait, **y compris l'ERP, le SIRH et la
GTA**, qui restent en production après un déploiement. Le commentaire du code
l'assumait — « le prix assumé du contrôle à trois positions » — mais le
résultat est un schéma montré en restitution à un industriel, où son ERP a
disparu. `trames/README.md` s'y oppose mot pour mot : « Les faire disparaître
du schéma donnerait un avant/après flatteur et faux — et un client industriel
le verrait. » Deux documents du même projet se contredisaient, et c'était le
livrable client qui tranchait.

La règle n'a pas été devinée, elle a été **lue dans la trame cible**, écrite à
la main depuis les User Journeys :

| | existant (141 étapes) | cible (109 étapes) |
|---|---|---|
| générique | Excel 49, Papier 35, Oral 24, Au jugé 16, Mail 9, Word 7, PowerPoint 5 | **aucun** |
| système de référence | ERP 2, SIRH/GTA 2, GTA-paie 1 | **ERP 4, SIRH/GTA 2, GTA-paie 1** |

*Le générique disparaît, le système de référence demeure.* Le correctif
s'appuie donc sur une distinction qui existait déjà et qui est éprouvée —
`TABLE_A` — plutôt que sur une nouvelle liste à maintenir : `estSpecifique` est
exporté à côté de `estGenerique`.

### 28.2 Mesure prédite avant l'envoi

Les données réelles ne pouvaient rien montrer : **une seule étape marquée dans
toute la base** (Sekurit, UC 1, ordre 6), et elle porte `Excel` — générique,
donc supprimée avant comme après. J'ai donc demandé une simulation sur les 141
étapes de la trame, toutes forcées `mercateam`, en annonçant le résultat
attendu avant de l'envoyer, avec consigne de ne rien corriger en cas d'écart.

**7 outils obtenus, exactement les 7 annoncés** — `Mercateam`,
`Logiciel (ERP)`, `Logiciel (ERP / MES)`, `Logiciel (SIRH / GTA)`,
`Logiciel (GTA / paie)`, `Logiciel (GED)`, `Réseau` — contre 1 seul avec
l'ancien code. « Au jugé » disparaît, ce qui est tout l'objet du déploiement.

Le consommateur n'est pas `ApresDeploiement.tsx` (qui lit la trame cible) mais
le `useMemo` `apresBilan` de `clients.$code.tsx` et son jumeau dans
`impression.$code.tsx`. Effet de bord attendu et souhaitable : une étape
marquée porte désormais deux supports, ce qui crée un échange
`Mercateam ↔ Logiciel (ERP)` là où il n'y en avait aucun — c'est exactement le
« Mercateam s'y branche » du README.

### 28.3 La limite, assumée et non masquée

La règle automatique se trompe encore dans les deux sens : `Réseau` et
`Logiciel (GED)` survivent alors que la cible les supprime ; `TV / écran
atelier` serait supprimé alors que la cible le garde. **La survie d'un outil
est un jugement, pas une propriété de sa catégorie.**

L'erreur résiduelle penche du bon côté : elle montre *plus* d'outils hérités
que la réalité, donc elle sous-vend le déploiement au lieu de le survendre.
Pour un audit, c'est la direction sûre.

Une remarque de la réalisation mérite d'être gardée : un cochage étape par
étape **ne couvrirait que la moitié du problème**. `TV / écran atelier` est un
outil que la cible *ajoute* — aucune case à cocher sur les supports existants
ne peut le faire apparaître. L'arbitrage se joue donc au niveau du use case,
où il tient en quelques décisions, et non de l'étape, où il en faudrait des
dizaines. Reporté en feuille de route §1c.

### 28.4 Une modification non demandée

Le diff touche `src/routeTree.gen.ts`, hors périmètre : dix lignes retirées,
dont le bloc `declare module '@tanstack/react-start'` qui enregistre le typage
du routeur et `ssr: true`. Fichier généré, donc churn probable de l'outil de
génération plutôt qu'intention — mais `tsgo` passe aussi bien avec qu'sans, ce
qui est cohérent avec un typage affaibli et non avec une équivalence. À
restaurer, ou à confirmer comme régénération légitime.

---

## 29. OAuth Google — la cause trouvée, le correctif suspendu

### 29.1 `routeTree.gen.ts` : rien à restaurer

Le bloc `declare module '@tanstack/react-start'` **était déjà revenu** dans
l'arbre de travail, réémis spontanément par le générateur du plugin TanStack.
Ce n'est donc pas un changement de format de l'outil : le commit `b09ccf0` a
figé le fichier dans un état **partiel**, entre l'écriture de l'arbre et celle
de l'augmentation de module.

Ma lecture du symptôme était bonne sur le fond : le bloc n'est pas devenu
inutile. Sans lui, `Register` n'est pas peuplée, `Link to`, `navigate`,
`useParams` et `search` retombent sur des types larges — `tsgo` reste vert
**par affaiblissement, pas par équivalence**. À surveiller : ça peut se
reproduire à l'identique au prochain commit pris au mauvais moment.

### 29.2 La cause : `window.self !== window.top`

Lecture du paquet `@lovable.dev/cloud-auth-js` (v1.1.2). Il n'exporte que
`createLovableAuth` — **aucun `handleRedirectCallback`, aucun écouteur au
chargement du module**. Le seul écouteur `message` est créé *dans* l'appel à
`signInWithOAuth` et détruit dans son `finally`.

Le SDK choisit son parcours sur un seul test :

| contexte | parcours | résultat |
|---|---|---|
| aperçu de l'éditeur (**iframe**) | fenêtre surgissante, `response_mode=web_message` | jetons rendus, `setSession` fait le travail — **ça marche** |
| `mercaudit.lovable.app` (onglet normal) | `window.location.href = /~oauth/initiate…`, `redirected: true` | **la jambe de retour n'est traitée par personne** |

C'est pourquoi la connexion peut sembler fonctionner dans l'éditeur et échouer
en usage réel. Écartés au passage : le fournisseur Google **est** activé
(`"google": true`, `"email": false`), les deux origines **sont** dans la liste
d'autorisation, et `hd`/`prompt` sont bien transmis au courtier. Aucun n'est la
cause. À noter : sur un `localhost` de développement, le chemin `/~oauth/*`
n'existe pas — la connexion Google y est structurellement impossible.

### 29.3 Pourquoi je n'ai pas pris le correctif proposé

La réalisation propose une route publique de rappel qui lit le fragment et
appelle `setSession`. **Le raisonnement ne tient pas, et c'est la déduction
utile de cette passe :**

`detectSessionInUrl` de supabase-js est actif par défaut et sait déjà lire
`#access_token=…&refresh_token=…`. Si le courtier renvoyait ce fragment, la
connexion **fonctionnerait déjà** sur le site publié, sans aucune route de
rappel. Elle ne fonctionne pas. Donc le retour ne porte pas ce format — et une
route de rappel qui lit `#access_token` ne lirait rien.

Le correctif proposé est juste **si et seulement si** le fragment est au format
attendu, ce qui est exactement l'inconnue. J'ai donc demandé de
**l'instrumentation, pas un correctif** : journaliser au montage les *noms* des
paramètres reçus en `search` et en `hash`, avec leurs longueurs, jamais leurs
valeurs — un jeton dans une console est un jeton dans une capture d'écran. Et
une trace explicite si l'URL d'arrivée ne porte **aucun** paramètre, cas au
moins aussi instructif.

### 29.4 Ce que je ne peux pas faire d'ici

Le réseau de cet environnement refuse le domaine `lovable.app` (403 sur le
tunnel `CONNECT`), pour l'aperçu comme pour le site publié. Je ne peux ni
cliquer, ni lire une console, ni observer l'URL de retour. **Le diagnostic
final tient à une observation d'une seconde que seul un humain devant un
navigateur peut faire** : ce que montre la barre d'adresse au retour de Google.

Ce qui reste vrai quoi qu'il arrive : `est_mercateam()` verrouille la base. Un
compte extérieur qui obtiendrait une session ne peut lire ni écrire une ligne.
