import type { ReactNode } from "react";

/**
 * Lenguaje visual único de la app (tema Brasa).
 * Todo lo nuevo debe usar estos bloques: así el tema claro/oscuro
 * funciona sin tocar cada componente.
 */

export function AppPage({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-void">{children}</div>;
}

export function AppPageHeader({
  title,
  description,
  meta,
  actions,
  kicker,
}: {
  title: string;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  kicker?: ReactNode;
}) {
  return (
    <div className="shrink-0 border-b border-line bg-deep px-4 py-5 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {kicker && (
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-lime">{kicker}</div>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-ink lg:text-[28px]">{title}</h1>
          {description && (
            <div className="mt-1 max-w-3xl text-sm text-ink-muted">{description}</div>
          )}
        </div>
        {(meta || actions) && (
          <div className="flex flex-wrap items-center gap-3">
            {meta && <div className="text-xs text-ink-muted">{meta}</div>}
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export function AppPageBody({
  children,
  wide,
}: {
  children: ReactNode;
  /** Contenido de lectura (no listados): limita el ancho para line-length cómoda. */
  wide?: boolean;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <section
        className={`px-4 pb-24 pt-5 lg:px-8 xl:pb-10 ${wide ? "" : "mx-auto w-full max-w-6xl"}`}
      >
        {children}
      </section>
    </div>
  );
}

export function AppCard({
  children,
  className = "",
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  const Tag = as;
  return <Tag className={`brasa-card ${className}`}>{children}</Tag>;
}

export function AppSectionTitle({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-ink">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function AppEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-line bg-surface px-8 py-12 text-center">
      <p className="text-base font-semibold text-ink">{title}</p>
      {description && <p className="mt-2 text-sm leading-relaxed text-ink-muted">{description}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

export function AppPillButton({
  children,
  onClick,
  href,
  variant = "ghost",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "ghost" | "solid" | "accent";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const cls =
    variant === "accent"
      ? "bg-lime text-lime-ink hover:brightness-105"
      : variant === "solid"
        ? "bg-ink text-void hover:opacity-90"
        : "border border-line bg-surface text-ink hover:border-lime/60 hover:text-lime";
  const base = `inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition disabled:opacity-50 ${cls}`;
  if (href) {
    return (
      <a href={href} className={base}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={base}>
      {children}
    </button>
  );
}
