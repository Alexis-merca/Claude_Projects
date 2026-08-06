# Les échelles de maturité, use case par use case

J'avais écrit qu'aucune source du projet ne définissait les cinq niveaux de
maturité. **C'était faux** : la base de connaissance des Top Use Cases
Mercateam porte une échelle complète pour chacun des dix use cases, sous le
champ « Client maturity evaluation ». Ce document les rassemble.

**Ce sont dix échelles distinctes, pas une échelle générique.** C'est mieux
qu'un barème unique : le niveau 3 de la planification et le niveau 3 de la
reconnaissance ne décrivent pas la même chose, et un consultant qui note sur
la bonne échelle note juste. C'est aussi ce qui condamne définitivement l'idée
d'une moyenne de maturité affichée en en-tête : ces chiffres ne s'additionnent
pas.

Le champ `processus.maturite` (1–5, nullable) attend ces valeurs. La
justification saisie à côté doit dire *pourquoi ce niveau et pas le suivant*.

---

## UC 1 — Planification des opérateurs et gestion des aléas

1. Planning dans les têtes, réactif, pas de traçabilité
2. Planning manuel (Excel, tableau blanc), lent et source d'erreurs
3. Planning basé sur les compétences, fiable mais chronophage
4. Planning connecté (charge, RH), risques anticipés
5. Planning standardisé, piloté par la donnée, prédictif

## UC 2 — Pilotage de l'adéquation charge / capacité

1. Coûts vus trop tard, déconnectés des opérations réelles
2. Visibilité basique, pas de contrôle sur charge contre capacité
3. Suivi des coûts connecté aux données RH réelles
4. Anticipation des besoins, réduction mesurable des heures sup et de l'intérim
5. Pilotage continu par la donnée, coûts stables et expliqués

## UC 3 — Intégration des nouveaux collaborateurs

1. Intégration informelle, compagnonnage sans structure
2. Partiellement formalisée, incomplète ou incohérente selon les équipes
3. Parcours structurés par poste, avec suivi de progression
4. Processus robustes et standardisés, qui réduisent clairement le ramp-up
5. Délai d'autonomie prédictible, objectifs définis et résultats stables

## UC 4 — Capitalisation et transfert des savoir-faire critiques

1. Savoir-faire dans les têtes, dépendance à quelques personnes
2. Documentation partielle, obsolète ou incohérente
3. Transfert structuré et traçable, théorie et pratique terrain
4. Fondé sur les risques, méthode formelle, forte polyvalence
5. Gestion proactive : suivi continu, anticipation des départs, revalidation régulière

## UC 5 — Standardisation multi-sites de la gestion du savoir-faire

1. Local et informel, chaque site gère à sa façon
2. Documenté mais peu fiable, formats différents d'un site à l'autre
3. Bien organisé localement mais silotés, pas de comparabilité Groupe
4. Référentiel commun et règles partagées, données comparables
5. Gouvernance Groupe : standard, données centralisées, tableaux de bord pilotés au niveau Groupe

## UC 6 — Pilotage des compétences

1. Aucune visibilité, savoir-faire dans les têtes
2. Partiellement formalisé ou obsolète
3. Vue basique « qui sait faire quoi », opérationnelle au quotidien
4. Connecté de bout en bout aux processus clés
5. Géré comme un levier stratégique de performance et de résilience

## UC 7 — Maîtrise des habilitations et sécurité au poste

1. Conformité papier ou fragmentée, échéances non gérées
2. Certifications tracées mais manuelles, incomplètes, souvent obsolètes
3. Vue centralisée fiable, recherche « qui est autorisé à faire quoi » possible
4. Conformité intégrée aux opérations, vérification en temps réel avant affectation
5. Opérations sûres en continu : échéances anticipées, preuve toujours disponible

## UC 8 — Préparation et tenue des audits

1. Conformité réactive, preuves à reconstruire à chaque audit
2. Preuves existantes mais consolidation manuelle, fiabilité incertaine
3. Données centralisées et traçables, mais préparation d'audit encore lourde
4. Données fiables, preuves immédiatement accessibles
5. Toujours prêt à l'audit : écarts anticipés et corrigés tôt, responsabilité partagée

## UC 9 — Équité et traçabilité des affectations

1. Opaque et subjectif, aucune règle, aucune visibilité
2. Partiellement structuré, preuve d'équité difficile
3. Affectations visibles et traçables, mais équité non garantie
4. Équité dans les opérations réelles, règles appliquées en pratique
5. Équité proactive et durable, suivie en continu, « by design »

## UC 10 — Reconnaissance et rémunération des compétences

1. Pas de visibilité, reconnaissance subjective, lien arbitraire entre compétences et salaire
2. Règles partiellement définies, incohérentes, difficiles à défendre
3. Cadre conçu mais pas opérationnel, données peu fiables
4. Compétences validées qui guident les vraies décisions de progression
5. Système standardisé, auditable, gouverné financièrement, confiance des syndicats et des salariés

---

## Ce que ça change pour l'outil

**Les libellés doivent être visibles au moment de noter.** Un consultant qui
choisit « 3 » sans lire « vue basique qui sait faire quoi, opérationnelle au
quotidien » notera au ressenti, et l'échelle dérivera d'un site à l'autre. Le
sélecteur de maturité doit donc afficher le texte du niveau, pas seulement le
chiffre — et le texte dépend du use case.

**Cela suppose de relier un processus à un use case**, ce qui n'existe pas
aujourd'hui : le lien est actuellement porté par le nom (« UC 6 - … »), ce qui
ne tient pas dès qu'un consultant renomme un processus. Une clef `use_case`
sur `processus`, renseignée automatiquement quand le processus vient d'une
trame, réglerait la question — et servirait aussi à apparier existant et cible.

**L'hypothèse des trames se vérifie.** Le classeur de diagnostic annonce une
usine lambda de niveau 1 à 2 ; les processus cible décrivent des niveaux 4 à 5.
L'avant/après en maturité est donc déjà porté par les deux trames, il ne reste
qu'à le rendre.

---

## Les clefs, et où elles sont posées

La clef de use case est `uc1` … `uc10`, portée par `processus.use_case`
(nullable — un processus hors catalogue est un cas normal). Elle n'est **jamais
déduite du nom** : c'est précisément ce dont on voulait cesser de dépendre.

Les deux trames la portent déjà, sur les mêmes codes de processus de part et
d'autre :

| code de processus | clef |
|---|---|
| `planification-et-gestion-aleas` | `uc1` |
| `pilotage-charge-capacite` | `uc2` |
| `integration` | `uc3` |
| `transfert-savoir-faire` | `uc4` |
| `standardisation-sites` | `uc5` |
| `pilotage-competences` | `uc6` |
| `habilitations` | `uc7` |
| `audits` | `uc8` |
| `equite-affectations` | `uc9` |
| `reconnaissance` | `uc10` |

**Les diagnostics déjà en base ne l'ont pas.** La migration ajoute la colonne
sans rien remplir, volontairement. Pour les dix processus de chaque trame,
une mise à jour clef par code suffira — les codes sont stables, c'est ce pour
quoi ils ont été fixés. À faire sur autorisation, ce sont des écritures en
production.
