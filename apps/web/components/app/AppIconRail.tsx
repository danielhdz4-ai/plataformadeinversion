"use client";

import { NavIcon } from "@/components/app/NavIcon";
import { BrandMark } from "@/components/brand/BrandMark";
import { APP_NAV, navItemActive } from "@/lib/app-nav";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppIconRail() {
  const pathname = usePathname();
  return (
    <nav className="flex w-[52px] shrink-0 flex-col items-center gap-1 border-r border-line bg-deep py-3">
      <Link
        href="/app/inicio"
        className="group mb-1 grid h-10 w-10 place-items-center"
        title="Radar Inversión"
        aria-label="Radar Inversión"
      >
        <BrandMark size={30} />
      </Link>
      {APP_NAV.map((item) => {
        const active = navItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${
              active
                ? "bg-lime text-lime-ink shadow-[0_0_0_1px_rgba(198,242,78,0.35)]"
                : "text-ink-muted hover:bg-raised hover:text-ink"
            }`}
          >
            <NavIcon name={item.icon} className="h-[18px] w-[18px]" />
          </Link>
        );
      })}
    </nav>
  );
}
