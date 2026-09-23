# Scripts moved

GeoJSON and partner export scripts live in **[oceanops-data-exports](https://github.com/OceanOPS/oceanops-data-exports)**.

From the simple-map repo:

```bash
npm run export:geojson
```

Or from `../oceanops-data-exports`: `npm run export:geojson` / `npm run export:all`.

Partner JSON is written to `src/data/partnerCountries.json` by `npm run export:partners`.
