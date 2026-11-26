import { BrandLogo, BrandMark } from "@/components/brand/BrandMark";
import Link from "next/link";
import { redirect } from "next/navigation";

export default function LandingPage() {
  if (process.env.NEXT_PUBLIC_OPEN_ACCESS === "1") {
    redirect("/app/oportunidades");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-void px-6 py-14 text-ink">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-lime/10 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 top-1/3 h-[380px] w-[380px] rounded-full bg-mint/10 blur-[120px]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-7rem)] max-w-5xl flex-col justify-center gap-9">
        <Link href="/" className="w-fit" aria-label="Radar Inversión">
          <BrandLogo size={34} />
        </Link>

        <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight text-ink md:text-6xl">
          Encuentra el inmueble{" "}
          <span className="text-lime">que el mercado</span> está regalando.
        </h1>

        <p className="max-w-2xl text-lg text-ink-muted">
          Descuento real contra la valoración notarial, ROI determinista y coste de compra
          completo. Cobertura nacional por CP, sin humo.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/app/oportunidades"
            className="rounded-full bg-lime px-6 py-3 text-sm font-bold text-lime-ink transition hover:brightness-105"
          >
            Ver oportunidades
          </Link>
          <Link
            href="/app/scan/nuevo"
            className="rounded-full border border-line px-6 py-3 text-sm font-bold text-ink transition hover:border-lime/60 hover:text-lime"
          >
            Nuevo scan ROI
          </Link>
          <Link
            href="/app/explorar"
            className="rounded-full px-4 py-3 text-sm font-semibold text-ink-muted transition hover:text-ink"
          >
            Explorar mapa →
          </Link>
        </div>

        <div className="mt-6 flex items-center gap-3 text-[11px] text-ink-muted/70">
          <BrandMark size={18} animated={false} />
          <span>Datos notariales, Catastro e INE · Actualización diaria</span>
        </div>
      </div>
    </main>
  );
}
