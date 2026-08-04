#!/usr/bin/env python3
"""Ajoute les liens du centre d'aide Mercateam dans la FAQ client (docx)."""
import re, shutil, zipfile, os

SRC = 'FAQ_MERCATEAM.docx'
DST = "FAQ_MERCATEAM_avec_liens_centre_aide.docx"
BASE = 'https://help.merca.team/fr/'
A = BASE + 'articles/'
C = BASE + 'collections/'

# Articles du centre d'aide (titre affiché -> URL)
L = {
    'apercu':        ("À quoi sert Mercateam ?", A + '6435652-a-quoi-sert-mercateam'),
    'academy':       ("Mercateam Academy (parcours d'onboarding)", C + '15854182-mercateam-academy'),
    'premiere':      ("Première connexion", A + '13378094-premiere-connexion'),
    'contact':       ("Comment nous contacter ?", A + '6445605-comment-nous-contacter'),
    'cda':           ("Centre d'aide Mercateam", BASE),
    'collab':        ("Gérer les collaborateurs", A + '6436005-gerer-les-collaborateurs'),
    'equipes':       ("Gestion des équipes et de leurs compétences", A + '13380036-gestion-des-equipes-et-de-leurs-competences'),
    'transfert':     ("Transférer un collaborateur d'une équipe à une autre", A + '6445463-transferer-un-collaborateur-d-une-equipe-a-une-autre'),
    'fichiers':      ("Gérer les dossiers et fichiers PJ", A + '6436242-gerer-les-dossiers-et-fichiers-pj'),
    'habil':         ("Gérer les habilitations", A + '6436147-gerer-les-habilitations'),
    'habilext':      ("Gestion des habilitations & formations externes", A + '13223452-gestion-des-habilitations-formations-externes'),
    'comp':          ("Gérer les compétences", A + '6436134-gerer-les-competences'),
    'lancer':        ("Lancer une formation", A + '6436332-lancer-une-formation'),
    'masse':         ("Lancement de formations en masse", A + '12302351-lancement-de-formations-en-masse'),
    'auto':          ("Automatiser le lancement de vos formations obligatoires", A + '9319077-automatiser-le-lancement-de-vos-formations-obligatoires'),
    'archiver':      ("Archiver le profil d'un opérateur", A + '6436035-archiver-le-profil-d-un-operateur'),
    'desarchiver':   ("Retrouver et réactiver vos collaborateurs archivés", A + '6436059-retrouver-et-reactiver-vos-collaborateurs-archives'),
    'interim':       ("Gérer efficacement vos intérimaires", A + '10942383-gerer-efficacement-vos-interimaires'),
    'matrice':       ("Visualiser les compétences, habilitations et polyvalence sur poste grâce à la vue d'ensemble", A + '6441257-visualiser-les-competences-habilitations-et-polyvalence-sur-poste-de-vos-equipes'),
    'attendues':     ("Paramétrer les compétences et habilitations attendues à un poste", A + '11417123-parametrer-les-competences-et-habilitations-attendues-a-un-poste'),
    'tdb':           ("Comprendre le tableau de bord", A + '8588527-comprendre-le-tableau-de-bord'),
    'formation':     ("Une formation, c'est quoi ?", A + '11464211-une-formation-c-est-quoi'),
    'suivi':         ("Suivre l'avancée de mes formations", A + '6441238-suivre-l-avancee-de-mes-formations'),
    'contenu':       ("Créer un contenu : instruction ou information générique", A + '6441253-creer-un-contenu-instruction-ou-information-generique'),
    'contenus':      ("Tous les articles sur les contenus", C + '3575193-contenus'),
    'mails':         ("Les notifications par mails dans Mercateam", A + '9577869-les-notifications-par-mails-dans-mercateam'),
    'inapp':         ("Les notifications in-app dans Mercateam", A + '6922584-les-notifications-in-app-dans-mercateam'),
    'valider':       ("Valider une formation (signature électronique)", A + '6436334-valider-une-formation'),
    'quiz':          ("Gestion des questionnaires", A + '6436338-gestion-des-questionnaires'),
    'attribut':      ("Donner l'attribut formateur / évaluateur", A + '6436354-donner-l-attribut-formateur-evaluateur'),
    'ai':            ("Gestion des autorisations internes", A + '11094428-gestion-des-autorisations-internes'),
    'reglementaire': ("Gestion des formations réglementaires", A + '11604982-gestion-des-formations-reglementaires'),
    'historique':    ("Suivre l'historique d'une formation", A + '6436360-suivre-l-historique-d-une-formation'),
    'pilotage':      ("Pilotage V2 : créer un objectif de montée en compétences", A + '8425054-pilotage-v2-creer-un-objectif-de-montee-en-competences'),
    'expiration':    ("Comment garder la traçabilité de vos habilitations non renouvelées", A + '9756605-comment-garder-la-tracabilite-de-vos-habilitations-non-renouvelees'),
    'audit':         ("Auditer vos données", A + '9291654-auditer-vos-donnees'),
    'recherche':     ("Extraction de données via la recherche avancée", A + '6911760-extraction-de-donnees-via-la-recherche-avancee'),
    'droits':        ("Gérer les droits d'accès à Mercateam", A + '7857686-gerer-les-droits-d-acces-a-mercateam'),
    'entretiens':    ("Tous les articles sur les entretiens", C + '3908598-entretiens'),
    'trame':         ("Entretiens : créer une nouvelle trame d'entretien", A + '6972775-entretiens-comment-creer-une-nouvelle-trame-d-entretien'),
    'param':         ("Administration et paramétrage de la plateforme", A + '13573363-administration-et-parametrage-de-la-plateforme'),
    'planning':      ("Un planning, c'est quoi ?", A + '10942401-un-planning-c-est-quoi'),
    'remplir':       ("PLANNING : remplir son planning", A + '6445319-remplir-son-planning'),
    'scores':        ("Gestion des scores du planning et priorité d'affectation des collaborateurs", A + '6436236-gestion-des-scores-du-planning-et-priorite-d-affectation-des-collaborateurs'),
    'peauneuve':     ("Le planning fait peau neuve !", A + '11727506-le-planning-fait-peau-neuve'),
}

# Insertion après le paragraphe n° (1-based, ordre du document)
INSERTS = {
    1:   ['cda'],
    4:   ['apercu', 'academy'],
    11:  ['droits'],
    20:  ['matrice', 'tdb'],
    26:  ['premiere', 'contact'],
    30:  ['collab'],
    34:  ['equipes'],
    39:  ['transfert'],
    44:  ['fichiers'],
    50:  ['habil', 'habilext'],
    53:  ['comp'],
    58:  ['lancer', 'masse', 'auto'],
    71:  ['archiver', 'desarchiver'],
    77:  ['matrice', 'attendues'],
    79:  ['comp'],
    81:  ['valider'],
    85:  ['suivi'],
    88:  ['formation'],
    91:  ['contenu', 'contenus'],
    94:  ['tdb', 'mails', 'inapp'],
    101: ['quiz', 'valider'],
    107: ['attribut'],
    110: ['habil', 'reglementaire'],
    121: ['ai'],
    125: ['historique'],
    127: ['valider'],
    130: ['matrice', 'pilotage'],
    132: ['attendues'],
    134: ['expiration'],
    137: ['audit', 'recherche'],
    144: ['historique'],
    146: ['desarchiver'],
    162: ['remplir'],
    165: ['interim'],
    166: ['entretiens', 'trame'],
    175: ['attribut', 'valider'],
    186: ['param'],
    191: ['matrice'],
    196: ['scores'],
    198: ['peauneuve', 'planning'],
    206: ['contact', 'cda'],
    211: ['suivi'],
    212: ['valider'],
    213: ['matrice'],
    214: ['recherche'],
    215: ['attribut'],
    216: ['ai'],
    217: ['apercu'],
}

R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
HYPERLINK_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink'


def esc(s, typo=False):
    if typo:  # apostrophes typographiques, comme le reste du document
        s = s.replace("'", '’')
    return (s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
             .replace('"', '&quot;'))


def para(rid, label):
    """Paragraphe 'Article d'aide : <lien>' en petit, italique, indenté."""
    rpr_lead = ('<w:rPr><w:i/><w:color w:val="595959"/><w:sz w:val="18"/>'
                '<w:szCs w:val="18"/></w:rPr>')
    rpr_link = ('<w:rPr><w:i/><w:color w:val="6733FD"/><w:sz w:val="18"/>'
                '<w:szCs w:val="18"/><w:u w:val="single"/></w:rPr>')
    return (
        '<w:p><w:pPr><w:spacing w:before="20" w:after="60" w:line="240" '
        'w:lineRule="auto"/><w:ind w:left="425"/><w:contextualSpacing w:val="0"/>'
        '</w:pPr>'
        f'<w:r>{rpr_lead}<w:t xml:space="preserve">Article d’aide › </w:t></w:r>'
        f'<w:hyperlink r:id="{rid}" w:history="1">'
        f'<w:r>{rpr_link}<w:t xml:space="preserve">{esc(label, typo=True)}</w:t></w:r>'
        '</w:hyperlink></w:p>'
    )


def main():
    zin = zipfile.ZipFile(SRC)
    doc = zin.read('word/document.xml').decode('utf-8')
    rels = zin.read('word/_rels/document.xml.rels').decode('utf-8')

    spans = [(m.start(), m.end()) for m in re.finditer(
        r'<w:p(?:\s[^>]*)?/>|<w:p(?:\s[^>]*)?>.*?</w:p>', doc, re.S)]
    assert len(spans) == 217, f'structure inattendue : {len(spans)} paragraphes'

    next_id = max(int(i) for i in re.findall(r'Id="rId(\d+)"', rels)) + 1
    new_rels, rid_of = [], {}
    for key, (label, url) in L.items():
        rid = f'rId{next_id}'
        next_id += 1
        rid_of[key] = rid
        new_rels.append(
            f'<Relationship Id="{rid}" Type="{HYPERLINK_TYPE}" '
            f'Target="{esc(url)}" TargetMode="External"/>')

    # insertion de la fin vers le début pour ne pas décaler les offsets
    count = 0
    for pnum in sorted(INSERTS, reverse=True):
        block = ''.join(para(rid_of[k], L[k][0]) for k in INSERTS[pnum])
        count += len(INSERTS[pnum])
        pos = spans[pnum - 1][1]
        doc = doc[:pos] + block + doc[pos:]

    rels = rels.replace('</Relationships>', ''.join(new_rels) + '</Relationships>')

    if os.path.exists(DST):
        os.remove(DST)
    with zipfile.ZipFile(DST, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == 'word/document.xml':
                data = doc.encode('utf-8')
            elif item.filename == 'word/_rels/document.xml.rels':
                data = rels.encode('utf-8')
            zout.writestr(item, data)
    print(f'{count} liens insérés dans {len(INSERTS)} emplacements -> {DST}')


if __name__ == '__main__':
    main()
