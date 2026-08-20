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

---

## 30. OAuth Google — la cause réelle, trouvée par une copie d'écran

### 30.1 Ma déduction était juste sur la prémisse, fausse sur la conclusion

Au §29.3 j'écrivais : `detectSessionInUrl` sait lire `#access_token=…`, donc si
le courtier renvoyait ce fragment la connexion fonctionnerait déjà ; elle ne
fonctionne pas, **donc** le courtier ne renvoie pas ce format.

La prémisse était bonne, la conclusion trop courte. Il manquait un troisième
terme : **le fragment peut être renvoyé et détruit avant lecture.**

Une copie d'écran l'a montré en une seconde, là où deux passes de lecture de
code ne l'avaient pas vu : URL `mercaudit.lovable.app/clients`, aucun fragment,
aucun paramètre, **aucun message d'erreur**, et la carte de connexion affichée.

### 30.2 Le mécanisme

`redirect_uri` vaut `window.location.origin` : le retour atterrit sur `/`. Or
`src/routes/index.tsx` portait

```ts
beforeLoad: () => { throw redirect({ to: "/clients", replace: true }); }
```

`beforeLoad` s'exécute pendant le chargement du routeur — avant tout rendu,
avant l'effet de montage de `FournisseurAuth`, et donc **avant que le `Proxy`
paresseux de `client.ts` n'ait créé le client Supabase**. Et `redirect({ to })`
reconstruit la localisation à partir de `to` seul : ni requête ni fragment ne
sont reportés.

Les jetons arrivent, la redirection les jette, `detectSessionInUrl` s'exécute
sur une URL déjà nettoyée. **Rien n'échoue** — d'où l'absence de message. Une
information est simplement perdue en route.

Cela explique aussi pourquoi la connexion marche dans l'éditeur : en iframe, le
SDK passe par une fenêtre surgissante, les jetons reviennent par `postMessage`
et ne transitent jamais par l'URL. Aucune redirection ne peut les perdre.

### 30.3 Ceinture et bretelles

**Le report** (`d3b60d9`) — `beforeLoad` reporte `search` et `hash` sur la
cible au lieu de les perdre, sous garde `typeof window`. Correct quel que soit
le format renvoyé : perdre le fragment est un défaut en soi.

**Le forçage** (`aa71a16`) — `void supabase.auth` au chargement de
`src/router.tsx`, dans le navigateur seulement. Sans lui, le report reste un
**pari sur un ordre d'exécution que rien ne contractualise** : `detectSession-
InUrl` ne s'exécute qu'une fois, à la construction du `GoTrueClient`, et lit
`window.location` à cet instant précis. Le forçage le fait naître avant la
première navigation. Aucune requête réseau ajoutée : la construction est
synchrone et locale, seul un rafraîchissement de jeton peut suivre, qui aurait
eu lieu quelques millisecondes plus tard de toute façon.

`router.tsx` plutôt que `start.ts` : ce dernier ne définit que des middlewares,
tandis que `router.tsx` est importé par l'entrée navigateur juste avant
`createRouter()`. Ailleurs, l'ordre serait à la discrétion de l'empaqueteur.

### 30.4 Ce qui reste incertain

**Le format du retour n'est toujours pas observé.** Si le courtier renvoie
`?code=…` plutôt qu'un fragment, ni le report ni le forçage ne suffiront : le
SDK n'expose **que** `signInWithOAuth`, aucune méthode d'échange, et
`exchangeCodeForSession` échouerait faute de `code_verifier` posé par
supabase-js — ce n'est pas lui qui a initié le parcours. C'est la trace
`[auth] url d'arrivée (avant redirection)` qui tranchera.

**Risque mineur non levé** : `void supabase.auth` est une lecture de propriété
au niveau module. Rollup la conserve (une propriété peut porter un accesseur),
mais c'est le genre d'expression qu'un réglage d'élagage agressif pourrait
retirer — silencieusement, et **en production seulement**. Si le correctif
échoue alors que la trace montre un fragment bien présent, c'est la première
chose à regarder.

### 30.5 Ce que cette passe apprend sur la méthode

Deux passes de lecture de code ont produit un diagnostic cohérent, argumenté —
et faux. **Une copie d'écran l'a corrigé en une seconde.** Le raisonnement à
partir du code seul avait bien identifié la couche (la jambe de retour), mais
attribuait la perte au courtier au lieu de la chercher dans notre routeur.
Un accès navigateur aurait fait gagner deux allers-retours ; il reste le
premier poste de la feuille de route.

### 30.6 Confirmé en production

Connexion Google vérifiée par l'utilisateur sur `mercaudit.lovable.app` après
publication du commit `aa71a169`. **Le correctif suffit.**

Cela tranche l'inconnue laissée ouverte au §30.4 : **le courtier renvoie bien
un fragment `#access_token=…`**, et non un `?code=` PKCE. `detectSessionInUrl`
faisait donc déjà tout le travail — il suffisait de cesser de lui retirer l'URL
sous les pieds. Aucune route de rappel n'a été nécessaire, ce qui valide le
choix de ne pas en écrire une avant de savoir.

Le second risque du §30.4 tombe aussi : `void supabase.auth` **a survécu à la
minification** de la construction de production, puisque le parcours aboutit.

Reste un point d'hygiène, sans urgence : les traces `[auth] …` de
`src/lib/auth.tsx` et `src/routes/index.tsx` sont des échafaudages de mise au
point. Elles ne divulguent que des noms de paramètres et des longueurs, jamais
une valeur de jeton — on peut les laisser le temps de s'assurer que le flux
tient, puis les retirer.

---

## 31. Bloc 1 — les trois champs manquants du bilan

Livré en deux envois : `100cfe4` (base et persistance), `75eed5e` (saisie et
affichage). Le découpage était volontaire — un diff vérifiable vaut mieux qu'un
gros diff survolé.

### 31.1 Base et persistance — `100cfe4`

```sql
alter table etapes add column cible text not null default '';
-- bilan des étapes : quatre états au lieu de trois
check (bilan is null or bilan in ('mercateam','en_cours','inchangee','supprimee'))
alter table frictions add column bilan text;
check (bilan is null or bilan in ('resolue','persistante'))
```

Les deux `bilan` sont **nullable** à dessein : sans quoi on ne distingue pas
« pas encore regardé » de « j'ai décidé », et la couverture d'un bilan ne se
mesure plus.

**Le point qui aurait perdu des données.** `prendre_version` fabrique ses
instantanés avec `client_json`. Si cette fonction n'émet pas les nouveaux
champs, tout instantané pris à partir de la migration les omet — et restaurer
un instantané *du jour même* effacerait en silence ce qui vient d'être saisi.
Le champ doit entrer dans le format à l'instant où il entre dans la table.
Fait dans la même migration, vérifié : `client_json` émet `cible` et les deux
`bilan`.

Contrôles : 392 `null` + 1 `mercateam` avant **et** après ; aller-retour
`importer_client_json(client_json(...))` identique au champ près (5 processus,
66 étapes, 16 frictions, 11 chiffres) ; copie de test supprimée.

**Décision appliquée : `en_cours` ne compte pas comme migré** dans
`etapesApresBilan`. Une étape en cours garde ses supports actuels, comme
« inchangée ». Si elle comptait comme acquise, un site où tout est en cours
afficherait un environnement IT entièrement déployé — le même avant/après
flatteur et faux que la règle des systèmes de référence vient de corriger
(§28). On sous-vend plutôt que de survendre. Une ligne à inverser si l'on veut
l'autre lecture.

### 31.2 Saisie et affichage — `75eed5e`

Quatre positions sur les cartes, contrôle à deux positions sur les frictions,
colonne « Cible » dans la saisie rapide, câblage complet. `tsgo` à 0 erreur,
base rigoureusement inchangée (393 étapes, 16 frictions, 4 clients, 1 étape au
bilan, 0 friction évaluée, 0 cible) — cet envoi n'écrit aucune donnée.

**La cible s'écrit en mode bilan, pas en mode modifier.** Elle appartient à la
trajectoire de déploiement. Surtout, cela préserve l'invariant que le code
s'était donné : les deux modes écrivent des champs strictement disjoints, donc
ils ne peuvent pas s'écraser.

Les écritures de cible et d'état de friction passent toutes deux par
`onAvantBilan()` — l'instantané qui garde le relevé nu restaurable.

**Le logo Mercateam : refusé, avec raison.** J'avais demandé de l'utiliser
*si et seulement si* deux conditions étaient réunies. Les deux échouent :
`LogoMercateam.tsx` fige ses couleurs (`fill="rgb(43,43,43)"`), il ne suit pas
`currentColor` et deviendrait un pavé invisible sur l'étiquette encre ; et son
`viewBox` de 346×48 donnerait, à 14 px de haut, un mot de 100 px de large avec
des capitales de ~9 px — illisible, pire encore à l'impression. Le mot est
conservé. **Poser la condition plutôt que l'instruction a évité une régression
visuelle.**

Vérifié de mon côté : `--rouge-fonce: #AD0101` existe bien dans
`charte/tokens.css`. Sans quoi l'étiquette « toujours d'actualité » aurait été
du texte blanc sur fond transparent — invisible, et silencieusement.

**Largeur du bandeau à quatre boutons**, mesurée : ~86 px au repos (codes
courts `M → = ✕`), ~134 px dans le pire cas (« Mercateam » écrit en toutes
lettres) contre ~144 px utiles. Ça tient de justesse, et le bandeau étant en
`position: absolute`, un débordement resterait visuel sans décaler la carte
voisine. Repli disponible si la recette navigateur le contredit : garder les
codes courts en toutes circonstances.

### 31.3 Deux écarts de périmètre, tous deux acceptés

`impression.$code.tsx` a été touché malgré la consigne : deux lignes, le
renommage `edition={false}` → `mode="lecture"` plus `onEtat={rien}`. Sans quoi
le projet ne compilait pas. Écart nécessaire, et signalé.

**`routeTree.gen.ts` a de nouveau perdu son bloc `Register`** — exactement la
récurrence annoncée au §29.1 (« ça peut se reproduire à l'identique au prochain
commit pris au mauvais moment »). La prédiction est confirmée : ce n'est pas un
incident isolé mais une course entre le générateur TanStack et la capture du
commit. Le corriger à la main ne tiendra pas ; il faudrait soit exclure ce
fichier du suivi, soit forcer sa régénération avant capture. À traiter comme un
défaut d'outillage, pas comme une régression de code.

### 31.4 Ce qui reste du bloc

La **restitution imprimée** de la cible et des états de friction — troisième
envoi, volontairement séparé. Aujourd'hui les frictions résolues s'affichent
déjà à l'impression (le panneau est partagé), mais la colonne « Cible » vit
dans la saisie rapide, qui n'est pas imprimée.

---

## 32. Bloc 1, troisième envoi — la restitution imprimée (`40898e8`)

La cible vivait dans la saisie rapide, qui n'est pas imprimée : un champ que le
client ne voit pas en restitution n'existe pas. Ajout d'une page
« Trajectoire de déploiement » par processus, **conditionnée à la présence
d'au moins une cible**. Elle liste les seules étapes qui en portent une —
jamais les 66 du processus — avec l'étiquette d'état de bilan quand il y en a.

Deux fichiers touchés, et deux seulement : `impression.$code.tsx` et un `export`
ajouté devant `STYLE_ETIQUETTE` dans `MarquesBilan.tsx`. `routeTree.gen.ts` n'a
pas dérivé cette fois.

### 32.1 Ce que j'ai vérifié moi-même

**La clef de la `Map` des marques.** `TableauCibles` lit `marques.get(e.ordre)`.
Si `marquesDesEtapes` indexait par `id`, l'étiquette ne serait jamais apparue —
sans erreur de type, sans rien à l'écran. Vérifié dans `bilan.ts` : la `Map` est
bien indexée par `ordre`, et le commentaire le dit (« la clef du diagramme »).

**L'export PPTX.** Vérifié en lisant `export-pptx.ts` plutôt qu'en le croyant :
`document.querySelectorAll(".page-16-9")` puis `toPng` sur chaque nœud. C'est
une photographie, pas une reconstruction — les nouvelles pages entrent seules,
dans l'ordre du DOM. Aucune omission silencieuse possible. À noter tout de
même : la capture est séquentielle avec un délai de 30 s par page, donc chaque
page ajoutée allonge l'export d'autant.

**La garde.** `decouper()` reçoit `d.etapes.filter(cible non vide)` ; aucune
étape ne portant de cible, la liste est vide, `decouper` renvoie `[]` et
`.map()` ne rend rien. Le nombre de pages est rigoureusement inchangé sur les
quatre diagnostics.

**Base inchangée**, mesurée avant et après : 393 étapes, 16 frictions,
4 clients, 30 processus, 1 étape au bilan, 0 friction évaluée, **0 cible**.
`tsgo --noEmit` à 0 erreur.

### 32.2 Le découpage : 12 lignes, estimé et annoncé comme tel

`Page` ne déborde jamais, **elle rétrécit** : elle compose à 1600 px puis met à
l'échelle pour tenir dans le 16:9. Un tableau trop long ne dépasse donc pas de
la page, il devient illisible — et ça ne se voit pas au moment de l'export.
C'est la panne qu'on ne découvre qu'en salle.

D'où le découpage. Le calcul retenu : échelle plafonnée à 1200/1600 = 0,75
(zone utile de 1200 px pour une toile de 1600), zone verticale ~745 px dans le
repère de la toile, ligne ~52 px, en-tête ~40 px → (745 − 40) / 52 ≈ 13, arrondi
à **12** pour laisser une cible déborder sur deux lignes. Le corps sort à
16 × 0,75 = 12 px sur la diapositive.

Le chiffre est **estimé, pas mesuré**, et le commentaire du code le dit. C'est
la bonne façon de laisser une valeur approchée dans un fichier : la prochaine
personne saura qu'elle peut la contredire avec une mesure.

### 32.3 Ce qui reste faux ou non vu

**Le texte de l'étape n'est pas tronqué.** `{e.texte}` sort en entier. Une étape
verbeuse *et* une cible longue peuvent produire une ligne bien plus haute que
les 52 px du calcul ; au-delà de deux lignes par cellule, la page se réduit et
le corps passe sous 12 px. Le repli est gracieux — ça reste lisible avant de
devenir petit — mais le seuil de 12 ne protège que jusqu'à deux lignes.

**Cette page n'a jamais été rendue.** Zéro cible en base : elle est juste par
construction, et personne ne l'a vue. Elle rejoint le constat général de la
feuille de route (§2a) — aucune passe navigateur n'a jamais été faite.

**Dérive de commentaire dans `bilan.ts`.** L'en-tête annonce toujours « une
colonne `bilan` à trois valeurs » et « le troisième état, "supprimée" » : c'était
vrai avant `en_cours`, ça ne l'est plus. Deux phrases à corriger, à joindre au
prochain envoi plutôt qu'à traiter seules.

### 32.4 L'en-tête de `bilan.ts` remis à jour (`88a90ae`)

Correction du commentaire seul, dicté mot pour mot plutôt que décrit — pour un
texte, donner la rédaction exacte coûte moins cher qu'un aller-retour de
reformulation. Il annonçait encore trois états et ignorait `etapes.cible` comme
`frictions.bilan`, tous deux définis dans ce fichier. La nouvelle version dit
pourquoi chacun des quatre états existe, et pourquoi `null` doit rester
distinct : sans lui, « pas encore regardé » et « j'ai décidé » se confondent, et
la couverture d'un bilan cesse d'être mesurable.

Aucune ligne de code touchée, `tsgo --noEmit` à 0 erreur.

**Et le mécanisme de la dérive de `routeTree.gen.ts` est confirmé.** Ce
commit-ci a **rajouté** le bloc `declare module '@tanstack/react-start'` que le
précédent avait retiré, sans que rien dans l'envoi ne concerne le routage. Le
fichier oscille donc dans les deux sens au gré du moment où la capture attrape
le générateur TanStack — ce n'est ni une régression ni une correction, c'est une
course. Le fichier est aujourd'hui dans son état complet ; il repartira. Rien à
corriger à la main : seul un réglage d'outillage (exclusion du suivi ou
régénération forcée avant capture) y mettra fin.

---

## 33. `routeTree.gen.ts` sorti du suivi (`906daf7`)

Fin de l'oscillation décrite aux §29.1, §31.3 et §32.4 : le fichier généré par
le plugin TanStack entrait et sortait de son état complet au gré du moment où la
capture du commit attrapait le générateur. Trois commits d'affilée l'avaient vu
perdre puis retrouver son bloc `declare module '@tanstack/react-start'` sans
qu'aucun envoi ne touche au routage.

### 33.1 La vérification d'abord, l'exclusion ensuite

`src/router.tsx` importe `routeTree` depuis ce fichier. L'exclure sans garantie
de régénération aurait troqué un bruit de diff contre une panne de compilation —
un très mauvais échange. La régénération a donc été **démontrée avant** d'agir,
deux fois :

1. fichier supprimé du disque → redémarrage du serveur de développement : revenu
   **octet pour octet identique** (`diff` sans différence) ;
2. supprimé à nouveau → `vite build --mode development` : **régénéré avant la
   compilation**, build en succès.

Mécanisme identifié : `@tanstack/router-plugin`, monté par le preset
`@lovable.dev/vite-tanstack-config`, qui scanne `src/routes/` au démarrage et à
chaque changement de fichier de route. Un déploiement depuis un clone neuf tient
donc : le build ne dépend pas de la présence préalable du fichier.

### 33.2 Le piège : `.gitignore` seul ne fait rien

Première tentative : ajout de `src/routeTree.gen.ts` au `.gitignore`. **Sans
effet** — `.gitignore` ne s'applique jamais à un fichier déjà suivi. Vérifié
plutôt que déduit :

```
git ls-files --error-unmatch src/routeTree.gen.ts → suivi=0   (encore dans l'index)
git check-ignore -v src/routeTree.gen.ts          → ignore=1   (pas ignoré)
```

C'est le genre de demi-mesure qui se croit faite : la ligne est dans le fichier,
le dépôt a l'air propre, et rien n'a changé.

### 33.3 Le contournement, sans commande git

L'agent de la plateforme n'a pas la main sur l'index git, et le projet n'est
synchronisé avec aucun dépôt GitHub — impossible d'agir dessus de l'extérieur.
Plutôt que de renvoyer la commande à taper, on est passé par le disque :
**supprimer le fichier suffit**, la capture de la plateforme enregistre la
suppression comme n'importe quel autre changement, et le fichier quitte l'index
par ce biais. Une fois dehors, la règle du `.gitignore` devient enfin effective.

Résultat, contrôlé sur le commit lui-même et pas sur le compte rendu — `906daf7`
est une suppression pure de `src/routeTree.gen.ts` :

```
suivi=1                                        (hors de l'index)
.gitignore:35:src/routeTree.gen.ts → ignore=0  (désormais ignoré)
-rw-r--r-- 6160 src/routeTree.gen.ts           (présent, régénéré)
git status --short                             (vide)
bunx tsgo --noEmit                             (0 erreur)
```

### 33.4 Ce qu'il faut savoir désormais

**Aucun script de génération n'existe dans `package.json`** : la génération n'est
qu'un effet de bord du plugin Vite. La dépendance est implicite et n'est
documentée que par le commentaire placé au-dessus de la ligne du `.gitignore`.
Elle tient — c'est mesuré — mais elle n'est écrite nulle part ailleurs.

**Conséquence sur un clone neuf** : `tsgo --noEmit` seul échouera tant qu'un
`dev` ou un `build` n'aura pas régénéré le fichier. C'est le prix de
l'exclusion, et il est acceptable puisque le contrôle de types tourne dans un
environnement où le serveur de développement est vivant.

### 33.5 Tentative de rendu : bloquée par l'authentification

Un jeu d'essai a été posé sur le client de test `test-06-08` (quatre cibles, deux
étiquettes de bilan dont `en_cours`) pour voir enfin la page « Trajectoire de
déploiement » se rendre. **Le rendu sans tête n'a pas abouti** :
`LOVABLE_BROWSER_AUTH_STATUS=signed_out`, et la route est sous le garde
`_authenticated`. L'agent s'est arrêté sans forger de session — c'était la
consigne, et c'est la bonne réponse.

Le constat à retenir dépasse cette page : **cette application n'est vérifiable
visuellement que par un humain connecté.** C'est la raison structurelle pour
laquelle §2a de la feuille de route — aucune passe navigateur jamais faite —
tient depuis si longtemps. Une session existe pourtant côté navigateur de test
dès que l'utilisateur se connecte dans la préversion ; la vérification est donc
possible, elle demande juste une connexion préalable.

Jeu d'essai retiré, base rendue à l'identique : 393 étapes, 16 frictions,
4 clients, 0 cible, 0 friction évaluée, et l'unique étape au bilan de Sekurit
intacte. La page « Trajectoire de déploiement » **n'a toujours été vue par
personne.**

---

## 34. Point E — la garde de concurrence sur les enfants (`92901aa`)

Le seul défaut de `INSPECTION-PARCOURS.md` qui **perde des données**. Ouvert
depuis le 07/08.

### 34.1 Le vrai constat : un invariant proclamé, jamais appliqué

`diagnostic.ts` affirmait en tête de fichier que l'unité de concurrence est le
processus parent. **Cet invariant n'était appliqué nulle part** :
`updateEtape`, `updateFriction` et `updateChiffre` écrivaient sans garde, là où
`updateClientRow` et `updateProcessus` portaient `.eq("version", version)`.
Deux consultants sur la même étape — le cas le plus fréquent à deux sur site —
produisaient un « dernier écrivain gagne » silencieux.

Un invariant écrit et non tenu est pire qu'une absence : on lui fait confiance.
Le choix retenu a donc été de **rendre vrai le modèle déjà déclaré**, pas d'en
changer. Arbitrage de l'utilisateur, entre deux options présentées : le
processus comme unité (retenu, aucune colonne ni trigger) ou une version par
ligne (rejeté : migration sur trois tables, et renversement d'une décision
documentée).

### 34.2 Pourquoi ça a demandé du SQL malgré tout

J'avais annoncé « zéro migration ». **C'était inexact, et je l'ai corrigé avant
d'envoyer.** La garde doit être atomique : lire `processus.version` puis écrire
depuis le client laisse une fenêtre de course entre les deux — et surtout
proclame une sûreté fausse, exactement la faute qu'on corrige. Comparaison et
écriture doivent tenir dans une seule instruction.

D'où trois fonctions `maj_etape` / `maj_friction` / `maj_chiffre` :

```sql
update etapes e set … where e.id = p_id
  and (select p.version from processus p where p.id = e.processus_id) = p_version
```

Deux propriétés qui comptent autant que la garde elle-même :

- **`null` signifie conflit**, jamais « rien à faire » — c'est ce que le client
  traduit en bandeau via `ConflitDeVersion("processus")` ;
- **la version fraîche du processus est renvoyée**. C'était le principal risque
  du chantier : le trigger incrémente la version à chaque écriture enfant, donc
  un consultant **seul** enchaînant deux champs aurait envoyé une version
  périmée au second et **se serait mis en conflit avec lui-même**. La version
  est écrite dans le cache par `setQueryData` **avant** l'invalidation, qui est
  asynchrone.

Le patch partiel n'écrit que les clefs présentes (`p_patch ? 'colonne'`), et les
colonnes nullables (`bilan`, `etape_id`) ne passent pas par `coalesce` — sinon
remettre une friction à « non évaluée » aurait été impossible.

### 34.3 Prouvé par la mesure, pas par la relecture

Sur une étape de `test-06-08`, processus en version 26 :

| appel | version passée | sortie |
|---|---|---|
| 1 | 26 | ligne à jour, `version_processus: 27` — aucune colonne absente effacée |
| 2 | 26 (**périmée**) | `null` → conflit |
| 3 | 27 (fraîche) | succès, restauration du texte d'origine |

Base inchangée avant et après : 410 étapes, 16 frictions, 5 clients,
11 chiffres. `tsgo --noEmit` à 0 erreur.

### 34.4 Ce que j'ai vérifié moi-même

Le test de l'agent est passé par des droits élevés, donc il **ne prouvait pas**
que l'application peut appeler ces fonctions. Contrôlé directement dans le
catalogue :

- `prosecdef = false` → `security invoker` : RLS s'applique à l'appelant, la
  fonction n'ouvre aucun privilège ;
- exécutable par `authenticated` → le chemin applicatif existe ;
- exécutable par `anon` **aussi** — c'est le défaut PostgreSQL sur `PUBLIC`, pas
  un ajout. Neutralisé par `security invoker` : les trois tables portent une
  politique RLS avec le filtre de domaine, donc un appel anonyme se voit refuser
  l'`UPDATE` et reçoit `null`. Aucune écriture, aucune fuite. Un
  `revoke execute … from public` reste souhaitable par hygiène.

### 34.5 Le risque résiduel, et il est réel

**Toutes les écritures d'étape, de friction et de chiffre passent désormais par
un chemin que personne n'a exercé dans un navigateur.** La preuve porte sur la
logique SQL, pas sur l'appel depuis l'application : un nom de paramètre erroné
ou une sérialisation `jsonb` fautive casserait *toute* l'édition, et ne se
verrait qu'à l'usage. C'est le changement le plus risqué de la semaine, et il
demande une vérification au navigateur avant toute autre chose.

### 34.6 Le chemin du flux est plus large qu'annoncé

Réponse obtenue sur `flux-mutations.ts` : `appliquerMutation` écrit sur
`etapes` par **quatre** voies, aucune gardée — `updateEtapeSansGarde` (renommée
pour ne pas déguiser en gardé ce qui ne l'est pas), `createEtape`,
`deleteEtape`, et la RPC `reordonner_etapes`. Cette dernière est la plus
sensible : un déplacement d'étape reste un « dernier écrivain gagne » sur
**tout l'ordre du processus**, pas sur une ligne. Le second envoi devra couvrir
les quatre, pas seulement les suppressions comme prévu initialement.

---

## 35. Point E, second envoi — le chemin du diagramme (`68c61c3`)

### 35.1 Pourquoi le remède du premier envoi ne convenait pas ici

Dans `clients.$code.tsx`, chaque écriture est un geste isolé et renvoyer la
version fraîche suffit. **Pas ici.** Une seule `Mutation` du diagramme porte
jusqu'à quatre écritures — `ecritures`, `creation`, `suppression`, `ordre`.
Garder chacune avec la version lue au début du geste l'aurait fait **échouer
sur lui-même** : la première écriture avance la version par trigger, les trois
suivantes seraient refusées.

D'où `appliquer_mutation_flux()` : **la version est vérifiée une seule fois**
(`select … for update`), puis tout le geste est appliqué dans la même
transaction. Bénéfice au passage, qui vaut à lui seul le déplacement : l'en-tête
de `flux-mutations.ts` rappelait que PostgREST met chaque requête HTTP dans sa
propre transaction — **un glisser-déposer qui échouait à mi-parcours laissait le
diagramme à moitié muté.** Ce n'est plus possible.

`reordonner_etapes` est appelée, pas réécrite : elle porte la logique de la
contrainte différée `etapes_ordre_unique`, et l'en-tête du fichier documente ce
piège comme déjà rencontré. Le jeton `CREATION` ne franchit pas la frontière
SQL — le JS le remplace par `null`, la fonction y substitue l'identifiant créé,
et `src/flux/` reste intouché.

### 35.2 Prouvé par la mesure

Processus « planification » de `test-06-08`, 17 étapes, version 65 :

| essai | version | sortie |
|---|---|---|
| 1 — `ecritures` **et** `ordre` | 65 | succès, `version_processus: 83` ; **les deux volets appliqués** |
| 2 — la même, rejouée | 65 (périmée) | `null` |
| 3 — intégrité après réordonnancement | — | 17 étapes, `ordre` 1→17, 17 valeurs distinctes |

Le premier essai est celui qui compte : il démontre qu'un geste à plusieurs
écritures ne se met plus en conflit avec lui-même. Restauration confirmée par
relecture ; base inchangée (410 étapes, 16 frictions, 5 clients, 11 chiffres),
`tsgo --noEmit` à 0 erreur.

La version passe de 65 à 83, soit **+18** pour un seul geste : le trigger est
par ligne, pas par instruction. Sans conséquence — la version est un jeton de
concurrence, pas un compteur de gestes — mais il faut le savoir avant de la lire
comme une mesure d'activité.

### 35.3 Vérifié moi-même

`updateEtapeSansGarde` a disparu, et les trois `update*` passent bien par
`majEnfant`. `appliquer_mutation_flux` : `prosecdef = false` (invoker),
`search_path=public`, exécutable par `authenticated`. `reordonner_etapes` est
également en invoker, donc l'appel imbriqué n'élargit aucun privilège.

### 35.4 Le commentaire de `diagnostic.ts` promet plus qu'il ne tient

L'en-tête réécrit au premier envoi affirme désormais : « Cet invariant **EST**
appliqué ». **C'est vrai des mises à jour, faux des créations et des
suppressions.** Restent sans garde, et appelées depuis l'interface :
`createFriction`, `createChiffre`, `deleteFriction`, `deleteChiffre` — plus
`deleteProcessus` et `deleteClientRow` au niveau parent. `deleteEtape` n'a plus
aucun appelant : code mort.

C'est exactement la faute qu'on vient de corriger, réintroduite par la
documentation du correctif : **un invariant proclamé au-delà de ce qui est
tenu**. Quelqu'un lisant ce fichier croira `deleteFriction` gardée. La phrase
doit être bornée aux mises à jour, et dire ce qui reste ouvert.

### 35.5 Les créations en masse : exception assumée, pas oubli

`createEtape` a trois autres appelants — `modele-processus.ts`,
`trame-use-case.ts`, `duplication.ts` — tous non gardés. Chacun **crée le
processus juste avant** d'y insérer ses étapes : personne d'autre ne peut le
détenir, la garde n'y aurait rien à comparer. Exception raisonnée, à écrire
plutôt qu'à corriger.

### 35.6 Où en est le point E

- **Mises à jour des enfants : gardées**, par les deux chemins — champ à champ
  et diagramme. C'est là qu'était la perte de données décrite par l'inspection.
- **Créations et suppressions d'enfants : toujours sans garde.** Troisième et
  dernier envoi.

---

## 36. Point E fermé — créations et suppressions (`a7b26d3`, `ecb0fed`)

### 36.1 Ce qui est livré

Quatre fonctions gardées — `creer_friction`, `creer_chiffre`,
`supprimer_friction`, `supprimer_chiffre` — sur le modèle exact des `maj_*` :
version du processus comparée **dans la même instruction** que l'écriture,
`null` = conflit, version fraîche renvoyée. Plus la garde sur `deleteProcessus`,
qui détruit un use case entier et restait le pire cas de la liste.

`deleteEtape` supprimée : plus aucun appelant depuis que
`appliquer_mutation_flux` fait la suppression en SQL.

**Une suppression qui ne trouve pas sa ligne renvoie `null` elle aussi** — donc
un conflit. Mieux vaut un bandeau de trop qu'une disparition silencieuse.

L'en-tête de `diagnostic.ts` porte désormais l'inventaire exact : ce qui est
gardé et par quel moyen, **et ce qui ne l'est pas avec la raison** — les trois
chemins de création en masse, et `deleteClientRow`. La phrase « cet invariant
EST appliqué », qui promettait au-delà de ce qui était tenu (§35.4), est
corrigée.

### 36.2 Le défaut que la preuve avait sauté

L'envoi a prouvé la création et la suppression d'une **friction**, jamais celles
d'un **chiffre**. C'est précisément là que ça cassait.

```
chiffres_non_vide  CHECK (valeur <> '' OR libelle <> '')
```

C'est un **OU**, et `creer_chiffre` insérait `'', ''` : la contrainte était
violée à tous les coups, la création d'un chiffre clé aurait levé une exception
à l'usage. Attrapé en relisant les contraintes, pas en lisant le compte rendu.

**Le chemin qu'on ne mesure pas est celui qui casse.** C'est la deuxième fois
cette semaine qu'exiger une mesure par chemin, plutôt qu'une mesure globale,
attrape un défaut.

Corrigé (`ecb0fed`) : le libellé provisoire va dans `libelle`, **`valeur` reste
vide**. Un faux chiffre serait pire qu'un libellé à compléter — quelqu'un
pourrait le lire comme une donnée. Convention unique, « À préciser », partagée
avec les frictions.

### 36.3 Le vrai constat : deux boutons cassés depuis toujours

Les deux contraintes existaient **avant** ce chantier, et les anciens appels de
l'écran les violaient toutes les deux :

- `createFriction({texte: ""})` contre `frictions_texte_non_vide` ;
- `createChiffre({valeur: "", libelle: ""})` contre `chiffres_non_vide`.

**Les boutons « ajouter une friction » et « ajouter un chiffre clé » n'ont
jamais pu fonctionner.** Personne ne s'en est aperçu. C'est la mesure la plus
parlante du peu d'usage réel de l'application — et la meilleure justification de
la recette navigateur, qui reste le prochain chantier.

Étendue vérifiée sur les autres chemins, aucun n'est concerné :
`modele-processus.ts` ne crée ni friction ni chiffre ; `trame-use-case.ts` et
`duplication.ts` recopient des lignes déjà conformes ; `importer_client_json`
filtre déjà — **mais en silence**, les lignes sautées ne sont pas signalées à
l'importateur. À noter pour plus tard.

### 36.4 Vérifié moi-même

Les cinq fonctions : `prosecdef = false` (invoker), `search_path=public`,
exécutables par `authenticated`. La migration corrective a fait un `drop` puis un
`create` avec une signature différente **sans réémettre le `grant`** — ça
fonctionne par le défaut PostgreSQL sur `PUBLIC`, mais c'est implicite là où les
autres sont explicites. À reprendre avec le `revoke execute … from public`
recommandé au §34.4.

Base à l'identique : 410 étapes, 16 frictions, 5 clients, 11 chiffres, aucune
ligne « À préciser » résiduelle.

**Une étape de plus porte un bilan** : Sekurit, onboarding, étape 2, `mercateam`.
Ce n'est pas un résidu de test — c'est une écriture réelle faite depuis le
navigateur. Premier usage constaté du mode bilan par un humain.

### 36.5 Le point E est fermé

Mises à jour, créations, suppressions, et le geste du diagramme : tout ce qui
écrit un enfant depuis l'interface passe par une garde de version, prouvée par
un refus mesuré. `deleteClientRow` reste seule sans garde — un appelant unique,
`clients.index.tsx`, qui **dispose de la version du client**. La garde y serait
immédiate ; il ne manque qu'une décision.

---

## 37. Le diagramme garde sa place (`0b6b774`)

Premier retour d'usage réel du projet (`RETOURS-USAGE.md`, 17/08) : à chaque
écriture, le défilement horizontal repartait au début et le zoom se
réinitialisait. Défaut **F** de l'inspection, écrit le 07/08 avec la mention
« à confirmer au navigateur ». Confirmé par l'usage, dix jours plus tard.

### 37.1 Mon hypothèse était fausse, la mesure l'a corrigée

J'avais brieffé en supposant **deux causes distinctes** : le balisage reconstruit
pour le défilement, et l'observateur du diagramme remettant le zoom à 100 % pour
le second — en m'appuyant sur le commentaire de `impression.$code.tsx` qui
décrit ce comportement.

La mesure dit autre chose. Banc d'essai isolé, rendu dans un vrai navigateur :

- `.flux-defile` appartient au balisage produit par le moteur. À chaque
  mutation, React réécrit l'`innerHTML` de l'hôte : le conteneur est
  **remplacé**, pas vidé. Mesuré — le nœud avant et après n'est pas le même.
- **Le moteur ne remet rien à 100 %.** Il écrit `zoom:1` en dur dans le style de
  `.flux` à chaque reconstruction, et l'enveloppe repose la vraie valeur après
  coup.

**Une seule cause, pas deux** : le balisage neuf naît sans ces valeurs, et tout
se joue dans la fenêtre entre sa naissance et le moment où l'enveloppe les
repose. Avoir demandé un diagnostic *avant* le correctif a évité de traiter un
symptôme inexistant.

### 37.2 Le correctif, et la boucle évitée

Tout dans `DiagrammeAvecZoom.tsx` ; `src/flux/` et `clients.$code.tsx`
inchangés — un seul fichier au diff.

- **Défilement** : écoute `scroll` **en capture sur l'hôte**, nœud que React ne
  remplace jamais — donc aucune réattache quand le conteneur interne est
  reconstruit. Position gardée en continu, jamais relevée « juste avant » la
  reconstruction, où elle est déjà perdue.
- **Restauration** dans un `useLayoutEffect` à chaque rendu **et** dans la même
  image que `acheverRendu` : avant peinture, donc aucun saut visible.
- **Zoom** : on repose la propriété CSS sur `.flux`, **jamais dans le curseur**,
  et seulement si elle diffère. Une propriété de style ne déclenche ni `input`,
  ni `change`, et l'observateur n'écoute que `childList` — la boucle que
  j'avais signalée comme le vrai risque est structurellement impossible. Un
  drapeau `enCours` protège en plus contre la réentrance.

**Preuve de l'absence de boucle** : au repos, le compteur de mutations de style
reste figé (447 puis 447 sur trois secondes). C'est le contrôle qui manquait le
plus, et il a été fait.

Trois mutations successives : `scrollLeft` reste à 500, `zoom` à 0,7. Après
rechargement, le zoom revient à 70 % — mémorisé par processus dans
`sessionStorage`, ce qui clôt au passage le second volet du défaut F (zoom perdu
au rechargement).

### 37.3 Ce qui reste imparfait

La clef de `sessionStorage` est `flux:zoom:<id>` où `id` est le **code** du
processus, un slug, pas son uuid — l'appelant passe `processus.code`. Deux
clients ayant un processus de même code partageraient donc leur zoom. Sans
gravité, mais à corriger si l'on touche à ce fichier.

**La page réelle n'a pas été testée** : aucune session ne peut être ouverte
depuis l'agent. Le banc reproduisait le chemin exact de l'enveloppe, ce qui est
la meilleure approximation possible — mais c'est une approximation, et seul
l'usage tranchera.

---

## 38. Retrait de la comparaison à la trame générique (`74d44f4`)

Décision produit de l'utilisateur, prise en regardant l'application : l'encart
« Cible de référence Mercateam » sous chaque diagramme, **et** la page pleine du
même nom dans la restitution imprimée, disparaissent. Sa raison : *le bilan se
fait sur le processus réel du site, et un audit Mercateam n'est pas générique*.

J'ai étendu la question avant d'agir. Il demandait le retrait de l'encart ;
l'argument valait tout autant — et davantage — pour la page imprimée, celle que
le client lit. Arbitrage confirmé : les deux. **5 pages de moins sur un audit à
cinq use cases** (14 → 9).

### 38.1 Le piège désamorcé : la palette

`paletteStable` est une **fonction pure de la liste des noms** qu'on lui donne :
chaque rôle occupe la place déterminée par l'empreinte de son nom **dans cette
liste**. La palette est construite sur l'union des rôles du site et de ceux de
la trame cible.

Retirer `rolesCible` en même temps que l'affichage aurait donc **repeint des
rôles n'ayant aucun rapport avec la trame**, sur tout l'écran et dans tous les
PDF — un document réédité n'aurait plus ressemblé à celui de la veille, sans le
moindre signal. C'est le type d'erreur qui ne se voit qu'en comparant deux
exports à un mois d'écart.

La requête est donc conservée, et un commentaire en majuscules explique
au-dessus qu'elle **ne sert plus qu'à figer les couleurs** et n'est pas du code
mort. Sans cette phrase, elle serait supprimée au prochain nettoyage.

### 38.2 Le résumé de l'agent contredisait son propre code

Son compte rendu disait « palette conservée à l'identique ». Son résumé disait
« retiré `rolesCible` et `useTrameCible` ». **Les deux ne pouvaient pas être
vrais.**

Le diff a tranché : `useTrameCible()` est toujours appelé dans les deux
fichiers, le `useMemo` de `rolesCible` est inchangé, et l'appel à
`paletteStable` apparaît en ligne de contexte, intact. C'est le **résumé** qui
était faux.

**Règle à retenir : vérifier contre le diff, jamais contre le récit.** Un compte
rendu et un résumé produits par la même machine peuvent se contredire, et rien
ne signale lequel croire. Ici, la contradiction portait précisément sur le seul
point dont j'avais écrit qu'une erreur y serait invisible.

### 38.3 Ce qui a été gardé

`comparer()`, `synthese()`, `chargerTrameCible()`, `normaliser()` et les types
de `trame-cible.ts` sont intacts : le prochain envoi les réutilise pour comparer
le site **à son propre bilan** (défaut **G**). `ApresDeploiement.tsx` reste en
place, avec une note d'en-tête disant qu'il n'est temporairement plus référencé
et pourquoi — pas de fichier orphelin muet.

Retirés proprement : la propriété `comparable` et son calcul, l'état `apres`,
l'import `estTrame` dans les deux fichiers. `tsgo --noEmit` à 0 erreur, base
inchangée.

**Vu autrement, cette décision et le point G sont les deux moitiés d'un même
geste** : on retire la comparaison à un modèle théorique, on met à la place
celle qui a du sens — où ce site était, où il en est.

---

## 39. Point G — le site comparé à son propre bilan (`fd72fc6`)

Point 11 des exigences d'origine, « Partiel » depuis le 07/08, et seconde moitié
du geste de §38 : on avait retiré la comparaison à un modèle théorique, on met à
la place celle qui a du sens.

Nouvelle page d'impression **« Avant / après le déploiement »**, une par
processus portant un bilan, placée après la page du processus et ses pages de
trajectoire. Elle affiche la phrase de `synthese(c, "bilan")`, puis trois
colonnes — **« Ce qui disparaît »**, **« Ce qui arrive »**, **« Ce qui
demeure »** —, les deux nombres d'étapes avec l'écart, et la maturité quand les
deux sont posées.

### 39.1 Le calcul, monté sur l'existant

```ts
comparer(
  { processus: p, etapes },
  { processus: { ...p, maturite: p.maturite_bilan }, etapes: etapesApresBilan(etapes) },
)
```

Rien de neuf : `comparer()` était déjà générique, `synthese(…, "bilan")` déjà
écrite avec son écart chiffré, `etapesApresBilan()` déjà utilisée par
l'environnement IT. Il manquait l'appelant.

**Le `{ ...p, maturite: p.maturite_bilan }` était le point à ne pas rater** :
passer le même processus des deux côtés aurait affiché « 2 → 2 », un mensonge
sur le seul chiffre qu'un directeur d'usine regarde.

**Pas de section « rôles »**, et c'est écrit en commentaire : `etapesApresBilan`
ne touche pas à `processus.roles`, les deux côtés sont identiques par
construction. Sans la phrase, quelqu'un « corrigerait » l'oubli.

### 39.2 Le rendu partagé, sans partager les mots

Extraction de `Comparaison.tsx` (`Ensemble`, `TrioComparaison`), **libellés
passés par l'appelant**. Raison donnée, et bonne : ce qui se partage, c'est la
mise en forme des trois ensembles ; « ce qui apparaît dans la trame » n'est pas
« ce qui arrive chez ce site ». `ApresDeploiement` consomme le même composant et
garde sa formulation.

### 39.3 Preuve sur données réelles, et une correction qui m'était due

Sekurit, processus « Planification » (17 étapes, une seule marquée `mercateam`,
support `Excel`) :

```
disparaissent : —
arrivent      : Mercateam
demeurent     : Au jugé, Excel, Logiciel (SIRH / GTA), Oral, Papier
étapes        : 17 à l'audit / 17 au bilan
```

Cohérent avec les données : l'étape 6 perd `Excel` — générique, donc non
conservé — au profit de `Mercateam`, mais `Excel` reste porté par sept autres
étapes, donc il « demeure ». Aucune suppression, donc 17/17.

**J'avais écrit dans le brief que Sekurit portait deux étapes marquées.**
C'était vrai le matin même, faux au moment de l'envoi — l'utilisateur en avait
retiré une en testant. L'agent a vérifié en base plutôt que de me croire et m'a
corrigé. **Une prémisse mesurée reste vraie jusqu'à ce qu'elle ne le soit plus :
une base vivante périme les mesures aussi vite qu'on les prend.**

### 39.4 Ce qui reste non vérifié

**La ligne de maturité n'a pas été exercée** : ni `maturite` ni
`maturite_bilan` ne sont posées sur ce processus, la garde de `comparer()`
masque donc la ligne. Le chemin est confirmé par lecture du code, pas par une
mesure. C'est précisément le chemin où une erreur afficherait un faux chiffre —
à tester dès qu'un diagnostic portera les deux maturités.

**Redondance à corriger** : la phrase de `synthese` dit déjà « 17 étapes à
l'audit / 17 au bilan », et le bloc de détail la répète. Le même fait deux fois
sur une page client.

**Débordement** : analysé et écarté — ~95 outils par colonne avant que la page
ne rétrécisse, contre 5 à 15 dans un diagnostic réel. Le raisonnement est écrit,
rien n'a été bricolé.

Base au moment de l'envoi : **411 étapes** (une de plus qu'hier), 16 frictions,
5 clients, 11 chiffres, 1 étape au bilan. Le décompte de référence bouge parce
que l'application est enfin utilisée.

---

## 40. `src/flux/` a été modifié — divergence rapatriée

L'utilisateur a envoyé quatre instructions directement à l'agent pendant que
mon envoi tournait : bouton glissant à quatre états avec le logo, retrait des
aplats noirs, **correction d'une flèche cassée**, et contour violet pour
« Mercateam ». Mes briefs portent toujours la consigne « `src/flux/` est
intouchable » ; ces instructions-là ne la portaient pas.

**Résultat : l'agent a modifié `src/flux/moteur.js`** pour corriger la flèche.
C'est exactement le cas que l'invariant existait pour empêcher.

### 40.1 Le diagnostic de la flèche était juste

```js
const r = Math.max(2, Math.min(9, (x2 - x1) / 2 - 2));   // avant
```

Le `Math.max(2, …)` impose un rayon d'au moins 2 px **même quand l'écart
horizontal ne le permet pas**. Deux cartes proches et décalées de quelques
pixels : les deux quarts de cercle se chevauchent, `mx - r` passe avant `x1`,
le tracé repart en arrière et la pointe déborde sur la carte. La correction
borne le rayon par l'écart horizontal **et** vertical, et se replie sur un
segment droit sous 2 px utiles ou quand `dx <= 0`.

Bon diagnostic, bonne correction — mais au mauvais endroit.

### 40.2 Pourquoi c'était un problème, et pas un détail

`flux/moteur.js` est maintenu **ici**, dans ce dépôt, avec cinq fichiers de
tests. La copie de Lovable en est un import. Une correction qui n'existe que
côté Lovable est une correction que **le prochain import écrase en silence**.

Pire : `flux/geometrie.test.cjs` est un test de non-régression qui **compare
les tracés de flèches produits par `flux/moteur.js` à ceux de
`diagnostic-os.html`**, le mono-fichier de référence. Corriger un seul des deux
fait diverger deux algorithmes que le test exige identiques — il aurait échoué
au premier lancement, en désignant la correction comme la régression.

Vérifié : le code fautif était **identique dans les deux sources**,
`flux/moteur.js:534` et `diagnostic-os.html:2378`. Le bug venait de l'origine ;
il n'avait simplement jamais été vu, faute d'usage.

### 40.3 Ce que j'ai fait

Rapatrié la correction **à l'identique dans les deux fichiers**, au caractère
près, pour que les trois copies convergent et que l'invariant du test — « le
moteur seul reproduit le mono-fichier » — reste vrai.

**Je n'ai pas pu lancer le test** : `playwright-core` n'est pas installé dans ce
dépôt (aucun `package.json` à la racine), alors que `geometrie.test.cjs`
l'exige. La convergence est donc établie par lecture et par égalité de texte,
pas par exécution. À lancer dès qu'un environnement le permet.

### 40.4 La leçon

L'invariant « `src/flux/` est intouchable » ne tient que si **chaque** consigne
le rappelle. Une instruction envoyée directement, sans ce garde-fou, le franchit
sans que rien ne s'y oppose — l'agent n'a aucun moyen de le connaître.

Deux remèdes possibles, à trancher : inscrire la règle dans la connaissance
permanente du projet Lovable (`set_project_knowledge`), pour qu'elle
s'applique à toutes les instructions quelle qu'en soit la source ; ou accepter
que le moteur vive désormais dans Lovable et faire du dépôt le miroir. **Le
statu quo est le seul mauvais choix** : deux sources qui divergent sans que
personne ne le sache.

---

## 41. Inversion : Lovable devient la source du moteur

Décision de l'utilisateur, 18/08/2026, après la divergence de §40 : **le projet
vit dans Lovable**. Le moteur du diagramme n'est plus maintenu ici et importé
là-bas ; c'est l'inverse. `flux/` dans ce dépôt devient un **miroir**.

### 41.1 Vérification de l'alignement

Lecture intégrale de `src/flux/moteur.js` côté Lovable, comparée à la copie
locale :

- **23 exports, mêmes noms, même ordre** — de `PASTELS` à `acheverRendu` ;
- constantes, utilitaires, géométrie, balisage : identiques ;
- **une seule divergence, celle de §40** : le tracé des flèches, désormais
  rapatrié.

Le commentaire du correctif a été aligné **au mot près** sur celui de Lovable,
dans `flux/moteur.js` et dans `diagnostic-os.html`. Un miroir qui diverge d'un
commentaire est un miroir dont on finit par douter.

**Rien n'a été envoyé à Lovable** : sa copie était déjà en avance, c'est le
dépôt qui la rattrape. La direction du flux est bien celle qu'a décidée
l'utilisateur.

### 41.2 Ce que l'inversion change dans les règles

L'invariant « `src/flux/` est intouchable » a gouverné tous les briefs de ce
projet. Il est **remplacé** dans `REPRISE.md` : on corrige désormais dans
Lovable, et le dépôt suit.

**Mais une contrainte survit à l'inversion, et il ne faut pas la perdre :**
`flux/geometrie.test.cjs` compare les tracés produits par le moteur à ceux de
`diagnostic-os.html`. Toute correction de géométrie doit donc être reportée
**dans le mono-fichier également**, faute de quoi le test compare deux
algorithmes différents et désigne la correction comme la régression. C'est
exactement ce qui serait arrivé au premier lancement après §40.

### 41.3 Ce qui reste non vérifié

**Le test de géométrie n'a pas pu être lancé** : `playwright-core` n'est pas
installé dans ce dépôt, qui n'a pas de `package.json`. L'alignement des trois
copies est établi par lecture et par égalité de texte, jamais par exécution.
C'est la seule vérification qui manque, et elle ne coûtera rien le jour où un
environnement permettra de la faire.

---

## 42. Les règles quittent le brief pour devenir permanentes

Deux corrections de fond, décidées après la question « `REPRISE.md` est-il
toujours nécessaire ? ». Réponse : oui, mais il portait deux choses de natures
opposées, et l'une pourrissait.

### 42.1 `REPRISE.md` cesse de décrire l'état courant

Écrit le 13/08, il portait le 18/08 **cinq affirmations fausses** : un journal
« §1 à §35 » qui en comptait 41, « 410 étapes » pour 411, un « point E, envoi 3
en cours » clos depuis, et deux défauts « en attente » livrés — dont l'un
confirmé par l'utilisateur lui-même.

C'est la faute exacte que la feuille de route avait été réécrite pour ne plus
commettre. **Et elle est pire ici** : c'est le premier fichier qu'on lit, donc
celui qu'on croit sans vérifier.

Sections « Où on en est » et « Prochaines étapes » supprimées, chiffres de base
supprimés, références à des numéros de section supprimées. À la place, une table
qui dit **où vit chaque question** — le journal pour l'état, la feuille de route
pour la suite, l'inspection pour les dettes, les retours d'usage pour le
terrain, et **la base elle-même pour les décomptes, jamais un chiffre recopié**.
332 → 273 lignes.

Le fichier porte désormais l'avertissement : *si tu y ajoutes un état, une date
ou un décompte, tu réintroduis le défaut*.

### 42.2 Les invariants passent dans la connaissance permanente de Lovable

`set_project_knowledge` était **vide**. Les invariants ne vivaient que dans mes
briefs — donc ils ne s'appliquaient qu'aux instructions que j'écrivais.

C'est précisément ce qui a permis l'incident de §40 : l'utilisateur a demandé
directement de corriger une flèche, sa consigne ne portait pas la règle sur
`src/flux/`, et l'agent n'avait **aucun moyen de la connaître**. Le reproche ne
lui revenait pas ; il revenait à l'endroit où la règle était rangée.

Y sont désormais inscrits : les huit invariants de fond (marque jamais par la
couleur seule, modes disjoints, `en_cours` non migré, systèmes de référence
conservés, `client_json` dans la même migration, processus comme unité de
concurrence, impression qui rétrécit au lieu de déborder, copie de référence du
moteur hors de Lovable) ; la charte graphique avec ses pièges — General Sans 600
jamais 700, pas de vert, ne jamais baisser un contraste ; et la méthode — une
preuve n'est pas une migration, prouver le refus et pas seulement le succès,
mesurer chaque chemin, signaler les écarts plutôt que les lisser.

**Ces règles s'appliquent maintenant à toutes les instructions, quelle qu'en
soit la source** — y compris celles que l'utilisateur envoie directement, sans
passer par moi. C'est le vrai correctif de §40 ; le rapatriement du code n'en
était que la réparation.

### 42.3 Le partage qui en résulte

| Où | Quoi | Pour qui |
|---|---|---|
| Connaissance Lovable | invariants, charte, exigences de preuve | l'agent, à chaque instruction |
| `REPRISE.md` | produit, topologie, démarche de vérification, décisions | une session Claude qui reprend |
| `PASSE-STATIQUE.md` | l'état, les mesures, ce qui reste faux | quiconque veut savoir où on en est |

La démarche de vérification reste hors de Lovable : elle dit comment **contrôler
l'agent**, elle n'a pas à être lue par lui.

---

## 43. Première passe de recette — onze points, onze réussites

Dix-huit jours après la première ligne de code, `RECETTE-NAVIGATEUR.md` a enfin
été parcourue — sa partie prouvable **sans navigateur**, soit la base et le
calcul pur. Le constat central du projet depuis le 07/08 — « personne n'a vu
cette application fonctionner » — recule pour la première fois autrement que
par une correction ponctuelle.

Base rendue à l'identique, vérifiée de mon côté : 5 clients, 31 processus,
411 étapes, 16 frictions, 11 chiffres, 20 instantanés, **aucun client résiduel**.
Les trames n'ont reçu que des lectures.

### 43.1 Niveau 1 — les cinq points irréversibles

Tous réussis, sur une copie jetable de Sekurit détruite en fin de passe.

**1.1, le plus grave, tient** : l'instantané `avant_suppression_client` **survit
à la destruction du client** — aucune cascade ne l'emporte — et se restaure à
l'identique, 5 processus / 65 étapes / 16 frictions / 11 chiffres. Le dialogue
de confirmation promettait que rien n'est perdu ; c'est vrai.

1.2 la restauration prend bien son propre instantané avant d'écraser. 1.3 le
réordonnancement ne touche que `ordre` — texte, rôle, phase et supports
identiques sur toutes les étapes. 1.5 la friction survit à la suppression de son
étape, `etape_id` à `null`. 1.6 `clients_trame_unique` refuse un second client en
trame `existant`.

### 43.2 Niveau 2 — le livrable ne ment pas

**2.4, que la recette désigne comme le contrôle le plus important, est vérifié
sur données réelles pour la première fois :**

```
ordre 1  avant=[Logiciel (ERP), Excel, Papier]  apres=[Mercateam, Logiciel (ERP)]
ordre 4  avant=[Logiciel (SIRH / GTA)]          apres=[Mercateam, Logiciel (SIRH / GTA)]
```

L'ERP et le SIRH restent, le générique tombe. La règle de §28 fait exactement ce
qu'elle annonce.

**2.5** : `supprimee` disparaît de l'après, `inchangee` **et `en_cours`** gardent
leurs supports d'origine. L'invariant « en cours ne compte pas comme migré » est
mesuré, plus seulement écrit.

**2.6** : six outils, six valeurs attendues, six valeurs obtenues — Excel 6
blocs, Mail 5, Oral 5, Papier 5, Word 4, PowerPoint 2.

**2.1 — le déterminisme du schéma, promesse écrite jamais vérifiée.** Réussi, et
au-delà de la demande : deux calculs successifs donnent des sorties identiques,
**et un troisième avec les entrées présentées en ordre inverse donne encore la
même sortie**. C'est la forme forte de l'engagement de `schema-outils.ts` — le
placement ne dépend pas de l'ordre d'arrivée des données.

**3.9** : aller-retour JSON identique champ à champ.

### 43.3 Le seul défaut trouvé est dans la recette, pas dans le produit

**2.7** attendait `TV / écran atelier` dans le « Non classé » de
`template-use-case`. Cet outil **n'y existe pas** : l'unique étape qui le porte
appartient à `cible-mercateam`. L'attendu désignait le mauvais client.

Corrigé dans la recette. C'est instructif : **une liste de contrôle se vérifie
aussi elle-même à l'usage**, et un attendu faux aurait fait chercher un bug
inexistant à chaque passe.

### 43.4 Ce qui reste, et qui est maintenant débloqué

**La session navigateur est disponible** (`LOVABLE_BROWSER_AUTH_STATUS =
injected`) depuis que l'utilisateur s'est connecté à la préversion. Toute la
partie interactive devient exécutable : le point **1.4** — la garde de version
sur deux onglets, et son contrepoids, l'absence de faux conflit à un seul
onglet —, le glisser-déposer, l'édition de l'environnement IT, le déplacement
des boîtes du schéma.

Restent hors de portée d'un agent : ce qui demande un jugement visuel —
lisibilité à l'impression, estompage survivant au PDF et au PPTX, distinction
des quatre marques en noir et blanc.

---

## 44. Seconde passe — la garde tient à travers l'interface, et un défaut tombe

Sept points exécutés dans un navigateur authentifié, sur une copie jetable.
Base rendue à l'identique, vérifiée de mon côté : 5 clients, 31 processus,
411 étapes, 16 frictions, 11 chiffres, 20 instantanés.

### 44.1 Le point 1.4 est prouvé de bout en bout

Le point E avait été prouvé fonction par fonction en SQL. **Rien ne garantissait
que le refus se traduise en bandeau à l'écran** — avant le correctif de §34, les
mutations d'enfants tombaient dans un `toast.error` générique et le bandeau ne
s'affichait jamais.

**A1 :** deux onglets sur la même étape. L'onglet A écrit. L'onglet B, non
rechargé, est refusé, et le DOM porte le texte exact : *« Ce processus a été
modifié par quelqu'un d'autre. Rechargez pour voir la version à jour. »* En
base, la valeur de A survit ; aucune trace de l'écriture de B.

**A2 :** un seul onglet, quatre opérations enchaînées — deux étapes, ajout puis
suppression d'une friction. **Zéro conflit.** C'est la moitié qu'on oublie de
tester : une garde qui refuserait ici rendrait l'outil inutilisable à une
personne seule.

Les deux ensemble prouvent ce que ni l'une ni l'autre ne prouvait.

### 44.2 L'environnement IT, chemin vierge, tient

Aucun diagnostic ne portait de correction manuelle. Les trois gestes survivent
au rechargement. **« Recalculer » efface les corrections, conserve la structure
(76 lignes avant et après) et les positions manuelles**, avec un instantané
`avant_recalcul` par clic. Une boîte déplacée à `566/272` revient exactement à
`446.29/273.7` après « Replacer automatiquement ».

Ajoutent au tableau : les deux boutons d'ajout réparés livrent bien « À
préciser », et la création d'un site depuis la trame donne trois onglets
pré-remplis **sans maturité ni bilan**.

### 44.3 Le défaut, trouvé par accident pendant un autre contrôle

**Le bouton « Saisie rapide » ne se monte pas.** Sa cible
`.flux__entete .rangee` existe, mais aucun bouton n'apparaît dans le DOM, même
après bascule d'onglet et retour.

**La conséquence dépasse le confort.** La saisie rapide est **le seul endroit
d'où l'on peut écrire `etapes.cible`**. Si le bouton ne se monte pas, la cible —
livrée le 09/08 avec sa page imprimée — n'est atteignable par personne, et toute
cette fonctionnalité est inerte depuis sa livraison. Ce qui expliquerait qu'après
dix jours **aucune cible ne figure en base**.

Cause probable : l'effet de `BoutonSaisieRapide` ne tourne qu'au montage et lit
`previousElementSibling` pour trouver sa cible ; si le diagramme n'est pas encore
rendu, le portail ne se pose jamais. Le défaut serait donc **intermittent**, ce
qui est pire qu'une panne franche.

Consigné dans `RETOURS-USAGE.md`. **Non corrigé** : passe de constat.

### 44.4 Écart signalé par l'agent, et traité

Six instantanés de clients de test subsistaient — leur survie est précisément ce
que prouve le point 1.1, mais c'était du résidu. L'agent l'a **annoncé plutôt
que passé sous silence**, n'ayant pas l'accès en écriture pour les retirer. Fait
de mon côté ; `versions` revient à 20.

### 44.5 Reste à faire

**3.3** (pastilles de friction sur la bonne carte), **3.4** (libellés de
maturité, et absence de repli sans use case), **3.8** (glisser-déposer), et
**toute la section D** — dont **2.10**, la ligne de maturité de la page
« Avant / après », qui n'a toujours jamais été exercée.

---

## 45. Recette navigateur — fin de la première traversée

Troisième passe, sept points, tous réussis. **La recette est parcourue** pour ce
qui ne demande pas un œil humain — vingt-cinq contrôles au total sur trois
passes, dix-huit jours après la première ligne de code.

Base annoncée revenue à l'identique (5/31/411/16/11/20). **Je n'ai pas pu le
vérifier moi-même** : ma requête de contrôle a été refusée. C'est donc une
affirmation de l'agent, pas une mesure de ma part.

### 45.1 Les résultats

**3.3** — une seule pastille de friction, sur la bonne carte, relevé carte par
carte. **3.4** — libellé d'échelle affiché avec use case, **aucun libellé sans**
use case : pas de repli inventé. **3.8** — glisser-déposer sur un autre couloir
(`role` change) et sur une **frontière** (`role` + `role2`), vérifié en base.

**2.10 — le dernier chemin livré sans avoir jamais été exercé.**

```
Maturité : 2/5 à l'audit — Visibilité basique, pas de contrôle sur charge…
        → 4/5 au bilan — Anticipation des besoins, réduction mesurable…
```

Deux valeurs distinctes, libellés de l'échelle du use case. Le piège annoncé au
§39 — la page comparant la maturité d'audit avec elle-même et affichant
« 2 → 2 » — est évité.

**2.12** frictions résolues barrées (`line-through`, `opacity 0.65`) et
étiquetées, persistantes étiquetées. **2.9** aucune ligne « aucun outil » sur les
trois pages d'environnement IT.

**2.11 — mon seuil de 12 lignes cesse d'être une estimation.** 15 cibles dont
deux de ~300 caractères : découpage 12 + 3, numérotation `(1/2)` et `(2/2)`,
échelle **0,750**, hauteur de contenu 733 px pour une zone qui l'accepte. Le
calcul posé au §32.2 et traîné depuis comme « estimé, jamais mesuré » est juste.

### 45.2 La meilleure ligne du rapport n'était pas demandée

**2.8** est réussi — 0,750 sur les douze pages d'un diagnostic, sur les dix d'un
autre. Et l'agent ajoute de lui-même que **la boucle de convergence n'est jamais
sollicitée** : la largeur plafonne à 1200/1600 avant que la hauteur ne morde.

Donc le défaut **I** — l'échelle qui abandonne après 40 tours sans le dire —
reste **non observé**. Ni corrigé, ni infirmé : jamais atteint, faute de contenu
assez haut.

**Réussir un contrôle et avoir éprouvé le risque qu'il vise sont deux choses
différentes.** Un rapport qui ne fait pas cette distinction transforme un angle
mort en case cochée. Celui-ci la fait.

### 45.3 Ce que la traversée laisse ouvert

**Pour un œil humain**, sur un artefact produit et non un DOM : **2.2** et
**2.3** (l'estompage des outils répétés et sa légende survivent-ils au PDF puis
au PPTX ?), et **2.5 bis** (les quatre marques restent-elles distinctes en noir
et blanc ?).

**Un défaut ouvert**, trouvé par la recette elle-même : le bouton « Saisie
rapide » ne se monte pas (`RETOURS-USAGE.md` n° 2), ce qui rend `etapes.cible`
inatteignable depuis l'interface. Corrigé ensuite.

**Un angle mort nommé** : le défaut I, ci-dessus.

---

## 46. Le bouton qui n'avait jamais existé — 18/08/2026

Correction du seul défaut que la recette navigateur ait trouvé par elle-même
(`RETOURS-USAGE.md` n° 2). Commit Lovable `b2650b6`, un seul fichier,
une seule fonction : `BoutonSaisieRapide` dans `clients.$code.tsx`.

### 46.1 Mon hypothèse était fausse, et fausse dans le sens confortable

J'avais écrit dans le brief que le défaut devait être **intermittent** :
l'effet ne tourne qu'au montage (`[hote]`), donc si le diagramme n'est pas
encore rendu à cet instant, la cible reste `null`. J'ai même bâti tout un
raisonnement là-dessus — « pire qu'une panne franche, il a pu marcher une
fois sous les yeux de quelqu'un ».

La mesure DOM dit autre chose. Le conteneur `[data-diagram-slot]` a quatre
enfants dans cet ordre : le diagramme, le `div.contents` de
`PastillesFrictions`, celui de `MarquesBilan`, puis l'hôte du bouton. Donc
`hote.previousElementSibling` désignait **toujours** une enveloppe de portails,
**jamais** le diagramme. `querySelector(".flux__entete .rangee")` y renvoyait
`null` à tous les coups, quel que soit l'ordre de rendu.

Le défaut n'était pas intermittent : il était **total**. Ce bouton n'a jamais
fonctionné, pas une fois, depuis qu'il a été écrit.

Et ma mauvaise hypothèse était la confortable — elle laissait croire qu'il
avait marché parfois, donc que quelqu'un l'avait vu marcher. La bonne réponse
est plus dure : personne ne l'a jamais vu.

### 46.2 La preuve que la fonctionnalité était inerte

`etapes.cible` est livrée depuis le 09/08 avec sa page « Trajectoire de
déploiement » à l'impression. La saisie rapide est le **seul** endroit d'où on
peut l'écrire. Mesure en base : **0 cible sur 411 étapes**.

On avait mis ce zéro au compte du non-usage — c'est écrit tel quel dans
`FEUILLE-DE-ROUTE.md` §2b, « exercés par personne ». C'était faux. Ce n'était
pas du non-usage, c'était de l'**inatteignable**. Une fonctionnalité, sa
migration, sa saisie, sa page d'impression : trois envois, livrés justes, et
zéro chemin utilisateur pour y accéder.

**Un compteur à zéro admet deux lectures — « personne ne s'en sert » et
« personne ne peut s'en servir » — et on avait retenu la rassurante sans la
vérifier.**

### 46.3 Le même piège, déjà rencontré et déjà documenté

En relisant les voisins : `MarquesBilan` porte depuis sa naissance ce
commentaire —

> *Le parent, et non le frère précédent : `PastillesFrictions` s'intercale
> entre le diagramme et nous, et son enveloppe `display: contents` reste un
> élément dans l'arbre.*

Quelqu'un avait donc déjà buté sur exactement ce piège, l'avait compris, et
l'avait écrit noir sur blanc dans le fichier d'à côté. `PastillesFrictions`
marche parce qu'il est le **premier** après le diagramme — son frère précédent
est le bon par accident de position. `BoutonSaisieRapide` est le troisième, et
il est le seul des trois à n'avoir jamais reçu le traitement.

**Une leçon écrite dans un fichier ne protège pas le fichier d'à côté.** Le
commentaire de `MarquesBilan` était juste, présent, lisible — et sans effet sur
le composant situé douze lignes plus bas dans le même JSX.

### 46.4 La correction, et pourquoi elle ne boucle pas

```ts
const conteneur = hote.closest<HTMLElement>("[data-diagram-slot]");
const relever = () => {
  const trouvee = conteneur.querySelector<HTMLElement>(".flux__entete .rangee");
  setCible((avant) => (avant === trouvee ? avant : trouvee));
};
relever();
const obs = new MutationObserver(relever);
obs.observe(conteneur, { subtree: true, childList: true });
```

`closest` plutôt que `parentElement` : plus robuste que `MarquesBilan`, car
insensible à l'insertion d'un niveau d'enveloppe.

L'observateur est nécessaire, pas décoratif : le moteur réécrit tout le
balisage à chaque mutation, la `.rangee` d'origine est **détruite et
remplacée**. Sans nouvelle recherche, le portail se décrocherait au premier
glisser-déposer.

La réentrance est le vrai risque — poser le portail insère un nœud **dans** la
rangée observée. La garde est la comparaison de nœuds : au second tour on
retrouve la même rangée, `setCible` reçoit la même référence, React ne rend
pas, la chaîne s'arrête. Même patron que `PastillesFrictions`. Mesuré :
**0 mutation du slot au repos sur 5 s**.

### 46.5 Ce qui a été prouvé au navigateur, et non par lecture

Sur `test-06-08`, `tsgo --noEmit` à 0 erreur :

1. mode modifier → bouton présent, `parent: "rangee"` ;
2. bascule sur un autre processus → présent ;
3. retour → présent ;
4. modification d'un texte d'étape (reconstruction du balisage) → **survit** ;
5. 0 mutation au repos ;
6. clic → table ouverte, colonnes `N° · Rôle · Action relevée · Supports ·
   Cible · Ordre` ; en mode bilan la cellule **Cible est éditable** ; écriture
   `PREUVE-RECETTE-CIBLE` → **relue en base** ; remise à vide → `cibles = 0`.

Le point 6 est le seul qui compte vraiment : c'est **le chemin qui n'avait
jamais existé pour un utilisateur**, parcouru en entier pour la première fois.

### 46.6 Trois écarts que l'agent signale de lui-même

- **Pas de copie jetable**, contrairement à ma consigne : `read_query` est en
  lecture seule, l'`insert` a été refusé, et aucun outil ne permettrait de
  détruire la copie ensuite. Repli assumé sur `test-06-08` avec aller-retour à
  l'identique. Vérifié : aucun client `recette-saisie-rapide` en base.
- **`versions` 20 → 22.** Les écritures d'essai ont déclenché deux instantanés
  automatiques (`quotidien`, `avant_bilan`) sur `test-06-08`. Irrémédiable : il
  n'existe **aucune suppression d'instantané**, ni dans `PanneauVersions.tsx`,
  ni dans `src/lib/versions.ts`, ni par requête en lecture seule. La base n'est
  donc pas rendue *rigoureusement* à l'identique, et c'est dit plutôt que
  passé sous silence.
- **Piège pour la prochaine recette** : en mode bilan la cellule Cible est un
  `textarea`. `inner_text` y renvoie `''` même quand la valeur existe — il faut
  lire `value`. Ce n'est pas un défaut, c'est une manière de se tromper.

### 46.7 Vérification de mon côté

Contre le **diff**, pas contre le rapport : un seul fichier touché, une seule
fonction, aucune écriture ailleurs. `latest_commit_sha` = `b2650b6`.

Contre la **base**, ce jour : `cibles 0`, aucun client résiduel d'essai. Les
compteurs ont bougé depuis la mesure de l'agent — `clients 6, processus 39,
etapes 532, frictions 17, chiffres 12, versions 23` — mais l'écart s'explique
entièrement par un client réel créé à 13:12, **`danone-bailleul`** (8 use cases,
121 étapes), postérieur au commit de 11:54. Ce n'est pas une dérive de la
recette : c'est un audit qui commence.

**Réserve honnête** : je constate que le commit est le dernier du projet, pas
que le déploiement publié sur `mercaudit.lovable.app` l'ait embarqué. Si le
bouton n'apparaît pas côté utilisateur, c'est la première chose à regarder.

---

## 47. Le chiffre clé rejoint l'étape — 18/08/2026

Envoi 1 d'une fonctionnalité en trois temps : rendre modifiables depuis la
carte du diagramme les frictions, les chiffres clés et une note de travail de
l'étape. Aujourd'hui, la base seule. Commit Lovable `fef681a`.

### 47.1 Ce que la base gagne

**`chiffres.etape_id`**, copie exacte du modèle des frictions — je l'ai imposé
comme une copie, pas comme une inspiration :

```sql
foreign key (etape_id, processus_id) references etapes (id, processus_id)
  on delete set null (etape_id)
```

Deux garanties tiennent de cette forme, et d'aucune autre : l'étape désignée
**appartient forcément au même processus** (une clef simple ne le dirait pas),
et supprimer une étape **détache** le chiffre au lieu de l'emporter. Un chiffre
clé est un fait recueilli en entretien : il survit au redécoupage du flux.
L'index unique que cette clef composite exige, `etapes_id_processus_uniq`,
existait déjà.

**`etapes.note_interne`**, texte non nul par défaut vide. Le nom porte
l'interdit : cette note **n'apparaît jamais dans la restitution client**. C'est
délibéré — dans six mois, quelqu'un qui parcourt le schéma pour enrichir une
page d'impression doit lire la règle dans le nom de la colonne, pas dans un
document qu'il n'ouvrira pas. Un `comment on column` la redit en base.

Piège écarté au passage : `etapes.lien` ressemble à un champ libre mais est
contraint à `'' | 'manuel' | 'auto'` — c'est le type de liaison du diagramme.
Le recycler aurait cassé le tracé des flèches.

### 47.2 L'invariant, tenu pour la deuxième fois

Les deux champs entrent dans `client_json` **et** dans `importer_client_json`
**dans la même migration**. Ce n'est pas de la propreté, c'est la seule forme
qui ne perd pas de données : un instantané est pris automatiquement à
l'ouverture en édition, donc si `client_json` ignore un champ neuf, tout
instantané pris ensuite l'omet — et une restauration le jour même **l'efface
sans un mot**. C'est la règle posée au §31 pour les trois champs de bilan ;
c'est la deuxième fois qu'elle sert.

Détail de forme repris tel quel des frictions : le rattachement s'exporte par
**`ordre` d'étape**, jamais par identifiant — les identifiants changent à la
restauration. `importer_client_json` reconstruit la correspondance
ordre → nouvel id, et tolère l'absence dans les deux sens : une note absente
devient `''` et non `null`, une `etape` absente ou hors bornes donne un chiffre
transverse, « ce qui est un état normal ».

### 47.3 Un piège déjà payé, évité cette fois

`creer_chiffre` gagne un `p_etape` optionnel, pour qu'un chiffre créé depuis le
popup soit rattaché **dès l'insertion** : un chiffre qui existerait un instant
détaché resterait orphelin si le second geste échouait.

Changer sa signature obligeait à supprimer l'ancienne — garder les deux rendait
l'appel ambigu. Et **supprimer une fonction perd ses droits**. La migration
repose donc explicitement le `revoke … from public, anon` et le
`grant execute … to authenticated`. C'est exactement l'écueil du §29, où des
`revoke` écrits au motif du nom avaient manqué trois fonctions. Les quatre
autres fonctions passent par `create or replace`, qui conserve les droits.

### 47.4 Ce que mon brief avait oublié

`recopier`, dans `trame-use-case.ts`, recopie un processus de la trame vers un
site neuf. Il remet soigneusement en correspondance `frictions.etape_id` vers
les copies — et **ne passe pas `etape_id` aux chiffres**. La machinerie
nécessaire, `parOrdre` et `ordreDe`, est construite douze lignes plus haut pour
les frictions.

Mon brief nommait `client_json` et `importer_client_json`. Il ne nommait pas
`recopier`. L'agent a fait ce qui était demandé ; c'est la demande qui était
incomplète.

**Latent, pas actif** : mesuré, la trame porte 0 chiffre, donc rien n'a été
perdu. Mais c'est la fonctionnalité en cours de construction qui invite à en
saisir — le trou se serait ouvert juste après la livraison.

**La leçon est la même qu'au §46, un cran plus haut.** Là-bas, une règle écrite
dans un fichier n'avait pas protégé le fichier d'à côté. Ici, un invariant que
j'ai énoncé correctement — « tout chemin qui écrit ce champ doit le connaître »
— n'a couvert que les chemins que j'ai su nommer. **Énumérer les appelants est
un travail de lecture, pas de mémoire**, et je ne l'avais pas fait.

### 47.5 Vérification de mon côté

Contre la base, pas contre le rapport : colonnes, contrainte, index et
signatures relus dans le catalogue ; `maj_chiffre` vérifié sur le point qui
compte — `nullif(p_patch->>'etape_id','')::uuid` avec la clef présente écrit
bien `NULL`, donc **détacher est possible**, ce qu'un `coalesce` aurait
silencieusement interdit ; fragments de `client_json` et
`importer_client_json` relus ligne à ligne sur les chiffres et la note.

Compteurs `6|39|532|17|12|23`, identiques à ma mesure de référence. Aucun
client d'essai résiduel. Aucun composant React touché, comme le brief
l'exigeait.

**Conséquence assumée, notée ici pour ne pas la redécouvrir** : l'export JSON
d'un diagnostic contient les notes internes. C'est nécessaire — sans quoi une
restauration les effacerait — mais ce fichier n'est donc pas un artefact à
remettre à un client. Le livrable client reste le PDF et le PPTX, d'où la note
est absente.

---

## 48. Un seul propriétaire pour la surcouche des cartes — 18/08/2026

Envoi 2 : la correction que le §47.4 avait mise au jour, puis un refactor
préparatoire. Commit Lovable `e8b8e83`.

### 48.1 A — `recopier` transmet enfin le rattachement

Une ligne, celle qui manquait, avec la même remise en correspondance que les
frictions. Et surtout, l'exclusion de `note_interne` est passée d'accident à
décision : elle est maintenant **écrite dans l'en-tête de la fonction**, à côté
de la règle du bilan qu'elle prolonge.

> *Le bilan ne se recopie jamais : il appartient au diagnostic, pas à la trame.
> La note interne d'étape non plus : une note de travail de consultant relève
> de l'audit en cours, pas du modèle.*

**Un comportement juste par accident et un comportement juste par décision se
ressemblent jusqu'au jour où quelqu'un touche au code.** Le premier ne survit
pas à ce jour-là.

### 48.2 B — trois observateurs deviennent un

`PastillesFrictions` et `MarquesBilan` greffaient chacun leurs portails sur les
mêmes `.flux__carte[data-etape]`, **chacun avec son `MutationObserver`** sur le
même conteneur, donc deux gardes de réentrance concurrentes — et l'envoi 3
devait en ajouter une troisième.

Fondus en `SurcoucheCartes.tsx` : un observateur, une garde `memesNoeuds`, une
liste de cartes, toutes les surcouches posées dessus. `MarquesBilan.tsx` devient
un module de formes qui ne greffe plus rien. `BoutonSaisieRapide` reste à part —
son ancre est l'en-tête, pas la carte.

Le conteneur se résout par `closest("[data-diagram-slot]")`, le seul des trois
mécanismes qui ait résisté : `previousElementSibling` avait déjà coûté le défaut
du §46, `parentElement` marche mais casse à l'insertion d'un niveau d'enveloppe.

### 48.3 Ce que j'ai vérifié, et pourquoi c'était le bon point

Un refactor qui doit « ne rien changer » se vérifie sur **la condition
d'affichage**, pas sur le rendu — c'est là que l'équivalence se perd.

L'ancien code gatait depuis le parent :

```tsx
{modeBilan || marques.size ? <MarquesBilan marques={marques} edition={modeBilan} …/> : null}
```

Le nouveau l'internalise : `bilanActif = edition || marques.size > 0`. Les trois
cas coïncident. Y compris le nettoyage des classes, qui était le point le plus
fragile : quand `bilanActif` retombe, React exécute le nettoyage de la passe
précédente **avant** d'entrer dans le corps qui retourne aussitôt — les classes
`carte-bilan-*` sont donc bien retirées, là où un `if` mal placé les aurait
laissées collées.

Site d'impression relu séparément : `<SurcoucheCartes/>` sans `edition` donne
`bilanActif = marques.size > 0`, soit le gate d'origine au caractère près. Les
six exports utilisés ailleurs sont conservés — le résumé de l'agent n'en citait
que quatre, ce qui aurait suffi à m'inquiéter si je m'étais arrêté au résumé.

Base à la référence, et **`versions` n'a pas bougé** : l'agent a mené ses
mesures sans entrer en mode modifier, qui aurait déclenché un instantané. C'est
la première fois qu'une passe navigateur ne laisse aucune trace du tout.

### 48.4 Une preuve substituée, et pourquoi je l'ai refusée

L'agent a signalé — honnêtement, deux fois — que son test de bascule d'onglet
échouait, et l'a remplacé par une bascule en mode bilan.

Ce substitut ne vaut rien, et il faut voir pourquoi : passer de lecture à bilan
ne change ni `edition` sur le diagramme ni la liste d'étapes. **Le moteur ne
reconstruit donc rien.** Les cartes restent les mêmes nœuds, `memesNoeuds`
renvoie vrai, `cartes` n'est jamais réécrit — le test ne peut pas échouer, quoi
qu'on ait cassé. Il prouve que la surcouche s'affiche en mode bilan, pas qu'elle
survit à une reconstruction.

Ce qui reconstruit vraiment, c'est une **mutation du contenu** : modifier le
texte d'une étape en mode modifier passe par `appliquerMutation`, invalide la
requête, et la carte d'origine est détruite puis remplacée.

**Un test qui ne peut pas échouer n'est pas une preuve faible, c'en est
l'absence** — et il coûte plus cher qu'un trou déclaré, parce qu'il occupe la
case. Le risque réel est ici faible (même logique d'observateur, seule la
résolution du conteneur change), mais « faible » n'est pas « prouvé », et ce qui
se décrocherait part dans un PDF client. Refait en tête de l'envoi 3.

---

## 49. Le popup d'étape — 18/08/2026

Envoi 3 : la carte du diagramme devient la porte d'entrée de tout ce que
l'étape porte. Commit Lovable `af8061d`.

### 49.1 La preuve d'abord, et elle passe

La survie à une reconstruction, refusée au §48.4 parce que le test ne pouvait
pas échouer, a été refaite correctement : en mode modifier, modification du
texte d'une étape — ce qui passe par `appliquerMutation`, invalide la requête
et fait détruire puis remplacer les cartes. Pastilles et marques se reposent.
0 mutation du slot au repos.

### 49.2 Deux choses meilleures que ce que j'avais demandé

**La sûreté de l'impression est déduite, pas déclarée.** Je m'attendais à un
drapeau « mode impression ». L'agent a fait mieux : `interactif = onOuvrir !=
null`, et la vue d'impression ne passe simplement pas `onOuvrir`. Il n'y a donc
rien à penser à désactiver — l'absence du rappel EST la désactivation. Un
booléen se serait oublié un jour ; celui-ci ne peut pas.

**La flèche est passée en haut-droite**, là où je l'avais demandée en bas. Le
raisonnement de l'agent est meilleur que le mien : flèche et pastille
s'excluent — l'une n'apparaît que quand l'autre est absente — donc elles
peuvent partager le coin, et le problème des 27 px libres disparaît au lieu
d'être contourné.

**Et la mesure que j'avais exigée est dans le code, avec son calcul** : carte la
plus étroite 121 px, rail de bilan 88 px depuis `left: 6`, reste 27 px — moins
de deux cases du sélecteur. D'où le compteur composé dans la pastille plutôt
qu'un marqueur distinct. Une décision de placement qui cite son chiffre ne se
rediscutera pas de mémoire dans trois mois.

La géométrie est en outre factorisée dans une constante `PASTILLE` partagée par
le `span` et le `button` : les deux formes de la même marque **ne peuvent plus
diverger**, ce qui est la vraie garantie que l'écran et le papier resteront
d'accord.

### 49.3 Ce que j'ai relevé

**Un défaut réel : la création de friction est en deux écritures.**
`creer_friction` n'a pas de `p_etape`, contrairement à `creer_chiffre`. Le
popup crée donc, puis rattache. Deux écritures ne sont pas atomiques : si la
seconde échoue, il reste une friction **détachée** — l'utilisateur a demandé
« ajoute une friction à cette étape » et obtient une friction flottante.

Le plus instructif est que l'agent a écrit lui-même, deux fonctions plus haut,
la raison exacte pour laquelle c'est mauvais — *« un chiffre qui existerait un
instant détaché resterait orphelin si le second geste échouait »* — et l'a
signalé sans le corriger, faute d'avoir la fonction SQL sous la main.
**Un principe correctement énoncé ne s'applique pas tout seul à côté.** C'est
la troisième fois en deux jours que cette forme se présente (§46.3, §47.4).

**Un trou que le rapport ne voyait qu'à moitié.** L'agent signale que le
compteur composé ne s'affiche pas à l'impression. Le trou est plus large :
`affordance = edition || modeBilan`, donc une carte portant **uniquement** des
chiffres ne rend rien du tout **en mode lecture** non plus. Le segment n'existe
que si la carte porte aussi une friction.

Décision de l'utilisateur : le signal se voit **à l'écran dans tous les modes,
lecture comprise ; l'impression ne change pas**. Asymétrie assumée, donc à
écrire dans le composant — sinon quelqu'un la « réparera » en croyant corriger
un oubli.

**Un commentaire qui réécrit l'histoire.** Celui de `BoutonSaisieRapide` dit
désormais que `SurcoucheCartes` s'intercalait, avec un « l'un d'eux » resté au
pluriel. Au moment du défaut, `SurcoucheCartes` n'existait pas. Dans un code où
les commentaires tiennent lieu de mémoire, **un commentaire faux coûte plus
cher qu'un commentaire absent** : le second fait chercher, le premier fait
conclure.

### 49.4 Une troncature, et ce qu'elle dit du terrain

L'agent a vidé `clients.$code.tsx` avec un `sed` mal échappé, l'a restauré
depuis git, et l'a dit. J'ai relu le fichier entier : `PageDiagnostic`,
`SectionProcessus`, `BoutonSaisieRapide`, toutes les mutations, toutes les
boîtes de dialogue. Rien ne manque.

C'est exactement l'accident que je m'étais infligé le 17 sur
`RECETTE-NAVIGATEUR.md`. Deux fois en deux jours, sur des outils différents,
par la même cause : une écriture en flux sur un fichier qu'on n'a pas relu
juste avant. La leçon n'est pas « faire attention » — c'est que **git est le
seul filet, et qu'il n'a fonctionné ici que parce que le fichier était déjà
suivi.**

### 49.5 État

Base à la référence `6|39|532|17|12|23`, aucune donnée d'essai résiduelle,
**aucun instantané créé** — deuxième passe navigateur consécutive sans trace.

---

## 50. Les quatre retouches, et la première note interne — 18/08/2026

Correctif de l'envoi 3. Commit Lovable `6dd1518`. Les quatre points sont
faits, et vérifiés contre le catalogue et le diff.

### 50.1 `creer_friction` rejoint `creer_chiffre`

L'asymétrie est levée : `p_etape uuid default null`, ancienne signature à cinq
arguments supprimée, `revoke` de `public` et `anon`, `grant` à `authenticated`
et `service_role` **reposés explicitement**. Vérifié dans le catalogue : les
sept fonctions gardées portent désormais exactement le même jeu de droits —
`postgres`, `authenticated`, `service_role`, et rien d'autre. Pas de dérive.

`ajouterFriction` redevient **une seule écriture**. La friction flottante n'est
plus atteignable.

### 50.2 La règle qui manquait, écrite comme une règle

Le correctif ne se contente pas de rendre le compteur visible en lecture : il
énonce le principe dont l'absence avait produit le trou.

> *La présence d'un contenu se signale TOUJOURS à l'écran ; seule l'invitation
> à en ajouter est réservée à l'édition.*

D'où deux conditions désormais **distinctes** là où il n'y en avait qu'une :
`marqueurChiffres` est indépendant d'`affordance`, `fleche` ne l'est pas. Le
défaut venait de ce que « il y a quelque chose ici » et « tu peux en ajouter »
partageaient un seul booléen — deux idées différentes portées par une seule
variable finissent toujours par se contredire quelque part.

L'asymétrie écran/impression est écrite en tête du composant, avec sa raison
(un « 2 » muet sur une carte imprimée poserait une question sans réponse en
salle) et l'interdit explicite : *ne « corrigez » pas l'asymétrie*. Sans cette
dernière phrase, quelqu'un la réparerait de bonne foi.

### 50.3 Le commentaire remis d'aplomb

Réécrit au passé, nommant les vrais responsables — `PastillesFrictions` et
`MarquesBilan` — puis notant que leur fusion n'a laissé qu'une enveloppe, ce
qui ne change rien à la leçon puisque `closest` résiste quel qu'en soit le
nombre. L'histoire est de nouveau vraie, et la leçon survit à ce qui l'a
rendue caduque.

### 50.4 La première note interne de l'application

Base à la référence sur tous les compteurs suivis — `6|39|532|17|12|23`,
`supports` de l'étape d'essai remis à `Excel`, aucune friction ni aucun chiffre
d'essai — **sauf une** : une `note_interne` valant `ok`, sur
`sekurit-float-france / onboarding`, étape 1.

Ce n'est pas un résidu d'agent : les preuves de cet envoi et du précédent ont
toutes été menées sur `test-06-08`, et Sekurit n'a servi qu'à des mesures en
lecture. Selon toute vraisemblance, **c'est l'utilisateur qui a essayé le champ
lui-même dans la préversion.**

C'est donc la première écriture humaine dans un champ livré ce jour-là. À
comparer avec `etapes.cible`, livrée le 09/08 et restée à zéro pendant dix
jours parce que son seul point d'entrée ne se montait pas (§46). Ici, le trajet
existe et il a été emprunté dans l'heure. **Un « ok » vaut mieux qu'un compteur
à zéro qu'on interprète.**

### 50.5 Ce que la série laisse ouvert

- La visibilité des chiffres à l'impression : **écartée sciemment**, pas
  oubliée. La décision est écrite dans le composant.
- L'état de bilan des frictions reste au panneau du bas : périmètre assumé de
  l'envoi 3.
- Les trois points de recette qui demandent un œil humain (§45.3) : **2.2**,
  **2.3** et **2.5 bis**, sur artefact produit — et il faudrait maintenant y
  ajouter que la pastille imprimée doit rester identique après cette série.

---

## 51. Les quatre retours d'usage — 19/08/2026

Premier envoi de la deuxième série de retours (`RETOURS-USAGE.md` n° 4, 5, 7,
8). Commit Lovable `43dceaa`. Tout est dans notre code, `src/flux/` intouché.

### 51.1 Ce que l'agent a vu et que je n'avais pas nommé

Replier les lignes vides de l'environnement IT paraissait anodin. Mais `outils`
et `repetes` — les boîtes du schéma d'échanges et le marquage des outils
partagés — se calculaient sur la liste **affichée**. Replier aurait donc
**retiré des boîtes du schéma**, et le défaut aurait été très difficile à
relier à un réglage d'affichage.

L'agent l'a vu seul et a basculé les deux calculs sur `vue.domaines`, la vue
complète, avec le commentaire qui l'explique. **Un réglage d'affichage qui
alimente un calcul cesse d'être un réglage d'affichage** — c'est la forme
générale du piège, et elle vaut d'être retenue.

### 51.2 Le couloir « vide » expliqué

Le retour n° 5 disait : « je ne peux pas supprimer un rôle vide car il est
utilisé dans un autre UC ». La seconde moitié est impossible — `processus.roles`
appartient au processus.

La cause réelle, trouvée par l'agent puis confirmée en base : une étape
rattachée en **`role2`** est dessinée depuis son couloir principal et s'étend
jusqu'au second. **Le couloir secondaire paraît donc inoccupé alors qu'une
étape s'y réfère.** Trois étapes de `decathlon-thiais` sont dans ce cas.

Le message nomme désormais l'étape — numéro, extrait de texte, mention
« (couloir secondaire) », et le nombre d'autres. Le garde n'a pas changé ; il a
cessé d'être muet.

### 51.3 Deux corrections demandées en retour

**`window.prompt` pour nommer une activité.** Une consigne debout depuis le 17
dit que tous les dialogues de création suivent la charte du site. Une boîte
native — grise, non stylée, dans la langue du système — est précisément ce que
cette consigne visait. Et elle est **intraduisible**, à trois jours d'une
bascule FR/EN.

**« Ranger » ne déplace que `l.outils[0]`** alors que le contrôle s'affiche dès
qu'une ligne porte au moins un outil. Sur une ligne à plusieurs outils, les
suivants restent en place **sans message**. Le défaut n'est pas de traiter un
élément, c'est de n'en rien dire.

### 51.4 Une preuve que je n'ai pas acceptée, pour une raison technique

L'agent n'a eu **aucune session navigateur** ce tour
(`LOVABLE_BROWSER_AUTH_STATUS=signed_out`) et l'a déclaré plutôt que de
l'habiller. Quatre comportements sont donc livrés sans avoir jamais été vus :
le repli, le contrôle « Ranger », le nouveau message de refus, et l'effet sur
l'impression.

Son raisonnement sur l'impression — « le mode lecture affichait déjà un `span`
qui passe à la ligne, donc l'échelle ne bouge pas » — **est incomplet, et d'un
détail qui décide** : il a ajouté `min-w-0` à un enfant `flex-1`. Sans cette
classe, un élément flexible refuse de descendre sous la largeur de son contenu ;
avec elle, il s'enroule. L'enroulement en lecture peut donc être **nouveau**,
auquel cas la colonne d'annexes s'allonge et l'échelle de toutes les pages de
processus baisse — silencieusement, comme le §32 l'avait déjà décrit.

**Un raisonnement juste sur trois lignes et faux sur la quatrième donne une
conclusion fausse**, et il se relit mieux qu'une mesure absente. Mesure
demandée dès que la session sera disponible, sur `decathlon-thiais` (13 chiffres
clés), avec les deux séries de chiffres et non une conclusion.

### 51.5 La référence de base est périmée

`6|39|532|17|12|23` ne vaut plus. L'état est `8|43|573|48|25|25`, et l'écart
est **entièrement du travail réel** : `decathlon-thiais` créé le 19/08 à 12:52
(4 processus, 41 étapes, 31 frictions, 13 chiffres) et `decathlon`, une coquille
vide créée à 12:15.

Vérifié client par client avant de conclure — l'agent affirmait n'avoir fait
aucune écriture, et c'est exact.

**Nouvelle référence : `8|43|573|48|25|25`.** Continuer à réclamer l'ancienne
aurait fait passer chaque rapport à venir pour un écart, et un écart qu'on
s'habitue à voir cesse d'alerter.

Signal d'usage, au passage : 32 frictions sur 48 sont rattachées à une étape,
contre 2 sur 17 avant-hier. Le rattachement, lui, a trouvé son public. Les
chiffres rattachés restent à 0 — le geste n'existe que depuis hier soir.

---

## 52. Le gros envoi : cinq sujets — 19/08/2026

Commit Lovable `aa4c1e9`. Quatre sujets livrés, le cinquième (passe navigateur)
toujours bloqué par l'absence de session.

### 52.1 Le défaut le mieux trouvé du projet

« Je n'arrive pas à créer un nouvel outil. » Deux chemins possibles, et l'agent
a mesuré au lieu de choisir : seul celui du diagramme inscrit l'outil dans
`clients.outils`, et il passait par `window.prompt`.

**La préversion s'affiche dans une iframe sandboxée, où `prompt()` est ignoré
sans le moindre message.** L'appel rend `null`, le nom est vide, rien n'est
écrit. Silencieux de bout en bout.

J'avais signalé ce `window.prompt` **deux fois**, les deux fois sur des motifs
de charte graphique et de traduisibilité. Il était **cassé**, et je ne l'avais
pas vu. Un défaut d'apparence peut cacher un défaut de fonctionnement, et
l'argument esthétique avait occupé la place de la question « est-ce que ça
marche ? ».

### 52.2 Une hypothèse à moi, réfutée par la mesure

Pour « la croix renvoie en bas de page », j'avais donné la cause classique :
un `<button>` sans `type="button"` se comporte en bouton d'envoi.

Mesure de l'agent : **il n'y a aucun `<form>` dans `src/`**. Sans formulaire,
un bouton sans type n'envoie rien. Hypothèse écartée.

L'agent a posé `type="button"` quand même (16 boutons du moteur), ce qui est
juste par principe, et ajouté une **garde du défilement vertical** — cause
plausible, le balisage étant remplacé en entier et la page perdant sa hauteur
le temps d'une image. Et il l'a dit : *« correction plausible, pas correction
vérifiée »*. C'est la bonne conduite ; le point reste ouvert jusqu'à la session.

### 52.3 Les couleurs, corrigées par le bon mécanisme

`badgeDerive(nom, outils)` prend la teinte à la **position dans la liste des
outils du site** — que le moteur recevait déjà. L'empreinte n'est plus que le
repli du repli.

Vérifié par moi, en exécutant le moteur sur les **onze outils réels** de
`decathlon-thiais` : 0 collision, et `EFIplan` / `Effitime` enfin séparés.

**Réserve que je signale** : `PALETTE_OUTILS` compte toujours **12 teintes**
pour 9 outils à colorer sur ce site — il reste trois places avant enroulement.
La garantie tient « tant que le site compte moins d'outils que la palette », ce
que l'agent a écrit honnêtement. À porter à 20, comme `PASTELS`.

### 52.4 Les rôles : le problème était arithmétique

Mesuré avant d'écrire le brief : `danone-bailleul` porte **20 rôles distincts**,
`sekurit-float-france` 17, pour **8 pastels**. `paletteStable` répartit par
empreinte puis « repart d'un tour » — chaque teinte servait donc deux ou trois
fois. Un sélecteur seul n'aurait rien réglé.

`PASTELS` passe à 20 paires, choix manuel enregistré dans
`clients.si.couleurs_roles` (nom → index).

**Et le point d'architecture a tenu** : `paletteStable` ne passe pas au moteur
une liste de rôles mais une *palette de places*. Honorer un choix manuel revient
donc à poser le rôle à un index congru à la pastille voulue — **aucune ligne de
la logique du moteur n'a changé**, et aucune carte de surcharge ne le traverse.
Sans cette lecture préalable, l'agent aurait plombé trois copies du moteur pour
rien.

**Migration confirmée inutile**, vérifié plutôt que supposé : `client_json`
exporte `'si'` entier et l'import le réinjecte entier. Le champ voyage seul.

### 52.5 Deux écarts déclarés, et un que j'ajoute

- **Repeinte assumée** : 20 pastilles changent `empreinte % PASTELS.length`,
  donc les rôles de tous les diagnostics existants changent de teinte.
- **La vue d'impression n'honore pas les choix manuels** — elle appelle
  `paletteStable` sans `couleurs_roles`. Un rôle recoloré à la main sortira à sa
  teinte automatique. Écart réel entre l'écran et le PDF, laissé de côté avec le
  module d'export.
- **Le mien** : dans `EnvironnementIT`, `Badge` appelle `badgeSupport(nom)`
  **sans `outils`**. Latent seulement — `outilAvecLogo` n'y rend vrai que pour
  les familles connues, donc `badgeDerive` n'y est jamais atteint — mais la
  divergence est armée pour le jour où cette condition changera.

### 52.6 J'ai failli accuser l'agent à tort

Ma première lecture de `src/flux/moteur.js` a rendu **la version d'avant** :
8 pastels, `badgeDerive` sans argument. J'ai cru un instant que le rapport était
inventé sur ce point.

En relisant **en forçant le commit** (`ref: aa4c1e9`), tout y était.

**Règle pour moi : vérifier un commit sans le nommer ne vérifie rien.** Le
mécanisme de lecture peut servir un état antérieur, et l'erreur produite est de
la pire espèce — elle accuse quelqu'un d'avoir menti.

### 52.7 Portage, et son résultat

`flux/moteur.js`, `flux/moteur.d.ts` et `diagnostic-os.html` portés. Le mono-
fichier a demandé un ajustement que le test seul a révélé :
`bandeauSupportsEdition` recevait bien `outils` mais ne le transmettait pas à
`badgeSupport` — l'écart se voyait sur `Kronos / Cronos`, `#1E3A8A` (empreinte)
contre `#9F1239` (position).

`moteur.test.mjs` et `mutations.test.mjs` repassent : **balisage identique au
caractère près** entre les trois copies. C'est ce test, et lui seul, qui a
attrapé l'oubli.

**Reste à porter** : `flux/DiagrammeFlux.tsx`, qui n'a pas encore la propriété
`demanderNomOutil` ni le nouveau `surChangement`. Aucun test ne le couvre —
c'est un miroir de documentation, et je le signale plutôt que de le laisser
dériver en silence.

## 53. La bascule FR / EN, en deux envois — 20/08/2026

Deux envois, deux commits : `476c713` pour l'interface, `88d59f2` pour le
contenu saisi. Le second répond au revirement de l'utilisateur — « tout le texte
visible sur la plateforme doit être traduit », y compris le relevé.

### 53.1 L'architecture, telle qu'elle est réellement

- **L'interface** est du code : `src/lib/langue.ts` type le dictionnaire à
  partir du français, si bien que l'anglais doit le remplir en entier ; les mots
  vivent dans `src/lib/mots/*`. Pas de bibliothèque d'i18n.
- **Le moteur** reçoit ses mots : `MOTS_EN` s'ajoute à côté de `MOTS_FR`, la
  route passe `mots={motsFlux(langue)}`. Aucune fonction du moteur ne change.
- **Le contenu** est traduit par un appel modèle, **un seul par diagnostic**,
  à température nulle, puis mis en cache dans `clients.si.traductions`, indexé
  **sur le texte source** et non sur l'identifiant de ligne.
- **Le classement des outils n'a pas bougé** : `src/lib/environnement-it.ts`
  n'est touché par aucun des deux commits. `TABLE_A` et la trame restent en
  français canonique, `libelleIT` n'habille qu'au rendu.

### 53.2 Ce que la base dit

Relevé après les deux envois : `8 | 43 | 573 | 48 | 25`, inchangé. Les deux
`versions` supplémentaires (25 → 27) sont deux instantanés `quotidien` sur
`sekurit-float-france`, du 19 à 16h48 et du 20 à 8h01 : quelqu'un a ouvert le
diagnostic en édition. **Le relevé n'a pas été réécrit.**

En revanche `clients.si` porte désormais une troisième clef, `traductions`, et
`sekurit-float-france` en compte **146 entrées, toutes automatiques**. Donc :
la bascule vers l'anglais **écrit** — un cache, pas du contenu, mais une
écriture tout de même, déclenchée par un geste d'affichage. C'est un fait à
tenir, pas un détail : une lecture seule peut faire avancer `clients.version`.

### 53.3 Le défaut : en anglais, tous les couloirs prennent la même teinte

`SectionProcessus` passe au diagramme des rôles **traduits** et une palette
restée **française**. Et `couleursRole` ne signale pas l'absence :

```js
const i = Math.max(0, (paletteRoles || []).indexOf(role));
```

Un rôle introuvable prend la **place 0**. Pas d'erreur, pas de repli visible :
la teinte est simplement fausse. Mesuré sur les rôles réels du site :

```
FR : #D4DEF9 #D4F3E9 #DBEEFA #DEF3CC   → 4 teintes
EN : #D4DEF9 #D4DEF9 #D4DEF9 #D4DEF9   → 1 teinte
```

Le garde-fou censé l'éviter ne fait rien :

```ts
const place = processus.roles.indexOf(nom);   // vaut toujours `i`
reordonnee[place] = palette[i] ?? palette[0]; // donc : reordonnee[i] = palette[i]
```

**Leçon.** Un repli silencieux transforme une erreur de clef en erreur
d'affichage. Partout où une fonction fait `Math.max(0, indexOf(...))`, changer
la nature des clefs qu'on lui passe est un changement de contrat — et il ne se
verra ni au type, ni au test, ni à la compilation. Seule la mesure le montre.

### 53.4 Le bilan restait en français

`traduireVue = mode === "lecture"` laissait le diagramme français en mode bilan
— l'écran qu'on projette au client en fin d'audit, c'est-à-dire exactement là où
l'anglais sert. La justification donnée (« en édition le moteur reçoit le
français ») ne couvrait pas ce mode : en bilan `edition` vaut `false`. Mesure
de ce que le moteur émet dans cet état :

```
textarea : 0 · contenteditable : 0 · data-action : zoom-ajuster (seul)
```

Aucune surface d'écriture. La ligne de partage n'est pas *lecture / le reste*,
elle est **édition / non-édition**.

### 53.5 Ce qui est bien tenu, et mérite d'être dit

- `ChampEnPlace` compare le brouillon à **la valeur affichée à la prise de
  focus**, mémorisée dans un `ref`. Entrer et sortir d'un champ traduit n'écrit
  donc rien. C'était l'exigence non négociable du brief : elle est structurelle,
  pas conditionnelle.
- Les `<option value>` des sélecteurs de rôle, le brouillon de renommage, les
  noms de blocs et d'activités en édition restent **la clef française**. Aucun
  chemin d'écriture ne voit une chaîne traduite.
- Les composants qui appellent `useTr` hors du fournisseur — la vue
  d'impression — retombent sur l'identité : le contexte a une valeur par défaut.

### 53.6 Deux conséquences assumées, à confirmer par l'utilisateur

- **Écrire en anglais remplace la source française.** Le champ écrit ce qui est
  tapé et oublie la traduction de l'ancien texte. Le relevé de terrain perd
  alors son français, définitivement. C'est écrit en commentaire comme une
  décision ; ça reste une décision de l'utilisateur, pas de l'agent.
- **Le bandeau de conflit peut apparaître en lecture seule**, parce que
  l'écriture du cache passe par le même `patchClient` gardé par
  `clients.version`.

### 53.7 Portage

Rien à faire dans `diagnostic-os.html` : le mono-fichier est l'**original de
référence** du test, il garde ses libellés français en dur, et `MOTS_EN` est un
export inutilisé par le balisage par défaut. Portés dans le dépôt :
`flux/moteur.js` (le dictionnaire) et `flux/moteur.d.ts` (une ligne).

`moteur.test.mjs` et `mutations.test.mjs` repassent — **balisage identique au
caractère près**.
