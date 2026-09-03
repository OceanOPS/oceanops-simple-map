import type { CountryName } from "./countryFilters";
import { ALL_COUNTRIES } from "./countryFilters";
import partnerSnapshot from "./data/partnerCountries.json";
import { categories } from "./categories";
import {
  PARTNER_NETWORK_ORDER,
  PARTNER_NETWORK_TO_LAYER,
} from "./partnerNetworkMap";

export type PartnerNetworkCounts = Record<string, number>;

export type PartnerCountryRecord = {
  name: string;
  countryCode: string;
  description?: string;
  geoCountryNames: string[];
  networks: PartnerNetworkCounts;
};

export type PartnerCountriesFile = {
  generatedAt: string;
  edition: string;
  source: string;
  /** Filterable countries after rollup + whitelist (matches report card headline). */
  contributingCountries?: number;
  countries: PartnerCountryRecord[];
  byGeoCountryName: Record<string, string>;
};

export function getPartnerDataSnapshot(): PartnerCountriesFile {
  return partnerSnapshot as PartnerCountriesFile;
}

const ALL_LAYER_IDS: ReadonlySet<string> = new Set(categories.map((c) => c.id));

/** Countries listed in the legend (partner export total > 0 for all networks). */
export function getFilterableCountryNames(
  data: PartnerCountriesFile = getPartnerDataSnapshot()
): CountryName[] {
  return ALL_COUNTRIES.filter((country) => {
    return getCountryTotalFromPartner(country, data, ALL_LAYER_IDS) > 0;
  });
}

let cached: PartnerCountriesFile | null = null;
let loadPromise: Promise<PartnerCountriesFile> | null = null;

export async function loadPartnerCountriesData(): Promise<PartnerCountriesFile> {
  if (cached) return cached;
  if (loadPromise) return loadPromise;

  loadPromise = Promise.resolve(getPartnerDataSnapshot()).then((data) => {
    cached = data;
    return data;
  });

  return loadPromise;
}

const countriesByIso = new Map<string, PartnerCountryRecord>();

function indexCountries(data: PartnerCountriesFile): void {
  countriesByIso.clear();
  for (const country of data.countries) {
    countriesByIso.set(country.countryCode, country);
  }
}

export function getPartnerCountryByGeoName(
  data: PartnerCountriesFile,
  geoCountry: CountryName
): PartnerCountryRecord | null {
  if (countriesByIso.size === 0) indexCountries(data);

  const iso = data.byGeoCountryName[geoCountry];
  if (!iso) return null;
  return countriesByIso.get(iso) ?? null;
}

function isLayerVisible(layerId: string, visibleLayerIds: ReadonlySet<string>): boolean {
  return visibleLayerIds.has(layerId);
}

function numericContribution(count: number): number {
  if (count < 0) return 0;
  return count;
}

export function getCountryTotalFromPartner(
  geoCountry: CountryName,
  data: PartnerCountriesFile,
  visibleLayerIds: ReadonlySet<string>
): number {
  const record = getPartnerCountryByGeoName(data, geoCountry);
  if (!record) return 0;

  let total = 0;
  for (const networkKey of PARTNER_NETWORK_ORDER) {
    const layerId = PARTNER_NETWORK_TO_LAYER[networkKey];
    if (!layerId || !isLayerVisible(layerId, visibleLayerIds)) continue;
    total += numericContribution(record.networks[networkKey] ?? 0);
  }
  return total;
}

export type CountryLayerCount = {
  layerId: string;
  label: string;
  count: number;
  displayCount: string;
};

const labelByLayerId = new Map(categories.map((c) => [c.id, c.label]));

export function getCountryBreakdownFromPartner(
  geoCountry: CountryName,
  data: PartnerCountriesFile,
  visibleLayerIds: ReadonlySet<string>
): CountryLayerCount[] {
  const record = getPartnerCountryByGeoName(data, geoCountry);
  if (!record) return [];

  const rows: CountryLayerCount[] = [];

  for (const networkKey of PARTNER_NETWORK_ORDER) {
    const layerId = PARTNER_NETWORK_TO_LAYER[networkKey];
    if (!layerId || !isLayerVisible(layerId, visibleLayerIds)) continue;

    const count = record.networks[networkKey] ?? 0;
    if (count === 0) continue;

    const label = labelByLayerId.get(layerId) ?? networkKey;
    const displayCount =
      count === -1 ? " (X)" : ` (${count.toLocaleString()})`;

    rows.push({
      layerId,
      label,
      count,
      displayCount,
    });
  }

  return rows;
}

/** Global partner-export total for one network (sum across countries). */
export function getNetworkTotalFromPartner(
  networkKey: string,
  data: PartnerCountriesFile = getPartnerDataSnapshot()
): number {
  let total = 0;
  for (const country of data.countries) {
    total += numericContribution(country.networks[networkKey] ?? 0);
  }
  return total;
}
