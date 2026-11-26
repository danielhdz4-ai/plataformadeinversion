/** Dominio canónico de producción (override con NEXT_PUBLIC_SITE_URL). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://radarinversion.com").replace(/\/$/, "");
