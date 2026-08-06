# Analyse — Mercateam · Deployment OS (projet Lovable)

> **📄 Document de travail.** La version consolidée et destinée à la transmission
> est **`AUDIT-DEPLOYMENT-OS.md`** — elle reprend ces constats, les complète
> (dont un bug de capacité découvert depuis) et détaille les 19 axes P0→P2.

> Analyse réalisée en **lecture seule** sur le projet Lovable
> `03446cd1-9ede-4811-b7e4-f522751647e3` (`mercateam-internal-deploymentos`).
> Aucun message n'a été envoyé à l'agent Lovable, aucun fichier du projet n'a été modifié.
> Sources : arborescence complète du dépôt, contenu des fichiers clés, schéma
> PostgreSQL, politiques RLS, requêtes SQL d'inventaire (SELECT uniquement),
> analytics de la version publiée.
> Date : 5 août 2026 — dernier commit analysé : `b8c8c0f`.

---

## 1. Ce qu'est le projet

**Deployment OS** est l'outil interne de l'équipe Implémentation de Mercateam. Il
fusionne deux métiers qui étaient jusque-là séparés :

| Brique | Rôle | Remplace |
|---|---|---|
| **Chiffrage** | Simulateur d'offres de déploiement (new business + upsell), moteur de pricing, backlog d'offres, références | Un fichier de chiffrage / Excel |
| **Workload** | Gestion de charge : projets, capacité consultants, imputation du temps, forecast vs réel, pilotage | **ClickUp** |

Le lien entre les deux est le cœur du concept : une **offre** chiffrée génère un
**projet** en statut « Simulation », dont le forecast (tâches, heures, dates) est
déduit automatiquement des règles de déploiement. Ce projet pèse ensuite sur la
capacité de l'équipe, puis se confronte au temps réellement imputé.

### Chiffres de cadrage

| | |
|---|---|
| Créé le | 22/07/2026 — **~2 semaines de développement** |
| Fichiers source | ~230 (hors `node_modules`) |
| Migrations SQL | **90** |
| Tables | 24 + 1 vue + ~30 fonctions PostgreSQL |
| Fichiers de test | 16 (`*.test.ts`, Vitest) |
| URL publiée | `mercateam-internal-deploymentos.lovable.app` (publiée, accès filtré par Google Sign-In) |

La vitesse d'exécution est le fait marquant : 90 migrations, un import ClickUp
historique complet, 4 connecteurs externes et un serveur MCP en deux semaines.
C'est aussi la source de la plupart des axes d'amélioration listés en §8.

---

## 2. Comment la plateforme Lovable est utilisée ici

### 2.1 Le modèle Lovable

Lovable est un constructeur d'applications piloté par un agent IA. Il faut le voir
comme **un pair-programmeur qui possède le dépôt**, pas comme un générateur de code
one-shot :

- **Stack imposée** — ici `tanstack_start_ts_current` : TanStack Start (SSR +
  routing par fichiers) · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Vite 8 ·
  Bun. Pas de sélecteur de stack : on l'oriente dans le prompt initial.
- **Backend intégré (Lovable Cloud)** — un projet Supabase (PostgreSQL + Auth +
  RLS) provisionné automatiquement. L'agent écrit lui-même les migrations SQL,
  d'où les 90 fichiers `supabase/migrations/`.
- **Chaque prompt = un commit.** L'historique (`list_edits`) montre des commits
  en français, un par intention : *« Corrigé bug drag kanban »*, *« Propagé statut
  temps réel »*, *« Cache localisation en temps réel »*. L'historique du produit
  est donc lisible comme un journal de décisions.
- **Sandbox + preview live** — l'app est reconstruite après chaque réponse de
  l'agent ; `preview_url` (interne) et `url` (publiée) sont distincts.
- **Sync GitHub bidirectionnelle** possible : les commits poussés sur la branche
  connectée remontent dans l'éditeur Lovable. ⚠️ Ne jamais réécrire l'historique
  publié (force-push, rebase) — cela casse l'historique côté Lovable (c'est
  d'ailleurs écrit dans le `AGENTS.md` du projet).

### 2.2 Les leviers de pilotage de l'agent — et comment ce projet les utilise

**a) Le Knowledge projet** (instructions système persistantes)
C'est le levier n°1. Celui de ce projet est **remarquablement bien écrit** : il
contient le modèle de données complet, les règles de calcul (1 J/H = 8 h, visite =
16 h, matrices de répartition 60/0/40/0 · 10/50/10/30 · 30/40/15/15, formule de
durée théorique, formule de capacité facturable), les rôles, la charte graphique
(#6733FD / #2AC6CC / General Sans) et l'interdiction explicite de casser la
logique de pricing existante.

> ⚠️ **Mais il est désynchronisé.** Il décrit une app à *2 onglets* (Deployment
> Offer / Workload Management avec 4 sous-onglets Projets · Capacité · Imputation ·
> Forecast vs Réel). L'app réelle a aujourd'hui **4 onglets de premier niveau**
> (Chiffrage · Clients & projets · Cockpit · Espace consultant) + un Admin derrière
> l'engrenage, et le Cockpit a lui-même 4 sous-onglets d'analyse. L'agent travaille
> donc avec une carte périmée du produit. Voir §8, correctif à coût nul.

**b) Le plan (`.lovable/plan.md`)**
L'agent écrit son plan avant d'exécuter (« plan mode »). Celui en cours est un bon
exemple de ce que la plateforme sait faire quand elle est bien pilotée : il audite
les **31 occurrences de `t.site_id!`** réparties dans 12 fichiers devenues
dangereuses depuis l'introduction des tâches de niveau client, propose un helper
central plutôt que 31 rustines, découpe le travail en 5 étapes ordonnées, et
**pose une question ouverte à l'utilisateur** (calculer la gouvernance groupe
depuis les tâches, ou depuis un champ éditable ?) avant de trancher par défaut.

**c) Fonctions serveur**
Pas d'edge functions Supabase classiques : tout passe par le serveur Nitro de
TanStack Start, avec deux conventions de nommage propres :
- `src/lib/*.functions.ts` → server functions appelables depuis le client
  (`google-calendar`, `hubspot`, `payfit-sync`, `nps`, `metabase`, `geocode`, `ical-agenda`)
- `src/lib/*.server.ts` → code qui ne doit **jamais** partir dans le bundle
  (secrets, `google-crypto.server.ts` pour le chiffrement des tokens OAuth)

**d) Un serveur MCP exposé par l'app elle-même** — le point le plus original
`src/routes/[.mcp]/` publie un serveur MCP authentifié en OAuth (issuer = Supabase)
qui expose deux outils : `simulate_new_offer` et `simulate_upsell`. Concrètement :
**n'importe quel compte @merca.team peut appeler le moteur de chiffrage Mercateam
depuis Claude ou ChatGPT**, sans ouvrir l'app. Double garde : validation OAuth par
`@lovable.dev/mcp-js` + garde applicative `denyIfNotMercaTeam` sur le domaine du
mail. C'est bien fait, et c'est un actif largement sous-exploité (§8).

**e) Analytics intégrés** — visiteurs, pages vues, sources, appareils, pays,
disponibles directement sur le projet publié (chiffres en §7).

---

## 3. Architecture technique

```
src/
├─ routes/                    # TanStack Start — routing par fichiers
│  ├─ _app.tsx                #   layout authentifié → AppShell
│  ├─ _app.simulator.*.tsx    #   Chiffrage
│  ├─ _app.workload.*.tsx     #   Clients & projets, Cockpit, Admin
│  ├─ _app.espace-consultant  #   Espace personnel
│  └─ [.mcp]/ [.well-known]/  #   serveur MCP + découverte OAuth
├─ features/                  # une page métier = un dossier
│  ├─ simulator-new/ simulator-upsell/ backlog/ references/
│  ├─ workload/               #   ~60 composants (le gros du produit)
│  ├─ synthese/ admin/
├─ lib/                       # ★ la valeur : moteurs purs + accès données
│  ├─ pricing-engine.js       #   moteur de chiffrage (JS non typé)
│  ├─ workload-engine.ts      #   règles forecast (répartitions, durées, recalibrage)
│  ├─ workload-capacity.ts    #   capacité, fériés, étalement de charge
│  ├─ workload-api.ts         #   accès Supabase
│  ├─ data-quality.ts         #   10 contrôles qualité
│  ├─ pilotage-kpis.ts, variance.ts, real-capacity-details.ts
│  ├─ *.functions.ts / *.server.ts   # serveur
│  └─ mcp/                    #   outils MCP
├─ components/ui/             # shadcn/ui (~50 primitives)
├─ components/ui-kit/         # sur-couche maison (SubTabs, SectionNav, EmptyState…)
└─ integrations/supabase/     # client + types générés
```

**Principe structurant, très sain : les moteurs de calcul sont purs.**
`workload-engine.ts` et `workload-capacity.ts` ne touchent jamais Supabase — ils
prennent des tableaux, rendent des tableaux. C'est ce qui rend les 16 fichiers de
test possibles et ce qui protège la logique métier des refontes d'UI.

**Contrepartie : tout le calcul est fait dans le navigateur.** `loadFullWorkload()`
charge projets + sites + tâches (+ imputations selon les écrans) en pagination
complète, puis JS pur. À 250 projets / 1 192 tâches / 2 487 imputations ça passe ;
la structure ne tiendra pas un ordre de grandeur au-dessus (§8).

**Navigation — 4 personas** (`AppShell.tsx`) :

| Onglet | Pour qui | Contenu |
|---|---|---|
| **Chiffrage** | Tous | Simulateur new offer · Simulateur upsell · Backlog · Références |
| **Clients & projets** | Usage quotidien | Board Kanban / timeline / carte / vue par client |
| **Cockpit** | Manager (Léa) | Synthèse · Analyse Clients & projets · Analyse Charge · Analyse Performance |
| **Espace consultant** | Chaque consultant | Ses projets, sa charge, son imputation |
| ⚙︎ Admin | Admin | Équipe, connecteurs, listes de valeurs, qualité de données, rôles |

---

## 4. Le modèle de données et les règles métier

### 4.1 Hiérarchie

```
client (86)          ── gouvernance groupe (tâches site_id NULL)
 └─ projet (251)     ── « le deal » : statut, LPM/IC, répartition par défaut, offre source
     └─ site (279)   ── ★ « le projet » au sens métier : J/H vendus, effectif, dates, ARR, HubSpot
         └─ tache (1 192)   ── forecast : type front/back/visite, rôle LPM/IC, heures, dates
             └─ imputation (2 487)  ── réalisé, granularité JOUR
```

> ⚠️ **Piège de vocabulaire majeur.** Un « projet » au sens métier = une ligne
> **`site`**. La table `projet` porte en réalité le *deal / client*. C'est
> documenté dans `data-quality.ts` (« Vocabulaire : un projet au sens métier = une
> ligne `site` ») mais ça n'apparaît nulle part dans l'UI ni dans le Knowledge.
> C'est la première chose qui perdra un nouvel arrivant — et l'agent Lovable
> lui-même.

À côté : `consultant` + `consultant_periode` (périodes d'activité avec capacité
hebdo et part interne, ce qui permet de faire entrer/sortir quelqu'un de l'équipe
sans perdre l'historique), `conges` (source Payfit), `part_interne_mois`,
`workload_settings`, `pricing_config`, `offers`, et 6 tables de staging ClickUp/HubSpot.

### 4.2 Règles de calcul (le cœur de la confiance dans l'outil)

- **1 J/H = 8 h.** Visite = 16 h fixes par consultant présent (ou le volume
  réellement vendu si l'offre le précise).
- **Répartition** du reste après visite, en `[LPM front, IC front, LPM back, IC back]` :
  `solo` = 60/0/40/0 · `r3070` = 10/50/10/30 · `r5050` = 30/40/15/15.
  `personnalisee` est explicitement **hors règle** (imports historiques) et n'est
  jamais régénérée automatiquement — bon garde-fou.
- **Durée théorique** (mois) selon l'effectif N : N ≤ 100 → 1,5 ; N ≤ 200 →
  (N/200)×3 ; N > 200 → 3 + (N−200)/200×1,5, arrondi au quart.
  `go_live_auto = kick_off + durée`.
- **Capacité facturable / mois** = (jours ouvrés − fériés France − congés) ×
  (heures_hebdo / 5) × (1 − part_interne), bornée à la période d'activité du
  consultant. Les fériés sont calculés (fixes + Pâques/Ascension/Pentecôte via
  l'algorithme de Meeus).
- **Étalement de la charge** : les heures d'une tâche sont réparties entre `debut`
  et `fin` au prorata des jours ouvrés ; une visite tombe entièrement sur son mois ;
  la gouvernance sans dates est étalée sur la fenêtre du projet ou du client.
- **Bandes de staffing** (couleurs partagées partout) : < 50 % sous-staffé ·
  50–75 % sous-charge légère · 75–90 % bien staffé · > 90 % surstaffing à surveiller.

### 4.3 Recalibrage — le détail qui fait la qualité

`recalibrerTaches()` : quand on modifie une ligne du forecast, les autres se
rééquilibrent pour retomber sur le total J/H vendu du site — **sauf** les tâches
marquées « éditées à la main » et **sauf** la visite. C'est exactement le bon
compromis entre automatisme et contrôle humain.

---

## 5. Sécurité et droits

### 5.1 Le modèle en place

Trois rôles (`user_roles`, enum `app_role`) :

| Rôle | Droits |
|---|---|
| `admin` | Lecture + édition partout |
| `utilisateur` | Lecture partout, **aucune** édition |
| `consultant` | Lecture partout, édition sur **ses** projets (LPM/IC du projet ou du site, ou assigné sur une tâche) + son espace |

Exception assumée : l'onglet **Chiffrage** reste éditable par tous.

L'implémentation est propre et **doublée** : `permissions.ts` côté front (confort
UI) **et** RLS côté base (source de vérité), via des fonctions `SECURITY DEFINER`
avec `search_path` verrouillé — `can_edit_projet()`, `can_edit_site()`,
`current_consultant_id()`, `has_role()`. Le lien compte ↔ consultant se fait par
l'e-mail. `ensure_my_role()` auto-provisionne un rôle et **vérifie le domaine
@merca.team**. Les tokens Google sont stockés chiffrés (`access_token_ct`) avec
policies « own row ». Le login demande les scopes minimaux ; l'accès agenda est
demandé séparément depuis l'Espace consultant (moindre privilège). Tout cela est
au-dessus de la moyenne pour un outil interne de 2 semaines.

### 5.2 Ce qui doit être corrigé

**🔴 P0 — La restriction de domaine n'existe pas au niveau des politiques de lecture.**

Toutes les policies `SELECT` de `client`, `projet`, `site`, `tache`, `imputation`,
`consultant`, `conges`, `consultant_periode`, `part_interne_mois`,
`workload_settings`, `pricing_config` sont `USING (true)` pour le rôle
`authenticated`. Le filtre @merca.team est appliqué **côté client**
(`auth.tsx` déconnecte l'utilisateur non autorisé) et dans `ensure_my_role()`
(qui refuse d'attribuer un rôle) — mais **pas dans les policies elles-mêmes**.

Or la clé anon Supabase est publique par construction (elle est dans le bundle JS).
Si le provider Google du projet Supabase accepte n'importe quel compte Google,
alors un compte externe peut obtenir un JWT `authenticated` et interroger l'API
REST directement — l'app le déconnecte, l'API non. Sont alors lisibles : la liste
des clients, l'**ARR par site**, les effectifs, les J/H vendus, les consultants,
leurs congés et leur part interne.

La table `offers` montre d'ailleurs le bon pattern, déjà utilisé ici :
`(auth.jwt() ->> 'email') LIKE '%@merca.team'`.

*Test à faire en premier* : créer un compte Google externe, tenter le login, et
appeler `/rest/v1/site?select=nom,arr` avec le JWT obtenu.
*Correctif* : une fonction `is_merca_team()` et l'ajouter au prédicat de **toutes**
les policies SELECT ; et/ou restreindre les inscriptions au niveau Supabase Auth.

**🟠 P1 — Anomalies de politiques**

| Table | Problème |
|---|---|
| `tache_deleted_backup` | La seule policy `SELECT` est `has_role('utilisateur')` → **un admin ne peut pas lire la table de sauvegarde** (il a INSERT/UPDATE/DELETE mais pas SELECT). Incohérent avec `imputation_deleted_backup` dont le SELECT est réservé à l'admin. Probable inversion. |
| `imputation_deleted_backup` | `INSERT ... WITH CHECK (true)` → n'importe quel authentifié peut écrire dans la table d'audit. Une table d'audit ne devrait être alimentée que par trigger / `service_role`. |
| `geocode_cache` | `INSERT`/`UPDATE` en `true` pour tout authentifié → empoisonnement de cache possible (impact faible, mais gratuit à corriger). |
| `user_ical` | Aucune policy `SELECT` : l'utilisateur peut écrire son URL iCal mais pas la relire. À confirmer (lecture serveur ?), sinon l'UI ne peut pas afficher l'état de la connexion. |

**🟠 P1 — Admin codé en dur.** `lea@merca.team` apparaît en dur à **trois**
endroits : `ADMIN_EMAILS` dans `auth.tsx`, `ensure_my_role()` en base, et les
policies `offers`. Changer d'administrateur exige aujourd'hui une migration SQL
*et* un déploiement front. Bus factor de 1.

**🟡 P2 — `.env` versionné.** Le fichier `.env` est présent dans le dépôt et
**n'est pas listé dans `.gitignore`**. C'est la convention Lovable (il ne contient
en principe que `VITE_SUPABASE_URL` / clé publiable, non secrètes), mais la porte
est ouverte pour qu'un secret y atterrisse au prochain connecteur. À ignorer
explicitement, avec un `.env.example` en remplacement.

---

## 6. Intégrations

| Connecteur | Usage | Statut observé |
|---|---|---|
| **ClickUp** | Import one-shot de l'historique (Dossier = client, Liste = site, tags front/back, Time Estimate = forecast, Time Logged = réalisé). ClickUp est ensuite abandonné. | ✅ Fait — 2 450 imputations importées, tables `stg_cu_*` encore en base |
| **Payfit** | Congés → capacité | ✅ 672 lignes de congés, écran de mapping d'identités |
| **HubSpot** | Rattachement société « site de prod », ARR, features facturées, industrie, BU | ✅ Cache local + écran de matching + règle bloquante |
| **Google Agenda** | Pré-remplissage de l'imputation (réunion avec un contact dont le domaine mail = client → front) | ✅ OAuth incrémental, tokens chiffrés, + fallback iCal |
| **Metabase / NPS** | Indicateurs de performance | ✅ Server functions dédiées |
| **Géocodage** | Carte des sites (Leaflet + clustering) | ✅ Avec cache en base |
| **MCP (sortant)** | Le chiffrage exposé à Claude / ChatGPT | ✅ Opérationnel, sous-exploité |

Écosystème d'intégrations impressionnant pour l'échelle du projet. Le point de
vigilance est qu'il n'y a **aucune synchronisation périodique** documentée : les
imports semblent déclenchés manuellement depuis l'Admin.

---

## 7. État réel : ce que disent les données

C'est la partie la plus importante de cette analyse.

### 7.1 Volumes

| | |
|---|---|
| Clients | 86 |
| Projets (deals) | 251 dont 226 vivants |
| Sites (« projets » métier) | 279 dont 259 vivants |
| Tâches | 1 192 (dont 18 de gouvernance groupe) |
| Imputations | 2 487 |
| Consultants | 11 dont **5 actifs** |
| Offres sauvegardées | **4** |
| Comptes avec un rôle | **3** |

### 7.2 Répartition des sites vivants

| Statut | Sites | J/H vendus | Sans ARR | Sans géoloc | Sans HubSpot |
|---|---|---|---|---|---|
| done (succès) | 168 | 601,6 | 8 | 19 | 18 |
| fail | 21 | 32,9 | 6 | 9 | 8 |
| simulation | 18 | 210,5 | **16** | 14 | 15 |
| ongoing | 18 | 252,5 | 1 | 2 | 6 |
| booked | 10 | 143,3 | 1 | 1 | 2 |
| blocked | 3 | 33,7 | 0 | 1 | 0 |

Qualité de données sur les **148 tâches des projets actifs** : 10 sans consultant,
2 sans dates, 12 à forecast 0, 37 issues de ClickUp. **C'est bon.** Le module
qualité de données (10 contrôles, avec actions correctives en un clic) fonctionne.

### 7.3 🔴 Le signal critique : l'imputation

| Source | Lignes | J/H | Période |
|---|---|---|---|
| `clickup:api` | 2 450 | 810,6 | 13/02/2024 → **24/07/2026** |
| `import` | 25 | 21,0 | 31/07/2026 |
| `saisie` (dans l'outil) | **11** | **8,8** | 01/05/2024 → 28/07/2026 |
| `agenda` | **1** | 0,1 | 28/07/2026 |

**Sur 2 487 imputations, 12 ont été produites par l'outil.** Tout le reste est
l'import ClickUp historique, figé au 24 juillet. Nous sommes le 5 août : il n'y a
**plus aucun réalisé depuis 12 jours**.

Conséquence directe : le Cockpit, le Forecast vs Réel, les KPI de performance, les
deltas vendu/réalisé, la capacité réelle — toute la couche de pilotage — reposent
aujourd'hui sur un jeu de données mort. L'outil sait tout calculer ; il ne reçoit
pas encore la donnée d'entrée quotidienne qui lui donne son sens.

### 7.4 Usage (15 jours, version publiée)

- 69 visiteurs uniques · 1 418 pages vues · **20,5 pages par visite** ·
  session moyenne ~38 min · rebond 12 % · 62/69 depuis la France · **1 seul visiteur mobile**.
- Pages les plus vues : `/simulator/new` (43) · `/workload/projets` (40) ·
  `/workload/capacite` (27) · `/synthese` (26) · `/espace-consultant` (25) ·
  `/workload/forecast-reel` (19) · `/workload/imputation` (17).

Lecture : un usage **très intense mais très concentré** — signature d'une phase de
construction/recette, pas encore d'un run d'équipe. Croisé avec les 3 rôles
attribués en base, on est sur 2–3 utilisateurs réels.

---

## 8. Axes d'amélioration

### 🔴 P0 — À traiter en priorité

**1. Fermer la faille de lecture (§5.2).**
Créer `is_merca_team()` et l'ajouter au prédicat de toutes les policies SELECT.
Effort : une migration. Impact : c'est la seule chose qui empêche aujourd'hui la
lecture de l'ARR client par un compte externe.

**2. Boucler la boucle de l'imputation — le vrai sujet produit.**
Sans saisie quotidienne, tout le reste est décoratif. Trois leviers concrets :
- **Ritualiser** : rappel hebdomadaire (Slack / mail) + un KPI « taux de
  complétion d'imputation par consultant » en tête du Cockpit. Ce qui n'est pas
  mesuré n'est pas fait.
- **Réduire le coût de saisie** : le pré-remplissage Google Agenda existe et
  fonctionne (1 seule imputation en vient) — le passer d'opt-in à **proposition
  par défaut au début de chaque semaine**.
- **Rendre la page d'imputation utilisable au téléphone** : 1 visiteur mobile sur
  69, alors que c'est le seul écran qu'un consultant remplirait depuis un site
  client, le soir, en 90 secondes.
Puis **verrouillage mensuel** + validation manager, pour que le réalisé devienne
une donnée sur laquelle on peut engager un chiffrage.

**3. Resynchroniser le Knowledge du projet.**
Il décrit une architecture à 2 onglets qui n'existe plus. Coût : 20 minutes.
Impact : chaque prompt futur part d'une carte juste — moins d'allers-retours,
moins de crédits, moins de régressions. À faire figurer aussi : le piège de
vocabulaire `projet` ≠ « projet métier » (= `site`), et la liste des champs legacy.

### 🟠 P1 — Dette structurelle à traiter avant qu'elle ne coûte cher

**4. Terminer la migration « gouvernance groupe ».**
Le plan est écrit et bon, mais seules les étapes 1–2 sont faites. Restent :
l'audit des **31 `t.site_id!`** (une non-null assertion devenue fausse depuis les
tâches client-level → risque de crash ou, pire, de silence), l'imputation des
tâches de gouvernance, et le garde-fou RPC de réconciliation. Les champs legacy
(`projet.gouvernance_jh`, `client.gouvernance_jh` à 0 partout) doivent être
tranchés — deux chemins de calcul coexistants finissent toujours par diverger.

**5. Dédupliquer le moteur de charge.**
`calcCharge()` (mois) et `calcChargeBuckets()` (mois **ou** semaine) dupliquent
~150 lignes de logique quasi identique — tâches, gouvernance projet, gouvernance
client. Toute règle modifiée d'un seul côté fait diverger silencieusement deux
écrans qui affichent « la même » métrique. Une seule implémentation paramétrée par
les buckets.

**6. Typer le moteur de pricing.**
`pricing-engine.js`, `prefill-parsers.js` et `ui-content.js` sont du JavaScript non
typé, rendu invisible à TypeScript par un `declare module "@/lib/pricing-engine"`
vide. **Le cœur commercial de l'outil est la seule partie sans filet de type.**
C'est aussi celle que le Knowledge interdit de casser — d'où l'urgence de la
protéger autrement que par la consigne.

**7. Faire tourner les tests.**
16 fichiers de test Vitest existent, `vitest.config.ts` existe — mais **il n'y a
pas de script `test` dans `package.json`** et pas de CI. Les tests ne s'exécutent
donc jamais. Ajouter `"test": "vitest run"` + un workflow GitHub Actions
(lint + `tsc --noEmit` + vitest) sur la branche connectée.

**8. Automatiser les invariants métier.**
Excellente idée déjà en place : `assert_imputation_reconciliation()`,
`assert_vendu_invariant()`, `assert_workload_invariants()` — des fonctions SQL qui
vérifient que le total J/H et la réconciliation ClickUp ne dérivent pas. Il manque
seulement de les **exécuter automatiquement** (pg_cron nocturne ou GitHub Action)
et d'afficher le verdict dans l'écran Admin. Un invariant qu'on doit penser à
lancer n'est pas un invariant.

**9. Découper les composants géants.**
`CapacitePage.tsx` dépasse 1 900 lignes, `SynthesePage.tsx` et `ImputationPage.tsx`
~1 000. Double coût : illisible pour un humain, et **coûteux en crédits Lovable**
(l'agent relit tout le fichier à chaque édition, et le risque de régression croît
avec la taille du contexte). Extraire les sections en composants de `features/workload/shared/`.

**10. Ménage du dépôt.**
`fix_final.py`, `fix_team.py`, `fix_team_v2.py`, `fix_team_v3.py`, `replace.py` et
un fichier littéralement nommé `map.get(` traînent à la racine — résidus de
scripts one-shot. Idem pour les 6 tables de staging ClickUp/HubSpot, à archiver une
fois la réconciliation validée. Le désordre a un coût : l'agent le lit.

### 🟡 P2 — Améliorations de fond

**11. Passer les agrégats côté PostgreSQL.**
Aujourd'hui l'app charge l'intégralité du workload dans le navigateur et recalcule
tout à chaque écran. Les briques existent déjà (`imputation_agg()`,
`imputation_totaux_par_site()`) : les généraliser, viser une vue matérialisée
mensuelle rafraîchie à l'écriture. Gain : temps de chargement, et surtout une
**source unique par métrique** — aujourd'hui 6 écrans recalculent chacun leurs
agrégats à partir des mêmes primitives, ce qui est la recette classique du
« ce chiffre n'est pas le même sur les deux pages ».
Étape intermédiaire peu coûteuse : un `useWorkloadSnapshot()` partagé via React
Query (déjà en dépendance) — une requête, un calcul mémoïsé, tous les onglets.

**12. Trancher le biais fériés / jours ouvrés.**
L'étalement de la charge se fait sur les jours ouvrés **fériés inclus** (choix
documenté comme « règle validée »), alors que la capacité, elle, **exclut** les
fériés. Sur mai et août, la charge est donc étalée sur des jours où la capacité est
nulle : le taux de staffing est structurellement optimiste sur ces mois. Ce n'est
pas forcément à corriger — mais ça doit être affiché dans l'UI (« étalement
théorique, fériés inclus ») plutôt que resté dans un commentaire de code.

**13. Uniformiser la gestion des dates.**
`workload-engine.ts` utilise `toISOString()` (UTC) alors que `workload-capacity.ts`
utilise `isoDayLocal()` (heure locale). Les deux se croisent sur les dates générées
(`go_live_auto`) : décalage d'un jour possible selon le fuseau et l'heure de
saisie. Un seul helper local, partout.

**14. Anticiper l'international.**
`fetesFrance()` est codé en dur alors que `site` porte déjà `pays`, et que
l'existence de traductions partenaires (Sekurit Germany) indique des déploiements
hors France. Le jour où un consultant travaille sur un site allemand, la capacité
est fausse. Prévoir un calendrier de fériés par pays.

**15. Traçabilité.**
Seul `projet` porte `created_by`. Ni `site`, ni `tache`, ni `imputation` ne portent
de `updated_by`. Sur un outil où plusieurs personnes éditent le forecast d'un même
projet, « qui a changé ce chiffre et quand » deviendra une question fréquente.

**16. Exploiter le serveur MCP.**
Deux outils de chiffrage sont déjà exposés et authentifiés — c'est un actif rare.
Ajouter des outils **de lecture** (`get_capacity`, `list_projects`,
`forecast_vs_actual`) permettrait à l'équipe d'interroger l'outil en langage
naturel depuis Claude : *« quelle est ma dispo en octobre ? »*, *« quels projets
dérivent de plus de 20 % ? »*. C'est probablement le chemin le plus court vers
l'adoption réelle par des consultants qui n'ouvriront pas un cockpit tous les jours.

**17. i18n — décider.**
Le bilinguisme FR/EN est partiel : `t("clé", "fallback en dur")` dans chaque
composant, mais les libellés métier (statuts, bandes de staffing
« Sous-staffé »/« Bien staffé ») sont en français en dur dans les moteurs.
Soit l'anglais est un vrai besoin et il faut centraliser, soit il ne l'est pas et
il faut retirer la couche i18n — l'état intermédiaire coûte à chaque écran ajouté.

---

## 9. Tenants et aboutissants — lecture stratégique

**Ce qui est réellement réussi**
- La **modélisation métier**. Les règles de déploiement Mercateam (répartitions
  LPM/IC, durée par effectif, visite forfaitaire, capacité facturable nette de
  congés et de part interne) sont formalisées avec une précision qu'on trouve
  rarement dans un outil interne. C'est ça, l'actif — pas le code.
- La **séparation moteurs purs / UI**, qui rend cette modélisation testable et
  survivable à n'importe quelle refonte d'interface.
- La **sécurité en profondeur** : RLS réelle, pas seulement des gardes UI ; tokens
  OAuth chiffrés ; scopes minimaux au login. Rare à ce stade de maturité.
- Le **traitement du legacy** : import ClickUp complet, réconciliation avec
  invariants SQL, tables de backup sur suppression, statuts `est_brouillon` /
  `deleted_at` / `archived_at`. Quelqu'un a pensé à la reprise de données, ce qui
  est généralement ce qui tue ce genre de projet.

**Le risque n°1 n'est pas technique, il est d'adoption.**
L'outil est en avance sur son usage. Il sait produire des KPI de pilotage
sophistiqués à partir d'un réalisé qui, aujourd'hui, n'entre pas. Douze imputations
saisies en deux semaines, trois comptes actifs. Tant que la boucle
*saisie quotidienne → réalisé → forecast vs réel → chiffrage recalibré* ne tourne
pas, chaque nouvelle fonctionnalité d'analyse augmente la surface à maintenir sans
augmenter la valeur. **Le prochain sprint devrait porter sur l'adoption de
l'imputation, pas sur un nouvel écran d'analyse.**

**Le risque n°2 est le bus factor.**
Un seul auteur, un seul admin codé en dur, aucune CI, aucun test exécuté, un
Knowledge désynchronisé. L'outil est déjà critique (il porte 86 clients et
1 274 J/H vendus) mais ne survivrait pas simplement au départ de son auteur.
Les correctifs sont pourtant peu coûteux : script de test + CI, admin en base,
Knowledge à jour, README d'exploitation.

**Le risque n°3 est la dépendance à la plateforme.**
Le projet vit à 100 % dans Lovable. La sortie de secours existe (le code est
standard : TanStack Start + Supabase, rien de propriétaire sauf
`@lovable.dev/mcp-js` et `@lovable.dev/cloud-auth-js`) mais elle n'est pas
préparée. **Connecter le dépôt GitHub est l'assurance à souscrire en premier** —
c'est gratuit, réversible, et ça débloque au passage la CI du point 7.

**Ce qu'il faut retenir de la méthode.**
Ce projet est un bon cas d'école de ce que Lovable permet quand on lui donne un
Knowledge métier dense et qu'on le laisse écrire ses plans : deux semaines pour un
outil qui remplace ClickUp, un tableur de chiffrage et quatre intégrations. La
contrepartie est visible dans le dépôt : composants qui enflent, scripts jetables
laissés à la racine, migrations en cours jamais finies, tests écrits mais jamais
lancés. Ce sont exactement les tâches que l'agent ne fait pas spontanément — parce
qu'on ne les lui demande jamais. **Le vrai levier de qualité sur Lovable, c'est de
prompter aussi le ménage, pas seulement les fonctionnalités.**
