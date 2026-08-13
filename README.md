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
```

**Environment:**

- `OCEANOPS_DATABASE_URL` — default `postgresql://oceanops:oceanops@127.0.0.1:5432/oceanops`
- `GEOJSON_EXPORT_EDITION` — label in export summary

**Configuration:** edit `../oceanops-data-exports/sql/*.sql` before each edition (see `sql/README.md`). Layer list: `../oceanops-data-exports/geojson-export/layers.manifest.json`.

- Point layers: `WHERE` on `oceanops_gis.ptf_loc_n` (+ joins for ship/sensor country in the SQL file)
- Line layers: GO-SHIP / SOOP tables and `t.name IN (...)` in `goship.sql` / `ship_oceano.sql`
- Date cutoffs and status filters: edit directly in the relevant `.sql` file

**Output:**

| Layer kind | Files |
|------------|-------|
| Points (12) | `public/geojson/{id}.geojson` |
| Lines (GO-SHIP, SOOP XBT) | `{id}_undensified.geojson` + densified `{id}.geojson` |

Point layers join `oceanops.v_ptf_depl_rv` for `country_ship` (only when `deployment_date` is within ship commissioned/decommissioned dates; excludes `UNKNOWN`) and `oceanops.v_sensor_provider` for `country_sensor_provider` when those views exist.

Line layers do not include ship/sensor country fields.

Criteria mirror `oceanops-report-card/scripts/partner-export/exportConfig.mjs` (same edition filters).

## Line densification (manual fallback)

Line layers are densified automatically during `export:geojson`. Logic lives in **`oceanops-data-exports/geojson-export/densifyLayer.mjs`** (default **hybrid**, 80 km).

After hand-editing `*_undensified.geojson`:

```bash
# From oceanops-data-exports (canonical)
npm run densify:geojson -- public/geojson/goship_undensified.geojson public/geojson/goship.geojson

# From simple-map (same CLI via wrapper)
npm run densify:geojson -- public/geojson/goship_undensified.geojson public/geojson/goship.geojson
# or: node densify.js public/geojson/goship_undensified.geojson public/geojson/goship.geojson
```

## Netlify (deploy previews + production)

This repo includes `netlify.toml` (`npm run build`, publish `dist`, Node 20). The app is served at **`/demos/simple-arcgis-map/`** (same path as [production](https://www.ocean-ops.org/demos/simple-arcgis-map/)) via path rewrites.

### One-time setup (Netlify dashboard)

1. **Add new site** → **Import from Git** → `OceanOPS/oceanops-simple-map`.
2. Confirm build settings (Netlify reads `netlify.toml` automatically).
3. **Deploy** production from your main branch (e.g. `main` or `staging`).
4. **Site configuration → Build & deploy → Deploy contexts** → enable **Deploy Previews** for pull requests (same as report card).

After deploy, open:

`https://<your-site>.netlify.app/demos/simple-arcgis-map/`

PR previews:

`https://deploy-preview-<PR>--<your-site>.netlify.app/demos/simple-arcgis-map/`

### Use a Netlify map in the report card iframe

In **oceanops-report-card**, set at build time:

```bash
VITE_MAP_SRC=https://deploy-preview-42--oceanops-simple-map.netlify.app/demos/simple-arcgis-map/
```

- **Local:** `.env.local` (see report-card README).
- **Netlify (report card site):** **Environment variables** → add `VITE_MAP_SRC` for **Deploy previews** (or a specific branch), then redeploy the report card.

Trailing slash on `VITE_MAP_SRC` matches `App.tsx` defaults.
