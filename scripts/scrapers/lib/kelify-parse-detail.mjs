/**
 * Parsea ficha Kelify (HTML) — JSON-LD o meta cuando exista.
 */
export function parseKelifyDetailHtml(html, fallbackUrl) {
  const out = {
    title: null,
    price: null,
    sqm: null,
    bedrooms: null,
    bathrooms: null,
    postalCode: null,
    city: null,
    thumbnailUrl: null,
  };

  const ldBlocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of ldBlocks) {
    try {
      let data = JSON.parse(m[1].trim());
      if (Array.isArray(data)) data = data.find((x) => x["@type"]?.includes?.("Product") || x["@type"] === "Apartment") ?? data[0];
      if (data?.["@graph"]) {
        data = data["@graph"].find((x) => x.offers || x.numberOfRooms) ?? data["@graph"][0];
      }
      if (data?.name) out.title = String(data.name);
      const offer = data?.offers ?? data;
      if (offer?.price) out.price = Number(offer.price);
      if (data?.floorSize?.value) out.sqm = Number(data.floorSize.value);
      if (data?.numberOfRooms) out.bedrooms = Number(data.numberOfRooms);
      if (data?.numberOfBathroomsTotal) out.bathrooms = Number(data.numberOfBathroomsTotal);
      if (data?.address) {
        const a = data.address;
        if (typeof a === "object") {
          out.postalCode = a.postalCode ?? null;
          out.city = a.addressLocality ?? null;
        }
      }
      if (data?.image) {
        out.thumbnailUrl = Array.isArray(data.image) ? data.image[0] : data.image;
      }
    } catch {
      /* next block */
    }
  }

  if (out.price == null) {
    const pm = html.match(/([\d.]+)\s*€/);
    if (pm) out.price = Number(pm[1].replace(/\./g, ""));
  }
  if (out.sqm == null) {
    const sm = html.match(/([\d,.]+)\s*m²/i);
    if (sm) out.sqm = Number(sm[1].replace(",", "."));
  }
  if (out.bedrooms == null) {
    const bm = html.match(/(\d+)\s*(?:hab|dormitorio)/i);
    if (bm) out.bedrooms = Number(bm[1]);
  }
  if (out.postalCode == null) {
    const cp = html.match(/\b(0[1-9]\d{3}|[1-4]\d{4}|5[0-2]\d{3})\b/);
    if (cp) out.postalCode = cp[1];
  }
  if (!out.title && fallbackUrl) {
    const slug = fallbackUrl.split("/").pop()?.replace(/-[A-Za-z0-9]+$/, "").replace(/-/g, " ");
    if (slug) out.title = slug;
  }

  return out;
}

export async function fetchKelifyDetail(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; PlataformaInversion-Kelify/1.0)",
      Accept: "text/html",
      "Accept-Language": "es-ES,es;q=0.9",
    },
    redirect: "follow",
  });
  if (!res.ok) return null;
  const html = await res.text();
  return parseKelifyDetailHtml(html, url);
}
