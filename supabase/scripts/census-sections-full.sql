-- =============================================================================
-- Census / PostGIS — ejecutar TODO este archivo en Supabase SQL Editor (una vez)
-- Tras OK: node --env-file=.env.local scripts/jobs/import-census-seed.mjs
-- Combina: 20251019140000_census_sections + 20251019140100_census_sections_repair
-- Orden: extensión → tabla → RLS → funciones → grants
-- =============================================================================

-- 1) PostGIS
create extension if not exists postgis with schema extensions;

-- 2) Tabla (obligatoria antes de crear funciones que la referencian)
create table if not exists public.census_sections (
  cusec text primary key,
  province_code text not null,
  municipality_name text,
  section_name text,
  postal_codes text[] not null default '{}',
  metrics jsonb not null default '{}'::jsonb,
  metrics_year int,
  source_url text,
  geom geography(Geometry, 4326) not null,
  updated_at timestamptz not null default now()
);

create index if not exists census_sections_geom_idx
  on public.census_sections using gist (geom);

alter table public.census_sections enable row level security;

drop policy if exists census_sections_read on public.census_sections;
create policy census_sections_read on public.census_sections
  for select to authenticated using (true);

drop policy if exists census_sections_read_anon on public.census_sections;
create policy census_sections_read_anon on public.census_sections
  for select to anon using (true);

grant select on public.census_sections to anon;

-- 3) Funciones (schema extensions para ST_*)
create or replace function public.census_for_listing(p_listing_id uuid)
returns table (
  cusec text,
  section_name text,
  metrics jsonb,
  metrics_year int,
  source_url text
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with listing_row as (
    select id, geom, postal_code
    from public.listings
    where id = p_listing_id
    limit 1
  ),
  by_geom as (
    select cs.cusec, cs.section_name, cs.metrics, cs.metrics_year, cs.source_url
    from public.census_sections cs
    join listing_row l on l.geom is not null
    where extensions.st_covers(cs.geom, l.geom)
    order by extensions.st_area(cs.geom) asc
    limit 1
  ),
  by_postal as (
    select cs.cusec, cs.section_name, cs.metrics, cs.metrics_year, cs.source_url
    from public.census_sections cs
    join listing_row l on l.postal_code is not null
    where l.postal_code = any (cs.postal_codes)
    limit 1
  )
  select * from by_geom
  union all
  select * from by_postal
  where not exists (select 1 from by_geom)
  limit 1;
$$;

create or replace function public.census_sections_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  max_features int default 150
)
returns table (
  cusec text,
  section_name text,
  metrics_year int,
  geojson jsonb
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    cs.cusec,
    cs.section_name,
    cs.metrics_year,
    extensions.st_asgeojson(cs.geom)::jsonb as geojson
  from public.census_sections cs
  where extensions.st_intersects(
    cs.geom,
    extensions.st_setsrid(
      extensions.st_makeenvelope(min_lng, min_lat, max_lng, max_lat),
      4326
    )::geography
  )
  limit greatest(1, least(max_features, 500));
$$;

create or replace function public.upsert_census_section_geom(
  p_cusec text,
  p_province_code text,
  p_municipality_name text,
  p_section_name text,
  p_postal_codes text[],
  p_metrics jsonb,
  p_metrics_year int,
  p_source_url text,
  p_geojson text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.census_sections (
    cusec, province_code, municipality_name, section_name,
    postal_codes, metrics, metrics_year, source_url, geom, updated_at
  )
  values (
    p_cusec,
    p_province_code,
    p_municipality_name,
    p_section_name,
    coalesce(p_postal_codes, '{}'),
    coalesce(p_metrics, '{}'::jsonb),
    p_metrics_year,
    p_source_url,
    extensions.st_setsrid(extensions.st_geomfromgeojson(p_geojson), 4326)::geography,
    now()
  )
  on conflict (cusec) do update set
    province_code = excluded.province_code,
    municipality_name = excluded.municipality_name,
    section_name = excluded.section_name,
    postal_codes = excluded.postal_codes,
    metrics = excluded.metrics,
    metrics_year = excluded.metrics_year,
    source_url = excluded.source_url,
    geom = excluded.geom,
    updated_at = now();
end;
$$;

-- 4) Permisos
grant execute on function public.census_for_listing(uuid) to authenticated, anon;
grant execute on function public.census_sections_in_bbox(double precision, double precision, double precision, double precision, int)
  to authenticated, anon;
grant execute on function public.upsert_census_section_geom(
  text, text, text, text, text[], jsonb, int, text, text
) to service_role;
