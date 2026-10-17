import { fetchRcFromCoords } from "@pi/catastro-client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDbClient, requireAppUser } from "@/lib/supabase/request-client";
import { NextResponse } from "next/server";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAppUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  const admin = createAdminClient();
  const supabase = await getDbClient();

  const { data: pins, error: pinErr } = await supabase.rpc("listings_pins_by_ids", {
    ids: [id],
  });
  if (pinErr || !pins?.[0]) {
    return NextResponse.json({ error: "Listing sin geometría", code: "GEO" }, { status: 400 });
  }
  const pin = pins[0] as { lng: number; lat: number };
  const rc = await fetchRcFromCoords(pin.lng, pin.lat);
  if (!rc) {
    return NextResponse.json({ error: "Catastro sin respuesta", code: "CATASTRO" }, { status: 502 });
  }

  await admin.from("listing_enrichment").upsert(
    { listing_id: id, rc, raw: { source: "ovc-coordenadas", enriched_at: new Date().toISOString() } },
    { onConflict: "listing_id" }
  );
  await admin.from("catastro_cache").upsert({
    cache_key: `rc:${rc}`,
    rc,
    payload: { lon: pin.lng, lat: pin.lat },
    fetched_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, rc });
}
