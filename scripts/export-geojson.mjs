#!/usr/bin/env node
/**
 * Export static GeoJSON map layers from OceanOPS PostgreSQL.
 *
 * Usage:
 *   node scripts/export-geojson.mjs [--dry-run] [--layer=argo] [--no-densify]
 *       [--no-country-ship] [--no-country-sensor]
 *
 * Environment:
 *   OCEANOPS_DATABASE_URL   Postgres URL (default: postgresql://oceanops:oceanops@127.0.0.1:5432/oceanops)
 *   GEOJSON_EXPORT_EDITION    Label in export summary
 *
 * Edit scripts/geojson-export/exportConfig.mjs before each edition (WHERE clauses, line lists).
 * Output: public/geojson/{layerId}.geojson (+ *_undensified.geojson for line layers)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildLayerSql } from './geojson-export/buildSql.mjs'
import { assertPsqlAvailable, resolveDatabaseUrl, runPsqlQuery } from './geojson-export/db.mjs'
import { densifyFeatureCollection } from './geojson-export/densifyLayer.mjs'
import {
  DENSIFY_LAYER_IDS,
  EXPORT_EDITION_LABEL,
  LAYER_EXPORT_CONFIG,
  LAYER_IDS,
  printExportSummary,
} from './geojson-export/exportConfig.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUTPUT_DIR = path.join(ROOT, 'public/geojson')

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const noDensify = args.includes('--no-densify')
const includeCountryShip = !args.includes('--no-country-ship')
const includeCountrySensorProvider = !args.includes('--no-country-sensor')
const layerArg = args.find((arg) => arg.startsWith('--layer='))?.split('=')[1]
const layerFilter = layerArg ? layerArg.split(',').map((id) => id.trim()).filter(Boolean) : null

/** @param {string} filePath @param {unknown} geojson */
function writeGeoJson(filePath, geojson) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(geojson)}\n`, 'utf8')
}

/** @param {string} raw */
function parseFeatureCollection(raw) {
  if (!raw) {
    return { type: 'FeatureCollection', features: [] }
  }

  const parsed = JSON.parse(raw)
  if (parsed?.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
    throw new Error('Expected PostgreSQL to return a GeoJSON FeatureCollection')
  }

  return parsed
}

/**
 * @param {string} layerId
 * @param {import('./geojson-export/exportConfig.mjs').PointLayerExportConfig | import('./geojson-export/exportConfig.mjs').LineLayerExportConfig} config
 */
async function exportLayer(layerId, config) {
  const sql = buildLayerSql(layerId, config, {
    includeCountryShip: config.geometryKind === 'point' ? includeCountryShip : false,
    includeCountrySensorProvider:
      config.geometryKind === 'point' ? includeCountrySensorProvider : false,
  })

  if (dryRun) {
    process.stderr.write(`\n--- ${layerId} ---\n${sql}\n`)
    return { layerId, featureCount: 0, written: [] }
  }

  const result = runPsqlQuery(sql)
  if (!result.ok) {
    throw new Error(`Export failed for "${layerId}": ${result.error}`)
  }

  const collection = parseFeatureCollection(result.stdout)
  const featureCount = collection.features.length
  const written = []

  if (config.geometryKind === 'line') {
    const undensifiedPath = path.join(OUTPUT_DIR, `${layerId}_undensified.geojson`)
    writeGeoJson(undensifiedPath, collection)
    written.push(undensifiedPath)

    const outputPath = path.join(OUTPUT_DIR, `${layerId}.geojson`)
    const finalCollection =
      noDensify || !DENSIFY_LAYER_IDS.includes(layerId)
        ? collection
        : densifyFeatureCollection(collection)

    writeGeoJson(outputPath, finalCollection)
    written.push(outputPath)
  } else {
    const outputPath = path.join(OUTPUT_DIR, `${layerId}.geojson`)
    writeGeoJson(outputPath, collection)
    written.push(outputPath)
  }

  process.stderr.write(`  ${layerId}: ${featureCount} features\n`)
  for (const filePath of written) {
    process.stderr.write(`    → ${path.relative(ROOT, filePath)}\n`)
  }

  return { layerId, featureCount, written }
}

async function main() {
  if (!assertPsqlAvailable()) {
    throw new Error('psql is required but was not found on PATH')
  }

  const layerIds = (layerFilter ?? LAYER_IDS).filter((layerId) => {
    if (!LAYER_EXPORT_CONFIG[layerId]) {
      process.stderr.write(`Unknown layer "${layerId}" — skipped\n`)
      return false
    }
    return true
  })

  if (layerIds.length === 0) {
    throw new Error('No layers selected for export')
  }

  process.stderr.write(`GeoJSON export (${EXPORT_EDITION_LABEL})\n`)
  process.stderr.write(`Database: ${resolveDatabaseUrl()}\n`)
  process.stderr.write(`Layers: ${layerIds.join(', ')}\n`)
  if (dryRun) process.stderr.write('Mode: dry-run (SQL only, no files written)\n')

  /** @type {Record<string, number>} */
  const countsByLayer = {}

  for (const layerId of layerIds) {
    const config = LAYER_EXPORT_CONFIG[layerId]
    const result = await exportLayer(layerId, config)
    countsByLayer[layerId] = result.featureCount
  }

  printExportSummary(countsByLayer)

  if (!dryRun) {
    process.stderr.write(`\nWrote GeoJSON to ${path.relative(ROOT, OUTPUT_DIR)}/\n`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
