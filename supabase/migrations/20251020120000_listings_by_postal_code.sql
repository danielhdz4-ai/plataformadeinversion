-- Ventas por CP: etiquetar cerca del centro + consulta mapa (todos los portales)

create or replace function public.tag_listings_postal_code(
  p_cp text,
  p_lng double precision,
  p_lat double precision,
  p_radius_m double precision default 2800
)
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  n int;
begin
  update public.listings l
  set postal_code = p_cp
  where l.status = 'active'
    and l.operation = 'sale'
    and l.geom is not null
    and l.source_portal in (
      'fotocasa', 'pisos_com', 'kelify', 'habitaclia', 'hipoges', 'solvia', 'idealista'
    )
    and extensions.st_dwithin(
      l.geom,
      extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
    and (
      l.postal_code is null
      or trim(l.postal_code) = ''
      or l.postal_code = p_cp
    );

  get diagnostics n = row_count;
  return n;
end;
$$;

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
  postal_code text
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    l.id,
    l.price,
    li.roi_gross,
    extensions.st_x(l.geom::geometry)::double precision as lng,
    extensions.st_y(l.geom::geometry)::double precision as lat,
    l.geocode_quality,
    li.rent_confidence,
    l.source_portal,
    l.postal_code
  from public.listings l
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
      or extensions.st_dwithin(
        l.geom,
        extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::geography,
        p_radius_m
      )
    )
  order by li.roi_gross desc nulls last, l.price asc
  limit greatest(1, least(max_rows, 2000));
$$;

grant execute on function public.tag_listings_postal_code(text, double precision, double precision, double precision)
  to service_role;
grant execute on function public.listings_for_postal_code(
  text, double precision, double precision, double precision, int, text
) to authenticated, anon, service_role;
