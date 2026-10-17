export type RoomToggles = {
  studio: boolean;
  r1: boolean;
  r2: boolean;
  r3: boolean;
  r4: boolean;
};

export type BedroomScanFilter = {
  allowedBedrooms: number[];
  bedroomsMinPlus: number | null;
  /** Etiqueta UI */
  bedroomsMin: number;
};

export function bedroomFilterFromRooms(rooms: RoomToggles): BedroomScanFilter {
  const allowed: number[] = [];
  if (rooms.studio) allowed.push(0);
  if (rooms.r1) allowed.push(1);
  if (rooms.r2) allowed.push(2);
  if (rooms.r3) allowed.push(3);
  const bedroomsMinPlus = rooms.r4 ? 4 : null;
  let bedroomsMin = 1;
  if (rooms.studio) bedroomsMin = 0;
  else if (allowed.length > 0) bedroomsMin = Math.min(...allowed);
  else if (bedroomsMinPlus != null) bedroomsMin = bedroomsMinPlus;
  return { allowedBedrooms: allowed, bedroomsMinPlus, bedroomsMin };
}

export type ScanRunFilters = {
  priceMin?: number;
  priceMax?: number;
  bedroomsMin?: number;
  allowedBedrooms?: number[];
  bedroomsMinPlus?: number | null;
};

/** Aplica filtro dormitorios sobre query Supabase. */
export function applyBedroomFilter<T extends { or: (f: string) => T; gte: (c: string, v: number) => T }>(
  q: T,
  filters: ScanRunFilters
): T {
  const parts: string[] = [];
  for (const b of filters.allowedBedrooms ?? []) {
    parts.push(`bedrooms.eq.${b}`);
  }
  if (filters.bedroomsMinPlus != null) {
    parts.push(`bedrooms.gte.${filters.bedroomsMinPlus}`);
  }
  if (parts.length > 0) return q.or(parts.join(","));
  if (typeof filters.bedroomsMin === "number" && filters.bedroomsMin > 0) {
    return q.gte("bedrooms", filters.bedroomsMin);
  }
  return q;
}
