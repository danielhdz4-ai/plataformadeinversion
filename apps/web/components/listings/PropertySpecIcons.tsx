import type { ReactNode } from "react";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-neutral-500" fill="none" stroke="currentColor" strokeWidth="1.4">
      {children}
    </svg>
  );
}

export function PropertySpecIcons({
  bedrooms,
  bathrooms,
  sqm,
}: {
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqm?: number | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600">
      {bedrooms != null && (
        <span className="inline-flex items-center gap-1">
          <Icon>
            <path d="M2 10h12M4 10V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4" />
            <path d="M6 8h4" />
          </Icon>
          {bedrooms} hab.
        </span>
      )}
      {bathrooms != null && (
        <span className="inline-flex items-center gap-1">
          <Icon>
            <path d="M4 6h8v6H4z" />
            <path d="M6 4v2M10 4v2" />
          </Icon>
          {bathrooms} ba
        </span>
      )}
      {sqm != null && (
        <span className="inline-flex items-center gap-1">
          <Icon>
            <rect x="3" y="3" width="10" height="10" rx="1" />
            <path d="M3 8h10M8 3v10" />
          </Icon>
          {sqm} m²
        </span>
      )}
    </div>
  );
}
