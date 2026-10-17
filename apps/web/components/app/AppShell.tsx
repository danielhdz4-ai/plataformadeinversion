"use client";

import { AppIconRail } from "@/components/app/AppIconRail";
import { NavIcon } from "@/components/app/NavIcon";
import { PlatformStatsBar } from "@/components/app/PlatformStatsBar";
import { APP_NAV, navItemActive } from "@/lib/app-nav";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const scanMode = pathname.startsWith("/app/scan");
  const name = process.env.NEXT_PUBLIC_APP_NAME ?? "Plataforma de inversión";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f7f6f3] text-neutral-950">
      <header className="sticky top-0 z-40 bg-neutral-950 text-white">
        <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/app/scan/nuevo" className="font-semibold tracking-tight">
              {name}
            </Link>
            {scanMode && (
              <>
                <span className="text-neutral-500">/</span>
                <span className="text-neutral-300">Scan</span>
              </>
            )}
          </div>
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            {APP_NAV.map((item) => {
              const active = navItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm ${
                    active ? "bg-white text-neutral-950" : "text-neutral-300 hover:text-white"
                  }`}
                >
                  <NavIcon name={item.icon} className="h-4 w-4 opacity-90" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <PlatformStatsBar />
      </header>
      <div className="flex min-h-0 flex-1">
        <AppIconRail />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
