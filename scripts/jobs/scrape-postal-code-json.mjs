/** Salida JSON para invocar desde Vercel (spawn). */
import { scrapeByPostalCode } from "../scrapers/lib/scrape-by-postal-code.mjs";

const cp = process.argv[2];
if (!cp) {
  console.error(JSON.stringify({ ok: false, error: "missing cp" }));
  process.exit(1);
}

process.env.SCAN_CP_SKIP_PLAYWRIGHT = "1";

try {
  const result = await scrapeByPostalCode(cp, { force: true });
  console.log(JSON.stringify(result));
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
}
