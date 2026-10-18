/** Slug raíz Idealista por ciudad (venta-viviendas/{base}/{barrio}). */
export const IDEALISTA_CITY_BASE = {
  madrid: "madrid",
  valencia: "valencia-valencia",
  sevilla: "sevilla-sevilla",
  barcelona: "barcelona-barcelona",
  malaga: "malaga-malaga",
};

export function idealistaDistrictPath(citySlug, districtSlug) {
  const base = IDEALISTA_CITY_BASE[citySlug];
  if (!base || !districtSlug) return null;
  return `/venta-viviendas/${base}/${districtSlug}/`;
}

export function idealistaListUrl(citySlug, districtSlug, page = 1) {
  const path = idealistaDistrictPath(citySlug, districtSlug);
  if (!path) return null;
  const base = `https://www.idealista.com${path}`;
  return page <= 1 ? base : `${base}pagina-${page}.htm`;
}
