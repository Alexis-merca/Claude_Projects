-- ============================================================================
-- Diagnostic OS — schéma de la base partagée
--
-- Cible : PostgreSQL 16 / Supabase.
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

  -- Environnement IT : domaines, classement des outils, missions, liens.
  -- Structure souple, éditée d'un bloc et jamais ligne à ligne — ce n'est pas
  -- un point de contention entre consultants, le jsonb suffit.
  si          jsonb,

  version     integer not null default 1,
  cree_le     timestamptz not null default now(),
  maj_le      timestamptz not null default now(),

  constraint clients_code_non_vide check (code <> ''),
  constraint clients_nom_non_vide  check (nom  <> '')
);

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
  -- l'invariant est vérifié par `processus_roles_couvrent_etapes()`.
  roles      text[] not null default '{}',

  rang       integer not null default 1,   -- ordre des onglets
  version    integer not null default 1,
  cree_le    timestamptz not null default now(),
  maj_le     timestamptz not null default now(),

  unique (client_id, code),
  constraint processus_code_non_vide check (code <> '')
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

  constraint etapes_lien_connu check (lien in ('', 'manuel', 'auto')),
  constraint etapes_ordre_positif check (ordre >= 1),

  -- Différée : un réordonnancement passe par des positions transitoirement en
  -- double, et doit pouvoir se faire en une transaction sans gymnastique.
  constraint etapes_ordre_unique unique (processus_id, ordre) deferrable initially deferred
);

create index etapes_processus_idx on etapes (processus_id, ordre);

-- ----------------------------------------------------------------------------
-- Frictions et chiffres clés
-- ----------------------------------------------------------------------------
create table frictions (
  id           uuid primary key default gen_random_uuid(),
  processus_id uuid not null references processus(id) on delete cascade,
  rang         integer not null,
  role         text not null default 'Transverse',
  texte        text not null,

  constraint frictions_texte_non_vide check (texte <> '')
);

create index frictions_processus_idx on frictions (processus_id, rang);

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

-- ============================================================================
-- Version et horodatage
-- ============================================================================

create or replace function toucher_version() returns trigger
language plpgsql as $$
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
language plpgsql as $$
declare cible uuid;
begin
  cible := coalesce(new.processus_id, old.processus_id);
  update processus
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
language plpgsql as $$
declare
  manquant text;
  couloirs text[];
begin
  select roles into couloirs from processus where id = new.processus_id;

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
-- Lecture — le client complet, au format de l'export JSON de l'application
-- Une seule requête pour peupler l'écran, et le format est exactement celui
-- que `clientsDuJson()` sait relire.
-- ============================================================================
create or replace function client_json(p_code text) returns jsonb
language sql stable as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id',    c.code,
    'nom',   c.nom,
    'site',  c.site,
    'date',  c.date_visite,
    'notes', c.notes,
    'outils', to_jsonb(c.outils),
    'si',    c.si,
    'processus', coalesce((
      select jsonb_agg(bloc order by p.rang)
        from processus p
        cross join lateral (
          select jsonb_build_object(
            'id',        p.code,
            'nom',       p.nom,
            'soustitre', p.soustitre,
            'roles',     to_jsonb(p.roles),
            'etapes', coalesce((
              select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                       'ordre', e.ordre,
                       'role',  e.role,
                       'role2', nullif(e.role2, ''),
                       'texte', e.texte,
                       'phase', e.phase,
                       'supports', nullif(e.supports, ''),
                       'lien',     nullif(e.lien, '')
                     )) order by e.ordre)
                from etapes e where e.processus_id = p.id), '[]'::jsonb),
            'frictions', coalesce((
              select jsonb_agg(jsonb_build_object('role', f.role, 'texte', f.texte) order by f.rang)
                from frictions f where f.processus_id = p.id), '[]'::jsonb),
            'chiffres', coalesce((
              select jsonb_agg(jsonb_build_object('valeur', x.valeur, 'libelle', x.libelle) order by x.rang)
                from chiffres x where x.processus_id = p.id), '[]'::jsonb)
          ) as bloc
        ) as _
       where p.client_id = c.id), '[]'::jsonb)
  ))
  from clients c
  where c.code = p_code;
$$;

-- ============================================================================
-- Visibilité — tout le monde voit tout, pourvu d'être authentifié.
-- Reproduit le drive partagé actuel. `authenticated` et non `anon` : les
-- données nomment des personnes et des constats sur des sites clients, elles
-- sont partagées en interne et non ouvertes au web.
-- ============================================================================
alter table clients   enable row level security;
alter table processus enable row level security;
alter table etapes    enable row level security;
alter table frictions enable row level security;
alter table chiffres  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['clients', 'processus', 'etapes', 'frictions', 'chiffres'] loop
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true)',
      'acces_consultants_' || t, t);
  end loop;
end $$;
