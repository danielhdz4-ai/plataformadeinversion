const path = process.argv[2] ?? "/venta-viviendas/valencia-valencia/eixample/";
const url = `https://www.idealista.com${path}`;
const res = await fetch(url, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html",
    "Accept-Language": "es-ES,es;q=0.9",
  },
  redirect: "follow",
});
console.log("status", res.status, url);
const html = await res.text();
console.log("len", html.length);
const ids = (html.match(/data-adid="/g) ?? []).length;
const alt = (html.match(/inmueble\/\d+/g) ?? []).length;
console.log("data-adid", ids, "inmueble slugs", alt);
console.log("blocked", /captcha|datadome|access denied/i.test(html));
