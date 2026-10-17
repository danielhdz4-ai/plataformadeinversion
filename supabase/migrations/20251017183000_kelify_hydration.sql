-- Kelify: catálogo nacional + hidratación ficha (ejecutar en SQL Editor si no hiciste db push)
alter table public.listings
  add column if not exists kelify_hydrated boolean not null default false;

create index if not exists listings_kelify_hydrate_idx
  on public.listings (source_portal, kelify_hydrated, scraped_at desc)
  where source_portal = 'kelify' and status = 'active';

create table if not exists public.kelify_crawl_runs (
  id uuid primary key default gen_random_uuid(),
  city_slug text not null,
  list_url text,
  cards_found int not null default 0,
  upserted int not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists kelify_crawl_runs_city_idx on public.kelify_crawl_runs (city_slug, started_at desc);

-- Listados Kelify existentes: marcar pendientes de hidratar si sqm inventado
update public.listings
set kelify_hydrated = false
where source_portal = 'kelify'
  and operation = 'sale'
  and status = 'active';
