import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const web = join(root, "apps/web");
const secret = process.env.CRON_SECRET ?? randomBytes(24).toString("hex");

for (const target of ["production", "preview"]) {
  const r = spawnSync(
    "vercel",
    ["env", "add", "CRON_SECRET", target, "--scope", "danielhdz4-ais-projects", "--yes"],
    { cwd: web, input: `${secret}\n`, encoding: "utf8", shell: true }
  );
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.status !== 0 && !out.includes("already exists")) {
    console.error(out);
    process.exit(r.status ?? 1);
  }
}

spawnSync(
  "vercel",
  ["env", "add", "CRON_BANK_MAX_LISTINGS", "production", "--scope", "danielhdz4-ais-projects", "--yes"],
  { cwd: web, input: "150\n", encoding: "utf8", shell: true }
);

console.log(JSON.stringify({ ok: true, cronSecretConfigured: true }));
