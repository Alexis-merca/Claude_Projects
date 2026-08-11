---
name: slides-translation
description: Traduit des présentations Google Slides Mercateam du français vers l'anglais et l'espagnol, sans toucher aux originaux. Déclenche-toi quand l'utilisateur demande de traduire un deck, une présentation ou des slides, fournit une URL docs.google.com/presentation à traduire, ou parle de version EN/ES d'un support Mercateam. Couvre la création des copies, la production des tables de traduction à partir du glossaire existant, et le script Apps Script qui les applique.
---

# Traduction de présentations Google Slides

## L'obstacle à connaître avant tout

**Il n'existe pas d'API Google Slides en écriture côté Claude.** Le connecteur
Google Drive sait lire une présentation, la copier et l'uploader — mais pas
modifier le texte d'une slide. Ne pas promettre de le faire directement.

Le contournement par export `.pptx` est impraticable : ces decks pèsent 10 à
25 Mo (surtout des images), et le téléchargement passerait par la fenêtre de
contexte en base64.

La voie qui fonctionne : **Claude produit les tables de traduction, un script
Apps Script les applique, l'utilisateur le lance.** Claude ne peut pas exécuter
d'Apps Script — c'est toujours l'utilisateur qui lance.

## Où se trouve la bibliothèque

Dans ce dépôt, sous `slides-translation/` :

| Fichier | Rôle | Change-t-il ? |
|---|---|---|
| `moteur.gs` | Le moteur de remplacement | Jamais |
| `glossaire.gs` | `COMMON_EN` / `COMMON_ES`, le vocabulaire Mercateam | S'enrichit |
| `jobs.gs` | Le lot en cours : `getJobs`, `getFixups`, tables par deck | Remplacé à chaque lot |
| `translate-complet.gs` | Les trois précédents concaténés | Régénéré après chaque modification |

**Ne livrer que `translate-complet.gs`, jamais les fichiers séparés.** Apps
Script partage la portée globale entre les fichiers d'un projet, mais il faut
les créer un par un côté éditeur. Coller un seul des trois par-dessus le
`Code.gs` existant efface les autres : l'exécution échoue sur `translateOne is
not defined`, ou — bien pire — se déroule normalement sans rien changer. Les
deux se sont produits, et la seconde panne a coûté deux allers-retours.

Régénérer après toute modification :
`cd slides-translation && cat moteur.gs glossaire.gs jobs.gs > translate-complet.gs`

## Procédure pour un nouveau deck

1. **Créer les copies** avec `mcp__Google_Drive__copy_file`, une par langue,
   dans le dossier de destination. Ne jamais toucher à l'original. Le coût en
   tokens est négligeable — ne pas demander à l'utilisateur de les créer.
2. **Lire le français** avec `mcp__Google_Drive__read_file_content`.
3. **Confronter au glossaire.** Un deck de déploiement Mercateam reprend
   presque toujours les mêmes blocs (feuille de route, équipe Mercateam, équipe
   partenaire, étapes du déploiement, RACI, nos attentes, MercaNews, critères
   de Go Live, témoignages). Ils sont déjà dans `glossaire.gs`, qui couvre ~80 %
   d'un deck standard : n'écrire que les entrées réellement nouvelles.
4. **Écrire la table du deck** dans `jobs.gs`, et l'entrée correspondante dans
   `getJobs()` : `map: COMMON_EN.concat(DECKn_EN)`. Un deck qui reprend les
   blocs d'un autre concatène aussi sa table (`COMMON_EN.concat(DECK2_EN,
   DECK3_EN)`) — les doublons sont filtrés à l'exécution.
5. **Passer les tables au crible** (voir plus bas). Jamais de livraison sans ça.
6. **Régénérer et livrer `translate-complet.gs`**, en rappelant de lancer
   `runAll` autant de fois que le journal le demande (limite de 6 min).
7. **Relire les copies via Drive** une fois l'exécution terminée, et ne conclure
   que là-dessus. C'est ce qui attrape ce que le rapport du script ne voit pas.

## Les quatre pièges de l'API Slides

Chacun a coûté une exécution ratée. Le moteur est construit autour d'eux — ne
pas les « simplifier ».

1. **La recherche ignore les accents.** `replaceAllText('Informé', …)` matche
   `Informe`. Une entrée courte peut donc réécrire la traduction posée par une
   entrée longue. D'où le remplacement en deux passes via une sentinelle ASCII.
2. **La valeur de retour de `replaceAllText` n'est pas fiable** : elle vaut `0`
   alors que le remplacement a eu lieu. Ne jamais bâtir un rapport dessus — le
   moteur relit la présentation après coup.
3. **Certaines formes refusent d'être lues** (`getText()` échoue, cellules
   fusionnées). Tout filtrage bâti sur le texte relevé saute silencieusement ce
   qu'il n'a pas su lire. Les slides ne sont donc pas filtrées.
4. **Des espaces invisibles se cachent dans le texte** : insécables (` `),
   fines (` `), autour des tirets cadratins comme au milieu d'une phrase.
   `variants()` en essaie plusieurs formes, mais ne couvre pas les cas mixtes.
   Une entrée qui traverse une ponctuation typographique française est à
   découper d'office.

## Règles de rédaction des tables

- Les chaînes les plus longues sont traitées en premier — ne pas retrier.
- La casse est respectée : `Paramétrage` et `paramétrage` sont deux entrées.
- Jamais d'entrée identité (`['Kick off', 'Kick off']`).
- **Découper toute entrée qui traverse un tiret cadratin, une parenthèse ou un
  saut de ligne dont on n'est pas certain.** Deux entrées courtes valent mieux
  qu'une longue qui ne matchera pas.
- **Se méfier des clés de moins de 4 caractères** (`GT`, `S1`) et des mots
  génériques (`Production`, `Support`, `Phase`). Ce sont eux qui mordent sur du
  texte voisin : `Production → Producción` a produit `Producción Manager` dans
  un logigramme anglais. Toujours les vérifier nommément à la relecture.
- Le texte dans les images n'est pas traduisible. Le signaler à l'utilisateur.

## Passer les tables au crible

Écrire un contrôle jetable en Node qui charge les tables et signale :

- les entrées identité (`clé === valeur`) ;
- les doublons de clé avec des traductions divergentes ;
- les traductions EN contenant encore des mots français ;
- les préfixes (`→`, `•`) ajoutés côté traduction mais absents de la clé.

Chacune de ces catégories a déjà produit un bug réel sur ce projet.

Attention en testant avec un mock : Apps Script renvoie des **objets**
d'énumération, pas des chaînes. Un mock qui utilise des chaînes fait passer un
`===` qui échoue en vrai. Un bon mock reproduit aussi le pliage des accents et
des formes illisibles, sinon il valide un moteur qui échouera.

## Relire les copies : ce qui compte et ce qui ment

**Le journal du script n'est pas une preuve.** Il a annoncé « Plus aucun texte
français détecté » sur des decks qui en contenaient encore, parce qu'il ne
vérifie que ce qu'il a dans ses tables. Cinq défauts réels n'ont été trouvés que
par relecture : `Informado`, des semaines restées en français, `Producción
Manager`, `Automobile` non traduit, et un fragment de phrase.

**La date de modification ne prouve rien non plus** : `translateOne` appelle
`saveAndClose()` sans condition, donc elle bouge même quand aucun remplacement
n'a eu lieu. Elle sert dans un seul sens : *inchangée* depuis la dernière
lecture ⇒ contenu inchangé, relecture inutile.

À la relecture, chercher spécifiquement :

- du français résiduel — y compris des mots sans marqueur franco-spécifique,
  que le détecteur du script ne peut pas voir (`Automobile`) ;
- des sentinelles `@@zz` oubliées ;
- les dégâts des clés courtes de ce lot, nommément ;
- les incohérences entre slides (`WORKING GROUPS (WG)` d'un côté, colonne `GT`
  de l'autre, dans le même deck).

Consigner le résultat copie par copie dans `slides-translation/verification-<date>.md`.

## Corriger après coup

Les correctifs repartent de **l'état actuel** du deck, pas du français
d'origine : ils vivent dans `getFixups()`, pas dans `getJobs()`, et se lancent
avec `fixupAll`. Toujours faire annoncer par `fixupAll` un **numéro de lot et la
liste des cibles** en tête de journal — sans ça, un `jobs.gs` resté en version
précédente rejoue d'anciens correctifs et le journal paraît normal.

**Après deux tentatives automatiques infructueuses sur une même chaîne,
recommander la correction manuelle.** Un espace invisible ne se voit pas depuis
Drive ; s'entêter coûte plus qu'il ne rapporte. Donner alors le numéro de slide,
le titre de la slide, le texte exact à remplacer et le texte de remplacement.

## Glossaire de référence

| FR | EN | ES |
|---|---|---|
| Compétences | Skills | Competencias |
| Habilitations | Certifications | Habilitaciones |
| Poste | Workstation | Puesto |
| Polyvalence | Versatility | Polivalencia |
| Savoir-faire | Know-how | Saber hacer |
| Paramétrage | Configuration | Configuración |
| Formation | Training | Formación |
| Feuille de route | Roadmap | Hoja de ruta |
| COPIL | Steering committee | Comité de dirección |
| Bilan | Review | Balance |
| Groupe de travail (GT) | Working group (WG) | Grupo de trabajo (GT) |
| Champion / Sponsor | *inchangé* | *inchangé* |
| Utilisateurs clés | Key users | Usuarios clave |
| Chefs d'équipe | Team leaders | Jefes de equipo |
| Conduite du changement | Change management | Gestión del cambio |
| Modes opératoires | Standard operating procedures | Procedimientos operativos |
| Site (industriel) | Site | Planta |
| Semaine (S1, S2…) | W1, W2… | S1, S2… *(inchangé)* |
| J/H | PD (person-days) | J/H *(inchangé)* |
| Approbateur (RACI) | Accountable | Aprobador |

Le glossaire complet fait foi : c'est `glossaire.gs`, pas ce tableau.
