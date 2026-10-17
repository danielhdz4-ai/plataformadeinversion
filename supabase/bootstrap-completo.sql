-- =============================================================================
-- PLATAFORMA DE INVERSIÓN — Bootstrap completo (Supabase SQL Editor)
-- Proyecto: bwxyskymbgyaidhubhnt
-- Ejecutar UNA VEZ en: Dashboard → SQL → New query → Run
-- Tras ejecutar, espera ~30 s o recarga el schema (API) y comprueba /api/health
-- =============================================================================

-- Extensiones
create extension if not exists postgis with schema extensions;
create extension if not exists postgis;
create extension if not exists pgcrypto with schema extensions;

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Tax rules
create table if not exists public.tax_rules (
  ccaa text primary key,
  itp_pct numeric not null,
  ajd_pct numeric not null default 0
);

insert into public.tax_rules (ccaa, itp_pct, ajd_pct) values
  ('Cataluña', 10, 1.5),
  ('Comunidad de Madrid', 6, 0.75),
  ('Andalucía', 7, 1.2),
  ('Comunitat Valenciana', 10, 1.5)
on conflict (ccaa) do nothing;

-- Listings
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  source_portal text not null,
  source_external_id text not null,
  operation text not null check (operation in ('sale', 'rent')),
  title text,
  price numeric not null,
  sqm numeric,
  bedrooms int,
  bathrooms int,
  postal_code text,
  city text,
  ccaa text,
  source_url text not null,
  thumbnail_url text,
  geom geography(point, 4326),
  geocode_quality int not null default 1,
  property_kind text,
  status text not null default 'active' check (status in ('active', 'archived', 'demo')),
  scraped_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (source_portal, source_external_id)
);

create index if not exists listings_geom_idx on public.listings using gist (geom);
create index if not exists listings_operation_status_idx on public.listings (operation, status);

create table if not exists public.listing_enrichment (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  rc text,
  catastral_surface numeric,
  year_built int,
  raw jsonb default '{}'::jsonb
);

create table if not exists public.listing_investment (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  rent_est numeric,
  rent_confidence text,
  comparables_count int not null default 0,
  roi_gross numeric,
  computed_at timestamptz
);

create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  polygon jsonb not null,
  filters jsonb not null default '{}'::jsonb,
  operation text not null default 'buy_to_rent',
  progress_pct int not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.scan_results (
  scan_id uuid not null references public.scans (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  rank int not null,
  roi_gross numeric,
  primary key (scan_id, listing_id)
);

create table if not exists public.saved_deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, listing_id)
);

create table if not exists public.coverage_regions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  tier int not null default 1,
  bbox jsonb,
  last_scrape_at timestamptz
);

create table if not exists public.scrape_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  city_slug text,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  listings_inserted int default 0,
  error_message text
);

create table if not exists public.official_market_stats (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  geo_level text not null,
  geo_code text not null,
  geo_name text,
  period text not null,
  metrics jsonb not null default '{}'::jsonb,
  source_url text,
  file_hash text,
  scraped_at timestamptz not null default now(),
  unique (source, geo_level, geo_code, period)
);

create table if not exists public.catastro_cache (
  cache_key text primary key,
  rc text,
  payload jsonb,
  fetched_at timestamptz not null default now()
);

create table if not exists public.notary_stats (
  postal_code text not null,
  period text not null,
  price_m2 numeric,
  avg_price numeric,
  avg_surface numeric,
  operations_count int,
  es_estimado boolean default false,
  source_url text,
  raw jsonb,
  scraped_at timestamptz not null default now(),
  primary key (postal_code, period)
);

-- RLS
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_enrichment enable row level security;
alter table public.listing_investment enable row level security;
alter table public.scans enable row level security;
alter table public.scan_results enable row level security;
alter table public.saved_deals enable row level security;
alter table public.tax_rules enable row level security;
alter table public.coverage_regions enable row level security;
alter table public.official_market_stats enable row level security;
alter table public.catastro_cache enable row level security;
alter table public.notary_stats enable row level security;

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for all using (auth.uid() = id);

drop policy if exists listings_read on public.listings;
create policy listings_read on public.listings for select to authenticated
  using (status in ('active', 'demo'));

drop policy if exists listing_enrichment_read on public.listing_enrichment;
create policy listing_enrichment_read on public.listing_enrichment for select to authenticated using (true);

drop policy if exists listing_investment_read on public.listing_investment;
create policy listing_investment_read on public.listing_investment for select to authenticated using (true);

drop policy if exists tax_rules_read on public.tax_rules;
create policy tax_rules_read on public.tax_rules for select to authenticated using (true);

drop policy if exists coverage_read on public.coverage_regions;
create policy coverage_read on public.coverage_regions for select to authenticated using (true);

drop policy if exists official_read on public.official_market_stats;
create policy official_read on public.official_market_stats for select to authenticated using (true);

drop policy if exists notary_read on public.notary_stats;
create policy notary_read on public.notary_stats for select to authenticated using (true);

drop policy if exists catastro_read on public.catastro_cache;
create policy catastro_read on public.catastro_cache for select to authenticated using (true);

drop policy if exists scans_owner on public.scans;
create policy scans_owner on public.scans for all using (auth.uid() = user_id);

drop policy if exists scan_results_owner on public.scan_results;
create policy scan_results_owner on public.scan_results for select using (
  exists (select 1 from public.scans s where s.id = scan_id and s.user_id = auth.uid())
);

drop policy if exists saved_owner on public.saved_deals;
create policy saved_owner on public.saved_deals for all using (auth.uid() = user_id);

-- RPC mapa / scan
create or replace function public.listings_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision
)
returns table (id uuid)
language sql
stable
as $$
  select l.id
  from public.listings l
  where l.geom is not null
    and l.operation = 'sale'
    and l.status in ('active', 'demo')
    and st_intersects(
      l.geom::geometry,
      st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    );
$$;

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
  lat double precision
)
language sql
stable
as $$
  select
    l.id,
    l.price,
    li.roi_gross,
    st_x(l.geom::geometry) as lng,
    st_y(l.geom::geometry) as lat
  from public.listings l
  left join public.listing_investment li on li.listing_id = l.id
  where l.geom is not null
    and l.operation = 'sale'
    and l.status in ('active', 'demo')
    and st_intersects(
      l.geom::geometry,
      st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    )
  order by li.roi_gross desc nulls last
  limit max_rows;
$$;

grant execute on function public.listings_in_bbox to service_role;
grant execute on function public.map_listings_in_bbox to authenticated, service_role, anon;

create or replace function public.rent_comparables_near(
  p_listing_id uuid,
  max_m double precision default 500,
  lim int default 5
)
returns table (
  id uuid,
  title text,
  price numeric,
  sqm numeric,
  bedrooms int,
  distance_m double precision
)
language sql
stable
as $$
  with origin as (
    select l.geom
    from public.listings l
    where l.id = p_listing_id
      and l.geom is not null
  )
  select
    r.id,
    r.title,
    r.price,
    r.sqm,
    r.bedrooms,
    st_distance(o.geom::geography, r.geom::geography) as distance_m
  from origin o
  join public.listings r on true
  where r.operation = 'rent'
    and r.status in ('active', 'demo')
    and r.geom is not null
    and r.id <> p_listing_id
    and st_dwithin(o.geom::geography, r.geom::geography, max_m)
  order by distance_m
  limit lim;
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
    and st_within(
      l.geom::geometry,
      st_setsrid(st_geomfromgeojson(geojson), 4326)
    );
$$;

grant execute on function public.rent_comparables_near to authenticated, service_role, anon;
grant execute on function public.listings_in_polygon to service_role;

-- Acceso libre (OPEN_ACCESS=1)
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'open-access@internal.local',
  crypt('open-access-not-used', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Acceso libre"}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.profiles (id, display_name)
values ('00000000-0000-4000-8000-000000000001', 'Acceso libre')
on conflict (id) do update set display_name = excluded.display_name;

drop policy if exists listings_read_anon on public.listings;
create policy listings_read_anon on public.listings
  for select to anon
  using (status in ('active', 'demo'));

drop policy if exists listing_investment_read_anon on public.listing_investment;
create policy listing_investment_read_anon on public.listing_investment
  for select to anon using (true);

-- Demo Barcelona (solo si no hay ventas demo)
insert into public.coverage_regions (slug, name, tier, bbox, last_scrape_at)
select 'barcelona', 'Barcelona', 1,
  '[[2.05,41.32],[2.25,41.32],[2.25,41.48],[2.05,41.48],[2.05,41.32]]'::jsonb, now()
where not exists (select 1 from public.coverage_regions where slug = 'barcelona');

do $$
declare
  i int;
  lat float;
  lon float;
  lid uuid;
  price numeric;
  sqm numeric;
  rent numeric;
begin
  if exists (select 1 from public.listings where source_portal = 'demo' and operation = 'sale' limit 1) then
    return;
  end if;

  for i in 1..40 loop
    lat := 41.378 + (random() * 0.012);
    lon := 2.185 + (random() * 0.015);
    price := 120000 + floor(random() * 230000);
    sqm := 45 + floor(random() * 55);
    insert into public.listings (
      source_portal, source_external_id, operation, title, price, sqm, bedrooms,
      postal_code, city, ccaa, source_url, geom, geocode_quality, status
    ) values (
      'demo', 'sale-' || i, 'sale', 'Piso demo ' || i, price, sqm, 1 + (i % 3),
      '08003', 'Barcelona', 'Cataluña', 'https://example.com/demo/sale/' || i,
      st_setsrid(st_makepoint(lon, lat), 4326)::geography, 1, 'demo'
    ) returning id into lid;
    rent := greatest(800, (price * 0.0045) + (random() * 200));
    insert into public.listing_investment (listing_id, rent_est, rent_confidence, comparables_count, roi_gross, computed_at)
    values (lid, rent, 'medium', 4, (rent * 12 / price) * 100, now());
  end loop;

  for i in 1..60 loop
    lat := 41.378 + (random() * 0.02);
    lon := 2.17 + (random() * 0.05);
    sqm := 40 + floor(random() * 50);
    rent := 900 + floor(random() * 900);
    insert into public.listings (
      source_portal, source_external_id, operation, title, price, sqm, bedrooms,
      postal_code, city, ccaa, source_url, geom, geocode_quality, status
    ) values (
      'demo', 'rent-' || i, 'rent', 'Alquiler demo ' || i, rent, sqm, 1 + (i % 2),
      '08003', 'Barcelona', 'Cataluña', 'https://example.com/demo/rent/' || i,
      st_setsrid(st_makepoint(lon, lat), 4326)::geography, 1, 'demo'
    );
  end loop;
end $$;

-- Recargar caché PostgREST
notify pgrst, 'reload schema';
