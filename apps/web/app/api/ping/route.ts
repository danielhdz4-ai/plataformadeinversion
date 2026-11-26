import { NextResponse } from "next/server";

/** Uptime del front (Vercel). No usa Supabase. */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "plataformadeinversion-web",
      at: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}