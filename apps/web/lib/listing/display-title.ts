import { decodeListingTitle } from "../decode-html";

/**
 * Enums de tipología que llegan del scraping (`INTERMEDIATE_FLOOR`, `HOUSE_CHALET`…)
 * y no deben mostrarse al usuario.
 */
const ENUM_PREFIX = /^([A-Z][A-Z_]{4,})\s*·\s*/;
const KIND_LABEL: Record<string, string> = {
  PISO: "Piso",
  CASA: "Casa",
  ATICO: "Ático",
  DUPLEX: "Dúplex",
  ESTUDIO: "Estudio",
  GARAJE: "Garaje",
  TRASTERO: "Trastero",
  LOCAL: "Local",
  OFICINA: "Oficina",
  NAVE: "Nave",
  TERRENO: "Terreno",
};

/** Nombre legible de la tipología; `null` si el título ya la incluye o no hay dato. */
export function readablePropertyKind(kind: string | null | undefined): string | null {
  if (!kind) return null;
  const raw = kind.trim();
  const mapped = KIND_LABEL[raw.toUpperCase()];
  if (mapped) return mapped;
  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/garaje|parking/.test(normalized)) return "Garaje";
  if (/trastero/.test(normalized)) return "Trastero";
  if (/local/.test(normalized)) return "Local";
  if (/oficina/.test(normalized)) return "Oficina";
  if (/nave/.test(normalized)) return "Nave";
  if (/terreno|solar|parcela/.test(normalized)) return "Terreno";
  if (/atico|penthouse/.test(normalized)) return "Ático";
  if (/duplex/.test(normalized)) return "Dúplex";
  if (/estudio|loft/.test(normalized)) return "Estudio";
  if (/house|chalet/.test(normalized)) return "Casa";
  if (/casa|adosado|pareado|villa|unifamiliar/.test(normalized)) return "Casa";
  if (/intermediate_floor|ground_floor|top_floor|flat|apartment|floor/.test(normalized)) return "Piso";
  if (/piso|apartamento|vivienda/.test(normalized)) return "Piso";
  return null;
}

/**
 * Título listo para UI:
 *  - decodifica entidades HTML,
 *  - quita enums del portal (`INTERMEDIATE_FLOOR · `),
 *  - quita la tipología si ya viene dentro del texto (`Piso · Piso en Calle X`).
 */
export function cleanListingTitle(
  raw: string | null | undefined,
  propertyKind?: string | null
): string {
  const decoded = decodeListingTitle(raw);

  // El enum aporta la tipología real: lo aprovechamos antes de borrarlo.
  const enumMatch = decoded.match(ENUM_PREFIX);
  const enumKind = enumMatch ? readablePropertyKind(enumMatch[1]) : null;
  const title = decoded.replace(ENUM_PREFIX, "").replace(/\s+/g, " ").trim();
  if (!title) return "Inmueble";

  const kind = readablePropertyKind(propertyKind) ?? enumKind;
  if (!kind) return title;

  const kindRe = new RegExp(`^${kind}\\b`, "i");
  const parts = title.split("·").map((p) => p.trim());
  // "Piso · Piso en Calle X" → "Piso · Calle X"
  if (parts.length > 1) {
    const rest = parts
      .slice(1)
      .join(" · ")
      .replace(kindRe, "")
      .replace(/^en\s+/i, "")
      .trim();
    if (rest) return `${parts[0]} · ${rest}`;
  }
  const body = title.replace(kindRe, "").replace(/^en\s+/i, "").trim();
  if (body && body !== title) return body;
  return title;
}

/** `true` si el texto sigue teniendo pinta de enum técnico (para tests/QA). */
export function looksTechnical(text: string | null | undefined): boolean {
  if (!text) return false;
  return ENUM_PREFIX.test(text.trim()) || /_[A-Z]+/.test(text);
}
