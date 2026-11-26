const csrfRes = await fetch("https://realestate.hipoges.com/api/security/csrf-token", {
  headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
});
const csrfJson = await csrfRes.json();
const csrf = csrfJson.token ?? csrfJson.csrfToken ?? csrfJson;
console.log("csrf keys", Object.keys(csrfJson));

const body = {
  query: {
    sort: [{ field: "_features.featuresBuildYear", order: 1 }],
    joiner: "and",
    conditions: [
      { name: "_address.country", operator: "equal", value: "Spain" },
      { name: "_assetInfo._operation.operationType", operator: "equal", value: "sale" },
    ],
  },
  pagination: { page: 0, size: 10 },
};

const headers = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0",
  Origin: "https://realestate.hipoges.com",
  Referer: "https://realestate.hipoges.com/es/point/venta/pisos-y-casas/espana/5",
};
if (typeof csrf === "string") headers["X-CSRF-TOKEN"] = csrf;
else if (csrfJson.token) headers["X-CSRF-TOKEN"] = csrfJson.token;

const res = await fetch("https://realestate.hipoges.com/api/assets/listing", {
  method: "POST",
  headers,
  body: JSON.stringify(body),
});
const text = await res.text();
console.log("status", res.status, text.slice(0, 1500));
