/**
 * GeoJSON export criteria — edit this file before each report-card edition.
 *
 * Mirrors partner export filters (oceanops-report-card/scripts/partner-export/)
 * and the GIS queries used for map layers (oceanops_gis.ptf_loc_n).
 *
 * Platform status (ptf_status):
 *   0 PROBABLE | 1 CONFIRMED | 2 REGISTERED | 4 INACTIVE | 5 CLOSED | 6 OPERATIONAL
 */

/** @typedef {'point' | 'line'} LayerGeometryKind */

/**
 * @typedef {Object} PointLayerExportConfig
 * @property {'point'} geometryKind
 * @property {string} category GeoJSON `properties.category` (must match existing layers)
 * @property {string} whereClause SQL predicate on `t` (oceanops_gis.ptf_loc_n)
 * @property {string} [summary] Human-readable criteria for export log
 * @property {boolean} [includeCountryShip] Export country_ship from v_ptf_depl_rv
 * @property {boolean} [includeCountrySensorProvider] Export country_sensor_provider
 */

/**
 * @typedef {Object} LineLayerExportConfig
 * @property {'line'} geometryKind
 * @property {string} category
 * @property {string} sourceTable Fully qualified GIS design-line table
 * @property {string[] | null} selectedLineNames Manual line list; null = all lines in table
 * @property {string} [summary]
 */

/** Layer-table statuses used in the 2025/2026 selection table. */
export const LAYER_TABLE_PTF_STATUS_IN = '2,4,5,6'

export const OCEAN_GLIDERS_MIN_LAST_LOC_DATE = '2024-01-01'
export const ANIBOS_MIN_LAST_LOC_DATE = '2025-01-01'
export const FVON_MIN_LAST_LOC_DATE = '2025-01-01'

export const EXPORT_EDITION_LABEL = process.env.GEOJSON_EXPORT_EDITION ?? 'report-card'

/**
 * GO-SHIP design lines (manual selection — same list as partner export / 2025 layer table).
 * Set to null to export every line in goship_design_goship_1.
 */
export const GO_SHIP_SELECTED_LINE_NAMES = [
  '40N',
  'A02',
  'A05',
  'A10',
  'A12',
  'A13.5',
  'A16N',
  'A17',
  'A20',
  'A22',
  'A23',
  'A25',
  'A29',
  'AR07W',
  'AR28',
  'ARC01',
  'ARC02',
  'Davis',
  'I05',
  'I06S',
  'I07N',
  'I07S',
  'I08N',
  'I08S',
  'I09N',
  'I09S',
  'I10',
  'MED01',
  'P01',
  'P02',
  'P03W',
  'P04W',
  'P06',
  'P09',
  'P11',
  'P13',
  'P14N',
  'P15S',
  'P16N',
  'P17x',
  'P18',
  'S04I',
  'S04P',
  'SR01',
  'SR03',
  'SR04',
]

/**
 * SOOP XBT design lines (manual selection).
 * Set to null to export every line in the SOOP design table.
 */
export const SOOP_XBT_SELECTED_LINE_NAMES = [
  'AX07',
  'AX08',
  'AX10',
  'AX97',
  'AX32',
  'AX22',
  'AX25',
  'IX01',
  'IX21',
  'PX09',
  'PX11',
  'PX13',
  'IX22',
  'PX02',
  'PX06',
  'PX30',
  'PX31',
  'PX34',
  'PX37',
  'PX40',
  'PX39',
  'IX28',
  'PX36',
]

/**
 * Map layer id (categories.ts / `{id}.geojson`) → export config.
 * @type {Record<string, PointLayerExportConfig | LineLayerExportConfig>}
 */
export const LAYER_EXPORT_CONFIG = {
  argo: {
    geometryKind: 'point',
    category: 'Profiling_floats_Argo',
    whereClause: "upper(t.network) LIKE '%ARGO%' AND t.ptf_status = 6",
    summary: 'OPERATIONAL Argo floats',
  },
  drifting_buoys: {
    geometryKind: 'point',
    category: 'drifting_buoys',
    whereClause: "t.ptf_status = 6 AND t.ptf_family = 'DB'",
    summary: 'OPERATIONAL drifting buoys (DB family)',
  },
  vos: {
    geometryKind: 'point',
    category: 'ship_based_meteorological_sot_vos',
    whereClause:
      "t.ptf_status = 6 AND t.network LIKE '%VOS%' AND (t.ptf_type = 'VOS_MWS' OR t.ptf_type = 'VOS_AWS')",
    summary: 'OPERATIONAL SOT/VOS ships',
  },
  asap: {
    geometryKind: 'point',
    category: 'ship_based_meteorological_sot',
    whereClause: "t.ptf_status = 6 AND t.network LIKE '%ASAP%'",
    summary: 'OPERATIONAL ASAP ships',
  },
  gloss: {
    geometryKind: 'point',
    category: 'gloss',
    whereClause: "t.ptf_status = 6 AND t.network LIKE '%GLOSS%'",
    summary: 'OPERATIONAL GLOSS sea-level gauges',
  },
  moored_buoys: {
    geometryKind: 'point',
    category: 'moored_buoys',
    whereClause:
      "t.ptf_status = 6 AND t.ptf_family = 'MB' AND t.network NOT LIKE '%OceanSITES%'",
    summary: 'OPERATIONAL moored buoys (excl. OceanSITES)',
  },
  tsunami_buoys: {
    geometryKind: 'point',
    category: 'tsunami_buoys',
    whereClause: "t.ptf_status = 6 AND t.ptf_type = 'TSUNAMETER'",
    summary: 'OPERATIONAL tsunameter buoys',
  },
  hf_radars: {
    geometryKind: 'point',
    category: 'hf_radars',
    whereClause: "t.ptf_type = 'HF_RADAR'",
    summary: 'All HF radars (no status filter)',
  },
  oceansites: {
    geometryKind: 'point',
    category: 'oceansites',
    whereClause: "t.ptf_status IN (4, 6) AND t.network LIKE '%OceanSITES%'",
    summary: 'OceanSITES moorings — OPERATIONAL or INACTIVE',
  },
  oceangliders: {
    geometryKind: 'point',
    category: 'Profiling_floats_Argo',
    whereClause: `t.ptf_status IN (${LAYER_TABLE_PTF_STATUS_IN}) AND t.master_program = 'OceanGliders' AND t.latest_loc_date >= DATE '${OCEAN_GLIDERS_MIN_LAST_LOC_DATE}'`,
    summary: `OceanGliders — layer-table statuses, latest_loc_date >= ${OCEAN_GLIDERS_MIN_LAST_LOC_DATE}`,
  },
  anibos: {
    geometryKind: 'point',
    category: 'anibos',
    // Prod GIS: ptf_family='ANIMAL'. iSival often has AniBOS via network only — keep both.
    whereClause: `t.ptf_status IN (${LAYER_TABLE_PTF_STATUS_IN}) AND (t.ptf_family = 'ANIMAL' OR t.network ILIKE '%AniBOS%') AND t.latest_loc_date >= DATE '${ANIBOS_MIN_LAST_LOC_DATE}'`,
    summary: `AniBOS — layer-table statuses, ANIMAL family or AniBOS network, latest_loc_date >= ${ANIBOS_MIN_LAST_LOC_DATE}`,
  },
  fvon: {
    geometryKind: 'point',
    category: 'fvon',
    // Requires FVON rows in ptf_loc_n (missing on iSival — export from prod for real counts).
    whereClause: `t.network ILIKE '%FVON%' AND t.ptf_status IN (${LAYER_TABLE_PTF_STATUS_IN}) AND t.latest_loc_date >= DATE '${FVON_MIN_LAST_LOC_DATE}'`,
    summary: `FVON — layer-table statuses, latest_loc_date >= ${FVON_MIN_LAST_LOC_DATE}`,
  },
  goship: {
    geometryKind: 'line',
    category: 'goship',
    sourceTable: 'oceanops_gis.goship_design_goship_1',
    selectedLineNames: GO_SHIP_SELECTED_LINE_NAMES,
    summary: 'GO-SHIP design lines — manual name list',
  },
  ship_oceano: {
    geometryKind: 'line',
    category: 'ship_based_oceanographic_sot',
    sourceTable: 'oceanops_gis.soop_xbt_design_2021_2022',
    selectedLineNames: SOOP_XBT_SELECTED_LINE_NAMES,
    summary: 'SOOP XBT design lines — manual name list',
  },
}

/** Layer ids written by the export (matches categories.ts). */
export const LAYER_IDS = Object.keys(LAYER_EXPORT_CONFIG)

/** Line layers that get a densified copy for 3D globe display. */
export const DENSIFY_LAYER_IDS = ['goship', 'ship_oceano']

/**
 * @param {Record<string, unknown>} countsByLayer
 */
export function printExportSummary(countsByLayer) {
  process.stderr.write('\n--- GeoJSON export summary ---\n')
  process.stderr.write(`Edition: ${EXPORT_EDITION_LABEL}\n\n`)

  for (const layerId of LAYER_IDS) {
    const config = LAYER_EXPORT_CONFIG[layerId]
    const count = countsByLayer[layerId] ?? 0
    process.stderr.write(`  ${layerId}: ${count} features — ${config.summary ?? ''}\n`)
    if (config.geometryKind === 'point') {
      process.stderr.write(`    WHERE: ${config.whereClause}\n`)
    } else {
      const names = config.selectedLineNames
      process.stderr.write(`    TABLE: ${config.sourceTable}\n`)
      process.stderr.write(
        `    LINES: ${names?.length ?? 'all'} selected\n`,
      )
    }
  }

  process.stderr.write('\nEdit scripts/geojson-export/exportConfig.mjs before the next edition.\n')
}
