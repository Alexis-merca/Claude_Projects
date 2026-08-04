# FAQ client Mercateam — enrichie des liens du centre d'aide

`FAQ_MERCATEAM_avec_liens_centre_aide.docx` reprend la FAQ construite par le client
(structure, textes et captures inchangés) et ajoute, sous chaque sujet, une ligne
« Article d'aide › … » pointant vers l'article correspondant du centre d'aide
(https://help.merca.team/fr/).

- 67 liens insérés à 48 endroits, 46 articles / collections distincts.
- `add_help_links.py` régénère le document à partir de l'original
  (`FAQ_MERCATEAM.docx` dans le même dossier de travail) : le mapping
  « paragraphe → article » est en tête du script, facile à ajuster.

Les URLs proviennent des liens réellement partagés en interne (Slack, Notion) et
de la banque d'articles Notion « Revue du helpdesk » ; seuls des articles publiés
en français ont été retenus (les brouillons et articles archivés ont été écartés).
