-- Rendimiento del feed por CP y del mapa.
--
-- Problemas que resuelve:
--  1. `listings_for_postal_code` dejaba fuera anuncios con CP distinto pero dentro
--     del radio (en Madrid el CP asignado al portal suele estar mal), y ordenaba
--     antes de limitar → 800 filas siempre.
--  2. `tag_listings_postal_code` recorría toda la tabla sin índice por geom.
--  3. Faltaba índice parcial por `postal_code` para el feed del CP.

create index if not exists listings_geom_gix
  on public.listings using gist (geom);

create index if not exists listings_active_cp_idx
  on public.listings (postal_code)
  where status in ('active', 'demo') and operation = 'sale';

create index if not exists listings_investment_roi_idx
  on public.listing_investment (roi_gross desc nulls last);

-- La firma nueva añade `in_cp` (cambia el tipo de retorno): hay que recrear la función.
drop function if exists public.listings_for_postal_code(
  text, double precision, double precision, double precision, int, text
);

create or replace function public.listings_for_postal_code(
  p_cp text,
  p_lng double precision,
  p_lat double precision,
  p_radius_m double precision default 2800,
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
  rent_confidence text,
  source_portal text,
  postal_code text,
  in_cp boolean
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with center as (
    select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::geography as g
  )
  select
    l.id,
    l.price,
    li.roi_gross,
    extensions.st_x(l.geom::geometry)::double precision as lng,
    extensions.st_y(l.geom::geometry)::double precision as lat,
    l.geocode_quality,
    li.rent_confidence,
    l.source_portal,
    l.postal_code,
    (l.postal_code = p_cp) as in_cp
  from public.listings l
  cross join center c
  left join public.listing_investment li on li.listing_id = l.id
  where l.status in ('active', 'demo')
    and l.operation = 'sale'
    and l.geom is not null
    and coalesce(l.property_kind, '') not in (
      'garaje', 'trastero', 'local', 'parking', 'oficina', 'nave', 'terreno'
    )
    and (portal_filter is null or l.source_portal = portal_filter)
    and (
      l.postal_code = p_cp
      or extensions.st_dwithin(l.geom, c.g, p_radius_m)
    )
  order by
    (l.postal_code = p_cp) desc,
    li.roi_gross desc nulls last,
    l.price asc
  limit greatest(1, least(max_rows, 2000));
$$;

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
    extensions.st_x(l.geom::geometry) as lng,
    extensions.st_y(l.geom::geometry) as lat,
    l.geocode_quality,
    li.rent_confidence
  from public.listings l
  left join public.listing_investment li on li.listing_id = l.id
  where l.geom is not null
    and l.operation = 'sale'
    and l.status = 'active'
    and coalesce(l.property_kind, '') not in ('garaje', 'trastero', 'local', 'parking', 'oficina', 'nave', 'terreno')
    and (portal_filter is null or l.source_portal = portal_filter)
    and l.geom && extensions.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    and extensions.st_intersects(
      l.geom::geometry,
      extensions.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    )
  order by 3 desc nulls last
  limit max_rows;
$$;

grant execute on function public.listings_for_postal_code(
  text, double precision, double precision, double precision, int, text
) to authenticated, anon, service_role;

grant execute on function public.map_listings_in_bbox(
  double precision, double precision, double precision, double precision, integer, text
) to authenticated, service_role, anon;

analyze public.listings;
analyze public.listing_investment;
