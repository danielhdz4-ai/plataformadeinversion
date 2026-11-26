/**
 * Crea/enlaza y despliega en la cuenta danielhdz5-ai sin wizard interactivo.
 * Requiere en .env.local (gitignored):
 *   VERCEL_TOKEN_DANIELHDZ5=<token desde vercel.com/account/tokens>
 *   VERCEL_TEAM_SLUG_DANIELHDZ5=danielhdz5-ai  (opcional; si omites, usa scope personal)
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
for (const p of [join(root, ".env.local"), join(root, "apps/web/.env.local")]) {
  try {
    const raw = readFileSync(p, "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^(VERCEL_TOKEN_DANIELHDZ5|VERCEL_TEAM_SLUG_DANIELHDZ5)=(.+)$/);
      if (!m) continue;
      const v = m[2].trim().replace(/^["']|["']$/g, "");
      process.env[m[1]] = v;
    }
  } catch {
    /* skip */
  }
}

const token = process.env.VERCEL_TOKEN_DANIELHDZ5?.trim();
if (!token) {
  console.error(
    JSON.stringify({
      ok: false,
      error: "Falta VERCEL_TOKEN_DANIELHDZ5 en .env.local",
      hint: "Vercel → danielhdz5-ai → Account Settings → Tokens → Create",
    })
  );
  process.exit(1);
}

const scope = process.env.VERCEL_TEAM_SLUG_DANIELHDZ5?.trim() || undefined;
const web = join(root, "apps/web");
const projectName = "plataformadeinversion";
const scopeArgs = scope ? ["--scope", scope] : [];

function run(args, cwd = root) {
  const r = spawnSync("vercel", args, {
    cwd,
    env: { ...process.env, VERCEL_TOKEN: token },
    encoding: "utf8",
    shell: true,
  });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.status !== 0) {
    console.error(out);
    process.exit(r.status ?? 1);
  }
  return out;
}

run(["link", "-y", "--project", projectName, ...scopeArgs], web);
run(["deploy", "--prod", "--non-interactive", ...scopeArgs]);
console.log(JSON.stringify({ ok: true, project: projectName, scope: scope ?? "personal" }));