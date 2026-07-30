/**
 * Build PostgreSQL queries that emit GeoJSON FeatureCollections.
 */

/** @param {string} value */
function escapeSqlString(value) {
  return value.replace(/'/g, "''")
}

/** @param {string[] | null | undefined} lineNames */
export function buildLineNameInClause(lineNames) {
  if (!lineNames?.length) return ''
  const list = lineNames.map((name) => `'${escapeSqlString(name)}'`).join(', ')
  return ` AND t.name IN (${list})`
}

/**
 * @param {import('./exportConfig.mjs').PointLayerExportConfig} config
 * @param {{ includeCountryShip?: boolean, includeCountrySensorProvider?: boolean }} [options]
 */
export function buildPointLayerSql(config, options = {}) {
  const includeCountryShip = options.includeCountryShip ?? true
  const includeCountrySensorProvider = options.includeCountrySensorProvider ?? true

  const propertyEntries = [
    `'category', '${escapeSqlString(config.category)}'`,
    `'ptf_id', t.ptf_id`,
    `'ptf_ref', t.ptf_ref`,
    `'ptf_model', t.ptf_model`,
    `'country_name', t.country`,
  ]

  const joins = []

  if (includeCountryShip) {
    joins.push('LEFT JOIN oceanops.v_ptf_depl_rv rv ON t.ptf_id = rv.ptf_id')
    propertyEntries.push(`'country_ship', rv.ship_country`)
  }

  if (includeCountrySensorProvider) {
    joins.push('LEFT JOIN oceanops.v_sensor_provider sp ON t.ptf_id = sp.ptf_id')
    propertyEntries.push(`'country_sensor_provider', sp.sensor_country`)
  }

  return `
SELECT jsonb_build_object(
  'type', 'FeatureCollection',
  'features', COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', 'Feature',
      'geometry', ST_AsGeoJSON(t.shape)::jsonb,
      'properties', jsonb_build_object(
        ${propertyEntries.join(',\n        ')}
      )
    )
  ), '[]'::jsonb)
)
FROM oceanops_gis.ptf_loc_n AS t
${joins.join('\n')}
WHERE ${config.whereClause};
`.trim()
}

/** @param {import('./exportConfig.mjs').LineLayerExportConfig} config */
export function buildLineLayerSql(config) {
  const lineFilter = buildLineNameInClause(config.selectedLineNames)

  return `
SELECT jsonb_build_object(
  'type', 'FeatureCollection',
  'features', COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', 'Feature',
      'geometry', ST_AsGeoJSON(t.shape)::jsonb,
      'properties', jsonb_build_object(
        'category', '${escapeSqlString(config.category)}',
        'line_id', t.line_id,
        'line_name', t.name
      )
    )
  ), '[]'::jsonb)
)
FROM ${config.sourceTable} AS t
WHERE t.shape IS NOT NULL${lineFilter};
`.trim()
}

/**
 * @param {string} layerId
 * @param {import('./exportConfig.mjs').PointLayerExportConfig | import('./exportConfig.mjs').LineLayerExportConfig} config
 * @param {{ includeCountryShip?: boolean, includeCountrySensorProvider?: boolean }} [options]
 */
export function buildLayerSql(layerId, config, options = {}) {
  if (config.geometryKind === 'point') {
    return buildPointLayerSql(config, options)
  }

  if (config.geometryKind === 'line') {
    return buildLineLayerSql(config)
  }

  throw new Error(`Unknown geometry kind for layer "${layerId}"`)
}
