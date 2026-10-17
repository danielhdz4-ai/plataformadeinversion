/**
 * Ejecuta P0: pisos venta/alquiler + kelify venta (Barcelona).
 * Uso: node --env-file=apps/web/.env.local scripts/scrapers/scrape-all-barcelona.mjs
 */
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const env = { ...process.env, MAX_LISTINGS: process.env.MAX_LISTINGS ?? "120" };

const jobs = [
  "scripts/scrapers/pisos-sale-barcelona.mjs",
  "scripts/scrapers/pisos-rent-barcelona.mjs",
  "scripts/scrapers/kelify-sale-barcelona.mjs",
];

for (const script of jobs) {
  console.log("\n>>>", script);
  await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [path.join(root, script)], {
      cwd: root,
      env,
      stdio: "inherit",
    });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${script} exit ${code}`))));
  });
}

console.log("\n>>> precompute ROI");
await new Promise((resolve, reject) => {
  const p = spawn(process.execPath, [path.join(root, "scripts/jobs/precompute-roi.mjs")], {
    cwd: root,
    env,
    stdio: "inherit",
  });
  p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`precompute exit ${code}`))));
});

console.log("\nDone scrape-all-barcelona");
