-- Pegar en SQL Editor (Supabase) — migraciones 202510171800–820 en un solo bloque.

-- === 20251017180000_geocode_and_map_requests.sql ===
create table if not exists public.geocode_cache (
  query_key text primary key,
  lon double precision not null,
  lat double precision not null,
  source text not null default 'nominatim',
  fetched_at timestamptz not null default now()
);

create table if not exists public.geocode_pending (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  reason text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_map_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  min_lng double precision not null,
  min_lat double precision not null,
  max_lng double precision not null,
  max_lat double precision not null,
  note text,
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz
);

create index if not exists user_map_requests_created_idx
  on public.user_map_requests (created_at desc);

grant execute on function public.listings_in_polygon to authenticated, anon;

alter table public.geocode_cache enable row level security;
alter table public.geocode_pending enable row level security;
alter table public.user_map_requests enable row level security;

drop policy if exists geocode_cache_read on public.geocode_cache;
create policy geocode_cache_read on public.geocode_cache for select using (true);
drop policy if exists geocode_pending_service on public.geocode_pending;
create policy geocode_pending_service on public.geocode_pending for all using (true);
drop policy if exists user_map_requests_insert on public.user_map_requests;
create policy user_map_requests_insert on public.user_map_requests
  for insert with check (auth.uid() = user_id or user_id is null);
drop policy if exists user_map_requests_read_own on public.user_map_requests;
create policy user_map_requests_read_own on public.user_map_requests
  for select using (auth.uid() = user_id or user_id is null);

-- === 20251017181000_residential_map_filter.sql ===
create or replace function public.map_listings_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  max_rows int default 500
)
returns table (
  id uuid,
  price numeric,
  roi_gross numeric,
  lng double precision,
  lat double precision,
  geocode_quality int,
  rent_confidence text
)
language sql
stable
as $$
  select
    l.id,
    l.price,
    li.roi_gross,
    st_x(l.geom::geometry) as lng,
    st_y(l.geom::geometry) as lat,
    l.geocode_quality,
    li.rent_confidence
  from public.listings l
  left join public.listing_investment li on li.listing_id = l.id
  where l.geom is not null
    and l.operation = 'sale'
    and l.status = 'active'
    and coalesce(l.property_kind, '') not in ('garaje', 'trastero', 'local', 'parking', 'oficina', 'nave', 'terreno')
    and st_intersects(
      l.geom::geometry,
      st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    )
  order by li.roi_gross desc nulls last
  limit max_rows;
$$;

create or replace function public.listings_in_polygon(geojson text)
returns table (id uuid)
language sql
stable
as $$
  select l.id
  from public.listings l
  where l.geom is not null
    and l.operation = 'sale'
    and l.status in ('active', 'demo')
    and coalesce(l.property_kind, '') not in ('garaje', 'trastero', 'local', 'parking', 'oficina', 'nave', 'terreno')
    and st_within(
      l.geom::geometry,
      st_setsrid(st_geomfromgeojson(geojson), 4326)
    );
$$;

grant execute on function public.listings_in_polygon to service_role, authenticated, anon;

-- === 20251017182000_coverage_counts_and_dedup.sql ===
alter table public.coverage_regions
  add column if not exists sale_count int not null default 0,
  add column if not exists rent_count int not null default 0;

create index if not exists listings_dedup_scan_idx
  on public.listings (postal_code, operation, status)
  where status = 'active';

update public.coverage_regions set tier = 1 where slug in ('castellon', 'alicante');

grant select on public.coverage_regions to anon;
