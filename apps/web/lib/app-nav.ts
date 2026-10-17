import type { IconName } from "@/components/app/NavIcon";

export type AppNavItem = {
  href: string;
  label: string;
  icon: IconName;
};

export const APP_NAV: AppNavItem[] = [
  { href: "/app/scan/nuevo", label: "Scan", icon: "scan" },
  { href: "/app/explorar", label: "Explorar", icon: "explore" },
  { href: "/app/calculator", label: "Calculadora", icon: "calculator" },
  { href: "/app/guardados", label: "Guardados", icon: "saved" },
];

export function navItemActive(pathname: string, href: string) {
  if (href.includes("/scan")) return pathname.startsWith("/app/scan");
  return pathname.startsWith(href);
}
