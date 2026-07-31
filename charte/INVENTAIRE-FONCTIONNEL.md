# Inventaire fonctionnel — tout ce que sait faire le mono-fichier

Relevé exhaustif de `diagnostic-os.html` (3 529 lignes) : 44 actions, 13 types de
champs éditables, 7 écouteurs d'événements, 15 vues. Sert de feuille de test
contre l'application Lovable.

## Comment s'en servir

Chaque ligne est vérifiable à l'écran. Cochez ce qui marche, annotez le reste.
Trois annotations suffisent :

- **MANQUE** — la fonction n'existe pas
- **BUG** — elle existe mais se comporte mal (dites ce que vous attendiez)
- **DIFFÉRENT** — elle existe autrement (dites comment)

⚠️ **Les lignes marquées `[SPEC MODIFIÉE]` ont changé volontairement.** Ne les
comptez pas comme manquantes : le mono-fichier fait une chose, la cible en
demande une autre. Elles sont là pour que vous vérifiiez que le changement a
bien eu lieu, pas pour être restaurées.

---

## A. Châssis et barre supérieure

- [ ] A1 — Logo Mercateam en haut à gauche
- [ ] A2 — Libellé « Diagnostic OS » à côté du logo
- [ ] A3 — Nom du client + site affichés à droite
- [ ] A4 — Puce « Mode édition » visible quand l'édition est active
- [ ] A5 — Bouton `Modifier` / `Terminer l'édition` qui bascule les deux modes
- [ ] A6 — Bouton `Imprimer / PDF`
- [ ] A7 — Bouton `Exporter en JSON`
- [ ] A8 — Bouton burger qui ouvre le tiroir
- [ ] A9 — Clic sur le voile → ferme le tiroir
- [ ] A10 — Bouton `×` du tiroir → ferme le tiroir

## B. Tiroir — base de diagnostics

- [ ] B1 — Liste de tous les diagnostics, avec `site · date` sous le nom
- [ ] B2 — Le diagnostic courant est visuellement marqué actif
- [ ] B3 — Cliquer un diagnostic le charge et sélectionne son premier processus
- [ ] B4 — `+ Nouveau diagnostic` (crée un client vierge, passe en édition)
- [ ] B5 — `Exporter clients-data.js` (toute la base, format du fichier source)
- [ ] B6 — `Exporter ce diagnostic en JSON`
- [ ] B7 — `Exporter toute la base en JSON`
- [ ] B8 — `Injecter dans ce diagnostic` — importe un JSON **en remplaçant** le
      contenu courant, en gardant sa place dans la liste
- [ ] B9 — Confirmation avant écrasement, chiffrée : « contient déjà N étape(s)
      et N friction(s) »
- [ ] B10 — Si le fichier contient plusieurs diagnostics, ils sont **ajoutés**
      au lieu de remplacer, avec un message qui le dit
- [ ] B11 — `Importer comme nouveau diagnostic`
- [ ] B12 — Fichier sans diagnostic exploitable → message « Aucun diagnostic
      exploitable dans ce fichier »
- [ ] B13 — `Réinitialiser depuis les données d'origine`, avec confirmation

## C. En-tête du document

- [ ] C1 — Sur-titre « Diagnostic de déploiement — état des lieux »
- [ ] C2 — Nom du client en `<h1>`
- [ ] C3 — Pilule violette = site
- [ ] C4 — Pilule contour « Visite du <date> »
- [ ] C5 — KPI « processus cartographiés »
- [ ] C6 — KPI « étapes relevées »
- [ ] C7 — KPI « frictions relevées », en rouge

## D. Fiche client — mode édition seulement

- [ ] D1 — Identifiant technique affiché en police mono
- [ ] D2 — `Régénérer l'identifiant` (le recalcule depuis nom + site)
- [ ] D3 — Champ `Client`
- [ ] D4 — Champ `Site`
- [ ] D5 — Champ `Date de la visite`
- [ ] D6 — `Notes de synthèse` (zone multi-lignes)
- [ ] D7 — Liste des outils du site, chacun renommable en place
- [ ] D8 — `+ Outil`
- [ ] D9 — `×` sur chaque outil pour le retirer
- [ ] D10 — `Dupliquer ce diagnostic` (nom suffixé « (copie) »)
- [ ] D11 — `Supprimer ce diagnostic`, avec confirmation nommant le client
- [ ] D12 — Refus de supprimer le dernier diagnostic, avec message explicite
- [ ] D13 — Mention « Enregistrement automatique · N diagnostic(s) en base »

## E. Onglets de processus

- [ ] E1 — Un onglet par processus, l'actif marqué
- [ ] E2 — Changer d'onglet change le diagramme, les frictions et les chiffres
- [ ] E3 — `+ Processus` en mode édition

## F. Carte processus — mode édition

- [ ] F1 — Champ `Processus — nom de l'onglet`
- [ ] F2 — Champ `Sous-titre`
- [ ] F3 — `Supprimer ce processus`, confirmation chiffrant les étapes perdues
- [ ] F4 — Refus de supprimer le dernier processus
- [ ] F5 — Compteur « N étape(s) · N rôle(s) · N friction(s) »

## G. Diagramme de flux — lecture

- [ ] G1 — Titre « Diagramme de flux — l'existant »
- [ ] G2 — Un couloir horizontal par rôle, fonds alternés
- [ ] G3 — Étiquette de rôle colorée à gauche de chaque couloir
- [ ] G4 — Couleur stable par rôle (8 pastels, `Transverse` en gris)
- [ ] G5 — Une carte par étape, placée à l'intersection rôle × position
- [ ] G6 — Badges de support à cheval sur la bordure haute de la carte
- [ ] G7 — Au-delà de 4 supports : `+N` et l'infobulle liste tout
- [ ] G8 — Badges reconnaissables : Excel vert, PowerPoint rouge, SharePoint
      turquoise, Word/papier bleu, mail bleu clair, vidéo rouge, oral jaune,
      et fenêtre de navigateur par défaut
- [ ] G9 — Frise des échelles de temps en bandeau au-dessus des colonnes
- [ ] G10 — Un bandeau par groupe d'étapes consécutives partageant la phase
- [ ] G11 — Séparateur vertical pointillé entre deux groupes
- [ ] G12 — **Écart calculé** entre deux jalons codés (`J-7`, `J1`, `S+2`,
      `M+3`) et affiché dans l'unité la plus lisible : `+2 sem`, `+3 mois`
- [ ] G13 — Flèche entre chaque paire d'étapes consécutives
- [ ] G14 — Style de flèche selon la nature : automatique violet plein, manuel
      orange tirets, non qualifié lavande
- [ ] G15 — Légende des trois natures sous le diagramme
- [ ] G16 — Étape « à cheval » sur deux couloirs, centrée sur la frontière
- [ ] G17 — Curseur de zoom 40 % → 100 %, par pas de 5
- [ ] G18 — Bouton `Ajuster` : calcule le zoom pour que tout tienne en largeur
- [ ] G19 — Défilement horizontal quand le diagramme dépasse
- [ ] G20 — État vide : « Aucune étape pour ce processus »

## H. Diagramme de flux — édition

- [ ] H1 — Texte de l'étape modifiable directement sur la carte
- [ ] H2 — La zone de texte grandit avec le contenu, sans ascenseur
- [ ] H3 — Sélecteur `＋ support…` alimenté par les outils déjà relevés
- [ ] H4 — `Autre outil…` demande le nom **et l'ajoute aux outils du client**,
      pour qu'il soit proposé sur les autres étapes
- [ ] H5 — `×` sur chaque badge de support pour le retirer
- [ ] H6 — `←` décaler l'étape à gauche (désactivé sur la première)
- [ ] H7 — `→` décaler à droite (désactivé sur la dernière)
- [ ] H8 — `+` insérer une étape juste après, **même rôle et même phase**
- [ ] H9 — Icône de coupure : commencer une nouvelle échelle de temps à cette
      étape ; refus motivé si l'étape ouvre déjà une échelle
- [ ] H10 — `×` supprimer l'étape
- [ ] H11 — Poignée `⠿` seule draggable (le texte reste sélectionnable)
- [ ] H12 — Déposer sur une cellule → change de couloir **et** de position
- [ ] H13 — Déposer sur une **frontière** entre deux couloirs → l'étape devient
      à cheval sur les deux rôles
- [ ] H14 — Surbrillance de la cible pendant le survol
- [ ] H15 — L'étape déplacée **adopte la phase de sa nouvelle place** (sinon le
      bandeau se fragmenterait)
- [ ] H16 — `+ Étape` en bout de chaque couloir, héritant du rôle de la ligne
- [ ] H17 — Renommer un rôle en place
- [ ] H18 — Le renommage se **répercute sur les étapes et les frictions**
- [ ] H19 — `↑` monter un rôle (désactivé sur le premier)
- [ ] H20 — `↓` descendre un rôle (désactivé sur le dernier)
- [ ] H21 — `×` supprimer un rôle, avec confirmation chiffrant les étapes
      concernées et nommant le rôle de repli
- [ ] H22 — Refus de supprimer le dernier rôle, avec message
- [ ] H23 — Les frictions du rôle supprimé basculent sur `Transverse`
- [ ] H24 — `+ Rôle`
- [ ] H25 — Renommer une échelle de temps → **tout le groupe** suit
- [ ] H26 — `×` supprimer une échelle → ses étapes rejoignent l'échelle voisine
- [ ] H27 — `+ Échelle` en fin de frise
- [ ] H28 — **Clic sur une flèche** : non qualifié → manuel → automatique →
      non qualifié
- [ ] H29 — Sélectionner une étape la met en surbrillance
- [ ] H30 — `+ Première étape` quand le processus est vide

## I. Saisie rapide

- [ ] I1 — Bouton `Saisie rapide` / `Masquer la saisie rapide`
- [ ] I2 — Colonnes N° / Rôle / Action relevée / Supports / Ordre
- [ ] I3 — Sélecteur de rôle par ligne
- [ ] I4 — Texte de l'étape
- [ ] I5 — Supports en texte libre, séparés par des virgules
- [ ] I6 — `←` `→` `×` par ligne
- [ ] I7 — `+ Étape`
- [ ] I8 — Le numéro de l'étape sélectionnée est marqué

## J. Frictions

- [ ] J1 — Lecture : groupées par rôle, avec la chip colorée du rôle
- [ ] J2 — Ordre des groupes = ordre des rôles du processus, `Transverse` en fin
- [ ] J3 — Édition : sélecteur de rôle par friction, `Transverse` inclus
- [ ] J4 — Texte de la friction
- [ ] J5 — `×` supprimer
- [ ] J6 — `+ Friction`

## K. Chiffres clés

- [ ] K1 — Lecture : valeur en gros, libellé dessous
- [ ] K2 — Édition : champ valeur (`5x8`, `2-5 %`)
- [ ] K3 — Édition : champ libellé
- [ ] K4 — `×` supprimer
- [ ] K5 — `+ Chiffre clé`

## L. Environnement IT

Le modèle a changé — voir `ENVIRONNEMENT-IT.md`. Les lignes non marquées
restent attendues à l'identique.

- [ ] L1 — Sur-titre « Environnement IT »
- [ ] L2 — `[SPEC MODIFIÉE]` `<h2>` devient **« Les outils du site »**
      (le mono-fichier affiche « Échanges entre les outils »)
- [ ] L3 — Compteur « N domaine(s) · N outil(s) · N échange(s) »
- [ ] L4 — Mention « Classement proposé, échanges déduits des processus » qui
      devient « Classement et échanges ajustés à la main » après retouche
- [ ] L5 — Un bloc par domaine, couleur propre
- [ ] L6 — `[SPEC MODIFIÉE]` structure à trois niveaux **bloc → étape → outil**
      (le mono-fichier fait bloc → missions, outils à part)
- [ ] L7 — Outils dans le bloc avec leur badge ; nom masqué au-delà de 2 outils
- [ ] L8 — Infobulle « <outil> — N étape(s) » comptant l'usage réel
- [ ] L9 — Bloc sans mission → « Aucune mission relevée »
- [ ] L10 — Bloc sans outil → « Aucun outil — bloc à alimenter »
- [ ] L11 — `[SPEC MODIFIÉE]` **plus aucune flèche entre les blocs** — la
      mosaïque devient statique
- [ ] L12 — Légende des trois natures
- [ ] L13 — Édition : renommer un domaine, **le classement des outils suit**
- [ ] L14 — Édition : `×` supprimer un domaine → ses outils repassent en
      « Non classé »
- [ ] L15 — `+ Domaine`
- [ ] L16 — `+ mission` sur chaque bloc
- [ ] L17 — Renommer une mission
- [ ] L18 — `×` retirer une mission
- [ ] L19 — Carte `Classement des outils` : un sélecteur de domaine par outil
- [ ] L20 — Classement de départ **deviné par mots-clés** (Padoa → Suivi
      médical, Kronos → SIRH & GTA, Excel → Bureautique…)
- [ ] L21 — `[SPEC MODIFIÉE]` la carte `Détail des échanges` **disparaît** au
      profit du schéma
- [ ] L22 — Échanges **déduits des enchaînements d'étapes** : une étape sur un
      outil suivie d'une étape sur un autre = un passage
- [ ] L23 — `+ Échange` (crée un lien entre les deux premiers outils)
- [ ] L24 — `Re-déduire des processus`, avec confirmation qui annonce
      l'écrasement des ajustements
- [ ] L25 — État vide « Aucun outil relevé »

### L-bis. Schéma des échanges — nouveau

- [ ] L26 — Carte `Échanges entre les outils` sous les blocs
- [ ] L27 — Une boîte par outil, une flèche par échange
- [ ] L28 — Placement en graphe libre, le plus connecté au centre
- [ ] L29 — **Déterminisme** : deux chargements donnent exactement la même image
- [ ] L30 — Épaisseur du trait proportionnelle à la fréquence (1,5 px → 6 px)
- [ ] L31 — Couleur et style selon la nature, convention du diagramme
- [ ] L32 — Échange réciproque = une ligne à deux pointes, pas deux traits
- [ ] L33 — Bande `Sans échange relevé` pour les outils isolés
- [ ] L34 — Clic sur une flèche → cycle des trois natures
- [ ] L35 — Tirer d'un outil à l'autre → crée un échange
- [ ] L36 — Flèche sélectionnée → éditeur avec nature, libellé « ce qui passe »,
      suppression
- [ ] L37 — Déplacer une boîte à la main, position conservée au rechargement
- [ ] L38 — `Replacer automatiquement`, en annonçant qu'il écrase

## M. Synthèse

- [ ] M1 — Sur-titre « Synthèse globale »
- [ ] M2 — `<h2>` « État des lieux du site »
- [ ] M3 — `[SPEC MODIFIÉE]` **une ou deux phrases par processus** résumant le
      workflow et ses frictions (le mono-fichier affiche des compteurs)
- [ ] M4 — `[SPEC MODIFIÉE]` bloc **« Frictions transverses »** regroupant les
      irritants présents sur plusieurs processus
- [ ] M5 — `Rôles cartographiés` : toutes les chips de rôle du client
- [ ] M6 — `Outils et supports relevés`
- [ ] M7 — Notes de synthèse du client, en gris
- [ ] M8 — `[SPEC MODIFIÉE]` le total de frictions en très gros rouge n'est
      plus demandé

## N. Impression et PDF

- [ ] N1 — Une page par processus
- [ ] N2 — Bandeau d'identification sur chaque page : client, site, date
- [ ] N3 — Mention « Processus i/n » sur chaque page
- [ ] N4 — Page dédiée `Environnement IT`
- [ ] N5 — Page dédiée `Synthèse`
- [ ] N6 — Les commandes d'écran (zoom, boutons, fiche client) sont masquées
- [ ] N7 — Zoom forcé à 100 % à l'impression, quel que soit le réglage écran
- [ ] N8 — Les quatre diagrammes sont rendus, pas seulement celui affiché
- [ ] N9 — Retour à l'écran normal une fois l'impression terminée ou annulée

## O. Persistance et robustesse

- [ ] O1 — Enregistrement automatique à chaque frappe, sans bouton
- [ ] O2 — Le diagnostic courant est mémorisé et rouvert au rechargement
- [ ] O3 — Le navigateur en navigation privée ne casse rien (échec silencieux)
- [ ] O4 — **Le focus reste dans le champ pendant la frappe** malgré le
      re-rendu complet
- [ ] O5 — La position du curseur dans le texte est conservée
- [ ] O6 — La position de défilement horizontal du diagramme est conservée
- [ ] O7 — La position de défilement vertical de la page est conservée
- [ ] O8 — Les flèches se redessinent au redimensionnement de la fenêtre
- [ ] O9 — Renumérotation automatique des étapes en 1..n après tout déplacement
- [ ] O10 — Import défensif : un fichier bancal donne un diagnostic incomplet,
      **jamais une base corrompue**
- [ ] O11 — Un identifiant déjà pris est réattribué à l'import, pas écrasé

---

## Ce qui n'existe pas dans le mono-fichier

À ne pas signaler comme manquant — ça n'a jamais existé :

- pas d'authentification ni de comptes utilisateurs
- pas de travail à plusieurs ni de temps réel
- pas d'annulation (`Ctrl+Z`)
- pas de recherche ni de filtre
- pas d'historique des versions
- pas de raccourcis clavier
- pas d'export PowerPoint ni Word (l'impression PDF tient ce rôle)
- pas de téléversement d'images ni de pièces jointes
- pas de mode sombre
