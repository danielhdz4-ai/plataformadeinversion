"use client";

/**
 * Marca Radar Inversión (Brasa): anillos de radar con barrido y
 * destello de oportunidad. SVG puro, hereda tema y escala sin pérdida.
 */
export function BrandMark({
  size = 28,
  className = "",
  animated = true,
}: {
  size?: number;
  className?: string;
  animated?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Radar Inversión"
    >
      <defs>
        <radialGradient id="ri-vignette" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--t-lime)" stopOpacity="0.22" />
          <stop offset="70%" stopColor="var(--t-lime)" stopOpacity="0.04" />
          <stop offset="100%" stopColor="var(--t-lime)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ri-sweep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--t-lime)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--t-lime)" stopOpacity="0.55" />
        </linearGradient>
      </defs>

      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="11" fill="var(--t-void)" />
      <rect
        x="0.75"
        y="0.75"
        width="38.5"
        height="38.5"
        rx="11"
        stroke="var(--t-lime)"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <circle cx="20" cy="20" r="15" fill="url(#ri-vignette)" />

      <g
        className={animated ? "ri-sweep" : undefined}
        style={{ transformOrigin: "20px 20px" }}
      >
        <path d="M20 20 L20 6 A14 14 0 0 1 32.1 13 Z" fill="url(#ri-sweep)" />
        <line x1="20" y1="20" x2="20" y2="6" stroke="var(--t-lime)" strokeWidth="1.4" strokeLinecap="round" />
      </g>

      <circle cx="20" cy="20" r="14" stroke="var(--t-lime)" strokeOpacity="0.28" strokeWidth="1.2" />
      <circle cx="20" cy="20" r="9" stroke="var(--t-lime)" strokeOpacity="0.2" strokeWidth="1" />
      <circle cx="20" cy="20" r="4.2" stroke="var(--t-lime)" strokeOpacity="0.14" strokeWidth="1" />
      <line x1="6" y1="20" x2="34" y2="20" stroke="var(--t-lime)" strokeOpacity="0.12" strokeWidth="1" />
      <line x1="20" y1="6" x2="20" y2="34" stroke="var(--t-lime)" strokeOpacity="0.12" strokeWidth="1" />

      <circle cx="20" cy="20" r="2.1" fill="var(--t-lime)" />
      <g className={animated ? "ri-ping" : undefined} style={{ transformOrigin: "26.5px 13.5px" }}>
        <circle cx="26.5" cy="13.5" r="2.4" fill="var(--t-mint)" />
        <circle cx="26.5" cy="13.5" r="5.2" stroke="var(--t-mint)" strokeOpacity="0.45" strokeWidth="1" />
      </g>
    </svg>
  );
}

/** Logotipo completo: marca + nombre en dos tonos. */
export function BrandLogo({
  className = "",
  size = 28,
  compact = false,
}: {
  className?: string;
  size?: number;
  compact?: boolean;
}) {
  return (
    <span className={`group flex items-center gap-2.5 ${className}`}>
      <span className="ri-lift grid place-items-center">
        <BrandMark size={size} />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-black tracking-[-0.02em] text-ink">
            radar<span className="text-lime">inversión</span>
          </span>
          <span className="mt-[3px] text-[8.5px] font-bold uppercase tracking-[0.28em] text-ink-muted/80">
            Radar de oportunidades
          </span>
        </span>
      )}
    </span>
  );
}
