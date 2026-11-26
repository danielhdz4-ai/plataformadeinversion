export type SellerKind = "bank" | "agency" | "private" | "auction" | "unknown";

const BANK_PORTALS = new Set(["hipoges", "solvia"]);

const AUCTION_RE = /\b(subasta|puja|judicial|remate|auction)\b/i;
const BANK_RE = /\b(banco|entidad|hipoteca|activo\s+bancario|npl|hipoges|solvia|sareb)\b/i;
const PRIVATE_RE = /\b(particular|propietario|sin\s+comisi[oó]n\s+de\s+comprador)\b/i;

export const SELLER_KIND_LABEL: Record<SellerKind, string> = {
  bank: "Banco",
  agency: "Agencia",
  private: "Particular",
  auction: "Subasta",
  unknown: "—",
};

export function classifySellerKind(input: {
  sourcePortal?: string | null;
  title?: string | null;
  sourceUrl?: string | null;
}): SellerKind {
  const portal = (input.sourcePortal ?? "").toLowerCase();
  const text = `${input.title ?? ""} ${input.sourceUrl ?? ""}`;

  if (AUCTION_RE.test(text)) return "auction";
  if (BANK_PORTALS.has(portal) || BANK_RE.test(text)) return "bank";
  if (PRIVATE_RE.test(text)) return "private";
  if (portal && portal !== "unknown") return "agency";
  return "unknown";
}
