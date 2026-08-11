import type GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import { categories } from "./categories";
import {
  COUNTRY_FILTER_LAYER_IDS,
  type CountryName,
} from "./countryFilters";
import type { CountryLayerCount } from "./partnerCountriesData";

function countryWhere(country: CountryName): string {
  return `country_name = '${country.replace(/'/g, "''")}'`;
}

function shipCountryWhere(country: CountryName): string {
  const escaped = country.replace(/'/g, "''");
  return `country_ship = '${escaped}' AND country_ship <> 'UNKNOWN'`;
}

const labelByLayerId = new Map(categories.map((c) => [c.id, c.label]));

async function queryCountryTotal(
  where: string,
  layerById: Map<string, GeoJSONLayer>,
  visibleLayerIds: ReadonlySet<string>
): Promise<number> {
  let total = 0;

  for (const layerId of COUNTRY_FILTER_LAYER_IDS) {
    if (!visibleLayerIds.has(layerId)) continue;
    const layer = layerById.get(layerId);
    if (!layer || typeof layer.queryFeatureCount !== "function") continue;
    try {
      total += await layer.queryFeatureCount({ where });
    } catch {
      /* layer not ready */
    }
  }

  return total;
}

async function queryCountryBreakdown(
  where: string,
  layerById: Map<string, GeoJSONLayer>,
  visibleLayerIds: ReadonlySet<string>
): Promise<CountryLayerCount[]> {
  const rows: CountryLayerCount[] = [];

  for (const layerId of COUNTRY_FILTER_LAYER_IDS) {
    if (!visibleLayerIds.has(layerId)) continue;
    const layer = layerById.get(layerId);
    if (!layer || typeof layer.queryFeatureCount !== "function") continue;

    let count = 0;
    try {
      count = await layer.queryFeatureCount({ where });
    } catch {
      continue;
    }
    if (count === 0) continue;

    const label = labelByLayerId.get(layerId) ?? layerId;
    rows.push({
      layerId,
      label,
      count,
      displayCount: ` (${count.toLocaleString()})`,
    });
  }

  return rows;
}

/**
 * Program-country totals from visible map layers (`country_name` on GeoJSON).
 * Independent per label (e.g. EUMETNET vs EUROPE), unlike partner ISO rollup.
 */
export async function getCountryTotalFromMap(
  country: CountryName,
  layerById: Map<string, GeoJSONLayer>,
  visibleLayerIds: ReadonlySet<string>
): Promise<number> {
  return queryCountryTotal(countryWhere(country), layerById, visibleLayerIds);
}

/**
 * Ship-flag totals from visible map layers (`country_ship` on GeoJSON).
 * Only ship-deployed platforms carry this field; fixed platforms are excluded.
 */
export async function getCountryShipTotalFromMap(
  country: CountryName,
  layerById: Map<string, GeoJSONLayer>,
  visibleLayerIds: ReadonlySet<string>
): Promise<number> {
  return queryCountryTotal(shipCountryWhere(country), layerById, visibleLayerIds);
}

export async function getCountryBreakdownFromMap(
  country: CountryName,
  layerById: Map<string, GeoJSONLayer>,
  visibleLayerIds: ReadonlySet<string>
): Promise<CountryLayerCount[]> {
  return queryCountryBreakdown(countryWhere(country), layerById, visibleLayerIds);
}

export async function getCountryShipBreakdownFromMap(
  country: CountryName,
  layerById: Map<string, GeoJSONLayer>,
  visibleLayerIds: ReadonlySet<string>
): Promise<CountryLayerCount[]> {
  return queryCountryBreakdown(shipCountryWhere(country), layerById, visibleLayerIds);
}
