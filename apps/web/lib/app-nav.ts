import type { IconName } from "@/components/app/NavIcon";

export type AppNavItem = {
  href: string;
  label: string;
  icon: IconName;
};

export const APP_NAV: AppNavItem[] = [
  { href: "/app/inicio", label: "Inicio", icon: "home" },
  { href: "/app/oportunidades", label: "Oportunidades", icon: "opportunities" },
  { href: "/app/explorar", label: "Explorar", icon: "explore" },
  { href: "/app/scan/nuevo", label: "Scan", icon: "scan" },
  { href: "/app/calculator", label: "Calculadora", icon: "calculator" },
  { href: "/app/guardados", label: "Guardados", icon: "saved" },
];

export function navItemActive(pathname: string, href: string) {
  if (href.includes("/scan")) return pathname.startsWith("/app/scan");
  if (href.includes("/inicio")) return pathname === "/app" || pathname.startsWith("/app/inicio");
  return pathname.startsWith(href);
}
