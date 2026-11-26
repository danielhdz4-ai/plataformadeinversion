-- Marcado persistente de oportunidades (feed /app/oportunidades + API rápida)

alter table public.listings
  add column if not exists is_opportunity boolean not null default false,
  add column if not exists opportunity_score smallint,
  add column if not exists opportunity_discount_pct numeric,
  add column if not exists opportunity_valuation_mid numeric,
  add column if not exists opportunity_computed_at timestamptz;

comment on column public.listings.is_opportunity is 'true si cumple criterios de feed Oportunidades (job nocturno)';
comment on column public.listings.opportunity_score is 'Score compuesto 0–100';
comment on column public.listings.opportunity_discount_pct is 'Descuento % vs valoración orientativa (+ = bajo valoración)';

create index if not exists listings_opportunity_feed_idx
  on public.listings (opportunity_score desc nulls last, scraped_at desc)
  where status = 'active'
    and operation = 'sale'
    and is_opportunity = true;

create index if not exists listings_opportunity_cp_idx
  on public.listings (postal_code, opportunity_score desc nulls last)
  where status = 'active'
    and operation = 'sale'
    and is_opportunity = true;
