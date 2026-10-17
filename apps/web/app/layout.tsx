import type { Metadata } from "next";
import "./globals.css";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Plataforma de inversión";

export const metadata: Metadata = {
  title: appName,
  description: "Scan geográfico y ROI para inversores inmobiliarios en España",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
