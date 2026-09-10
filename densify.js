#!/usr/bin/env node
/**
 * @deprecated Use oceanops-data-exports/densify-geojson.mjs or `npm run densify:geojson`.
 * Thin wrapper so existing docs/commands keep working.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const cli = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../oceanops-data-exports/densify-geojson.mjs',
)

const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
