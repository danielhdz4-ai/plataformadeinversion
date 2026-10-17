"use client";

import { NavIcon } from "@/components/app/NavIcon";
import { APP_NAV, navItemActive } from "@/lib/app-nav";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppIconRail() {
  const pathname = usePathname();
  return (
    <nav className="flex w-[52px] shrink-0 flex-col items-center gap-1 border-r border-neutral-200 bg-[#f7f6f3] py-3">
      {APP_NAV.map((item) => {
        const active = navItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={`flex h-10 w-10 items-center justify-center rounded-md transition ${
              active
                ? "bg-neutral-950 text-white shadow-sm"
                : "text-neutral-600 hover:bg-white hover:text-neutral-950"
            }`}
          >
            <NavIcon name={item.icon} className="h-[18px] w-[18px]" />
          </Link>
        );
      })}
    </nav>
  );
}
