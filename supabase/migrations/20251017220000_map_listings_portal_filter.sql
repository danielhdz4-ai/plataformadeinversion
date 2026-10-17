-- Filtro opcional por portal para repartir pins en bbox grande (Explorar zoom país).
drop function if exists public.map_listings_in_bbox(
  double precision,
  double precision,
  double precision,
  double precision,
  integer
);

create or replace function public.map_listings_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  max_rows int default 500,
  portal_filter text default null
)
returns table (
  id uuid,
  price numeric,
  roi_gross numeric,
  lng double precision,
  lat double precision,
  geocode_quality int,
  rent_confidence text
)
language sql
stable
as $$
  select
    l.id,
    l.price,
    li.roi_gross,
    st_x(l.geom::geometry) as lng,
    st_y(l.geom::geometry) as lat,
    l.geocode_quality,
    li.rent_confidence
  from public.listings l
  left join public.listing_investment li on li.listing_id = l.id
  where l.geom is not null
    and l.operation = 'sale'
    and l.status = 'active'
    and coalesce(l.property_kind, '') not in ('garaje', 'trastero', 'local', 'parking', 'oficina', 'nave', 'terreno')
    and (portal_filter is null or l.source_portal = portal_filter)
    and st_intersects(
      l.geom::geometry,
      st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    )
  order by li.roi_gross desc nulls last
  limit max_rows;
$$;

grant execute on function public.map_listings_in_bbox(
  double precision,
  double precision,
  double precision,
  double precision,
  integer,
  text
) to authenticated, service_role, anon;
