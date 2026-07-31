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
