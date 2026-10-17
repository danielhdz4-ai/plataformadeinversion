# Ideas de referencia — Virtual Mike y Analiza Tu Piso

> **Solo inspiración** para Plataforma de inversión. No integración, no copia de marca ni pricing.  
> Fuentes: [Virtual Mike](https://www.virtualmike.ai), [informe registral](https://virtualmike.ai/informe-registral), [Analiza Tu Piso](https://www.analizatupiso.com).

---

## 1. Qué son (posicionamiento)

| | Virtual Mike | Analiza Tu Piso | Plataforma de inversión (nosotros) |
|---|--------------|-----------------|-------------------------------------|
| **Entrada** | Referencia catastral (RC) | Dirección | Polígono mapa + filtros ROI **o** RC/dirección (valoración) |
| **Output** | Informes PDF (registral, fiscal, DD) | Informe 7 ejes, score 0–100, &lt;5 min | **Ranking oportunidades** + ficha + scan |
| **Usuario** | Agente, inversor, abogado (pre-compra) | Comprador retail | Inversor patrimonial / asesor (encontrar deals) |
| **Monetización** | Pay-per-report (29 €–1.990 €) | Freemium + Pro + informe completo | (futuro) suscripción scan |

**Complementariedad:** ellos **validan un piso que ya elegiste**; nosotros **encontramos cuáles mirar**. La unión natural en producto: scan → pin → **“Profundizar este piso”** (informe tipo ATP/Mike lite).

---

## 2. Ideas adoptables (priorizadas)

### P0 — encajan con megaprompt actual

| Idea | De quién | Cómo en nuestro producto |
|------|----------|---------------------------|
| **Precio anuncio vs mercado real** | ATP blog + Notariado | Badge en ficha: “X % sobre precio m² notarial (CP)” — ya previsto Notariado |
| **Comparables tipo tasador** | ATP | Mediana **ponderada**, filtro ±20 % m², radio; mostrar N testigos con distancia — alinear `§5.1 B3` |
| **Rango valor (p25–p75)** | ATP | Además de ROI %, “precio justo estimado” banda en drawer |
| **Score 0–100 compuesto** | ATP | `opportunity_score` = f(ROI, vs notariado, confianza renta, completitud datos) — no solo ROI bruto |
| **Entrada por RC / dirección** | Virtual Mike + ROI Explorer vídeo valoración | Módulo `/app/valorar` además del scan masivo |
| **Catastro como hub** | Virtual Mike | Desde RC: superficie, año, cruce registral (si hay dato) → enrich listing |
| **Trazabilidad “50 fuentes”** | ATP marketing | UI honesta: “Catastro · INE · Notariado · comparables alquiler (N)” en ficha |

### P1 — fase informe / ficha profunda

| Idea | De quién | Cómo |
|------|----------|------|
| **Semáforo por ejes** | Mike (legal/fiscal/mercado) | Tabs drawer: Mercado 🟢 · Renta 🟡 · Datos 🟢 (sin prometer DD legal) |
| **Checklist negociación** | ATP | Bloque exportable: “argumentos con datos” (precio notarial, ITE si hay API, CE si hay) |
| **Margen negociación sugerido** | ATP | Si precio &gt; notariado +10 % → “margen sugerido −Y %” |
| **Informe PDF modular** | ATP + ROI Explorer | Secciones on/off; “Informe oportunidad” por `saved_deal` |
| **Reforma estimada €** | ATP | Input slider en calculadora (ya previsto) + hint “rango típico zona” fase 2 |

### P2 — enriquecimiento oficial (bloques opcionales)

| Idea | De quién | Fuente / nota |
|------|----------|----------------|
| ITE / edad edificio | ATP | Reglas por CCAA (45/30/50 años); alerta si edificio “viejo” sin dato ITE |
| ZBE, inundación, radón | ATP | APIs/datos abiertos MITMA, CTE — solo si gratis y estable |
| Licencia turística | ATP | Municipal — fase lejana |
| Subvenciones reforma | ATP | Enlace informativo, no motor |

### No prioritario (otro negocio)

- Compra de **nota simple** y explicación registral de pago (Mike 29 €).
- Due diligence legal 499 €+.
- Sustituir notario/abogado.

---

## 3. Metodología comparables (ATP → spec técnica)

Para `packages/roi-engine` / precompute:

1. Filtrar alquileres/ventas testigo: mismo `city`, m² ±20 %, misma tipología (habitaciones ±1).
2. Convertir a €/m²; ajustes opcionales: planta, ascensor (ATP cita ~4–10 %).
3. **Mediana ponderada** por similitud (distancia + Δm²), no media simple.
4. Renta conservadora: mediana × 0,85 (ya en megaprompt).
5. UI: lista “Testigos (8)” con foto, precio, distancia — como ROI Explorer comparables tab.

---

## 4. Flujo producto híbrido (idea estratégica)

```text
Explorar mapa España → Scan ROI → Click pin
    → Ficha: ROI + comparables + vs Notariado
    → [Profundizar] → RC/dirección → bloques ATP-lite (score, alertas físicas/urbanísticas free data)
    → Guardar / PDF / calculadora apalancamiento
```

Mantiene diferenciación: **descubrimiento masivo** primero; **due diligence light** en el activo elegido.

---

## 5. Copy / UX que funciona (ATP)

- “Lo que no ves puede costarte €15.000” → nosotros: “Lo que no calculas te come el ROI”.
- Informe en minutos → nosotros: “Scan en segundos (datos precomputados)”.
- Sin registro obligatorio en ATP → considerar **1 scan guest** con límite (retención vs abuso B12).

---

## 6. Promover a requisito (cuando el usuario diga “adoptada”)

Mover ítems P0 a `MEGAPROMPT.md` §5.1 o §7:

- [ ] `opportunity_score` 0–100  
- [ ] Banda p25–p75 valor venta  
- [ ] `/app/valorar` por RC  
- [ ] Checklist negociación en export PDF  

---

## 7. Referencias

- Virtual Mike informe registral: https://virtualmike.ai/informe-registral  
- Virtual Mike legal/fiscal: https://virtualmike.ai/informe-legal-fiscal-urbanistico  
- Analiza Tu Piso: https://www.analizatupiso.com  
- Blog comparables ATP: https://www.analizatupiso.com/blog/como-valorar-piso-testigos-comparables  
- Blog precio real vs portal: https://www.analizatupiso.com/blog/precios-reales-compraventa-vs-oferta-diferencia  
