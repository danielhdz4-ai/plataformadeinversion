-- Excluir alquileres con precio de venta mal scrapeados de los comparables.

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
    and r.price >= 150
    and r.price <= 15000
    and st_dwithin(o.geom::geography, r.geom::geography, max_m)
  order by distance_m
  limit lim;
$$;

grant execute on function public.rent_comparables_near to authenticated, service_role, anon;
