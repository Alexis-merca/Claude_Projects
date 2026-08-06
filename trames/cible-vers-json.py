#!/usr/bin/env python3
"""Jet des dix processus CIBLE (après déploiement Mercateam).

Chaque étape est tirée du « User Journey » du use case correspondant dans la
base de connaissance Top Use Cases. Rien n'est inventé sur ce que fait le
produit : quand le journey ne dit rien, l'étape n'existe pas.

Produit deux fichiers tenus en phase :
  - cible-mercateam.json   importable tel quel (format client_json v1)
  - PROCESSUS-CIBLE.md     le même contenu, relisible ligne à ligne
"""

import json
import re
import unicodedata

BASE = ("/tmp/claude-0/-home-user-Claude-Projects/"
        "a0555995-c6c1-5fb2-8d4d-e4f6f9232744/scratchpad/")

# Ordre de reference des couloirs. Reprend celui du classeur de diagnostic pour
# que la cible et l'existant se lisent lane par lane, avec « Responsable
# competences » insere : c'est le seul role que la cible introduit.
ROLES_REF = [
    "Collaborateur", "Tuteur", "Chef d'équipe", "Superviseur d'UP",
    "Responsable production", "Planificateur opérateurs", "Ordonnancement",
    "Méthodes / Engineering", "Supply Chain", "Responsable compétences",
    "Responsable formation", "RH", "RH site", "QHSE / EHS", "Qualité",
    "Amélioration continue", "Service technique", "Contrôle de gestion",
    "Direction site", "Direction Groupe", "Direction transverse Groupe",
    "Agence d'intérim", "Auditeur",
]

# (quand, role, action, supports)
UC = [
 ("pilotage-competences", "UC 6 - Pilotage des compétences",
  "Référentiel de compétences par poste, cartographie des niveaux réels, mise à jour, "
  "usage dans les décisions du quotidien, suivi de la couverture et de la polyvalence.",
  [
   ("Annuel", "Responsable compétences", "Définit le référentiel de postes et de compétences du site, commun à toutes les UP", "Mercateam (Starter)"),
   ("Annuel", "Responsable compétences", "Fixe pour chaque poste ce qu'« être opérationnel » veut dire : critères, prérequis, niveau attendu", "Mercateam (Starter)"),
   ("À l'événement", "Chef d'équipe", "Évalue le niveau réel de chaque opérateur sur la matrice de polyvalence, mise à jour en continu", "Mercateam (Master)"),
   ("À l'événement", "Chef d'équipe", "La matrice se met à jour d'elle-même après une formation validée, une arrivée ou une mobilité", "Mercateam (Master)"),
   ("Quotidien", "Chef d'équipe", "Cherche qui sait tenir un poste par recherche multicritère, en quelques secondes", "Mercateam (Master)"),
   ("Continu", "Collaborateur", "Consulte sa fiche : compétences validées, niveaux atteints, ce qui lui manque pour progresser", "Mercateam (Master)"),
   ("Hebdo", "Chef d'équipe", "Suit la couverture et les écarts de compétences de son équipe", "Mercateam (KPIs)"),
   ("Mensuel", "Responsable production", "Suit la polyvalence et les postes critiques de son secteur", "Mercateam (KPIs)"),
   ("Trimestriel", "Direction site", "Suit les risques, la couverture et la polyvalence à l'échelle du site", "Mercateam (KPIs)"),
   ("À l'événement", "RH", "Accède à la matrice à jour sans la demander à personne", "Mercateam (Master)"),
  ]),

 ("planification-et-gestion-aleas", "UC 1 - Planification des opérateurs et gestion des aléas",
  "Construction du planning d'affectation des opérateurs, du cadrage annuel des horaires "
  "à la gestion des aléas du jour.",
  [
   ("Annuel (N-1)", "RH", "Fixe les horaires et le plan de roulement de l'année", "Mercateam (Planner)"),
   ("Continu", "RH", "Absences, congés et contraintes individuelles remontent automatiquement du SIRH", "Logiciel (SIRH / GTA), Mercateam (Planner)"),
   ("Mensuel (M-1)", "Collaborateur", "Pose ses congés ; la demande arrive directement dans le planning", "Mercateam (Planner)"),
   ("Mi-mois M-1", "Supply Chain", "Partage le besoin de production, traduit en effectif par poste", "Logiciel (ERP), Mercateam (Planner)"),
   ("Hebdo (S-1)", "Planificateur opérateurs", "Duplique le planning de référence au lieu de le reconstruire", "Mercateam (Planner)"),
   ("Hebdo (S-1)", "Planificateur opérateurs", "Affecte : l'outil ne propose que les opérateurs compétents, habilités et disponibles", "Mercateam (Planner)"),
   ("Hebdo (S-1)", "Planificateur opérateurs", "Voit en temps réel les postes non couverts, les écarts de compétence et les surcharges", "Mercateam (Planner)"),
   ("Hebdo (S-1)", "Chef d'équipe", "Comble les manques : mobilité interne, emprunt entre équipes, intérim en dernier recours", "Mercateam (Planner)"),
   ("Prise de poste", "Collaborateur", "Consulte son affectation sur l'écran d'atelier, à jour en temps réel", "TV / écran atelier, Mercateam (Planner)"),
   ("Jour J", "Chef d'équipe", "Traite un aléa en réaffectant depuis l'outil ; l'écran d'atelier suit aussitôt", "Mercateam (Planner)"),
   ("Jour J", "Chef d'équipe", "Est alerté si le remplaçant pressenti n'est pas habilité au poste", "Mercateam (Planner)"),
   ("Mensuel", "Responsable production", "Compare charge et main-d'œuvre disponible et formée pour anticiper au lieu de réagir", "Mercateam (KPIs)"),
   ("Mensuel", "Responsable production", "Suit les heures supplémentaires et le recours à l'intérim", "Mercateam (KPIs)"),
  ]),

 ("pilotage-charge-capacite", "UC 2 - Pilotage de l'adéquation charge / capacité",
  "Cascade des horizons de planification, traduction de la charge en effectif, pilotage "
  "des heures supplémentaires, de l'intérim et des coûts.",
  [
   ("Annuel (N-1)", "Direction Groupe", "Transmet les prévisions de volume de l'année à venir", "Logiciel (ERP)"),
   ("Annuel (N-1)", "Direction site", "Décline le plan et en déduit le budget d'heures et d'effectif", "Mercateam (KPIs)"),
   ("Mensuel (M-1)", "Ordonnancement", "Construit le plan de production du mois à partir du carnet de commandes", "Logiciel (ERP)"),
   ("Mensuel (M-1)", "Supply Chain", "Partage la charge traduite en ETP par poste, reprise automatiquement dans le planning", "Logiciel (ERP), Mercateam (Planner)"),
   ("Hebdo (S-1)", "Planificateur opérateurs", "Construit un plan glissant de référence par duplication", "Mercateam (Planner)"),
   ("Hebdo (S-1)", "Planificateur opérateurs", "Y injecte les contraintes réelles : absences planifiées, formations, règles RH", "Mercateam (Planner)"),
   ("Hebdo (S-1)", "Planificateur opérateurs", "Lit l'écart capacité / charge : goulots, postes non couverts, sureffectifs", "Mercateam (KPIs)"),
   ("Hebdo (S-1)", "Planificateur opérateurs", "Simule plusieurs scénarios d'affectation avant d'arbitrer", "Mercateam (Planner)"),
   ("Hebdo", "Responsable production", "Arbitre les leviers sur des scénarios chiffrés : heures sup, intérim, mobilité interne", "Mercateam (KPIs)"),
   ("Hebdo", "RH", "Valide les commandes d'intérim et les heures supplémentaires", "Mercateam (Planner)"),
   ("Mensuel (M+1)", "Contrôle de gestion", "Extrait les heures réelles et les coûts par centre de coût", "Mercateam (KPIs), Logiciel (GTA / paie)"),
   ("Mensuel", "Responsable compétences", "Convertit les écarts de compétence récurrents en plan de formation", "Mercateam (Trainer)"),
   ("Mensuel (M+1)", "Direction site", "Arbitre en comparant les scénarios coût / risque / service", "Mercateam (KPIs)"),
  ]),

 ("integration", "UC 3 - Intégration des nouveaux collaborateurs",
  "Parcours d'accueil et d'intégration d'un nouvel arrivant, de l'annonce de l'arrivée "
  "à la validation de l'autonomie.",
  [
   ("J-X", "Responsable compétences", "Structure le parcours d'intégration et d'apprentissage, par poste", "Mercateam (Trainer)"),
   ("J-X", "RH", "Déclare l'arrivée ; le parcours d'intégration se déclenche automatiquement", "Mercateam (Starter)"),
   ("J-X", "Collaborateur", "Suit son pré-accueil sur mobile, avant d'arriver sur site", "Mercateam (Trainer)"),
   ("À l'arrivée", "Responsable production", "Accueille le collaborateur ; l'émargement est numérique", "Mercateam (Trainer)"),
   ("À l'arrivée", "QHSE / EHS", "Anime l'accueil sécurité ; QCM et signature sont enregistrés sur la fiche", "Mercateam (Trainer)"),
   ("À l'arrivée", "Qualité", "Anime l'accueil qualité ; la validation est attachée au collaborateur", "Mercateam (Trainer)"),
   ("J+X", "Tuteur", "Forme au poste et documente chaque étape validée au fil de l'eau", "Mercateam (Trainer)"),
   ("J+X", "Tuteur", "Fait passer l'évaluation finale ; la preuve est générée et signée dans l'outil", "Mercateam (Trainer)"),
   ("J+X", "Qualité", "Réalise l'audit de poste et l'attache à la fiche du collaborateur", "Mercateam (Trainer)"),
   ("J+X", "Chef d'équipe", "La matrice de polyvalence se met à jour dès la validation, sans ressaisie", "Mercateam (Master)"),
   ("Mensuel", "Responsable compétences", "Suit la progression de chaque parcours et relance ce qui traîne", "Mercateam (Trainer)"),
   ("Trimestriel", "Direction site", "Suit le délai réel d'autonomie et le compare à l'objectif", "Mercateam (KPIs)"),
  ]),

 ("transfert-savoir-faire", "UC 4 - Capitalisation et transfert des savoir-faire critiques",
  "Identification des savoir-faire critiques, construction et cycle de vie des modes "
  "opératoires, transfert par compagnonnage, maintien et recyclage des compétences.",
  [
   ("Annuel", "Direction site", "Identifie les zones critiques : postes tenus par une seule personne, départs à venir", "Mercateam (KPIs)"),
   ("Annuel", "RH", "Partage la pyramide des âges et le plan de départs", "Logiciel (SIRH / GTA), Mercateam (KPIs)"),
   ("Annuel", "Responsable compétences", "Arrête le plan d'action : formation, recrutement, mobilité", "Mercateam (KPIs)"),
   ("À l'événement", "Amélioration continue", "Déclenche la création ou la mise à jour d'un mode opératoire", "Mercateam (Trainer)"),
   ("À l'événement", "Service technique", "Rédige le mode opératoire, photos et vidéos intégrées", "Mercateam (Trainer)"),
   ("À l'événement", "Collaborateur", "Relit le document ; son retour est tracé, pas seulement dit à l'oral", "Mercateam (Trainer)"),
   ("À l'événement", "Qualité", "Valide le document et lui attribue un indice ; l'ancienne version est retirée d'office", "Mercateam (Trainer)"),
   ("À l'événement", "Qualité", "Diffuse la nouvelle version aux personnes concernées et suit les acquittements", "Mercateam (Trainer)"),
   ("Quotidien", "Collaborateur", "Consulte au poste le mode opératoire à jour, par QR code", "Mercateam (Trainer)"),
   ("À l'événement", "Tuteur", "Forme au poste en s'appuyant sur le mode opératoire validé, pas sur sa seule pratique", "Mercateam (Trainer)"),
   ("À l'événement", "Tuteur", "Valide la formation ; la preuve signée est générée automatiquement", "Mercateam (Trainer)"),
   ("Continu", "Collaborateur", "Signale depuis le poste un écart entre le document et la réalité", "Mercateam (Trainer)"),
   ("Mensuel", "Chef d'équipe", "Est alerté des compétences à revalider avant qu'elles n'expirent", "Mercateam (Trainer)"),
   ("Trimestriel", "Responsable compétences", "Réalise des audits terrain aléatoires pour vérifier que le geste est conforme", "Mercateam (Trainer)"),
   ("Trimestriel", "Direction site", "Suit la couverture, la polyvalence et l'exposition aux départs", "Mercateam (KPIs)"),
  ]),

 ("standardisation-sites", "UC 5 - Standardisation multi-sites de la gestion du savoir-faire",
  "Référentiels locaux, diffusion des standards par les directions transverses, mobilité "
  "inter-sites et comparabilité des données au niveau Groupe.",
  [
   ("Annuel", "Direction transverse Groupe", "Définit un référentiel de compétences commun à tous les sites", "Mercateam (Starter)"),
   ("Annuel", "Direction transverse Groupe", "Définit des parcours de formation et de transfert communs", "Mercateam (Trainer)"),
   ("Continu", "RH site", "Structure les postes du site selon le modèle commun, sans créer son propre référentiel", "Mercateam (Starter)"),
   ("Continu", "Chef d'équipe", "Cartographie les compétences de son équipe dans ce référentiel unique", "Mercateam (Master)"),
   ("À l'événement", "Chef d'équipe", "Cherche à l'échelle du Groupe qui est formé sur un poste", "Mercateam (Master)"),
   ("À l'arrivée", "Collaborateur", "Arrive d'un autre site : ses compétences validées sont déjà reconnues", "Mercateam (Master)"),
   ("À l'événement", "RH site", "Clôture la mission ; les compétences acquises restent attachées au collaborateur", "Mercateam (Master)"),
   ("Continu", "Direction Groupe", "Lit une vue consolidée et comparable, sans campagne de collecte", "Mercateam (KPIs)"),
   ("Trimestriel", "Direction Groupe", "Compare couverture, risques et postes critiques entre sites", "Mercateam (KPIs)"),
  ]),

 ("habilitations", "UC 7 - Maîtrise des habilitations et sécurité au poste",
  "Habilitations et autorisations requises par poste, restrictions médicales, suivi des "
  "échéances, contrôle avant affectation.",
  [
   ("Annuel", "QHSE / EHS", "Définit pour chaque poste ce qu'« autorisé à travailler » veut dire", "Mercateam (Starter)"),
   ("À l'arrivée", "RH", "Enregistre titres, CACES et visites médicales sur la fiche du collaborateur", "Mercateam (Starter)"),
   ("Continu", "QHSE / EHS", "Les échéances sont suivies automatiquement : plus de fichier de suivi parallèle", "Mercateam (Trainer)"),
   ("Mensuel", "Responsable formation", "Est alerté des recyclages à programmer, deux mois avant échéance", "Mercateam (Trainer)"),
   ("À l'événement", "RH", "L'attestation de l'organisme est déposée sur la fiche et datée", "Mercateam (Trainer)"),
   ("Hebdo (S-1)", "Planificateur opérateurs", "L'outil refuse d'affecter un opérateur non habilité au poste", "Mercateam (Planner)"),
   ("Jour J", "Chef d'équipe", "Est alerté avant l'affectation, pas après l'incident", "Mercateam (Planner)"),
   ("Continu", "Collaborateur", "Voit ses habilitations et leurs dates de validité sur sa fiche", "Mercateam (Starter)"),
   ("Continu", "Planificateur opérateurs", "Les limites de temps de travail et de temps sur poste contraignant sont contrôlées à l'affectation", "Mercateam (Planner)"),
   ("Trimestriel", "Direction site", "Lit le taux de conformité sans le reconstruire à la main", "Mercateam (KPIs)"),
  ]),

 ("audits", "UC 8 - Préparation et tenue des audits",
  "Préparation des preuves de compétences et d'habilitations, déroulé de l'audit, suivi "
  "des remarques.",
  [
   ("Annuel (N-1)", "Qualité", "Planifie les audits internes, clients et de certification de l'année", "Mercateam (KPIs)"),
   ("Continu", "Responsable compétences", "Les preuves de formation sont générées et historisées au fil de l'eau", "Mercateam (Trainer)"),
   ("Continu", "QHSE / EHS", "Les documents de conformité sont stockés sur la fiche du collaborateur", "Mercateam (Starter)"),
   ("Mensuel", "Qualité", "Vérifie l'état de préparation en continu, plutôt qu'à l'approche de l'audit", "Mercateam (KPIs)"),
   ("Mensuel (M-1)", "Qualité", "Corrige les écarts détectés avant la visite, sans reconstituer de dossier", "Mercateam (KPIs)"),
   ("Jour J", "Auditeur", "Accède aux preuves et aux fiches à jour en séance", "Mercateam (Starter)"),
   ("Jour J", "Qualité", "Sort une pièce demandée en quelques clics, sans quitter la salle", "Mercateam (Starter)"),
   ("Jour J", "Qualité", "Relie un défaut ou un ordre de fabrication au collaborateur concerné", "Mercateam (Master)"),
   ("J+X", "Qualité", "Ouvre et suit le plan d'action sur les remarques reçues", "Mercateam (KPIs)"),
   ("À l'audit", "Qualité", "Le dossier n'est pas reconstitué : il est déjà à jour", "Mercateam (Starter)"),
  ]),

 ("equite-affectations", "UC 9 - Équité et traçabilité des affectations",
  "Règles d'affectation, rotation sur les postes contraignants, capacité à prouver "
  "l'équité dans le temps.",
  [
   ("Annuel", "RH", "Définit des règles d'affectation objectives : rotation, pénibilité, restrictions", "Mercateam (Planner)"),
   ("À l'événement", "RH", "Saisit une restriction médicale ; elle contraint l'affectation dès le lendemain", "Mercateam (Planner)"),
   ("Prise de poste", "Chef d'équipe", "Affecte sur des faits : compétences, habilitations, contraintes légales", "Mercateam (Planner)"),
   ("Continu", "Planificateur opérateurs", "La rotation sur les postes contraignants est suivie et équilibrée", "Mercateam (Planner)"),
   ("Continu", "Collaborateur", "Voit ses affectations passées et les critères qui les ont motivées", "Mercateam (Planner)"),
   ("À l'événement", "RH", "Répond à une réclamation avec l'historique complet des affectations", "Mercateam (KPIs)"),
   ("Mensuel", "Responsable production", "Suit la répartition des postes contraignants, opérateur par opérateur", "Mercateam (KPIs)"),
   ("Mensuel", "Direction site", "Suit l'absentéisme et le turnover en regard de la charge subie", "Mercateam (KPIs)"),
   ("Annuel", "Direction site", "Prouve l'équité en instance, chiffres à l'appui", "Mercateam (KPIs)"),
  ]),

 ("reconnaissance", "UC 10 - Reconnaissance et rémunération des compétences",
  "Lien entre compétences validées, progression, classification et rémunération.",
  [
   ("Annuel (N-1)", "RH", "Définit le modèle de compétences, les niveaux, les incréments et les règles d'expiration", "Mercateam (Starter)"),
   ("Annuel (N-1)", "RH", "Aligne RH, Finance et Opérations sur ce que vaut chaque niveau", "Mercateam (Starter)"),
   ("Annuel", "Responsable compétences", "Définit avec des critères objectifs, checklists et prérequis ce qu'être compétent veut dire", "Mercateam (Master)"),
   ("Annuel", "Chef d'équipe", "Fixe des objectifs de progression tirés des besoins industriels", "Mercateam (KPIs)"),
   ("À l'événement", "Tuteur", "Valide une compétence sur preuve documentée, pas au jugé", "Mercateam (Trainer)"),
   ("Continu", "Collaborateur", "Voit les compétences requises, son positionnement et ce qui lui manque pour progresser", "Mercateam (Master)"),
   ("Annuel", "Chef d'équipe", "Propose une évolution appuyée sur des compétences validées", "Mercateam (Master)"),
   ("Annuel", "RH", "Arbitre en connaissant l'exposition financière des compétences déjà acquises", "Mercateam (KPIs)"),
   ("Annuel", "RH", "Explique la décision au collaborateur et aux représentants, critères à l'appui", "Mercateam (KPIs)"),
   ("Trimestriel", "Direction site", "Suit couverture, polyvalence et exposition à la rémunération", "Mercateam (KPIs)"),
  ]),
]

OUTILS = [
    "Mercateam (Starter)", "Mercateam (Master)", "Mercateam (Trainer)",
    "Mercateam (Planner)", "Mercateam (KPIs)",
    "Logiciel (SIRH / GTA)", "Logiciel (GTA / paie)", "Logiciel (ERP)",
    "Logiciel (ERP / MES)", "TV / écran atelier",
]

NOTES = """Trame CIBLE — le processus tel qu'il tourne après déploiement Mercateam.

À lire en regard de « Template use case », qui porte le relevé de l'existant.
Les codes de processus sont identiques de part et d'autre : c'est ce qui
permettra de les apparier quand la variante existant / cible sera en place.

Source des étapes : les « User Journey » de la base de connaissance Top Use
Cases Mercateam. Là où le journey ne décrit rien, aucune étape n'a été
inventée — un processus cible court est un processus cible honnête.

Ce que la cible ne prétend pas remplacer : le SIRH et la GTA restent la source
des absences et des temps, l'ERP reste la source de la charge. Mercateam s'y
branche. Les faire disparaître du schéma donnerait un avant/après flatteur et
faux."""


def slug(v):
    v = unicodedata.normalize("NFD", v.lower())
    v = "".join(c for c in v if unicodedata.category(c) != "Mn")
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", v))


processus, hors_ref = [], set()
for code, nom, perimetre, etapes in UC:
    utilises = []
    for _, role, _, _ in etapes:
        if role not in utilises:
            utilises.append(role)
    roles = [r for r in ROLES_REF if r in utilises]
    for r in utilises:
        if r not in ROLES_REF:
            roles.append(r)
            hors_ref.add(r)

    processus.append({
        "code": code,
        "nom": nom,
        "soustitre": perimetre,
        "rang": len(processus) + 1,
        "roles": roles,
        "etapes": [{
            "ordre": i, "role": role, "role2": "", "phase": quand,
            "texte": texte, "supports": supports, "lien": "",
        } for i, (quand, role, texte, supports) in enumerate(etapes, 1)],
        "frictions": [],
        "chiffres": [],
    })

sortie = {
    "format": "diagnostic-os",
    "version": 1,
    "client": {
        "code": "cible-mercateam",
        "nom": "Template use case — cible Mercateam",
        "site": "Trame de référence",
        "date_visite": "",
        "notes": NOTES,
        "outils": OUTILS,
        "si": {},
        "processus": processus,
    },
}

with open(BASE + "cible-mercateam.json", "w", encoding="utf-8") as f:
    json.dump(sortie, f, ensure_ascii=False, indent=2)
    f.write("\n")

# --- version relisible ------------------------------------------------------
L = ["# Processus cible Mercateam — jet à relire", "",
     "Dix processus, un par use case. Chaque étape est tirée du « User Journey »",
     "du use case correspondant. **Rien n'a été inventé sur ce que fait le produit** :",
     "là où le journey ne décrit rien, aucune étape n'a été ajoutée.", "",
     "À relire ligne à ligne : c'est un jet, pas une référence.", "",
     f"**{len(processus)} processus, "
     f"{sum(len(p['etapes']) for p in processus)} étapes.**", "", "---", ""]
for p in processus:
    L += [f"## {p['nom']}", "", f"*{p['soustitre']}*", "",
          f"Couloirs : {' · '.join(p['roles'])}", "",
          "| N° | Quand | Rôle | Action cible | Supports |",
          "|---|---|---|---|---|"]
    for e in p["etapes"]:
        L.append(f"| {e['ordre']} | {e['phase']} | {e['role']} | {e['texte']} | {e['supports']} |")
    L += ["", "---", ""]
with open(BASE + "PROCESSUS-CIBLE.md", "w", encoding="utf-8") as f:
    f.write("\n".join(L))

print(f"processus : {len(processus)}")
print(f"etapes    : {sum(len(p['etapes']) for p in processus)}")
print(f"roles hors referentiel du classeur : {sorted(hors_ref) or 'aucun'}")
for p in processus:
    print(f"  {len(p['etapes']):2} etapes, {len(p['roles'])} roles  {p['nom']}")
