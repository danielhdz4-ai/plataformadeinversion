const id = process.argv[2] ?? "485000";
const url = `https://kelify.com/properties/${id}`;
const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" } });
const h = await r.text();
console.log(url, r.status, h.length);
const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
for (const b of ld) {
  try {
    const j = JSON.parse(b[1]);
    if (j["@type"] !== "Organization" && j["@type"] !== "WebSite") {
      console.log(JSON.stringify(j, null, 2).slice(0, 1200));
    }
  } catch {}
}
const title = h.match(/<title>([^<]+)/);
console.log("title", title?.[1]);
