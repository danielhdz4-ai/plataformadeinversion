-- Producción: mapa y scan solo listings reales (status = active), no demo.

create or replace function public.listings_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision
)
returns table (id uuid)
language sql
stable
as $$
  select l.id
  from public.listings l
  where l.geom is not null
    and l.operation = 'sale'
    and l.status = 'active'
    and st_intersects(
      l.geom::geometry,
      st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    );
$$;

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
  lat double precision
)
language sql
stable
as $$
  select
    l.id,
    l.price,
    li.roi_gross,
    st_x(l.geom::geometry) as lng,
    st_y(l.geom::geometry) as lat
  from public.listings l
  left join public.listing_investment li on li.listing_id = l.id
  where l.geom is not null
    and l.operation = 'sale'
    and l.status = 'active'
    and st_intersects(
      l.geom::geometry,
      st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    )
  order by li.roi_gross desc nulls last
  limit max_rows;
$$;

create or replace function public.patch_listing_geom(
  listing_id uuid,
  lon double precision,
  lat double precision
)
returns void
language sql
as $$
  update public.listings
  set geom = st_setsrid(st_makepoint(lon, lat), 4326)::geography,
      geocode_quality = greatest(geocode_quality, 2)
  where id = listing_id;
$$;

grant execute on function public.patch_listing_geom to service_role;

create or replace function public.listings_pins_by_ids(ids uuid[])
returns table (
  id uuid,
  lng double precision,
  lat double precision,
  price numeric,
  roi_gross numeric
)
language sql
stable
as $$
  select
    l.id,
    st_x(l.geom::geometry) as lng,
    st_y(l.geom::geometry) as lat,
    l.price,
    li.roi_gross
  from public.listings l
  left join public.listing_investment li on li.listing_id = l.id
  where l.id = any(ids)
    and l.geom is not null;
$$;

grant execute on function public.listings_pins_by_ids to service_role, authenticated, anon;
