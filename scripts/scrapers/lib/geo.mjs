/** Distancia en km entre dos puntos WGS84. */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function polygonCenterAndRadiusKm(polygon) {
  const ring = polygon?.coordinates?.[0] ?? [];
  if (ring.length < 3) {
    return { lat: 40.4168, lng: -3.7038, radiusKm: 2 };
  }
  let sumLat = 0;
  let sumLng = 0;
  let n = 0;
  for (const c of ring) {
    if (c.length < 2) continue;
    sumLng += c[0];
    sumLat += c[1];
    n++;
  }
  const lng = sumLng / n;
  const lat = sumLat / n;
  let maxKm = 0.5;
  for (const c of ring) {
    const km = haversineKm(lat, lng, c[1], c[0]);
    if (km > maxKm) maxKm = km;
  }
  return { lat, lng, radiusKm: maxKm };
}
