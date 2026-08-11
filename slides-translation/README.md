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
   - la liste des entrées **non trouvées**, s'il y en a,
   - les **erreurs tolérées**, s'il y en a.

`runAll` est réexécutable sans risque : les renommages sont idempotents, et une
présentation déjà traduite ne contient plus de texte français à remplacer.

Les fonctions peuvent aussi être lancées séparément : `renameAll` (titres
seulement), `translateAll` (traductions seulement), `runAll` (les deux).

## Fonctions disponibles

| Fonction | Rôle |
|---|---|
| `runAll` | Renommage puis traduction. Le point d'entrée normal. |
| `translateAll` | Traduction seule, sur les copies de `getJobs()`. |
| `renameAll` | Harmonisation des titres seule. |
| `fixupAll` | Correctifs ponctuels de `getFixups()`, qui repartent de l'état déjà traduit et non du français. À lancer une seule fois. |
| `cleanupSentinels` | Filet de sécurité : retire les sentinelles qu'un plantage en cours de passe 2 aurait laissées visibles. À ne lancer que sur message `SENTINELLES RESTANTES`. |

Renvoyer cette liste à Claude : une entrée non trouvée signifie que le texte réel
diffère de ce qui avait été extrait (typographie, espace, saut de ligne), et la
table est corrigée en conséquence.

## Structure

- `translate.gs`
  - **MOTEUR** — ne change pas d'un deck à l'autre.
  - **`getJobs()`** — quelles copies traiter, avec quelle table.
  - **`DECK1_EN` / `DECK1_ES`** — les tables de traduction, une ligne par
    chaîne : `['texte français', 'traduction']`.

## Trois pièges de l'API Slides, appris à la dure

Ces trois comportements ont chacun coûté une exécution ratée. Ils sont
contre-intuitifs et le code est construit autour d'eux.

**1. La recherche ignore les accents.** `replaceAllText('Informé', …)` matche
`Informe`. Une entrée courte peut donc réécrire la traduction posée par une
entrée longue : `Informe de auditoría` était redevenu `Informado de auditoría`.
Trier de la plus longue à la plus courte ne suffit pas. D'où le remplacement en
**deux passes** — français → sentinelle ASCII → traduction. Une sentinelle
`@@zz1042@@` ne peut être mordue par aucune entrée française.

**2. La valeur de retour de `replaceAllText` n'est pas fiable.** Elle vaut `0`
alors que le remplacement a bien eu lieu. Un rapport bâti dessus annonçait
« 0 remplacement, 185 entrées non trouvées » sur une présentation intégralement
traduite. Le contrôle se fait donc **en relisant la présentation après coup**,
jamais en additionnant des compteurs.

**3. Certaines formes refusent d'être lues.** `getText()` échoue sur certains
éléments (et sur les cellules fusionnées d'un tableau). Tout filtrage préalable
bâti sur le texte relevé saute donc silencieusement ce qu'il n'a pas su lire :
les `S1 / S2 / S3` de la feuille de route étaient restés en français, alors que
le `S4`, présent ailleurs dans une forme lisible, passait. Sur les slides, on ne
filtre donc **pas** : `pres.replaceAllText()` les couvre toutes en un appel.
Le filtrage ne subsiste que sur les notes, masques et mises en page, où un appel
par page et par entrée serait trop lent.

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
- **Une page de notes peut refuser le remplacement** (`This request cannot be
  applied.`). C'est une limite de l'API Slides, pas une erreur de table : le
  moteur l'attrape, la signale dans *ERREURS TOLÉRÉES* et continue. Une
  exception non attrapée ferait perdre tout le reste de la traduction.
- **Un texte réparti sur deux zones de texte distinctes ne peut pas être
  traduit par un remplacement global.** Les entrées à saut de ligne
  (`'Expert\nintégration & IT'`) supposent une seule zone de texte contenant les
  deux lignes. Si elles remontent en *NON TROUVÉ*, c'est que ce sont deux zones
  séparées, et il faut les corriger à la main dans la slide.

## Coût en appels API

Le moteur relève d'abord le texte de chaque page, puis n'appelle
`replaceAllText` que sur les pages où la chaîne est effectivement présente.
Sans ce filtrage, un deck de 13 slides coûterait `192 entrées × ~1,5 variantes ×
28 pages`, soit plus de 8 000 appels API — largement au-delà de la limite de
6 minutes d'exécution d'Apps Script.

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
