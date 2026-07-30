# Environnement IT — modèle de données

Ce document remplace la section 7 de `SPECIFICATION.md`, qui décrivait le
comportement du mono-fichier. Le besoin a changé : ce qui suit fait foi.

---

## Le fait qui commande tout le reste

**Le libellé d'étape n'existe dans aucune donnée.** La base porte des noms de
processus (`onboarding`, `habilitations`), des phrases d'étape (« Accueil EHS
(1 h) : PPT + vidéo + QCM »), des phases temporelles et des supports.
« Suivi médical », « Pilotage », « Suivi + évaluation » ne sont rien de tout
cela.

Il n'est donc **pas déductible**. Toute tentative de le dériver du texte des
étapes produit une invention plausible qu'il faut corriger à la main, client
après client. Il vient d'un dictionnaire explicite, écrit ici, versionné, et
corrigeable — pas d'une devinette.

C'est ce qui distingue cette section du diagramme de flux : le diagramme
affiche ce qui a été relevé, l'environnement IT le **classe**, et un classement
suppose une taxonomie qu'on assume.

---

## Le modèle

```
bloc (domaine métier)  →  étape (activité du domaine)  →  outil(s) en face
```

```
Réglementaire        Suivi médical          Padoa
Formations           Pilotage               Excel
Formations           Suivi + évaluation     Boost
```

---

## La règle de dérivation

Pour chaque couple **(outil, processus où cet outil apparaît sur au moins une
étape)** :

**Outil spécifique** — présent dans la table A. Elle donne son bloc *et* son
étape ; le processus n'intervient pas. Padoa produit `Réglementaire / Suivi
médical` où qu'il soit relevé.

**Outil générique** — Excel, mail, papier, SharePoint… Il n'appartient à aucun
domaine propre : son **bloc vient du processus** (table B), son **étape vaut
« Pilotage »**. Excel dans le processus de formation produit
`Formations / Pilotage`.

Puis déduplication sur le triplet `(bloc, étape, outil)`.

> Cette distinction spécifique / générique est le point qui manquait. Sans
> elle, Excel atterrit dans un domaine « Bureautique » qui n'apprend rien, et
> Padoa se retrouve rattaché à un processus au lieu de son domaine. Les deux
> exemples relevés en recette — Padoa et Excel — ne sont pas deux cas
> particuliers : ce sont les deux branches de la même règle.

La correspondance se fait par sous-chaîne sur le nom **normalisé** : minuscules,
accents retirés. C'est ce qui fait que la faute de frappe « Padao » tombe au
même endroit que « Padoa ».

---

## Table A — outils spécifiques → (bloc, étape)

| motifs | bloc | étape |
|---|---|---|
| `padoa`, `padao`, `gaia`, `medical`, `medecine`, `aptitude` | Réglementaire | Suivi médical |
| `caces`, `habilitation`, `autorisation de conduite` | Réglementaire | Habilitations |
| `boost`, `sowesign`, `moodle`, `lms`, `learning`, `360learning` | Formations | Suivi + évaluation |
| `kronos`, `cronos`, `horoquartz`, `adp`, `workday`, `sirh`, `gta`, `pointage`, `badgeage`, `paie` | SIRH & GTA | Temps et absences |
| `myplan`, `gpao`, `ordonnancement`, `ordo` | Planning | Planification |
| `sap`, `oracle`, `erp` | Production & MES | Données de référence |
| `mes`, `aveva`, `wonderware` | Production & MES | Suivi de ligne |
| `corim`, `gmao`, `carl`, `coswin` | Maintenance | Interventions |
| `qms`, `qualite`, `non-conformite` | Qualité & QHSE | Non-conformités |
| `qlik`, `power bi`, `powerbi` | Pilotage & reporting | Indicateurs |
| `sharepoint`, `onedrive`, `drive`, `teams`, `intranet`, `ged`, `docuware`, `serveur`, `reseau` | GED & partage | Diffusion documentaire |

## Outils génériques

Jamais classés par la table A ; ils héritent du bloc de leur processus :

`excel`, `tableur`, `csv`, `xls`, `word`, `powerpoint`, `ppt`, `slide`, `mail`,
`outlook`, `courriel`, `papier`, `imprime`, `formulaire`, `checklist`, `fiche`,
`feuille`, `classeur`, `registre`, `cahier`, `livret`, `attestation`, `oral`,
`reunion`, `brief`, `telephone`, `video`

Un outil absent des deux listes est traité comme spécifique et rejoint le bloc
**Non classé**, avec son propre nom pour étape. Il doit rester visible : c'est
le signal qu'il manque une entrée au dictionnaire, et le masquer reviendrait à
perdre l'information la plus utile — un outil qu'on ne sait pas ranger.

## Table B — processus → bloc, pour les outils génériques

| motifs sur `processus.nom` | bloc |
|---|---|
| `habilitation`, `autorisation`, `securite`, `ehs`, `medical`, `reglementaire` | Réglementaire |
| `formation`, `onboarding`, `integration`, `accueil`, `montee en competence` | Formations |
| `competence`, `polyvalence`, `matrice`, `evaluation` | Compétences |
| `planning`, `planification`, `affectation`, `absence`, `interim` | Planning |
| `recrutement`, `contrat`, `administratif` | SIRH & GTA |
| `qualite`, `audit`, `conformite` | Qualité & QHSE |
| `production`, `ligne` | Production & MES |
| `maintenance` | Maintenance |
| aucun motif | Non classé |

---

## Interdits

**Aucune phase temporelle nulle part.** `etapes.phase` — « Avant J1 », « J1 »,
« Après J1 », « J+30 », « Semaine 2 » — n'intervient dans aucun calcul de cette
section. C'est une échelle de temps, pas une activité, et l'y faire entrer
mélange deux axes qui n'ont rien à voir.

**Ne pas toucher à `src/flux/`.** Le diagramme est vérifié au pixel contre
l'original ; toute retouche casse cette garantie sans que ça se voie.

---

## Édition et persistance

- Chaque bloc renommable ; chaque ligne « étape : outil » modifiable, ajoutable,
  supprimable.
- Une ligne peut porter plusieurs outils, ou aucun — elle affiche alors
  « aucun outil ».
- **Une correction manuelle n'est jamais écrasée par une re-dérivation.** Le
  calcul initialise, rien de plus. Seul un clic explicite sur « Recalculer »
  reprend la main, et ce bouton doit annoncer qu'il écrase.
- Les corrections sont enregistrées sur le client, pas dans l'état local.

## Ce qu'on n'affiche pas

Une étape standard du bloc pour laquelle aucun outil n'a été relevé
n'apparaît **pas** d'office. On ne fabrique pas un manque : « Autorisations
internes — aucun outil » sur un site qui ne pratique pas les autorisations
internes serait une observation fausse. En revanche la ligne peut être ajoutée
à la main, et c'est alors un constat, pas une déduction.

---

## Le schéma des échanges

Décidé le 30/07, en remplacement des flèches entre blocs du mono-fichier.

**Les blocs ne portent plus de flèches.** Un bloc n'échange pas avec un bloc :
ce sont les outils qui échangent, et l'agrégation au niveau des blocs perdait
cette information. Le `<h2>` de la section devient `Les outils du site`.

Sous les blocs, une carte `Échanges entre les outils` : une boîte par outil, une
flèche par échange — Excel envoie de l'information à SAP, donc une flèche
d'Excel vers SAP.

**Disposition en graphe libre** : le plus connecté au centre, les autres autour,
en plaçant près d'un outil déjà posé celui qui échange le plus avec lui.

> **Le placement doit être déterministe.** Mêmes données, même image, à chaque
> chargement et sur chaque poste. Cette page est capturée en écran et imprimée
> dans des restitutions client : un graphe qui se replace à chaque visite est
> inutilisable. Donc aucun `Math.random()`, aucune simulation animée qui
> converge en un temps variable — un nombre fixe d'itérations, en synchrone —
> et un ordre de parcours des outils explicitement trié.

**Épaisseur du trait = fréquence**, soit le nombre d'enchaînements d'étapes qui
ont produit l'échange : 1,5 px pour le moins fréquent, 6 px pour le plus
fréquent, linéaire entre les deux ; tous au plus fin si toutes les fréquences
sont égales. L'épaisseur ne code jamais la nature.

**Couleur et style = nature**, avec la convention du diagramme de flux
(`LIENS` de `src/flux/moteur.js`, en lecture seule) : automatique, manuel, non
qualifié. Même légende, plus une mention de ce que code l'épaisseur.

**Échange réciproque** : une seule ligne à deux pointes, pas deux traits
parallèles.

**Outils sans échange** : dans une bande `Sans échange relevé` sous le schéma,
et non flottants dans le graphe. Ils restent visibles — un outil qui ne
communique avec rien est un constat d'audit, pas un vide à masquer.

### Le schéma remplace la carte « Détail des échanges »

La liste texte disparaît ; tout se pilote sur le schéma :

- **clic sur une flèche** : la nature avance d'un cran, non qualifié → manuel →
  automatique → non qualifié — trois clics reviennent au départ, comme dans le
  diagramme
- **tirer d'un outil vers un autre** : crée l'échange dans ce sens
- **flèche sélectionnée** : un éditeur inline donne la nature, le libellé
  « ce qui passe » et la suppression. C'est désormais le seul endroit où ce
  libellé se saisit.
- **déplacer une boîte** : la position est enregistrée sur le client et survit
  au rechargement ; `Replacer automatiquement` revient au placement calculé, en
  annonçant qu'il écrase.

---

## Logos disponibles

Le moteur du diagramme reconnaît : tableur (Excel), présentation (PowerPoint),
partage (SharePoint / OneDrive / Drive / Teams), document et papier (Word,
formulaire, checklist, fiche, registre…), messagerie (Mail / Outlook), vidéo et
e-learning, oral et réunion.

Tout le reste — Padoa, Boost, SAP, Corim, Qlik — s'écrit en toutes lettres.
C'est voulu : un logo inventé pour un outil métier serait plus trompeur que le
nom écrit.
