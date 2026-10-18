/** Rutas internas /app/* permitidas en ?from= para volver del detalle. */
export function sanitizeReturnPath(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  if (!raw.startsWith("/app/")) return null;
  if (raw.startsWith("//") || raw.includes("://")) return null;
  return raw.split("#")[0] ?? null;
}

export function listingDetailHref(listingId: string, returnTo?: string | null): string {
  const safe = sanitizeReturnPath(returnTo ?? null);
  if (!safe) return `/app/listings/${listingId}`;
  return `/app/listings/${listingId}?from=${encodeURIComponent(safe)}`;
}

export function returnNavLabel(returnPath: string): string {
  if (returnPath.startsWith("/app/scan/")) return "Volver al scan";
  if (returnPath.startsWith("/app/explorar")) return "Volver a explorar";
  if (returnPath.startsWith("/app/guardados")) return "Volver a guardados";
  return "Volver";
}

export function defaultReturnPath(): string {
  return "/app/explorar";
}
