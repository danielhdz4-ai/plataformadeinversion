import type { Metadata } from "next";
import { THEME_INIT_SCRIPT } from "@/lib/ui/use-theme";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Radar Inversión";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: appName,
    template: `%s · ${appName}`,
  },
  applicationName: appName,
  description:
    "Radar de inversión inmobiliaria en España: oportunidades reales con descuento sobre la valoración notarial, rentabilidad determinista y coste real de compra.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: appName,
    locale: "es_ES",
    title: appName,
    description:
      "Inmuebles de bancos y particulares con descuento real, cobertura nacional por CP y ROI calculado, no estimado por chat.",
  },
  robots: { index: true, follow: true },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

