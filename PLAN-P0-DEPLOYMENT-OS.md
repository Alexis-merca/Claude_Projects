# Plan d'action P0 — Mercateam · Deployment OS

> **📄 Document de travail.** La version consolidée et destinée à la transmission
> est **`AUDIT-DEPLOYMENT-OS.md`** — elle intègre ce plan, ajoute un quatrième
> axe P0 (bug de capacité) et détaille les axes P1 et P2.

> Complément opérationnel de `ANALYSE-DEPLOYMENT-OS.md`.
> Contient les artefacts prêts à l'emploi : migration SQL, procédure de test,
> prompts pour l'agent Lovable, nouveau Knowledge projet, spécifications produit.
> Aucun de ces éléments n'a été appliqué au projet — ils sont à exécuter par
> l'équipe qui possède le projet Lovable.
> Établi le 05/08/2026 sur l'état `b8c8c0f`.

---

## Vue d'ensemble

| # | Axe | Effort | Qui | Délai visé |
|---|---|---|---|---|
| **P0-1** | Fermer la faille de lecture RLS | ~2 h (1 migration + tests) | Dev / agent Lovable | Immédiat |
| **P0-2** | Faire tourner la boucle d'imputation | 2 semaines (dont ~3 j de dev) | Léa (rituel) + agent (produit) | Sprint en cours |
| **P0-3** | Resynchroniser le Knowledge projet | 30 min | Auteur du projet | Aujourd'hui |

Ordre recommandé : **P0-3 d'abord** (30 min, il conditionne la qualité de tout ce
que l'agent fera ensuite), puis **P0-1**, puis **P0-2**.

---

# P0-1 · Fermer la faille de lecture RLS

## 1.1 Le problème, précisément

Quatorze politiques `SELECT` sont en `USING (true)` pour le rôle `authenticated`.
Le filtre `@merca.team` existe à deux endroits — mais aucun des deux ne protège les
données :

| Emplacement | Ce qu'il fait | Ce qu'il ne fait pas |
|---|---|---|
| `src/lib/auth.tsx` → `emailAllowed()` | Déconnecte l'utilisateur hors domaine dans l'UI | N'empêche pas un appel direct à l'API REST |
| `ensure_my_role()` | Refuse d'attribuer un rôle hors domaine | N'empêche pas la **lecture**, qui ne demande aucun rôle |

La clé anon Supabase est publique par construction (elle est dans le bundle JS
servi à tout visiteur). Si le provider Google du projet accepte n'importe quel
compte Google, un tiers obtient un JWT `authenticated` valide et lit directement :

```
GET /rest/v1/site?select=nom,ville,arr,effectif,jh_vendus
GET /rest/v1/client?select=nom,notes
GET /rest/v1/consultant?select=nom,email,heures_hebdo
GET /rest/v1/conges?select=*
```

soit : le portefeuille clients, l'**ARR par site**, les effectifs, les volumes
vendus, et les congés de l'équipe.

**Note importante sur les écritures** : elles sont déjà protégées transitivement,
car elles passent toutes par `has_role()` ou `current_consultant_id()` — un compte
hors domaine n'a ni rôle (bloqué par `ensure_my_role`) ni ligne `consultant`
correspondante. **Le trou est en lecture seule.** C'est déjà beaucoup.

## 1.2 Le trou secondaire : les GRANT au rôle `anon`

Héritage des toutes premières migrations : le rôle `anon` détient encore
`SELECT, INSERT, UPDATE, DELETE` sur 22 tables, dont `client`, `site`, `projet`,
`tache`, `imputation`, `consultant`, `user_roles`, `google_tokens`.

Ce n'est **pas exploitable aujourd'hui** (aucune policy ne cible `anon`, et RLS
refuse par défaut). Mais la marge d'erreur est nulle : une seule policy créée sans
clause `TO` (le défaut PostgreSQL est `PUBLIC`, qui inclut `anon`) exposerait
instantanément toute la table en **non authentifié**. Sur un projet où l'agent IA
écrit les migrations, ce scénario n'est pas théorique.

## 1.3 La migration

```sql
-- =====================================================================
-- P0-1 · Restriction du domaine au niveau des politiques de lecture
-- =====================================================================

-- 1) Helper unique — une seule définition à maintenir.
CREATE OR REPLACE FUNCTION public.is_merca_team()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT split_part(coalesce(public.current_user_email(), ''), '@', 2) = 'merca.team'
$$;

COMMENT ON FUNCTION public.is_merca_team() IS
  'Vrai si le JWT courant porte un e-mail @merca.team. À utiliser dans TOUTE '
  'policy SELECT. La restriction côté client (auth.tsx) ne protège pas l''API REST.';

GRANT EXECUTE ON FUNCTION public.is_merca_team() TO authenticated;

-- 2) Réécriture des 15 politiques de lecture ouvertes.
--    (nom → nouveau nom explicite, pour repérer d'un coup d'œil les policies migrées)

DROP POLICY IF EXISTS "client_read_authenticated"    ON public.client;
CREATE POLICY "client_read_merca"        ON public.client        FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "read projet auth"             ON public.projet;
CREATE POLICY "projet_read_merca"        ON public.projet        FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "read site auth"               ON public.site;
CREATE POLICY "site_read_merca"          ON public.site          FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "read tache auth"              ON public.tache;
CREATE POLICY "tache_read_merca"         ON public.tache         FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "imputation_read_auth"         ON public.imputation;
CREATE POLICY "imputation_read_merca"    ON public.imputation    FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "consultant_read_auth"         ON public.consultant;
CREATE POLICY "consultant_read_merca"    ON public.consultant    FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "cp_read_auth"                 ON public.consultant_periode;
CREATE POLICY "cp_read_merca"            ON public.consultant_periode FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "conges_read_auth"             ON public.conges;
CREATE POLICY "conges_read_merca"        ON public.conges        FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "read_part_interne_all_auth"   ON public.part_interne_mois;
CREATE POLICY "pim_read_merca"           ON public.part_interne_mois FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "pfm_read_auth"                ON public.payfit_identity_map;
CREATE POLICY "pfm_read_merca"           ON public.payfit_identity_map FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "pc_read_auth"                 ON public.pricing_config;
CREATE POLICY "pc_read_merca"            ON public.pricing_config FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "read_ws_all_auth"             ON public.workload_settings;
CREATE POLICY "ws_read_merca"            ON public.workload_settings FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "hubspot_cache_read_auth"      ON public.hubspot_company_cache;
CREATE POLICY "hs_cache_read_merca"      ON public.hubspot_company_cache FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "geocode_cache_read_auth"      ON public.geocode_cache;
CREATE POLICY "geocode_read_merca"       ON public.geocode_cache FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "contact_site read auth"       ON public.contact_site;
CREATE POLICY "contact_site_read_merca"  ON public.contact_site  FOR SELECT TO authenticated USING (public.is_merca_team());

-- 3) Corrections des anomalies P1 tant qu'on est dans le fichier.

-- 3a) tache_deleted_backup : le SELECT est réservé au rôle 'utilisateur',
--     donc un ADMIN ne peut pas lire la table de sauvegarde. Inversion probable.
DROP POLICY IF EXISTS "manager reads backup" ON public.tache_deleted_backup;
CREATE POLICY "tache_backup_read_admin" ON public.tache_deleted_backup
  FOR SELECT TO authenticated
  USING (public.is_merca_team() AND public.has_role(auth.uid(), 'admin'));

-- 3b) imputation_deleted_backup : n'importe quel authentifié pouvait écrire
--     dans la table d'audit. Une table d'audit ne s'alimente que par trigger
--     ou service_role.
DROP POLICY IF EXISTS "system writes backups" ON public.imputation_deleted_backup;

-- 3c) geocode_cache : écritures réservées aux comptes du domaine
--     (évite l'empoisonnement de cache par un compte tiers).
DROP POLICY IF EXISTS "geocode_cache_insert_auth" ON public.geocode_cache;
DROP POLICY IF EXISTS "geocode_cache_update_auth" ON public.geocode_cache;
CREATE POLICY "geocode_insert_merca" ON public.geocode_cache
  FOR INSERT TO authenticated WITH CHECK (public.is_merca_team());
CREATE POLICY "geocode_update_merca" ON public.geocode_cache
  FOR UPDATE TO authenticated USING (public.is_merca_team()) WITH CHECK (public.is_merca_team());

-- 3d) user_ical : l'utilisateur peut écrire son URL mais pas la relire.
CREATE POLICY "user_ical_read_own" ON public.user_ical
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 4) Nettoyage des privilèges du rôle anon (défense en profondeur).
--    Aucune policy ne cible anon aujourd'hui ; ces GRANT ne servent donc à rien,
--    mais transforment la moindre policy sans clause TO en fuite anonyme.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
```

> ⚠️ **Deux points de vigilance sur l'étape 4.**
> 1. Elle est la seule qui peut casser quelque chose. À vérifier juste après :
>    l'écran de connexion, le flux OAuth Lovable (`/.lovable/oauth/consent`), et
>    `/.mcp/list-tools`. Aucun de ces trois ne lit de table applicative, donc le
>    risque est faible — mais il se teste en 2 minutes.
> 2. L'outillage Lovable peut re-granter `anon` lors d'une future migration
>    générée par l'agent. D'où l'intérêt de faire figurer la règle dans le
>    Knowledge (P0-3) et de la vérifier via la requête de contrôle ci-dessous.

## 1.4 Verrouiller aussi la porte d'entrée (complémentaire, pas alternatif)

**a) Indice de domaine côté Google** — 1 ligne dans `src/lib/auth.tsx` :

```ts
const { error } = await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: window.location.origin,
    scopes: "openid email profile",
    queryParams: {
      prompt: "select_account",
      hd: "merca.team",          // ← restreint le sélecteur de compte Google
    },
  },
});
```

> `hd` est un **confort d'interface, pas un contrôle de sécurité** : il est
> contournable côté client. Il réduit les erreurs d'utilisateurs, il ne remplace
> jamais la RLS ci-dessus.

**b) Auth Hook `before-user-created`** (Supabase, plans payants) — rejette la
création de compte hors domaine. C'est le vrai verrou côté entrée. À activer si
le plan le permet ; sinon la RLS suffit, puisque c'est elle qui garde la donnée.

## 1.5 Procédure de test — avant / après

**Test 1 — reproduire la faille (à faire AVANT la migration, pour la preuve)**

```bash
# 1. Se connecter à l'app publiée avec un compte Google PERSONNEL (hors merca.team).
#    L'UI vous déconnecte : c'est normal, c'est le comportement actuel.
# 2. AVANT la déconnexion, récupérer le JWT dans la console du navigateur :
#    JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.includes('auth-token')))).access_token
# 3. Appeler l'API directement :

curl -s "https://<PROJECT_REF>.supabase.co/rest/v1/site?select=nom,ville,arr&limit=5" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <JWT_DU_COMPTE_EXTERNE>"
```

- **Avant la migration** : renvoie 5 sites avec leur ARR → faille confirmée.
- **Après la migration** : renvoie `[]` → faille fermée.

**Test 2 — non-régression avec un compte légitime**

Même `curl` avec un JWT `@merca.team` → doit continuer à renvoyer les données.
Puis, dans l'app : ouvrir les 4 onglets + Admin, vérifier qu'aucune liste ne s'est
vidée (une policy oubliée se voit immédiatement : l'écran devient vide, pas en erreur).

**Test 3 — requête de contrôle permanente**

À relancer après **chaque** migration future, et à afficher dans l'écran Admin :

```sql
-- Doit renvoyer 0 ligne. Toute ligne = une policy de lecture non protégée.
SELECT tablename, policyname, roles::text, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd = 'SELECT'
  AND qual NOT ILIKE '%is_merca_team%'
  AND qual NOT ILIKE '%auth.uid()%'
  AND qual NOT ILIKE '%has_role%'
UNION ALL
-- Doit renvoyer 0 ligne. Toute ligne = un privilège rendu au rôle anon.
SELECT table_name, 'GRANT anon: ' || string_agg(DISTINCT privilege_type, ','), 'anon', null
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee = 'anon'
GROUP BY table_name;
```

## 1.6 Prompt prêt à coller dans Lovable

```
Sécurité — restreindre la lecture au domaine @merca.team.

Constat : les policies SELECT de client, projet, site, tache, imputation,
consultant, consultant_periode, conges, part_interne_mois, payfit_identity_map,
pricing_config, workload_settings, hubspot_company_cache, geocode_cache et
contact_site sont en USING(true) pour le rôle authenticated. Le filtre de domaine
n'existe que côté client (auth.tsx) et dans ensure_my_role(), donc un compte Google
hors domaine avec un JWT valide peut lire l'ARR, les clients et les congés via
l'API REST directement.

À faire, dans UNE migration :
1. Créer public.is_merca_team() : sql, STABLE, SET search_path='public', qui
   renvoie split_part(coalesce(current_user_email(),''),'@',2) = 'merca.team'.
   GRANT EXECUTE au rôle authenticated.
2. Remplacer les 15 policies SELECT listées ci-dessus par des policies
   FOR SELECT TO authenticated USING (public.is_merca_team()).
   Ne touche à AUCUNE policy d'écriture : elles sont déjà protégées via
   has_role() et current_consultant_id().
3. Corriger 4 anomalies :
   - tache_deleted_backup : le SELECT est réservé au rôle 'utilisateur', l'admin
     ne peut pas lire la table. Le passer à has_role(auth.uid(),'admin').
   - imputation_deleted_backup : supprimer la policy INSERT WITH CHECK(true).
   - geocode_cache : INSERT et UPDATE doivent exiger is_merca_team().
   - user_ical : ajouter la policy SELECT manquante (auth.uid() = user_id).
4. REVOKE ALL ON ALL TABLES / SEQUENCES IN SCHEMA public FROM anon, et
   ALTER DEFAULT PRIVILEGES ... REVOKE ALL ON TABLES FROM anon.
5. Ajouter dans src/lib/auth.tsx le queryParam Google hd:"merca.team"
   (confort UI seulement, la RLS reste le vrai contrôle).

Ensuite : lance assert_workload_invariants() et assert_vendu_invariant() pour
vérifier qu'aucune lecture applicative n'a été cassée, et dis-moi si un écran
se retrouve vide.
```

---

# P0-2 · Faire tourner la boucle d'imputation

## 2.1 Le constat chiffré

| Source | Lignes | J/H | Dernière date |
|---|---|---|---|
| `clickup:api` (import historique) | 2 450 | 810,6 | **24/07/2026** |
| `import` (manuel, ponctuel) | 25 | 21,0 | 31/07/2026 |
| `saisie` (**dans l'outil**) | **11** | **8,8** | 28/07/2026 |
| `agenda` | **1** | 0,1 | 28/07/2026 |

Par consultant actif :

| Consultant | Tâches assignées | J/H forecast portés | **J/H saisis dans l'outil** |
|---|---|---|---|
| Matthieu | 238 | 274,7 | **0** |
| Bastien | 204 | 292,7 | **0** |
| Alexis | 152 | 214,7 | **0** |
| Franklin | 147 | 197,8 | **0** |
| Léa (manager, hors capacité) | 36 | 37,0 | 0,2 |

**Aucun des quatre consultants qui portent la charge n'a jamais imputé dans
l'outil.** Et il n'y a plus aucun réalisé depuis 12 jours.

Conséquence : le Cockpit, le Forecast vs Réel, les deltas vendu/réalisé et la
capacité réelle calculent tous sur un jeu de données figé. Chaque nouvel écran
d'analyse ajouté avant de régler ça augmente la surface à maintenir sans ajouter
de valeur.

**Bonne nouvelle** : il n'y a **aucun blocage technique**. Les 5 consultants ont un
e-mail `@merca.team` renseigné, donc `current_consultant_id()` résout et la policy
`imputation_insert_self_or_admin` les autorise. La mécanique est prête, elle n'est
simplement pas utilisée.

## 2.2 Le plan en 4 temps

### Semaine 0 — Lever les préalables (½ journée, aucun dev)

1. **Vérifier que chaque consultant peut effectivement imputer.** Seuls 3 comptes
   sur 5 ont une ligne dans `user_roles`, ce qui signifie que 2 personnes ne se
   sont jamais connectées. Requête de contrôle :
   ```sql
   SELECT c.nom, c.email,
          (SELECT count(*) FROM user_roles ur
            WHERE ur.user_id = (SELECT id FROM auth.users u WHERE lower(u.email)=lower(c.email))) AS role_ok
   FROM consultant c WHERE c.actif;
   ```
   Toute ligne à `role_ok = 0` = quelqu'un qui n'a jamais ouvert l'outil.
2. **Combler le trou du 24/07 à aujourd'hui.** Sinon le premier mois de mesure
   démarre avec un creux artificiel qui décrédibilise le KPI. Deux options :
   un dernier export ClickUp, ou une saisie rétroactive collective de 20 minutes.
3. **Nommer un propriétaire du rituel.** Léa, par construction (elle est déjà
   l'admin et hors capacité).

### Semaine 1 — Le rituel avant le produit

Le rituel se met en place **sans attendre les développements** : la page
d'imputation existe déjà et fonctionne.

- **Créneau fixe : vendredi 16 h, 5 minutes.** « J'impute ma semaine. »
- **Rappel automatique** — le plus simple d'abord : un message Slack programmé le
  vendredi 15 h 45 dans le canal de l'équipe implémentation. Zéro développement.
  (Une Routine planifiée, un rappel Slack natif, ou un cron `pg_cron` +
  webhook selon ce qui est déjà en place.)
- **Revue publique le lundi** : Léa affiche le taux de complétion de la semaine
  écoulée en réunion d'équipe. C'est ce qui fait la différence entre un outil
  installé et un outil utilisé.

### Semaine 1-2 — Les 3 développements qui font baisser le coût de saisie

Rangés par rapport impact / effort.

**① Pré-remplissage agenda par défaut** — *le plus rentable*
La mécanique existe entièrement (`PrefillAgendaDialog.tsx`, `agenda-parser.ts`,
`AgendaVsImputationsBlock.tsx`, règle « contact dont le domaine mail = client →
front »). Elle est aujourd'hui en **opt-in dans un dialogue à ouvrir** — résultat :
1 seule imputation en est issue.

À faire : sur `/workload/imputation`, afficher **d'office** en haut de page, pour
la semaine en cours, un bloc « Proposé depuis votre agenda » avec les créneaux
détectés, un bouton **« Tout accepter »** et une croix par ligne pour écarter.
La saisie passe de « ouvrir un dialogue, choisir une période, mapper » à « relire
et valider ».

**② Le KPI de complétion** — *ce qui n'est pas mesuré n'est pas fait*
Définition : `J/H imputés du mois ÷ J/H facturables du mois` (la capacité est déjà
calculée par `capaciteRange()` / `capaciteMois()`, nettes de congés et de part
interne). Cible : **85 %**, cohérent avec l'objectif de staffing par défaut.

Trois emplacements :
- **Espace consultant** : une jauge « ma semaine / mon mois », visible dès l'arrivée.
- **Cockpit → Synthèse** : une ligne par consultant, en tête, avant tout le reste.
- **Admin** : l'historique mensuel, pour voir si la pratique tient dans le temps.

**③ Saisie mobile** — *1 visiteur mobile sur 69*
C'est pourtant le seul écran qu'un consultant remplirait depuis un site client, le
soir, en 90 secondes. Objectif : une colonne, une ligne par tâche du jour, des
boutons `+0,5 j` / `+1 j` plutôt qu'un champ numérique, et rien d'autre à l'écran.
Pas une refonte : une variante responsive de `SaisiePage`.

### Semaine 3-4 — Fiabiliser ce qui entre

- **Verrouillage mensuel.** Nouvelle table `imputation_lock(mois, verrouille_le,
  verrouille_par)` + une clause dans les policies `INSERT`/`UPDATE`/`DELETE` de
  `imputation` refusant toute écriture sur un mois verrouillé (sauf admin). Sans
  ça, le réalisé reste réécrivable indéfiniment et ne peut pas servir de base à un
  recalibrage de chiffrage.
- **Contrôle qualité dédié.** Ajouter un 11ᵉ contrôle dans `data-quality.ts` :
  « consultants sous 85 % de complétion sur le mois écoulé », avec action
  « relancer ».
- **Boucler sur le chiffrage** — c'est la finalité de tout l'édifice : une fois
  3 mois de réalisé fiable accumulés, comparer `tache.heures` (vendu) à
  `imputation.heures` (réalisé) par type de projet et **réinjecter l'écart dans
  les matrices de répartition** du moteur (60/0/40/0, 10/50/10/30, 30/40/15/15) et
  dans la formule de durée théorique. C'est là que l'outil commence à rapporter
  de l'argent plutôt qu'à en coûter.

## 2.3 Comment savoir que c'est gagné

| Indicateur | Aujourd'hui | Cible à 4 semaines |
|---|---|---|
| Imputations de source `saisie` ou `agenda` par mois | ~12 au total | **≥ 150 / mois** |
| Consultants ayant imputé la semaine écoulée | 0 / 4 | **4 / 4** |
| Taux de complétion moyen (imputé ÷ facturable) | non mesurable | **≥ 85 %** |
| Écart max entre dernière imputation et aujourd'hui | 12 jours | **≤ 7 jours** |

Requête de suivi hebdomadaire :

```sql
SELECT date_trunc('week', i.date)::date AS semaine,
       count(DISTINCT i.consultant_id) AS consultants_actifs,
       round(sum(i.heures)/8.0, 1)      AS jh_saisis
FROM imputation i
WHERE i.source IN ('saisie','agenda')
  AND i.date >= current_date - interval '8 weeks'
GROUP BY 1 ORDER BY 1 DESC;
```

## 2.4 Prompt prêt à coller dans Lovable (lot ① + ②)

```
Adoption de l'imputation — deux changements.

Contexte : sur 2 487 imputations en base, 2 450 viennent de l'import ClickUp et
seulement 12 ont été produites dans l'outil. Aucun des 4 consultants actifs
(Matthieu, Bastien, Alexis, Franklin) n'a jamais imputé. Objectif : réduire le
coût de saisie et rendre la complétion visible.

1) Pré-remplissage agenda par défaut.
   Le mécanisme existe déjà (PrefillAgendaDialog, agenda-parser, la règle
   "contact dont le domaine mail = client → front"), mais il est enfoui dans un
   dialogue à ouvrir. Sur /workload/imputation, afficher d'office, en tête de
   page et pour la semaine en cours, un bloc "Proposé depuis votre agenda" :
   la liste des créneaux détectés avec la tâche devinée, un bouton "Tout
   accepter" qui crée les imputations en source='agenda', et une croix par ligne
   pour écarter une proposition. Si l'agenda n'est pas connecté, afficher à la
   place l'invitation à le connecter. Ne change rien au parser existant.

2) KPI de taux de complétion.
   Définition : J/H imputés du mois ÷ J/H facturables du mois (utilise
   capaciteMois/capaciteRange existants, nets de congés et part interne).
   Cible 85 %, réutilise les bandes de couleur de STAFFING_BANDS.
   L'afficher à trois endroits :
   - Espace consultant : jauge "ma semaine" + "mon mois", en haut de page ;
   - Cockpit > Synthèse : une ligne par consultant, tout en haut ;
   - Admin : l'historique des 6 derniers mois.

Contraintes : ne touche pas au moteur de calcul de capacité, ne modifie aucune
policy RLS, et n'ajoute pas de fichier de plus de 400 lignes — extrais les
sous-composants dans src/features/workload/shared/.
```

---

# P0-3 · Resynchroniser le Knowledge projet

## 3.1 Pourquoi c'est P0 malgré ses 30 minutes

Le Knowledge est le prompt système permanent de l'agent Lovable : il est rechargé
à **chaque** prompt. Le Knowledge actuel décrit une application à **2 onglets**
(`Deployment Offer` / `Workload Management` avec 4 sous-onglets) qui n'existe plus
depuis longtemps — l'app en a 4 de premier niveau plus un Admin, et le Cockpit a
sa propre hiérarchie.

Conséquences concrètes, à chaque prompt : l'agent cherche des écrans qui n'existent
plus, propose des emplacements incohérents, doit relire le code pour se réorienter
(donc consomme des crédits), et n'a aucune connaissance des règles apprises depuis
(sécurité, taille des fichiers, vocabulaire, migrations en cours).

C'est le meilleur rapport impact / effort de tout ce document.

## 3.2 Knowledge de remplacement, prêt à coller

```markdown
# Deployment OS — contexte produit

Outil interne de l'équipe Implémentation Mercateam. Deux métiers réunis :
le **chiffrage** des offres de déploiement, et le **workload management** qui
remplace ClickUp. Lien central : une offre chiffrée génère un projet en statut
« Simulation » dont le forecast est déduit des règles ci-dessous, qui pèse sur la
capacité de l'équipe, puis se confronte au temps réellement imputé.

## ⚠️ Vocabulaire — à lire avant toute modification

- La table `projet` porte le **deal / client** (statut, LPM, IC, répartition par défaut).
- La table `site` porte ce que l'équipe appelle « un projet » : J/H vendus,
  effectif, dates, ARR, société HubSpot, statut.
- Une **tâche** avec `site_id IS NULL` et `client_id` renseigné est une tâche de
  **gouvernance groupe** (transverse au client, sans dates). Ne jamais écrire
  `t.site_id!` : toujours filtrer `site_id != null` d'abord.

## Navigation réelle (AppShell.tsx) — 4 personas

1. **Chiffrage** — Simulator New offer · Simulator Upsell · Backlog Offers · Références
2. **Clients & projets** — Backlog (board Kanban / timeline / carte / vue par client)
3. **Cockpit** — Synthèse · Analyse Clients & projets · Analyse Charge · Analyse Indicateurs de performance
4. **Espace consultant** — page autonome, sans sous-nav
+ **Admin** derrière l'engrenage du bandeau (paramétrage, connecteurs, rôles,
  qualité de données) et page Conventions UI.

## Rôles (table user_roles, miroir front dans src/lib/permissions.ts)

- `admin` : lecture + édition partout.
- `utilisateur` : lecture partout, aucune édition ni suppression.
- `consultant` : lecture partout, édition sur SES projets (LPM/IC du projet ou du
  site, ou assigné sur une tâche) et son Espace consultant.
- Exception : l'onglet **Chiffrage** reste éditable par tout le monde.

## Modèle de données (Supabase / Postgres)

- `client`(nom, business_industry, gouvernance_jh/debut/fin/consultant_id, notes)
- `consultant`(nom, email, heures_hebdo=39, actif, inclus_capacite)
- `consultant_periode`(consultant_id, date_debut, date_fin?, part_interne, capacite_hebdo)
- `part_interne_mois`(consultant_id, mois, valeur) — override mensuel, prioritaire
- `conges`(consultant_id, date, jours) — source Payfit
- `projet`(client_id, statut, tag[upsell|deploiement|autre|poc], repartition_defaut,
  lpm_id, ic_id, gouvernance_*, source_offer_id, pricing_meta, archived_at, deleted_at)
- `site`(projet_id, nom, code, jh_vendus, effectif, statut, repartition_override,
  lpm/ic_id_override, kick_off, visite, go_live, go_live_auto, duree_mois, cloture,
  churn, est_brouillon, fail_reason, arr, bu, features_facturees, frais_deploiement,
  support_vendu, mercateam_org_id, hubspot_site_company_id, latitude/longitude/ville/pays)
- `tache`(site_id?, client_id?, nom, code, type[front|back|visite], role[LPM|IC],
  consultant_id, debut, fin, heures ← forecast, visite_validee, clickup_task_id)
- `imputation`(tache_id, consultant_id, date [JOUR], heures ← réalisé,
  source[saisie|agenda|agenda_import|import|clickup:api], confiance)
- Statuts projet/site : `simulation | booked | ongoing | done | blocked | fail`

## Règles de calcul (moteur) — NE JAMAIS MODIFIER SANS DEMANDE EXPLICITE

- 1 J/H = 8 h. Visite = 16 h fixes / consultant présent, ou le volume vendu si
  l'offre le précise.
- Répartition du reste après visite, en [LPM front, IC front, LPM back, IC back] :
  `solo` 60/0/40/0 · `r3070` 10/50/10/30 · `r5050` 30/40/15/15.
  `personnalisee` est HORS règle : heures définies tâche par tâche, jamais
  régénérées automatiquement.
- Durée théorique (mois) selon effectif N : N≤100 → 1,5 ; N≤200 → (N/200)×3 ;
  N>200 → 3+(N−200)/200×1,5 ; arrondi au quart. `go_live_auto = kick_off + durée`.
- Capacité facturable/mois = (jours ouvrés − fériés France − congés) ×
  (heures_hebdo/5) × (1 − part_interne), bornée à la période d'activité.
- Étalement forecast : au prorata des jours ouvrés, **fériés inclus** (règle
  assumée : approximation théorique). La capacité, elle, exclut les fériés.
- Recalibrage : modifier une ligne rééquilibre les autres sur le total J/H du
  site, sauf les tâches marquées « éditée à la main » et sauf la visite.
- Bandes de staffing : <50 % sous-staffé · 50-75 % sous-charge légère ·
  75-90 % bien staffé · >90 % surstaffing à surveiller.

## Sécurité — règles non négociables

- Toute nouvelle table : `ENABLE ROW LEVEL SECURITY` + policies **explicitement**
  `TO authenticated` (jamais de clause TO omise : le défaut PUBLIC inclut `anon`).
- Toute policy `SELECT` doit inclure `public.is_merca_team()`. La restriction de
  domaine côté client (`auth.tsx`) ne protège PAS l'API REST.
- Ne jamais granter quoi que ce soit au rôle `anon`.
- Secrets et appels d'API tiers : uniquement dans `*.server.ts` ou
  `*.functions.ts`, jamais dans un composant.

## Conventions de code

- React + TS + Tailwind + shadcn/ui. UI en **français**.
- Les moteurs de calcul (`workload-engine.ts`, `workload-capacity.ts`,
  `pricing-engine`) sont **purs** : aucun accès Supabase. Garder cette séparation.
- Réutiliser `src/components/ui-kit/` avant de créer un composant.
- **Aucun nouveau fichier au-delà de 400 lignes** : extraire dans
  `src/features/workload/shared/`. (CapacitePage, SynthesePage et ImputationPage
  sont déjà trop gros — les réduire à chaque passage, ne pas les agrandir.)
- Après toute migration touchant `tache`, `site`, `projet`, `client` ou
  `imputation` : exécuter `assert_workload_invariants()`,
  `assert_vendu_invariant()` et `assert_imputation_reconciliation()`.
- Charte : violet #6733FD (primaire), turquoise #2AC6CC (secondaire),
  police General Sans.

## Chantiers en cours — état au 05/08/2026

- **Gouvernance groupe** : étapes 1-2 faites (données + affichage fiche client).
  Restent : imputation des tâches client-level, audit des 31 `t.site_id!`,
  RPC de réconciliation `assert_clickup_reconciliation`.
- **Legacy à retirer** : `projet.gouvernance_jh` (remplacé par les tâches
  client-level), `client.gouvernance_jh` (à 0 partout).
- **Tables de staging** `stg_*` : à archiver une fois la réconciliation ClickUp validée.

## Priorité produit actuelle

L'imputation ne tourne pas encore (12 saisies dans l'outil sur 2 487 lignes).
**Ne pas ajouter de nouvel écran d'analyse** tant que le taux de complétion
d'imputation n'a pas atteint 85 % sur 4 semaines : tout KPI ajouté d'ici là
calcule sur un réalisé mort. Privilégier ce qui réduit le coût de saisie.
```

## 3.3 Deux gestes complémentaires, même session

1. **Ménage du dépôt** — supprimer `fix_final.py`, `fix_team.py`, `fix_team_v2.py`,
   `fix_team_v3.py`, `replace.py` et le fichier nommé `map.get(` à la racine.
   Résidus de scripts one-shot que l'agent lit à chaque exploration du projet.
2. **Ajouter `.env` au `.gitignore`** et créer un `.env.example`. Le fichier ne
   contient aujourd'hui en principe que des variables publiques `VITE_*`, mais
   rien n'empêche le prochain connecteur d'y déposer un secret.

Prompt combiné :

```
Ménage du dépôt : supprime les fichiers résiduels à la racine — fix_final.py,
fix_team.py, fix_team_v2.py, fix_team_v3.py, replace.py, et le fichier nommé
"map.get(". Ce sont des scripts jetables d'une migration passée. Ajoute .env au
.gitignore et crée un .env.example listant les variables attendues sans leurs
valeurs. Ne touche à rien d'autre.
```

---

## Récapitulatif — ordre d'exécution

| Jour | Action | Livrable vérifiable |
|---|---|---|
| J | P0-3 · Coller le nouveau Knowledge + ménage du dépôt | Knowledge à jour, racine propre |
| J+1 | P0-1 · Migration RLS + tests 1/2/3 | `curl` avec JWT externe → `[]` |
| J+1 | P0-2 · Vérifier les 5 accès consultants, combler le trou du 24/07 | 5/5 rôles provisionnés |
| J+2 | P0-2 · Lancer le rituel vendredi 16 h + rappel Slack | 1ʳᵉ semaine imputée |
| S+1 | P0-2 · Pré-remplissage agenda par défaut + KPI de complétion | KPI visible sur 3 écrans |
| S+2 | P0-2 · Saisie mobile | Page utilisable au téléphone |
| S+4 | Bilan | ≥ 150 imputations/mois, complétion ≥ 85 % |
```
