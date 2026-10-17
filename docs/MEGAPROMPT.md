# Megaprompt — Plataforma de inversión (ROI-first)

> **Producto (nombre de trabajo):** **Plataforma de inversión** — SaaS de scan geográfico + ROI para inversores (repo `plataformadeinversion`). **Dominio:** pendiente de compra; hasta entonces todo copy, emails e infra usan este nombre genérico.  
> **Documento vivo.** El agente de código (Cursor) es el ingeniero principal. Este MD es la fuente de verdad de producto, arquitectura y reglas de implementación.  
> **Restricción absoluta:** coste en servicios **0 €**. Solo trabajo, tiempo y tiers gratuitos.

---

## 0. Meta-instrucción para el agente

Cuando el usuario pida avanzar una fase, el agente debe:

1. Leer este archivo completo (o la sección indicada).
2. Tratar **`plataformadeinversion` como producto 100 % independiente**: repo, Supabase, dominio, scrapers y datos propios. **No integrar, sincronizar, importar código ni compartir base de datos** con otros repositorios salvo orden explícita futura.
3. Priorizar **MVP funcional** sobre paridad pixel-perfect con ROI Explorer.
4. No introducir servicios de pago (Stripe, Mapbox de pago, Redis de pago, etc.) hasta que el usuario lo autorice explícitamente.
5. **No VPS / no Docker en producción** para este producto (fase actual): solo **web + plataforma** en Vercel + Supabase + GitHub Actions.
6. Implementar mitigaciones de **§5.1 Cuellos de botella** en el mismo orden de prioridad (B1→B10); no entregar fases que empeoren un cuello sin resolver el anterior.
7. **Alcance legal:** fuera de foco del agente (decisión producto); no bloquear MVP por páginas legales extensas.
8. Documentar en `docs/CHANGELOG.md` cada hito completado (crear el archivo en el primer commit).

---

## 1. Visión del producto

### 1.1 Qué NO es

- No es un portal que liste **todo** el mercado.
- No tiene relación técnica ni de negocio con otros productos del usuario (p. ej. portales de alquiler o compraventa ajenos a este repo).
- No es un clon de marca de [ROI Explorer](https://roiexplorer.com/es).
- **No es un stack en VPS** (sin servidor propio, sin Docker 24/7, sin worker Redis/BullMQ en máquina dedicada) — al menos en esta fase.

### 1.2 Qué SÍ es

Un **SaaS de descubrimiento de oportunidades** para inversores (patrimoniales, asesores, pequeñas empresas):

- El usuario define **zona** (ciudad, barrio, polígono en mapa).
- El sistema muestra **solo los inmuebles más interesantes para invertir** según ROI y filtros (precio, habitaciones, operación buy-to-let, habitaciones, Airbnb, etc.).
- Cada ficha combina: **anuncio de venta** (scraping propio de este proyecto) + **renta estimada** (comparables de alquiler scrapeados en el mismo Supabase) + **contexto oficial** (Catastro, INE, Notariado).
- Flujo tipo ROI Explorer (referencia UX en capturas del usuario): wizard Scan → progreso → lista + mapa → panel detalle → calculadora → informe.

### 1.3 Propuesta de valor (una frase)

**“En 2 minutos, las mejores operaciones de tu zona con ROI calculado y datos oficiales, sin Excel ni 20 pestañas.”**

### 1.4 Fuentes de listings (solo este proyecto)

Todo el inventario vive en **este** Supabase. Scrapers propios en GitHub Actions:

| Pipeline | Operación | Uso en producto |
|----------|-----------|-----------------|
| `scrape-sale` | Venta | Oportunidades buy-to-let / ranking ROI |
| `scrape-rent` | Alquiler | Comparables para estimar renta |
| `enrich-*` | — | Catastro, INE, Notariado |

**Stack acordado (solo web y plataforma):**

| Qué ve el usuario | Dónde corre |
|-------------------|-------------|
| Landing + marketing | Vercel (Next.js) |
| App `/app/*` (scan, mapa, calculadora, guardados) | Vercel (Next.js SSR + API routes) |
| Login, BD, ficheros PDF | Supabase |
| Scrapers, enrich Catastro/INE, alertas batch | **GitHub Actions** (cron), escribiendo a Supabase |
| Emails | Resend |

Todo en este repositorio. **Sin VPS.**

**MVP:** Supabase dedicado a esta plataforma ROI (repo local `plataformadeinversion`).

**Portales de referencia para extraer inmuebles** (scraping / ingestión): ver `docs/PORTALES-SCRAPING.md`.  
- **P0 (principales):** [kelify.com](https://kelify.com) + [pisos.com](https://www.pisos.com) — venta y alquiler.  
- **P1 (secundarios):** [Fotocasa](https://www.fotocasa.es/es/), [habitaclia](https://www.habitaclia.com).

**Error a evitar:** confundir **Plataforma de inversión** (este producto) con los **portales** de donde salen los anuncios (kelify.com, pisos.com, etc.). Otros sistemas del equipo (p. ej. bots, scrapers en VPS) son **solo ideas de referencia**, no dependencias de este repo — ver §23.

---

## 2. Restricción 0 € — stack permitido

| Capa | Servicio | Tier free — límites a respetar |
|------|----------|--------------------------------|
| App + API ligera | **Vercel** (Hobby) | Sin crons de pago; funciones serverless con timeout; usar Actions para lo pesado |
| Repo + CI scrapers | **GitHub** + **GitHub Actions** | ~2000 min/mes repo privado; jobs cortos, por ciudad/fuente |
| BD + Auth + Storage | **Supabase** | 500 MB DB, proyecto pausable; PostGIS si cabe en extensión |
| Email | **Resend** | ~100 emails/día en free |
| Mapas | **MapLibre GL** + tiles **OpenStreetMap** / Catastro WMS donde aplique | Evitar Mapbox de pago en MVP |
| IA informes | **Opcional fase 4+** | Solo si hay créditos free (OpenRouter trial); si no, plantillas deterministas |
| Pagos SaaS | **Fuera de MVP** | Manual / lista de espera hasta haber ingresos |

**Prohibido en MVP:** Stripe, Upstash de pago, workers de pago, APIs inmobiliarias de pago, **VPS/servidor dedicado** para app o scrapers.

### 2.1 Implicaciones de “solo web” (realistas)

- Los scrapers **no** corren cada 17 min en un daemon; corren en **cron de Actions** (p. ej. cada 6–12 h en free tier, o varios workflows cortos).
- El scan del usuario lee **datos ya en Supabase** (rápido); opcionalmente dispara un job Action si hace falta refrescar (email al terminar).
- Playwright en Actions es posible pero pesado en minutos CI — preferir `fetch` + parse; Playwright solo si imprescindible y con `MAX_LISTINGS` acotado.
- Cuando el usuario abre la plataforma, es **una página web normal** en el navegador; no instala nada, no depende de un servidor vuestro encendido.

---

## 3. Referencia funcional (paridad objetivo por fases)

Basado en tutoriales ROI Explorer + capturas de pantalla del usuario.

### 3.1 Módulo Scan (wizard)

1. **Ubicación:** país (ES primero), fuentes visibles (**kelify.com + pisos.com** + secundarios Fotocasa/habitaclia según scrapers activos), búsqueda por texto o **polígono en mapa**.
2. **Operación:** comprar | buy-to-let | habitaciones | Airbnb | reformar (fase 2) | subarriendo (fase 3).
3. **Detalles:** habitaciones, baños, m² min/max, precio min/max, toggle apalancamiento (afecta ranking por defecto: ROI bruto vs apalancado).
4. **Buscar:** pantalla de progreso (~30–60 s): “desarrollos cercanos”, “anuncios en zona”, “estimando alquiler y ROI”. Opción “avísame por email cuando termine” (Resend).

### 3.2 Mapa (requisito transversal — España)

- Mapa usable en **toda España** (península, Baleares, Canarias): pan/zoom libre, bounds opcionales.
- **Siempre** mostrar pisos en viewport donde existan datos: refetch por `bbox` al mover mapa (`GET /api/map/listings`).
- Modo **explorar** (nacional) + modo **resultados scan** (polígono/filtros); misma capa de pins ROI.
- Detalle técnico: `docs/MAPA-ESPANA.md`.

### 3.3 Resultados del scan

- Layout: **lista izquierda** (orden ROI ↓) + **mapa derecha** (pins con % ROI).
- Acciones: Nuevo scan, Repetir scan, Análisis zona, Exportar CSV, Crear alerta.
- Toggle mapa: **secciones censales** (capa INE).
- Card: foto, precio, portal, barrio, habitaciones/baños/m², alquiler est., **ROI %**.

### 3.4 Detalle de inmueble (drawer)

Pestañas: Resumen | ROI | Comparables | Barrio | Lugares.

- Enlace anuncio original.
- Desglose ROI (compra, ITP/AJD, renta anual, ROI bruto).
- Comparables alquiler (N en radio X m), regla conservadora: **mediana − 15 %** (configurable).
- Barrio: demografía INE (sección censal), mercado Notariado (CP), desarrollos locales (fase 2, fuente curada/manual).
- Informe: secciones on/off, generar PDF (Storage Supabase), logo org (fase 3).

### 3.5 Calculadora ROI (página dedicada)

Modos: buy-to-let | turístico | flipping (fase 2).

Inputs España: precio, ITP %, AJD %, reforma, alquiler, ocupación, hipoteca (entrada %, plazo, tipo), IBI (% valor catastral).

Outputs: inversión inicial, cash flow mensual, ROI sobre capital, creación patrimonio.

### 3.6 CRM ligero (fase 3)

Kanban en Guardados, etiquetas por cliente, enlace solo lectura, comentarios → email (Resend). Ver vídeo CRM ROI Explorer.

---

## 4. Integración datos oficiales (obligatorio en diseño)

### 4.1 Sede Electrónica del Catastro

- Portal: https://www.sedecatastro.gob.es  
- **Servicios web libres** (PDF oficial): https://www.catastro.hacienda.gob.es/ws/Webservices_Libres.pdf  

**Uso en producto:**

| Caso | Servicio | Endpoint / notas |
|------|----------|------------------|
| Valoración: dirección → RC | Callejero + coordenadas | `Consulta_DNPRC`, `Consulta_RCCOOR` |
| Superficie, año, uso | Datos no protegidos por RC | JSON/WCF: `.../COVCCallejero.svc/json/Consulta_DNPRC?RefCat=...` |
| Mapa parcelas | WMS libre | `http://ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx` — **sin descarga masiva** |
| IBI estimado en calculadora | Valor catastral / superficie | Enriquecer listing post-geocode; cache agresivo |

**Implementación:**

- Paquete `packages/catastro-client` (fetch + parse XML/JSON + cache en tabla `catastro_cache`).
- Rate limit: 1 req/s por IP; cache TTL 30 días por RC.
- Job nocturno (Actions): enriquecer listings con RC pendiente (batch 500/día).

### 4.2 Portal Estadístico Notariado (precio real vivienda)

- Portal: https://www.penotariado.com  

**Uso en producto:**

- Panel **Barrio / CP**: precio medio m², precio medio venta, superficie media, nº operaciones (como ROI Explorer).
- Validación: “¿El precio del anuncio está por encima del mercado notarial?”

**Implementación MVP:**

- Investigar si existe **API/export JSON** del portal estadístico (muchas vistas son HTML/Chart). Si no hay API estable:
  - **Ingesta semanal** vía Action que descargue dataset público por municipio/CP (respetar robots/ToS).
  - Tabla `notary_stats` (`postal_code`, `year`, `quarter`, `price_m2`, `avg_price`, `avg_surface`, `operations_count`, `source_url`, `scraped_at`).
- Mostrar siempre **fuente y fecha** en UI.

### 4.3 INE

- Portal: https://www.ine.es  

**Uso en producto:**

- **Secciones censales** en mapa (geometrías + atributos).
- Ficha barrio: población, renta neta per cápita, empleo, educación superior, índice Gini (según disponibilidad por sección).

**Implementación MVP:**

- Descargar capa censal / estadísticas de sección desde [API JSON-STAT INE](https://www.ine.es/dyngs/INE/es/index.htm?padre=2595) o ficheros PC-Axis; cargar en PostGIS `census_sections(geom, code, metrics jsonb)`.
- Job mensual Actions: refresco limitado a **provincias activas** (Barcelona, Madrid primero).
- Join espacial: `ST_Contains(census_sections.geom, listing.geom)`.

### 4.4 Reglas de presentación legal

- Disclaimer en footer y en informes: *información orientativa, no asesoramiento financiero/legal/fiscal*.
- Enlace a fuente en cada bloque (Catastro / INE / Notariado / portal del anuncio).
- No afiliar ni usar logos de portales (kelify.com, pisos.com, Fotocasa, habitaclia) como partnership salvo acuerdo real.

### 4.5 Estadística oficial vía cron (0 €, sin manual)

**Regla:** la app en Vercel **no** consume portales oficiales en tiempo real. Toda estadística agregada entra por **GitHub Actions** y se sirve desde Supabase.

**P0 (implementar en F6 junto a Catastro/INE):**

- Workflow **`sync-official-csv.yml`** semanal: descarga URLs fijas MIVAU + INE + Registradores → tabla **`official_market_stats`**.
- Lista canónica de URLs, cron y columnas: **`docs/DATA_SOURCES.md`** (secciones *Principio ingesta oficial*, *Fuentes cron P0*, *Tabla unificada*).
- Health check: fallo de descarga → alerta operativa (§20).

**Prioridad de uso en ficha barrio / score:**

1. Comparables scrape (ROI) + Catastro (unidad).  
2. `notary_stats` por CP cuando exista muestra.  
3. `official_market_stats` (MIVAU VDP006, Registradores provincia, SERPAVI cuando esté importado) como contexto y fallback.  
4. IRAV / IPV solo **tendencia**, nunca renta absoluta (ver `CUELLOS-DE-BOTELLA.md`).

**Evitar en MVP “conexión constante”:** visor SERPAVI con captcha, scraping HTML penotariado por usuario, APIs de pago (Idealista, etc.).

---

## 5. Motor de “pisos interesantes” (core diferenciador)

No indexar todo. **Pipeline de selección:**

```
Listings venta en polígono (scraping)
        ↓
Filtros duros (precio, m², habitaciones, operación)
        ↓
Estimar alquiler (comparables alquiler **de esta BD** en radio R)
        ↓
Calcular ROI bruto (+ opcional apalancado)
        ↓
Score = f(ROI, descuento vs notariado, liquidez comparables, completeness datos)
        ↓
TOP N por scan (default N=100, max 200) → UI
```

**Parámetros default (config `scan_defaults`):**

- `rent_comparable_radius_m`: 250 → 500 si <5 comparables
- `rent_conservative_factor`: 0.85 (mediana × factor)
- `min_comparables_for_estimate`: 3 (si no, marcar “baja confianza”)
- `purchase_tax_itp_pct`: 10 (CCAA configurable después)
- `ranking`: ROI bruto descendente; desempate: más comparables, menor precio/m² vs notariado

### 5.1 Cuellos de botella — requisitos obligatorios (sin VPS)

> Detalle ampliado también en `CUELLOS-DE-BOTELLA.md`, `MAPA-ESPANA.md`.  
> **Pipeline canónico:** Scrape → Geocode → Comparables → `listing_investment` → Mapa/Scan.

#### Prioridad de implementación

| ID | Cuello | Mitigación resumida | DoD (Definition of Done) |
|----|--------|---------------------|---------------------------|
| **B1** | **Cobertura** (mapa vacío fuera de 2–3 ciudades) | Tier 1 (8 ciudades) venta+alquiler 2×/día; Tier 2 rotación; H3 si cap portal; `coverage_regions` + UI “sin datos aquí” + `user_map_requests` | Valencia viewport z=12 ≥40 pins con ROI; cada Tier 1 ≥800 ventas activas |
| **B2** | **Coordenadas** | Waterfall G0 portal → G2 Catastro → G4 Nominatim (cache, 200/run) → G5 municipio (badge approx); `geocode_pending` | ≥85 % activos Tier 1 con `geocode_quality` ≤3 |
| **B3** | **ROI / renta** | Escalera R3→R0; `listing_investment` precomputado; trazabilidad en ficha (N comparables, radio) | ≥60 % ventas Tier 1 con confianza ≥ media; scan no recalcula todo en Vercel |
| **B4** | **Scrape silencioso** | Tabla `scrape_runs`; alerta si `upserted=0` ×3; `/api/admin/scrape-status` o panel mínimo | Cada job deja fila traceable; email Resend en fallo crítico |
| **B5** | **Frescura** | `scraped_at`, `price_changed_at`; badge ↓ precio; copy “datos actualizados hace X h” | Usuario ve antigüedad en ficha; re-scrape Tier 1 <48 h medio |
| **B6** | **Dedup** | `(source_portal, external_id)` + cross-portal (RC catastro o addr+price+m²+30 m) | Duplicados <5 % en muestra manual Tier 1 |
| **B7** | **ITP / CCAA** | Tabla `tax_rules(ccaa, itp_pct, ajd_pct)`; ROI usa CCAA del listing | Tests por 2 CCAA distintas |
| **B8** | **Tipología basura** | Filtro `property_kind` (excluir garaje, trastero, local salvo modo flip) | Mapa buy-to-let solo residencial por defecto |
| **B9** | **Scan timeout Vercel** | Scan = lectura `scan_results` precomputados; polígono grande solo filtra BD | Scan Tier 1 <5 s p95 |
| **B10** | **Mapa móvil / rendimiento** | Cluster por zoom; límite features bbox; debounce moveend 300 ms | 60 fps pan en móvil mid-range con 300 pins |
| **B11** | **Confianza del número** | Pin color por `rent_confidence`; sin comparables → pin gris o excluido del ranking ROI | Ficha muestra desglose renta siempre |
| **B12** | **Abuso API** | Rate limit rutas `/api/map/*`, `/api/scans` (por user/IP); `CRON_SECRET` en jobs | 429 tras umbral razonable en tests manuales |

#### B1 Cobertura — detalle

- Config: `scripts/scrape/spain-locations.json` (slug, bbox, tier).
- Workflows: `scrape-tier1-cities.yml`, `scrape-tier2-cities.yml`, `scrape-province-rotate.yml`, `scrape-on-demand.yml`.
- Portales P0: kelify.com + pisos.com (venta y alquiler en mismas ciudades Tier 1).
- Mapa nacional siempre navegable; densidad crece por tier (ver `MAPA-ESPANA.md`).

#### B2 Geocode — waterfall

| Paso | Fuente | `geocode_quality` |
|------|--------|-------------------|
| G0 | Portal lat/lng | 1 |
| G2 | Catastro DNPLOC | 2 |
| G4 | Nominatim + `geocode_cache` (1 req/s) | 3 |
| G5 | Centroide municipio | 5 (no pin ROI en zoom≥14) |

Job: `geocode-batch.yml` (horario, max 200/listing).

#### B3 ROI — escalera renta

| Nivel | Regla | UI |
|-------|-------|-----|
| R3 | ≥5 alquileres en 250 m, mediana×0,85 | Alta |
| R2 | 3–4 en 500 m o mediana `zone_key` | Media |
| R0 | `rent_benchmarks(city, eur_per_sqm_month)` desde scrape alquiler | Baja |
| R- | none | Sin % en pin principal |

Job: `precompute-roi.yml` tras scrapers Tier 1.

#### B4 Observabilidad scrape

```sql
scrape_runs (
  id, workflow, city_slug, portal,
  started_at, finished_at,
  fetched, upserted, geocoded, errors jsonb,
  status  -- ok | partial | failed
);
```

#### B6 Dedup cross-portal

1. Misma RC (Catastro enrich).  
2. Hash: normalize(address)+price±3 %+m²±5 %+ST_DWithin 30 m.  
3. Mantener `source_url` canónico; UI un pin por oportunidad (fase 2).

#### B9 Scan vs precompute

- `POST /api/scans` → insert `scans` + copia filtros.  
- `POST /api/scans/[id]/run` (Action o worker chunk): rellena `scan_results` desde `listing_investment` + `ST_Within`.  
- UI progreso puede ser real o basado en pasos (datos ya en BD).

#### UX obligatoria (paridad funcional ROI Explorer)

- [ ] Wizard 3 pasos + polígono **en cualquier punto de España**  
- [ ] Lista ↔ mapa sincronizados; pin con **% ROI**  
- [ ] **Enlace anuncio original** en ficha  
- [ ] Estados vacío: sin datos en bbox vs sin resultados en scan  
- [ ] `GET /api/map/listings?bbox=&zoom=` en exploración nacional  

#### Límites tier free (B extra)

- Monitor semanal tamaño BD Supabase; purgar `archived` >90 días.  
- GitHub Actions: priorizar Tier 1 si minutos CI <20 % restantes.  
- Listings slim: sin imágenes en Storage; solo `thumbnail_url` externa o proxy.

---

## 6. Arquitectura técnica (0 €)

```text
┌─────────────────────────────────────────────────────────────┐
│  Next.js (Vercel) — plataformadeinversion                   │
│  /app/scan/*  /app/calculator  /app/saved  marketing        │
└───────────────┬─────────────────────────────┬───────────────┘
                │ Supabase client (RLS)        │ Route Handlers
                ▼                              ▼
┌───────────────────────────┐    ┌────────────────────────────┐
│ Supabase Postgres+PostGIS │    │ GitHub Actions (cron)      │
│ Auth, Storage (PDFs)      │◄───│ scrapers / enrich / alerts │
└───────────────────────────┘    └────────────────────────────┘
         ▲  listados venta + alquiler (misma BD, dedup por portal+id)
         └─ GitHub Actions escriben vía SUPABASE_SERVICE_ROLE_KEY
```

### 6.1 Repositorio objetivo

Monorepo en `D:\Proyectos\plataformadeinversion`:

```
plataformadeinversion/
├── docs/
│   ├── MEGAPROMPT.md          ← este archivo
│   ├── ARCHITECTURE.md        ← fase 1
│   ├── DATA_SOURCES.md        ← URLs, TTL, legal
│   ├── INFRA-CUENTA.md        ← danielhdz4-ai, Supabase ref (sin secretos)
│   ├── ANALISIS-DATOS-MAPAS.md ← Catastro/INE/Notariado, mapas, cobertura
│   ├── INFRASTRUCTURE.md      ← secrets, Vercel, Supabase (F0)
│   ├── LANZAMIENTO.md         ← pasos post-código hasta beta/prod
│   ├── PORTALES-SCRAPING.md   ← kelify.com + pisos.com (P0), secundarios
│   ├── IDEAS-REFERENCIA.md    ← ideas externas (no integración obligatoria)
│   ├── MAPA-ESPANA.md         ← mapa nacional + pisos siempre visibles
│   ├── CUELLOS-DE-BOTELLA.md  ← detalle B1–B12
│   └── IDEAS-COMPETENCIA.md   ← Virtual Mike, Analiza Tu Piso
├── apps/web/                  ← Next.js
├── packages/
│   ├── roi-engine/            ← cálculos puros TS
│   ├── catastro-client/
│   └── db-types/
├── scripts/
│   ├── scrapers/              ← scrapers nuevos (venta + alquiler)
│   └── jobs/                  ← sync-official, enrich INE/notariado
├── supabase/migrations/
└── .github/workflows/
    ├── scrape-tier1-cities.yml
    ├── scrape-tier2-cities.yml
    ├── scrape-province-rotate.yml
    ├── scrape-on-demand.yml
    ├── geocode-batch.yml
    ├── precompute-roi.yml
    ├── sync-official-csv.yml   ← MIVAU/INE CSV P0 (§4.5)
    ├── enrich-catastro.yml
    └── scrape-health-alert.yml
```

### 6.2 Tablas Supabase (borrador v0)

**Core**

- `organizations`, `profiles`, `memberships`
- `listings` (`operation` sale|rent, `source_portal`, `geom`, `geocode_quality`, `property_kind`, `scraped_at`, `status`)
- `listing_enrichment` (rc, catastral_surface, year_built, raw jsonb)
- `listing_investment` (rent_est, rent_confidence, comparables_count, roi_gross, computed_at) — **§5.1 B3**
- `scans`, `scan_results`
- `saved_deals`, `alerts`, `reports`

**Cuellos de botella (§5.1)**

- `coverage_regions`, `user_map_requests` — B1  
- `geocode_cache`, `geocode_pending` — B2  
- `rent_benchmarks` (city_slug, eur_per_sqm_month) — B3 R0  
- `tax_rules` (ccaa, itp_pct, ajd_pct) — B7  
- `scrape_runs` — B4  
- `listing_dedup_links` (canonical_listing_id, duplicate_listing_id) — B6 opcional  

**Oficial**

- `official_market_stats` — CSV MIVAU/INE/Registradores (§4.5, `DATA_SOURCES.md`)
- `catastro_cache`, `notary_stats`, `census_sections`, `census_section_metrics`

Habilitar **PostGIS**: `create extension postgis;` + `GIST(geom)`.

Índice único: `(source_portal, source_external_id)`.

---

## 7. Roadmap por fases (orden estricto)

| Fase | Entregable | Cuellos | Definition of done |
|------|------------|---------|-------------------|
| **F0** | Repo + Supabase + Vercel + MD | — | Deploy hello + PostGIS + secrets |
| **F1** | ROI engine + calculadora + `tax_rules` | B7 | Tests 155k/1105€; 2 CCAA |
| **F2** | Mapa España + viewport API + seed demo | B1 parcial, B9, B10 | `/api/map/listings`; polígono demo; clusters |
| **F3** | Scrapers Tier 1 + `scrape_runs` | B1, B4, B5, B8 | 8 ciudades venta+alquiler; runs traceables |
| **F4** | Geocode waterfall + precompute ROI | B2, B3, B6, B11 | ≥85 % geom; `listing_investment`; trazabilidad ficha |
| **F5** | Scan wizard + resultados reales | B9, UX §5.1 | Scan <5 s Tier 1; enlace original |
| **F6** | Catastro + Notariado + INE mapa | — | Ficha barrio 3 fuentes |
| **F7** | Email scan + alertas + export | B4, B12 | Resend; rate limit |
| **F8** | PDF + CRM | — | Paridad vídeos 2–3 |

**MVP-READY** = F0–F5 completos + gates §18.

---

## 8. Prompts operativos (copiar/pegar al agente por fase)

### Prompt F0 — Bootstrap

```
Lee docs/MEGAPROMPT.md. Crea monorepo Next.js 15+ App Router en apps/web, supabase/migrations con PostGIS y tablas v0 de scans/listings. Configura .github/workflows/ci.yml (lint+typecheck). No uses servicios de pago. Documenta env en .env.example. Auth Supabase estándar (email/OAuth). Proyecto aislado: cero dependencias de otros repos del usuario.
```

### Prompt F1 — ROI engine

```
Implementa packages/roi-engine con buy-to-let España: ITP, AJD, apalancamiento, cash flow, ROI capital. Tests vitest con el ejemplo 155000€ / 1105€ mes / ITP 10%. Export usado por /app/calculator.
```

### Prompt F2 — Scan UI

```
Wizard 3 pasos como ROI Explorer (capturas en docs/assets). MapLibre + dibujo polígono (mapbox-gl-draw o equivalente free). API POST /api/scans crea scan y encola status. Resultados: split list+mapa, sort ROI.
```

### Prompt F3 — Datos reales

```
Implementa ingestión según PORTALES-SCRAPING.md: P0 Kelify + pisos.com (venta+alquiler); P1 Fotocasa + habitaclia. Workflows por fuente. Dedup cross-portal. Pipeline scan_results en Action o API con chunking.
```

### Prompt F4 — Oficial

```
packages/catastro-client + enrich job. Implementa sync-official-csv.yml + official_market_stats (DATA_SOURCES.md P0). Carga notary_stats y census_sections para Barcelona CP 08003 como prueba. UI pestaña Barrio con atribución de fuente y period/scraped_at.
```

---

## 9. Métricas de éxito (MVP)

- Scan en La Barceloneta (polígono demo): **≥30 oportunidades** con ROI calculado en <2 min.
- **≥70 %** listings con estimación de alquiler (≥3 comparables o flag baja confianza).
- **100 %** fichas con enlace a anuncio fuente.
- **≥50 %** enriquecidas con RC o datos catastrales en 7 días.
- 0 errores críticos RLS (usuarios solo ven sus scans/guardados).

---

## 10. Decisiones abiertas (el usuario debe responder)

Marcar cuando se decida:

- [x] **Nombre de trabajo:** Plataforma de inversión
- [ ] **Dominio** (avisar al agente cuando se compre → actualizar `NEXT_PUBLIC_SITE_URL` y Auth)
- [ ] **Ciudad piloto** única para MVP (recomendado: **Barcelona**; kelify.com tiene mucha señal en Madrid — validar piloto)
- [x] **Supabase:** proyecto dedicado (default del agente hasta cambio explícito)
- [x] **Fuentes de extracción P0:** kelify.com + pisos.com; **P1:** Fotocasa + habitaclia — ver `PORTALES-SCRAPING.md`
- [x] **Idioma MVP:** ES (copy, emails, informes)

**Defaults del agente** (si el usuario no dice lo contrario): ciudad piloto Barcelona; producto solo ES; auth email magic link + Google opcional; sin pagos en v1.

---

## 11. Definición «MVP funcional de primeras»

No esperar a F7 para tener algo usable. El hito **MVP-READY** es un **vertical slice** completo en una ciudad:

| Capacidad | Usuario puede… | Depende de fases |
|-----------|----------------|------------------|
| Cuenta | Registrarse, entrar, cerrar sesión | F0 |
| Calculadora | Modelar buy-to-let España sin scan | F1 |
| Scan | Dibujar zona → ver ranking ROI en mapa + lista | F2 + F3 |
| Ficha | Ver ROI, comparables, enlace portal, barrio (INE + Notariado mínimo) | F3 + F4 |
| Guardar | Bookmark oportunidad en «Guardados» | F2 |
| Legal | Ver aviso «no es asesoramiento» en app e informes | F0 |

**Fuera de MVP-READY** (pero planificado): alertas email, CRM kanban, PDF white-label, análisis IA zona, Stripe, multi-ciudad.

**Regla de oro:** al terminar **F5** (MVP-READY), un inversor debe **explorar el mapa en España**, hacer **scan con polígono**, ver **ROI trazable** y abrir el **anuncio original** — Tier 1 con datos reales (§5.1).

Detalle técnico mapas/datos: `docs/ANALISIS-DATOS-MAPAS.md`.  
Checklist operativa post-código: `docs/LANZAMIENTO.md`.

---

## 12. Recorridos de usuario (criterios de aceptación)

### 12.1 Inversor patrimonial (happy path)

1. Landing explica valor en 10 s → CTA «Probar scan» / «Calculadora».
2. Registro (email) → redirige a `/app/scan/nuevo`.
3. Paso 1: mapa centrado en ciudad piloto; dibuja polígono o elige barrio preset (La Barceloneta demo).
4. Paso 2: elige «Comprar para alquilar».
5. Paso 3: filtros por defecto razonables (estudio–2 hab, 100k–350k).
6. «Buscar» → progreso → resultados con **≥1 listing** (seed o scrape).
7. Click listing → drawer con ROI + comparables + «Ver anuncio original».
8. Guardar → aparece en `/app/guardados`.

**Aceptación:** flujo completo **<5 min** sin consola de admin.

### 12.2 Asesor / consultor (fase posterior)

- Mismos scans + export CSV (F6) + etiquetas cliente (F7).
- En MVP-READY: solo guardados personales.

### 12.3 Estados vacíos y error (obligatorios en UI)

| Estado | Mensaje / acción |
|--------|------------------|
| Polígono sin listings | «No hay oportunidades con estos filtros. Amplía zona o relaja precio.» |
| Sin comparables alquiler | Badge «Confianza baja» + enlace a calculadora manual |
| Scan en curso | Pasos + opción «Avísame por email» (F5) |
| Catastro pendiente | «Datos catastrales en proceso» (no bloquear ficha) |
| Notariado sin muestra CP | «Operaciones insuficientes en este CP» + mostrar municipio si existe |

---

## 13. Infraestructura y secretos (checklist F0)

Documentar en `docs/INFRASTRUCTURE.md` al bootstrap. Duplicar en **Vercel** y **GitHub Secrets**.

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App
NEXT_PUBLIC_SITE_URL=          # vacío en local; dominio real cuando exista
NEXT_PUBLIC_APP_NAME=Plataforma de inversión
NEXT_PUBLIC_DEFAULT_CITY=Barcelona
NEXT_PUBLIC_DEFAULT_MAP_CENTER=41.380,2.189
NEXT_PUBLIC_DEFAULT_ZOOM=13

# Email (F5+)
RESEND_API_KEY=
EMAIL_FROM=noreply@tudominio.com

# Jobs (Actions → API o DB directa)
CRON_SECRET=

# Opcional OAuth
# SUPABASE auth providers en dashboard
```

**GitHub Actions:** `SUPABASE_*`, `CRON_SECRET`, flags `DRY_RUN=1`, `MAX_LISTINGS=`, `CITY=barcelona`.

**Vercel:** conectar repo, rama `main`, root `apps/web` si monorepo.

**Supabase:** habilitar PostGIS; Auth redirect URLs = localhost + dominio prod.

---

## 14. Auth, organizaciones y RLS

### 14.1 Modelo mínimo

- **Fase MVP:** usuario = `auth.users` + `profiles`. Opcional `organizations` si multi-asiento más adelante.
- Rutas `/app/*` protegidas por middleware Supabase (patrón estándar SSR).

### 14.2 RLS (reglas que el agente debe implementar)

| Tabla | SELECT | INSERT/UPDATE/DELETE |
|-------|--------|----------------------|
| `listings` | usuarios autenticados (solo `status=active`) | solo `service_role` (scrapers) |
| `scans`, `scan_results` | `user_id = auth.uid()` | owner |
| `saved_deals` | owner | owner |
| `catastro_cache`, `notary_stats`, `census_sections` | autenticados read-only | service_role |
| `reports` | owner org/user | owner |

**Nunca** exponer `SUPABASE_SERVICE_ROLE_KEY` al cliente.

---

## 15. Contratos API (MVP)

Prefijo `/api`. Validación con Zod. Errores JSON `{ error, code }`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/scans` | body: `{ polygon: GeoJSON, filters, operation }` → `{ scanId, status }` |
| GET | `/api/scans/[id]` | estado + progreso |
| GET | `/api/scans/[id]/results` | listings ranked + geometrías pins |
| POST | `/api/scans/[id]/run` | dispara ejecución (o cron interno); header `Authorization: Bearer CRON_SECRET` para Actions |
| GET | `/api/listings/[id]` | detalle + investment + enrichment |
| POST | `/api/saved` | `{ listingId }` |
| GET | `/api/map/listings?bbox=&zoom=` | pins/clusters venta ROI en viewport (España) |
| GET | `/api/map/coverage` | regiones con datos + `last_scrape_at` |
| GET | `/api/map/census-sections?bbox=` | GeoJSON clip INE |
| GET | `/api/health` | `{ ok, db, version, lastScrapeRun }` |
| GET | `/api/map/coverage` | `coverage_regions` + counts |
| GET | `/api/admin/scrape-status` | últimos `scrape_runs` (auth admin) |

**Realtime opcional:** suscripción Supabase a fila `scans` para progreso (free tier OK).

**Rate limit (B12):** middleware simple en `/api/map/*` y POST `/api/scans` (p. ej. 60 req/min/user).

---

## 16. Seed y modo demo (funcional antes del scrape masivo)

Para que **F2 ya demuestre valor**:

1. Script `scripts/seed/barcelona-demo.ts` inserta **30–50 ventas + 80 alquileres** ficticios o semi-reales (coords La Barceloneta/Eixample) con URLs de ejemplo marcadas `origin=demo`.
2. Flag `NEXT_PUBLIC_DEMO_MODE=1` muestra banner «Datos de demostración».
3. Al completar F3, seed demo se desactiva en prod o se borra `origin=demo`.

**Polígono preset** en wizard: botón «Usar zona demo (Barceloneta)» carga GeoJSON fijo → siempre hay resultados en desarrollo.

---

## 17. Legal

**Fuera de alcance del agente** (decisión producto). No bloquear F0–F5 por páginas legales. Confianza funcional vía **§5.1 B11** (trazabilidad ROI), no vía textos legales extensos.

---

## 18. Calidad y gates entre fases

| Gate | Comando / criterio |
|------|---------------------|
| CI | `pnpm lint && pnpm typecheck && pnpm test` en PR |
| ROI | tests `packages/roi-engine` ±0.1 pp vs caso 155k/1105€ |
| RLS | usuario A no lee scan de B |
| Geo B2 | listing sin `geom` o quality=5 no entra en pin ROI zoom≥14 |
| B1 | Tier 1 city Valencia: ≥40 pins viewport test |
| B3 | ≥60 % listings Tier 1 `rent_confidence` ≥ medium |
| B4 | último `scrape_runs.status` != failed para Tier 1 |
| B9 | scan p95 <5 s sobre Tier 1 precomputado |
| E2E | checklist §12.1 + mapa pan España sin crash |

No merge a `main` si CI rojo. Migraciones solo vía `supabase/migrations/`.

---

## 19. Pasos **después** de tener el código acabado (MVP-READY)

Orden recomendado — detalle ampliado en `docs/LANZAMIENTO.md`:

```text
1. Código merge en main → Vercel prod deploy automático
2. Supabase prod: db push migraciones, revisar RLS, backup manual export
3. GitHub Secrets prod + primer run scrape ciudad piloto (DRY_RUN=0)
4. Verificar ≥500 ventas + alquiler en BD; ejecutar job precompute ROI
5. Dominio DNS → Vercel; NEXT_PUBLIC_SITE_URL; Supabase redirect URLs
6. Resend: dominio verificado (SPF/DKIM); probar email scan completado
7. Páginas legales publicadas; revisión humana textos
8. Smoke test §12.1 en prod con usuario real
9. Beta cerrada: 5–15 inversores; feedback en Notion/hoja
10. Monitor: /api/health, logs Vercel, Supabase dashboard (tamaño DB)
11. Ritmo operativo: calendario scrapers + enrich catastro/INE/notariado
12. Iteración v1.1: alertas, segunda ciudad, mejoras mapa
13. Monetización (cuando toque): Stripe, límites scan/mes — fuera de 0€ inicial
```

**«Código acabado»** ≠ producto lanzado: el lanzamiento real es **pasos 2–8** como mínimo.

---

## 20. Operación continua (0 €)

| Frecuencia | Job | Responsable |
|------------|-----|-------------|
| 6–12 h | scrape venta + alquiler ciudad piloto | GitHub Actions |
| Diario | precompute `listing_investment` | Action |
| Nocturno | enrich Catastro (batch, throttle) | Action |
| Semanal | **sync-official-csv** (MIVAU VDP + INE P0 + Registradores) | Action |
| Semanal | Notariado CP (ArcGIS; aparte de P0 CSV) | Action |
| Mensual | INE secciones/metrics provincia activa + tablas extra | Action |
| Diario | alertas (F6) | Action + Resend |

**Alertas operativas:** workflow fallido → email al owner (Resend) o issue GitHub.

**Límite Supabase 500 MB:** monitor semanal; purgar listings `archived` >90 días; no guardar imágenes en Storage.

---

## 21. Prompts operativos (ampliados)

### Prompt MVP-READY (integración)

```
Lee MEGAPROMPT §5.1, §7, §11–18, MAPA-ESPANA, CUELLOS-DE-BOTELLA. Completa F0–F5. Implementa B1–B4, B2, B3, B9, B11 mínimo. Tier 1 scrape + precompute ROI + mapa viewport España + scan <5s. scrape_runs + coverage_regions. Sin VPS. Legal §17 fuera de scope.
```

### Prompt F5 — Email progreso

```
Scan async: estados processing/done/failed. Resend template «Tu scan está listo» con enlace /app/scan/[id]. Checkbox en wizard persiste notify_email.
```

### Prompt F6 — Export y alertas

```
Export CSV scan_results. Tabla alerts + workflow daily evalúa filtros guardados; Resend digest.
```

### Prompt F7 — Informes y CRM

```
PDF HTML→Playwright en Action o API; Storage Supabase. Kanban guardados, share link read-only, comentarios→email.
```

---

## 22. Checklist lanzamiento (copiar y marcar)

**Técnico**

- [ ] Prod Vercel verde
- [ ] Migraciones aplicadas prod
- [ ] Scrapers poblados ciudad piloto
- [ ] Precompute ROI ejecutado
- [ ] Health OK
- [ ] RLS auditado

**Producto**

- [ ] Happy path §12.1 en prod
- [ ] Estados vacío/error revisados
- [ ] Demo mode off en prod

**Observabilidad (B4)**

- [ ] scrape_runs poblado
- [ ] Alerta email si scrape falla

**Email (F7+)**

- [ ] Resend dominio OK cuando aplique

**Go-live**

- [ ] 5 beta users invitados
- [ ] Canal feedback definido
- [ ] Runbook scrapers en INFRASTRUCTURE.md

---

## 23. Ideas de referencia (solo inspiración)

El usuario puede aportar ideas desde otros proyectos (scrapers en VPS, bots Telegram, paneles internos, etc.). **Regla para el agente:**

- Incorporar solo lo que encaje en **Plataforma de inversión** (este repo, Supabase, Vercel, Actions).
- **No** acoplar repos, no asumir integración, no bloquear F0–F5 por sistemas externos.
- Volcar ideas sueltas en `docs/IDEAS-REFERENCIA.md` hasta que se promuevan a una fase del §7.

Ejemplos de ideas ya anotadas: poll cada 15 min, rotación de ciudades, score ROI+€/m², estado de sync visible, lista↔mapa.  
**Competencia (solo ideas):** Virtual Mike, Analiza Tu Piso → `IDEAS-COMPETENCIA.md` (score 0–100, comparables tipo tasador, valorar por RC, informe oportunidad en guardados).

---

## 24. Changelog del megaprompt

| Fecha | Versión | Cambio |
|-------|---------|--------|
| 2026-03-21 | 0.1 | Documento inicial: visión, 0€, fuentes oficiales, roadmap, prompts F0–F4 |
| 2026-03-21 | 0.2 | Aislamiento total: producto standalone |
| 2026-03-21 | 0.3 | Eliminadas referencias a otros productos por nombre |
| 2026-03-21 | 0.4 | Añadido `ANALISIS-DATOS-MAPAS.md` (oficial + mapas + cobertura) |
| 2026-03-21 | 0.5 | MVP funcional, API/RLS, seed, legal, post-lanzamiento, LANZAMIENTO.md |
| 2026-03-21 | 0.6 | Portales (corregido en 0.7) |
| 2026-03-21 | 0.7 | Kelify + pisos.com = P0 extracción; producto ≠ kelify.com |
| 2026-03-21 | 0.8 | Nombre de trabajo: Plataforma de inversión; dominio pendiente |
| 2026-03-21 | 0.9 | (revocado como integración) ideas Captador → §23 |
| 2026-03-21 | 1.0 | §23 Ideas de referencia; producto autocontenido en este repo |
| 2026-03-21 | 1.1 | Decisión: solo web/plataforma (Vercel); sin VPS en esta fase |
| 2026-03-21 | 1.2 | Mapa España + viewport API; MAPA-ESPANA.md |
| 2026-03-21 | 1.3 | CUELLOS-DE-BOTELLA.md — cobertura, coords, ROI |
| 2026-03-21 | 1.4 | §5.1 cuellos B1–B12 en megaprompt; roadmap F0–F8; legal fuera scope |
| 2026-03-21 | 1.5 | IDEAS-COMPETENCIA.md (Virtual Mike, Analiza Tu Piso) |
| 2026-10-17 | 1.6 | §4.5 cron oficial; DATA_SOURCES fuentes P0 + official_market_stats |

---

## 25. Referencias

- ROI Explorer: https://roiexplorer.com/es  
- Tutoriales: [Scan](https://www.youtube.com/watch?v=II9_bomfDOA) · [CRM](https://www.youtube.com/watch?v=xvuaZBgdBwY) · [Valoración](https://www.youtube.com/watch?v=AcYqEyqDPb0)  
- Catastro WS libres: https://www.catastro.hacienda.gob.es/ws/Webservices_Libres.pdf  
- Notariado: https://www.penotariado.com  
- INE: https://www.ine.es  
- MIVAU SERPAVI / VDP (CSV): https://www.mivau.gob.es/vivienda/alquila-bien-es-tu-derecho/serpavi · https://cdn.mivau.gob.es/portal-web-mivau/Datos_MIVAU/  
- Registradores open data: https://opendata.registradores.org  
