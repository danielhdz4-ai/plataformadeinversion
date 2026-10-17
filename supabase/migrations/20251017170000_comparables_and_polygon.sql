-- Alquileres cercanos para resumen de fichas (venta → comparables rent)
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

-- Listados de venta dentro del polígono del scan (GeoJSON Polygon)
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
