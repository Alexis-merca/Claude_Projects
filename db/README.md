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
- **Supprimer un client emporte tout son contenu** — mais **pas ses versions** :
  la table `versions` n'a volontairement aucune clé étrangère vers `clients`,
  sans quoi l'instantané pris « avant suppression » partirait avec ce qu'il est
  censé sauver. Elle recopie `code_client` et `nom_client` pour rester lisible
  et restaurable quand la ligne d'origine n'existe plus.
- **Une friction rattachée à une étape désigne une étape du même processus.**
  La clé est composite `(etape_id, processus_id)` : une clé simple n'aurait pas
  su le dire. Supprimer l'étape détache la friction (`on delete set null` sur la
  seule colonne `etape_id`) au lieu de l'emporter — un constat de terrain ne
  disparaît pas parce que la carte qu'il désignait a été réécrite.
- **Au plus une trame `existant` et une trame `cible`**, par index unique
  partiel. Le code lit la trame en `order by maj_le desc limit 1` : sans cette
  garantie, deux diagnostics marqués feraient basculer la source de
  pré-remplissage en silence.

## Lecture

`client_json(code)` restitue un client entier au format de l'export de
l'application — une requête pour peupler l'écran, et un format que
`clientsDuJson()` sait déjà relire.

```sql
select client_json('sekurit-float-france');
```

## Accès

Lecture et écriture réservées aux adresses **`@merca.team`**, vérifiées dans le
JWT par `est_mercateam()`. Pas de cloisonnement entre consultants à l'intérieur
du domaine : cela reproduit le drive partagé actuel.

Le filtre par domaine n'est pas un raffinement. La connexion passe par un
fournisseur OAuth qui accepte n'importe quelle adresse : sans lui, « être
authentifié » suffirait à voir tous les diagnostics de tous les sites clients.

Le rôle `authenticated` existe d'office sur Supabase. Sur un PostgreSQL nu, il
faut le créer — ainsi que la fonction `auth.jwt()` — avant d'appliquer le
schéma.

## Vérifier que `schema.sql` est à jour

**Ce fichier est recopié de la base, il ne la pilote pas.** Les migrations sont
appliquées depuis l'application et vivent dans `supabase/migrations/` du dépôt
applicatif ; `schema.sql` dérive dès que l'une d'elles passe sans être
recopiée. Ça s'est produit : entre le 31/07 et le 07/08, il a manqué une table
(`versions`), huit colonnes, sept contraintes, cinq fonctions, et le
changement de politique d'accès.

Pour comparer, sur la base réelle :

```sql
-- tables et colonnes
select c.relname, a.attname, format_type(a.atttypid, a.atttypmod)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
 where c.relkind = 'r' order by 1, a.attnum;

-- contraintes, index, triggers, politiques
select conrelid::regclass, conname, pg_get_constraintdef(oid) from pg_constraint
 where connamespace = 'public'::regnamespace order by 1, 2;
select tablename, indexdef from pg_indexes where schemaname = 'public' order by 1;
select c.relname, pg_get_triggerdef(t.oid) from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
 where not t.tgisinternal;
select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public';

-- fonctions
select proname, pg_get_functiondef(oid) from pg_proc
 where pronamespace = 'public'::regnamespace order by 1;
```

Tant que ce contrôle est manuel, il ne sera pas fait. L'automatiser est en
feuille de route.

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
