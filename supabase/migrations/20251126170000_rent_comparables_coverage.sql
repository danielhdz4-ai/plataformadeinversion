-- ============================================================================
-- Comparables de alquiler: cobertura Tier 1 (Madrid, Barcelona, Valencia,
-- Sevilla, Málaga, Bilbao) y excluir alquileres colocados en el centro de la
-- ciudad (geocode_quality 5 = fallback ciudad, no dirección real).
--
-- Problema: el RPC buscaba comparables a 800 m y los alquileres geocodificados
-- al centro de la ciudad nunca caían cerca de la vivienda en venta. Resultado:
-- 100% de ROI con confianza "low" aunque hubiera alquileres reales.
--
-- Añade también la distancia de coincidencia por número de habitaciones.
-- Idempotente.
-- ============================================================================

drop function if exists public.rent_comparables_near(uuid, double precision, int);

create or replace function public.rent_comparables_near(
  p_listing_id uuid,
  max_m double precision default 800,
  lim int default 12
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
    select l.geom, l.bedrooms as origin_bedrooms, coalesce(l.geocode_quality, 4) as origin_quality
    from public.listings l
    where l.id = p_listing_id
      and l.geom is not null
  ),
  candidates as (
    select
      r.id,
      r.title,
      r.price,
      r.sqm,
      r.bedrooms,
      st_distance(o.geom::geography, r.geom::geography) as distance_m,
      abs(coalesce(r.bedrooms, 2) - coalesce(o.origin_bedrooms, 2)) as bed_gap
    from origin o
    join public.listings r
      on r.operation = 'rent'
     and r.status in ('active', 'demo')
     and r.geom is not null
     and r.id <> p_listing_id
     and r.price >= 150
     and r.price <= 15000
     and st_dwithin(o.geom::geography, r.geom::geography, max_m)
     -- Excluir alquileres geocodificados solo a nivel ciudad (ruido de posición)
     -- salvo que la vivienda en venta tampoco tenga posición a nivel calle.
     and (
       r.geocode_quality is null
       or r.geocode_quality <= 4
       or o.origin_quality >= 5
     )
  )
  select c.id, c.title, c.price, c.sqm, c.bedrooms, c.distance_m
  from candidates c
  order by
    -- Preferir mismo nº de habitaciones; después, más cercanos.
    (c.bed_gap >= 2) asc,
    c.bed_gap asc,
    c.distance_m asc
  limit lim;
$$;

grant execute on function public.rent_comparables_near to authenticated, service_role, anon;

-- Índice de apoyo para el join espacial de alquileres activos.
create index if not exists listings_rent_geom_gix
  on public.listings using gist (geom)
  where operation = 'rent' and status in ('active', 'demo');

create index if not exists listings_rent_active_idx
  on public.listings (operation, status, price)
  where operation = 'rent';

analyze public.listings;

-- Verificación rápida (ejecuta en Madrid):
-- select * from public.rent_comparables_near(
--   (select id from public.listings
--     where operation = 'sale' and status = 'active' and postal_code like '280%'
--     limit 1),
--   1200, 10);
