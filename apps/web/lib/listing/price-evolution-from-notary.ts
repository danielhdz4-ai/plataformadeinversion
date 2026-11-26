import type { NotaryPortalStats } from "@/lib/notariado/types";
import type { ListingSummary } from "@/lib/listing/summary-types";

export type PriceEvolutionBlock = ListingSummary["priceEvolution"] & {
  source: "penotariado" | "estimated";
  sourceLabel: string;
};

function formatMonthKey(key: string): string {
  const m = key.match(/^(\d{4})-(\d{2})$/);
  if (!m) return key;
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const mi = Number(m[2]) - 1;
  return `${months[mi] ?? m[2]} ${m[1].slice(2)}`;
}

function pctChange(first: number, last: number): number {
  if (!Number.isFinite(first) || first <= 0 || !Number.isFinite(last)) return 0;
  return Math.round(((last - first) / first) * 1000) / 10;
}

/** Serie indicativa cuando no hay informe notarial con histórico. */
function buildEstimatedEvolution(cpAvgM2: number | null): PriceEvolutionBlock {
  const saleEnd = cpAvgM2 ?? 3398;
  const rentEnd = Math.max(8, saleEnd * 0.0055);
  const saleStart = saleEnd / 1.284;
  const rentStart = rentEnd / 1.43;
  const labels = ["sept 21", "mar 23", "sept 24", "mar 26"];
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const saleM2 = labels.map((x, i) => ({
    x,
    y: Math.round(lerp(saleStart, saleEnd, i / (labels.length - 1))),
  }));
  const rentM2 = labels.map((x, i) => ({
    x,
    y: Math.round(lerp(rentStart, rentEnd, i / (labels.length - 1)) * 10) / 10,
  }));
  return {
    saleM2,
    rentM2,
    saleChangePct: pctChange(saleM2[0]!.y, saleM2.at(-1)!.y),
    rentChangePct: pctChange(rentM2[0]!.y, rentM2.at(-1)!.y),
    source: "estimated",
    sourceLabel: "Estimación a partir de €/m² del CP (sin serie mensual notarial)",
  };
}

export function buildPriceEvolutionFromNotary(
  cpAvgM2: number | null,
  notary: ListingSummary["notary"]
): PriceEvolutionBlock {
  const portal: NotaryPortalStats | null = notary?.portal ?? null;

  const monthly = portal?.monthly;
  if (
    monthly &&
    monthly.labels.length >= 2 &&
    monthly.priceM2.length >= 2
  ) {
    const { labels, priceM2 } = monthly;
    const n = Math.min(labels.length, priceM2.length);
    const saleM2 = Array.from({ length: n }, (_, i) => ({
      x: formatMonthKey(String(labels[i])),
      y: Number(priceM2[i]),
    }));
    const rentM2: { x: string; y: number }[] = [];
    const medianByYear = portal.additional?.medianByYear;
    if (medianByYear && medianByYear.length >= 2) {
      for (const row of medianByYear) {
        rentM2.push({ x: String(row.year), y: Math.round(row.priceM2 * 0.0052 * 10) / 10 });
      }
    }

    const place = portal.placeName ?? (notary?.portal?.postalCode ? `CP ${portal.postalCode}` : "Mercado local");
    return {
      saleM2,
      rentM2: rentM2.length >= 2 ? rentM2 : buildEstimatedEvolution(cpAvgM2).rentM2,
      saleChangePct:
        portal.additional?.priceChangePct12m ??
        pctChange(saleM2[0]!.y, saleM2.at(-1)!.y),
      rentChangePct: 0,
      source: "penotariado",
      sourceLabel: `Portal del Notariado · ${place} · ${portal.periodFrom}–${portal.periodTo}`,
    };
  }

  const yearly = portal?.additional?.medianByYear;
  if (yearly && yearly.length >= 3) {
    const saleM2 = yearly.map((row) => ({
      x: String(row.year),
      y: row.priceM2,
    }));
    return {
      saleM2,
      rentM2: buildEstimatedEvolution(cpAvgM2).rentM2,
      saleChangePct:
        portal?.additional?.priceChangePct12m ??
        pctChange(saleM2[0]!.y, saleM2.at(-1)!.y),
      rentChangePct: 0,
      source: "penotariado",
      sourceLabel: `Mediana anual notariado · CP ${portal?.postalCode ?? "—"}`,
    };
  }

  return buildEstimatedEvolution(cpAvgM2);
}
