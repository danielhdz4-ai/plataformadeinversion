const BASE = "https://realestate.hipoges.com";
const LIST_PATH = "/es/point/venta/pisos-y-casas/espana/5";

const RESIDENTIAL_TYPES = [
  "flat",
  "rustic",
  "duplex",
  "lofts",
  "studio_apartment",
  "house",
  "finca",
  "house_terraced",
  "detached_house",
  "house_independent",
];

export function spainSaleQuery(extraConditions = []) {
  return {
    sort: [{ field: "_features.featuresBuildYear", order: 1 }],
    joiner: "and",
    conditions: [
      { name: "_address.country", operator: "equal", value: "Spain" },
      { name: "_assetInfo._operation.operationType", operator: "equal", value: "sale" },
      {
        joiner: "or",
        conditions: RESIDENTIAL_TYPES.map((value) => ({
          name: "_features.featuresType",
          operator: "equal",
          value,
        })),
      },
      ...extraConditions,
    ],
  };
}

export async function createHipogesSession() {
  const home = await fetch(`${BASE}${LIST_PATH}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PlataformaInversion/0.1)" },
  });
  const cookies = home.headers.getSetCookie?.() ?? [];
  let cookieHeader = cookies.map((c) => c.split(";")[0]).join("; ");
  const csrfRes = await fetch(`${BASE}/api/security/csrf-token`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; PlataformaInversion/0.1)",
      Cookie: cookieHeader,
      Accept: "application/json",
    },
  });
  const csrfJson = await csrfRes.json();
  const more = csrfRes.headers.getSetCookie?.() ?? [];
  cookieHeader = [...cookies, ...more].map((c) => c.split(";")[0]).join("; ");
  return { cookieHeader, csrfToken: csrfJson.csrfToken ?? "" };
}

export async function fetchHipogesListingPage(session, { page = 1, itemsPerPage = 20, query }) {
  const res = await fetch(`${BASE}/api/assets/listing`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Cookie: session.cookieHeader,
      "X-CSRF-TOKEN": session.csrfToken,
      Origin: BASE,
      Referer: `${BASE}${LIST_PATH}`,
      "User-Agent": "Mozilla/5.0 (compatible; PlataformaInversion/0.1)",
    },
    body: JSON.stringify({
      query: query ?? spainSaleQuery(),
      pagination: { page, itemsPerPage },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Hipoges listing HTTP ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json();
}

export function mapHipogesAsset(row) {
  const ref =
    row?._assetInfo?.propertyReference ??
    row?._assetInfo?.propertyCode ??
    row?._assetInfo?._legacyId ??
    row?._id;
  const price =
    Number(row?._operation?._price ?? row?._assetInfo?._operation?.operationPrice ?? 0) || null;
  const coords = row?._location?.coordinates;
  const lon = Array.isArray(coords) ? Number(coords[0]) : null;
  const lat = Array.isArray(coords) ? Number(coords[1]) : null;
  const town = row?._address?.town ?? row?._address?._cityId?.name ?? null;
  const region = row?._address?._regionId?.name ?? null;
  const thumb = row?._assetInfo?.images?.[0]?.url ?? null;
  const desc = row?._presentation?.descriptions?.find((d) => d.language === "spanish")?.value;
  const title =
    [town, row?._address?.streetName].filter(Boolean).join(" · ") ||
    (desc ? desc.replace(/<[^>]+>/g, " ").slice(0, 120) : `Hipoges ${ref}`);
  const code = row?._assetInfo?.propertyCode ?? ref;
  const sourceUrl = `${BASE}/es/detail/${encodeURIComponent(String(code))}`;

  const f = row?._features ?? {};
  const sqm =
    Number(f.featuresAreaConstructed) ||
    Number(f.featuresAreaUsable) ||
    Number(f.featuresAreaPlot) ||
    Number(f.featuresArea) ||
    Number(f.featuresBuiltArea) ||
    null;

  return {
    externalId: String(ref),
    title,
    price,
    lon,
    lat,
    city: town,
    ccaa: region,
    thumbnail: thumb,
    sourceUrl,
    sqm: Number.isFinite(sqm) && sqm >= 10 && sqm <= 5000 ? Math.round(sqm) : null,
    bedrooms: f.featuresBedroomNumber ?? f.featuresBedroom ?? null,
    bathrooms: f.featuresBathroomNumber ?? f.featuresBathroom ?? null,
  };
}
