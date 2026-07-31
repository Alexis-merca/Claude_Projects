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

### 1.4 La synthèse n'existe nulle part

`Synthese.tsx` et `lib/synthese.ts` sont présents mais ne sont importés par
aucune des trois routes. La vue d'impression enchaîne : une page par processus,
puis Environnement IT (blocs), puis Environnement IT (schéma). **Pas de page
synthèse.** Les points `M1` à `M8` sont absents à l'écran comme au PDF.

### 1.5 Aucun import JSON

L'export existe (`exporter`, un `Blob` téléchargé), l'import non. Un JSON
exporté ne peut pas être réinjecté. Points `B8` à `B12` absents.

### 1.6 Les rôles ne se réordonnent pas

`roles-processus.ts` expose `ajouterRole`, `renommerRole`, `supprimerRole`.
Rien pour monter ou descendre un couloir : `H19` et `H20` absents. L'ordre des
couloirs commande la lisibilité du diagramme.

### 1.7 Un processus peut se retrouver sans aucun rôle

`ajouterProcessus` crée avec `roles: []`, et `supprimerRole` ne refuse pas le
dernier. Le mono-fichier refusait, en invitant à renommer plutôt qu'à
supprimer (`H22`).

### 1.8 Un nom de rôle contenant une virgule casse la suppression

```
.or(`role.eq.${nom},role2.eq.${nom}`)
```

Le libellé est interpolé tel quel dans un filtre PostgREST, dont la virgule est
le séparateur. Un rôle nommé `Chef d'équipe, adjoint` — plausible — produit un
filtre malformé ou différent de celui voulu. Le contrôle « ce rôle est encore
utilisé » peut alors répondre à côté et laisser supprimer un rôle qui porte des
étapes.

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
départ. Le cycle par clic était demandé, mais pas au prix de la sélection.

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
