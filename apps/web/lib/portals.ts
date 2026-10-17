const LABELS: Record<string, string> = {
  kelify: "kelify",
  pisos_com: "pisos.com",
  fotocasa: "Fotocasa",
  idealista: "Idealista",
  demo: "Demo",
};

export function portalBadge(source: string | null | undefined) {
  const key = source ?? "unknown";
  return { name: LABELS[key] ?? key, className: "border-neutral-300 text-neutral-800" };
}
