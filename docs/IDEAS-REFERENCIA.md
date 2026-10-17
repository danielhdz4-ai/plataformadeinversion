# Ideas de referencia (no vinculantes)

> Notas del equipo sobre **otros sistemas** o productos que **inspiran** la Plataforma de inversión.  
> **Nada de esto es requisito de arquitectura** ni implica compartir repo, BD o despliegue con esos sistemas.  
> **Despliegue actual:** solo Vercel + Supabase + GitHub Actions — **sin VPS**. Ideas tipo “poll cada 17 min en worker” se adaptan a **cron Actions**, no a daemon en servidor.

---

## Extracción continua de anuncios

- Poll frecuente (p. ej. cada 15–17 min) en lugar de un solo scrape diario.
- Rotación por ciudad (Barcelona → municipios del área metropolitana).
- Catálogo separado **venta** vs **alquiler** (alquiler = comparables para ROI).
- Dedup por URL + heurísticas (teléfono, dirección, precio/m²).
- Job en background con estado (`running`, `lastAt`, `lastError`) visible en panel admin.

## Clasificación y calidad

- Score compuesto: ROI bruto + “barato vs mediana de zona” (€/m²).
- Badge “confianza baja” si renta es estimación fija, no comparables.
- Detectar anuncios stale / vendidos (regex en respuestas — útil si hay contacto propietario; opcional en SaaS puro).

## Mapa y UX

- Lista + mapa sincronizados; pin con % ROI.
- Filtros por score mínimo, precio máx., habitaciones.
- Sync manual “refrescar catálogo” para el usuario impaciente.

## Notificaciones (fase posterior)

- Aviso cuando termina un scan pesado (email Resend).
- Idea Telegram: solo si más adelante queréis alertas ops; **no** es core del MVP inversor web.

## Métricas rápidas v1 → v2

- v1: renta ≈ €/m²/mes × superficie (como prototipo).
- v2: mediana comparables en radio + factor conservador (−15 %).

## Official data (siempre en roadmap Plataforma)

- Catastro, INE, Notariado — ver `ANALISIS-DATOS-MAPAS.md`.

---

**Competencia / informes pre-compra:** ideas de [Virtual Mike](https://www.virtualmike.ai) y [Analiza Tu Piso](https://www.analizatupiso.com) en `IDEAS-COMPETENCIA.md` (score 0–100, testigos tasador, RC como entrada, vs precio notarial).

Cuando una idea pase a **requerimiento**, moverla a una fase concreta en `MEGAPROMPT.md` §7 y borrarla de aquí o marcarla `[adoptada]`.
