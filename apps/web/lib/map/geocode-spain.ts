import { SPAIN_BBOX } from "@/lib/map/spain-bounds";

export type GeocodeHit = {
  label: string;
  lat: number;
  lng: number;
  bbox: [number, number, number, number] | null;
};

type NominatimItem = {
  lat: string;
  lon: string;
  display_name: string;
  boundingbox?: [string, string, string, string];
  address?: {
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
  };
};

const UA = "plataformadeinversion/1.0 (investment scan; contact: danielhdz4-ai)";

export function normalizeSpanishPostalCode(q: string): string | null {
  const trimmed = q.trim();
  const m = trimmed.match(/^(\d{4,5})$/);
  if (!m) return null;
  return m[1]!.padStart(5, "0");
}

/** CP + texto opcional, p. ej. "08906" o "08906 L'Hospitalet". */
export function extractPostalFromQuery(q: string): { postal: string; rest: string } | null {
  const m = q.trim().match(/^(\d{4,5})(?:\s+(.+))?$/i);
  if (!m) return null;
  return { postal: m[1]!.padStart(5, "0"), rest: (m[2] ?? "").trim() };
}

function inSpain(lng: number, lat: number) {
  return (
    lng >= SPAIN_BBOX.minLng &&
    lng <= SPAIN_BBOX.maxLng &&
    lat >= SPAIN_BBOX.minLat &&
    lat <= SPAIN_BBOX.maxLat
  );
}

function formatLabel(item: NominatimItem, postalHint?: string) {
  const a = item.address;
  if (a) {
    const pc = a.postcode ?? postalHint ?? "";
    const place =
      a.city ?? a.town ?? a.village ?? a.municipality ?? item.display_name.split(",")[0] ?? "";
    const region = a.state ?? "";
    const parts = [pc && `CP ${pc}`, place, region, "España"].filter(Boolean);
    if (parts.length >= 2) return parts.join(", ");
  }
  return item.display_name;
}

function mapItem(item: NominatimItem, postalHint?: string): GeocodeHit {
  return {
    label: formatLabel(item, postalHint),
    lat: Number(item.lat),
    lng: Number(item.lon),
    bbox: item.boundingbox
      ? ([
          Number(item.boundingbox[2]),
          Number(item.boundingbox[0]),
          Number(item.boundingbox[3]),
          Number(item.boundingbox[1]),
        ] as [number, number, number, number])
      : null,
  };
}

function postcodeMatches(item: NominatimItem, postal: string) {
  const pc = item.address?.postcode?.replace(/\s/g, "");
  if (pc && pc.padStart(5, "0") === postal) return true;
  return item.display_name.includes(postal);
}

async function nominatimFetch(params: Record<string, string>) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": UA },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  return (await res.json()) as NominatimItem[];
}

export async function geocodeSpainQuery(q: string): Promise<GeocodeHit[]> {
  const postalExtract = extractPostalFromQuery(q);
  if (postalExtract) {
    const { postal, rest } = postalExtract;
    const structured = await nominatimFetch({
      postalcode: postal,
      country: "Spain",
      countrycodes: "es",
      format: "json",
      addressdetails: "1",
      limit: "12",
    });
    let hits = structured
      .filter((item) => postcodeMatches(item, postal))
      .map((item) => mapItem(item, postal));

    if (rest) {
      const restLower = rest.toLowerCase();
      const narrowed = hits.filter((h) => h.label.toLowerCase().includes(restLower));
      if (narrowed.length > 0) hits = narrowed;
    }

    if (hits.length > 0) {
      return hits.filter((r) => inSpain(r.lng, r.lat)).slice(0, 8);
    }

    const fallback = await nominatimFetch({
      q: rest ? `${postal} ${rest}, España` : `${postal}, España`,
      format: "json",
      addressdetails: "1",
      limit: "8",
      countrycodes: "es",
    });
    hits = fallback
      .filter((item) => postcodeMatches(item, postal))
      .map((item) => mapItem(item, postal));
    if (hits.length > 0) {
      return hits.filter((r) => inSpain(r.lng, r.lat)).slice(0, 8);
    }
  }

  const query = /\bespaña\b|\bspain\b/i.test(q) ? q : `${q}, España`;
  const raw = await nominatimFetch({
    q: query,
    format: "json",
    addressdetails: "1",
    limit: "10",
    countrycodes: "es",
  });

  return raw
    .map((item) => mapItem(item))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && inSpain(r.lng, r.lat))
    .slice(0, 8);
}
