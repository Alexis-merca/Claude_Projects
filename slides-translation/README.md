# Traduction des présentations Google Slides (FR → EN / ES)

## Pourquoi un script

Claude n'a pas d'API Google Slides en écriture : il peut lire une présentation et
créer des copies via Drive, mais pas modifier le texte d'une slide. Le
contournement par export `.pptx` est impraticable (les decks pèsent 10 à 25 Mo,
principalement des images).

Donc : Claude lit le FR et produit les tables de traduction, et ce script Apps
Script les applique aux copies.

## Mode d'emploi

1. Ouvrir [script.google.com](https://script.google.com) → **Nouveau projet**.
2. Coller tout le contenu de `translate.gs` dans l'éditeur (remplacer le
   `myFunction` existant), puis enregistrer (**Ctrl+S**).
3. Sélectionner la fonction **`runAll`** dans le menu déroulant en haut, puis
   **Exécuter**.
4. Autoriser l'accès quand Google le demande. L'écran d'avertissement
   « Google n'a pas validé cette application » est normal pour un script
   personnel : *Paramètres avancés* → *Accéder à …*. Le script n'ouvre que les
   copies listées dans `RENAMES` et `getJobs()`, jamais les originaux.
5. Lire le journal d'exécution (**Ctrl+Entrée** / *Journal d'exécution*). Il
   indique :
   - les copies renommées,
   - par présentation, le nombre de remplacements effectués,
   - la liste des entrées **non trouvées**, s'il y en a.

`runAll` est réexécutable sans risque : les renommages sont idempotents, et une
présentation déjà traduite ne contient plus de texte français à remplacer.

Les trois fonctions peuvent aussi être lancées séparément : `renameAll` (titres
seulement), `translateAll` (traductions seulement), `runAll` (les deux).

Renvoyer cette liste à Claude : une entrée non trouvée signifie que le texte réel
diffère de ce qui avait été extrait (typographie, espace, saut de ligne), et la
table est corrigée en conséquence.

## Structure

- `translate.gs`
  - **MOTEUR** — ne change pas d'un deck à l'autre.
  - **`getJobs()`** — quelles copies traiter, avec quelle table.
  - **`DECK1_EN` / `DECK1_ES`** — les tables de traduction, une ligne par
    chaîne : `['texte français', 'traduction']`.

## Points de vigilance

- **Les chaînes longues sont traitées avant les courtes.** C'est ce qui permet
  à `Déploiement module Formation` d'être traduit avant le simple `Formation`.
  Ne pas trier les tables autrement.
- **La recherche respecte la casse.** `Paramétrage` et `paramétrage` sont deux
  entrées distinctes si les deux apparaissent dans le deck.
- **Le texte contenu dans les images n'est pas traduit** — ni par ce script, ni
  par quoi que ce soit d'autre. Les captures d'écran produit doivent être
  refaites depuis un environnement en anglais / espagnol.
- **Ne jamais faire porter une entrée sur un saut de ligne dont on n'est pas
  sûr.** Mieux vaut deux entrées courtes qu'une longue qui ne matchera pas. La
  fonction `variants()` couvre déjà les apostrophes droites/courbes, les espaces
  insécables avant `: ; ! ?` et les sauts de ligne durs/souples.
- **Pas d'entrée identité** (`['Kick off', 'Kick off']`) : inutile, et elle est
  comptée comme un remplacement pour rien.

## Glossaire retenu

| FR | EN | ES |
|---|---|---|
| Compétences | Skills | Competencias |
| Habilitations | Certifications | Habilitaciones |
| Paramétrage | Configuration | Configuración |
| Formation | Training | Formación |
| Feuille de route | Roadmap | Hoja de ruta |
| Jalons | Milestones | Hitos |
| COPIL | Steering committee | Comité de dirección |
| Bilan | Review | Balance |
| Champion / Sponsor | *inchangé* | *inchangé* |
| Utilisateurs clés | Key users | Usuarios clave |
| Référent IT | IT contact | Referente IT |
| Chefs d'équipe | Team leaders | Jefes de equipo |
| Conduite du changement | Change management | Gestión del cambio |
| Modes opératoires | Standard operating procedures | Procedimientos operativos |
| Livrables | Deliverables | Entregables |
| Site (industriel) | Site | Planta |
| Semaine (S1, S2…) | W1, W2… | S1, S2… *(inchangé)* |
| J/H (jour·homme) | PD (person-days) | J/H *(inchangé)* |
| Approbateur (RACI) | Accountable | Aprobador |
