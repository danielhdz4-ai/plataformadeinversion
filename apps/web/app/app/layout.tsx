import Link from "next/link";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const name = process.env.NEXT_PUBLIC_APP_NAME ?? "Plataforma de inversión";
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <Link href="/app/scan/nuevo" className="font-semibold text-emerald-400">
          {name}
        </Link>
        <nav className="flex gap-4 text-sm text-slate-300">
          <Link href="/app/scan/nuevo">Scan</Link>
          <Link href="/app/calculator">Calculadora</Link>
          <Link href="/app/guardados">Guardados</Link>
        </nav>
      </header>
      {process.env.NEXT_PUBLIC_DEMO_MODE === "1" && (
        <div className="bg-amber-900/40 px-4 py-2 text-center text-sm text-amber-100">
          Datos de demostración — Barcelona demo
        </div>
      )}
      <main>{children}</main>
    </div>
  );
}
