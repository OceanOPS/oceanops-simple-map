import type GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import { categories } from "./categories";
import {
  COUNTRY_FILTER_LAYER_IDS,
  geoCountryNamesForFilter,
  getGeoCountryLabel,
  type CountryName,
} from "./countryFilters";
import { getIsoCodeForGeoCountry } from "./countryFlags";
import type { CountryLayerCount } from "./partnerCountriesData";

export type CountryContributorCount = {
  geoCountry: string;
  label: string;
  isoCode?: string;
  count: number;
  displayCount: string;
};

function countryWhere(country: CountryName): string {
  const names = geoCountryNamesForFilter(country);
  if (names.length === 1) {
    return `country_name = '${names[0].replace(/'/g, "''")}'`;
  }
  const list = names.map((n) => `'${n.replace(/'/g, "''")}'`).join(", ");
  return `country_name IN (${list})`;
}

function shipCountryWhere(country: CountryName): string {
  const names = geoCountryNamesForFilter(country);
  const list = names.map((n) => `'${n.replace(/'/g, "''")}'`).join(", ");
  const inClause = names.length === 1 ? `= ${list}` : `IN (${list})`;
  return `country_ship ${inClause} AND country_ship <> 'UNKNOWN'`;
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

async function aggregateContributorCounts(
  where: string,
  layerById: Map<string, GeoJSONLayer>,
  visibleLayerIds: ReadonlySet<string>
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  const pageSize = 2000;

  for (const layerId of COUNTRY_FILTER_LAYER_IDS) {
    if (!visibleLayerIds.has(layerId)) continue;
    const layer = layerById.get(layerId);
    if (!layer || typeof layer.queryFeatures !== "function") continue;

    let start = 0;
    while (true) {
      try {
        const result = await layer.queryFeatures({
          where,
          outFields: ["country_name"],
          returnGeometry: false,
          start,
          num: pageSize,
        });

        for (const feature of result.features) {
          const raw = feature.attributes?.country_name;
          const key =
            typeof raw === "string" && raw.trim()
              ? raw.trim().toUpperCase()
              : "UNKNOWN";
          totals.set(key, (totals.get(key) ?? 0) + 1);
        }

        if (result.features.length === 0) break;
        if (!result.exceededTransferLimit && result.features.length < pageSize) break;
        start += result.features.length;
      } catch {
        break;
      }
    }
  }

  return totals;
}

function contributorRowsFromTotals(
  totals: Map<string, number>
): CountryContributorCount[] {
  return [...totals.entries()]
    .map(([geoCountry, count]) => ({
      geoCountry,
      label:
        geoCountry === "UNKNOWN"
          ? "Unknown operator"
          : getGeoCountryLabel(geoCountry),
      isoCode: geoCountry === "UNKNOWN" ? undefined : getIsoCodeForGeoCountry(geoCountry),
      count,
      displayCount: ` (${count.toLocaleString()})`,
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * Program-country totals from visible map layers (`country_name` on GeoJSON).
 * Totals include rolled-up geo names (e.g. China includes Hong Kong platforms).
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

/**
 * For a ship-flag country, platforms grouped by contributing country (`country_name`).
 */
export async function getCountryShipContributorBreakdownFromMap(
  country: CountryName,
  layerById: Map<string, GeoJSONLayer>,
  visibleLayerIds: ReadonlySet<string>
): Promise<CountryContributorCount[]> {
  const totals = await aggregateContributorCounts(
    shipCountryWhere(country),
    layerById,
    visibleLayerIds
  );
  return contributorRowsFromTotals(totals);
}
