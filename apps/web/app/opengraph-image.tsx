import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Radar Inversión — radar de oportunidades inmobiliarias";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Imagen que se ve al compartir el enlace (WhatsApp, X, LinkedIn). */
export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #07100F 0%, #0D2421 55%, #10302A 100%)",
          color: "#F2EFE6",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              border: "2px solid rgba(198,242,78,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              background: "#07100F",
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 34,
                border: "2px solid rgba(198,242,78,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: 6, background: "#C6F24E" }} />
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 800, letterSpacing: -0.5 }}>
            <span>radar</span>
            <span style={{ color: "#C6F24E" }}>inversión</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, display: "flex", flexWrap: "wrap" }}>
            <span>Oportunidades inmobiliarias&nbsp;</span>
            <span style={{ color: "#C6F24E" }}>con descuento real.</span>
          </div>
          <div style={{ fontSize: 27, color: "#8FA9A2", maxWidth: 900 }}>
            Valoración notarial, rentabilidad determinista y coste total de compra. Cobertura nacional por código postal.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 22, color: "#8FA9A2" }}>
          <span style={{ display: "flex", padding: "8px 16px", borderRadius: 999, background: "#C6F24E", color: "#08150F", fontWeight: 800 }}>
            radarinversion.com
          </span>
          <span>Notariado · Catastro · INE</span>
        </div>
      </div>
    ),
    size
  );
}
