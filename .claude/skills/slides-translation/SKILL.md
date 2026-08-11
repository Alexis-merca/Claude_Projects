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
| `jobs.gs` | Le lot en cours : `getJobs`, tables par deck | Remplacé à chaque lot |

L'utilisateur garde **un seul projet Apps Script** en permanence. Pour un
nouveau lot, il ne remplace que `jobs.gs`.

## Procédure pour un nouveau deck

1. **Créer les copies** avec `mcp__Google_Drive__copy_file`, une par langue,
   dans le dossier de destination. Ne jamais toucher à l'original. Le coût en
   tokens est négligeable — ne pas demander à l'utilisateur de les créer.
2. **Lire le français** avec `mcp__Google_Drive__read_file_content`.
3. **Confronter au glossaire.** Un deck de déploiement Mercateam reprend
   presque toujours les mêmes blocs (feuille de route, équipe Mercateam, équipe
   partenaire, étapes du déploiement, RACI, nos attentes, MercaNews, critères
   de Go Live, témoignages). Ils sont déjà dans `glossaire.gs` : n'écrire que
   les entrées réellement nouvelles.
4. **Écrire la table du deck** dans `jobs.gs`, et l'entrée correspondante dans
   `getJobs()` : `map: COMMON_EN.concat(DECKn_EN)`.
5. **Vérifier avant de livrer** (voir plus bas).
6. **Livrer les trois fichiers** et rappeler de lancer `runAll` autant de fois
   que le journal le demande.
7. **Relire les copies via Drive** une fois l'exécution terminée. C'est ce qui
   attrape ce que le rapport du script ne voit pas.

## Les pièges de l'API Slides

Ces trois comportements ont chacun coûté une exécution ratée. Le moteur est
construit autour d'eux — ne pas les « simplifier ».

1. **La recherche ignore les accents.** `replaceAllText('Informé', …)` matche
   `Informe`. Une entrée courte peut donc réécrire la traduction posée par une
   entrée longue. D'où le remplacement en deux passes via une sentinelle ASCII.
2. **La valeur de retour de `replaceAllText` n'est pas fiable** : elle vaut `0`
   alors que le remplacement a eu lieu. Ne jamais bâtir un rapport dessus — le
   moteur relit la présentation après coup.
3. **Certaines formes refusent d'être lues** (`getText()` échoue, cellules
   fusionnées). Tout filtrage bâti sur le texte relevé saute silencieusement ce
   qu'il n'a pas su lire. Les slides ne sont donc pas filtrées.

Autres règles de rédaction des tables :

- Les chaînes les plus longues sont traitées en premier — ne pas retrier.
- La casse est respectée : `Paramétrage` et `paramétrage` sont deux entrées.
- Jamais d'entrée identité (`['Kick off', 'Kick off']`).
- Ne pas faire porter une entrée sur un saut de ligne dont on n'est pas sûr :
  deux entrées courtes valent mieux qu'une longue qui ne matchera pas.
- Le texte dans les images n'est pas traduisible. Le signaler à l'utilisateur.

## Vérifier avant de livrer

Ne jamais livrer une table sans l'avoir passée au crible. Écrire un contrôle
jetable en Node qui charge les tables et signale :

- les entrées identité (`clé === valeur`) ;
- les doublons de clé avec des traductions divergentes ;
- les traductions EN contenant encore des mots français ;
- les préfixes (`→`, `•`) ajoutés côté traduction mais absents de la clé.

Chacune de ces catégories a déjà produit un bug réel sur ce projet.

Attention en testant avec un mock : Apps Script renvoie des **objets**
d'énumération, pas des chaînes. Un mock qui utilise des chaînes fait passer un
`===` qui échoue en vrai — c'est déjà arrivé.

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
