#!/usr/bin/env node
/**
 * Uso: node scripts/ops/run-scrape-cp.mjs 04638
 * (GitHub Actions: env SUPABASE_* desde secrets)
 */
const cp = String(process.argv[2] ?? "")
  .replace(/\D/g, "")
  .slice(0, 5);
if (cp.length !== 5) {
  console.error("CP inválido");
  process.exit(2);
}

const { scrapeByPostalCode } = await import("../scrapers/lib/scrape-by-postal-code.mjs");
const result = await scrapeByPostalCode(cp, { force: true });
console.log(JSON.stringify(result, null, 2));
const ok = Boolean(result.ok || result.meetsTarget || (result.countAfter ?? 0) >= 25);
process.exit(ok ? 0 : 1);