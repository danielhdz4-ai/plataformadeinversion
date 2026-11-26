/**
 * B4 — Email operativo si scrapes críticos fallan o 3 runs seguidos con 0 inserciones.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendKey = process.env.RESEND_API_KEY;
const to = process.env.OPS_ALERT_EMAIL ?? process.env.ALERT_EMAIL_TO;
const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";

if (!url || !key) process.exit(1);

const supabase = createClient(url, key);
const issues = [];

const since = new Date(Date.now() - 36 * 3600_000).toISOString();
const { data: recent, error } = await supabase
  .from("scrape_runs")
  .select("id, source, city_slug, status, listings_inserted, started_at, error_message")
  .gte("started_at", since)
  .order("started_at", { ascending: false })
  .limit(200);

if (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exit(1);
}

for (const row of recent ?? []) {
  if (row.status === "failed") {
    issues.push({
      kind: "failed",
      source: row.source,
      city: row.city_slug,
      at: row.started_at,
      detail: row.error_message?.slice(0, 200) ?? "failed",
    });
  }
}

const groups = new Map();
for (const row of recent ?? []) {
  const k = `${row.source}|${row.city_slug ?? ""}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(row);
}

for (const [key, runs] of groups) {
  const last3 = runs.slice(0, 3);
  if (last3.length < 3) continue;
  if (last3.every((r) => (r.listings_inserted ?? 0) === 0)) {
    issues.push({
      kind: "zero_inserts_x3",
      key,
      runs: last3.map((r) => ({ at: r.started_at, status: r.status })),
    });
  }
}

const uniqueIssues = issues.slice(0, 20);
console.log(JSON.stringify({ ok: true, issueCount: uniqueIssues.length, issues: uniqueIssues }));

if (uniqueIssues.length === 0) process.exit(0);

if (!resendKey || !to) {
  console.warn("RESEND_API_KEY or OPS_ALERT_EMAIL missing — skip email");
  process.exit(0);
}

const subject = `[Plataforma] ${uniqueIssues.length} alerta(s) de scrape`;
const lines = uniqueIssues.map((i) => JSON.stringify(i)).join("\n");
const html = `<pre style="font-family:monospace;font-size:13px">${lines.replace(/</g, "&lt;")}</pre>`;

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${resendKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ from, to: [to], subject, html }),
});

if (!res.ok) {
  const body = await res.text();
  console.error(JSON.stringify({ ok: false, resend: res.status, body }));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, emailed: to }));
