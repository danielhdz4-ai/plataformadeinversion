/**
 * Verificación local del stack de scrapers (sin Next).
 * Uso: node --env-file=.env.local scripts/ops/verify-scraper-stack.mjs [cp]
 */
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const cp = process.argv[2] ?? "41001";
const root = process.cwd();

async function importFromRoot(rel) {
  const href = pathToFileURL(join(root, rel)).href;
  return import(href);
}

const results = { ok: true, cp, steps: [] };

function step(name, pass, detail) {
  results.steps.push({ name, pass, detail });
  if (!pass) results.ok = false;
  console.log(pass ? "✓" : "✗", name, detail ?? "");
}

try {
  const { fetchFotocasaListPage } = await importFromRoot("scripts/scrapers/lib/fotocasa-api.mjs");
  const fc = await fetchFotocasaListPage("sevilla-capital", 1);
  step("fotocasa-list", (fc.listings?.length ?? 0) >= 5, `cards=${fc.listings?.length ?? 0}`);

  const appsWebRoot = join(root, "apps/web");
  const bridgeHref = pathToFileURL(
    join(appsWebRoot, "lib/scrape/load-scraper-module.ts")
  ).href;
  let bridgeOk = false;
  try {
    await import(bridgeHref);
    bridgeOk = true;
  } catch (e) {
    bridgeOk = false;
  }
  step(
    "scraper-bridge-ts",
    bridgeOk === false,
    bridgeOk
      ? "unexpected (run via Next)"
      : "TS bridge solo en Next — probando import MJS equivalente"
  );

  const mjsBridge = pathToFileURL(join(root, "scripts/scrapers/lib/scrape-by-postal-code.mjs")).href;
  const { scrapeByPostalCode } = await import(mjsBridge);

  process.env.SCRAPE_CP_FOTOCASA_PAGES = "2";
  process.env.SCRAPE_CP_PISOS_PAGES = "2";
  process.env.SCRAPE_CP_PISOS_MAX = "35";
  process.env.SCRAPE_CP_BOOST_ROUNDS = "0";
  process.env.SCAN_HIPOGES_MAX_PAGES = "3";

  const t0 = Date.now();
  const scrape = await scrapeByPostalCode(cp, {
    force: true,
    portals: ["fotocasa", "pisos_com", "hipoges"],
  });
  const ms = Date.now() - t0;

  const by = scrape.byPortal ?? {};
  const fotocasaN = by.fotocasa ?? 0;
  const pisosN = by.pisos_com ?? 0;
  step("cp-scrape-fotocasa", fotocasaN >= 10, `${fotocasaN} en BD`);
  step("cp-scrape-pisos", pisosN >= 1, `${pisosN} en BD`);
  step("cp-scrape-total", (scrape.countAfter ?? 0) >= 15, `${scrape.countAfter} total (${ms}ms)`);
  step("cp-scrape-skip-playwright", process.env.SCAN_CP_SKIP_PLAYWRIGHT === "1", "Kelify/habitaclia off");

  const { getSupabase } = await importFromRoot("scripts/scrapers/lib/env.mjs");
  const supabase = getSupabase();
  const { data: rpcRows, error: rpcErr } = await supabase.rpc("listings_for_postal_code", {
    p_cp: cp,
    p_lng: -5.984,
    p_lat: 37.389,
    p_radius_m: 2800,
    max_rows: 50,
    portal_filter: "fotocasa",
  });
  step("rpc-listings_for_postal_code", !rpcErr && (rpcRows?.length ?? 0) > 0, rpcErr?.message ?? `rows=${rpcRows?.length ?? 0}`);
} catch (e) {
  results.ok = false;
  step("fatal", false, e instanceof Error ? e.message : String(e));
}

console.log("\n" + JSON.stringify(results, null, 2));
process.exit(results.ok ? 0 : 1);
