import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function resolveCreateClient() {
  const injected = globalThis.__PI_CREATE_SUPABASE__;
  if (typeof injected === "function") {
    return injected;
  }
  const roots = new Set([
    process.cwd(),
    join(here, "../../../../"),
    join(here, "../../../../../"),
    join(here, "../../../../../../"),
    join(process.cwd(), "../.."),
  ]);
  for (const root of roots) {
    const pkg = join(root, "package.json");
    if (!existsSync(pkg)) continue;
    try {
      const req = createRequire(pkg);
      return req("@supabase/supabase-js").createClient;
    } catch {
      /* next root */
    }
  }
  throw new Error("Cannot resolve @supabase/supabase-js for scrapers");
}

const createClient = resolveCreateClient();

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key);
}

export function dryRun() {
  return process.env.DRY_RUN === "1";
}

export function maxListings() {
  const n = Number(
    process.env.MAX_LISTINGS ?? process.env.KELIFY_MAX_LISTINGS ?? (process.env.KELIFY_FULL === "1" ? "3000" : "800")
  );
  return Number.isFinite(n) ? n : 800;
}
