/**
 * PostgreSQL helpers for GeoJSON export (psql CLI).
 */

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** @returns {string} */
export function resolveDatabaseUrl() {
  if (process.env.OCEANOPS_DATABASE_URL) return process.env.OCEANOPS_DATABASE_URL
  if (process.env.OCEANOPS_DB_URL) return process.env.OCEANOPS_DB_URL

  const host = process.env.OCEANOPS_DB_HOST ?? '127.0.0.1'
  const port = process.env.OCEANOPS_DB_PORT ?? '5432'
  const user = process.env.OCEANOPS_DB_USER ?? 'oceanops'
  const password = process.env.OCEANOPS_DB_PASS ?? 'oceanops'
  const database = process.env.OCEANOPS_DB_NAME ?? 'oceanops'

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`
}

/** @param {string} url @returns {{ host: string, port: string, user: string, password: string, database: string } | null} */
function parseDatabaseUrl(url) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') return null
    return {
      host: parsed.hostname,
      port: parsed.port || '5432',
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ''),
    }
  } catch {
    return null
  }
}

/**
 * @param {string} sql
 * @returns {{ ok: true, stdout: string } | { ok: false, error: string }}
 */
export function runPsqlQuery(sql) {
  const config = parseDatabaseUrl(resolveDatabaseUrl())
  if (!config) {
    return { ok: false, error: 'Invalid OCEANOPS_DATABASE_URL' }
  }

  // Write query output to a temp file — GeoJSON layers can exceed spawnSync's stdout buffer (ENOBUFS).
  const tmpDir = mkdtempSync(join(tmpdir(), 'oceanops-geojson-'))
  const outFile = join(tmpDir, 'query.out')

  try {
    const result = spawnSync(
      'psql',
      [
        '-h',
        config.host,
        '-p',
        config.port,
        '-U',
        config.user,
        '-d',
        config.database,
        '-v',
        'ON_ERROR_STOP=1',
        '-t',
        '-A',
        '-o',
        outFile,
        '-c',
        sql,
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, PGPASSWORD: config.password },
      },
    )

    if (result.error) {
      return { ok: false, error: result.error.message }
    }

    if (result.status !== 0) {
      const message = [result.stderr, result.stdout].filter(Boolean).join('\n').trim()
      return { ok: false, error: message || `psql exited with code ${result.status}` }
    }

    return { ok: true, stdout: readFileSync(outFile, 'utf8').trim() }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
}

/** @returns {boolean} */
export function assertPsqlAvailable() {
  const result = spawnSync('psql', ['--version'], { encoding: 'utf8' })
  return result.status === 0
}
