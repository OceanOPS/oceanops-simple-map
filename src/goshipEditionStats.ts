import {
  parseEditionCruisesRaw,
  type EditionCruiseRow,
} from "./lineEditionCruises";
import { getPartnerDataSnapshot } from "./partnerCountriesData";
import { getCountryLabel, type CountryName } from "./countryFilters";

const BASE = import.meta.env.BASE_URL;

export type GoshipUnsampledLine = {
  lineName: string;
  editionStatus: string;
};

export type GoshipEditionStats = {
  periodSince: string;
  periodUntil: string;
  designLineCount: number;
  sampledLineCount: number;
  unsampledLineCount: number;
  distinctCruiseCount: number;
  lineAssociationCount: number;
  legendCruiseCount: number;
  sampledLineNames: string[];
  unsampledLines: GoshipUnsampledLine[];
  unsampledByStatus: { status: string; count: number; lineNames: string[] }[];
  cruisesByCountry: { country: string; count: number }[];
  linesWithMultipleCruises: { lineName: string; cruises: EditionCruiseRow[] }[];
  sharedCruises: {
    cruiseRef: string;
    lines: string[];
    programCountry: string;
    cruiseDate: string;
    shipName: string;
  }[];
};

let cachedStats: GoshipEditionStats | null = null;
let loadPromise: Promise<GoshipEditionStats> | null = null;

function partnerCruiseCountByCountry(): { country: string; count: number }[] {
  const data = getPartnerDataSnapshot();
  const rows: { country: string; count: number }[] = [];

  for (const record of data.countries) {
    const count = record.networks.goShip ?? 0;
    if (count <= 0) continue;
    const geoName = record.geoCountryNames?.[0] ?? record.name;
    rows.push({
      country: getCountryLabel(geoName as CountryName) || record.name,
      count,
    });
  }

  return rows.sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));
}

function isSampledFeature(attrs: Record<string, unknown>): boolean {
  return (
    attrs.sampled_in_edition === true ||
    attrs.sampled_in_edition === 1 ||
    attrs.sampled_in_edition === "true" ||
    String(attrs.line_style ?? "") === "solid"
  );
}

function buildStatsFromFeatures(
  features: Array<{ properties?: Record<string, unknown> }>,
  periodSince: string,
  periodUntil: string
): GoshipEditionStats {
  const sampledLineNames: string[] = [];
  const unsampledLines: GoshipUnsampledLine[] = [];
  const linesWithMultipleCruises: GoshipEditionStats["linesWithMultipleCruises"] =
    [];
  const cruiseLines = new Map<
    string,
    { lines: Set<string>; programCountry: string; cruiseDate: string; shipName: string }
  >();
  let lineAssociationCount = 0;

  for (const feature of features) {
    const attrs = feature.properties ?? {};
    const lineName = String(attrs.line_name ?? "").trim();
    if (!lineName) continue;

    if (isSampledFeature(attrs)) {
      sampledLineNames.push(lineName);
      const cruises = parseEditionCruisesRaw(attrs.edition_cruises);
      if (cruises.length > 1) {
        linesWithMultipleCruises.push({ lineName, cruises });
      }

      for (const cruise of cruises) {
        const cruiseRef = cruise.cruise_ref?.trim();
        if (!cruiseRef) continue;
        lineAssociationCount += 1;
        let entry = cruiseLines.get(cruiseRef);
        if (!entry) {
          entry = {
            lines: new Set<string>(),
            programCountry: cruise.program_country?.trim() || "Unknown",
            cruiseDate: cruise.cruise_date?.trim() || "",
            shipName: cruise.ship_name?.trim() || "",
          };
          cruiseLines.set(cruiseRef, entry);
        }
        entry.lines.add(lineName);
        if (cruise.program_country?.trim()) {
          entry.programCountry = cruise.program_country.trim();
        }
        if (cruise.cruise_date?.trim()) {
          entry.cruiseDate = cruise.cruise_date.trim();
        }
        if (cruise.ship_name?.trim()) {
          entry.shipName = cruise.ship_name.trim();
        }
      }
    } else {
      unsampledLines.push({
        lineName,
        editionStatus: String(attrs.edition_status ?? "Not sampled in edition").trim(),
      });
    }
  }

  sampledLineNames.sort((a, b) => a.localeCompare(b));
  unsampledLines.sort((a, b) => a.lineName.localeCompare(b.lineName));

  const statusGroups = new Map<string, string[]>();
  for (const row of unsampledLines) {
    const names = statusGroups.get(row.editionStatus) ?? [];
    names.push(row.lineName);
    statusGroups.set(row.editionStatus, names);
  }
  const unsampledByStatus = [...statusGroups.entries()]
    .map(([status, lineNames]) => ({
      status,
      count: lineNames.length,
      lineNames: lineNames.sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));

  const sharedCruises = [...cruiseLines.entries()]
    .filter(([, entry]) => entry.lines.size > 1)
    .map(([cruiseRef, entry]) => ({
      cruiseRef,
      lines: [...entry.lines].sort((a, b) => a.localeCompare(b)),
      programCountry: entry.programCountry,
      cruiseDate: entry.cruiseDate,
      shipName: entry.shipName,
    }))
    .sort((a, b) => a.cruiseDate.localeCompare(b.cruiseDate));

  linesWithMultipleCruises.sort((a, b) => a.lineName.localeCompare(b.lineName));

  const legendCruiseCount = getPartnerDataSnapshot().countries.reduce(
    (sum, record) => sum + Math.max(0, record.networks.goShip ?? 0),
    0
  );

  return {
    periodSince,
    periodUntil,
    designLineCount: sampledLineNames.length + unsampledLines.length,
    sampledLineCount: sampledLineNames.length,
    unsampledLineCount: unsampledLines.length,
    distinctCruiseCount: cruiseLines.size,
    lineAssociationCount,
    legendCruiseCount,
    sampledLineNames,
    unsampledLines,
    unsampledByStatus,
    cruisesByCountry: partnerCruiseCountByCountry(),
    linesWithMultipleCruises,
    sharedCruises,
  };
}

async function fetchGoshipGeoJson(): Promise<{
  features: Array<{ properties?: Record<string, unknown> }>;
}> {
  const urls = [`${BASE}geojson/goship.geojson`, `${BASE}geojson/goship_undensified.geojson`];
  let lastError: unknown;

  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-cache" });
      if (!response.ok) continue;
      return (await response.json()) as {
        features: Array<{ properties?: Record<string, unknown> }>;
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Could not load GO-SHIP GeoJSON");
}

export async function loadGoshipEditionStats(
  periodSince: string,
  periodUntil: string
): Promise<GoshipEditionStats> {
  if (
    cachedStats &&
    cachedStats.periodSince === periodSince &&
    cachedStats.periodUntil === periodUntil
  ) {
    return cachedStats;
  }

  if (!loadPromise) {
    loadPromise = (async () => {
      const geo = await fetchGoshipGeoJson();
      return buildStatsFromFeatures(geo.features ?? [], periodSince, periodUntil);
    })().finally(() => {
      loadPromise = null;
    });
  }

  const stats = await loadPromise;
  cachedStats = stats;
  return stats;
}
