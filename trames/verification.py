#!/usr/bin/env python3
"""Rejoue sur le JSON les regles qui comptent cote application :
   - importer_client_json  : un role absent de `roles` est efface silencieusement
   - listeSupports         : decoupe sur la virgule, et sur rien d'autre
   - classer()             : bloc de l'environnement IT pour chaque outil
Sortie : des chiffres bruts, pas un avis."""

import json
import re
import unicodedata
from collections import Counter

D = json.load(open("/tmp/claude-0/-home-user-Claude-Projects/"
                   "a0555995-c6c1-5fb2-8d4d-e4f6f9232744/scratchpad/"
                   "template-use-case.json", encoding="utf-8"))["client"]


def norm(v):
    v = unicodedata.normalize("NFD", v.lower())
    return "".join(c for c in v if unicodedata.category(c) != "Mn")


def liste_supports(brut):
    return [s.strip() for s in str(brut or "").split(",") if s.strip()]


# --- TABLE_A / GENERIQUES / TABLE_B, recopiees de src/lib/environnement-it.ts
TABLE_A = [
    (["padoa", "padao", "gaia", "medical", "medecine", "aptitude"], "suivi-medical"),
    (["caces", "habilitation", "autorisation de conduite"], "habilitation"),
    (["boost", "sowesign", "moodle", "lms", "learning", "360learning"], "formation"),
    (["kronos", "cronos", "horoquartz", "adp", "workday", "sirh", "gta",
      "pointage", "badgeage", "paie"], "sirh"),
    (["myplan"], "planning"),
    (["gpao", "ordonnancement", "ordo"], "ordonnancement"),
    (["sap", "oracle", "erp"], "erp"),
    (["aveva", "wonderware"], "ordonnancement"),
    (["corim", "gmao", "carl", "coswin"], "maintenance"),
    (["qlik", "power bi", "powerbi"], "bi"),
    (["sharepoint", "onedrive", "drive", "teams", "intranet", "ged", "docuware",
      "serveur", "reseau"], "ged"),
    (["qms", "qualite", "non-conformite", "r43"], "qualite"),
]
GENERIQUES = ["excel", "tableur", "csv", "xls", "word", "powerpoint", "ppt", "slide",
              "mail", "outlook", "courriel", "papier", "imprime", "formulaire",
              "checklist", "fiche", "feuille", "classeur", "registre", "cahier",
              "livret", "attestation", "oral", "reunion", "brief", "telephone", "video"]
TABLE_B = [
    (["medical", "medecine", "visite"], "suivi-medical"),
    (["habilitation", "autorisation", "securite", "ehs", "reglementaire"], "habilitation"),
    (["formation", "onboarding", "integration", "accueil", "montee en competence"], "formation"),
    (["competence", "polyvalence", "matrice", "evaluation"], "competence"),
    (["planning", "planification", "affectation", "absence", "interim"], "planning"),
    (["recrutement", "contrat", "administratif"], "sirh"),
    (["production", "ligne", "fabrication"], "ordonnancement"),
    (["maintenance"], "maintenance"),
    (["qualite", "audit", "conformite"], "qualite"),
]


def classer(outil, nom_proc):
    v = norm(outil)
    for motifs, bloc in TABLE_A:
        if any(m in v for m in motifs):
            return bloc
    if any(m in v for m in GENERIQUES):
        p = norm(nom_proc)
        for motifs, bloc in TABLE_B:
            if any(m in p for m in motifs):
                return bloc
        return "non-classe"
    return "non-classe"


print("=== 1. Roles : un role absent de `roles` serait efface a l'import")
manquants = 0
for p in D["processus"]:
    for e in p["etapes"]:
        for champ in ("role", "role2"):
            r = e[champ]
            if r and r not in p["roles"]:
                manquants += 1
                print(f"  MANQUANT {p['nom']} / {r}")
print(f"  roles effaces a l'import : {manquants}")

print("\n=== 2. Supports : virgules parasites et decoupe")
parasites = [o for o in D["outils"] if "," in o]
print(f"  outils du menu contenant une virgule : {len(parasites)} {parasites}")
tous = Counter()
sans_support = 0
for p in D["processus"]:
    for e in p["etapes"]:
        l = liste_supports(e["supports"])
        if not l:
            sans_support += 1
        for o in l:
            tous[o] += 1
print(f"  etapes sans support : {sans_support} / {sum(len(p['etapes']) for p in D['processus'])}")
print(f"  outils distincts releves sur les etapes : {len(tous)}")

print("\n=== 3. Environnement IT : bloc calcule pour chaque outil")
blocs = {}
for p in D["processus"]:
    for e in p["etapes"]:
        for o in liste_supports(e["supports"]):
            blocs.setdefault(norm(o), (o, classer(o, p["nom"])))
par_bloc = Counter(b for _, b in blocs.values())
for bloc, n in par_bloc.most_common():
    noms = sorted(o for o, b in blocs.values() if b == bloc)
    print(f"  {bloc:16} {n:2}  {', '.join(noms)}")

print("\n=== 4. Outils du menu jamais utilises sur une etape")
inutilises = [o for o in D["outils"] if norm(o) not in blocs]
print(f"  {len(inutilises)} : {inutilises}")

print("\n=== 5. Bandeaux de frise (phase) par processus")
for p in D["processus"]:
    bandes, prec = 0, None
    for e in p["etapes"]:
        if e["phase"] != prec:
            bandes += 1
            prec = e["phase"]
    vides = sum(1 for e in p["etapes"] if not e["phase"])
    print(f"  {p['nom'][:44]:46} {len(p['etapes']):2} etapes, {bandes:2} bandes, {vides} sans QUAND")

print("\n=== 6. Integrite generale")
print(f"  codes processus uniques : {len({p['code'] for p in D['processus']})} / {len(D['processus'])}")
print(f"  etapes sans texte       : {sum(1 for p in D['processus'] for e in p['etapes'] if not e['texte'])}")
print(f"  etapes sans role        : {sum(1 for p in D['processus'] for e in p['etapes'] if not e['role'])}")
print(f"  ordre = index 1..n      : "
      f"{all([e['ordre'] for e in p['etapes']] == list(range(1, len(p['etapes']) + 1)) for p in D['processus'])}")
