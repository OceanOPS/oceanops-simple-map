import type GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import { categories } from "./categories";
import {
  COUNTRY_FILTER_LAYER_IDS,
  COUNTRY_FILTER_LINE_LAYER_IDS,
  geoCountryNamesForFilter,
  getGeoCountryLabel,
  type CountryName,
} from "./countryFilters";
import { getCountryIsoCode, getIsoCodeForGeoCountry } from "./countryFlags";
import {
  countryNameMatchesFilter,
  geoCountryKeyFromDbName,
  isCrossCountryCruise,
  parseProgramCountryNames,
} from "./lineCrossCountryCruise";
import {
  getCountryBreakdownFromPartner,
  getPartnerDataSnapshot,
  type CountryLayerCount,
} from "./partnerCountriesData";

export type CountryContributorCount = {
  geoCountry: string;
  label: string;
  isoCode?: string;
  count: number;
  displayCount: string;
};

export type PlatformCountryCount = {
  layerId: string;
  label: string;
  geoCountry: string;
  countryLabel: string;
  isoCode?: string;
  count: number;
  displayCount: string;
};

export type PlatformWithCountries = {
  layerId: string;
  label: string;
  count: number;
  displayCount: string;
  countries: CountryContributorCount[];
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

/**
 * Ship-flag platforms where the operating country differs from the vessel flag
 * (ship time — e.g. a US float deployed from a French-flagged ship).
 */
function shipCrossCountryWhere(country: CountryName): string {
  const flagNames = geoCountryNamesForFilter(country);
  const ship = shipCountryWhere(country);
  const operatorClause =
    flagNames.length === 1
      ? `country_name <> country_ship`
      : `country_name NOT IN (${flagNames.map((n) => `'${n.replace(/'/g, "''")}'`).join(", ")})`;

  return `${ship} AND country_name IS NOT NULL AND country_name <> 'UNKNOWN' AND ${operatorClause}`;
}

function sensorProviderCountryWhere(country: CountryName): string {
  const names = geoCountryNamesForFilter(country);
  const list = names.map((n) => `'${n.replace(/'/g, "''")}'`).join(", ");
  const inClause = names.length === 1 ? `= ${list}` : `IN (${list})`;
  return `country_sensor_provider ${inClause} AND country_sensor_provider IS NOT NULL`;
}

/**
 * Cross-program sensors: provider country matches this country but the platform
 * program country differs (e.g. a UK sensor on a US Argo float).
 */
function sensorCrossCountryWhere(country: CountryName): string {
  const providerNames = geoCountryNamesForFilter(country);
  const provider = sensorProviderCountryWhere(country);
  const programClause =
    providerNames.length === 1
      ? `country_name <> country_sensor_provider`
      : `country_name NOT IN (${providerNames.map((n) => `'${n.replace(/'/g, "''")}'`).join(", ")})`;

  return `${provider} AND country_name IS NOT NULL AND country_name <> 'UNKNOWN' AND ${programClause}`;
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

async function aggregatePlatformCountryCounts(
  where: string,
  layerById: Map<string, GeoJSONLayer>,
  visibleLayerIds: ReadonlySet<string>
): Promise<PlatformCountryCount[]> {
  const rows: PlatformCountryCount[] = [];
  const pageSize = 2000;

  for (const layerId of COUNTRY_FILTER_LAYER_IDS) {
    if (!visibleLayerIds.has(layerId)) continue;
    const layer = layerById.get(layerId);
    if (!layer || typeof layer.queryFeatures !== "function") continue;

    const totals = new Map<string, number>();
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

    for (const [geoCountry, count] of totals.entries()) {
      if (count === 0) continue;
      const label = labelByLayerId.get(layerId) ?? layerId;
      rows.push({
        layerId,
        label,
        geoCountry,
        countryLabel:
          geoCountry === "UNKNOWN"
            ? "Unknown operator"
            : getGeoCountryLabel(geoCountry),
        isoCode: geoCountry === "UNKNOWN" ? undefined : getIsoCodeForGeoCountry(geoCountry),
        count,
        displayCount: ` (${count.toLocaleString()})`,
      });
    }
  }

  return rows.sort(
    (a, b) =>
      b.count - a.count ||
      a.label.localeCompare(b.label) ||
      a.countryLabel.localeCompare(b.countryLabel)
  );
}

export function groupPlatformCountryRows(rows: PlatformCountryCount[]): PlatformWithCountries[] {
  const byLayer = new Map<string, PlatformWithCountries>();

  for (const row of rows) {
    let platform = byLayer.get(row.layerId);
    if (!platform) {
      platform = {
        layerId: row.layerId,
        label: row.label,
        count: 0,
        displayCount: "",
        countries: [],
      };
      byLayer.set(row.layerId, platform);
    }

    platform.count += row.count;
    platform.countries.push({
      geoCountry: row.geoCountry,
      label: row.countryLabel,
      isoCode: row.isoCode,
      count: row.count,
      displayCount: row.displayCount,
    });
  }

  return [...byLayer.values()]
    .map((platform) => ({
      ...platform,
      displayCount: ` (${platform.count.toLocaleString()})`,
      countries: platform.countries.sort(
        (a, b) => b.count - a.count || a.label.localeCompare(b.label)
      ),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export type CountryLineNetworkDetail = CountryLayerCount & {
  lineNames: string[];
};

function parseEditionCountryCodes(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Line networks for a country from map GeoJSON — edition lead (solid) or last
 * cruise program country (dash).
 */
export async function getCountryLineDetailsFromMap(
  country: CountryName,
  layerById: Map<string, GeoJSONLayer>,
  visibleLayerIds: ReadonlySet<string>
): Promise<CountryLineNetworkDetail[]> {
  const iso = getCountryIsoCode(country)?.toUpperCase();
  if (!iso) return [];

  const details: CountryLineNetworkDetail[] = [];

  for (const layerId of COUNTRY_FILTER_LINE_LAYER_IDS) {
    if (!visibleLayerIds.has(layerId)) continue;
    const layer = layerById.get(layerId);
    if (!layer || typeof layer.queryFeatures !== "function") continue;

    let lineNames: string[] = [];
    try {
      const result = await layer.queryFeatures({
        where: "1=1",
        outFields: ["line_name", "edition_country_codes", "last_cruise_countries"],
        returnGeometry: false,
      });
      lineNames = result.features
        .filter((feature) => {
          const attrs = feature.attributes ?? {};
          if (
            parseEditionCountryCodes(attrs.edition_country_codes).includes(iso)
          ) {
            return true;
          }
          return parseProgramCountryNames(
            String(attrs.last_cruise_countries ?? "")
          ).some((name) => countryNameMatchesFilter(country, name));
        })
        .map((feature) => String(feature.attributes?.line_name ?? "").trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    } catch {
      continue;
    }

    if (lineNames.length === 0) continue;

    const label = labelByLayerId.get(layerId) ?? layerId;
    details.push({
      layerId,
      label,
      count: lineNames.length,
      displayCount: ` (${lineNames.length.toLocaleString()})`,
      lineNames,
    });
  }

  return details.sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label)
  );
}

export async function getCountryLineTotalFromMap(
  country: CountryName,
  layerById: Map<string, GeoJSONLayer>,
  visibleLayerIds: ReadonlySet<string>
): Promise<number> {
  const rows = await getCountryLineDetailsFromMap(country, layerById, visibleLayerIds);
  return rows.reduce((sum, row) => sum + row.count, 0);
}

/**
 * GO-SHIP / Ocean TraX lines have no `country_name` on GeoJSON — counts come from partner export.
 */
export function getCountryLineBreakdownFromPartner(
  country: CountryName,
  visibleLayerIds: ReadonlySet<string>
): CountryLayerCount[] {
  const lineLayerSet = new Set<string>(COUNTRY_FILTER_LINE_LAYER_IDS);
  return getCountryBreakdownFromPartner(
    country,
    getPartnerDataSnapshot(),
    visibleLayerIds
  ).filter((row) => lineLayerSet.has(row.layerId));
}

export function getCountryLineTotalFromPartner(
  country: CountryName,
  visibleLayerIds: ReadonlySet<string>
): number {
  return getCountryLineBreakdownFromPartner(country, visibleLayerIds).reduce(
    (sum, row) => sum + (row.count > 0 ? row.count : 0),
    0
  );
}

/**
 * Cross-country design-line cruises: ship flag matches this country and lead
 * program country differs (latest cruise per line on GO-SHIP / Ocean TraX).
 */
export async function getCountryLineCrossCruiseTotalFromMap(
  country: CountryName,
  layerById: Map<string, GeoJSONLayer>,
  visibleLayerIds: ReadonlySet<string>
): Promise<number> {
  let total = 0;

  for (const layerId of COUNTRY_FILTER_LINE_LAYER_IDS) {
    if (!visibleLayerIds.has(layerId)) continue;
    const layer = layerById.get(layerId);
    if (!layer || typeof layer.queryFeatures !== "function") continue;

    try {
      const result = await layer.queryFeatures({
        where: "1=1",
        outFields: ["last_cruise_ship_country", "last_cruise_countries"],
        returnGeometry: false,
      });

      for (const feature of result.features) {
        const shipCountry = String(
          feature.attributes?.last_cruise_ship_country ?? ""
        ).trim();
        const programCountries = String(
          feature.attributes?.last_cruise_countries ?? ""
        ).trim();

        if (!countryNameMatchesFilter(country, shipCountry)) continue;
        if (!isCrossCountryCruise(shipCountry, programCountries)) continue;
        total += 1;
      }
    } catch {
      continue;
    }
  }

  return total;
}

export async function getCountryLineCrossCruisePlatformCountryBreakdownFromMap(
  country: CountryName,
  layerById: Map<string, GeoJSONLayer>,
  visibleLayerIds: ReadonlySet<string>
): Promise<PlatformCountryCount[]> {
  const rows: PlatformCountryCount[] = [];

  for (const layerId of COUNTRY_FILTER_LINE_LAYER_IDS) {
    if (!visibleLayerIds.has(layerId)) continue;
    const layer = layerById.get(layerId);
    if (!layer || typeof layer.queryFeatures !== "function") continue;

    const totals = new Map<string, number>();

    try {
      const result = await layer.queryFeatures({
        where: "1=1",
        outFields: [
          "line_name",
          "last_cruise_ship_country",
          "last_cruise_countries",
        ],
        returnGeometry: false,
      });

      for (const feature of result.features) {
        const shipCountry = String(
          feature.attributes?.last_cruise_ship_country ?? ""
        ).trim();
        const programCountries = String(
          feature.attributes?.last_cruise_countries ?? ""
        ).trim();

        if (!countryNameMatchesFilter(country, shipCountry)) continue;
        if (!isCrossCountryCruise(shipCountry, programCountries)) continue;

        for (const forName of parseProgramCountryNames(programCountries)) {
          if (countryNameMatchesFilter(country, forName)) continue;
          const geoCountry = geoCountryKeyFromDbName(forName);
          totals.set(geoCountry, (totals.get(geoCountry) ?? 0) + 1);
        }
      }
    } catch {
      continue;
    }

    const networkLabel = labelByLayerId.get(layerId) ?? layerId;
    for (const [geoCountry, count] of totals.entries()) {
      if (count === 0) continue;
      rows.push({
        layerId,
        label: networkLabel,
        geoCountry,
        countryLabel:
          geoCountry === "UNKNOWN"
            ? "Unknown country"
            : getGeoCountryLabel(geoCountry),
        isoCode:
          geoCountry === "UNKNOWN"
            ? undefined
            : getIsoCodeForGeoCountry(geoCountry),
        count,
        displayCount: ` (${count.toLocaleString()})`,
      });
    }
  }

  return rows.sort(
    (a, b) =>
      b.count - a.count ||
      a.label.localeCompare(b.label) ||
      a.countryLabel.localeCompare(b.countryLabel)
  );
}

/**
 * Program-country totals: platforms from map GeoJSON + line networks from partner export.
 */
export async function getCountryProgramTotalFromMap(
  country: CountryName,
  layerById: Map<string, GeoJSONLayer>,
  visibleLayerIds: ReadonlySet<string>
): Promise<number> {
  const [mapTotal, lineTotal] = await Promise.all([
    getCountryTotalFromMap(country, layerById, visibleLayerIds),
    getCountryLineTotalFromMap(country, layerById, visibleLayerIds),
  ]);
  return mapTotal + lineTotal;
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
 * Cross-flag ship deployments: `country_ship` matches this flag and `country_name` differs.
 */
export async function getCountryShipTotalFromMap(
  country: CountryName,
  layerById: Map<string, GeoJSONLayer>,
  visibleLayerIds: ReadonlySet<string>
): Promise<number> {
  return queryCountryTotal(shipCrossCountryWhere(country), layerById, visibleLayerIds);
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
  return queryCountryBreakdown(shipCrossCountryWhere(country), layerById, visibleLayerIds);
}

/**
 * For a ship-flag country, cross-flag deployments grouped by operating country.
 */
export async function getCountryShipContributorBreakdownFromMap(
  country: CountryName,
  layerById: Map<string, GeoJSONLayer>,
  visibleLayerIds: ReadonlySet<string>
): Promise<CountryContributorCount[]> {
  const totals = await aggregateContributorCounts(
    shipCrossCountryWhere(country),
    layerById,
    visibleLayerIds
  );
  return contributorRowsFromTotals(totals);
}

/**
 * Cross-flag deployments by platform type and operating country.
 */
export async function getCountryShipPlatformCountryBreakdownFromMap(
  country: CountryName,
  layerById: Map<string, GeoJSONLayer>,
  visibleLayerIds: ReadonlySet<string>
): Promise<PlatformCountryCount[]> {
  return aggregatePlatformCountryCounts(
    shipCrossCountryWhere(country),
    layerById,
    visibleLayerIds
  );
}

/**
 * Cross-program sensors: `country_sensor_provider` matches this country and `country_name` differs.
 */
export async function getCountrySensorTotalFromMap(
  country: CountryName,
  layerById: Map<string, GeoJSONLayer>,
  visibleLayerIds: ReadonlySet<string>
): Promise<number> {
  return queryCountryTotal(sensorCrossCountryWhere(country), layerById, visibleLayerIds);
}

export async function getCountrySensorBreakdownFromMap(
  country: CountryName,
  layerById: Map<string, GeoJSONLayer>,
  visibleLayerIds: ReadonlySet<string>
): Promise<CountryLayerCount[]> {
  return queryCountryBreakdown(sensorCrossCountryWhere(country), layerById, visibleLayerIds);
}

/**
 * For a sensor-provider country, cross-program sensors grouped by platform program country.
 */
export async function getCountrySensorContributorBreakdownFromMap(
  country: CountryName,
  layerById: Map<string, GeoJSONLayer>,
  visibleLayerIds: ReadonlySet<string>
): Promise<CountryContributorCount[]> {
  const totals = await aggregateContributorCounts(
    sensorCrossCountryWhere(country),
    layerById,
    visibleLayerIds
  );
  return contributorRowsFromTotals(totals);
}

/**
 * Cross-program sensors by platform type and operating country.
 */
export async function getCountrySensorPlatformCountryBreakdownFromMap(
  country: CountryName,
  layerById: Map<string, GeoJSONLayer>,
  visibleLayerIds: ReadonlySet<string>
): Promise<PlatformCountryCount[]> {
  return aggregatePlatformCountryCounts(
    sensorCrossCountryWhere(country),
    layerById,
    visibleLayerIds
  );
}
