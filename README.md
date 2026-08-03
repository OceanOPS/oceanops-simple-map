# oceanops-simple-map

An ArcGIS SDK TypeScript Frontend Application — interactive 3D map for the GOOS report card.

## Development

```bash
npm install
npm run dev
```

Map layers load static GeoJSON from `public/geojson/{layerId}.geojson` (see `src/categories.ts`).

## GeoJSON export (build-time)

Regenerate map layers from OceanOPS PostgreSQL via **[oceanops-data-exports](https://github.com/OceanOPS/oceanops-data-exports)** (clone next to this repo).

```bash
# Requires psql + Postgres with oceanops_gis.ptf_loc_n (local Docker or partial dump)
npm run export:geojson

# Preview SQL without writing files
npm run export:geojson:dry-run

# Partner country JSON for the globe filter (also updates report-card TS)
npm run export:partners
```

Advanced flags (run from `../oceanops-data-exports`):

```bash
node export-geojson.mjs --layer=argo
node export-geojson.mjs --no-country-ship --no-country-sensor
```

**Environment:**

- `OCEANOPS_DATABASE_URL` — default `postgresql://oceanops:oceanops@127.0.0.1:5432/oceanops`
- `GEOJSON_EXPORT_EDITION` — label in export summary

**Configuration:** edit `../oceanops-data-exports/geojson-export/exportConfig.mjs` before each edition:

- `WHERE` clause per point layer (12 layers from `oceanops_gis.ptf_loc_n`)
- `GO_SHIP_SELECTED_LINE_NAMES` / `SOOP_XBT_SELECTED_LINE_NAMES` for line layers
- Date cutoffs for OceanGliders, AniBOS, FVON

**Output:**

| Layer kind | Files |
|------------|-------|
| Points (12) | `public/geojson/{id}.geojson` |
| Lines (GO-SHIP, SOOP XBT) | `{id}_undensified.geojson` + densified `{id}.geojson` |

Point layers join `oceanops.v_ptf_depl_rv` (`country_ship`) and `oceanops.v_sensor_provider` (`country_sensor_provider`) when views exist locally.

Line layers do not include ship/sensor country fields.

Criteria mirror `oceanops-report-card/scripts/partner-export/exportConfig.mjs` (same edition filters).

## Line densification (manual fallback)

Lines must be densified for the 3D globe. The export script densifies automatically. For manual edits:

```bash
node densify.js public/geojson/goship_undensified.geojson public/geojson/goship.geojson
```
