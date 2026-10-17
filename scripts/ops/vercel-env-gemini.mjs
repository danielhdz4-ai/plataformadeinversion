import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const raw = [
  readFileSync(join(root, ".env.local"), "utf8"),
  readFileSync(join(root, "apps/web/.env.local"), "utf8"),
].join("\n");
const m = raw.match(/^GEMINI_API_KEY=(.+)$/m);
if (!m) {
  console.error("GEMINI_API_KEY not in .env.local");
  process.exit(1);
}
let key = m[1].trim();
if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
  key = key.slice(1, -1);
}

for (const target of ["production", "preview", "development"]) {
  const r = spawnSync(
    "npx",
    ["vercel", "env", "add", "GEMINI_API_KEY", target, "--scope", "danielhdz4-ais-projects", "--yes"],
    { cwd: join(root, "apps/web"), input: key, stdio: ["pipe", "pipe", "pipe"] }
  );
  const out = (r.stderr?.toString() || r.stdout?.toString() || "").trim();
  console.log(target, r.status === 0 ? "ok" : out.slice(0, 300));
}
