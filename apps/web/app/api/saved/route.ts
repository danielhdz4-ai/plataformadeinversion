import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("saved_deals")
    .select("id, listing:listings(id, title, price, source_url)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const items = (data ?? []).map((row) => ({
    id: row.id,
    listing: Array.isArray(row.listing) ? row.listing[0] : row.listing,
  }));
  return NextResponse.json({ items });
}

const postSchema = z.object({ listingId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { error } = await supabase.from("saved_deals").insert({
    user_id: user.id,
    listing_id: parsed.data.listingId,
  });

  if (error) {
    if (error.code === "23505") return NextResponse.json({ ok: true, saved: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, saved: true });
}
