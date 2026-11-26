/**
 * Esqueleto del feed con shimmer Brasa: se ve "vivo" mientras llegan
 * los inmuebles, en lugar de bloques grises quietos.
 */
export function OpportunityFeedSkeleton({ count = 15 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="brasa-rise overflow-hidden rounded-2xl border border-line bg-surface"
          style={{ animationDelay: `${(i % 10) * 55}ms` }}
        >
          <div className="shimmer aspect-[5/4] w-full bg-deep" />
          <div className="space-y-3 p-4">
            <div className="shimmer h-3.5 w-[92%] rounded bg-deep" />
            <div className="shimmer h-3 w-1/2 rounded bg-deep" />
            <div className="shimmer h-6 w-2/5 rounded bg-deep" />
            <div className="shimmer h-9 rounded-lg bg-deep" />
            <div className="grid grid-cols-2 gap-2">
              <div className="shimmer h-9 rounded-lg bg-deep" />
              <div className="shimmer h-9 rounded-lg bg-deep" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
