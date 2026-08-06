# Audit — Mercateam · Deployment OS
### Document de transmission — 19 axes d'amélioration, P0 à P2

---

**Objet** — Audit externe du projet Lovable `mercateam-internal-deploymentos`
(Deployment OS), réalisé à la demande d'Alexis Merca, destiné à l'auteur du projet.

**Périmètre et méthode** — Audit **en lecture seule**. Ont été analysés :
l'arborescence complète du dépôt, le contenu des fichiers structurants, le schéma
PostgreSQL (24 tables, ~30 fonctions), l'intégralité des politiques RLS, le
Knowledge projet, le plan de travail de l'agent, les analytics de la version
publiée, et des requêtes SQL d'inventaire (`SELECT` uniquement). Deux bugs ont été
reproduits par exécution locale du code des moteurs.

**Ce qui n'a PAS été fait** — Aucun message envoyé à l'agent Lovable, aucune
modification du projet, aucune écriture en base. Rien de ce qui suit n'a été
appliqué : ce sont des propositions.

**Limites assumées** — L'application n'a pas été utilisée en session réelle
(l'accès est restreint au domaine). Tous les fichiers n'ont pas été lus
intégralement. Deux constats sont **conditionnels** et leur test est fourni :
la faille RLS (§P0-1) dépend du paramétrage du provider Google côté Supabase, et
le bug de capacité (§P0-2) dépend du fuseau d'exécution.

**État analysé** — commit `b8c8c0f`, 05/08/2026.

**Comment lire ce document** — §1 donne la synthèse et les 4 actions de la semaine.
§2 rassemble les constats chiffrés qui justifient les priorités. §3 à §5 détaillent
les 19 axes (constat → impact → correctif → effort). §6 dit ce qui est réussi —
et il y en a beaucoup. §7 propose une feuille de route. Les annexes contiennent
les requêtes de contrôle et les prompts prêts à coller dans Lovable.

---

# 1. Synthèse

## 1.1 En une page

Deployment OS est un outil **remarquable pour deux semaines de construction** :
la modélisation métier est d'une précision rare, les moteurs de calcul sont purs
et testables, la sécurité est réelle (RLS, pas seulement des gardes d'interface),
la reprise de l'historique ClickUp a été menée jusqu'au bout avec des invariants
de réconciliation. C'est un vrai produit, pas un prototype.

Trois choses l'empêchent aujourd'hui d'être fiable et adopté :

1. **Un bug de calcul silencieux** fait ignorer **un tiers des jours de congé**
   dans la capacité mensuelle (227 congés sur 672 tombent un vendredi, et les
   vendredis ne sont jamais comptés). La capacité de l'équipe est donc
   structurellement surestimée, et deux écrans qui calculent la même chose ne
   donnent pas le même résultat. → **§P0-2**
2. **La lecture des données n'est pas restreinte au domaine.** Le filtre
   `@merca.team` existe côté interface et à l'attribution des rôles, mais pas dans
   les politiques de lecture : un JWT hors domaine lit l'ARR client, les
   effectifs et les congés via l'API REST. → **§P0-1**
3. **L'imputation ne tourne pas.** 12 lignes saisies dans l'outil sur 2 487 ;
   aucun des 4 consultants qui portent la charge n'a jamais imputé ; plus aucun
   réalisé depuis le 24 juillet. Tout le Cockpit calcule donc sur un jeu de
   données mort. → **§P0-3**

Le reste (15 axes) est de la dette normale et saine pour ce rythme de construction.

## 1.2 Les 19 axes

| # | Axe | Sévérité | Effort |
|---|---|---|---|
| **P0-1** | Faille de lecture RLS — domaine non filtré | 🔴 Sécurité | ~2 h |
| **P0-2** | Bug capacité — un tiers des congés ignorés | 🔴 Fiabilité | ~1 h |
| **P0-3** | L'imputation ne tourne pas | 🔴 Produit | 2 sem. |
| **P0-4** | Knowledge projet désynchronisé | 🔴 Méthode | 30 min |
| **P1-1** | Migration « gouvernance groupe » inachevée + 31 `site_id!` | 🟠 | 1-2 j |
| **P1-2** | Moteur de charge dupliqué (mois / buckets) | 🟠 | ½ j |
| **P1-3** | Moteur de pricing non typé | 🟠 | 1 j |
| **P1-4** | 16 fichiers de test qui ne s'exécutent jamais | 🟠 | 2 h |
| **P1-5** | Invariants métier écrits mais jamais lancés | 🟠 | 3 h |
| **P1-6** | Composants géants (1 900+ lignes) | 🟠 | continu |
| **P1-7** | Administrateur codé en dur (bus factor) | 🟠 | 2 h |
| **P1-8** | Fichiers résiduels + `.env` versionné | 🟠 | 15 min |
| **P2-1** | Tout le calcul en mémoire navigateur | 🟡 | 2-3 j |
| **P2-2** | Biais fériés : charge étalée ≠ capacité | 🟡 | ½ j |
| **P2-3** | Fériés France codés en dur | 🟡 | ½ j |
| **P2-4** | Traçabilité des modifications absente | 🟡 | ½ j |
| **P2-5** | Serveur MCP sous-exploité | 🟡 | 1 j |
| **P2-6** | i18n à mi-chemin | 🟡 | à trancher |
| **P2-7** | Continuité : dépôt GitHub non connecté | 🟡 | 1 h |

## 1.3 Les 4 actions de cette semaine

1. **Coller le nouveau Knowledge** (§P0-4, fourni intégralement en annexe B) — 30 min,
   et ça améliore tout ce que l'agent produira ensuite.
2. **Corriger `isoDay()`** dans `workload-capacity.ts` (§P0-2) — une fonction de
   deux lignes, plus un test de non-régression. C'est le meilleur rapport
   impact/effort de tout le document.
3. **Passer la migration RLS** (§P0-1, SQL complet en annexe A) — 1 migration.
4. **Lancer le rituel d'imputation** du vendredi (§P0-3) — aucun développement
   requis, la page existe et fonctionne.

---

# 2. Constats chiffrés

Ces chiffres sont la base factuelle des priorités. Ils datent du 05/08/2026.

## 2.1 Volumes

| | |
|---|---|
| Clients | 86 |
| Projets (= deals) | 251, dont 226 vivants |
| Sites (= « projets » au sens métier) | 279, dont 259 vivants |
| Tâches | 1 192, dont 18 de gouvernance groupe |
| Imputations | 2 487 |
| Consultants | 11, dont **5 actifs** (4 dans la capacité + Léa hors capacité) |
| Congés | 672 |
| Offres sauvegardées | **4** |
| Comptes avec un rôle attribué | **3** |
| Migrations SQL | 90 |
| Fichiers de test | 16 |

## 2.2 Sites vivants par statut

| Statut | Sites | J/H vendus | Sans ARR | Sans géoloc | Sans HubSpot |
|---|---|---|---|---|---|
| done (succès) | 168 | 601,6 | 8 | 19 | 18 |
| fail | 21 | 32,9 | 6 | 9 | 8 |
| simulation | 18 | 210,5 | **16** | 14 | 15 |
| ongoing | 18 | 252,5 | 1 | 2 | 6 |
| booked | 10 | 143,3 | 1 | 1 | 2 |
| blocked | 3 | 33,7 | 0 | 1 | 0 |

Qualité sur les **148 tâches des projets actifs** : 10 sans consultant, 2 sans
dates, 12 à forecast 0. **C'est bon.** Le module qualité de données fonctionne.

## 2.3 Imputation — par source

| Source | Lignes | J/H | Dernière date |
|---|---|---|---|
| `clickup:api` (import historique) | 2 450 | 810,6 | **24/07/2026** |
| `import` (ponctuel) | 25 | 21,0 | 31/07/2026 |
| `saisie` (**dans l'outil**) | **11** | **8,8** | 28/07/2026 |
| `agenda` | **1** | 0,1 | 28/07/2026 |

## 2.4 Imputation — par consultant actif

| Consultant | Tâches assignées | J/H forecast portés | **J/H saisis dans l'outil** |
|---|---|---|---|
| Matthieu | 238 | 274,7 | **0** |
| Bastien | 204 | 292,7 | **0** |
| Alexis | 152 | 214,7 | **0** |
| Franklin | 147 | 197,8 | **0** |
| Léa (hors capacité) | 36 | 37,0 | 0,2 |

## 2.5 Congés — par jour de la semaine

| Jour | Lun | Mar | Mer | Jeu | **Ven** |
|---|---|---|---|---|---|
| Congés | 133 | 111 | 96 | 105 | **227** |

Le vendredi concentre **34 % des congés** — profil classique de temps partiels et
de RTT. C'est précisément le jour que le moteur de capacité ignore (§P0-2).

## 2.6 Usage de la version publiée (15 jours)

69 visiteurs uniques · 1 418 pages vues · **20,5 pages par visite** · session
moyenne ~38 min · rebond 12 % · 62/69 depuis la France · **1 seul visiteur mobile**.

Pages les plus vues : `/simulator/new` (43) · `/workload/projets` (40) ·
`/workload/capacite` (27) · `/synthese` (26) · `/espace-consultant` (25) ·
`/workload/forecast-reel` (19) · `/workload/imputation` (17).

*Lecture : usage très intense mais très concentré — signature d'une phase de
construction et de recette, pas encore d'un run d'équipe. Croisé avec les 3 rôles
attribués, on est sur 2 à 3 utilisateurs réels.*

---

# 3. Axes P0 — à traiter en priorité

---

## P0-1 · Faille de lecture RLS

**Sévérité** 🔴 Sécurité — exposition de données commerciales et RH
**Effort** ~2 h (1 migration + tests)

### Constat

Quinze politiques `SELECT` sont en `USING (true)` pour le rôle `authenticated` :
`client`, `projet`, `site`, `tache`, `imputation`, `consultant`,
`consultant_periode`, `conges`, `part_interne_mois`, `payfit_identity_map`,
`pricing_config`, `workload_settings`, `hubspot_company_cache`, `geocode_cache`,
`contact_site`.

Le filtre `@merca.team` existe à deux endroits, et **aucun des deux ne protège la
donnée** :

| Emplacement | Ce qu'il fait | Ce qu'il ne fait pas |
|---|---|---|
| `src/lib/auth.tsx` → `emailAllowed()` | Déconnecte l'utilisateur hors domaine dans l'UI | N'empêche pas un appel direct à l'API REST |
| `ensure_my_role()` | Refuse d'attribuer un rôle hors domaine | N'empêche pas la **lecture**, qui n'exige aucun rôle |

La clé anon Supabase est publique par construction (elle est dans le bundle JS
servi à tout visiteur). Si le provider Google du projet accepte n'importe quel
compte Google, un tiers obtient un JWT `authenticated` valide et lit :

```
GET /rest/v1/site?select=nom,ville,arr,effectif,jh_vendus
GET /rest/v1/client?select=nom,notes
GET /rest/v1/consultant?select=nom,email,heures_hebdo
GET /rest/v1/conges?select=*
```

soit le portefeuille clients, l'**ARR par site**, les effectifs, les volumes
vendus et les congés de l'équipe.

**Deux nuances importantes, à la décharge du projet :**

- **Les écritures sont déjà protégées**, transitivement : elles passent toutes par
  `has_role()` ou `current_consultant_id()`, qu'un compte hors domaine ne peut
  satisfaire (`ensure_my_role` bloque le rôle, et aucune ligne `consultant` ne
  porte son e-mail). **Le trou est en lecture seule.**
- La table `offers` applique déjà le bon pattern :
  `(auth.jwt() ->> 'email') LIKE '%@merca.team'`. Le réflexe existe, il n'a
  simplement pas été généralisé.

### Constat secondaire — les privilèges du rôle `anon`

Héritage des premières migrations : le rôle `anon` détient encore
`SELECT, INSERT, UPDATE, DELETE` sur **22 tables**, dont `client`, `site`,
`projet`, `tache`, `imputation`, `consultant`, `user_roles`, `google_tokens`.

Ce n'est **pas exploitable aujourd'hui** — aucune politique ne cible `anon`, et
RLS refuse par défaut. Mais la marge d'erreur est nulle : une seule politique
créée sans clause `TO` (le défaut PostgreSQL est `PUBLIC`, qui inclut `anon`)
exposerait la table en **non authentifié**. Sur un projet où l'agent IA écrit les
migrations, ce scénario n'est pas théorique.

### Correctif

Migration complète en **annexe A**. En résumé :

```sql
CREATE OR REPLACE FUNCTION public.is_merca_team() RETURNS boolean
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT split_part(coalesce(public.current_user_email(),''),'@',2) = 'merca.team'
$$;
-- les 15 policies SELECT réécrites en USING (public.is_merca_team())
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
```

La même migration corrige quatre anomalies mineures relevées au passage :

| Table | Anomalie |
|---|---|
| `tache_deleted_backup` | La seule policy `SELECT` est `has_role('utilisateur')` → **un admin ne peut pas lire ses propres sauvegardes**. Inversion probable. |
| `imputation_deleted_backup` | `INSERT WITH CHECK (true)` → tout authentifié peut écrire dans la table d'audit. |
| `geocode_cache` | `INSERT`/`UPDATE` ouverts → empoisonnement de cache possible. |
| `user_ical` | Aucune policy `SELECT` : l'utilisateur écrit son URL iCal mais ne peut pas la relire. |

**Complément côté porte d'entrée** — ajouter `hd: "merca.team"` aux `queryParams`
du `signInWithOAuth` dans `auth.tsx`. ⚠️ C'est un **confort d'interface
contournable côté client, pas un contrôle de sécurité** : il réduit les erreurs
d'utilisateur, il ne remplace jamais la RLS. Le vrai verrou d'entrée serait un
Auth Hook Supabase `before-user-created` (plans payants) — utile, mais optionnel
dès lors que la RLS garde la donnée.

### Test — la preuve avant / après

```bash
# 1. Se connecter à l'app publiée avec un compte Google PERSONNEL (hors merca.team).
#    L'UI déconnecte : c'est le comportement actuel, attendu.
# 2. AVANT la déconnexion, récupérer le JWT en console :
#    JSON.parse(localStorage.getItem(
#      Object.keys(localStorage).find(k => k.includes('auth-token')))).access_token
# 3. Interroger l'API directement :
curl -s "https://<PROJECT_REF>.supabase.co/rest/v1/site?select=nom,ville,arr&limit=5" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <JWT_EXTERNE>"
```

- **Avant** : renvoie 5 sites avec leur ARR → faille confirmée.
- **Après** : renvoie `[]` → faille fermée.

Puis **non-régression** : même appel avec un JWT `@merca.team` → doit continuer à
répondre ; et dans l'app, ouvrir les 4 onglets + Admin. Une policy oubliée se voit
immédiatement — l'écran devient vide, pas en erreur.

Enfin, la **requête de contrôle permanente** (annexe C) est à relancer après
chaque migration future et mérite d'être affichée dans l'écran Admin.

---

## P0-2 · Bug de capacité : un tiers des congés est ignoré

**Sévérité** 🔴 Fiabilité — l'indicateur central de l'outil est faux
**Effort** ~1 h (une fonction + un test)

### Constat

`src/lib/workload-capacity.ts` contient deux helpers de formatage de date :

```ts
function isoDay(d: Date): string {          // ← UTC
  return d.toISOString().slice(0, 10);
}
function isoDayLocal(d: Date): string {     // ← heure locale
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
```

`capaciteMois()` utilise `isoDay()` (UTC), `capaciteRange()` utilise
`isoDayLocal()` (local). **Les deux fonctions calculent la même chose et ne
donnent pas le même résultat.**

En fuseau `Europe/Paris` (UTC+1/+2), minuit local correspond à la **veille** en
UTC. Or la boucle de `capaciteMois` saute les week-ends. Conséquence : la chaîne
de caractères correspondant à un **vendredi** ne peut être produite que depuis le
samedi — qui est justement sauté. Elle n'entre donc jamais dans l'ensemble
`eligibles`, et la ligne suivante ne matche jamais un congé de vendredi :

```ts
const congesMois = conges.filter(
  (c) => c.consultant_id === consultantId
      && c.date.slice(0, 7) === k
      && eligibles.has(c.date),   // ← c.date est la vraie date, eligibles est décalé
);
```

### Reproduction (exécutée, `TZ=Europe/Paris`)

```
=== 2026-01 — jours ouvrés où un congé serait IGNORÉ ===
  capaciteMois  (toISOString) : 5 jours → 02/01 (Ven), 09/01 (Ven), 16/01 (Ven),
                                          23/01 (Ven), 30/01 (Ven)
  capaciteRange (heure locale): 0 jour

=== 2026-06 ===
  capaciteMois  : 5 jours → 05/06 (Ven), 12/06 (Ven), 19/06 (Ven), 26/06 (Ven),
                            30/06 (Mar — dernier jour ouvré du mois)
  capaciteRange : 0 jour
```

Deux effets : **tous les vendredis**, plus **le dernier jour ouvré de chaque mois**.

### Impact

- **227 des 672 congés en base tombent un vendredi** (34 %). Ils ne réduisent pas
  la capacité mensuelle. La capacité de l'équipe est donc **structurellement
  surestimée**, et le taux de staffing structurellement sous-estimé — dans le sens
  qui pousse à accepter trop de projets.
- Les vues mensuelles (`capaciteMois`) et les vues par plage ou par semaine
  (`capaciteRange`) **divergent silencieusement**. Si l'équipe a déjà constaté que
  « les chiffres ne sont pas les mêmes selon l'écran », c'est ici.
- Un bug de correctness dans le KPI central est plus coûteux qu'une faille : il ne
  se voit pas, et il érode la confiance dans l'outil sans qu'on sache pourquoi.

**Condition** — le bug ne se manifeste que si l'exécution a lieu dans un fuseau
en avance sur UTC. Les moteurs étant purs et exécutés dans le navigateur, et
62 visiteurs sur 69 étant en France, il est actif en pratique. Il serait absent
d'un rendu serveur en UTC — d'où l'importance du test ci-dessous plutôt que d'une
inspection visuelle.

### Correctif — ne pas se tromper de ligne

`isoDay()` est utilisé à **trois** endroits : `fetesFrance()`, `isFerie()`, et les
`eligibles` de `capaciteMois()`. Dans les deux premiers, le décalage s'applique des
deux côtés de la comparaison et **s'annule** — les fériés sont donc corrects
aujourd'hui. Ne corriger que la ligne des `eligibles` casserait cet équilibre.

**Le bon correctif est de rendre `isoDay()` local** : les trois usages deviennent
alors simultanément corrects et cohérents.

```ts
// Avant — décalé d'un jour dès que le fuseau est en avance sur UTC
function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Après — date civile locale, cohérente avec isoDayLocal() et avec les dates
// stockées en base (type `date` PostgreSQL, sans fuseau).
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
```

Dans la foulée, **fusionner `isoDay` et `isoDayLocal`** en un seul helper exporté,
et supprimer le doublon — c'est la cause racine.

### Le même bug, ailleurs : `go_live_auto`

`src/lib/workload-engine.ts` expose `iso()`, qui utilise également
`toISOString()`. Il sert au calcul de `go_live_auto`. Reproduction :

```
kick_off 2026-01-15 + 1,5 mois → stocké 2026-03-01  (calculé : 02/03/2026)
kick_off 2026-03-02 + 3   mois → stocké 2026-06-01  (calculé : 02/06/2026)
kick_off 2026-07-01 + 2,25 mois → stocké 2026-09-08 (calculé : 09/09/2026)
```

**Toutes les dates de go-live automatiques sont stockées un jour trop tôt.**
Impact faible en soi, mais elles servent de bornes à l'étalement de la charge, et
c'est la même cause racine. Même correctif.

### Test de non-régression à ajouter

À placer dans `src/lib/workload-capacity.test.ts` (le fichier existe déjà) :

```ts
it("compte un congé posé un vendredi", () => {
  // 2026-01-09 est un vendredi
  const conges = [{ id: "c1", consultant_id: "c", date: "2026-01-09", jours: 1 }];
  const sansConge = capaciteMois("c", "2026-01", [], [],      { heures_hebdo: 39 });
  const avecConge = capaciteMois("c", "2026-01", [], conges,  { heures_hebdo: 39 });
  expect(avecConge.joursConges).toBe(1);
  expect(avecConge.joursCapa).toBe(sansConge.joursCapa - 1);
});

it("donne le même résultat que capaciteRange sur un mois entier", () => {
  const conges = [{ id: "c1", consultant_id: "c", date: "2026-01-09", jours: 1 }];
  const mois  = capaciteMois("c", "2026-01", [], conges, { heures_hebdo: 39 });
  const range = capaciteRange("c", new Date(2026, 0, 1), new Date(2026, 0, 31),
                              [], conges, { heures_hebdo: 39 });
  expect(mois.jhFacturables).toBeCloseTo(range.jhFacturables, 4);
});
```

⚠️ Ces tests ne serviront à rien tant que §P1-4 (faire tourner les tests) n'est pas
fait. Les deux vont ensemble.

**Après correction**, relancer un calcul de capacité sur un mois de référence et
comparer : la capacité doit **baisser**. Si elle ne bouge pas, c'est que
l'exécution a lieu en UTC et que le bug était latent — le corriger reste juste.

---

## P0-3 · L'imputation ne tourne pas

**Sévérité** 🔴 Produit — toute la couche de pilotage calcule sur des données mortes
**Effort** 2 semaines, dont ~3 jours de développement

### Constat

Sur 2 487 imputations, **12 ont été produites par l'outil** (11 en saisie, 1 depuis
l'agenda). Tout le reste est l'import ClickUp historique, figé au 24 juillet.
Nous sommes le 5 août : **plus aucun réalisé depuis 12 jours**.

Aucun des quatre consultants qui portent la charge (Matthieu 274,7 J/H de
forecast, Bastien 292,7, Alexis 214,7, Franklin 197,8) n'a jamais imputé.

### Impact

Le Cockpit, le Forecast vs Réel, les deltas vendu/réalisé, la capacité réelle et
les indicateurs de performance calculent tous sur un jeu de données figé. **Chaque
nouvel écran d'analyse ajouté avant de régler ça augmente la surface à maintenir
sans ajouter de valeur.**

C'est aussi ce qui empêche la finalité de l'outil : recalibrer le chiffrage sur le
réalisé observé.

### Ce qui n'est PAS le problème

Il n'y a **aucun blocage technique**. Les 5 consultants actifs ont tous un e-mail
`@merca.team` renseigné, donc `current_consultant_id()` résout et la policy
`imputation_insert_self_or_admin` les autorise. La mécanique est prête. C'est un
sujet d'usage, pas de code.

### Plan en 4 temps

#### Semaine 0 — préalables (½ journée, aucun développement)

1. **Vérifier que chaque consultant peut effectivement se connecter.** Seuls
   3 comptes sur 5 ont une ligne dans `user_roles` — deux personnes ne se sont
   jamais connectées (le rôle est provisionné au premier login) :
   ```sql
   SELECT c.nom, c.email,
          (SELECT count(*) FROM user_roles ur
            WHERE ur.user_id = (SELECT id FROM auth.users u
                                 WHERE lower(u.email) = lower(c.email))) AS role_ok
   FROM consultant c WHERE c.actif;
   ```
   Toute ligne à `role_ok = 0` = quelqu'un qui n'a jamais ouvert l'outil.
2. **Combler le trou du 24/07 à aujourd'hui.** Sinon le premier mois de mesure
   démarre sur un creux artificiel qui décrédibilisera le KPI dès sa naissance.
   Un dernier export ClickUp, ou 20 minutes de saisie rétroactive collective.
3. **Nommer un propriétaire du rituel** — Léa, par construction : elle est déjà
   admin et hors capacité.

#### Semaine 1 — le rituel avant le produit

Le rituel se met en place **sans attendre les développements** : la page existe
et fonctionne.

- **Créneau fixe : vendredi 16 h, 5 minutes.** « J'impute ma semaine. »
- **Rappel automatique**, le plus simple d'abord : un message Slack programmé le
  vendredi à 15 h 45 dans le canal de l'équipe. Zéro développement.
- **Revue publique le lundi** : le taux de complétion de la semaine écoulée est
  affiché en réunion d'équipe. C'est ce qui sépare un outil installé d'un outil
  utilisé.

#### Semaines 1-2 — les trois développements qui font baisser le coût de saisie

Rangés par rapport impact / effort décroissant.

**① Pré-remplissage agenda par défaut** — *le plus rentable*

Toute la mécanique existe : `PrefillAgendaDialog.tsx`, `agenda-parser.ts`,
`AgendaVsImputationsBlock.tsx`, et la règle « réunion avec un contact dont le
domaine mail = client → front ». Elle est aujourd'hui **enfouie dans un dialogue
à ouvrir**, avec une période à sélectionner. Résultat : 1 seule imputation en est
issue.

À faire : sur `/workload/imputation`, afficher **d'office**, en tête de page et
pour la semaine en cours, un bloc « Proposé depuis votre agenda » — les créneaux
détectés avec la tâche devinée, un bouton **« Tout accepter »**, une croix par
ligne pour écarter. La saisie passe de « ouvrir, choisir, mapper » à « relire et
valider ».

**② Le KPI de complétion** — *ce qui n'est pas mesuré n'est pas fait*

Définition : `J/H imputés du mois ÷ J/H facturables du mois`. La capacité est déjà
calculée par `capaciteMois()` / `capaciteRange()`, nette de congés et de part
interne — **après correction du §P0-2**, sans quoi le dénominateur est faux.

Cible **85 %**, cohérente avec l'objectif de staffing par défaut ; réutiliser les
bandes de couleur de `STAFFING_BANDS`. Trois emplacements :

- **Espace consultant** — une jauge « ma semaine » / « mon mois », visible dès l'arrivée ;
- **Cockpit → Synthèse** — une ligne par consultant, tout en haut, avant le reste ;
- **Admin** — l'historique mensuel, pour voir si la pratique tient dans le temps.

**③ Saisie mobile** — *1 visiteur mobile sur 69*

C'est pourtant le seul écran qu'un consultant remplirait depuis un site client, le
soir, en 90 secondes. Objectif : une colonne, une ligne par tâche du jour, des
boutons `+0,5 j` / `+1 j` plutôt qu'un champ numérique, et rien d'autre à l'écran.
Pas une refonte : une variante responsive de `SaisiePage`.

#### Semaines 3-4 — fiabiliser ce qui entre

- **Verrouillage mensuel** : table `imputation_lock(mois, verrouille_le,
  verrouille_par)` + clause dans les policies `INSERT`/`UPDATE`/`DELETE` de
  `imputation` refusant toute écriture sur un mois verrouillé (sauf admin). Sans
  ça, le réalisé reste réécrivable indéfiniment et ne peut pas servir de base à un
  recalibrage.
- **11ᵉ contrôle qualité** dans `data-quality.ts` : « consultants sous 85 % de
  complétion sur le mois écoulé », avec action « relancer ».
- **Boucler sur le chiffrage** — la finalité de tout l'édifice. Après 3 mois de
  réalisé fiable, comparer `tache.heures` (vendu) à `imputation.heures` (réalisé)
  par type de projet, et **réinjecter l'écart dans les matrices de répartition**
  (60/0/40/0 · 10/50/10/30 · 30/40/15/15) et dans la formule de durée théorique.
  C'est là que l'outil commence à rapporter au lieu de coûter.

### Comment savoir que c'est gagné

| Indicateur | Aujourd'hui | Cible à 4 semaines |
|---|---|---|
| Imputations `saisie`/`agenda` par mois | ~12 au total | **≥ 150 / mois** |
| Consultants ayant imputé la semaine écoulée | 0 / 4 | **4 / 4** |
| Taux de complétion moyen | non mesurable | **≥ 85 %** |
| Écart à la dernière imputation | 12 jours | **≤ 7 jours** |

```sql
-- Suivi hebdomadaire
SELECT date_trunc('week', i.date)::date AS semaine,
       count(DISTINCT i.consultant_id)  AS consultants_actifs,
       round(sum(i.heures)/8.0, 1)      AS jh_saisis
FROM imputation i
WHERE i.source IN ('saisie','agenda')
  AND i.date >= current_date - interval '8 weeks'
GROUP BY 1 ORDER BY 1 DESC;
```

---

## P0-4 · Knowledge projet désynchronisé

**Sévérité** 🔴 Méthode — dégrade chaque interaction future avec l'agent
**Effort** 30 min

### Constat

Le Knowledge est le prompt système permanent de l'agent Lovable : il est rechargé
à **chaque** prompt. Celui du projet est par ailleurs de très bonne facture —
modèle de données, règles de calcul, charte, rôles.

Mais il décrit une application à **2 onglets** (`Deployment Offer` /
`Workload Management` avec 4 sous-onglets Projets · Capacité · Imputation ·
Forecast vs Réel). L'application réelle a **4 onglets de premier niveau**
(Chiffrage · Clients & projets · Cockpit · Espace consultant) plus un Admin
derrière l'engrenage, et le Cockpit a sa propre hiérarchie de 4 sous-onglets.

Il ignore également tout ce qui a été appris depuis : le vocabulaire `projet` ≠
« projet métier », les champs ajoutés à `site` (`churn`, `est_brouillon`,
`fail_reason`, `arr`, `bu`, `hubspot_*`, `statut`), les règles de sécurité, les
chantiers en cours.

### Impact

À chaque prompt, l'agent cherche des écrans qui n'existent plus, propose des
emplacements incohérents, doit relire le code pour se réorienter — donc consomme
des crédits et introduit des régressions. **C'est le meilleur rapport impact/effort
de tout ce document.**

### Correctif

Knowledge de remplacement complet en **annexe B**. Il ajoute, par rapport à l'actuel :

- la navigation réelle et les 3 rôles ;
- **le piège de vocabulaire en tête de document** : `projet` = le deal, `site` =
  « un projet » au sens métier, et l'interdiction d'écrire `t.site_id!` ;
- le schéma à jour ;
- des **règles de sécurité non négociables** — toute policy `SELECT` doit inclure
  `is_merca_team()`, toute policy doit porter une clause `TO` explicite, jamais de
  `GRANT` à `anon`. C'est ce qui empêchera la faille §P0-1 de revenir ;
- des règles d'hygiène : aucun nouveau fichier au-delà de 400 lignes ; invariants
  `assert_*` à lancer après toute migration touchant `tache`/`site`/`projet`/
  `client`/`imputation` ; helpers de date locaux uniquement (§P0-2) ;
- l'état des chantiers en cours et des champs legacy ;
- **un garde-fou de priorisation** : « ne pas ajouter de nouvel écran d'analyse
  tant que la complétion d'imputation n'atteint pas 85 % ». Utiliser le Knowledge
  comme contrainte de priorité, pas seulement comme documentation.

---

# 4. Axes P1 — dette structurelle

---

## P1-1 · Migration « gouvernance groupe » inachevée

**Effort** 1 à 2 jours

### Constat

Le plan de l'agent (`.lovable/plan.md`) est excellent et bien découpé en 5 étapes.
Seules les étapes 1 et 2 sont faites (données + affichage sur la fiche client).
Restent : l'imputation des tâches de gouvernance, l'audit des `.site_id!`, et le
garde-fou de réconciliation.

Le point sensible est l'audit : depuis l'introduction des tâches de niveau client
(`site_id IS NULL`), **31 assertions non-nulles `t.site_id!` réparties dans
12 fichiers sont devenues fausses**. Une assertion fausse ne plante pas
forcément — elle produit un `undefined` qui traverse silencieusement les agrégats.

| Fichier | Occurrences |
|---|---|
| `src/features/synthese/SynthesePage.tsx` | 6 |
| `src/lib/data-quality.ts` | 7 |
| `src/features/workload/ForecastReelPage.tsx` | 3 |
| `src/features/workload/ImputationPage.tsx` | 3 |
| `src/features/workload/MonEspacePage.tsx` | 2 |
| `src/features/workload/ProjetsBoard.tsx` | 2 |
| `src/features/workload/PrefillAgendaDialog.tsx` | 2 |
| `src/lib/workload-capacity.ts` | 2 — **critique** (moteur d'étalement) |
| `ProjectBoardViews`, `ProjectSummaryDialog`, `CapacitePage`, `AssignerPage` | 1 chacun |

### Correctif

Suivre le plan tel qu'il est écrit — il est bon. En particulier son parti pris :
introduire un helper commun (`siteIdOrNull(t)` / `tachesBySiteId(taches)`) et
remplacer les usages, **plutôt qu'ajouter 31 fois un `.filter(...)`**.

Trancher aussi les champs legacy, sans quoi deux chemins de calcul coexistants
finiront par diverger :
- `projet.gouvernance_jh` — remplacé par les tâches client-level, encore peuplé sur
  2 clients (Saphir, SEW) ;
- `client.gouvernance_jh` — à 0 partout, jamais utilisé. La question ouverte du
  plan (calculer depuis les tâches, option A, vs champ éditable, option B) doit
  être arbitrée explicitement.

Terminer par l'étape 5 du plan : la RPC `assert_clickup_reconciliation` — voir §P1-5.

---

## P1-2 · Moteur de charge dupliqué

**Effort** ½ journée

### Constat

`calcCharge()` (par mois) et `calcChargeBuckets()` (par mois **ou** semaine)
dupliquent environ 150 lignes de logique quasi identique : parcours des tâches,
cas de la visite, repli sur les bornes du projet, gouvernance projet répartie
LPM/IC, gouvernance groupe par client. Seul le mécanisme d'étalement diffère
(`spreadOverMonths` vs `spreadOverBuckets`).

### Impact

Toute règle modifiée d'un seul côté fait **diverger silencieusement** deux écrans
qui prétendent afficher la même métrique. C'est exactement le mécanisme du bug
§P0-2, à une autre échelle.

À noter : les deux implémentations d'étalement ne sont d'ailleurs pas
mathématiquement équivalentes. `spreadOverMonths` répartit au prorata du nombre de
jours ouvrés par mois ; `spreadOverBuckets` répartit un montant égal par jour
ouvré. Sur des buckets alignés sur les mois les résultats coïncident, mais rien ne
le garantit ailleurs.

### Correctif

Extraire un collecteur unique, puis deux étaleurs minces :

```ts
type ChargeItem = {
  consultantId: string;      // ou UNASSIGNED_ID
  bucketKeyProjet: string;   // projet.id ou clientBucketKey(clientId)
  heures: number;
  start: Date;
  end: Date;
  ponctuel: boolean;         // visite : tout sur son bucket de début
};

function collectChargeItems(projets, sitesByProjet, taches, actifStatuts,
                            gouvernance?, opts?): ChargeItem[]
```

`calcCharge` et `calcChargeBuckets` ne conservent alors que leur logique
d'étalement respective. Bonus : `collectChargeItems` devient testable seul, et
c'est là que la branche client-level du §P1-1 doit atterrir — une seule fois au
lieu de deux.

---

## P1-3 · Moteur de pricing non typé

**Effort** 1 jour

### Constat

`src/lib/pricing-engine.js`, `src/lib/prefill-parsers.js` et `src/lib/ui-content.js`
sont du JavaScript non typé, rendu **totalement invisible** à TypeScript par un
fichier de déclaration vide :

```ts
// src/lib/pricing-engine.d.ts
declare module "@/lib/pricing-engine";
```

Tout ce qui entre et sort du moteur est donc `any`.

### Impact

Le **cœur commercial** de l'outil — celui qui produit les J/H vendus et le budget
d'une offre — est la seule partie sans filet de type. C'est aussi celle que le
Knowledge interdit explicitement de casser : la consigne remplace la vérification.
Une faute de frappe sur une clé d'entrée ne se voit qu'au chiffre final.

### Correctif

La structure d'entrée est déjà connue et stable : les offres sauvegardées portent
un `snapshot` JSON de 22 clés.

```
clientName · currency · lang · pkg · sites · modules · usecases · modes ·
consultants · intercos · tjm · discountPct · customFinalPrice ·
overrideDurationMonths · pocMonths · pilotEmployees · cxProjet ·
matDigitale · matProcess · svcIndicateurs · svcMatrixSupport · svcVisitDays
```

Démarche, dans cet ordre :

1. **Amorcer** — `tsc --allowJs --declaration --emitDeclarationOnly` sur
   `pricing-engine.js` produit un premier `.d.ts` réel, à durcir ensuite à la main.
   Remplacer le `declare module` vide.
2. **Verrouiller la frontière avec Zod** — `zod` est déjà en dépendance. Un schéma
   `OfferInputSchema` validant les 22 clés, appliqué à l'entrée du moteur **et** à
   la relecture de `offers.snapshot` : c'est le point où une offre ancienne au
   format périmé se manifestera proprement, plutôt qu'en `NaN` silencieux.
3. **S'appuyer sur le filet existant** — `pricing-engine.test.ts` existe déjà.
   C'est lui qui garantit que le typage n'a rien changé au comportement. Encore
   faut-il qu'il s'exécute : voir §P1-4.

Ne pas réécrire le moteur. L'objectif est de le rendre vérifiable, pas de le refaire.

---

## P1-4 · Les tests ne s'exécutent jamais

**Effort** 2 h

### Constat

**16 fichiers de test Vitest** existent (`calc-engine`, `pricing-engine`,
`workload-engine`, `workload-capacity`, `pilotage-kpis`, `offers`, `nps`,
`text-search`, `supabase-paginate`, `real-capacity-details`, `scope-resolution`,
`task-code-preview`, `client-view`, `forecast-witness`, `imputed-par-tache`,
`prefill-pkg`), et `vitest.config.ts` est en place.

Mais **`package.json` ne contient aucun script `test`**, et il n'y a pas de CI.
Ces tests ne s'exécutent donc jamais.

### Impact

L'effort de test est intégralement payé et intégralement perdu. C'est aussi ce qui
a laissé passer le bug du §P0-2 : `workload-capacity.test.ts` existe, il ne couvrait
simplement pas le cas du vendredi — et personne ne l'aurait su, puisqu'il ne tourne
pas.

### Correctif

```json
"scripts": {
  "dev": "vite dev",
  "build": "vite build",
  "lint": "eslint .",
  "test": "vitest run",
  "test:watch": "vitest",
  "typecheck": "tsc --noEmit"
}
```

Puis un workflow GitHub Actions sur la branche connectée (`.github/workflows/ci.yml`) :
`bun install` → `bun run lint` → `bun run typecheck` → `bun run test`.

⚠️ Prérequis : **connecter le dépôt GitHub** (§P2-7). Les deux se font ensemble.

---

## P1-5 · Invariants métier écrits mais jamais lancés

**Effort** 3 h

### Constat

Trois fonctions de contrôle existent en base et sont une excellente idée :

| Fonction | Ce qu'elle vérifie |
|---|---|
| `assert_imputation_reconciliation(tolerance)` | Le réalisé de l'app ne dérive pas de ClickUp, mois par mois |
| `assert_vendu_invariant(expected, tolerance)` | Le total J/H vendus (sites + gouvernance) reste cohérent |
| `assert_workload_invariants(jh, lignes, tolerance)` | Volumétrie et J/H globaux |

Elles doivent être appelées manuellement. **Un invariant qu'on doit penser à lancer
n'est pas un invariant.**

### Correctif

1. **Planifier** — `pg_cron` nocturne, ou un job GitHub Actions quotidien qui les
   appelle et échoue si l'écart dépasse la tolérance.
2. **Rendre visible** — un bloc « Intégrité » dans l'écran Admin : date du dernier
   contrôle, verdict, écart par mois. À côté, la requête de contrôle RLS de
   l'annexe C : deux vérifications qui ne coûtent rien une fois affichées.
3. **Compléter** — ajouter `assert_clickup_reconciliation` (étape 5 du plan
   `.lovable/plan.md`) et l'inscrire dans le Knowledge comme obligatoire après
   toute migration touchant `tache`, `site`, `projet`, `client`, `imputation`.

---

## P1-6 · Composants géants

**Effort** continu

### Constat

D'après les références de ligne de l'audit de l'agent lui-même :
`CapacitePage.tsx` dépasse **1 900 lignes**, `MonEspacePage.tsx` ~1 200,
`ImputationPage.tsx` et `SynthesePage.tsx` ~1 000.

### Impact

Double coût. Illisible pour un humain — et surtout **coûteux en crédits Lovable** :
l'agent relit le fichier entier à chaque édition, et le risque de régression croît
avec la taille du contexte qu'il doit tenir. Les fichiers les plus gros sont
justement ceux où les bugs de cohérence apparaissent.

### Correctif

Règle simple, à inscrire dans le Knowledge (c'est fait dans la version fournie) :
**aucun nouveau fichier au-delà de 400 lignes**, extraction dans
`src/features/workload/shared/` — un dossier qui existe déjà et fonctionne bien
(27 composants partagés).

Pas de chantier dédié : la règle « on réduit à chaque passage, on n'agrandit
jamais » suffit si elle est dans le Knowledge.

---

## P1-7 · Administrateur codé en dur

**Effort** 2 h

### Constat

`lea@merca.team` est écrit en dur à **trois** endroits :

| Emplacement | Forme |
|---|---|
| `src/lib/auth.tsx` | `export const ADMIN_EMAILS = ["lea@merca.team"]` |
| `ensure_my_role()` | `CASE WHEN em = 'lea@merca.team' THEN 'admin' ...` |
| Policies `offers` | `... OR (auth.jwt() ->> 'email') = 'lea@merca.team'` |

### Impact

Changer d'administrateur exige aujourd'hui **une migration SQL et un déploiement
front**. Bus factor de 1 sur un outil qui porte 86 clients et ~1 274 J/H vendus.
En cas d'indisponibilité, plus personne ne peut attribuer un rôle.

### Correctif

1. Faire de `user_roles` la seule source de vérité : retirer `ADMIN_EMAILS` du
   front (le rôle est déjà chargé par `loadRole()`), et remplacer la condition en
   dur des policies `offers` par `has_role(auth.uid(), 'admin')`.
2. Conserver un unique amorçage dans `ensure_my_role()` — mais le lire depuis
   `workload_settings` (clé `bootstrap_admin_email`) plutôt que d'une constante,
   pour qu'il soit modifiable sans migration.
3. **Nommer un second administrateur** dès maintenant. C'est la seule action de ce
   document qui prend 30 secondes.

---

## P1-8 · Fichiers résiduels et `.env` versionné

**Effort** 15 min

### Constat

À la racine du dépôt : `fix_final.py`, `fix_team.py`, `fix_team_v2.py`,
`fix_team_v3.py`, `replace.py`, et un fichier littéralement nommé `map.get(` —
résidus de scripts one-shot d'une migration passée.

Par ailleurs, `.env` est versionné et **n'apparaît pas dans `.gitignore`**.

### Impact

Le désordre a un coût direct sur ce projet : **l'agent lit ces fichiers** à chaque
exploration, et les quatre variantes `fix_team*` sont autant de fausses pistes.
Pour `.env` : le fichier ne contient en principe que des variables publiques
`VITE_*` (convention Lovable), mais rien n'empêche le prochain connecteur d'y
déposer un secret, qui partirait alors dans l'historique Git.

### Correctif

Supprimer les six fichiers. Ajouter `.env` au `.gitignore` et créer un
`.env.example` listant les variables attendues sans leurs valeurs. Prompt fourni
en annexe D.

Dans le même mouvement : les 6 tables de staging (`stg_cu_entry`, `stg_cu_task`,
`stg_cons`, `stg_match`, `stg_plan`, `stg_resolved`, `stg_hs_deal`) peuvent être
archivées une fois la réconciliation ClickUp validée (§P1-5).

---

# 5. Axes P2 — améliorations de fond

---

## P2-1 · Tout le calcul se fait en mémoire navigateur

**Effort** 2-3 jours

### Constat

`loadFullWorkload()` charge l'intégralité du périmètre — projets, sites, tâches, et
selon les écrans les imputations — via `selectAll()` qui pagine jusqu'au bout, puis
tout est calculé en JavaScript pur. Soit environ **4 200 lignes par chargement**
(226 projets + 259 sites + 1 192 tâches + 2 487 imputations), et ce calcul est
refait indépendamment par chaque écran.

### Impact

- À l'échelle actuelle, ça passe. Ça ne tiendra pas un ordre de grandeur au-dessus.
- Plus important : **six écrans recalculent chacun leurs agrégats** à partir des
  mêmes primitives (Synthèse, Analyse Clients, Analyse Charge, Analyse Performance,
  Espace consultant, Board projets). C'est la recette classique du « ce chiffre
  n'est pas le même sur les deux pages » — et §P0-2 montre que ce n'est pas
  hypothétique.

### Correctif, en deux temps

**Étape peu coûteuse d'abord** : un hook `useWorkloadSnapshot()` partagé, appuyé
sur React Query (**déjà en dépendance, actuellement peu exploité**) — une requête,
un calcul mémoïsé, consommé par tous les onglets. Gain immédiat sur le temps de
chargement et sur la cohérence, sans toucher au backend.

**Puis, à terme** : pousser les agrégats côté PostgreSQL. Les briques existent
déjà — `imputation_agg(from, to)` et `imputation_totaux_par_site()` sont
exactement le bon pattern. Les généraliser à la charge forecast et à la capacité,
avec une vue matérialisée mensuelle rafraîchie à l'écriture. Objectif : **une
source unique par métrique**, côté serveur.

---

## P2-2 · Biais fériés : la charge est étalée sur des jours sans capacité

**Effort** ½ journée

### Constat

L'étalement de la charge se fait au prorata des jours ouvrés **fériés inclus** —
choix explicite et documenté dans le code (« règle validée : l'étalement est une
approximation théorique, on n'affine pas au jour férié près »). La capacité, elle,
**exclut** les fériés.

### Impact

Sur mai (3 fériés en semaine certaines années) et août, la charge est répartie sur
des jours où la capacité est nulle. Le taux de staffing est donc **structurellement
optimiste** sur ces mois — dans le même sens que le bug du §P0-2, et les deux
s'additionnent.

### Correctif

Ce n'est pas nécessairement à corriger : c'est un arbitrage défendable. Mais il
doit **sortir du commentaire de code et entrer dans l'interface** — une infobulle
« étalement théorique, fériés inclus » sur les courbes de charge. Un biais assumé
et affiché ne coûte rien ; un biais invisible érode la confiance.

Si l'on décide de corriger : `spreadOverMonths` et `spreadOverBuckets` doivent
utiliser `joursTravaillables` plutôt que `isJourOuvre`. À faire dans le même
mouvement que §P1-2, une seule fois.

---

## P2-3 · Fériés France codés en dur

**Effort** ½ journée

### Constat

`fetesFrance(year)` ne connaît que le calendrier français (8 fériés fixes +
Pâques/Ascension/Pentecôte). Or la table `site` porte déjà une colonne `pays`, et
l'existence de traductions partenaires (Sekurit Germany) indique des déploiements
hors France.

### Impact

Le jour où un consultant travaille sur un site allemand ou italien, sa capacité est
fausse — silencieusement.

### Correctif

Généraliser en `feries(pays, year)` avec au minimum FR, DE, ES, IT ; rattacher le
calendrier au **consultant** (son pays de rattachement) et non au site, puisque
c'est sa capacité qui est calculée. À faire avant le premier déploiement
international, pas après.

---

## P2-4 · Traçabilité des modifications

**Effort** ½ journée

### Constat

Seule la table `projet` porte un `created_by`. Ni `site`, ni `tache`, ni
`imputation` ne portent de `updated_by`. Les tables `*_deleted_backup` tracent les
suppressions, mais pas les modifications.

### Impact

Sur un outil où plusieurs personnes éditent le forecast d'un même projet, avec de
l'édition inline sur les cartes et du drag & drop de statut, « qui a changé ce
chiffre et quand » deviendra une question fréquente — et sans réponse.

### Correctif

Ajouter `updated_by uuid DEFAULT auth.uid()` sur `site`, `tache` et `imputation`,
alimenté par le trigger `updated_at` existant. Pour les champs les plus sensibles
(`jh_vendus`, `statut`, `heures`), une table `audit_log` légère (table, ligne,
champ, avant, après, auteur, date) est un investissement modeste au regard du temps
qu'elle fait gagner en réconciliation.

---

## P2-5 · Le serveur MCP est sous-exploité

**Effort** 1 jour

### Constat

L'application expose son propre serveur MCP (`/.mcp/list-tools`,
`/.mcp/invoke-tool/$tool`, `/.well-known/oauth-protected-resource`), authentifié en
OAuth sur l'issuer Supabase et doublé d'une garde de domaine
(`denyIfNotMercaTeam`). Deux outils sont publiés : `simulate_new_offer` et
`simulate_upsell`.

Concrètement : **n'importe quel compte @merca.team peut chiffrer une offre depuis
Claude ou ChatGPT, sans ouvrir l'application.** C'est un actif rare, et il est
correctement sécurisé.

### Opportunité

Aujourd'hui seul le chiffrage est exposé. Ajouter des outils **de lecture** —
`get_capacity(mois)`, `list_projects(statut)`, `forecast_vs_actual(client)`,
`my_imputation_status()` — permettrait de poser les questions en langage naturel :
*« quelle est ma dispo en octobre ? »*, *« quels projets dérivent de plus de
20 % ? »*, *« ai-je imputé cette semaine ? »*.

C'est probablement **le chemin le plus court vers l'adoption réelle** par des
consultants qui n'ouvriront pas un cockpit tous les jours — et donc un allié direct
du §P0-3.

⚠️ Ces outils lisant des données, ils doivent s'appuyer sur le JWT de l'appelant
et non sur `service_role`, pour que la RLS du §P0-1 s'applique.

---

## P2-6 · i18n à mi-chemin

**Effort** à trancher

### Constat

Le bilinguisme FR/EN est partiel : chaque composant appelle
`t("clé", "fallback en dur")`, mais les libellés métier — statuts, bandes de
staffing (« Sous-staffé », « Bien staffé »), labels des contrôles qualité — sont en
français en dur **dans les moteurs**. Le Knowledge dit par ailleurs « UI en
français ».

### Impact

L'état intermédiaire coûte à chaque écran ajouté (deux libellés à écrire) sans
livrer un anglais réellement utilisable.

### Correctif

Une décision, pas un développement. Soit l'anglais est un besoin réel (partenaires,
clients internationaux) et il faut centraliser les libellés métier hors des
moteurs ; soit il ne l'est pas et la couche i18n doit être retirée. Les deux options
sont meilleures que la situation actuelle.

---

## P2-7 · Continuité : le dépôt GitHub n'est pas connecté

**Effort** 1 h

### Constat

Le projet vit à 100 % dans Lovable. La sortie de secours existe — le code est
standard (TanStack Start + Supabase), seules deux dépendances sont propriétaires
(`@lovable.dev/mcp-js`, `@lovable.dev/cloud-auth-js`) — mais elle n'est pas
préparée.

### Impact

Aucune sauvegarde hors plateforme, aucune revue de code possible, et **la CI du
§P1-4 est impossible** sans dépôt.

### Correctif

1. **Connecter le dépôt GitHub.** Gratuit, réversible, bidirectionnel : les commits
   poussés remontent dans l'éditeur Lovable.
   ⚠️ Ne jamais réécrire l'historique publié (force-push, rebase, amend) — cela
   casse l'historique côté Lovable. C'est écrit dans le `AGENTS.md` du projet.
2. **Ajouter la CI** (§P1-4) dans la foulée.
3. **Écrire un court README d'exploitation** : où sont les secrets, comment relancer
   un import ClickUp/Payfit/HubSpot, qui est admin, que faire si un invariant
   échoue. Une page suffit — c'est ce qui manque le jour où quelqu'un d'autre doit
   reprendre l'outil.

---

# 6. Ce qui est réussi

Un audit qui ne liste que des correctifs donne une image fausse. Ce projet a
plusieurs qualités qu'il faut nommer, parce qu'elles sont rares et qu'il faut les
préserver dans tout ce qui précède.

**La modélisation métier.** Les règles de déploiement Mercateam — répartitions
LPM/IC selon le nombre de consultants, durée théorique en fonction de l'effectif,
visite forfaitaire, capacité facturable nette de congés et de part interne,
gouvernance de groupe distincte des projets — sont formalisées avec une précision
qu'on trouve rarement dans un outil interne. **C'est ça, l'actif. Pas le code.**

**La séparation moteurs purs / interface.** `workload-engine.ts` et
`workload-capacity.ts` ne touchent jamais Supabase : ils prennent des tableaux et
rendent des tableaux. C'est ce qui rend les 16 fichiers de test possibles, c'est ce
qui a permis de reproduire le bug du §P0-2 en dix lignes hors de l'application, et
c'est ce qui protégera la logique métier de la prochaine refonte d'interface.

**La sécurité en profondeur.** RLS réelle et pas seulement des gardes d'interface ;
fonctions `SECURITY DEFINER` avec `search_path` verrouillé ; tokens Google chiffrés
en base avec policies « own row » ; scopes OAuth minimaux au login et accès agenda
demandé séparément. La faille du §P0-1 est un oubli de généralisation, pas une
absence de culture sécurité — le bon pattern est déjà écrit sur `offers`.

**Le traitement du legacy.** Import ClickUp complet, réconciliation outillée par des
invariants SQL, tables de backup sur suppression, statuts `est_brouillon` /
`deleted_at` / `archived_at` / `cloture` / `churn`. Quelqu'un a pensé la reprise de
données — c'est généralement ce qui tue ce type de projet, et c'est ici traité.

**Les garde-fous d'édition.** `recalibrerTaches()` rééquilibre les tâches sur le
total J/H du site **sauf** celles marquées « éditée à la main » et sauf la visite ;
la répartition `personnalisee` est explicitement hors règle et jamais régénérée.
C'est exactement le bon compromis entre automatisme et contrôle humain.

**La qualité de données.** Dix contrôles, avec actions correctives en un clic et un
périmètre explicitement documenté (y compris la subtilité du périmètre « carte »
uni au périmètre « actifs » pour que deux compteurs concordent). Les chiffres du
§2.2 montrent que ça marche.

**Une remarque sur la méthode.** Ce projet est un bon cas d'école de ce que Lovable
permet quand on lui donne un Knowledge métier dense et qu'on le laisse écrire ses
plans : deux semaines pour un outil qui remplace ClickUp, un tableur de chiffrage et
quatre intégrations. La contrepartie est visible dans le dépôt : composants qui
enflent, scripts jetables laissés à la racine, migrations commencées et jamais
finies, tests écrits mais jamais lancés. Ce sont exactement les tâches que l'agent ne
fait pas spontanément — parce qu'on ne les lui demande jamais. **Le vrai levier de
qualité sur Lovable, c'est de prompter aussi le ménage, pas seulement les
fonctionnalités.**

---

# 7. Feuille de route proposée

## Semaine 1 — fiabiliser (les 4 P0 techniques)

| Jour | Action | Vérifiable par |
|---|---|---|
| J | §P0-4 · Coller le nouveau Knowledge (annexe B) | Knowledge à jour |
| J | §P1-8 · Ménage du dépôt + `.gitignore` (annexe D) | Racine propre |
| J | §P1-7 · Nommer un second administrateur | 2 lignes `admin` dans `user_roles` |
| J+1 | §P0-2 · Corriger `isoDay()` + les 2 tests | La capacité de référence **baisse** |
| J+1 | §P0-1 · Migration RLS (annexe A) + les 3 tests | `curl` JWT externe → `[]` |
| J+2 | §P2-7 · Connecter GitHub, puis §P1-4 · script `test` + CI | CI verte sur un commit |

## Semaine 1-2 — lancer l'usage (§P0-3)

| Jour | Action | Vérifiable par |
|---|---|---|
| J+2 | Vérifier les 5 accès consultants ; combler le trou du 24/07 | 5/5 rôles provisionnés |
| J+3 | Rituel vendredi 16 h + rappel Slack automatique | 1ʳᵉ semaine imputée |
| S+1 | Pré-remplissage agenda par défaut + KPI de complétion | KPI visible sur 3 écrans |
| S+2 | Saisie mobile | Page utilisable au téléphone |

## Semaines 3-4 — consolider

§P1-1 (gouvernance groupe + les 31 `site_id!`) · §P1-2 (dédupliquer le moteur de
charge) · §P1-5 (invariants planifiés et affichés) · verrouillage mensuel de
l'imputation.

**Bilan à S+4** : ≥ 150 imputations/mois, complétion ≥ 85 %, CI verte, invariants
au vert, faille fermée.

## Au-delà

§P1-3 (typer le pricing) · §P2-1 (snapshot partagé puis agrégats serveur) ·
§P2-5 (outils MCP de lecture) · §P2-4 (traçabilité) · §P2-3 (fériés par pays) ·
§P2-6 (décision i18n).

## Une règle de priorisation, plus utile que la liste

**Ne pas ajouter de nouvel écran d'analyse tant que la complétion d'imputation
n'atteint pas 85 % sur 4 semaines consécutives.** Tout indicateur ajouté d'ici là
calcule sur un réalisé mort, et augmente la surface à maintenir sans créer de
valeur. Cette règle figure dans le Knowledge fourni en annexe B — c'est le meilleur
endroit pour qu'elle tienne.

---

# Annexe A — Migration RLS complète

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
DROP POLICY IF EXISTS "client_read_authenticated"  ON public.client;
CREATE POLICY "client_read_merca"       ON public.client        FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "read projet auth"           ON public.projet;
CREATE POLICY "projet_read_merca"       ON public.projet        FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "read site auth"             ON public.site;
CREATE POLICY "site_read_merca"         ON public.site          FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "read tache auth"            ON public.tache;
CREATE POLICY "tache_read_merca"        ON public.tache         FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "imputation_read_auth"       ON public.imputation;
CREATE POLICY "imputation_read_merca"   ON public.imputation    FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "consultant_read_auth"       ON public.consultant;
CREATE POLICY "consultant_read_merca"   ON public.consultant    FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "cp_read_auth"               ON public.consultant_periode;
CREATE POLICY "cp_read_merca"           ON public.consultant_periode FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "conges_read_auth"           ON public.conges;
CREATE POLICY "conges_read_merca"       ON public.conges        FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "read_part_interne_all_auth" ON public.part_interne_mois;
CREATE POLICY "pim_read_merca"          ON public.part_interne_mois FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "pfm_read_auth"              ON public.payfit_identity_map;
CREATE POLICY "pfm_read_merca"          ON public.payfit_identity_map FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "pc_read_auth"               ON public.pricing_config;
CREATE POLICY "pc_read_merca"           ON public.pricing_config FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "read_ws_all_auth"           ON public.workload_settings;
CREATE POLICY "ws_read_merca"           ON public.workload_settings FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "hubspot_cache_read_auth"    ON public.hubspot_company_cache;
CREATE POLICY "hs_cache_read_merca"     ON public.hubspot_company_cache FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "geocode_cache_read_auth"    ON public.geocode_cache;
CREATE POLICY "geocode_read_merca"      ON public.geocode_cache FOR SELECT TO authenticated USING (public.is_merca_team());

DROP POLICY IF EXISTS "contact_site read auth"     ON public.contact_site;
CREATE POLICY "contact_site_read_merca" ON public.contact_site  FOR SELECT TO authenticated USING (public.is_merca_team());

-- 3) Anomalies corrigées au passage.

-- 3a) L'admin ne pouvait pas lire la table de sauvegarde des tâches.
DROP POLICY IF EXISTS "manager reads backup" ON public.tache_deleted_backup;
CREATE POLICY "tache_backup_read_admin" ON public.tache_deleted_backup
  FOR SELECT TO authenticated
  USING (public.is_merca_team() AND public.has_role(auth.uid(), 'admin'));

-- 3b) Table d'audit : plus d'écriture libre par tout authentifié.
DROP POLICY IF EXISTS "system writes backups" ON public.imputation_deleted_backup;

-- 3c) Cache de géocodage : écritures réservées au domaine.
DROP POLICY IF EXISTS "geocode_cache_insert_auth" ON public.geocode_cache;
DROP POLICY IF EXISTS "geocode_cache_update_auth" ON public.geocode_cache;
CREATE POLICY "geocode_insert_merca" ON public.geocode_cache
  FOR INSERT TO authenticated WITH CHECK (public.is_merca_team());
CREATE POLICY "geocode_update_merca" ON public.geocode_cache
  FOR UPDATE TO authenticated USING (public.is_merca_team()) WITH CHECK (public.is_merca_team());

-- 3d) L'utilisateur ne pouvait pas relire son propre flux iCal.
CREATE POLICY "user_ical_read_own" ON public.user_ical
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 4) Privilèges du rôle anon (défense en profondeur).
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
```

> ⚠️ **L'étape 4 est la seule qui peut casser quelque chose.** À vérifier juste
> après : l'écran de connexion, le flux OAuth Lovable
> (`/.lovable/oauth/consent`), et `/.mcp/list-tools`. Aucun des trois ne lit de
> table applicative, donc le risque est faible — mais il se teste en 2 minutes.
> Second point : l'outillage Lovable peut re-granter `anon` lors d'une future
> migration générée par l'agent. D'où la règle inscrite dans le Knowledge et la
> requête de contrôle de l'annexe C.

---

# Annexe B — Knowledge projet de remplacement

À coller intégralement dans le Knowledge du projet Lovable.

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
4. **Espace consultant** — page autonome, sans sous-navigation
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
  assumée : approximation théorique). La capacité, elle, exclut les fériés —
  ce biais doit être affiché en infobulle sur les courbes de charge.
- Recalibrage : modifier une ligne rééquilibre les autres sur le total J/H du
  site, sauf les tâches marquées « éditée à la main » et sauf la visite.
- Bandes de staffing : <50 % sous-staffé · 50-75 % sous-charge légère ·
  75-90 % bien staffé · >90 % surstaffing à surveiller.

## Dates — règle absolue

Toutes les dates métier sont des dates **civiles locales** (type `date` en base,
sans fuseau). **Ne jamais utiliser `toISOString()`** pour produire une clé de jour :
en fuseau Europe/Paris, minuit local devient la veille en UTC. Utiliser
exclusivement le helper local `${y}-${pad(m)}-${pad(d)}`. Un bug de ce type a
fait ignorer tous les congés du vendredi dans `capaciteMois`.

## Sécurité — règles non négociables

- Toute nouvelle table : `ENABLE ROW LEVEL SECURITY` + policies **explicitement**
  `TO authenticated` (jamais de clause TO omise : le défaut PUBLIC inclut `anon`).
- Toute policy `SELECT` doit inclure `public.is_merca_team()`. La restriction de
  domaine côté client (`auth.tsx`) ne protège PAS l'API REST.
- Ne jamais granter quoi que ce soit au rôle `anon`.
- Secrets et appels d'API tiers : uniquement dans `*.server.ts` ou
  `*.functions.ts`, jamais dans un composant.
- Les droits admin se lisent dans `user_roles`. Ne jamais coder un e-mail en dur.

## Conventions de code

- React + TS + Tailwind + shadcn/ui. UI en **français**.
- Les moteurs de calcul (`workload-engine.ts`, `workload-capacity.ts`,
  `pricing-engine`) sont **purs** : aucun accès Supabase. Garder cette séparation.
- Réutiliser `src/components/ui-kit/` avant de créer un composant.
- **Aucun nouveau fichier au-delà de 400 lignes** : extraire dans
  `src/features/workload/shared/`. (CapacitePage, MonEspacePage, SynthesePage et
  ImputationPage sont déjà trop gros — les réduire à chaque passage, jamais les agrandir.)
- Toute règle de calcul s'écrit **une seule fois**. Si deux fonctions calculent la
  même chose (ex. calcCharge / calcChargeBuckets), factoriser plutôt que dupliquer.
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

---

# Annexe C — Requête de contrôle permanente

À relancer après **chaque** migration, et à afficher dans l'écran Admin.
Elle doit renvoyer **0 ligne**.

```sql
-- Toute ligne = une policy de lecture non protégée par le domaine.
SELECT tablename AS objet, policyname AS detail, 'policy SELECT ouverte' AS alerte
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd = 'SELECT'
  AND qual NOT ILIKE '%is_merca_team%'
  AND qual NOT ILIKE '%auth.uid()%'
  AND qual NOT ILIKE '%has_role%'

UNION ALL

-- Toute ligne = un privilège rendu au rôle anon.
SELECT table_name,
       string_agg(DISTINCT privilege_type, ','),
       'GRANT au rôle anon'
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee = 'anon'
GROUP BY table_name

UNION ALL

-- Toute ligne = une table sans RLS activée.
SELECT c.relname, '', 'RLS désactivée'
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
```

---

# Annexe D — Prompts prêts à coller dans Lovable

### D.1 — Sécurité (§P0-1)

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

### D.2 — Bug de capacité (§P0-2)

```
Bug de calcul — les congés du vendredi ne sont jamais comptés.

Dans src/lib/workload-capacity.ts, isoDay() utilise toISOString() (UTC) alors que
isoDayLocal() utilise l'heure locale. En Europe/Paris, minuit local devient la
veille en UTC. Comme la boucle de capaciteMois() saute les week-ends, la chaîne
correspondant à un vendredi n'entre jamais dans l'ensemble `eligibles` — donc
`eligibles.has(c.date)` ne matche jamais un congé de vendredi. Le dernier jour
ouvré du mois est perdu de la même façon. capaciteRange(), qui utilise
isoDayLocal(), est correcte : les deux fonctions divergent.

Impact mesuré : 227 des 672 congés en base tombent un vendredi.

À faire :
1. Rendre isoDay() local : `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`.
   ATTENTION : isoDay() est aussi utilisée par fetesFrance() et isFerie(), où le
   décalage s'annulait des deux côtés. Le passage en local rend les trois usages
   simultanément corrects — ne corrige donc PAS uniquement la ligne des eligibles.
2. Fusionner isoDay et isoDayLocal en un seul helper exporté, supprimer le doublon.
3. Même correction pour iso() dans src/lib/workload-engine.ts : go_live_auto est
   aujourd'hui stocké un jour trop tôt (vérifié : kick_off 2026-01-15 + 1,5 mois
   donne 2026-03-01 au lieu du 02/03).
4. Ajouter dans workload-capacity.test.ts deux tests : un congé posé un vendredi
   (2026-01-09) doit réduire joursCapa de 1 ; et capaciteMois doit donner le même
   jhFacturables que capaciteRange sur un mois entier.

Ne touche à aucune autre règle de calcul.
```

### D.3 — Adoption de l'imputation (§P0-3, lots ① et ②)

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

### D.4 — Ménage du dépôt (§P1-8)

```
Ménage du dépôt : supprime les fichiers résiduels à la racine — fix_final.py,
fix_team.py, fix_team_v2.py, fix_team_v3.py, replace.py, et le fichier nommé
"map.get(". Ce sont des scripts jetables d'une migration passée. Ajoute .env au
.gitignore et crée un .env.example listant les variables attendues sans leurs
valeurs. Ajoute aussi dans package.json les scripts "test": "vitest run",
"test:watch": "vitest" et "typecheck": "tsc --noEmit" — 16 fichiers de test
Vitest existent mais aucun script ne permet de les lancer. Ne touche à rien d'autre.
```

---

*Fin du document. Les constats sont datés du 05/08/2026 sur le commit `b8c8c0f` ;
les volumes et taux évoluent, les axes structurels moins vite.*
