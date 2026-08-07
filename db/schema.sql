-- ============================================================================
-- Diagnostic OS — schéma de la base partagée
--
-- Cible : PostgreSQL 16 / Supabase.
--
-- ATTENTION : ce fichier est RECOPIÉ de la base réelle, il ne la pilote pas.
-- Les migrations sont appliquées depuis l'application (Lovable) et vivent dans
-- `supabase/migrations/` du dépôt applicatif. Ce fichier existe pour qu'on
-- puisse lire le modèle et le remonter à neuf ; il dérive dès qu'une migration
-- passe sans être recopiée ici. Régénéré le 07/08/2026 — voir « Vérifier que
-- ce fichier est à jour » dans `db/README.md`.
--
-- Deux partis pris structurent tout le reste :
--
-- 1. Le modèle est NORMALISÉ, pas stocké en un JSON par client. Le raccourci
--    du blob aurait collé au `etat.base` de l'application, mais il rend les
--    collisions systématiques : deux consultants sur des processus différents
--    du même client s'écraseraient mutuellement. Ici, une ligne par étape,
--    par friction et par chiffre : ils n'écrivent jamais au même endroit.
--
-- 2. Chaque table éditable porte un compteur `version`. L'écriture se fait en
--    `... WHERE id = $1 AND version = $2` : si la version a bougé depuis la
--    lecture, aucune ligne n'est touchée et l'appelant le sait. Cela ne
--    fusionne pas deux modifications concurrentes — mais cela ne perd jamais
--    rien en silence, seul comportement réellement inacceptable.
--
-- Les identifiants lisibles de l'application (« sekurit-float-france ») sont
-- conservés en `code`, à côté d'une clé technique. L'export JSON les restitue
-- donc à l'identique, et les enfants pointent sur une clé stable même si le
-- code est renommé.
--
-- Toutes les fonctions sont SECURITY INVOKER (le défaut) et figent leur
-- `search_path` : les politiques d'accès s'appliquent donc À L'INTÉRIEUR des
-- fonctions, y compris `importer_client_json`, qui ne peut pas servir de porte
-- dérobée.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Clients
-- ----------------------------------------------------------------------------
create table clients (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  nom         text not null,
  site        text not null default '',

  -- Date de visite gardée en texte. L'application la saisit librement
  -- (« 22.06.2026 », mais aussi « T1 2026 » ou vide) : un type `date` la
  -- rejetterait et ferait perdre de l'information à la migration.
  date_visite text not null default '',

  notes       text not null default '',
  outils      text[] not null default '{}',

  -- Environnement IT : structure des blocs, corrections de classement,
  -- échanges et positions du schéma. Le CONTENU (quel outil dans quel bloc)
  -- n'est jamais enregistré ici : il est recalculé depuis les supports des
  -- étapes à chaque affichage. Édité d'un bloc, jamais ligne à ligne — ce
  -- n'est pas un point de contention entre consultants, le jsonb suffit.
  si          jsonb,

  -- Trame : ce diagnostic sert de SOURCE de pré-remplissage au lieu d'être un
  -- relevé de site. `existant` = le relevé type des 10 use cases, `cible` =
  -- les mêmes après déploiement Mercateam. Une trame sort de la liste des
  -- diagnostics et ne peut pas être supprimée tant qu'elle est marquée.
  trame       text,

  version     integer not null default 1,
  cree_le     timestamptz not null default now(),
  maj_le      timestamptz not null default now(),

  constraint clients_code_non_vide check (code <> ''),
  constraint clients_nom_non_vide  check (nom  <> ''),
  constraint clients_trame_valide  check (trame is null or trame in ('existant', 'cible'))
);

-- UNE SEULE trame par valeur. Sans cet index, deux diagnostics marqués
-- `existant` feraient basculer la source de vérité en silence : le code lit
-- `.eq('trame','existant').order('maj_le' desc).limit(1)`, donc le dernier
-- édité l'emporterait sans que rien ne le signale.
create unique index clients_trame_unique on clients (trame) where trame is not null;

-- ----------------------------------------------------------------------------
-- Processus — unité de contention : c'est ici que deux consultants se croisent
-- ----------------------------------------------------------------------------
create table processus (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients(id) on delete cascade,
  code       text not null,
  nom        text not null,
  soustitre  text not null default '',

  -- Couloirs du diagramme, dans l'ordre d'affichage. Tout rôle cité par une
  -- étape doit y figurer, sinon la carte n'a aucune ligne où se poser :
  -- l'invariant est vérifié par `verifier_roles_couloirs()`.
  roles      text[] not null default '{}',

  rang       integer not null default 1,   -- ordre des onglets

  -- Use case du catalogue. C'EST LE SEUL LIEN D'APPARIEMENT entre un processus
  -- de site, son homologue dans la trame et son homologue dans la trame cible.
  -- Jamais le nom : un consultant renomme « UC 7 » en « Habilitations Sekurit »
  -- et le rattachement doit survivre. `null` = processus hors catalogue.
  use_case   text,

  -- Maturité relevée à l'audit, et maturité constatée au bilan. Pas de moyenne
  -- entre use cases : ils ne sont pas commensurables.
  maturite            smallint,
  maturite_note       text not null default '',
  maturite_bilan      smallint,
  maturite_bilan_note text not null default '',

  version    integer not null default 1,
  cree_le    timestamptz not null default now(),
  maj_le     timestamptz not null default now(),

  unique (client_id, code),
  constraint processus_code_non_vide check (code <> ''),
  constraint processus_maturite_plage
    check (maturite is null or (maturite between 1 and 5)),
  constraint processus_maturite_bilan_check
    check (maturite_bilan is null or (maturite_bilan between 1 and 5)),
  constraint processus_use_case_valide
    check (use_case is null or use_case in
      ('uc1','uc2','uc3','uc4','uc5','uc6','uc7','uc8','uc9','uc10'))
);

create index processus_client_idx on processus (client_id, rang);

-- ----------------------------------------------------------------------------
-- Étapes
-- ----------------------------------------------------------------------------
create table etapes (
  id           uuid primary key default gen_random_uuid(),
  processus_id uuid not null references processus(id) on delete cascade,

  ordre        integer not null,
  role         text not null default '',
  role2        text not null default '',   -- carte à cheval sur deux couloirs
  texte        text not null default '',
  phase        text not null default '',   -- échelle de temps (« J1 », « M-1 »)
  supports     text not null default '',   -- « Excel, papier » — chaîne libre
  lien         text not null default '',   -- nature de la flèche entrante

  -- Marque de bilan : ce que cette étape est devenue après déploiement.
  -- `null` = non statuée, ce qui est l'état normal pendant l'audit.
  bilan        text,

  constraint etapes_lien_connu check (lien in ('', 'manuel', 'auto')),
  constraint etapes_ordre_positif check (ordre >= 1),
  constraint etapes_bilan_check
    check (bilan is null or bilan in ('mercateam', 'inchangee', 'supprimee')),

  -- Différée : un réordonnancement passe par des positions transitoirement en
  -- double, et doit pouvoir se faire en une transaction sans gymnastique.
  constraint etapes_ordre_unique unique (processus_id, ordre) deferrable initially deferred
);

create index etapes_processus_idx on etapes (processus_id, ordre);

-- Support de la clé étrangère composite de `frictions` ci-dessous. Redondant
-- avec la clé primaire du point de vue de l'unicité, indispensable du point de
-- vue de PostgreSQL, qui exige un index unique sur les colonnes référencées.
create unique index etapes_id_processus_uniq on etapes (id, processus_id);

-- ----------------------------------------------------------------------------
-- Frictions et chiffres clés
-- ----------------------------------------------------------------------------
create table frictions (
  id           uuid primary key default gen_random_uuid(),
  processus_id uuid not null references processus(id) on delete cascade,
  rang         integer not null,
  role         text not null default 'Transverse',
  texte        text not null,

  -- Étape où la friction se produit, facultative : une friction peut rester
  -- transverse au processus. La clé est COMPOSITE (etape_id, processus_id) :
  -- elle garantit que l'étape désignée appartient bien au même processus, ce
  -- qu'une clé simple sur `etape_id` ne saurait pas dire. `on delete set null`
  -- ne vise que `etape_id` : supprimer l'étape détache la friction, elle ne
  -- l'emporte pas — un constat de terrain ne disparaît pas parce que la carte
  -- qu'il désignait a été réécrite.
  etape_id     uuid,

  constraint frictions_texte_non_vide check (texte <> ''),
  constraint frictions_etape_meme_processus
    foreign key (etape_id, processus_id) references etapes (id, processus_id)
    on delete set null (etape_id)
);

create index frictions_processus_idx on frictions (processus_id, rang);
create index frictions_etape_id_idx  on frictions (etape_id);

create table chiffres (
  id           uuid primary key default gen_random_uuid(),
  processus_id uuid not null references processus(id) on delete cascade,
  rang         integer not null,
  valeur       text not null default '',
  libelle      text not null default '',

  -- L'application écarte déjà les lignes entièrement vides à l'import ;
  -- la base le garantit.
  constraint chiffres_non_vide check (valeur <> '' or libelle <> '')
);

create index chiffres_processus_idx on chiffres (processus_id, rang);

-- ----------------------------------------------------------------------------
-- Versions — instantanés complets d'un diagnostic
--
-- PAS de clé étrangère vers `clients`, volontairement : une version doit
-- survivre à la suppression de son client, sans quoi l'instantané pris « avant
-- suppression » partirait avec ce qu'il est censé sauver. `code_client` et
-- `nom_client` sont recopiés pour que la version reste lisible et restaurable
-- quand la ligne d'origine n'existe plus.
-- ----------------------------------------------------------------------------
create table versions (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null,
  code_client text not null,
  nom_client  text not null,
  contenu     jsonb not null,          -- sortie de `client_json`, format 1
  motif       text not null,           -- 'quotidien', 'avant_suppression_client'…
  libelle     text not null default '',
  auteur      text,                    -- e-mail lu dans le JWT
  cree_le     timestamptz not null default now()
);

create index versions_client_idx on versions (client_id, cree_le desc);

-- ============================================================================
-- Version et horodatage
-- ============================================================================

create or replace function toucher_version() returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- La version n'avance que sur une modification réelle du contenu : une
  -- écriture identique ne doit pas invalider la lecture d'un autre consultant.
  if new.* is distinct from old.* then
    new.version := old.version + 1;
    new.maj_le  := now();
  end if;
  return new;
end $$;

create trigger clients_version   before update on clients
  for each row execute function toucher_version();
create trigger processus_version before update on processus
  for each row execute function toucher_version();

-- Les enfants n'ont pas de version propre : ils appartiennent à leur processus,
-- qui est l'unité de concurrence. Les toucher fait avancer sa version, ce qui
-- suffit à faire échouer l'écriture concurrente d'un autre consultant.
create or replace function toucher_processus_parent() returns trigger
language plpgsql
set search_path = public
as $$
declare cible uuid;
begin
  cible := coalesce(new.processus_id, old.processus_id);
  update public.processus
     set version = version + 1, maj_le = now()
   where id = cible;
  return coalesce(new, old);
end $$;

create trigger etapes_touche_parent    after insert or update or delete on etapes
  for each row execute function toucher_processus_parent();
create trigger frictions_touche_parent after insert or update or delete on frictions
  for each row execute function toucher_processus_parent();
create trigger chiffres_touche_parent  after insert or update or delete on chiffres
  for each row execute function toucher_processus_parent();

-- ============================================================================
-- Invariant des rôles
-- Le diagramme bâtit ses couloirs sur `processus.roles`. Une étape dont le rôle
-- n'y figure pas n'a aucune ligne où se poser : elle disparaîtrait de l'écran
-- sans rien signaler. La règle est tenue par l'application à l'import ; elle
-- est tenue ici pour de bon.
-- ============================================================================
create or replace function verifier_roles_couloirs() returns trigger
language plpgsql
set search_path = public
as $$
declare
  manquant text;
  couloirs text[];
begin
  select roles into couloirs from public.processus where id = new.processus_id;

  foreach manquant in array array[new.role, new.role2] loop
    if manquant <> '' and not (manquant = any (couloirs)) then
      raise exception
        'le rôle « % » n''est pas un couloir du processus (étape %)', manquant, new.ordre
        using errcode = 'check_violation';
    end if;
  end loop;
  return new;
end $$;

create constraint trigger etapes_roles_couvrent
  after insert or update on etapes
  deferrable initially deferred
  for each row execute function verifier_roles_couloirs();

-- ============================================================================
-- Lecture — le client complet, au format d'export JSON de l'application
--
-- Une seule requête pour peupler l'écran, et le format est exactement celui que
-- `importer_client_json` sait relire : l'aller-retour est fermé. C'est aussi ce
-- qui est enregistré dans `versions.contenu`.
--
-- Les frictions y portent l'ORDRE de leur étape, jamais son uuid : les
-- identifiants ne survivent pas à un import, l'ordre si.
-- ============================================================================
create or replace function client_json(p_code text) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'format', 'diagnostic-os',
    'version', 1,
    'exporte_le', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'client', jsonb_build_object(
      'code', c.code,
      'nom', c.nom,
      'site', c.site,
      'date_visite', c.date_visite,
      'notes', c.notes,
      'outils', to_jsonb(c.outils),
      'si', coalesce(c.si, '{}'::jsonb),
      'processus', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'code', p.code,
            'nom', p.nom,
            'soustitre', p.soustitre,
            'rang', p.rang,
            'use_case', p.use_case,
            'maturite', p.maturite,
            'maturite_note', p.maturite_note,
            'maturite_bilan', p.maturite_bilan,
            'maturite_bilan_note', p.maturite_bilan_note,
            'roles', to_jsonb(p.roles),
            'etapes', coalesce((
              select jsonb_agg(jsonb_build_object(
                       'ordre', e.ordre,
                       'role', e.role,
                       'role2', e.role2,
                       'phase', e.phase,
                       'texte', e.texte,
                       'supports', e.supports,
                       'lien', e.lien,
                       'bilan', e.bilan
                     ) order by e.ordre)
                from public.etapes e where e.processus_id = p.id), '[]'::jsonb),
            'frictions', coalesce((
              select jsonb_agg(jsonb_build_object(
                       'rang', f.rang,
                       'role', f.role,
                       'texte', f.texte,
                       'etape', (select e.ordre from public.etapes e where e.id = f.etape_id)
                     ) order by f.rang)
                from public.frictions f where f.processus_id = p.id), '[]'::jsonb),
            'chiffres', coalesce((
              select jsonb_agg(jsonb_build_object('rang', x.rang, 'valeur', x.valeur, 'libelle', x.libelle) order by x.rang)
                from public.chiffres x where x.processus_id = p.id), '[]'::jsonb)
          ) order by p.rang
        )
        from public.processus p where p.client_id = c.id), '[]'::jsonb)
    )
  )
  from public.clients c
  where c.code = p_code;
$$;

-- ============================================================================
-- Import — relit le format ci-dessus, en création ou en écrasement
--
-- `p_cible` nul : crée un diagnostic, en dérivant un `code` libre (`-2`, `-3`…)
-- si celui du fichier est déjà pris. `p_cible` renseigné : ÉCRASE ce
-- diagnostic, après avoir pris un instantané `avant_injection`.
--
-- La fonction ne fait jamais confiance au fichier. Elle renumérote les rangs et
-- les ordres sur l'index de parcours, écarte les entrées mal typées, borne les
-- maturités à 1..5, rejette une clef de use case ou une marque de bilan
-- inconnue (mise à `null` plutôt que refusée), et surtout : elle EFFACE un rôle
-- d'étape qui n'est pas un couloir déclaré du processus, plutôt que de laisser
-- le trigger refuser tout l'import.
-- ============================================================================
create or replace function importer_client_json(p_payload jsonb, p_cible uuid default null)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  c        jsonb;
  v_id     uuid;
  v_code   text;
  v_base   text;
  v_n      int := 2;
  v_outils text[];
  v_roles  text[];
  p        jsonb;
  e        jsonb;
  f        jsonb;
  x        jsonb;
  v_proc   uuid;
  i_p      int := 0;
  i_e      int;
  i_f      int;
  i_x      int;
  v_role   text;
  v_role2  text;
  v_etape  uuid;
  v_cle    text;
  v_mat    int;
  v_matb   int;
  v_uc     text;
  v_bilan  text;
  v_ordres jsonb;
  v_etape_id uuid;
begin
  c := p_payload -> 'client';
  if c is null or jsonb_typeof(c) <> 'object' then
    raise exception 'fichier invalide : la clef « client » est absente' using errcode = 'check_violation';
  end if;
  if coalesce(c ->> 'nom', '') = '' then
    raise exception 'fichier invalide : le nom du client est absent' using errcode = 'check_violation';
  end if;
  if c ? 'processus' and jsonb_typeof(c -> 'processus') <> 'array' then
    raise exception 'fichier invalide : « processus » doit être une liste' using errcode = 'check_violation';
  end if;

  select coalesce(array_agg(t), '{}'::text[]) into v_outils
    from jsonb_array_elements_text(
      case when jsonb_typeof(c -> 'outils') = 'array' then c -> 'outils' else '[]'::jsonb end
    ) as t;

  if p_cible is not null then
    select id, code into v_id, v_code from public.clients where id = p_cible;
    if v_id is null then
      raise exception 'diagnostic cible introuvable' using errcode = 'check_violation';
    end if;
    perform public.prendre_version(v_id, 'avant_injection', '');
    delete from public.processus where client_id = v_id;
    update public.clients
       set nom = c ->> 'nom',
           site = coalesce(c ->> 'site', ''),
           date_visite = coalesce(c ->> 'date_visite', ''),
           notes = coalesce(c ->> 'notes', ''),
           outils = v_outils,
           si = case when jsonb_typeof(c -> 'si') = 'object' then c -> 'si' else null end,
           version = version + 1,
           maj_le = now()
     where id = v_id;
  else
    v_base := coalesce(nullif(c ->> 'code', ''), 'diagnostic');
    v_code := v_base;
    while exists (select 1 from public.clients where code = v_code) loop
      v_code := v_base || '-' || v_n;
      v_n := v_n + 1;
    end loop;
    insert into public.clients (code, nom, site, date_visite, notes, outils, si)
    values (
      v_code,
      c ->> 'nom',
      coalesce(c ->> 'site', ''),
      coalesce(c ->> 'date_visite', ''),
      coalesce(c ->> 'notes', ''),
      v_outils,
      case when jsonb_typeof(c -> 'si') = 'object' then c -> 'si' else null end
    )
    returning id into v_id;
  end if;

  for p in
    select value from jsonb_array_elements(
      case when jsonb_typeof(c -> 'processus') = 'array' then c -> 'processus' else '[]'::jsonb end
    )
  loop
    if jsonb_typeof(p) <> 'object' then
      continue;
    end if;

    i_p := i_p + 1;

    select coalesce(array_agg(t), '{}'::text[]) into v_roles
      from jsonb_array_elements_text(
        case when jsonb_typeof(p -> 'roles') = 'array' then p -> 'roles' else '[]'::jsonb end
      ) as t
     where t <> '';

    v_mat := null;
    if jsonb_typeof(p -> 'maturite') = 'number' then
      v_mat := (p ->> 'maturite')::numeric::int;
    elsif jsonb_typeof(p -> 'maturite') = 'string' and (p ->> 'maturite') ~ '^\d+$' then
      v_mat := (p ->> 'maturite')::int;
    end if;
    if v_mat is not null and (v_mat < 1 or v_mat > 5) then
      v_mat := null;
    end if;

    v_matb := null;
    if jsonb_typeof(p -> 'maturite_bilan') = 'number' then
      v_matb := (p ->> 'maturite_bilan')::numeric::int;
    elsif jsonb_typeof(p -> 'maturite_bilan') = 'string' and (p ->> 'maturite_bilan') ~ '^\d+$' then
      v_matb := (p ->> 'maturite_bilan')::int;
    end if;
    if v_matb is not null and (v_matb < 1 or v_matb > 5) then
      v_matb := null;
    end if;

    v_uc := nullif(lower(trim(coalesce(p ->> 'use_case', ''))), '');
    if v_uc is not null and v_uc not in ('uc1','uc2','uc3','uc4','uc5','uc6','uc7','uc8','uc9','uc10') then
      v_uc := null;
    end if;

    insert into public.processus (client_id, code, nom, soustitre, roles, rang, use_case, maturite, maturite_note, maturite_bilan, maturite_bilan_note)
    values (
      v_id,
      coalesce(nullif(p ->> 'code', ''), 'processus-' || i_p),
      coalesce(nullif(p ->> 'nom', ''), 'Processus ' || i_p),
      coalesce(p ->> 'soustitre', ''),
      v_roles,
      i_p,
      v_uc,
      v_mat,
      coalesce(p ->> 'maturite_note', ''),
      v_matb,
      coalesce(p ->> 'maturite_bilan_note', '')
    )
    returning id into v_proc;

    v_ordres := '{}'::jsonb;
    i_e := 0;
    for e in
      select value from jsonb_array_elements(
        case when jsonb_typeof(p -> 'etapes') = 'array' then p -> 'etapes' else '[]'::jsonb end
      )
    loop
      if jsonb_typeof(e) <> 'object' then
        continue;
      end if;
      i_e := i_e + 1;
      v_role  := coalesce(e ->> 'role', '');
      v_role2 := coalesce(e ->> 'role2', '');
      if v_role <> '' and not (v_role = any (v_roles)) then v_role := ''; end if;
      if v_role2 <> '' and not (v_role2 = any (v_roles)) then v_role2 := ''; end if;

      v_bilan := nullif(lower(trim(coalesce(e ->> 'bilan', ''))), '');
      if v_bilan is not null and v_bilan not in ('mercateam','inchangee','supprimee') then
        v_bilan := null;
      end if;

      insert into public.etapes (processus_id, ordre, role, role2, texte, phase, supports, lien, bilan)
      values (
        v_proc, i_e, v_role, v_role2,
        coalesce(e ->> 'texte', ''),
        coalesce(e ->> 'phase', ''),
        coalesce(e ->> 'supports', ''),
        coalesce(e ->> 'lien', ''),
        v_bilan
      )
      returning id into v_etape;
      v_ordres := v_ordres || jsonb_build_object(i_e::text, v_etape::text);
    end loop;

    i_f := 0;
    for f in
      select value from jsonb_array_elements(
        case when jsonb_typeof(p -> 'frictions') = 'array' then p -> 'frictions' else '[]'::jsonb end
      )
    loop
      if jsonb_typeof(f) <> 'object' or coalesce(f ->> 'texte', '') = '' then
        continue;
      end if;
      i_f := i_f + 1;

      v_etape_id := null;
      v_cle := null;
      if jsonb_typeof(f -> 'etape') = 'number' then
        v_cle := ((f ->> 'etape')::numeric::int)::text;
      elsif jsonb_typeof(f -> 'etape') = 'string' and (f ->> 'etape') ~ '^\d+$' then
        v_cle := ((f ->> 'etape')::int)::text;
      end if;
      if v_cle is not null and v_ordres ? v_cle then
        v_etape_id := (v_ordres ->> v_cle)::uuid;
      end if;

      insert into public.frictions (processus_id, rang, role, texte, etape_id)
      values (v_proc, i_f, coalesce(nullif(f ->> 'role', ''), 'Transverse'), f ->> 'texte', v_etape_id);
    end loop;

    i_x := 0;
    for x in
      select value from jsonb_array_elements(
        case when jsonb_typeof(p -> 'chiffres') = 'array' then p -> 'chiffres' else '[]'::jsonb end
      )
    loop
      if jsonb_typeof(x) <> 'object'
         or (coalesce(x ->> 'valeur', '') = '' and coalesce(x ->> 'libelle', '') = '') then
        continue;
      end if;
      i_x := i_x + 1;
      insert into public.chiffres (processus_id, rang, valeur, libelle)
      values (v_proc, i_x, coalesce(x ->> 'valeur', ''), coalesce(x ->> 'libelle', ''));
    end loop;
  end loop;

  return jsonb_build_object('id', v_id, 'code', coalesce(v_code, (select code from public.clients where id = v_id)));
end $$;

-- ============================================================================
-- Versions — prise, liste, restauration
-- ============================================================================

-- Un instantané. Le motif `quotidien` est idempotent dans la journée : il ne
-- prend rien s'il en existe déjà un aujourd'hui, pour qu'une session d'édition
-- ne produise pas cinquante versions.
create or replace function prendre_version(p_client_id uuid, p_motif text, p_libelle text default '')
returns uuid
language plpgsql
set search_path = public
as $$
declare
  c public.clients%rowtype;
  v_doc jsonb;
  v_id uuid;
begin
  select * into c from public.clients where id = p_client_id;
  if c.id is null then
    return null;
  end if;

  if p_motif = 'quotidien' and exists (
    select 1 from public.versions
     where client_id = p_client_id
       and motif = 'quotidien'
       and cree_le >= date_trunc('day', now())
       and cree_le <  date_trunc('day', now()) + interval '1 day'
  ) then
    return null;
  end if;

  v_doc := public.client_json(c.code);
  if v_doc is null then
    return null;
  end if;

  insert into public.versions (client_id, code_client, nom_client, contenu, motif, libelle, auteur)
  values (c.id, c.code, c.nom, v_doc, p_motif, coalesce(p_libelle, ''), auth.jwt() ->> 'email')
  returning id into v_id;

  return v_id;
end $$;

-- Liste sans rapatrier les contenus : `versions.contenu` pèse, et le panneau
-- n'a besoin que des compteurs. Ils sont lus dans le JSON, pas recalculés.
create or replace function versions_liste(p_client_id uuid, p_limite integer default 20)
returns table (
  id uuid, client_id uuid, code_client text, nom_client text, motif text,
  libelle text, auteur text, cree_le timestamptz, octets integer,
  nb_processus integer, nb_etapes integer, nb_frictions integer, nb_chiffres integer
)
language sql stable
set search_path = public
as $$
  select v.id, v.client_id, v.code_client, v.nom_client, v.motif, v.libelle, v.auteur, v.cree_le,
         octet_length(v.contenu::text) as octets,
         coalesce(jsonb_array_length(v.contenu -> 'client' -> 'processus'), 0) as nb_processus,
         coalesce((select sum(jsonb_array_length(p -> 'etapes'))
                     from jsonb_array_elements(coalesce(v.contenu -> 'client' -> 'processus', '[]'::jsonb)) p), 0)::int as nb_etapes,
         coalesce((select sum(jsonb_array_length(p -> 'frictions'))
                     from jsonb_array_elements(coalesce(v.contenu -> 'client' -> 'processus', '[]'::jsonb)) p), 0)::int as nb_frictions,
         coalesce((select sum(jsonb_array_length(p -> 'chiffres'))
                     from jsonb_array_elements(coalesce(v.contenu -> 'client' -> 'processus', '[]'::jsonb)) p), 0)::int as nb_chiffres
    from public.versions v
   where v.client_id = p_client_id
   order by v.cree_le desc
   limit greatest(p_limite, 0);
$$;

-- Restauration. Si le client existe encore, on prend un instantané
-- `avant_restauration` puis on l'écrase — la restauration est donc elle-même
-- annulable. S'il a été supprimé, on recrée un diagnostic à partir du contenu.
create or replace function restaurer_version(p_version_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v public.versions%rowtype;
  v_existe boolean;
begin
  select * into v from public.versions where id = p_version_id;
  if v.id is null then
    raise exception 'version introuvable' using errcode = 'check_violation';
  end if;

  select exists (select 1 from public.clients where id = v.client_id) into v_existe;

  if v_existe then
    perform public.prendre_version(v.client_id, 'avant_restauration', '');
    return public.importer_client_json(v.contenu, v.client_id);
  else
    return public.importer_client_json(v.contenu, null);
  end if;
end $$;

-- ============================================================================
-- Réordonnancement des étapes
--
-- Deux raisons de passer par une fonction plutôt que par des écritures directes.
--
-- 1. `etapes_ordre_unique` est différée, donc vérifiée au commit — mais
--    PostgREST met CHAQUE requête HTTP dans sa propre transaction. Déplacer une
--    étape en enchaînant plusieurs UPDATE échoue dès la première collision
--    d'ordre. Ici tout tient dans un seul appel, donc une seule transaction.
--
-- 2. Le contournement tentant — envoyer toutes les lignes en un `upsert` — est
--    pire que le mal. PostgREST remplit les colonnes absentes du corps par leur
--    DEFAULT : un upsert `{id, ordre}` remet `texte`, `role`, `phase` et
--    `supports` à la chaîne vide, sur toutes les lignes, sans rien signaler.
--    Cette fonction ne touche que `ordre`, elle ne peut pas effacer un contenu.
--
-- `p_ids` est la liste complète des étapes du processus, dans l'ordre voulu.
-- Toute liste partielle est refusée : elle laisserait des trous ou des doublons.
-- ============================================================================
create or replace function reordonner_etapes(p_processus uuid, p_ids uuid[])
returns integer
language plpgsql
-- Chemin de recherche figé : sans lui, un schéma placé devant `public` par
-- l'appelant pourrait substituer sa propre table `etapes`. Le linter Supabase
-- le signale à juste titre. Toutes les fonctions de ce fichier le font.
set search_path = public
as $$
declare
  n_base integer;
  n_fournis integer := coalesce(array_length(p_ids, 1), 0);
  n_touchees integer;
begin
  select count(*) into n_base from etapes where processus_id = p_processus;

  if n_base <> n_fournis then
    raise exception
      'reordonner_etapes : % étape(s) en base, % fournie(s) — la liste doit être complète',
      n_base, n_fournis using errcode = 'check_violation';
  end if;

  /* `with ordinality` : l'ordre du tableau fait foi. Sans lui, l'ordre de
     `unnest` n'est pas garanti et le classement serait arbitraire. */
  update etapes e
     set ordre = v.rang
    from unnest(p_ids) with ordinality as v(id, rang)
   where e.id = v.id and e.processus_id = p_processus;

  get diagnostics n_touchees = row_count;

  if n_touchees <> n_fournis then
    raise exception
      'reordonner_etapes : % ligne(s) touchée(s) pour % identifiant(s) — un identifiant est inconnu ou appartient à un autre processus',
      n_touchees, n_fournis using errcode = 'check_violation';
  end if;

  return n_touchees;
end $$;

-- ============================================================================
-- Visibilité — réservée au domaine Mercateam
--
-- L'accès n'est plus « tout utilisateur authentifié » : il est restreint aux
-- adresses `@merca.team`, lues dans le JWT. La connexion passe par un
-- fournisseur OAuth qui accepte n'importe quelle adresse ; sans ce filtre, un
-- compte extérieur authentifié verrait tous les diagnostics. Les données
-- nomment des personnes et des constats sur des sites clients.
--
-- Une politique unique `for all` par table : lecture et écriture ouvertes à
-- l'intérieur du domaine, sans cloisonnement entre consultants — cela reproduit
-- le drive partagé actuel.
-- ============================================================================
create or replace function est_mercateam() returns boolean
language sql stable
set search_path = public
as $$
  select split_part(lower(coalesce(auth.jwt() ->> 'email', '')), '@', 2) = 'merca.team';
$$;

alter table clients   enable row level security;
alter table processus enable row level security;
alter table etapes    enable row level security;
alter table frictions enable row level security;
alter table chiffres  enable row level security;
alter table versions  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['clients', 'processus', 'etapes', 'frictions', 'chiffres', 'versions'] loop
    execute format(
      'create policy %I on %I for all to authenticated using (est_mercateam()) with check (est_mercateam())',
      'acces_consultants_' || t, t);
  end loop;
end $$;

-- Les fonctions sont SECURITY INVOKER : l'exécution est ouverte, mais tout ce
-- qu'elles touchent reste filtré par les politiques ci-dessus. C'est le
-- comportement par défaut de PostgreSQL, rappelé ici parce qu'il est le seul
-- qui rende ces `grant` sans danger.
grant execute on function client_json(text)                       to authenticated;
grant execute on function importer_client_json(jsonb, uuid)       to authenticated;
grant execute on function prendre_version(uuid, text, text)       to authenticated;
grant execute on function versions_liste(uuid, integer)           to authenticated;
grant execute on function restaurer_version(uuid)                 to authenticated;
grant execute on function reordonner_etapes(uuid, uuid[])         to authenticated;
