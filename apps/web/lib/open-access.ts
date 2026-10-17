/** Acceso libre temporal (sin login) mientras desarrollamos la plataforma. */
export function isOpenAccess(): boolean {
  return (
    process.env.OPEN_ACCESS === "1" ||
    process.env.NEXT_PUBLIC_OPEN_ACCESS === "1"
  );
}

/** Usuario interno para scans en modo acceso libre (ver migración open_access). */
export function openAccessUserId(): string {
  return (
    process.env.OPEN_ACCESS_USER_ID ?? "00000000-0000-4000-8000-000000000001"
  );
}
