import { NextRequest, NextResponse } from "next/server";

const ALLOW_SUFFIX = [
  "pisos.com",
  "kelify.com",
  "static.pisos.com",
  "images.pisos.com",
  "hipoges.azureedge.net",
  "cdnsolvproep.solvia.es",
];

function allowed(u: URL) {
  if (u.protocol !== "https:") return false;
  return ALLOW_SUFFIX.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("u");
  if (!raw) return new NextResponse("Missing u", { status: 400 });
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new NextResponse("Bad url", { status: 400 });
  }
  if (!allowed(target)) return new NextResponse("Forbidden host", { status: 403 });

  const res = await fetch(target.toString(), {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PlataformaInversion/1.0)" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return new NextResponse("Upstream error", { status: 502 });

  const ct = res.headers.get("content-type") ?? "image/jpeg";
  const buf = await res.arrayBuffer();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": ct,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
