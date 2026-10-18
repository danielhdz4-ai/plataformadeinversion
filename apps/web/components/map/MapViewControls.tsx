import type { MapTheme, MapVisualMode } from "@/lib/map/map-styles";

export function MapViewControls({
  theme,
  visual,
  onTheme,
  onVisual,
}: {
  theme: MapTheme;
  visual: MapVisualMode;
  onTheme: (t: MapTheme) => void;
  onVisual: (v: MapVisualMode) => void;
}) {
  const darkChrome = theme === "oscuro" || theme === "satelite";
  const panel = darkChrome
    ? "rounded-lg border border-neutral-700/80 bg-neutral-950/90 p-1 shadow-lg backdrop-blur-sm"
    : "rounded-lg border border-neutral-200 bg-white/95 p-1 shadow";
  const btn = (active: boolean) =>
    `rounded-md px-2 py-1 text-xs font-medium ${
      active
        ? darkChrome
          ? "bg-white text-neutral-950"
          : "bg-neutral-950 text-white"
        : darkChrome
          ? "text-neutral-300 hover:bg-neutral-800"
          : "bg-white/95 text-neutral-800 hover:bg-neutral-100"
    }`;

  return (
    <div className="map-view-controls absolute left-3 top-3 z-20 flex flex-col gap-2">
      <div className={`flex flex-wrap gap-1 ${panel}`}>
        <button type="button" className={btn(visual === "2d")} onClick={() => onVisual("2d")}>
          2D
        </button>
        <button type="button" className={btn(visual === "3d")} onClick={() => onVisual("3d")}>
          3D
        </button>
      </div>
      <div className={`flex flex-wrap gap-1 ${panel}`}>
        {(
          [
            ["claro", "Claro"],
            ["oscuro", "Oscuro"],
            ["satelite", "Satélite"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={btn(theme === id)} onClick={() => onTheme(id)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
