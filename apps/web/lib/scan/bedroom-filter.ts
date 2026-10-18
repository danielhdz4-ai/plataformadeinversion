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

export type BathroomToggles = {
  b1: boolean;
  b2: boolean;
  b3: boolean;
  b4: boolean;
};

export function bathroomFilterFromToggles(baths: BathroomToggles): {
  allowedBathrooms: number[];
  bathroomsMinPlus: number | null;
} {
  const allowed: number[] = [];
  if (baths.b1) allowed.push(1);
  if (baths.b2) allowed.push(2);
  if (baths.b3) allowed.push(3);
  const bathroomsMinPlus = baths.b4 ? 4 : null;
  return { allowedBathrooms: allowed, bathroomsMinPlus };
}

export type ScanRunFilters = {
  priceMin?: number;
  priceMax?: number;
  bedroomsMin?: number;
  allowedBedrooms?: number[];
  bedroomsMinPlus?: number | null;
  sqmMin?: number;
  sqmMax?: number;
  allowedBathrooms?: number[];
  bathroomsMinPlus?: number | null;
  sourcePortals?: string[];
  minRoiGross?: number;
  onlyWithRoi?: boolean;
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
  if (parts.length > 0) {
    parts.push("bedrooms.is.null");
    return q.or(parts.join(","));
  }
  if (typeof filters.bedroomsMin === "number" && filters.bedroomsMin > 0) {
    return q.gte("bedrooms", filters.bedroomsMin);
  }
  return q;
}

/** Filtro baños sobre query Supabase. */
export function applyBathroomFilter<T extends { or: (f: string) => T; gte: (c: string, v: number) => T }>(
  q: T,
  filters: ScanRunFilters
): T {
  const parts: string[] = [];
  for (const b of filters.allowedBathrooms ?? []) {
    parts.push(`bathrooms.eq.${b}`);
  }
  if (filters.bathroomsMinPlus != null) {
    parts.push(`bathrooms.gte.${filters.bathroomsMinPlus}`);
  }
  if (parts.length > 0) {
    parts.push("bathrooms.is.null");
    return q.or(parts.join(","));
  }
  return q;
}
