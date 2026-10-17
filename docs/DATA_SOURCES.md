# Fuentes de datos — Plataforma inversión

> Complemento de `MEGAPROMPT.md`. Registro de URLs, cadencia de refresh y uso en UI.

## Principio ingesta oficial (cron 0 €)

- **Runtime (Vercel):** solo lee **Supabase** — nunca llama a MIVAU/INE/Catastro en cada click del usuario.
- **Ingesta:** **GitHub Actions** (`fetch → parse → upsert`) con URLs fijas o colas (Catastro).
- **Sensación “siempre conectado”:** cron + `scraped_at` / `period` en UI; no hace falta VPS ni APIs de pago.
- Detalle operativo Notariado/Catastro/INE mapa: `ANALISIS-DATOS-MAPAS.md`.

---

## Fuentes cron P0 (gratis, URL fija, automatizable)

Mismo patrón: job `packages/jobs/sync-official.mjs` (o equivalente) + upsert en `official_market_stats` (ver esquema abajo).

| ID | Fuente | URL de descarga | Cron sugerido | Uso en producto |
|----|--------|-----------------|---------------|-----------------|
| **mivau-vdp003** | MIVAU — transacciones inmobiliarias | https://cdn.mivau.gob.es/portal-web-mivau/Datos_MIVAU/CSV/VDP003_01.csv | Semanal (lunes) | Volumen/valor transacciones por territorio y periodo |
| **mivau-vdp006** | MIVAU — valor tasado vivienda (€/m²) | https://cdn.mivau.gob.es/portal-web-mivau/Datos_MIVAU/CSV/VDP006_01.csv | Semanal | Referencia compra agregada (CCAA/provincia); contexto “precio vs mercado” cuando no hay Notariado CP |
| **mivau-vdp004** | MIVAU — precio medio suelo urbano | https://cdn.mivau.gob.es/portal-web-mivau/Datos_MIVAU/CSV/VDP004_01.csv | Mensual | Macro suelo / desarrollo (ficha barrio, informe) |
| **ine-vte-39364** | INE — viviendas turísticas (provincia/CCAA) | https://www.ine.es/jaxiT3/files/t/csv_bd/39364.csv | Mensual | Presión alquiler turístico (badge / panel barrio) |
| **ine-irav-72975** | INE — IRAV alquiler (índice) | https://www.ine.es/jaxiT3/files/t/csv_bd/72975.csv | Mensual | **Solo tendencia** (% interanual); no sustituye €/mes ni comparables |
| **registradores-compraventa** | Colegio Registradores — compraventas residenciales | CSV en [opendata.registradores.org](https://opendata.registradores.org/dataset/es/dataset/?tags_es=viviendas) (dataset “por provincia”) | Trimestral (al publicar) | €/m² y operaciones por **provincia** (fallback Notariado) |

**Health check:** si un HEAD/GET devuelve ≠200, el workflow falla → alerta (Resend/issue). Guardar `content_length` o hash del fichero en `scrape_runs` o columna `file_hash` en metadata.

**Catálogo:** [datos.gob.es — MIVAU vivienda](https://datos.gob.es/es/catalogo/conjuntos-datos?publisher__name__contains=Ministerio+de+Vivienda).

---

## Fuentes cron P1 (automáticas, algo más de mantenimiento)

| Fuente | Ingesta | Cron | Notas |
|--------|---------|------|-------|
| **SERPAVI agregados** | ZIP por nivel (municipio / sección) desde [SERPAVI MIVAU](https://www.mivau.gob.es/vivienda/alquila-bien-es-tu-derecho/serpavi) | Trimestral / al publicar año nuevo | Renta **oficial** €/m², P25/P75; join por `cusec` o código municipio INE. **No** automatizar el visor con captcha ([serpavi.mivau.gob.es](https://serpavi.mivau.gob.es/)). |
| **INE IPV / IPVA / tablas sección** | [INE OpenAPI](https://ine.es/OpenAPI/) o `jaxiT3/files/t/csv_bd/{tabla}.csv` | Mensual | IPV = tendencia compraventa; IPVA = tendencia alquiler experimental |
| **INE geometría secciones** | Shapefile / OGC una vez por provincia activa → `census_sections` | Import inicial + 1×/año | Mapa: API solo sirve bbox desde PostGIS |
| **Catastro OVC** | Cola `geocode_pending` + `catastro_cache` | Nocturno | ≤1 req/s; no es un CSV único — ver § Catastro |

---

## Fuentes diferidas (no encajan “fácil + constante” en MVP)

| Fuente | Motivo |
|--------|--------|
| **Notariado por CP** (ArcGIS penotariado.com) | Automatizable pero URL/capas frágiles; mantener como **job semanal aparte** → `notary_stats`, no mezclar con P0 CSV |
| **Idealista / APIs comerciales** | Pago o acuerdo; índices de oferta, no cierre |
| **BDE microdatos PROP** | Solicitud manual; investigación, no cron MVP |
| **PDFs OVS / boletines MIVAU** | Curación manual |

---

## Tabla unificada `official_market_stats`

Upsert idempotente para fuentes **P0/P1 agregadas** (CSV MIVAU, INE tabla, Registradores). Notariado CP puede seguir en `notary_stats`; opcionalmente replicar filas normalizadas aquí.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid | PK |
| `source` | text | p.ej. `mivau-vdp006`, `ine-vte-39364` |
| `geo_level` | text | `national`, `ccaa`, `province`, `municipality`, `cusec`, `postal_code` |
| `geo_code` | text | Código INE, CODAUTO, etc. |
| `geo_name` | text | Etiqueta UI (opcional) |
| `period` | text | `2026-Q2`, `2026M05`, trimestre fiscal, etc. |
| `metrics` | jsonb | Campos parseados (precio_m2, operations, …) |
| `source_url` | text | URL exacta del fichero |
| `file_hash` | text | SHA256 del CSV (detectar cambios) |
| `scraped_at` | timestamptz | Última ingesta OK |

**Índice único sugerido:** `(source, geo_level, geo_code, period)`.

**RLS:** lectura autenticada; escritura solo `service_role` (jobs).

---

## Workflow GitHub Actions

| Workflow | Frecuencia | Contenido |
|----------|------------|-----------|
| **`sync-official-csv.yml`** | Semanal (+ `workflow_dispatch`) | Descarga filas **Fuentes cron P0** → `official_market_stats` |
| **`enrich-catastro.yml`** | Nocturno | Cola listings → OVC → `catastro_cache` / `listing_enrichment` |
| **`enrich-notary-cp.yml`** (F6) | Semanal | CP piloto → `notary_stats` (ArcGIS; no P0) |
| **`sync-ine-sections.yml`** (F6) | Mensual | Métricas sección + refresco tablas INE configuradas |

Variables: `SUPABASE_SERVICE_ROLE_KEY`, opcional `DRY_RUN=1`.

---

## Scraping / ingestión de anuncios

Prioridad: `PORTALES-SCRAPING.md`.

| Prioridad | Portal | Venta | Alquiler (comparables) |
|-----------|--------|-------|-------------------------|
| **P0** | [kelify.com](https://kelify.com) | Sí | Sí |
| **P0** | [pisos.com](https://www.pisos.com) | Sí | Sí |
| **P1** | [Fotocasa](https://www.fotocasa.es/es/) | Sí | Sí |
| **P1** | [habitaclia](https://www.habitaclia.com) | Sí | Sí |

Cadencia MVP: P0 cada 12 h; P1 cada 24 h.

**Aislamiento:** jobs escriben en el Supabase de **Plataforma de inversión** (este repo).

**Nota legal:** datos orientativos; verificar en portal original antes de invertir.

---

## Catastro (oficial, gratuito)

- **Web:** https://www.sedecatastro.gob.es  
- **Documentación WS:** https://www.catastro.hacienda.gob.es/ws/Webservices_Libres.pdf  
- **Base OVC:** `ovc.catastro.meh.es`

| Dato producto | Método |
|---------------|--------|
| RC desde coordenadas | `Consulta_RCCOOR` |
| Superficie, antigüedad, dirección | `Consulta_DNPRC` / JSON callejero |
| Contexto mapa | WMS cartografía (sin bulk download) |

**Cache:** tabla `catastro_cache`, TTL 30 días. **Ingesta:** job nocturno automatizado (cola), no descarga manual.

**Estadísticas agregadas (opcional P1):** [Estadísticas catastrales](https://www.catastro.hacienda.gob.es/es-es/estadisticas.html) — valor catastral medio por municipio (PC-Axis, import trimestral).

---

## Notariado (oficial)

- **Web:** https://www.penotariado.com  
- **Uso:** estadísticas precio real por municipio / CP en ficha **Barrio** y score “precio vs mercado”.

**Ingesta:** job semanal GitHub Actions → tabla `notary_stats` ( **no** P0 CSV). El visor público expone capas **ArcGIS Feature Service**. Precargar por **código postal** en ciudades piloto; guardar `source_url`, `period`, `es_estimado` y JSON crudo. Ver `ANALISIS-DATOS-MAPAS.md` §2.2.

**Complemento estable:** EPData CGN — https://www.epdata.es/serie/compraventa-viviendas/532 (JSON/CSV, backup histórico).

---

## INE (oficial)

- **Web:** https://www.ine.es  
- **Uso:** secciones censales (mapa toggle), demografía en panel barrio.

**Geometría:** colección OGC `Secciones_2024` o shapefile desde [cartografía INE](https://www.ine.es/prodyser/cartografia) → PostGIS `census_sections`.  
**Atributos:** tablas INEbase por sección vía [API JSON](https://www.ine.es/dyngs/DAB/index.htm) → `census_section_metrics`.  
**Tablas cron P0:** ver tabla **Fuentes cron P0** (39364, 72975).  
**App:** servir GeoJSON recortado al bbox del mapa (no toda España). Atribución: «Seccionado cedido por el Instituto Nacional de Estadística». Ver `ANALISIS-DATOS-MAPAS.md` §2.3.

---

## Atribución en UI (texto tipo)

- *Datos catastrales © Dirección General del Catastro.*  
- *Estadísticas INE — [dataset], [año].*  
- *Precio medio notarial — Portal Estadístico Notariado, [trimestre].*  
- *Transacciones / valor tasado — Ministerio de Vivienda y Agenda Urbana (MIVAU), [periodo].*  
- *Compraventas registrales — Colegio de Registradores, [trimestre].*
