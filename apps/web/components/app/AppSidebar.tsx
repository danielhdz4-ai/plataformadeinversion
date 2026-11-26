"use client";

import Link from "next/link";
import { NavIcon } from "@/components/app/NavIcon";
import { BrandLogo, BrandMark } from "@/components/brand/BrandMark";
import { APP_NAV, navItemActive } from "@/lib/app-nav";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const KEY = "radar-sidebar-collapsed";

/**
 * Barra lateral Brasa: iconos + etiquetas, colapsable, activa en lima
 * con barra luminosa y atajos. Recuerda el estado entre sesiones.
 */
export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(KEY) === "1");
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(KEY, next ? "1" : "0");
      return next;
    });
  };

  return (
    <aside
      className={`app-sidebar relative z-30 flex shrink-0 flex-col border-r border-line bg-deep transition-[width] duration-300 ease-out ${
        collapsed ? "w-[68px]" : "w-[232px]"
      }`}
      aria-label="Navegación principal"
    >
      <div className="flex h-[54px] items-center justify-between gap-2 px-3">
        <Link
          href="/app/inicio"
          className="min-w-0 overflow-hidden"
          aria-label="Radar Inversión — inicio"
        >
          {collapsed ? <BrandMark size={30} /> : <BrandLogo size={28} />}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={toggle}
            aria-label="Contraer menú"
            title="Contraer menú"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-muted transition hover:bg-raised hover:text-ink"
          >
            <Chevron direction="left" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          type="button"
          onClick={toggle}
          aria-label="Expandir menú"
          title="Expandir menú"
          className="mx-auto mb-2 grid h-7 w-7 place-items-center rounded-lg text-ink-muted transition hover:bg-raised hover:text-ink"
        >
          <Chevron direction="right" />
        </button>
      )}

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2">
        {!collapsed && (
          <p className="px-2.5 pb-1 text-[9px] font-bold uppercase tracking-[0.22em] text-ink-muted/60">
            Explorar
          </p>
        )}
        {APP_NAV.map((item) => {
          const active = navItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`group relative flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-[13px] font-semibold transition ${
                active
                  ? "bg-lime/12 text-lime"
                  : "text-ink-muted hover:bg-raised hover:text-ink"
              } ${collapsed ? "justify-center px-0" : ""}`}
            >
              <span
                aria-hidden
                className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-lime transition-opacity ${
                  active ? "opacity-100" : "opacity-0"
                }`}
              />
              <NavIcon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="m-2 rounded-xl border border-line bg-surface/60 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted/70">
            Datos
          </p>
          <p className="mt-1 text-[11px] leading-snug text-ink-muted">
            Notariado, Catastro e INE · cobertura nacional por CP.
          </p>
        </div>
      )}
    </aside>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      {direction === "left" ? <path d="M15 6l-6 6 6 6" /> : <path d="M9 6l6 6-6 6" />}
    </svg>
  );
}
