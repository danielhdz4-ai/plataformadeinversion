/**
 * Cliente en evolución hacia la API del mapa penotariado.com (ArcGIS / REST interno).
 * Override: PENOTARIADO_STATS_URL template con {cp}, {propertyType}, {constructionType}
 *
 * @param {string} postalCode 5 dígitos ES
 * @returns {Promise<Record<string, unknown>|null>}
 */
export async function fetchPenotariadoCp(postalCode) {
  const template = process.env.PENOTARIADO_STATS_URL;
  if (!template) return null;

  const propertyType = process.env.PENOTARIADO_PROPERTY_TYPE ?? "99";
  const constructionType = process.env.PENOTARIADO_CONSTRUCTION_TYPE ?? "99";
  const url = template
    .replaceAll("{cp}", postalCode)
    .replaceAll("{propertyType}", propertyType)
    .replaceAll("{constructionType}", constructionType);

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.portal) return data.portal;
  if (data?.summary) return data;
  return null;
}
