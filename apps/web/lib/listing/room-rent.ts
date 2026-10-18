import type { RentComparable } from "@/lib/listing/summary-types";

export type RoomRentComparable = RentComparable & {
  thumbnailUrl?: string | null;
  sourceUrl?: string | null;
};

const ROOM_TITLE =
  /habitaci|room|hab\.|compart|shared|piso compart|coloc|alquiler de habit/i;

/** Heurística: anuncio de habitación vs piso entero en alquiler. */
export function isRoomRentComparable(c: RentComparable): boolean {
  const price = Number(c.price);
  if (!Number.isFinite(price) || price < 180 || price > 950) return false;
  const t = (c.title ?? "").toLowerCase();
  if (ROOM_TITLE.test(t)) return true;
  if (price <= 720 && (c.sqm == null || c.sqm <= 28)) return true;
  return false;
}

export function splitRentComparables(comps: RentComparable[]) {
  const rooms: RentComparable[] = [];
  const whole: RentComparable[] = [];
  for (const c of comps) {
    if (isRoomRentComparable(c)) rooms.push(c);
    else whole.push(c);
  }
  return { rooms, whole };
}

export function estimateRoomRentMonthly(
  roomComps: RentComparable[],
  bedrooms: number | null | undefined
): { total: number | null; perRoom: number | null; conservativePerRoom: number | null } {
  const prices = roomComps.map((c) => c.price).filter((p) => p > 0).sort((a, b) => a - b);
  if (!prices.length) return { total: null, perRoom: null, conservativePerRoom: null };
  const mid = prices[Math.floor(prices.length / 2)]!;
  const p10 = prices[Math.floor(prices.length * 0.25)] ?? mid;
  const conservativePerRoom = Math.round(p10 * 0.95);
  const perRoom = Math.round(mid);
  const n = Math.max(1, bedrooms ?? 2);
  return {
    perRoom,
    conservativePerRoom,
    total: Math.round(perRoom * n),
  };
}
