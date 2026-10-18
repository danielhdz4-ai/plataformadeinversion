-- ROI en mapa: recalcular desde precio + rent_est (evita cache obsoleto tras reparar scrapers).

create or replace function public.sync_listing_investment_roi()
returns integer
language sql
security definer
set search_path = public
as $$
  with updated as (
    update public.listing_investment li
    set
      roi_gross = round(((li.rent_est * 12) / l.price * 100)::numeric, 3),
      computed_at = timezone('utc', now())
    from public.listings l
    where l.id = li.listing_id
      and l.operation = 'sale'
      and l.status = 'active'
      and l.price > 0
      and coalesce(li.rent_est, 0) > 0
    returning li.listing_id
  )
  select count(*)::integer from updated;
$$;

grant execute on function public.sync_listing_investment_roi() to service_role;

drop function if exists public.map_listings_in_bbox(
  double precision,
  double precision,
  double precision,
  double precision,
  integer,
  text
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
    case
      when l.price > 0 and coalesce(li.rent_est, 0) > 0
        then round(((li.rent_est * 12) / l.price * 100)::numeric, 3)
      else li.roi_gross
    end as roi_gross,
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
  order by 3 desc nulls last
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
