/**
 * Rellena thumbnail_url desde og:image de la ficha (pisos + kelify).
 * node --env-file=.env.local scripts/jobs/backfill-thumbnails.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);

const supabase = createClient(url, key);

function ogImage(html) {
  const m =
    html.match(/property="og:image"\s+content="([^"]+)"/i) ??
    html.match(/content="([^"]+)"\s+property="og:image"/i) ??
    html.match(/<meta[^>]+og:image[^>]+content="([^"]+)"/i);
  return m?.[1] ?? null;
}

const { data: rows, error } = await supabase
  .from("listings")
  .select("id, source_url, thumbnail_url")
  .eq("status", "active")
  .eq("operation", "sale")
  .or("thumbnail_url.is.null,thumbnail_url.eq.")
  .limit(300);

if (error) throw error;

let updated = 0;
for (const row of rows ?? []) {
  if (!row.source_url) continue;
  try {
    const res = await fetch(row.source_url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PlataformaInversion/1.0)",
        Accept: "text/html",
        "Accept-Language": "es-ES,es;q=0.9",
      },
      redirect: "follow",
    });
    if (!res.ok) continue;
    const html = await res.text();
    const thumb = ogImage(html);
    if (!thumb) continue;
    const { error: upErr } = await supabase
      .from("listings")
      .update({ thumbnail_url: thumb })
      .eq("id", row.id);
    if (!upErr) updated++;
  } catch {
    /* skip */
  }
}

console.log(JSON.stringify({ ok: true, candidates: rows?.length ?? 0, updated }));
