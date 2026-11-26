-- Contraportada del Inicio: los chollos con mayor descuento del catálogo,
-- listos para la cinta infinita. Índice parcial para que sea instantáneo.
create index if not exists listings_hero_discount_idx
  on public.listings (opportunity_discount_pct desc)
  where status = 'active'
    and operation = 'sale'
    and is_opportunity = true
    and opportunity_valuation_mid is not null;
