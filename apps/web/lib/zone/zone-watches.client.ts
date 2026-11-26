import type { ScanRunFilters } from "@/lib/scan/bedroom-filter";

export type ZoneWatch = {
  id: string;
  postalCode: string;
  label: string | null;
  filters: ScanRunFilters;
  createdAt: string;
};

const KEY = "pi-zone-watches-v1";

function readAll(): ZoneWatch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ZoneWatch[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(watches: ZoneWatch[]) {
  localStorage.setItem(KEY, JSON.stringify(watches.slice(0, 40)));
}

export function listZoneWatches(): ZoneWatch[] {
  return readAll().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function saveZoneWatch(input: {
  postalCode: string;
  label?: string | null;
  filters: ScanRunFilters;
}): ZoneWatch {
  const cp = input.postalCode.replace(/\D/g, "").slice(0, 5);
  const watch: ZoneWatch = {
    id: `${cp}-${Date.now()}`,
    postalCode: cp,
    label: input.label ?? null,
    filters: input.filters,
    createdAt: new Date().toISOString(),
  };
  const next = readAll().filter((w) => w.postalCode !== cp);
  next.unshift(watch);
  writeAll(next);
  return watch;
}

export function removeZoneWatch(id: string) {
  writeAll(readAll().filter((w) => w.id !== id));
}