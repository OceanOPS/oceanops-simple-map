import {
  geoCountryNamesForFilter,
  getCountryLabel,
  isIgnoredGeoCountry,
  normalizeGeoCountryKey,
  type CountryName,
} from "./countryFilters";
import { getIsoCodeForGeoCountry } from "./countryFlags";
import { getPartnerDataSnapshot } from "./partnerCountriesData";

export function countryNamesMatch(a: string, b: string): boolean {
  const keyA = normalizeGeoCountryKey(a);
  const keyB = normalizeGeoCountryKey(b);
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;
  const isoLeft = getIsoCodeForGeoCountry(keyA);
  const isoRight = getIsoCodeForGeoCountry(keyB);
  return isoLeft !== undefined && isoLeft === isoRight;
}

/** Selected legend country matches a DB / GeoJSON country name. */
export function countryNameMatchesFilter(
  country: CountryName,
  dbName: string
): boolean {
  const names = geoCountryNamesForFilter(country);
  return names.some(
    (geo) =>
      countryNamesMatch(geo, dbName) ||
      countryNamesMatch(getCountryLabel(geo as CountryName), dbName)
  );
}

/** Ship flag differs from all program-country contributors on the cruise. */
export function isCrossCountryCruise(
  shipCountry: string,
  programCountriesCsv: string
): boolean {
  const ship = shipCountry.trim();
  if (!ship || isIgnoredGeoCountry(ship)) return false;
  const programCountries = programCountriesCsv
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  if (programCountries.length === 0) return false;
  return !programCountries.some((name) => countryNamesMatch(ship, name));
}

export function parseProgramCountryNames(csv: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of csv.split(",")) {
    const canonical = normalizeGeoCountryKey(raw.trim());
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    names.push(canonical);
  }
  return names;
}

/** Map OceanOPS country name → canonical GeoJSON-style key for modal breakdowns. */
export function geoCountryKeyFromDbName(dbCountryName: string): string {
  const trimmed = dbCountryName.trim();
  const direct = normalizeGeoCountryKey(trimmed);
  if (direct) return direct;

  const iso = getIsoCodeForGeoCountry(trimmed);
  if (iso) {
    const snap = getPartnerDataSnapshot();
    for (const [geo, code] of Object.entries(snap.byGeoCountryName)) {
      if (code !== iso) continue;
      const canonical = normalizeGeoCountryKey(geo);
      if (canonical) return canonical;
    }
  }

  return trimmed.toUpperCase();
}
