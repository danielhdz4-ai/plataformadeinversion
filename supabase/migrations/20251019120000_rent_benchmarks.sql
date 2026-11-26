-- B3 R0 — renta de referencia por ciudad (desde alquileres scrapeados)
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
