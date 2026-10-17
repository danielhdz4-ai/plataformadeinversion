-- B2: cache geocode · cola pendientes
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

-- B1: peticiones de cobertura desde mapa
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

-- Scan polígono desde cliente autenticado / open-access service
grant execute on function public.listings_in_polygon to authenticated, anon;

alter table public.geocode_cache enable row level security;
alter table public.geocode_pending enable row level security;
alter table public.user_map_requests enable row level security;

create policy geocode_cache_read on public.geocode_cache for select using (true);
create policy geocode_pending_service on public.geocode_pending for all using (true);
create policy user_map_requests_insert on public.user_map_requests
  for insert with check (auth.uid() = user_id or user_id is null);
create policy user_map_requests_read_own on public.user_map_requests
  for select using (auth.uid() = user_id or user_id is null);
