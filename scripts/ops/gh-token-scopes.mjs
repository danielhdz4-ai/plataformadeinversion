import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
let token = process.env.GH_TOKEN;
if (!token) {
  try {
    const raw = readFileSync(join(root, ".env.local"), "utf8");
    const m = raw.match(/^GH_TOKEN=(.+)$/m);
    token = m?.[1]?.trim();
  } catch {
    /* ignore */
  }
}
if (!token) {
  console.log(JSON.stringify({ ok: false, error: "no GH_TOKEN" }));
  process.exit(1);
}
const res = await fetch("https://api.github.com/user", {
  headers: { Authorization: `token ${token}`, "User-Agent": "pi-ops" },
});
console.log(
  JSON.stringify({
    ok: res.ok,
    status: res.status,
    scopes: res.headers.get("x-oauth-scopes"),
    login: res.ok ? (await res.json()).login : null,
  })
);
