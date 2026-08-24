import {
  geoCountryNamesForFilter,
  getCountryLabel,
  type CountryName,
} from "./countryFilters";
import { getIsoCodeForGeoCountry } from "./countryFlags";
import { getPartnerDataSnapshot } from "./partnerCountriesData";

export function countryNamesMatch(a: string, b: string): boolean {
  const left = a.trim();
  const right = b.trim();
  if (!left || !right) return false;
  if (left.toUpperCase() === right.toUpperCase()) return true;
  const isoLeft = getIsoCodeForGeoCountry(left);
  const isoRight = getIsoCodeForGeoCountry(right);
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
  if (!ship || ship.toUpperCase() === "UNKNOWN") return false;
  const programCountries = programCountriesCsv
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  if (programCountries.length === 0) return false;
  return !programCountries.some((name) => countryNamesMatch(ship, name));
}

export function parseProgramCountryNames(csv: string): string[] {
  return csv
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name && name.toUpperCase() !== "UNKNOWN");
}

/** Map OceanOPS country name → GeoJSON-style key for modal breakdowns. */
export function geoCountryKeyFromDbName(dbCountryName: string): string {
  const trimmed = dbCountryName.trim();
  if (!trimmed) return "UNKNOWN";

  const iso = getIsoCodeForGeoCountry(trimmed);
  if (iso) {
    const snap = getPartnerDataSnapshot();
    for (const [geo, code] of Object.entries(snap.byGeoCountryName)) {
      if (code === iso) return geo;
    }
  }

  return trimmed.toUpperCase();
}
