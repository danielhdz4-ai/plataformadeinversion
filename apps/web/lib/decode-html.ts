export function decodeListingTitle(raw: string | null | undefined): string {
  if (!raw) return "Inmueble";
  let s = raw;
  s = s.replace(/&#x([0-9a-fA-F]+);?/gi, (_, hex) =>
    String.fromCodePoint(parseInt(hex, 16))
  );
  s = s.replace(/&#(\d+);?/g, (_, num) => String.fromCodePoint(Number(num)));
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
