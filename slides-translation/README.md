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
| `runAll` | Renommage puis traduction. Le point d'entrée normal. **À relancer jusqu'à ce que le journal affiche « Tous les jobs sont traités ».** |
| `translateAll` | Traduction seule, sur les copies de `getJobs()` restant à faire. |
| `renameAll` | Harmonisation des titres seule. |
| `fixupAll` | Correctifs ponctuels de `getFixups()`, qui repartent de l'état déjà traduit et non du français. À lancer une seule fois. |
| `resetProgress` | Oublie les jobs déjà traités, pour tout reprendre de zéro. |
| `cleanupSentinels` | Filet de sécurité : retire les sentinelles qu'un plantage en cours de passe 2 aurait laissées visibles. À ne lancer que sur message `SENTINELLES RESTANTES`. |

## Pourquoi plusieurs exécutions

Apps Script coupe une exécution à 6 minutes. Un deck coûte environ 830 appels
API (365 entrées × 1,3 variante en passe 1, puis 1 appel par entrée en passe 2),
soit 1 à 2 minutes. Deux decks passent, quatre non.

`translateAll` refuse donc de démarrer un nouveau job au-delà de 2 min 30 et
retient les `fileId` terminés dans les propriétés du script. Relancer `runAll`
reprend là où ça s'était arrêté, sans refaire le travail déjà fait.

## Comment lire le rapport

Chaque job produit jusqu'à cinq blocs :

- **`terminé en N s`** — le job est allé au bout.
- **`ENCORE EN FRANÇAIS`** — des entrées de la table dont le texte français est
  toujours présent après coup. C'est le vrai signal d'échec : typographie qui
  diffère, ou texte réparti sur deux zones distinctes.
- **`RÉSIDU FRANÇAIS POSSIBLE`** — du français *sans entrée dans la table*,
  repéré par recherche de mots franco-spécifiques. C'est ce qui manque à
  traduire, à ajouter à la table. Sans ce garde-fou, une phrase oubliée
  resterait invisible : le contrôle principal ne sait vérifier que ce qu'il
  connaît déjà.
- **`RELEVÉ INCOMPLET`** — des éléments dont le texte n'a pas pu être lu
  (cellules fusionnées, formes récalcitrantes). Leur contenu échappe aux deux
  contrôles ci-dessus, mais il a bien été traité par les remplacements.
- **`ERREURS TOLÉRÉES`** — des pages qui ont refusé un remplacement, souvent des
  pages de notes. Le reste du deck est traité normalement.

## Structure des tables

`COMMON_EN` / `COMMON_ES` portent tout ce qui est identique d'un deck à l'autre :
feuille de route, équipe Mercateam, équipe partenaire, étapes du déploiement,
RACI, nos attentes, MercaNews. Les tables `DECKn_*` ne portent que le contenu
propre à leur deck, et `getJobs()` concatène les deux.

Une entrée dupliquée entre `COMMON` et une table de deck est sans effet : la
seconde ne trouve plus rien à remplacer. En cas de traductions divergentes,
c'est celle de `COMMON` qui gagne.

## Glossaire retenu

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
| Jalons | Milestones | Hitos |
| COPIL | Steering committee | Comité de dirección |
| Bilan | Review | Balance |
| Groupe de travail (GT) | Working group (WG) | Grupo de trabajo (GT) |
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
