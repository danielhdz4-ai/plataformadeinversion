alter table public.coverage_regions
  add column if not exists sale_count int not null default 0,
  add column if not exists rent_count int not null default 0;

create index if not exists listings_dedup_scan_idx
  on public.listings (postal_code, operation, status)
  where status = 'active';

update public.coverage_regions set tier = 1 where slug in ('castellon', 'alicante');

grant select on public.coverage_regions to anon;
