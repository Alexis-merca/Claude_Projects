# -*- coding: utf-8 -*-
"""Rejoue classer() de src/lib/environnement-it.ts et mesure ce que
le classement multi-blocs changerait, client par client."""
import json, re, unicodedata, sys

TABLE_A = [
 (["padoa","padao","gaia","medical","medecine","aptitude"],"suivi-medical","Visites médicales"),
 (["caces","habilitation","autorisation de conduite"],"habilitation","Habilitations et recyclages"),
 (["boost","sowesign","moodle","lms","learning","360learning"],"formation","Suivi + évaluation"),
 (["kronos","cronos","horoquartz","adp","workday","sirh","gta","pointage","badgeage","paie"],"sirh","Absences"),
 (["myplan"],"planning","Planification des équipes"),
 (["gpao","ordonnancement","ordo"],"ordonnancement","Ordres de fabrication"),
 (["sap","oracle","erp"],"erp","Données de référence"),
 (["aveva","wonderware"],"ordonnancement","Suivi de ligne"),
 (["corim","gmao","carl","coswin"],"maintenance","Interventions"),
 (["qlik","power bi","powerbi"],"bi","Charge / capacité"),
 (["sharepoint","onedrive","drive","teams","intranet","ged","docuware","serveur","reseau"],"ged","Diffusion documentaire"),
 (["qms","eqms","qualite","non-conformite","r43"],"qualite","Non-conformités"),
 (["mercateam (starter)"],"competence","Référentiel postes"),
 (["mercateam (master)"],"competence","Matrice de polyvalence"),
 (["mercateam (trainer)"],"formation","Suivi + évaluation"),
 (["mercateam (planner)"],"planning","Affectation au poste"),
 (["mercateam (kpis)"],"bi","Indicateurs de polyvalence"),
 (["mercateam"],"competence","Matrice de polyvalence"),
]
GENERIQUES = ["excel","tableur","csv","xls","word","powerpoint","ppt","slide","mail","outlook",
 "courriel","papier","imprime","formulaire","checklist","fiche","feuille","classeur","registre",
 "cahier","livret","attestation","oral","reunion","brief","telephone","video"]
TABLE_B = [
 (["medical","medecine","visite"],"suivi-medical"),
 (["habilitation","autorisation","securite","ehs","reglementaire"],"habilitation"),
 (["formation","onboarding","integration","accueil","montee en competence"],"formation"),
 (["competence","polyvalence","matrice","evaluation"],"competence"),
 (["planning","planification","affectation","absence","interim"],"planning"),
 (["recrutement","contrat","administratif"],"sirh"),
 (["production","ligne","fabrication"],"ordonnancement"),
 (["maintenance"],"maintenance"),
 (["qualite","audit","conformite"],"qualite"),
]
def norm(v):
    return "".join(c for c in unicodedata.normalize("NFD", v) if unicodedata.category(c)!="Mn").lower()
def corr(motif, valeur):
    return re.search(r"\b"+re.escape(motif), valeur) is not None
def bloc_processus(nom):
    v = norm(nom)
    for motifs, bloc in TABLE_B:
        if any(corr(m, v) for m in motifs): return bloc
    return "non-classe"
def classer(outil, nom_processus):
    v = norm(outil)
    for motifs, bloc, etape in TABLE_A:
        if any(corr(m, v) for m in motifs): return bloc, etape
    if any(corr(m, v) for m in GENERIQUES):
        return bloc_processus(nom_processus), "Pilotage"
    return "non-classe", outil

rows = json.load(open(sys.argv[1]))
par_client = {}
for r in rows:
    par_client.setdefault(r["client"], []).append(r)

print(f"{'client':24} {'outils':>7} {'placements uniques':>19} {'outils multi-blocs':>19}")
detail = {}
for client, rs in sorted(par_client.items()):
    actuel = {}          # clef outil -> (bloc, sujet) : premier processus gagne
    multi = {}           # clef outil -> set (bloc, sujet)
    noms = {}
    for r in rs:
        for outil in [s.strip() for s in (r["supports"] or "").split(",") if s.strip()]:
            k = norm(outil); noms[k] = outil
            b, e = classer(outil, r["processus"])
            actuel.setdefault(k, (b, e))
            multi.setdefault(k, set()).add((b, e))
    nb_multi = sum(1 for k, v in multi.items() if len(v) > 1)
    placements = sum(len(v) for v in multi.values())
    print(f"{client:24} {len(actuel):7} {len(actuel):19} {nb_multi:19}   -> {placements} placements si multi")
    detail[client] = (noms, actuel, multi)

print()
for client, (noms, actuel, multi) in sorted(detail.items()):
    lignes = [(noms[k], actuel[k], sorted(v)) for k, v in multi.items() if len(v) > 1]
    if not lignes: continue
    print(f"### {client}")
    for nom, (b, e), tous in sorted(lignes):
        print(f"  {nom:24} aujourd'hui: {b}/{e}")
        for bb, ee in tous:
            mark = " (retenu)" if (bb, ee) == (b, e) else ""
            print(f"      {'aussi' if (bb,ee)!=(b,e) else '  =  '} {bb}/{ee}{mark}")
    print()
