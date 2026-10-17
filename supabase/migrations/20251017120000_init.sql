-- Plataforma de inversión — schema v0 + demo seed
create extension if not exists postgis;

-- Profiles
create table public.profiles (
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Tax rules (B7)
create table public.tax_rules (
  ccaa text primary key,
  itp_pct numeric not null,
  ajd_pct numeric not null default 0
);

insert into public.tax_rules (ccaa, itp_pct, ajd_pct) values
  ('Cataluña', 10, 1.5),
  ('Comunidad de Madrid', 6, 0.75),
  ('Andalucía', 7, 1.2),
  ('Comunitat Valenciana', 10, 1.5);

-- Listings
create table public.listings (
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

create index listings_geom_idx on public.listings using gist (geom);
create index listings_operation_status_idx on public.listings (operation, status);

create table public.listing_enrichment (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  rc text,
  catastral_surface numeric,
  year_built int,
  raw jsonb default '{}'::jsonb
);

create table public.listing_investment (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  rent_est numeric,
  rent_confidence text,
  comparables_count int not null default 0,
  roi_gross numeric,
  computed_at timestamptz
);

create table public.scans (
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

create table public.scan_results (
  scan_id uuid not null references public.scans (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  rank int not null,
  roi_gross numeric,
  primary key (scan_id, listing_id)
);

create table public.saved_deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, listing_id)
);

create table public.coverage_regions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  tier int not null default 1,
  bbox jsonb,
  last_scrape_at timestamptz
);

create table public.scrape_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  city_slug text,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  listings_inserted int default 0,
  error_message text
);

create table public.official_market_stats (
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

create table public.catastro_cache (
  cache_key text primary key,
  rc text,
  payload jsonb,
  fetched_at timestamptz not null default now()
);

create table public.notary_stats (
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

create policy profiles_self on public.profiles for all using (auth.uid() = id);

create policy listings_read on public.listings for select to authenticated
  using (status in ('active', 'demo'));

create policy listing_enrichment_read on public.listing_enrichment for select to authenticated using (true);
create policy listing_investment_read on public.listing_investment for select to authenticated using (true);
create policy tax_rules_read on public.tax_rules for select to authenticated using (true);
create policy coverage_read on public.coverage_regions for select to authenticated using (true);
create policy official_read on public.official_market_stats for select to authenticated using (true);
create policy notary_read on public.notary_stats for select to authenticated using (true);
create policy catastro_read on public.catastro_cache for select to authenticated using (true);

create policy scans_owner on public.scans for all using (auth.uid() = user_id);
create policy scan_results_owner on public.scan_results for select using (
  exists (select 1 from public.scans s where s.id = scan_id and s.user_id = auth.uid())
);
create policy saved_owner on public.saved_deals for all using (auth.uid() = user_id);

-- Demo coverage + listings (Barcelona)
insert into public.coverage_regions (slug, name, tier, bbox, last_scrape_at) values
  ('barcelona', 'Barcelona', 1, '[[2.05,41.32],[2.25,41.32],[2.25,41.48],[2.05,41.48],[2.05,41.32]]'::jsonb, now());

-- Helper: demo sales La Barceloneta area (simplified grid)
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
