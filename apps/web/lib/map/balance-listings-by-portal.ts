/** Evita que el top-N por ROI en bbox grande sea casi todo un solo portal (p. ej. pisos_com). */
export function balanceListingsByPortal<T extends { id: string }>(
  rows: T[],
  portalForId: (id: string) => string | null | undefined,
  limit: number,
  fetchedCap: number
): T[] {
  if (rows.length <= limit) return rows;
  if (rows.length < Math.floor(fetchedCap * 0.9)) return rows.slice(0, limit);

  const byPortal = new Map<string, T[]>();
  for (const row of rows) {
    const portal = portalForId(row.id) ?? "unknown";
    const list = byPortal.get(portal);
    if (list) list.push(row);
    else byPortal.set(portal, [row]);
  }

  if (byPortal.size <= 1) return rows.slice(0, limit);

  const portals = [...byPortal.keys()];
  const pickedIds = new Set<string>();
  const picked: T[] = [];
  let round = 0;

  while (picked.length < limit) {
    let added = false;
    for (const portal of portals) {
      const row = byPortal.get(portal)?.[round];
      if (!row || pickedIds.has(row.id)) continue;
      picked.push(row);
      pickedIds.add(row.id);
      added = true;
      if (picked.length >= limit) break;
    }
    if (!added) break;
    round++;
  }

  return picked;
}

/** Lista en UI: alternar fuentes para que no parezca solo pisos.com arriba del todo. */
export function interleaveByPortal<T>(
  items: T[],
  portalFor: (item: T) => string | null | undefined
): T[] {
  if (items.length <= 1) return items;

  const byPortal = new Map<string, T[]>();
  for (const item of items) {
    const portal = portalFor(item) ?? "unknown";
    const list = byPortal.get(portal);
    if (list) list.push(item);
    else byPortal.set(portal, [item]);
  }

  if (byPortal.size <= 1) return items;

  const portals = [...byPortal.keys()];
  const out: T[] = [];
  let round = 0;

  while (out.length < items.length) {
    let added = false;
    for (const portal of portals) {
      const row = byPortal.get(portal)?.[round];
      if (!row) continue;
      out.push(row);
      added = true;
      if (out.length >= items.length) break;
    }
    if (!added) break;
    round++;
  }

  return out;
}
