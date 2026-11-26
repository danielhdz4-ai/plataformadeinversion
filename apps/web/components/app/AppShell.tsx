"use client";

import { AppSidebar } from "@/components/app/AppSidebar";
import { isFullscreenRequested, useAppFullscreen } from "@/lib/ui/use-app-fullscreen";
import { useTheme } from "@/lib/ui/use-theme";
import { usePathname, useSearchParams } from "next/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scanMode = pathname.startsWith("/app/scan");
  const { fullscreen, toggle } = useAppFullscreen(isFullscreenRequested(searchParams?.toString() ?? null));
  const { theme, toggle: toggleTheme } = useTheme();

  return (
    <div className="app-shell flex h-screen overflow-hidden bg-void text-ink">
      <AppSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="app-header-bar flex shrink-0 items-center justify-between gap-4 border-b border-line bg-deep/80 px-4 py-2.5 text-ink backdrop-blur md:px-6">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-ink-muted">
            <span className="text-ink-muted/60">Radar</span>
            <span className="text-ink-muted/30">/</span>
            <span className="text-ink">
              {scanMode
                ? "Scan"
                : pathname.startsWith("/app/oportunidades")
                  ? "Oportunidades"
                  : pathname.startsWith("/app/explorar")
                    ? "Explorar"
                    : pathname.startsWith("/app/guardados")
                      ? "Guardados"
                      : pathname.startsWith("/app/calculator")
                        ? "Calculadora"
                        : pathname.startsWith("/app/listings")
                          ? "Ficha del inmueble"
                          : "Inicio"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
              aria-label="Cambiar tema"
              className="grid h-8 w-8 place-items-center rounded-lg border border-line text-ink-muted transition hover:border-lime/50 hover:text-lime"
            >
              {theme === "dark" ? "☾" : "☀"}
            </button>
            <button
              type="button"
              onClick={toggle}
              title={fullscreen ? "Salir de pantalla completa (F)" : "Pantalla completa (F)"}
              aria-pressed={fullscreen}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-muted transition hover:border-lime/50 hover:text-lime"
            >
              <span aria-hidden>{fullscreen ? "⤡" : "⤢"}</span>
              {fullscreen ? "Contraer" : "Pantalla completa"}
            </button>
          </div>
        </header>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
