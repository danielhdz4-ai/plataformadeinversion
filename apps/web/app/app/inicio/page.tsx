"use client";

import type { HeroDeal } from "@/components/home/CinematicMarquee";
import { CinematicMarquee } from "@/components/home/CinematicMarquee";
import { RadarOpportunityCard } from "@/components/oportunidades/RadarOpportunityCard";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { AppEmptyState, AppPage, AppPageBody, AppPillButton } from "@/components/ui/AppPage";
import { decodeListingTitle } from "@/lib/decode-html";
import type { ListingSummary } from "@/lib/listing/summary-types";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type FeedItem = {
  id: string;
  title: string | null;
  city: string | null;
  postalCode: string | null;
  price: number;
  sqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sourcePortal: string | null;
  sourceUrl: string | null;
  thumbnailUrl: string | null;
  scrapedAt: string | null;
  roi: number | null;
  rentEst: number | null;
  summary: ListingSummary;
};

type FeedResponse = {
  items?: FeedItem[];
  totalQualified?: number;
};

function Carousel({
  title,
  hint,
  href,
  children,
}: {
  title: string;
  hint?: string;
  href?: string;
  children: React.ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(760, el.clientWidth * 0.9), behavior: "smooth" });
  };
  return (
    <section className="brasa-rise">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-ink">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
        </div>
        <div className="flex items-center gap-2">
          {href && (
            <Link href={href} className="text-xs font-semibold text-lime hover:underline">
              Ver todos →
            </Link>
          )}
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Anterior"
            className="grid h-8 w-8 place-items-center rounded-full border border-line text-ink-muted transition hover:border-lime/60 hover:text-lime"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="Siguiente"
            className="grid h-8 w-8 place-items-center rounded-full border border-line text-ink-muted transition hover:border-lime/60 hover:text-lime"
          >
            ›
          </button>
        </div>
      </div>
      <div ref={trackRef} className="brasa-scroller">
        {children}
      </div>
    </section>
  );
}

function cardProps(item: FeedItem, index: number) {
  return {
    listingId: item.id,
    title: decodeListingTitle(item.title ?? "Inmueble"),
    city: item.city,
    postalCode: item.postalCode,
    price: item.price,
    sourcePortal: item.sourcePortal,
    thumbnailUrl: item.thumbnailUrl,
    bedrooms: item.bedrooms,
    bathrooms: item.bathrooms,
    sqm: item.sqm,
    roi: item.roi,
    rentEst: item.rentEst,
    sourceUrl: item.sourceUrl,
    scrapedAt: item.scrapedAt,
    summary: item.summary,
    returnTo: "/app/inicio",
    index,
  };
}

const CarouselCard = ({ item, index }: { item: FeedItem; index: number }) => (
  <div className="w-[272px]">
    <RadarOpportunityCard {...cardProps(item, index)} />
  </div>
);

export default function InicioPage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState(false);
  const [marquee, setMarquee] = useState<HeroDeal[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 90_000);
      try {
        const [feedRes, heroRes] = await Promise.all([
          fetch("/api/opportunities?limit=200", { signal: controller.signal }).catch(() => null),
          fetch("/api/public/hero-deals", { signal: controller.signal }).catch(() => null),
        ]);
        if (cancelled) return;
        const body = (feedRes && feedRes.ok ? await feedRes.json() : {}) as FeedResponse;
        const hero = (heroRes && heroRes.ok ? await heroRes.json() : { items: [] }) as { items?: HeroDeal[] };
        const fetched = body.items ?? [];
        const checked = await Promise.all(
          fetched.slice(0, 12).map(async (it) => {
            const thumb = it.thumbnailUrl;
            if (!thumb) return { ...it, thumbnailUrl: null };
            try {
              const r = await fetch(thumb, { method: "HEAD" });
              if (!r.ok) return { ...it, thumbnailUrl: null };
            } catch {
              return { ...it, thumbnailUrl: null };
            }
            return it;
          })
        );
        const all = [...checked, ...fetched.slice(12)];
        setItems(all);
        setTotal(Math.max(body.totalQualified ?? 0, all.length));
        setMarquee(hero.items ?? []);
        if (!feedRes || !feedRes.ok) setFeedError(true);
      } catch {
        if (!cancelled) setFeedError(true);
      } finally {
        window.clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { top, cheapest, maxDiscount, avgNet, provinces, newThisWeek } = useMemo(() => {
    const withScore = [...items].sort(
      (a, b) => (b.summary.opportunity.opportunityScore ?? 0) - (a.summary.opportunity.opportunityScore ?? 0)
    );
    const cheap = [...items]
      .filter((i) => i.price > 0)
      .sort((a, b) => a.price - b.price)
      .slice(0, 20);
    const discounts = items
      .map((i) => i.summary.opportunity.discountPct)
      .filter((d): d is number => d != null);
    const nets = items
      .map((i) => i.summary.roi.grossRoiPct)
      .filter((d): d is number => d != null);
    const cities = new Set(items.map((i) => i.city).filter(Boolean));
    const weekAgo = Date.now() - 7 * 86400000;
    const fresh = items.filter((i) => i.scrapedAt && Date.parse(i.scrapedAt) >= weekAgo).length;
    return {
      top: withScore.slice(0, 10),
      cheapest: cheap,
      maxDiscount: discounts.length ? Math.max(...discounts) : null,
      avgNet: nets.length ? nets.reduce((a, b) => a + b, 0) / nets.length : null,
      provinces: cities.size,
      newThisWeek: fresh,
    };
  }, [items]);

  const bestDeal = items.reduce<FeedItem | null>((best, it) => {
    const d = it.summary.opportunity.discountPct ?? 0;
    const bd = best?.summary.opportunity.discountPct ?? 0;
    return d > bd ? it : best;
  }, null);

  const scoreTop = (n: number) => [...items]
    .sort((a, b) => (b.summary.opportunity.opportunityScore ?? 0) - (a.summary.opportunity.opportunityScore ?? 0))
    .slice(0, n);

  return (
    <AppPage>
      <AppPageBody wide>
        <div className="space-y-10">
          {/* ── Hero ── */}
          <div className="brasa-glow brasa-rise relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-deep via-deep to-void px-5 pb-7 pt-6 lg:px-7">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
              <span className="brasa-live-dot inline-block h-1.5 w-1.5 rounded-full bg-lime" />
              Catálogo en vivo · {provinces || "—"} municipios
            </div>
            <h1 className="mt-3 max-w-3xl text-[32px] font-extrabold leading-[1.06] tracking-[-1.2px] text-ink sm:text-[42px]">
              {total != null && total > 0 ? (
                <>
                  Hay <span className="text-lime">{Math.max(total, items.length)}</span> oportunidades reales.{" "}
                  <span className="text-ink-muted">Las mejores, primero.</span>
                </>
              ) : (
                <>
                  <span className="text-lime">Radar</span> encendido.{" "}
                  <span className="text-ink-muted">Escaneando el mercado ahora.</span>
                </>
              )}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
              Inmuebles de bancos y particulares con descuento frente a su valoración notarial, rentabilidad
              determinista y coste real de compra. Sin humo.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <AppPillButton href="/app/oportunidades" variant="accent">
                Ver todas las oportunidades →
              </AppPillButton>
              <AppPillButton href="/app/explorar">Explorar mapa</AppPillButton>
              {bestDeal && (
                <Link
                  href={`/app/listings/${bestDeal.id}`}
                  className="ml-1 text-xs font-semibold text-lime underline-offset-4 hover:underline"
                >
                  El chollo del día: −
                  {Math.round(bestDeal.summary.opportunity.discountPct ?? 0)} % en{" "}
                  {decodeListingTitle(bestDeal.city ?? "")}
                </Link>
              )}
            </div>
          </div>

          {/* ── Cinta infinita de chollos reales ── */}
          <CinematicMarquee initial={marquee} />

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Oportunidades activas", value: total ?? items.length, suffix: "" },
              { label: "Mejor descuento", value: maxDiscount ?? 0, suffix: " %", prefix: "−", accent: true },
              { label: "ROI bruto medio", value: avgNet ?? 0, suffix: " %", decimals: 1 },
              { label: "Nuevas esta semana", value: newThisWeek, suffix: "" },
            ].map((k, i) => (
              <div
                key={k.label}
                className="brasa-card brasa-rise p-4"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">{k.label}</p>
                <p
                  className={`mt-1.5 text-[26px] font-extrabold leading-none tracking-tight ${
                    k.accent ? "text-lime" : "text-ink"
                  }`}
                >
                  {total == null ? (
                    <span className="text-ink-muted/50">—</span>
                  ) : (
                    <>
                      {k.prefix ?? ""}
                      <AnimatedNumber
                        value={k.value}
                        format={(n) =>
                          k.decimals
                            ? n.toLocaleString("es-ES", {
                                maximumFractionDigits: k.decimals,
                                minimumFractionDigits: k.decimals,
                              })
                            : Math.round(n).toLocaleString("es-ES")
                        }
                      />
                      {k.suffix}
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>

          {loading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="brasa-card p-4">
                  <div className="shimmer h-40 rounded-lg bg-deep" />
                </div>
              ))}
            </div>
          )}

          {!loading && items.length === 0 && (
            <AppEmptyState
              title={feedError ? "No hemos podido cargar el catálogo" : "Aún sin inventario fresco"}
              description={
                feedError
                  ? "Vuelve a intentarlo en unos segundos o abre el feed completo de Oportunidades."
                  : "Estamos importando anuncios. En unos minutos aparecerán aquí los chollos reales de bancos y agencias."
              }
              action={<AppPillButton href="/app/oportunidades">Abrir Oportunidades</AppPillButton>}
            />
          )}

          {!loading && items.length > 0 && (
            <>
              <Carousel
                title="Los inmuebles más baratos"
                hint="Precios de entrada bajos, con descuento frente a valoración cuando existe."
                href="/app/oportunidades?sort=price_asc"
              >
                {cheapest.map((it, i) => (
                  <CarouselCard key={it.id} item={it} index={i} />
                ))}
              </Carousel>

              <Carousel title="Top 5 por score" hint="Los que mejor puntúan en descuento, rentabilidad y frescura." href="/app/oportunidades">
                {scoreTop(5).map((it, i) => (
                  <CarouselCard key={it.id} item={it} index={i} />
                ))}
              </Carousel>

              <Carousel title="Top 3 del radar" hint="Lo que un inversor debería mirar hoy." href="/app/oportunidades">
                {scoreTop(3).map((it, i) => (
                  <CarouselCard key={it.id} item={it} index={i} />
                ))}
              </Carousel>

              {/* Diferenciador: comparador de las 3 mejores compras del día */}
              <section className="brasa-rise">
                <div className="mb-3">
                  <h2 className="text-lg font-bold tracking-tight text-ink">Comparador del día</h2>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Coste real con ITP y gastos de cierre, renta estimada y rentabilidad neta, lado a lado.
                  </p>
                </div>
                <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                  <div className="grid grid-cols-4 gap-2 border-b border-line bg-deep px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-muted">
                    <span>Inmueble</span>
                    <span className="text-right">Precio</span>
                    <span className="text-right">Coste real</span>
                    <span className="text-right">Neta</span>
                  </div>
                  {top.slice(0, 3).map((it, i) => {
                    const roi = it.summary.roi;
                    const extra = roi.purchaseTaxAmount + (it.price * 0.01 + 300);
                    return (
                      <Link
                        key={it.id}
                        href={`/app/listings/${it.id}`}
                        className="grid grid-cols-4 items-center gap-2 border-b border-line px-4 py-3 text-sm last:border-0 transition hover:bg-raised"
                        style={{ animationDelay: `${i * 60}ms` }}
                      >
                        <span className="truncate font-semibold text-ink">
                          {decodeListingTitle(it.title ?? "Inmueble")}
                        </span>
                        <span className="text-right tabular-nums text-ink">
                          {it.price.toLocaleString("es-ES")} €
                        </span>
                        <span className="text-right tabular-nums text-ink-muted">
                          {(it.price + extra).toLocaleString("es-ES")} €
                        </span>
                        <span className="text-right font-bold tabular-nums text-lime">
                          {roi.grossRoiPct != null ? `${roi.grossRoiPct.toFixed(1)} %` : "—"}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      </AppPageBody>
    </AppPage>
  );
}
