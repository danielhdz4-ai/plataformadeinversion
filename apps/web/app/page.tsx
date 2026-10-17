import Link from "next/link";
import { redirect } from "next/navigation";

export default function LandingPage() {
  if (process.env.NEXT_PUBLIC_OPEN_ACCESS === "1") {
    redirect("/app/scan/nuevo");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-10 bg-[#f7f6f3] px-6 py-16">
      <p className="text-sm uppercase tracking-widest text-neutral-500">Plataforma de inversión</p>
      <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-neutral-950 md:text-5xl">
        ROI defendible en minutos, no en Excel
      </h1>
      <p className="max-w-2xl text-lg text-neutral-600">
        Scan geográfico, ranking buy-to-let, kelify y pisos.com en mapa.
      </p>
      <div className="flex flex-wrap gap-4">
        <Link
          href="/app/scan/nuevo"
          className="rounded-lg bg-neutral-950 px-6 py-3 font-medium text-white hover:bg-neutral-800"
        >
          Entrar a la plataforma
        </Link>
        <Link
          href="/app/explorar"
          className="rounded-lg border border-neutral-300 bg-white px-6 py-3 hover:border-neutral-950"
        >
          Explorar mapa
        </Link>
      </div>
    </main>
  );
}
