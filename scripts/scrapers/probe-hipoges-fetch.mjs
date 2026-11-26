const home = await fetch("https://realestate.hipoges.com/es/point/venta/pisos-y-casas/espana/5", {
  headers: { "User-Agent": "Mozilla/5.0" },
});
const cookies = home.headers.getSetCookie?.() ?? [];
const cookieHeader = cookies.map((c) => c.split(";")[0]).join("; ");
const csrfRes = await fetch("https://realestate.hipoges.com/api/security/csrf-token", {
  headers: { "User-Agent": "Mozilla/5.0", Cookie: cookieHeader, Accept: "application/json" },
});
const csrfJson = await csrfRes.json();
const csrfMore = csrfRes.headers.getSetCookie?.() ?? [];
const allCookies = [...cookies, ...csrfMore].map((c) => c.split(";")[0]).join("; ");

const body = {
  query: {
    sort: [{ field: "_features.featuresBuildYear", order: 1 }],
    joiner: "and",
    conditions: [
      { name: "_address.country", operator: "equal", value: "Spain" },
      { name: "_assetInfo._operation.operationType", operator: "equal", value: "sale" },
      {
        joiner: "or",
        conditions: [
          { name: "_features.featuresType", operator: "equal", value: "flat" },
          { name: "_features.featuresType", operator: "equal", value: "house" },
        ],
      },
    ],
  },
  pagination: { itemsPerPage: 5, page: 1 },
};

const res = await fetch("https://realestate.hipoges.com/api/assets/listing", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    Cookie: allCookies,
    "X-CSRF-TOKEN": csrfJson.csrfToken,
    Origin: "https://realestate.hipoges.com",
    Referer: "https://realestate.hipoges.com/es/point/venta/pisos-y-casas/espana/5",
  },
  body: JSON.stringify(body),
});
console.log("status", res.status);
const j = await res.json();
console.log(JSON.stringify(j).slice(0, 2000));
