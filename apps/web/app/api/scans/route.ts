import { openAccessUserId } from "@/lib/open-access";
import { getDbClient, requireAppUser } from "@/lib/supabase/request-client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const filtersSchema = z
  .object({
    priceMin: z.coerce.number().min(0).optional(),
    priceMax: z.coerce.number().min(0).optional(),
    bedroomsMin: z.coerce.number().min(0).optional(),
    allowedBedrooms: z.array(z.coerce.number().int().min(0).max(20)).optional(),
    bedroomsMinPlus: z.coerce.number().int().min(1).nullable().optional(),
    sqmMin: z.coerce.number().min(0).optional(),
    sqmMax: z.coerce.number().min(0).optional(),
    allowedBathrooms: z.array(z.coerce.number().int().min(0).max(20)).optional(),
    bathroomsMinPlus: z.coerce.number().int().min(1).nullable().optional(),
    sourcePortals: z.array(z.string()).optional(),
    minRoiGross: z.coerce.number().min(0).max(100).optional(),
    onlyWithRoi: z.boolean().optional(),
  })
  .passthrough();

const bodySchema = z.object({
  polygon: z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
  }),
  filters: filtersSchema.optional(),
  operation: z
    .enum(["buy", "buy_to_rent", "buy_to_rent_rooms", "buy_to_rent_airbnb", "sublease", "sublease_rooms", "flip"])
    .default("buy_to_rent"),
});

export async function POST(req: NextRequest) {
  const auth = await requireAppUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error, code: "AUTH" }, { status: auth.status });
  }
  const supabase = await getDbClient();
  const user = auth.user;

  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message, code: "VALIDATION" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("scans")
    .insert({
      user_id: user.id || openAccessUserId(),
      polygon: parsed.data.polygon,
      filters: parsed.data.filters ?? {},
      operation: parsed.data.operation,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message, code: "DB" }, { status: 500 });
  return NextResponse.json({ scanId: data.id, status: "pending" });
}
