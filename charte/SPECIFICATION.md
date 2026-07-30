# Page de diagnostic — spécification

Ce que doit afficher la page client, dans l'ordre. Relevé sur `diagnostic-os.html`,
qui fait référence en cas de doute.

**Ce document ne décrit pas le diagramme de flux.** Celui-ci est déjà en place,
importé tel quel dans `src/flux/` — il ne doit être ni réécrit, ni converti en
Tailwind, ni retouché. Sa géométrie est vérifiée au pixel contre l'original.

---

## Principe de disposition

L'écran est **un document qu'on lit de haut en bas**, pas un formulaire à
onglets. C'est le point le plus important, et c'est ce qui manque aujourd'hui.

En particulier : **frictions et chiffres clés sont visibles en même temps que le
diagramme**, immédiatement en dessous. On regarde un flux *et* ses irritants
d'un seul coup d'œil. Les mettre dans des onglets séparés casse la lecture qui
justifie l'outil.

Un seul niveau d'onglets subsiste : celui des **processus**.

```
┌─ Barre ────────────────────────────────────────────────────────────┐
├─ En-tête client (nom, site, date, 3 KPI) ──────────────────────────┤
├─ Onglets de processus ─────────────────────────────────────────────┤
│  Titre du processus + sous-titre                                   │
│  ┌─ Diagramme de flux ─────────────────────────────────────────┐   │
│  │  [Ajuster] [zoom] [Saisie rapide]                           │   │
│  │  … le composant existant …                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  (Saisie rapide, si dépliée)                                       │
│  ┌─ Frictions par rôle ──────────┐ ┌─ Chiffres clés ───────────┐   │
│  └───────────────────────────────┘ └───────────────────────────┘   │
├─ Environnement IT ─────────────────────────────────────────────────┤
├─ Synthèse ─────────────────────────────────────────────────────────┤
└────────────────────────────────────────────────────────────────────┘
```

---

## 1. Barre supérieure

Fond blanc, filet de séparation en bas.

- À gauche : bouton menu, **logo Mercateam** (le SVG est dans
  `diagnostic-os.html`, constante `LOGO` — le récupérer, ne pas le redessiner),
  un filet vertical, le libellé `Diagnostic OS`.
- Si le mode édition est actif : une puce violette `Mode édition`.
- À droite : `<nom du client> · <site>`, puis les boutons `Modifier` /
  `Terminer l'édition`, `Imprimer / PDF`, `Exporter en JSON`.

## 2. En-tête client

- Sur-titre, petites capitales espacées, violet : `Diagnostic de déploiement — état des lieux`
- `<h1>` : nom du client
- Deux pilules : le site (fond violet clair) et `Visite du <date>` (contour)
- À droite, trois KPI, nombre en Roboto Mono :
  `<n> processus cartographiés` · `<n> étapes relevées` · `<n> frictions relevées`
  Le nombre de frictions est en **rouge**, les deux autres en violet.

## 3. Onglets de processus

Un onglet par processus, dans l'ordre de `rang`. L'onglet actif est violet plein,
les autres en gris. En édition, un bouton `+ Processus` à la suite.

**Ce sont les seuls onglets de la page.**

## 4. Titre du processus

`<h2>` avec le nom, puis le sous-titre en gris dessous. En lecture seulement —
en édition, ils deviennent des champs dans une carte « Processus ».

## 5. Diagramme de flux

Le composant `DiagrammeFlux` existant, tel quel.

Son en-tête porte `Ajuster`, le curseur de zoom, et le bouton **`Saisie rapide`**.
Ce bouton déplie **sous le diagramme** un tableau à 5 colonnes :
`N° · Rôle · Action relevée · Supports · Ordre`. C'est la liste des étapes —
elle n'a pas d'onglet, elle vit derrière ce bouton.

## 6. Frictions et chiffres clés

Deux panneaux **côte à côte**, en grille `1.35fr 1fr`, juste sous le diagramme.

**Frictions par rôle** — fond rouge très clair (`--rouge-clair`), titre rouge
foncé précédé d'une pastille. Les frictions sont **groupées par rôle** : à
gauche la puce du rôle avec sa couleur pastel, à droite la liste de ses
frictions, chacune sur fond blanc légèrement rosé.

**Chiffres clés** — fond violet très clair (`--violet-50`), titre violet foncé.
Chaque ligne : la valeur en gros, en Roboto Mono violet, puis son libellé.

## 7. Environnement IT

**Voir `ENVIRONNEMENT-IT.md`, qui fait foi.** Le besoin a changé depuis ce
document : le mono-fichier classait les outils par domaine et étiquetait chaque
bloc avec les noms de processus, on veut désormais trois niveaux —
`bloc → étape → outil`. Ce qui suit ne décrit plus la cible.

Reste valable : le sur-titre `Environnement IT`, le `<h2>` `Échanges entre les
outils`, le compteur en gris à droite, et la carte `Détail des échanges` sous
les blocs, listant chaque échange outil → outil avec sa nature (automatique /
manuel / non qualifié).

> **Le tracé des flèches entre blocs a sa propre logique**, comme le diagramme
> — `tracerEchanges`, `echangesBlocs`, `ordonnerDomaines`. Ne pas la
> réimplémenter : l'importer depuis le mono-fichier. Le classement, lui, est à
> refaire selon `ENVIRONNEMENT-IT.md`.

## 8. Synthèse

Sur-titre `Synthèse globale`, `<h2>` : `État des lieux du site`.

Le contenu a été redéfini le 30/07 et ne correspond plus au mono-fichier :

- **Une ou deux phrases par processus**, résumant le workflow et ses frictions.
- **Un bloc « Frictions transverses »** regroupant les irritants qui se
  retrouvent sur plusieurs processus. C'est ce croisement qui a de la valeur en
  restitution : une friction isolée est un incident, la même sur trois
  processus est un problème d'organisation.

Les compteurs par processus et le total de frictions du mono-fichier ne sont
plus demandés ici.

---

## Éléments transverses

**Puces de rôle.** Chaque rôle a une couleur, tirée de son index dans la liste
des rôles de **tout le client** — pas du processus affiché. Un même rôle garde
ainsi sa couleur d'un onglet à l'autre. Les 8 pastels, dans l'ordre, en
`(fond, texte)` :

```
#D4DEF9 / #2D5BAE      #D4F3E9 / #337572      #DBEEFA / #256F9A      #DEF3CC / #107558
#F8EAC1 / #CE6700      #F5E4D9 / #A3512B      #FFCFCF / #AA2D46      #F9DBF4 / #AA2B89
```

Le rôle `Transverse` est une exception : gris `#EFEFEF` sur `#2B2B2B`.

**Sur-titres de section.** Petites capitales, 12 px, graisse 600, interlettrage
`.07em`, couleur `--violet-400`.

**Cartes.** Fond blanc, rayon `--r-carte`, ombre `--ombre`, sans bordure.

**Édition.** Un seul interrupteur global dans la barre. En lecture, aucun champ
de saisie n'est visible — le document se lit. En édition, les textes deviennent
modifiables sur place, sans bouton « Enregistrer » par bloc : l'écriture part à
la sortie du champ.

---

## Ce qu'il ne faut pas faire

- **Pas d'onglets** pour étapes / frictions / chiffres. Un seul niveau, celui des processus.
- **Pas de bouton « Enregistrer » par ligne ni par carte.** L'écriture est implicite.
- **Pas de champs étiquetés en lecture.** Le mode lecture est un document, pas un formulaire.
- **Ne pas toucher à `src/flux/`.** Le diagramme est vérifié au pixel ; toute
  retouche casse cette garantie sans que ça se voie.
- **Ne pas redessiner le logo.** Il est dans `diagnostic-os.html`.
