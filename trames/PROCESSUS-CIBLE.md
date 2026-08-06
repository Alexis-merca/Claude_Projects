# Processus cible Mercateam — jet à relire

Dix processus, un par use case. Chaque étape est tirée du « User Journey »
du use case correspondant. **Rien n'a été inventé sur ce que fait le produit** :
là où le journey ne décrit rien, aucune étape n'a été ajoutée.

À relire ligne à ligne : c'est un jet, pas une référence.

**10 processus, 111 étapes.**

---

## UC 6 - Pilotage des compétences

*Référentiel de compétences par poste, cartographie des niveaux réels, mise à jour, usage dans les décisions du quotidien, suivi de la couverture et de la polyvalence.*

Couloirs : Collaborateur · Chef d'équipe · Responsable production · Responsable compétences · RH · Direction site

| N° | Quand | Rôle | Action cible | Supports |
|---|---|---|---|---|
| 1 | Annuel | Responsable compétences | Définit le référentiel de postes et de compétences du site, commun à toutes les UP | Mercateam (Starter) |
| 2 | Annuel | Responsable compétences | Fixe pour chaque poste ce qu'« être opérationnel » veut dire : critères, prérequis, niveau attendu | Mercateam (Starter) |
| 3 | À l'événement | Chef d'équipe | Évalue le niveau réel de chaque opérateur sur la matrice de polyvalence, mise à jour en continu | Mercateam (Master) |
| 4 | À l'événement | Chef d'équipe | La matrice se met à jour d'elle-même après une formation validée, une arrivée ou une mobilité | Mercateam (Master) |
| 5 | Quotidien | Chef d'équipe | Cherche qui sait tenir un poste par recherche multicritère, en quelques secondes | Mercateam (Master) |
| 6 | Continu | Collaborateur | Consulte sa fiche : compétences validées, niveaux atteints, ce qui lui manque pour progresser | Mercateam (Master) |
| 7 | Hebdo | Chef d'équipe | Suit la couverture et les écarts de compétences de son équipe | Mercateam (KPIs) |
| 8 | Mensuel | Responsable production | Suit la polyvalence et les postes critiques de son secteur | Mercateam (KPIs) |
| 9 | Trimestriel | Direction site | Suit les risques, la couverture et la polyvalence à l'échelle du site | Mercateam (KPIs) |
| 10 | À l'événement | RH | Accède à la matrice à jour sans la demander à personne | Mercateam (Master) |

---

## UC 1 - Planification des opérateurs et gestion des aléas

*Construction du planning d'affectation des opérateurs, du cadrage annuel des horaires à la gestion des aléas du jour.*

Couloirs : Collaborateur · Chef d'équipe · Responsable production · Planificateur opérateurs · Supply Chain · RH

| N° | Quand | Rôle | Action cible | Supports |
|---|---|---|---|---|
| 1 | Annuel (N-1) | RH | Fixe les horaires et le plan de roulement de l'année | Mercateam (Planner) |
| 2 | Continu | RH | Absences, congés et contraintes individuelles remontent automatiquement du SIRH | Logiciel (SIRH / GTA), Mercateam (Planner) |
| 3 | Mensuel (M-1) | Collaborateur | Pose ses congés ; la demande arrive directement dans le planning | Mercateam (Planner) |
| 4 | Mi-mois M-1 | Supply Chain | Partage le besoin de production, traduit en effectif par poste | Logiciel (ERP), Mercateam (Planner) |
| 5 | Hebdo (S-1) | Planificateur opérateurs | Duplique le planning de référence au lieu de le reconstruire | Mercateam (Planner) |
| 6 | Hebdo (S-1) | Planificateur opérateurs | Affecte : l'outil ne propose que les opérateurs compétents, habilités et disponibles | Mercateam (Planner) |
| 7 | Hebdo (S-1) | Planificateur opérateurs | Voit en temps réel les postes non couverts, les écarts de compétence et les surcharges | Mercateam (Planner) |
| 8 | Hebdo (S-1) | Chef d'équipe | Comble les manques : mobilité interne, emprunt entre équipes, intérim en dernier recours | Mercateam (Planner) |
| 9 | Prise de poste | Collaborateur | Consulte son affectation sur l'écran d'atelier, à jour en temps réel | TV / écran atelier, Mercateam (Planner) |
| 10 | Jour J | Chef d'équipe | Traite un aléa en réaffectant depuis l'outil ; l'écran d'atelier suit aussitôt | Mercateam (Planner) |
| 11 | Jour J | Chef d'équipe | Est alerté si le remplaçant pressenti n'est pas habilité au poste | Mercateam (Planner) |
| 12 | Mensuel | Responsable production | Compare charge et main-d'œuvre disponible et formée pour anticiper au lieu de réagir | Mercateam (KPIs) |
| 13 | Mensuel | Responsable production | Suit les heures supplémentaires et le recours à l'intérim | Mercateam (KPIs) |

---

## UC 2 - Pilotage de l'adéquation charge / capacité

*Cascade des horizons de planification, traduction de la charge en effectif, pilotage des heures supplémentaires, de l'intérim et des coûts.*

Couloirs : Responsable production · Planificateur opérateurs · Ordonnancement · Supply Chain · Responsable compétences · RH · Contrôle de gestion · Direction site · Direction Groupe

| N° | Quand | Rôle | Action cible | Supports |
|---|---|---|---|---|
| 1 | Annuel (N-1) | Direction Groupe | Transmet les prévisions de volume de l'année à venir | Logiciel (ERP) |
| 2 | Annuel (N-1) | Direction site | Décline le plan et en déduit le budget d'heures et d'effectif | Mercateam (KPIs) |
| 3 | Mensuel (M-1) | Ordonnancement | Construit le plan de production du mois à partir du carnet de commandes | Logiciel (ERP) |
| 4 | Mensuel (M-1) | Supply Chain | Partage la charge traduite en ETP par poste, reprise automatiquement dans le planning | Logiciel (ERP), Mercateam (Planner) |
| 5 | Hebdo (S-1) | Planificateur opérateurs | Construit un plan glissant de référence par duplication | Mercateam (Planner) |
| 6 | Hebdo (S-1) | Planificateur opérateurs | Y injecte les contraintes réelles : absences planifiées, formations, règles RH | Mercateam (Planner) |
| 7 | Hebdo (S-1) | Planificateur opérateurs | Lit l'écart capacité / charge : goulots, postes non couverts, sureffectifs | Mercateam (KPIs) |
| 8 | Hebdo (S-1) | Planificateur opérateurs | Simule plusieurs scénarios d'affectation avant d'arbitrer | Mercateam (Planner) |
| 9 | Hebdo | Responsable production | Arbitre les leviers sur des scénarios chiffrés : heures sup, intérim, mobilité interne | Mercateam (KPIs) |
| 10 | Hebdo | RH | Valide les commandes d'intérim et les heures supplémentaires | Mercateam (Planner) |
| 11 | Mensuel (M+1) | Contrôle de gestion | Extrait les heures réelles et les coûts par centre de coût | Mercateam (KPIs), Logiciel (GTA / paie) |
| 12 | Mensuel | Responsable compétences | Convertit les écarts de compétence récurrents en plan de formation | Mercateam (Trainer) |
| 13 | Mensuel (M+1) | Direction site | Arbitre en comparant les scénarios coût / risque / service | Mercateam (KPIs) |

---

## UC 3 - Intégration des nouveaux collaborateurs

*Parcours d'accueil et d'intégration d'un nouvel arrivant, de l'annonce de l'arrivée à la validation de l'autonomie.*

Couloirs : Collaborateur · Tuteur · Chef d'équipe · Responsable production · Responsable compétences · RH · QHSE / EHS · Qualité · Direction site

| N° | Quand | Rôle | Action cible | Supports |
|---|---|---|---|---|
| 1 | J-X | Responsable compétences | Structure le parcours d'intégration et d'apprentissage, par poste | Mercateam (Trainer) |
| 2 | J-X | RH | Déclare l'arrivée ; le parcours d'intégration se déclenche automatiquement | Mercateam (Starter) |
| 3 | J-X | Collaborateur | Suit son pré-accueil sur mobile, avant d'arriver sur site | Mercateam (Trainer) |
| 4 | À l'arrivée | Responsable production | Accueille le collaborateur ; l'émargement est numérique | Mercateam (Trainer) |
| 5 | À l'arrivée | QHSE / EHS | Anime l'accueil sécurité ; QCM et signature sont enregistrés sur la fiche | Mercateam (Trainer) |
| 6 | À l'arrivée | Qualité | Anime l'accueil qualité ; la validation est attachée au collaborateur | Mercateam (Trainer) |
| 7 | J+X | Tuteur | Forme au poste et documente chaque étape validée au fil de l'eau | Mercateam (Trainer) |
| 8 | J+X | Tuteur | Fait passer l'évaluation finale ; la preuve est générée et signée dans l'outil | Mercateam (Trainer) |
| 9 | J+X | Qualité | Réalise l'audit de poste et l'attache à la fiche du collaborateur | Mercateam (Trainer) |
| 10 | J+X | Chef d'équipe | La matrice de polyvalence se met à jour dès la validation, sans ressaisie | Mercateam (Master) |
| 11 | Mensuel | Responsable compétences | Suit la progression de chaque parcours et relance ce qui traîne | Mercateam (Trainer) |
| 12 | Trimestriel | Direction site | Suit le délai réel d'autonomie et le compare à l'objectif | Mercateam (KPIs) |

---

## UC 4 - Capitalisation et transfert des savoir-faire critiques

*Identification des savoir-faire critiques, construction et cycle de vie des modes opératoires, transfert par compagnonnage, maintien et recyclage des compétences.*

Couloirs : Collaborateur · Tuteur · Chef d'équipe · Responsable compétences · RH · Qualité · Amélioration continue · Service technique · Direction site

| N° | Quand | Rôle | Action cible | Supports |
|---|---|---|---|---|
| 1 | Annuel | Direction site | Identifie les zones critiques : postes tenus par une seule personne, départs à venir | Mercateam (KPIs) |
| 2 | Annuel | RH | Partage la pyramide des âges et le plan de départs | Logiciel (SIRH / GTA), Mercateam (KPIs) |
| 3 | Annuel | Responsable compétences | Arrête le plan d'action : formation, recrutement, mobilité | Mercateam (KPIs) |
| 4 | À l'événement | Amélioration continue | Déclenche la création ou la mise à jour d'un mode opératoire | Mercateam (Trainer) |
| 5 | À l'événement | Service technique | Rédige le mode opératoire, photos et vidéos intégrées | Mercateam (Trainer) |
| 6 | À l'événement | Collaborateur | Relit le document ; son retour est tracé, pas seulement dit à l'oral | Mercateam (Trainer) |
| 7 | À l'événement | Qualité | Valide le document et lui attribue un indice ; l'ancienne version est retirée d'office | Mercateam (Trainer) |
| 8 | À l'événement | Qualité | Diffuse la nouvelle version aux personnes concernées et suit les acquittements | Mercateam (Trainer) |
| 9 | Quotidien | Collaborateur | Consulte au poste le mode opératoire à jour, par QR code | Mercateam (Trainer) |
| 10 | À l'événement | Tuteur | Forme au poste en s'appuyant sur le mode opératoire validé, pas sur sa seule pratique | Mercateam (Trainer) |
| 11 | À l'événement | Tuteur | Valide la formation ; la preuve signée est générée automatiquement | Mercateam (Trainer) |
| 12 | Continu | Collaborateur | Signale depuis le poste un écart entre le document et la réalité | Mercateam (Trainer) |
| 13 | Mensuel | Chef d'équipe | Est alerté des compétences à revalider avant qu'elles n'expirent | Mercateam (Trainer) |
| 14 | Trimestriel | Responsable compétences | Réalise des audits terrain aléatoires pour vérifier que le geste est conforme | Mercateam (Trainer) |
| 15 | Trimestriel | Direction site | Suit la couverture, la polyvalence et l'exposition aux départs | Mercateam (KPIs) |

---

## UC 5 - Standardisation multi-sites de la gestion du savoir-faire

*Référentiels locaux, diffusion des standards par les directions transverses, mobilité inter-sites et comparabilité des données au niveau Groupe.*

Couloirs : Collaborateur · Chef d'équipe · RH site · Direction Groupe · Direction transverse Groupe

| N° | Quand | Rôle | Action cible | Supports |
|---|---|---|---|---|
| 1 | Annuel | Direction transverse Groupe | Définit un référentiel de compétences commun à tous les sites | Mercateam (Starter) |
| 2 | Annuel | Direction transverse Groupe | Définit des parcours de formation et de transfert communs | Mercateam (Trainer) |
| 3 | Continu | RH site | Structure les postes du site selon le modèle commun, sans créer son propre référentiel | Mercateam (Starter) |
| 4 | Continu | Chef d'équipe | Cartographie les compétences de son équipe dans ce référentiel unique | Mercateam (Master) |
| 5 | À l'événement | Chef d'équipe | Cherche à l'échelle du Groupe qui est formé sur un poste | Mercateam (Master) |
| 6 | À l'arrivée | Collaborateur | Arrive d'un autre site : ses compétences validées sont déjà reconnues | Mercateam (Master) |
| 7 | À l'événement | RH site | Clôture la mission ; les compétences acquises restent attachées au collaborateur | Mercateam (Master) |
| 8 | Continu | Direction Groupe | Lit une vue consolidée et comparable, sans campagne de collecte | Mercateam (KPIs) |
| 9 | Trimestriel | Direction Groupe | Compare couverture, risques et postes critiques entre sites | Mercateam (KPIs) |

---

## UC 7 - Maîtrise des habilitations et sécurité au poste

*Habilitations et autorisations requises par poste, restrictions médicales, suivi des échéances, contrôle avant affectation.*

Couloirs : Collaborateur · Chef d'équipe · Planificateur opérateurs · Responsable formation · RH · QHSE / EHS · Direction site

| N° | Quand | Rôle | Action cible | Supports |
|---|---|---|---|---|
| 1 | Annuel | QHSE / EHS | Définit pour chaque poste ce qu'« autorisé à travailler » veut dire | Mercateam (Starter) |
| 2 | À l'arrivée | RH | Enregistre titres, CACES et visites médicales sur la fiche du collaborateur | Mercateam (Starter) |
| 3 | Continu | QHSE / EHS | Les échéances sont suivies automatiquement : plus de fichier de suivi parallèle | Mercateam (Trainer) |
| 4 | Mensuel | Responsable formation | Est alerté des recyclages à programmer, deux mois avant échéance | Mercateam (Trainer) |
| 5 | À l'événement | RH | L'attestation de l'organisme est déposée sur la fiche et datée | Mercateam (Trainer) |
| 6 | Hebdo (S-1) | Planificateur opérateurs | L'outil refuse d'affecter un opérateur non habilité au poste | Mercateam (Planner) |
| 7 | Jour J | Chef d'équipe | Est alerté avant l'affectation, pas après l'incident | Mercateam (Planner) |
| 8 | Continu | Collaborateur | Voit ses habilitations et leurs dates de validité sur sa fiche | Mercateam (Starter) |
| 9 | Continu | Planificateur opérateurs | Les limites de temps de travail et de temps sur poste contraignant sont contrôlées à l'affectation | Mercateam (Planner) |
| 10 | Trimestriel | Direction site | Lit le taux de conformité sans le reconstruire à la main | Mercateam (KPIs) |

---

## UC 8 - Préparation et tenue des audits

*Préparation des preuves de compétences et d'habilitations, déroulé de l'audit, suivi des remarques.*

Couloirs : Responsable compétences · QHSE / EHS · Qualité · Auditeur

| N° | Quand | Rôle | Action cible | Supports |
|---|---|---|---|---|
| 1 | Annuel (N-1) | Qualité | Planifie les audits internes, clients et de certification de l'année | Mercateam (KPIs) |
| 2 | Continu | Responsable compétences | Les preuves de formation sont générées et historisées au fil de l'eau | Mercateam (Trainer) |
| 3 | Continu | QHSE / EHS | Les documents de conformité sont stockés sur la fiche du collaborateur | Mercateam (Starter) |
| 4 | Mensuel | Qualité | Vérifie l'état de préparation en continu, plutôt qu'à l'approche de l'audit | Mercateam (KPIs) |
| 5 | Mensuel (M-1) | Qualité | Corrige les écarts détectés avant la visite, sans reconstituer de dossier | Mercateam (KPIs) |
| 6 | Jour J | Auditeur | Accède aux preuves et aux fiches à jour en séance | Mercateam (Starter) |
| 7 | Jour J | Qualité | Sort une pièce demandée en quelques clics, sans quitter la salle | Mercateam (Starter) |
| 8 | Jour J | Qualité | Relie un défaut ou un ordre de fabrication au collaborateur concerné | Mercateam (Master) |
| 9 | J+X | Qualité | Ouvre et suit le plan d'action sur les remarques reçues | Mercateam (KPIs) |
| 10 | À l'audit | Qualité | Le dossier n'est pas reconstitué : il est déjà à jour | Mercateam (Starter) |

---

## UC 9 - Équité et traçabilité des affectations

*Règles d'affectation, rotation sur les postes contraignants, capacité à prouver l'équité dans le temps.*

Couloirs : Collaborateur · Chef d'équipe · Responsable production · Planificateur opérateurs · RH · Direction site

| N° | Quand | Rôle | Action cible | Supports |
|---|---|---|---|---|
| 1 | Annuel | RH | Définit des règles d'affectation objectives : rotation, pénibilité, restrictions | Mercateam (Planner) |
| 2 | À l'événement | RH | Saisit une restriction médicale ; elle contraint l'affectation dès le lendemain | Mercateam (Planner) |
| 3 | Prise de poste | Chef d'équipe | Affecte sur des faits : compétences, habilitations, contraintes légales | Mercateam (Planner) |
| 4 | Continu | Planificateur opérateurs | La rotation sur les postes contraignants est suivie et équilibrée | Mercateam (Planner) |
| 5 | Continu | Collaborateur | Voit ses affectations passées et les critères qui les ont motivées | Mercateam (Planner) |
| 6 | À l'événement | RH | Répond à une réclamation avec l'historique complet des affectations | Mercateam (KPIs) |
| 7 | Mensuel | Responsable production | Suit la répartition des postes contraignants, opérateur par opérateur | Mercateam (KPIs) |
| 8 | Mensuel | Direction site | Suit l'absentéisme et le turnover en regard de la charge subie | Mercateam (KPIs) |
| 9 | Annuel | Direction site | Prouve l'équité en instance, chiffres à l'appui | Mercateam (KPIs) |

---

## UC 10 - Reconnaissance et rémunération des compétences

*Lien entre compétences validées, progression, classification et rémunération.*

Couloirs : Collaborateur · Tuteur · Chef d'équipe · Responsable compétences · RH · Direction site

| N° | Quand | Rôle | Action cible | Supports |
|---|---|---|---|---|
| 1 | Annuel (N-1) | RH | Définit le modèle de compétences, les niveaux, les incréments et les règles d'expiration | Mercateam (Starter) |
| 2 | Annuel (N-1) | RH | Aligne RH, Finance et Opérations sur ce que vaut chaque niveau | Mercateam (Starter) |
| 3 | Annuel | Responsable compétences | Définit avec des critères objectifs, checklists et prérequis ce qu'être compétent veut dire | Mercateam (Master) |
| 4 | Annuel | Chef d'équipe | Fixe des objectifs de progression tirés des besoins industriels | Mercateam (KPIs) |
| 5 | À l'événement | Tuteur | Valide une compétence sur preuve documentée, pas au jugé | Mercateam (Trainer) |
| 6 | Continu | Collaborateur | Voit les compétences requises, son positionnement et ce qui lui manque pour progresser | Mercateam (Master) |
| 7 | Annuel | Chef d'équipe | Propose une évolution appuyée sur des compétences validées | Mercateam (Master) |
| 8 | Annuel | RH | Arbitre en connaissant l'exposition financière des compétences déjà acquises | Mercateam (KPIs) |
| 9 | Annuel | RH | Explique la décision au collaborateur et aux représentants, critères à l'appui | Mercateam (KPIs) |
| 10 | Trimestriel | Direction site | Suit couverture, polyvalence et exposition à la rémunération | Mercateam (KPIs) |

---
