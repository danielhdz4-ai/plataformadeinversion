/**
 * Mensajes visibles de un scan. Los errores técnicos (timeouts, stack, RPC)
 * NUNCA llegan a la UI: se registran en logs y aquí se traducen a texto de producto.
 */

/** `error_message` que se puede mostrar tal cual al usuario. */
export function safeScanMessage(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const msg = raw.trim();
  const technical =
    /timeout|timed out|ECONN|ETIMEDOUT|RPC|postgrest|supabase|stack|TypeError|undefined is not|fetch failed|abort|ingest_|_timeout|SQL|relation "|column "/i;
  if (technical.test(msg)) return null;
  return msg;
}

/** Texto de progreso durante el ingest (siempre humano). */
export const SCAN_PROGRESS_TEXT = {
  preparing: "Preparando el análisis de la zona…",
  scraping: "Buscando anuncios en los portales…",
  ingesting: "Ampliando cobertura del barrio…",
  ranking: "Estimando alquiler y calculando ROI…",
  done: "Análisis completado",
} as const;

/** Aviso amable cuando el barrio tiene menos stock del objetivo. */
export function lowStockNotice(inZone: number): string {
  return `Hemos encontrado ${inZone} viviendas en esta zona. Prueba a ampliar el radio o elige un barrio cercano para ver más opciones.`;
}

/** Aviso amable si no hay ninguna vivienda. */
export const EMPTY_ZONE_NOTICE =
  "Todavía no tenemos viviendas para esta zona. Estamos ampliando la cobertura; vuelve en unas horas o prueba otra zona.";
