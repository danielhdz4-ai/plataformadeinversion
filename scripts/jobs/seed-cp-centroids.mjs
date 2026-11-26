/**
 * Rellena public.cp_centroids vía Zippopotam (España).
 * Uso: node --env-file=.env.local scripts/jobs/seed-cp-centroids.mjs [--all]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getSupabase } from "../scrapers/lib/env.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const seed = JSON.parse(readFileSync(join(root, "scripts/data/cp-priority-seed.json"), "utf8"));

const allFlags = process.argv.includes("--all");
const extra = process.argv.filter((a) => /^\d{5}$/.test(a));

const cps = [
  ...new Set([
    ...(seed.tier1_capitals ?? []),
    ...(seed.coastal_and_tourism ?? []),
    ...(seed.rural_priority ?? []),
    ...extra,
  ]),
];

if (allFlags) {
  const { data } = await getSupabase()
    .from("listings")
    .select("postal_code")
    .eq("status", "active")
    .not("postal_code", "is", null)
    .limit(5000);
  for (const row of data ?? []) {
    const pc = String(row.postal_code).replace(/\D/g, "").slice(0, 5);
    if (pc.length === 5) cps.push(pc);
  }
}

const unique = [...new Set(cps)];
const supabase = getSupabase();

async function zippopotam(cp) {
  const res = await fetch(`https://api.zippopotam.us/ES/${cp}`);
  if (!res.ok) return null;
  const data = await res.json();
  const p = data.places?.[0];
  if (!p?.latitude || !p.longitude) return null;
  return {
    postal_code: cp,
    lat: Number(p.latitude),
    lng: Number(p.longitude),
    label: [`CP ${cp}`, p["place name"], p.state, "España"].filter(Boolean).join(", "),
    source: "zippopotam",
    updated_at: new Date().toISOString(),
  };
}

let ok = 0;
let fail = 0;
for (let i = 0; i < unique.length; i++) {
  const cp = unique[i];
  const row = await zippopotam(cp);
  if (!row) {
    fail++;
    continue;
  }
  const { error } = await supabase.from("cp_centroids").upsert(row);
  if (error) {
    if (/cp_centroids|does not exist/i.test(error.message)) {
      console.error("Tabla cp_centroids no existe. Aplica migración supabase.");
      process.exit(1);
    }
    fail++;
    continue;
  }
  ok++;
  if ((i + 1) % 10 === 0) process.stderr.write(`[${i + 1}/${unique.length}]\n`);
  await new Promise((r) => setTimeout(r, 120));
}

console.log(JSON.stringify({ ok: true, seeded: ok, failed: fail, total: unique.length }, null, 2));
process.exit(fail > unique.length * 0.5 ? 1 : 0);