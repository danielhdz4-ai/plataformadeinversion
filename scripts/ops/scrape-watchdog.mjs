/**
 * Bucle continuo de ingestión (Hipoges, Solvia, batch España pisos).
 * Uso en servidor/PC siempre encendido o CI local:
 *   node scripts/ops/run-with-web-env.mjs node scripts/ops/scrape-watchdog.mjs
 */
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

async function bankScrapeAlreadyRunning() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  const supabase = createClient(url, key);
  const { data } = await supabase
    .from("scrape_runs")
    .select("id")
    .eq("status", "running")
    .in("source", ["hipoges", "solvia"])
    .limit(1);
  return (data?.length ?? 0) > 0;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const CYCLE_MS = Number(process.env.SCRAPE_CYCLE_MS ?? String(4 * 60 * 60 * 1000));

const STEPS = [
  {
    name: "bank-portals",
    script: "scripts/jobs/scrape-bank-portals-spain.mjs",
    env: {
      MAX_LISTINGS: process.env.WATCHDOG_BANK_MAX ?? "1500",
      SOLVIA_MAX_PAGES: process.env.WATCHDOG_SOLVIA_PAGES ?? "24",
      HIPOGES_PAGE_SIZE: "40",
      PAUSE_MS: "550",
    },
  },
  {
    name: "p1-portals",
    script: "scripts/jobs/scrape-p1-portals-spain.mjs",
    env: {
      MAX_LISTINGS: process.env.WATCHDOG_P1_MAX ?? "500",
      FOTOCASA_MAX_PAGES: "4",
      HABITACLIA_MAX_PAGES: "2",
      PAUSE_MS: "900",
    },
  },
  {
    name: "spain-pisos-batch",
    script: "scripts/jobs/scrape-spain-batch.mjs",
    env: {
      TIER: "all",
      BATCH_SIZE: "999",
      MAX_LISTINGS: process.env.WATCHDOG_PISOS_MAX ?? "40",
      PAUSE_MS: "3500",
    },
  },
  {
    name: "finalize-runs",
    script: "scripts/jobs/finalize-stale-scrape-runs.mjs",
    env: {},
  },
];

function runStep(step) {
  console.log(JSON.stringify({ at: new Date().toISOString(), event: "start", step: step.name }));
  const env = { ...process.env, ...step.env };
  const r = spawnSync(process.execPath, [join(root, step.script)], {
    cwd: root,
    env,
    stdio: "inherit",
    shell: false,
  });
  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      event: "end",
      step: step.name,
      code: r.status ?? 1,
    })
  );
  return r.status === 0;
}

console.log(JSON.stringify({ ok: true, event: "watchdog_boot", cycleMs: CYCLE_MS }));

for (;;) {
  for (const step of STEPS) {
    try {
      if (step.name === "bank-portals" && (await bankScrapeAlreadyRunning())) {
        console.log(
          JSON.stringify({
            at: new Date().toISOString(),
            event: "skip",
            step: step.name,
            reason: "hipoges_or_solvia_run_in_progress",
          })
        );
        continue;
      }
      runStep(step);
    } catch (e) {
      console.error(step.name, e);
    }
    await sleep(Number(process.env.SCRAPE_STEP_PAUSE_MS ?? "15000"));
  }
  console.log(JSON.stringify({ at: new Date().toISOString(), event: "cycle_sleep", ms: CYCLE_MS }));
  await sleep(CYCLE_MS);
}
