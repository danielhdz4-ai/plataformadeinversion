const API = "https://www.solvia.es/api";

export async function fetchSolviaProvinces() {
  const res = await fetch(`${API}/geolocalizacion/v1/provincias`, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; PlataformaInversion/0.1)" },
  });
  if (!res.ok) throw new Error(`Solvia provincias HTTP ${res.status}`);
  const data = await res.json();
  return data.provincias ?? [];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function searchSolviaProvince(provinceId, { page = 0, pageSize = 24 } = {}) {
  const body = {
    idProvincia: String(provinceId),
    tipoOperacion: "COMPRA",
    idCategoriaTipoVivienda: "1",
    paginacion: { numeroPagina: page, tamanoPagina: pageSize },
  };
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(800 * attempt);
    const res = await fetch(`${API}/inmuebles/v2/buscarInmuebles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Origin: "https://www.solvia.es",
        Referer: "https://www.solvia.es/es/comprar/viviendas",
        "User-Agent": "Mozilla/5.0 (compatible; PlataformaInversion/0.1)",
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    const t = await res.text();
    lastErr = new Error(`Solvia buscar HTTP ${res.status}: ${t.slice(0, 200)}`);
    if (res.status >= 500) continue;
    throw lastErr;
  }
  throw lastErr;
}

function slugify(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function mapSolviaListing(row) {
  const parts = String(row.id ?? "").split("-");
  const idVivienda = parts[0] ?? row.idVivienda;
  const promoId = parts[1] ?? row.promocion?.id;
  const slug = slugify(row.promocion?.titulo ?? "inmueble");
  const sourceUrl = `https://www.solvia.es/es/propiedades/comprar/${slug}-${promoId}-${idVivienda}`;
  const thumb = row.listaImagenesInmueble_vPC?.[0]?.replace(/\\/g, "/") ?? null;
  const price = Number(row.precio ?? 0) || null;
  if (row.categoriaTipoVivienda?.id != null && Number(row.categoriaTipoVivienda.id) !== 1) {
    return null;
  }
  return {
    externalId: String(row.id ?? `${idVivienda}-${promoId}`),
    title: row.promocion?.titulo ?? row.direccion ?? "Solvia",
    price,
    city: row.poblacion?.nombre ?? null,
    ccaa: row.provincia?.nombre ?? null,
    lon: row.longitud != null ? Number(row.longitud) : null,
    lat: row.latitud != null ? Number(row.latitud) : null,
    sqm: row.totalM2 != null ? Number(row.totalM2) : null,
    bedrooms: row.dormitorios ?? row.totalDormitorios ?? null,
    bathrooms: row.banyos ?? row.totalBanyos ?? null,
    thumbnail: thumb,
    sourceUrl,
  };
}
