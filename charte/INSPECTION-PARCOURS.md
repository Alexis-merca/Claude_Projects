# Inspection du parcours utilisateur — 07/08/2026

Confrontation des onze points du parcours attendu au code réel et à la base.
Lecture de : `clients.index.tsx`, `clients.$code.tsx`, `impression.$code.tsx`,
`trame-use-case.ts`, `trame-cible.ts`, `bilan.ts`, `environnement-it.ts`,
`EnvironnementIT.tsx`, `SchemaEchanges.tsx`, `schema-outils.ts`,
`MarquesBilan.tsx`, `DiagrammeAvecZoom.tsx`, `export-pptx.ts`, `maturite.ts`,
`router.tsx`, `auth.tsx`, et le catalogue PostgreSQL.

**Aucune vérification navigateur.** Voir `RECETTE-NAVIGATEUR.md`.

---

## Tableau de bord

| # | Attendu | État |
|---|---|---|
| 1 | Créer un site, choisir les use cases audités | **Sain** |
| 2 | Copie depuis `template-use-case` | **Sain** |
| 3 | Éditer 100 % des infos | **Sain, deux angles morts** |
| 4 | Zoom/scroll non réinitialisés | **Zoom sain, scroll absent** |
| 5 | Environnement IT auto et éditable | **Sain, un défaut de conception** |
| 6 | Export slides de l'audit | **Sain, deux réserves** |
| 7 | Mode bilan | **Deux tiers manquants** |
| 8 | Cible finale sous chaque étape | **Absent** |
| 9 | Vue avant/après lisible | **Partiel** |
| 10 | L'IT remplace / ajoute Mercateam | **Sain depuis le 07/08** |
| 11 | Export slides du bilan | **Partiel** |

---

## Ce qui est sain

### 1 & 2 — création et pré-remplissage

Le dialogue « Nouveau client » affiche les dix use cases avec intitulé,
périmètre et note de méthode ; les cochés deviennent des processus par
`creerUseCases` → `recopier` (étapes, frictions, chiffres, avec remise en
correspondance de `etape_id` sur les copies). Le rattachement passe
**uniquement** par `processus.use_case`, jamais par le nom.

Trois précautions qui tiennent :
- le bilan et la maturité ne sont **jamais** recopiés — ils appartiennent au
  site, pas à la trame ;
- si la trame est absente ou muette sur un use case, le processus est créé
  quand même, vide, avec sa clef et son intitulé ;
- l'unicité de la trame est garantie en base (`clients_trame_unique`).

### 3 — édition

Diagramme, rôles, étapes, supports, frictions, chiffres, maturités, en-tête du
client : tout est éditable. Les couloirs sont bien traités — le renommage se
propage aux étapes et frictions, la suppression est refusée tant qu'une étape
s'y réfère.

Le versionnement est **solide** : instantané quotidien à l'ouverture en
édition (idempotent), avant la première écriture de bilan, avant un recalcul de
l'environnement IT, avant la suppression d'un processus, avant une injection,
avant une restauration. La restauration est donc elle-même annulable.

### 10 — Mercateam remplace ou s'ajoute

Corrigé le 07/08. Une étape passée sous Mercateam garde ses systèmes de
référence (ERP, SIRH, GTA, GED) et prend `Mercateam` en tête ; le générique et
l'inconnu disparaissent. Mesuré : 7 outils au lieu de 1 sur la trame.

### 9 — la partie lisible de l'avant/après

`MarquesBilan` est bien conçu : la marque ne repose **jamais sur la couleur
seule** — barré, contour et étiquette écrite — parce que ces pages s'impriment
parfois en noir et blanc. Le bandeau se pose en bas de carte pour ne pas
recouvrir la pastille de friction, qui occupe le coin haut-droit. Légende
affichée dès qu'une étape porte une marque.

---

## Ce qui ne l'est pas

### A. Le mode bilan est au tiers de ce qui est demandé (point 7)

`etapes_bilan_check` n'autorise que `mercateam | inchangee | supprimee`.

- **« En cours de passage sous Mercateam » n'existe pas.** Il n'y a pas de
  quatrième état. Or c'est justement celui qui permet de *suivre* un
  déploiement plutôt que de le constater fini.
- **L'état des frictions n'existe pas du tout.** La table `frictions` porte
  `id, processus_id, rang, role, texte, etape_id` — aucune colonne d'état. Rien
  en base, rien dans l'interface. « Dire quelles frictions ne sont plus
  d'actualité » n'est aujourd'hui pas possible.

Seule la maturité de bilan est en place (`maturite_bilan`,
`maturite_bilan_note`).

### B. La cible par étape n'existe pas (point 8)

`etapes` porte `ordre, role, role2, texte, phase, supports, lien, bilan`.
Aucun champ ne peut recevoir une cible finale. Le point 8 est entièrement à
construire — et c'est lui qui donnerait son sens au quatrième état « en cours ».

### C. Le code couleur des frictions corrigées est impossible (point 9)

Conséquence directe de A : sans état sur la friction, rien à colorer. Le point
9 demande aussi un **logo Mercateam** sur les étapes passées ; aujourd'hui
l'étiquette est le mot « Mercateam » sur fond encre. Lisible, mais ce n'est pas
ce qui est demandé, et un logo se reconnaît plus vite qu'un mot.

### D. La projection « après » hérite des corrections de l'« avant » (point 5)

Défaut de conception, pas une broutille. Les deux blocs `EnvironnementIT`
reçoivent **le même `client.si`** :

```tsx
<EnvironnementIT parProcessus={parProcessus} si={client.si} titre="Aujourd'hui" />
<EnvironnementIT parProcessus={apresBilan}   si={client.si} titre="Après déploiement" />
```

Les corrections sont clefées `outil|bloc` sans notion d'avant/après. Donc un
outil masqué à la main dans l'état des lieux est **aussi masqué** dans la
projection ; un outil ajouté à la main apparaît dans l'« après » même si le
déploiement le fait disparaître. La projection n'est pas indépendante du
relevé, alors qu'elle prétend l'être.

### E. Deux consultants sur la même étape s'écrasent en silence

`db/README.md` promet que rien ne se perd en silence. C'est vrai pour les
écritures sur `clients` et `processus`, gardées par `... WHERE version = $2`.
**Ce n'est pas vrai pour les enfants.** `updateEtape(id, patch)`,
`updateFriction`, `updateChiffre` n'ont pas de paramètre de version : ils
écrivent sans garde. Le trigger fait bien avancer la version du processus, mais
**personne ne la lit avant d'écrire une étape**.

Conséquence : deux consultants qui modifient la même étape — le cas le plus
fréquent à deux sur site — produisent un « dernier écrivain gagne », sans
bandeau de conflit. La détection `estConflitDeVersion` n'est d'ailleurs câblée
que sur `patchClient`, `patchProcessus`, `majRoles` et `ecrireBilan` ; les
mutations d'étapes, frictions et chiffres tombent dans un `toast.error`
générique.

### F. Le défilement n'est pas mémorisé (point 4) — **RÉSOLU le 18/08**

Le **zoom** est traité correctement : il appartient à la page, dans une `Map`
par processus qui survit au démontage de l'onglet par Radix — le commentaire de
`DiagrammeAvecZoom` documente le bug précédent (l'ancien rattrapage lisait le
curseur une image après sa remise à 100 %).

Le **défilement**, lui, n'est géré nulle part. Le moteur reconstruit le
balisage à chaque mutation ; rien ne mémorise ni ne restaure la position
horizontale. Sur un diagramme large, chaque édition ramène vraisemblablement la
vue au début. À confirmer au navigateur, mais aucun code ne s'en occupe.

Second point : le zoom vit dans un `useRef` — **perdu au rechargement**.

> **Résolu** (`0b6b774`, `PASSE-STATIQUE.md` §37), confirmé par l'utilisateur
> dans le navigateur. La cause réelle, mesurée, n'était pas celle supposée ici :
> le moteur ne remet pas le zoom à 100 %, il produit un balisage neuf où
> `.flux-defile` est **remplacé** et `.flux` naît à `zoom:1`. Une seule cause
> pour les deux symptômes. Correction dans l'enveloppe React : mémorisation
> continue en capture sur l'hôte, restauration avant peinture. Le zoom est en
> plus mémorisé par processus dans `sessionStorage`, ce qui clôt ce second
> point.

### G. L'export du bilan ne compare pas le site à lui-même (point 11)

La vue d'impression produit : une page par processus (avec les marques de
bilan), une page « Cible de référence Mercateam » par use case, l'environnement
IT « Aujourd'hui », l'environnement IT « Après déploiement », et les échanges.

Mais la page « Cible de référence » compare le relevé à **la trame générique**,
pas au bilan du site. **Aucune page ne confronte le relevé du site à son propre
bilan**, processus par processus. La fonction existe pourtant :
`synthese(comparaison, "bilan")` dans `trame-cible.ts` — écrite, jamais appelée
depuis l'impression.

### H. Deux gardes divergentes pour le même bloc

À l'écran, l'environnement IT « Après déploiement » s'affiche si
`maturite_bilan` est posée **ou** si une étape porte une marque. À
l'impression, seulement si une étape porte une marque.

Un diagnostic où seule la maturité de bilan est renseignée affiche donc à
l'écran un bloc « Après déploiement » **rigoureusement identique** à
« Aujourd'hui » — un doublon qui ne dit rien — et rien du tout à l'impression.

### I. L'échelle d'impression peut abandonner sans le dire

La boucle de convergence s'arrête après deux passages stables **ou 40 tours**
(~14 s). Au-delà, la page est déclarée prête même non convergée : une
diapositive peut être photographiée en cours de mise en page. Compromis
défendable, mais **silencieux** — aucun avertissement.

Même remarque pour la capture : `html-to-image` a un délai de 30 s et un repli
en définition simple. Le repli ne prévient pas non plus.

### J. L'ordre des onglets n'est pas modifiable

`processus.rang` fixe l'ordre des use cases. Il est posé à la création et
aucune interface ne permet de le changer. Sur un audit à dix use cases, l'ordre
de restitution est pourtant un choix éditorial.

---

## Ce que je ferais, dans cet ordre

**1. Les trois champs manquants, en une seule migration.** `etapes.cible`
(texte), un quatrième état de bilan `en_cours`, et un état sur `frictions`.
Ils se tiennent : « en cours » n'a de sens que si une cible dit vers quoi, et
la friction résolue est la preuve que le déploiement a produit un effet. Les
faire ensemble évite trois migrations et trois passages sur `client_json`,
`importer_client_json` et `echange-json.ts` — chacun devant tolérer l'absence
du champ pour ne pas effacer en silence lors d'une restauration.

**2. La garde de version sur les enfants.** C'est le seul point de cette liste
qui **perd des données**. Soit passer la version du processus lue en paramètre
des écritures d'étape, soit assumer explicitement que l'unité de concurrence
est le processus et bloquer l'édition d'un processus déjà ouvert ailleurs.

**3. Découpler le `si` de l'« après ».** Une seconde clef dans `clients.si`,
ou un préfixe sur les clefs de correction. Sans quoi la projection restera
contaminée par les retouches du relevé.

**4. Le logo Mercateam et la page avant/après du site.** Deux gestes visuels à
faible coût, forte valeur en salle — d'autant que `synthese(…, "bilan")` est
déjà écrite.

**5. Le défilement mémorisé, et les gardes alignées.** Confort et cohérence.
