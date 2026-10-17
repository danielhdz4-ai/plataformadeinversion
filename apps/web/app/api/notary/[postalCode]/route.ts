import { portalFromNotaryRaw } from "@/lib/notariado/normalize-portal";
import { getDbClient } from "@/lib/supabase/request-client";
import { NextResponse } from "next/server";

export async function GET(_req: Request, ctx: { params: Promise<{ postalCode: string }> }) {
  const { postalCode } = await ctx.params;
  if (!/^\d{5}$/.test(postalCode)) {
    return NextResponse.json({ error: "Código postal inválido" }, { status: 400 });
  }

  const supabase = await getDbClient();
  const { data, error } = await supabase
    .from("notary_stats")
    .select("*")
    .eq("postal_code", postalCode)
    .order("period", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    return NextResponse.json({ error: "Sin datos notariales para este CP" }, { status: 404 });
  }

  const portal = portalFromNotaryRaw(data.raw);
  return NextResponse.json({
    postalCode,
    row: {
      period: data.period,
      price_m2: data.price_m2,
      avg_price: data.avg_price,
      avg_surface: data.avg_surface,
      operations_count: data.operations_count,
      es_estimado: data.es_estimado,
      source_url: data.source_url,
      scraped_at: data.scraped_at,
    },
    portal,
  });
}
