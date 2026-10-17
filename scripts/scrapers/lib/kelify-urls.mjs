import { listCities } from "./spain-city.mjs";

/** URLs de listado Kelify por ciudad (venta particulares + agregado). */
export function kelifyListingUrls(city) {
  const slug = city.kelifySlug ?? city.slug;
  const urls = new Set([
    `https://kelify.com/venta/pisos/particulares/${slug}`,
    `https://kelify.com/venta/pisos/${slug}`,
    `https://kelify.com/venta/pisos/particulares/${slug}/`,
    `https://kelify.com/es/venta/pisos/particulares/${slug}`,
  ]);
  return [...urls];
}

export function allKelifyCities() {
  return listCities();
}
