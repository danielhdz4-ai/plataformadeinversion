-- =============================================================================
-- Migraciones ops — ejecutar en Supabase SQL Editor (después de census-sections-full.sql)
-- Incluye: rent_benchmarks (20251019120000) + zone_ingest (20251019160000)
-- =============================================================================

-- --- rent_benchmarks ---
create table if not exists public.rent_benchmarks (
  city_slug text primary key,
  eur_per_sqm_month numeric not null check (eur_per_sqm_month > 0),
  sample_count int not null default 0 check (sample_count >= 0),
  computed_at timestamptz not null default now()
);

alter table public.rent_benchmarks enable row level security;

drop policy if exists rent_benchmarks_read on public.rent_benchmarks;
create policy rent_benchmarks_read on public.rent_benchmarks
  for select to authenticated using (true);

grant select on public.rent_benchmarks to anon;

-- --- zone ingest ---
alter table public.listings
  add column if not exists last_seen_at timestamptz;

create index if not exists listings_last_seen_idx
  on public.listings (last_seen_at)
  where status = 'active';

create table if not exists public.zone_ingest_runs (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid references public.scans (id) on delete set null,
  zone_slugs text[] not null default '{}',
  status text not null default 'running'
    check (status in ('running', 'completed', 'partial', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  listings_fetched int not null default 0,
  listings_upserted int not null default 0,
  in_polygon_after int,
  portals text[] not null default '{}',
  error_message text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists zone_ingest_runs_scan_idx on public.zone_ingest_runs (scan_id);

create table if not exists public.listing_zone_presence (
  zone_slug text not null,
  listing_id uuid not null references public.listings (id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (zone_slug, listing_id)
);

create index if not exists listing_zone_presence_listing_idx
  on public.listing_zone_presence (listing_id);

alter table public.zone_ingest_runs enable row level security;
alter table public.listing_zone_presence enable row level security;

drop policy if exists zone_ingest_runs_service on public.zone_ingest_runs;
create policy zone_ingest_runs_service on public.zone_ingest_runs
  for all to service_role using (true) with check (true);

drop policy if exists listing_zone_presence_service on public.listing_zone_presence;
create policy listing_zone_presence_service on public.listing_zone_presence
  for all to service_role using (true) with check (true);

create or replace function public.archive_stale_listings_in_polygon(
  p_geojson text,
  p_ingest_started_at timestamptz
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  with targets as (
    select l.id
    from public.listings l
    where l.id in (select id from public.listings_in_polygon(p_geojson))
      and l.status = 'active'
      and l.operation = 'sale'
      and l.source_portal in ('fotocasa', 'pisos_com', 'kelify', 'habitaclia')
      and l.last_seen_at is not null
      and l.last_seen_at < p_ingest_started_at
  )
  update public.listings l
  set status = 'archived'
  from targets t
  where l.id = t.id;

  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.archive_stale_listings_in_polygon(text, timestamptz) to service_role;
