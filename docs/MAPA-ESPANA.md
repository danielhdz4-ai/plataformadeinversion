# Mapa — España completa y pisos siempre visibles

> Requisito de producto: el mapa es **el centro** de la Plataforma de inversión.  
> Debe poder moverse por **cualquier punto de España** y **ver pisos** allí donde existan datos (venta/inversión), sin pantalla vacía “muerta”.

---

## 1. Dos modos de mapa (misma tecnología)

| Modo | Cuándo | Qué muestra |
|------|--------|-------------|
| **Explorar España** | App home / mapa libre | Pisos en el **viewport** actual (bbox), actualizados al mover/zoom |
| **Resultados de scan** | Tras wizard + filtros | Pisos del **polígono + filtros**, orden ROI; lista ↔ mapa sincronizados |

El usuario percibe **una sola experiencia**: siempre hay capa de inmuebles; el scan solo **acota y ordena**.

---

## 2. Principio: “siempre se ven pisos” (interpretación honesta)

**No significa** cargar millones de puntos en el cliente a la vez.  
**Sí significa:**

1. Donde hay datos en BD → **siempre** aparecen pins o clusters en ese viewport.  
2. Donde **aún no** hay scrape → mensaje claro + CTA (“Estamos ampliando cobertura” / “Priorizar esta zona”), no mapa genérico sin explicación.  
3. Al mover el mapa → **refetch automático** (debounce 250–400 ms).  
4. Ningún listing con `geom` válido queda fuera del mapa por bug de UI.

**KPI mapa:** en viewport con cobertura, **≥1 feature** (pin o cluster) o mensaje explícito de “sin cobertura”.

---

## 3. Vista España (MapLibre)

| Parámetro | Valor |
|-----------|--------|
| CRS | EPSG:4326 |
| Vista inicial | Centro peninsular ~ `[-3.7, 40.2]`, zoom **5.5–6** (Islas + Canarias: controles o bbox fit España) |
| Límites `maxBounds` | Opcional: `[[-19, 27], [5, 44]]` (España + margen) |
| Basemap | OSM / MapLibre demotiles (0 €) |

**Canarias / Baleares:** mismo API bbox; no restringir solo península en backend.

---

## 4. API viewport (corazón técnico)

```
GET /api/map/listings?bbox=west,south,east,north&zoom=12&operation=sale&limit=...
```

| zoom | Comportamiento servidor |
|------|-------------------------|
| **≤ 8** | **Clusters** server-side (grid ~0.05°–0.2°) o respuesta agregada: `{ count, avgRoi, centroid }` |
| **9–12** | Hasta **300–500** puntos; `cluster: true` en cliente (supercluster) |
| **≥ 13** | Hasta **800** puntos individuales con `roi_gross`, precio, id |

SQL base:

```sql
SELECT id, ST_X(geom) AS lng, ST_Y(geom) AS lat, price_eur, roi_gross, thumbnail_url
FROM listings l
JOIN listing_investment li ON li.listing_id = l.id
WHERE l.status = 'active' AND l.operation = 'sale'
  AND l.geom && ST_MakeEnvelope(:w, :s, :e, :n, 4326)
  AND (:min_roi IS NULL OR li.roi_gross >= :min_roi)
ORDER BY li.roi_gross DESC NULLS LAST
LIMIT :limit;
```

Índice: `GIST(geom)` + índice parcial `(operation, status) WHERE geom IS NOT NULL`.

**Caché (0 €):** cabecera `Cache-Control: private, max-age=60` por tile bbox redondeado a 3 decimales — reduce carga en Vercel.

---

## 5. Capa visual (como ROI Explorer)

- Pin circular con **texto ROI %** (negro/blanco o azul marca).  
- Seleccionado: borde dorado + drawer.  
- Hover desde lista: `feature-state` highlight.  
- Cluster: círculo con **n** y color = media ROI del cluster.  
- Leyenda: “Solo oportunidades con ROI calculado” / toggle “Incluir sin estimación”.

Miniatura opcional en popup al hover (fase 2).

---

## 6. Cobertura nacional sin VPS

Scraping **no** puede llenar España entera el día 1 en free tier. Estrategia **por fases**:

### Fase M1 — Viewport-first (MVP mapa útil)

- Scrapers Actions por **ciudades** (config JSON: Madrid, Barcelona, Valencia, Sevilla, Málaga, Bilbao…).  
- Mapa **ya funciona** en toda España; fuera de ciudades cargadas → mensaje “sin datos”.  
- Tabla `coverage_regions(code, name, listing_count, last_scrape_at)` para pintar leyenda “Zonas con datos”.

### Fase M2 — Rotación provincial

- Workflow `scrape-province-XX.yml` — **1 provincia / noche** (52 rotación).  
- Prioridad dinámica: provincias con más `map_pan_events` en PostHog o tabla `user_map_requests(bbox)`.

### Fase M3 — Bajo demanda

- Usuario en zona vacía pulsa “Actualizar esta zona” → Action con bbox → scrape acotado → email “Ya hay X pisos en el mapa”.

**Regla:** el mapa **nunca miente**: si no hay pins, es porque **no hay filas con geom**, no porque el front falló.

---

## 7. Geolocalización (sin esto no hay mapa)

| Prioridad | Método |
|-----------|--------|
| 1 | Lat/lng del portal en scrape |
| 2 | Geocode dirección (Nominatim + cache) |
| 3 | Catastro `Consulta_RCCOOR` / dirección |
| 4 | Centroide municipio (último recurso — pin impreciso, badge “ubicación aproximada”) |

Cola `geocode_pending` procesada en Actions. Detalle waterfall: **`CUELLOS-DE-BOTELLA.md` §2**. **No mostrar** en capa principal pins solo-municipio si zoom ≥ 14 (evitar ruido).

---

## 8. Datos oficiales en el mapa (capas)

| Toggle | Zoom mínimo | Fuente |
|--------|-------------|--------|
| Pisos inversión | siempre | Supabase |
| Secciones censales INE | ≥ 10 | GeoJSON bbox |
| Heat ROI (fase 3) | ≤ 11 | agregado server |

Secciones INE: import nacional por provincias en PostGIS (batch mensual), servidas por bbox — **compatible con mapa España entera**.

---

## 9. Rendimiento web (Vercel)

- Un solo `GeoJSON` source en MapLibre; `setData()` al refetch.  
- Debounce `moveend` / `zoomend`.  
- No pedir bbox si zoom < 5 (solo clusters nacionales precomputados opcional).  
- Lista lateral: paginación virtual; mapa y lista comparten mismo `listingIds[]` del bbox o del scan.

---

## 10. Definition of done — mapa

- [ ] Pan desde Galicia a Canarias sin romper UI.  
- [ ] Viewport Madrid centro: pins visibles con datos seed o scrape.  
- [ ] Viewport pueblo sin datos: copy + no crash.  
- [ ] Scan polígono + exploración usan misma capa de pins.  
- [ ] 100% listings `geom NOT NULL` en rutas de scrape nuevas.

---

## 11. Ideas backlog mapa

- Buscar por nombre municipio → flyTo + bbox automático.  
- Dibujar polígono en cualquier parte de España (wizard paso 1).  
- Comparar ROI medio por provincia (barra lateral, datos agregados).  
- Modo satélite (fase lejana, tiles de pago).
