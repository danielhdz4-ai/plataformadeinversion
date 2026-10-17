# Portales de referencia para extraer inmuebles

> Aplica a **Plataforma de inversión** (repo `plataformadeinversion`).  
> **[kelify.com](https://kelify.com)** y **pisos.com** son **fuentes de datos** (P0), no sustitutos uno del otro. La plataforma consume listings de ambos (+ secundarios).

---

## Prioridad de fuentes

| Prioridad | Portal | URL | Venta | Alquiler | Notas |
|-----------|--------|-----|-------|----------|--------|
| **P0** | kelify.com | https://kelify.com | Sí | Sí | Scraper/ingestión **en este proyecto** (GitHub Actions o job propio). Ideas de extracción continua: `IDEAS-REFERENCIA.md` |
| **P0** | **pisos.com** | https://www.pisos.com | Sí | Sí | Scraper HTML/API pública; cobertura amplia |
| **P1** | Fotocasa | https://www.fotocasa.es/es/ | Sí | Sí | Secundario |
| **P1** | habitaclia | https://www.habitaclia.com | Sí | Sí | Secundario |

**Orden de implementación:** kelify.com + pisos.com en paralelo (MVP) → Fotocasa → habitaclia.

---

## kelify.com vs Plataforma de inversión (no mezclar)

| | kelify.com (fuente P0) | Plataforma de inversión (este repo) |
|---|------------------------|-------------------------------------|
| **Qué es** | Portal agregador particulares | Scan polígono, ranking ROI, Catastro/INE/Notariado |
| **Rol aquí** | **Origen de anuncios** | **Producto** que analiza oportunidades |
| **Error** | Usar kelify.com como nombre del producto | Ignorar kelify.com como fuente P0 |

---

## Dedup entre fuentes

1. Referencia catastral (post-enrich Catastro).
2. Heurística: dirección normalizada + precio ±3 % + m² ±5 % + proximidad ≤30 m.
3. `source_portal`: `kelify` | `pisos_com` | `fotocasa` | `habitaclia`.
4. Índice único: `(source_portal, source_external_id)`.

En UI: badge de origen (kelify.com / pisos.com / …) + enlace al anuncio original en ese portal.

---

## Workflows GitHub Actions (naming)

| Workflow | Fuente |
|----------|--------|
| `scrape-kelify-sale.yml` / `scrape-kelify-rent.yml` | kelify.com |
| `scrape-pisos-sale.yml` / `scrape-pisos-rent.yml` | pisos.com |
| `scrape-fotocasa-*.yml` | P1 |
| `scrape-habitaclia-*.yml` | P1 |

Cron MVP: P0 cada 12 h; P1 cada 24 h.

---

## Wizard scan — checkboxes de fuentes

Mostrar solo fuentes con job activo:

- kelify.com  
- pisos.com  
- Fotocasa / habitaclia (cuando existan)

---

## Legal (copy tipo)

«Los anuncios proceden de portales de terceros (incl. kelify.com, pisos.com, Fotocasa, habitaclia). No implica afiliación. Verifica siempre en la fuente original antes de invertir.»
