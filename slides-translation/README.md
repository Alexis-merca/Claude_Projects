# Bibliothèque de traduction des présentations Google Slides (FR → EN / ES)

## Pourquoi un script

Claude n'a pas d'API Google Slides en écriture : il peut lire une présentation et
créer des copies via Drive, mais pas modifier le texte d'une slide. Le
contournement par export `.pptx` est impraticable (les decks pèsent 10 à 25 Mo,
principalement des images).

Donc : Claude lit le FR et produit les tables de traduction, ce script Apps
Script les applique aux copies, et l'utilisateur le lance.

## Les trois fichiers

Un seul projet Apps Script, gardé en permanence, contenant trois fichiers. Ils
partagent la même portée globale, l'ordre n'a pas d'importance.

| Fichier | Rôle | Fréquence de changement |
|---|---|---|
| `moteur.gs` | Le moteur de remplacement et ses garde-fous | Jamais |
| `glossaire.gs` | `COMMON_EN` / `COMMON_ES` : le vocabulaire Mercateam | S'enrichit à chaque lot |
| `jobs.gs` | Le lot en cours : `getJobs`, `RENAMES`, tables par deck | Remplacé à chaque lot |

**C'est `glossaire.gs` qui a de la valeur sur la durée.** Les decks de
déploiement Mercateam reprennent presque toujours les mêmes blocs — feuille de
route, équipe Mercateam, équipe partenaire, étapes du déploiement, RACI, nos
attentes, MercaNews, critères de Go Live, témoignages. Un nouveau deck est donc
déjà traduit à 80 % rien qu'avec le glossaire, et seul son contenu propre
demande du travail.

`archive/deck1.gs` garde la trace du premier lot ; il n'a pas à être collé dans
le projet Apps Script.

## Installation, une seule fois

1. Ouvrir [script.google.com](https://script.google.com) → **Nouveau projet**,
   le nommer par exemple « Traduction Slides Mercateam ».
2. Créer trois fichiers de script (**+** → *Script*) nommés `moteur`,
   `glossaire` et `jobs`, et y coller les fichiers correspondants. Supprimer le
   `Code.gs` par défaut.
3. **Ctrl+S**.

Ce projet est à conserver. Pour un nouveau lot de decks, seul `jobs.gs` est à
remplacer — et `glossaire.gs` si du vocabulaire s'est ajouté.

## Traduire un nouveau deck

1. Demander à Claude de traduire le deck, en donnant son URL et le dossier de
   destination. Il crée les copies EN/ES lui-même — inutile de les préparer.
2. Claude lit le français, le confronte au glossaire, et ne rédige que les
   entrées réellement nouvelles.
3. Il renvoie `jobs.gs` (et `glossaire.gs` s'il l'a enrichi).
4. Coller ces fichiers dans le projet, **Ctrl+S**.
5. Sélectionner **`runAll`** et **Exécuter**. Relancer jusqu'à lire
   `>>> Tous les jobs sont traités.`
6. Demander à Claude de relire les copies : c'est ce qui attrape ce que le
   rapport du script ne voit pas.

À la première exécution, Google demande une autorisation. L'écran « Google n'a
pas validé cette application » est normal pour un script personnel :
*Paramètres avancés* → *Accéder à …*. Le script n'ouvre que les copies listées
dans `RENAMES` et `getJobs()`, jamais les originaux.

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

Apps Script coupe une exécution à 6 minutes. Les 10 cibles (5 decks × EN/ES)
représentent environ 8 100 appels API, soit une vingtaine de minutes au total.

`translateAll` mesure la durée réelle des jobs déjà passés et ne démarre le
suivant que s'il a le temps de finir avant 5 min 30. Les `fileId` terminés sont
retenus dans les propriétés du script : relancer `runAll` reprend là où ça
s'était arrêté, sans refaire le travail déjà fait. Compter **environ 5
lancements**, ou 10 si l'API est lente ce jour-là.

Une exécution coupée en pleine passe 2 laisserait des sentinelles visibles dans
le deck. Ce n'est pas grave : le job n'ayant pas été marqué terminé, la relance
le reprend, la passe 1 ne trouve plus de français et la passe 2 remplace les
sentinelles restantes. Le deck se répare tout seul.

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
