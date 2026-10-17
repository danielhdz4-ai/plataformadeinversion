# Portal Estadístico del Notariado (por CP)

Fuente oficial: [penotariado.com](https://www.penotariado.com/inmobiliario/es/home) — compraventas reales ante notario (IUIN).

## Qué guardamos

Tabla `notary_stats`:

- Columnas resumen: `price_m2`, `avg_price` (importe medio), `avg_surface`, `operations_count`, `period`
- `raw.portal`: informe completo (series mensuales, sociodemografía, nueva/segunda mano, etc.) — mismo contenido que el PDF «Más estadísticas»

## Importar un CP (ej. 08026 Sant Martí)

1. En penotariado.com: mapa → CP → **Más estadísticas** → descarga PDF (referencia).
2. Transcribe o exporta a JSON con la forma de `scripts/jobs/data/notary/08026.json`.
3. Sincroniza:

```bash
pnpm notary:import scripts/jobs/data/notary/08026.json
# o todos los JSON del directorio:
pnpm notary:sync
# un CP concreto:
pnpm notary:sync 08026
```

## API en la app

- `GET /api/notary/08026` — fila + objeto `portal`
- Resumen de listing: `POST /api/listings/summary` incluye `notary.portal` cuando existe

## Fetch automático (experimental)

El mapa del portal usa capas ArcGIS sin API pública documentada. Para pruebas:

```bash
PENOTARIADO_FETCH=1 PENOTARIADO_STATS_URL="..." pnpm notary:sync 08026
```

Cuando se estabilice la URL REST interna, se documentará en este archivo.

## UI

- Pestaña **Notariado** en el panel derecho (scan / explorar)
- Bloque completo en **Resumen** cuando hay `raw.portal`

Atribución en UI: *Consejo General del Notariado · Portal Estadístico del Notariado*.
