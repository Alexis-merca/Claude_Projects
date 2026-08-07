# -*- coding: utf-8 -*-
"""Chiffres attendus : avant (placement unique + table B) / apres (multi-blocs + use_case -> bloc)."""
import json, re, unicodedata
src = open('multibloc.py').read().split('rows = json.load')[0]
exec(src)   # TABLE_A, GENERIQUES, TABLE_B, norm, corr, bloc_processus, classer

TRAME = [
 ("sirh","SIRH & GTA",["Données collaborateurs","Absences","Roulements horaires","Contrats et paie"]),
 ("competence","Compétences",["Matrice de polyvalence","Référentiel postes","Évaluation des acquis","Savoir-faire critiques"]),
 ("formation","Formations",["Formations obligatoires","Formations réglementaires","Catalogue et plan","Suivi + évaluation"]),
 ("habilitation","Habilitations",["Habilitations et recyclages","Autorisations internes","Habilitations électriques"]),
 ("suivi-medical","Suivi médical",["Visites médicales","Aptitudes et restrictions"]),
 ("planning","Planning",["Planification des équipes","Affectation au poste","Absences et remplacements","Intérim"]),
 ("ordonnancement","Ordonnancement & production",["Ordres de fabrication","Suivi de ligne"]),
 ("maintenance","Maintenance",["Interventions","Préventif"]),
 ("qualite","Qualité & QHSE",["Non-conformités","Audits et contrôles","Documentation qualité"]),
 ("ged","GED & partage",["Modes opératoires","Fiches sécurité","Diffusion documentaire"]),
 ("erp","ERP",["Données de référence"]),
 ("bi","BI & reporting",["Charge / capacité","Indicateurs de polyvalence","Reporting de conformité"]),
 ("non-classe","Non classé",[]),
]
BLOC_UC = {"uc1":"planning","uc2":"bi","uc3":"formation","uc4":"competence","uc5":"competence",
           "uc6":"competence","uc7":"habilitation","uc8":"qualite","uc9":"planning","uc10":"competence"}

def bloc_contexte(nom, uc, avec_uc):
    if avec_uc and uc in BLOC_UC: return BLOC_UC[uc]
    return bloc_processus(nom)

def classer2(outil, nom, uc, avec_uc):
    v = norm(outil)
    for motifs, bloc, etape in TABLE_A:
        if any(corr(m, v) for m in motifs): return bloc, etape
    if any(corr(m, v) for m in GENERIQUES):
        return bloc_contexte(nom, uc, avec_uc), "Pilotage"
    return "non-classe", outil

def vue(processus, multi, avec_uc):
    """processus : [(nom, use_case, [supports d'etape])] -> stats"""
    placements = {}
    for nom, uc, etapes in processus:
        for sup in etapes:
            for outil in [s.strip() for s in sup.split(',') if s.strip()]:
                b, e = classer2(outil, nom, uc, avec_uc)
                k = f"{norm(outil)}|{b}" if multi else norm(outil)
                placements.setdefault(k, (outil, b, e))
    domaines = {c: {"nom": n, "lignes": [[s, []] for s in ets]} for c, n, ets in TRAME}
    for outil, b, e in placements.values():
        d = domaines.setdefault(b, {"nom": b, "lignes": []})
        ligne = next((l for l in d["lignes"] if norm(l[0]) == norm(e)), None)
        if ligne is None:
            ligne = [e, []]; d["lignes"].append(ligne)
        if not any(norm(o) == norm(outil) for o in ligne[1]): ligne[1].append(outil)
    lignes = [l for d in domaines.values() for l in d["lignes"]]
    boites = {norm(o) for d in domaines.values() for l in d["lignes"] for o in l[1]}
    return {
        "outils": len({norm(p[0]) for p in placements.values()}),
        "placements": len(placements),
        "non_classe": sum(1 for _, b, _ in placements.values() if b == "non-classe"),
        "activites": len(lignes),
        "renseignees": sum(1 for l in lignes if l[1]),
        "boites": len(boites),
    }

# --- donnees ---
clients = {}
for f, code in [('/home/user/Claude_Projects/trames/template-use-case.json','template-use-case'),
                ('/home/user/Claude_Projects/trames/cible-mercateam.json','cible-mercateam')]:
    clients[code] = [(p['nom'], p.get('use_case'), [e.get('supports','') for e in p['etapes'] if e.get('supports')])
                     for p in json.load(open(f))['client']['processus']]
clients['sekurit-float-france'] = [
 ("Onboarding", None, ['Papier, SharePoint','Excel','BOOST, SharePoint','Kronos / Cronos']),
 ("Pilotage des habilitations", None, ['Padoa','Excel','Excel','Excel']),
 ("Planification des opérateurs et gestion des aléas", "uc1",
  ['Excel','Papier','Papier','Excel','Excel','Papier','Excel, Papier','Oral','Excel',
   'Oral','Logiciel (SIRH / GTA)','Excel','Au jugé','Papier','Oral','Oral','Excel']),
]

cols = ["outils","placements","non_classe","activites","renseignees","boites"]
print(f"{'diagnostic':22} {'etat':8} " + " ".join(f"{c:>12}" for c in cols))
for code, procs in clients.items():
    a = vue(procs, multi=False, avec_uc=False)
    b = vue(procs, multi=True,  avec_uc=True)
    for nom, s in (("AVANT", a), ("APRES", b)):
        print(f"{code:22} {nom:8} " + " ".join(f"{s[c]:>12}" for c in cols))
