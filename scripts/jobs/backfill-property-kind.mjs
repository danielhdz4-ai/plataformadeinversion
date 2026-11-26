/**
 * Backfill de tipología + títulos limpios en `listings`.
 *
 *   1. Deriva `property_kind` desde el enum del título (`INTERMEDIATE_FLOOR · …`).
 *   2. Elimina el enum del título.
 *   3. Normaliza espacios dobles.
 *   4. Rellena `property_kind` desde el texto del título cuando siga vacío.
 *
 *   node --env-file=.env.local scripts/jobs/backfill-property-kind.mjs
 *   DRY_RUN=1 … para simular.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) process.exit(1);
const supabase = createClient(url, key);
const dryRun = process.env.DRY_RUN === "1";

function kindFromEnum(enumText) {
  const e = enumText.toUpperCase();
  if (/GARAGE|PARKING/.test(e)) return "garaje";
  if (/STORAGE/.test(e)) return "trastero";
  if (/COMMERCIAL_PREMISES|OFFICE/.test(e)) return "local";
  if (/WAREHOUSE/.test(e)) return "nave";
  if (/PLOT|LAND/.test(e)) return "terreno";
  if (/PENTHOUSE|ATTIC|DUPLEX/.test(e)) return "atico";
  if (/STUDIO/.test(e)) return "estudio";
  if (/HOUSE|CHALET|VILLA/.test(e)) return "casa";
  if (/FLAT|APARTMENT|FLOOR/.test(e)) return "piso";
  return null;
}

function kindFromTitle(text) {
  const t = String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/garaje|parking/.test(t)) return "garaje";
  if (/trastero/.test(t)) return "trastero";
  if (/local/.test(t)) return "local";
  if (/oficina/.test(t)) return "oficina";
  if (/nave/.test(t)) return "nave";
  if (/terreno|solar|parcela/.test(t)) return "terreno";
  if (/atico|penthouse/.test(t)) return "atico";
  if (/duplex/.test(t)) return "duplex";
  if (/estudio|loft/.test(t)) return "estudio";
  if (/casa|chalet|adosado|pareado|villa|unifamiliar/.test(t)) return "casa";
  if (/piso|apartamento|vivienda/.test(t)) return "piso";
  return null;
}

const ENUM_RE = /^([A-Z][A-Z_]{4,})\s*·\s*/;
const PAGE = 120;
const CONCURRENCY = 10;
let offset = 0;
const stats = { scanned: 0, kindFromEnum: 0, kindFromTitle: 0, titlesCleaned: 0, errors: 0 };

/** Actualiza en paralelo; si el lote falla cae a updates individuales. */
async function flush(patchList) {
  for (let i = 0; i < patchList.length; i += CONCURRENCY) {
    const slice = patchList.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      slice.map(([id, patch]) => supabase.from("listings").update(patch).eq("id", id))
    );
    for (const r of results) {
      if (r.error) {
        stats.errors++;
        console.error("update", r.error.message);
      }
    }
  }
}

while (true) {
  let data;
  {
    const res = await supabase
      .from("listings")
      .select("id, title, property_kind")
      .order("id")
      .range(offset, offset + PAGE - 1);
    if (res.error) {
      console.error(res.error.message);
      process.exit(1);
    }
    data = res.data;
  }
  if (!data?.length) break;
  offset += data.length;

  const pending = [];
  for (const row of data) {
    stats.scanned++;
    const title = row.title ?? "";
    const patch = {};
    const enumMatch = title.match(ENUM_RE);
    if (enumMatch && !row.property_kind) {
      const k = kindFromEnum(enumMatch[1]);
      if (k) {
        patch.property_kind = k;
        stats.kindFromEnum++;
      }
    }
    if (enumMatch) {
      patch.title = title.replace(ENUM_RE, "").replace(/\s{2,}/g, " ").trim();
      stats.titlesCleaned++;
    } else if (/\s{2,}/.test(title)) {
      patch.title = title.replace(/\s{2,}/g, " ").trim();
      stats.titlesCleaned++;
    }
    if (!row.property_kind && !patch.property_kind) {
      const k = kindFromTitle(patch.title ?? title);
      if (k) {
        patch.property_kind = k;
        stats.kindFromTitle++;
      }
    }
    if (Object.keys(patch).length === 0) continue;
    if (dryRun) continue;
    pending.push([row.id, patch]);
  }
  if (!dryRun && pending.length) await flush(pending);
  if (data.length < PAGE) break;
}

console.log(JSON.stringify({ ok: true, dryRun, ...stats }));
