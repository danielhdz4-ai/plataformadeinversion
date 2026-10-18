import { decodeListingTitle } from "@/lib/decode-html";
import { resolveListingGrossRoiPct } from "@/lib/listing/gross-roi";
import { resolveRentEstMonthly } from "@/lib/listing/rent-est";
import { isResidentialPropertyKind } from "@/lib/listing/residential-kind";
import {
  balanceListingsByPortal,
  interleaveByPortal,
} from "@/lib/map/balance-listings-by-portal";
import {
  loadMapListingsInBbox,
  MAP_LISTINGS_FETCH,
  MAP_LISTINGS_LIMIT,
  type MapBboxRow,
} from "@/lib/map/load-bbox-listings";
import { fetchListingRowsInChunks } from "@/lib/supabase/fetch-in-chunks";
import { getDbClient, requireAppUser } from "@/lib/supabase/request-client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const auth = await requireAppUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error, code: "AUTH" }, { status: auth.status });
  }

  const supabase = await getDbClient();

  const p = req.nextUrl.searchParams;
  const minLng = Number(p.get("minLng"));
  const minLat = Number(p.get("minLat"));
  const maxLng = Number(p.get("maxLng"));
  const maxLat = Number(p.get("maxLat"));
  const zoom = p.get("zoom") != null ? Number(p.get("zoom")) : null;
  if ([minLng, minLat, maxLng, maxLat].some((n) => Number.isNaN(n))) {
    return NextResponse.json({ error: "Invalid bbox", code: "VALIDATION" }, { status: 400 });
  }

  const { rows: loadedRows, error: loadError } = await loadMapListingsInBbox(supabase, {
    minLng,
    minLat,
    maxLng,
    maxLat,
  });

  if (loadError) {
    return NextResponse.json({ error: loadError, code: "DB" }, { status: 500 });
  }

  let rows = loadedRows;
  if (zoom != null && zoom >= 14) {
    rows = rows.filter((r) => (r.geocode_quality ?? 1) < 5);
  }

  const ids = rows.map((row) => row.id);
  type ListingMetaRow = {
    id: string;
    source_portal: string;
    title: string | null;
    source_url: string | null;
    city: string | null;
    thumbnail_url: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    sqm: number | null;
    property_kind: string | null;
    scraped_at: string | null;
    listing_investment:
      | { rent_est: number | null; rent_confidence: string | null }
      | { rent_est: number | null; rent_confidence: string | null }[]
      | null;
  };

  let meta: ListingMetaRow[] = [];
  if (ids.length > 0) {
    try {
      meta = await fetchListingRowsInChunks<ListingMetaRow>(
        supabase,
        "listings",
        "id, source_portal, title, source_url, city, thumbnail_url, bedrooms, bathrooms, sqm, property_kind, scraped_at, listing_investment(rent_est, rent_confidence)",
        ids
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Meta fetch failed";
      return NextResponse.json({ error: message, code: "DB" }, { status: 500 });
    }
  }
  const metaMap = new Map(meta.map((m) => [m.id, m]));

  const residentialRows = rows.filter((row) => {
    const m = metaMap.get(row.id) as { property_kind?: string | null } | undefined;
    return isResidentialPropertyKind(m?.property_kind);
  });

  const balancedRows = balanceListingsByPortal(
    residentialRows,
    (id) => (metaMap.get(id) as { source_portal?: string } | undefined)?.source_portal,
    MAP_LISTINGS_LIMIT,
    MAP_LISTINGS_FETCH
  );

  type MapFeature = {
    id: string;
    lng: number;
    lat: number;
    roi: number | null;
    price: number;
    geocodeQuality: number | null;
    rentConfidence: string | null;
    source: string | null;
    title: string | null;
    sourceUrl: string | null;
    city: string | null;
    thumbnailUrl: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    sqm: number | null;
    rentEst: number | null;
    scrapedAt: string | null;
  };

  const features: MapFeature[] = balancedRows.map(
    (row: MapBboxRow) => {
      const m = metaMap.get(row.id) as Record<string, unknown> | undefined;
      const inv = m?.listing_investment as
        | { rent_est?: number; rent_confidence?: string | null }
        | { rent_est?: number; rent_confidence?: string | null }[]
        | null;
      const invRow = Array.isArray(inv) ? inv[0] : inv;
      const rentRaw = invRow?.rent_est != null ? Number(invRow.rent_est) : null;
      const rent = resolveRentEstMonthly(row.price, rentRaw);
      const rentConfidence =
        row.rent_confidence ?? invRow?.rent_confidence ?? null;
      const roi = resolveListingGrossRoiPct(row.price, rent, row.roi_gross);
      return {
        id: row.id,
        lng: row.lng,
        lat: row.lat,
        roi,
        price: row.price,
        geocodeQuality: row.geocode_quality ?? null,
        rentConfidence,
        source: (m?.source_portal as string) ?? null,
        title: decodeListingTitle(m?.title as string),
        sourceUrl: (m?.source_url as string) ?? null,
        city: (m?.city as string) ?? null,
        thumbnailUrl: (m?.thumbnail_url as string) ?? null,
        bedrooms: (m?.bedrooms as number) ?? null,
        bathrooms: (m?.bathrooms as number) ?? null,
        sqm: (m?.sqm as number) ?? null,
        rentEst: rent ?? null,
        scrapedAt: (m?.scraped_at as string) ?? null,
      };
    }
  );

  const interleaved = interleaveByPortal(features, (f) => f.source);

  return NextResponse.json({ features: interleaved });
}
