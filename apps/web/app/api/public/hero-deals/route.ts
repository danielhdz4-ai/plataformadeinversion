import { isResidentialPropertyKind } from "@/lib/listing/residential-kind";
import { listingWithinFreshWindow } from "@/lib/listing/opportunity-qualify";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Contraportada pública del landing: chollos reales del scraper.
 * Sin auth — solo campos que ya son públicos en el anuncio de origen.
 *
 * Reglas duras (mismas que el feed): vivienda residencial, anuncio
 * fresco y descuento dentro de rango plausible. Un descuento del 99 %
 * es siempre un valoración mal calculada, no un chollo.
 */
const MAX_CREDIBLE_DISCOUNT = 70;
const MIN_DISCOUNT = 18;

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("listings")
    .select(
      "id, title, price, city, postal_code, thumbnail_url, source_portal, bedrooms, sqm, property_kind, scraped_at, opportunity_discount_pct, opportunity_valuation_mid"
    )
    .eq("status", "active")
    .eq("operation", "sale")
    .eq("is_opportunity", true)
    .not("opportunity_valuation_mid", "is", null)
    .gte("opportunity_discount_pct", MIN_DISCOUNT)
    .lte("opportunity_discount_pct", MAX_CREDIBLE_DISCOUNT)
    .gt("price", 3000)
    .order("opportunity_discount_pct", { ascending: false })
    .limit(90);

  if (error) {
    return NextResponse.json({ items: [] });
  }

  const items = (data ?? [])
    .filter(
      (r) =>
        isResidentialPropertyKind(r.property_kind as string | null) &&
        listingWithinFreshWindow(r.scraped_at as string | null)
    )
    .slice(0, 24)
    .map((r) => ({
      id: r.id as string,
      title: (r.title as string) ?? null,
      price: Number(r.price),
      city: (r.city as string) ?? null,
      postalCode: (r.postal_code as string) ?? null,
      thumbnailUrl: (r.thumbnail_url as string) ?? null,
      sourcePortal: (r.source_portal as string) ?? null,
      bedrooms: (r.bedrooms as number) ?? null,
      sqm: (r.sqm as number) ?? null,
      discountPct: r.opportunity_discount_pct != null ? Number(r.opportunity_discount_pct) : null,
      valuationMid: r.opportunity_valuation_mid != null ? Number(r.opportunity_valuation_mid) : null,
    }));

  return NextResponse.json({ items });
}
