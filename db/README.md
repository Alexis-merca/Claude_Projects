# Base partagée — Diagnostic OS

Socle de données pour le passage du fichier local à un outil partagé entre
consultants : persistance centralisée, visibilité commune, pas de perte
silencieuse quand deux personnes travaillent en même temps.

| Fichier | Rôle |
|---|---|
| `schema.sql` | Tables, contraintes, triggers, politiques d'accès, lecture JSON |
| `migrer.mjs` | Transforme un export JSON de l'application en SQL de chargement |

## Mise en place

```bash
psql "$DATABASE_URL" -f db/schema.sql
node db/migrer.mjs mon-export.json > charger.sql
psql "$DATABASE_URL" -f charger.sql
```

Le SQL de chargement est imprimé et non exécuté : il se relit avant d'être
appliqué à une base partagée. Il est rejouable — chaque client est supprimé par
son `code` puis réinséré, le tout dans une transaction.

## Les deux partis pris

**Le modèle est normalisé, pas stocké en un JSON par client.** Le blob aurait
collé au `etat.base` de l'application et se serait écrit plus vite, mais il rend
les collisions systématiques : deux consultants sur des processus différents du
même client s'écraseraient mutuellement. Avec une ligne par étape, par friction
et par chiffre, ils n'écrivent jamais au même endroit.

**Chaque table éditable porte un compteur `version`.** L'écriture se fait en
`... WHERE id = $1 AND version = $2` : si la version a bougé depuis la lecture,
aucune ligne n'est touchée et l'appelant le sait. Cela ne fusionne pas deux
modifications concurrentes — mais cela ne perd jamais rien en silence, seul
comportement réellement inacceptable. L'édition collaborative en temps réel
reste possible plus tard, et se poserait proprement sur ce schéma.

Le processus est l'unité de concurrence : modifier une étape, une friction ou un
chiffre fait avancer la version de son processus. Une écriture qui ne change
rien ne la fait pas avancer, pour ne pas invalider la lecture d'un collègue sans
raison.

## Ce que la base garantit

- **Tout rôle cité par une étape est un couloir de son processus.** Sinon la
  carte n'a aucune ligne où se poser dans le diagramme : elle disparaîtrait de
  l'écran sans rien signaler. La règle était tenue par l'application, elle est
  désormais tenue pour de bon.
- **L'ordre des étapes est unique dans un processus**, via une contrainte
  différée : un réordonnancement passe par des positions transitoirement en
  double et doit pouvoir se faire en une transaction.
- **Supprimer un client emporte tout son contenu.**

## Lecture

`client_json(code)` restitue un client entier au format de l'export de
l'application — une requête pour peupler l'écran, et un format que
`clientsDuJson()` sait déjà relire.

```sql
select client_json('sekurit-float-france');
```

## Accès

Lecture et écriture ouvertes à tout utilisateur **authentifié**, sans
cloisonnement : cela reproduit le drive partagé actuel. `authenticated` et non
`anon` — les données nomment des personnes et des constats sur des sites
clients, elles sont partagées en interne et non ouvertes au web.

Le rôle `authenticated` existe d'office sur Supabase. Sur un PostgreSQL nu, il
faut le créer avant d'appliquer le schéma.

## Choix assumés

**La date de visite est du texte, pas une `date`.** L'application la saisit
librement — « 22.06.2026 », mais aussi « T1 2026 » ou rien. Un type `date`
rejetterait ces valeurs et ferait perdre de l'information à la migration.

**L'environnement IT (`si`) est en `jsonb`, pas normalisé.** Domaines,
classement des outils, missions et liens sont édités d'un bloc et ne sont pas un
point de contention entre consultants. Le jour où ils le deviennent, ils se
normaliseront comme le reste.

## Vérifications

Exécutées sur PostgreSQL 16 avec les données réelles du diagnostic Sekurit
(4 processus, 49 étapes, 16 frictions, 11 chiffres) :

- aller-retour JSON → PostgreSQL → JSON **identique au champ près**, ordre des
  onglets, des étapes, des frictions et des outils compris ;
- écriture concurrente sur une version périmée refusée, valeur du premier
  écrivain intacte ;
- version du processus avancée par la modification d'un enfant, inchangée par
  une écriture identique ;
- étape portant un rôle absent des couloirs refusée ;
- permutation de deux étapes acceptée en une transaction ;
- suppression du client sans orphelins ;
- rejeu de la migration après modifications : données restaurées à l'identique.
