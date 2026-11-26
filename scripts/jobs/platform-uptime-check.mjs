/**
 * Comprueba prod (web + Supabase). Email opcional vía Resend si falla.
 * GitHub Actions: cada hora.
 */
const site =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  process.env.PLATFORM_SITE_URL?.replace(/\/$/, "") ??
  "https://plataformadeinversion-three.vercel.app";

const resendKey = process.env.RESEND_API_KEY;
const to = process.env.OPS_ALERT_EMAIL ?? process.env.ALERT_EMAIL_TO;
const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";

async function fetchJson(path) {
  const res = await fetch(`${site}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(25_000),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  return { status: res.status, body };
}

async function sendAlert(subject, detail) {
  if (!resendKey || !to) {
    console.warn("RESEND_API_KEY or OPS_ALERT_EMAIL missing — skip email");
    return;
  }
  const html = `<pre style="font-family:monospace;font-size:13px">${detail.replace(/</g, "&lt;")}</pre>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    console.error("Resend failed", res.status, await res.text());
  }
}

const ping = await fetchJson("/api/ping");
const health = await fetchJson("/api/health");

const webUp = ping.status === 200 && ping.body?.ok === true;
const dbUp =
  health.body?.configured === true &&
  health.body?.reachable === true &&
  health.body?.db === true;
const platformOk = webUp && dbUp;

const report = {
  ok: platformOk,
  site,
  ping: { status: ping.status, ok: ping.body?.ok },
  health: {
    status: health.status,
    ok: health.body?.ok,
    db: health.body?.db,
    reachable: health.body?.reachable,
    host: health.body?.supabaseHost,
    error: health.body?.error ?? health.body?.schemaError,
    listingsCount: health.body?.listingsCount,
  },
  at: new Date().toISOString(),
};

console.log(JSON.stringify(report));

if (!platformOk) {
  const detail = JSON.stringify(report, null, 2);
  await sendAlert(`[Plataforma] CAÍDA o BD inaccesible — ${site}`, detail);
  process.exit(1);
}