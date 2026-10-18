/** Sparkline con área suave (estilo ROIExplorer). */
export function PriceTrendChart({
  points,
  stroke = "#0a0a0a",
  fill = "rgba(10,10,10,0.08)",
  height = 72,
}: {
  points: { x: string; y: number }[];
  stroke?: string;
  fill?: string;
  height?: number;
}) {
  if (points.length < 2) return null;
  const w = 320;
  const ys = points.map((p) => p.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const pad = (max - min) * 0.12 || 1;
  const lo = min - pad;
  const hi = max + pad;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = height - ((p.y - lo) / (hi - lo)) * height;
    return { x, y };
  });
  const line = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const area = `0,${height} ${line} ${w},${height}`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-[72px] w-full" preserveAspectRatio="none">
      <polygon points={area} fill={fill} />
      <polyline fill="none" stroke={stroke} strokeWidth="2.25" strokeLinejoin="round" points={line} />
    </svg>
  );
}
