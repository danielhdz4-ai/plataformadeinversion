-- ============================================================================
-- Limpieza de títulos con enums del portal (B8 tipologías / calidad de ficha)
--
-- Problema: pisos.com y otros portales guardaban el enum de tipología dentro
-- del título ("INTERMEDIATE_FLOOR ·  MUELAS DEL PAN, San Blas"). El usuario ve
-- códigos técnicos en las tarjetas y en la ficha del inmueble.
--
-- Solución:
--   1. Elimina el prefijo enum del título.
--   2. Deriva property_kind desde el enum cuando la columna está vacía.
--   3. Elimina la preposición huérfana ("en Calle X" tras quitar la tipología).
--
-- Idempotente: se puede ejecutar varias veces.
-- ============================================================================

begin;

-- 1) Deriva tipología desde el prefijo enum (antes de borrarlo).
update public.listings
set property_kind = case
    when title ~* '^GARAGE|^PARKING'          then 'garaje'
    when title ~* '^STORAGE'                  then 'trastero'
    when title ~* '^COMMERCIAL_PREMISES|^OFFICE' then 'local'
    when title ~* '^WAREHOUSE'                then 'nave'
    when title ~* '^PLOT|^LAND'               then 'terreno'
    when title ~* '^PENTHOUSE|^ATTIC|^DUPLEX' then 'atico'
    when title ~* '^STUDIO'                   then 'estudio'
    when title ~* '^HOUSE|^CHALET|^VILLA'     then 'casa'
    when title ~* '^FLAT|^APARTMENT|^FLOOR|^INTERMEDIATE_FLOOR|^TOP_FLOOR|^GROUND_FLOOR'
                                              then 'piso'
    else property_kind
  end
where (property_kind is null or property_kind = '')
  and title ~ '^[A-Z][A-Z_]{4,}\s*·';

-- 2) Quita el prefijo enum del título.
update public.listings
set title = regexp_replace(title, '^[A-Z][A-Z_]{4,}\s*·\s*', '')
where title ~ '^[A-Z][A-Z_]{4,}\s*·';

-- 3) Normaliza espacios dobles que deja el portal ("·  MUELAS").
update public.listings
set title = regexp_replace(btrim(title), '\s{2,}', ' ', 'g')
where title ~ '\s{2,}';

-- 4) Backfill de property_kind desde el texto del título (resto de portales).
update public.listings
set property_kind = case
    when title ~* '\m(piso|apartamento|vivienda)\M' then 'piso'
    when title ~* '\m(casa|chalet|adosado|pareado|villa)\M' then 'casa'
    when title ~* '\m(atico|ático|penthouse)\M'      then 'atico'
    when title ~* '\mduplex\M'                       then 'duplex'
    when title ~* '\m(estudio|loft)\M'               then 'estudio'
    when title ~* '\mgaraje\M' or title ~* '\mparking\M' then 'garaje'
    when title ~* '\mtrastero\M'                     then 'trastero'
    when title ~* '\mlocal\M'                        then 'local'
    when title ~* '\moficina\M'                      then 'oficina'
    when title ~* '\mnave\M'                         then 'nave'
    when title ~* '\m(terreno|solar|parcela)\M'      then 'terreno'
    else property_kind
  end
where property_kind is null;

-- 5) Índice parcial para filtrar residencial en mapas/scans.
create index if not exists listings_property_kind_idx
  on public.listings (property_kind)
  where status = 'active';

commit;

-- Verificación rápida
-- select property_kind, count(*) from public.listings where status = 'active' group by 1 order by 2 desc;
-- select count(*) from public.listings where title ~ '^[A-Z][A-Z_]{4,}\s*·';
