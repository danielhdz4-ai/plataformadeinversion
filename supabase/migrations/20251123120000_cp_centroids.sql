-- Centroides por CP (España): geocode estable sin depender siempre de Nominatim.
create table if not exists public.cp_centroids (
  postal_code char(5) primary key,
  lat double precision not null,
  lng double precision not null,
  label text,
  source text not null default 'manual',
  updated_at timestamptz not null default now()
);

create index if not exists cp_centroids_updated_idx on public.cp_centroids (updated_at desc);

alter table public.cp_centroids enable row level security;

create policy "cp_centroids_public_read"
  on public.cp_centroids for select
  to anon, authenticated
  using (true);

comment on table public.cp_centroids is 'Centro geográfico por código postal español (5 dígitos).';