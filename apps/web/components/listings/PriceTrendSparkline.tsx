export function PriceTrendSparkline({
  points,
  stroke = "#0a0a0a",
  height = 56,
}: {
  points: { x: string; y: number }[];
  stroke?: string;
  height?: number;
}) {
  if (points.length < 2) return null;
  const w = 280;
  const ys = points.map((p) => p.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const pad = (max - min) * 0.08 || 1;
  const lo = min - pad;
  const hi = max + pad;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = height - ((p.y - lo) / (hi - lo)) * height;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-14 w-full" preserveAspectRatio="none">
      <polyline fill="none" stroke={stroke} strokeWidth="2" points={coords.join(" ")} />
    </svg>
  );
}
