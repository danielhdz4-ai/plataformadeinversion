import { openAccessUserId } from "@/lib/open-access";
import { getDbClient, requireAppUser } from "@/lib/supabase/request-client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  polygon: z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
  }),
  filters: z.record(z.unknown()).optional(),
  operation: z.string().default("buy_to_rent"),
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
