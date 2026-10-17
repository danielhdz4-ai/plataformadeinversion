import { isOpenAccess, openAccessUserId } from "@/lib/open-access";
import { clientRateLimitKey, rateLimit } from "@/lib/api/rate-limit";
import { getDbClient, requireAppUser } from "@/lib/supabase/request-client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  minLng: z.number(),
  minLat: z.number(),
  maxLng: z.number(),
  maxLat: z.number(),
  note: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAppUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rl = rateLimit(`map-req:${clientRateLimitKey(req, auth.user.id)}`, { limit: 10, windowMs: 3600_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { minLng, minLat, maxLng, maxLat, note } = parsed.data;
  const supabase = await getDbClient();
  const userId = isOpenAccess() ? openAccessUserId() : auth.user.id;

  const { error } = await supabase.from("user_map_requests").insert({
    user_id: userId,
    min_lng: minLng,
    min_lat: minLat,
    max_lng: maxLng,
    max_lat: maxLat,
    note: note ?? null,
  });

  if (error) {
    const missing = error.message.includes("user_map_requests") && error.message.includes("does not exist");
    return NextResponse.json(
      { error: missing ? "Solicitudes aún no activas (migración pendiente)" : error.message },
      { status: missing ? 503 : 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
