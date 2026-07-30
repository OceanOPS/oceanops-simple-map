/**
 * Densify line GeoJSON for 3D globe display (same logic as densify.js).
 */

import * as turf from '@turf/turf'

/**
 * @param {[number, number]} a
 * @param {[number, number]} b
 * @param {{ mode?: 'geodesic' | 'rhumb', stepKm?: number }} [options]
 */
function densifyPair(a, b, { mode = 'geodesic', stepKm = 100 } = {}) {
  if (mode === 'geodesic') {
    const dist = turf.distance(a, b, { units: 'kilometers' })
    const n = Math.max(0, Math.ceil(dist / stepKm) - 1)
    if (n <= 0) return [b]
    const gc = turf.greatCircle(a, b, { npoints: n + 2 })
    return gc.geometry.coordinates.slice(1)
  }

  const dist = turf.rhumbDistance(a, b, { units: 'kilometers' })
  const n = Math.max(0, Math.ceil(dist / stepKm) - 1)
  if (n <= 0) return [b]
  const bearing = turf.rhumbBearing(a, b)
  const out = []
  for (let i = 1; i <= n; i++) {
    const frac = i / (n + 1)
    const p = turf.rhumbDestination(a, dist * frac, bearing, { units: 'kilometers' })
    out.push(p.geometry.coordinates)
  }
  out.push(b)
  return out
}

/** @param {number[][]} coords @param {{ mode?: 'geodesic' | 'rhumb', stepKm?: number }} [options] */
function densifyLineString(coords, options) {
  if (!coords || coords.length < 2) return coords ?? []
  const out = [coords[0]]
  for (let i = 0; i < coords.length - 1; i++) {
    out.push(...densifyPair(coords[i], coords[i + 1], options))
  }
  return out
}

/**
 * @param {import('geojson').FeatureCollection} collection
 * @param {{ mode?: 'geodesic' | 'rhumb', stepKm?: number }} [options]
 * @returns {import('geojson').FeatureCollection}
 */
export function densifyFeatureCollection(collection, options = {}) {
  const mode = options.mode ?? 'geodesic'
  const stepKm = options.stepKm ?? 80
  const out = { type: 'FeatureCollection', features: [] }

  for (const feature of collection.features ?? []) {
    const props = feature.properties ?? {}
    const geometry = feature.geometry
    if (!geometry) continue

    if (geometry.type === 'LineString') {
      const coords = densifyLineString(geometry.coordinates, { mode, stepKm })
      out.features.push(turf.lineString(coords, props))
      continue
    }

    if (geometry.type === 'MultiLineString') {
      for (const part of geometry.coordinates) {
        const coords = densifyLineString(part, { mode, stepKm })
        out.features.push(turf.lineString(coords, props))
      }
      continue
    }

    out.features.push(feature)
  }

  return out
}
