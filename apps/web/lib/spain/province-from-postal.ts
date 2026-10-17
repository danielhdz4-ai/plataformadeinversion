/** Primeros 2 dígitos del CP español ≈ código provincia INE (01–52). */
export function provinceCodeFromPostal(postal: string | null | undefined): string | null {
  if (!postal || !/^\d{5}$/.test(postal.trim())) return null;
  return postal.trim().slice(0, 2);
}
