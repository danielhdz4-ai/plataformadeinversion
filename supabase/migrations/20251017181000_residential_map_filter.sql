-- B8: mapa y scan solo residencial por defecto
create or replace function public.map_listings_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  max_rows int default 500
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
    and st_intersects(
      l.geom::geometry,
      st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    )
  order by li.roi_gross desc nulls last
  limit max_rows;
$$;

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
    and coalesce(l.property_kind, '') not in ('garaje', 'trastero', 'local', 'parking', 'oficina', 'nave', 'terreno')
    and st_within(
      l.geom::geometry,
      st_setsrid(st_geomfromgeojson(geojson), 4326)
    );
$$;

grant execute on function public.listings_in_polygon to service_role, authenticated, anon;
