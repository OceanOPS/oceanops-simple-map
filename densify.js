// npm i @turf/turf
import fs from "fs";
import * as turf from "@turf/turf";

/**
 * Densify a pair of [lon,lat] points by inserting intermediate vertices.
 * - mode: 'geodesic' | 'rhumb'
 * - stepKm: target spacing between inserted points
 * Always keeps original endpoints; never simplifies.
 */
function densifyPair(a, b, { mode = "geodesic", stepKm = 100 } = {}) {
  if (mode === "geodesic") {
    const dist = turf.distance(a, b, { units: "kilometers" });
    const n = Math.max(0, Math.ceil(dist / stepKm) - 1); // number of points to insert
    if (n <= 0) return [b]; // nothing to insert; keep only the second endpoint
    // Use greatCircle to generate evenly spaced points including endpoints
    const gc = turf.greatCircle(a, b, { npoints: n + 2 }); // a + (n inserts) + b
    // Return only the inserted points + final endpoint (skip the first to avoid dup)
    return gc.geometry.coordinates.slice(1);
  } else {
    // rhumb interpolation (constant bearing)
    const dist = turf.rhumbDistance(a, b, { units: "kilometers" });
    const n = Math.max(0, Math.ceil(dist / stepKm) - 1);
    if (n <= 0) return [b];
    const bearing = turf.rhumbBearing(a, b);
    const out = [];
    for (let i = 1; i <= n; i++) {
      const frac = i / (n + 1);
      const p = turf.rhumbDestination(a, dist * frac, bearing, { units: "kilometers" });
      out.push(p.geometry.coordinates);
    }
    out.push(b);
    return out;
  }
}

function densifyLineString(coords, opts) {
  if (!coords || coords.length < 2) return coords ?? [];
  const out = [coords[0]];
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i], b = coords[i + 1];
    const inserted = densifyPair(a, b, opts);
    // inserted includes 'b' as last item
    out.push(...inserted);
  }
  return out;
}

function run({
  input = "public/geojson/undensified.geojson",
  output = "public/geojson/densified.geojson",
  mode = "rhumb",           // 'geodesic' or 'rhumb'
  stepKm = 50,                 // vertex every ~80 km
  keepProps = null             // e.g. ['line_id','line_name','category']
} = {}) {
  const src = JSON.parse(fs.readFileSync(input, "utf8"));
  const out = { type: "FeatureCollection", features: [] };

  for (const f of src.features || []) {
    const props = f.properties || {};
    const g = f.geometry;
    if (!g) continue;

    const selectedProps = keepProps
      ? Object.fromEntries(keepProps.filter(k => k in props).map(k => [k, props[k]]))
      : props;

    if (g.type === "LineString") {
      const coords = densifyLineString(g.coordinates, { mode, stepKm });
      out.features.push(turf.lineString(coords, selectedProps));
    } else if (g.type === "MultiLineString") {
      for (const part of g.coordinates) {
        const coords = densifyLineString(part, { mode, stepKm });
        out.features.push(turf.lineString(coords, selectedProps));
      }
    } else {
      // pass-through other geometry types unchanged
      out.features.push(f);
    }
  }

  fs.writeFileSync(output, JSON.stringify(out));
  console.log(`✅ Wrote ${output} with ${out.features.length} features (mode=${mode}, stepKm=${stepKm})`);
}

// --- run with defaults or read CLI args ---
run({
  input: process.argv[2] || undefined,
  output: process.argv[3] || undefined,
  mode: (process.argv[4] || "geodesic"),
  stepKm: Number(process.argv[5] || 80),
  keepProps: null
});
