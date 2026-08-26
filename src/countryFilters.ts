import type GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import { categories } from "./categories";
import { getPartnerDataSnapshot } from "./partnerCountriesData";

/** GeoJSON `country_name` values present in platform layers. */
export const ALL_COUNTRIES = [
  "ARGENTINA",
  "AUSTRALIA",
  "BAHAMAS",
  "BANGLADESH",
  "BELGIUM",
  "BERMUDA",
  "BRAZIL",
  "BULGARIA",
  "CANADA",
  "CHILE",
  "CHINA",
  "COLOMBIA",
  "COOK ISLANDS",
  "CROATIA",
  "CUBA",
  "DENMARK",
  "EUROPE",
  "FAROE IS.",
  "FIJI",
  "FINLAND",
  "FRANCE",
  "GERMANY",
  "GREECE",
  "GUINEA-BISSAU",
  "ICELAND",
  "INDIA",
  "INDONESIA",
  "IRELAND",
  "ISRAEL",
  "ITALY",
  "JAPAN",
  "JORDAN",
  "KIRIBATI",
  "MALTA",
  "MARSHALL IS.",
  "MAURITIUS",
  "MEXICO",
  "MICRONESIA",
  "NAURU",
  "NETHERLANDS",
  "NEW ZEALAND",
  "NORWAY",
  "PANAMA",
  "PERU",
  "PHILIPPINES",
  "PNG",
  "POLAND",
  "PORTUGAL",
  "PUERTO RICO",
  "RUSSIA",
  "SINGAPORE",
  "SLOVENIA",
  "SOUTH AFRICA",
  "SOUTH KOREA",
  "SPAIN",
  "SWEDEN",
  "TANZANIA",
  "THAILAND",
  "TONGA",
  "TUVALU",
  "UAE",
  "UK",
  "UKRAINE",
  "URUGUAY",
  "USA",
  "VANUATU",
  "VIET NAM",
  "WALLIS/FUTUNA",
] as const;

export type CountryName = (typeof ALL_COUNTRIES)[number];

export const G7_COUNTRIES: CountryName[] = [
  "CANADA",
  "FRANCE",
  "GERMANY",
  "ITALY",
  "JAPAN",
  "UK",
  "USA",
];

export const EU_COUNTRIES: CountryName[] = [
  "BELGIUM",
  "BULGARIA",
  "CROATIA",
  "DENMARK",
  "EUROPE",
  "FINLAND",
  "FRANCE",
  "GERMANY",
  "GREECE",
  "IRELAND",
  "ITALY",
  "MALTA",
  "NETHERLANDS",
  "POLAND",
  "PORTUGAL",
  "SLOVENIA",
  "SPAIN",
  "SWEDEN",
];

const G7_SET = new Set<string>(G7_COUNTRIES);
const EU_SET = new Set<string>(EU_COUNTRIES);

export const OTHER_COUNTRIES: CountryName[] = ALL_COUNTRIES.filter(
  (country) => !G7_SET.has(country) && !EU_SET.has(country)
);

/** Platform layers filtered by GeoJSON `country_name`. */
export const COUNTRY_FILTER_LAYER_IDS = categories
  .filter((cat) => cat.id !== "oceantrax" && cat.id !== "goship")
  .map((cat) => cat.id);

/** Line layers filtered by edition / last cruise country (Ocean TraX keeps orphans visible). */
export const COUNTRY_FILTER_LINE_LAYER_IDS = ["goship", "oceantrax"] as const;

/** Extra GeoJSON `country_name` values rolled into a filter country (partner export alignment). */
export const GEO_COUNTRY_ALIASES: Partial<
  Record<CountryName, readonly string[]>
> = {
  CHINA: ["HONG KONG"],
  EUROPE: ["EUMETNET"],
};

/** GeoJSON names used when filtering or counting a legend country. */
export function geoCountryNamesForFilter(country: string): string[] {
  const aliases = GEO_COUNTRY_ALIASES[country as CountryName];
  return aliases ? [country, ...aliases] : [country];
}

const COUNTRY_LABELS: Record<string, string> = {
  USA: "United States",
  UK: "United Kingdom",
  UAE: "United Arab Emirates",
  "SOUTH KOREA": "South Korea",
  PNG: "Papua New Guinea",
  EUROPE: "European Union",
  "FAROE IS.": "Faroe Islands",
  "GUINEA-BISSAU": "Guinea-Bissau",
  "MARSHALL IS.": "Marshall Islands",
  "COOK ISLANDS": "Cook Islands",
  "NEW ZEALAND": "New Zealand",
  "SOUTH AFRICA": "South Africa",
  "PUERTO RICO": "Puerto Rico",
  "VIET NAM": "Viet Nam",
  "WALLIS/FUTUNA": "Wallis and Futuna",
};

/** Display label for filter UI (GeoJSON values are often ALL CAPS). */
function titleCaseWords(value: string): string {
  return value
    .split(/(\s+|\/)/)
    .map((part) => {
      if (!part.trim() || part === "/") return part;
      const lower = part.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

export function getCountryLabel(country: CountryName): string {
  const override = COUNTRY_LABELS[country];
  if (override) return override;
  return titleCaseWords(country);
}

/** Display label for a raw GeoJSON `country_name` value. */
export function getGeoCountryLabel(geoName: string): string {
  const upper = geoName.toUpperCase();
  if ((ALL_COUNTRIES as readonly string[]).includes(upper)) {
    return getCountryLabel(upper as CountryName);
  }
  const override = COUNTRY_LABELS[upper];
  if (override) return override;
  return titleCaseWords(upper);
}

export function buildCountryExpression(countries: Iterable<string>): string {
  const values = [...new Set([...countries].flatMap(geoCountryNamesForFilter))];
  if (values.length === 0) return "1=0";

  const list = values
    .map((country) => `'${country.replace(/'/g, "''")}'`)
    .join(", ");

  return `country_name IN (${list})`;
}

function isoCodesForFilterCountries(countries: Iterable<string>): string[] {
  const byGeo = getPartnerDataSnapshot().byGeoCountryName;
  return [
    ...new Set(
      [...countries]
        .map((country) => byGeo[country]?.trim().toUpperCase())
        .filter((iso): iso is string => Boolean(iso && iso.length === 2))
    ),
  ];
}

/** Match one ISO-2 code inside comma-separated `edition_country_codes`. */
function editionCountryCodeMatches(iso: string): string {
  const code = iso.replace(/'/g, "''");
  return `(edition_country_codes = '${code}' OR edition_country_codes LIKE '${code},%' OR edition_country_codes LIKE '%,${code}' OR edition_country_codes LIKE '%,${code},%')`;
}

function dbCountryNamesForFilterCountries(countries: Iterable<string>): string[] {
  const selected = new Set(countries);
  const names: string[] = [];
  for (const record of getPartnerDataSnapshot().countries) {
    if (record.geoCountryNames.some((geo) => selected.has(geo))) {
      names.push(record.name);
    }
  }
  return [...new Set(names)];
}

/** Match one DB country name inside comma-separated `last_cruise_countries`. */
function lastCruiseCountryNameMatches(dbName: string): string {
  const name = dbName.replace(/'/g, "''");
  return `(last_cruise_countries = '${name}' OR last_cruise_countries LIKE '${name},%' OR last_cruise_countries LIKE '%, ${name}' OR last_cruise_countries LIKE '%, ${name},%')`;
}

function lineHasCountryAttribution(): string {
  return `NOT ((edition_country_codes IS NULL OR edition_country_codes = '') AND (last_cruise_countries IS NULL OR last_cruise_countries = ''))`;
}

function lineHasNoCountryAttribution(): string {
  return `((edition_country_codes IS NULL OR edition_country_codes = '') AND (last_cruise_countries IS NULL OR last_cruise_countries = ''))`;
}

function buildCountryMatchParts(countries: Iterable<string>): string[] {
  const isos = isoCodesForFilterCountries(countries);
  const dbNames = dbCountryNamesForFilterCountries(countries);
  const parts: string[] = [];

  if (isos.length === 1) parts.push(editionCountryCodeMatches(isos[0]));
  else if (isos.length > 1) {
    parts.push(`(${isos.map(editionCountryCodeMatches).join(" OR ")})`);
  }

  for (const dbName of dbNames) {
    parts.push(lastCruiseCountryNameMatches(dbName));
  }

  return parts;
}

function buildCountryMatchExpression(countries: Iterable<string>): string | null {
  const parts = buildCountryMatchParts(countries);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `(${parts.join(" OR ")})`;
}

/**
 * GO-SHIP — requires country attribution; match selected countries.
 * Uses exclusion when few countries are deselected (shorter ArcGIS expression).
 */
function buildStrictLineCountryExpression(
  selectedCountries: Iterable<string>,
  filterableCountries: readonly string[]
): string {
  const selectedSet = new Set(selectedCountries);
  const deselected = filterableCountries.filter((country) => !selectedSet.has(country));
  const attribution = lineHasCountryAttribution();

  if (deselected.length <= selectedSet.size) {
    const exclude = buildCountryMatchExpression(deselected);
    if (!exclude) return "1=0";
    return `(${attribution} AND NOT (${exclude}))`;
  }

  const include = buildCountryMatchExpression(selectedSet);
  if (!include) return "1=0";
  return `(${attribution} AND (${include}))`;
}

/** Line-layer country filter — Ocean TraX keeps orphan design lines visible. */
export function buildLineCountryExpression(
  selectedCountries: Iterable<string>,
  filterableCountries: readonly string[],
  layerId: (typeof COUNTRY_FILTER_LINE_LAYER_IDS)[number]
): string {
  const strict = buildStrictLineCountryExpression(selectedCountries, filterableCountries);
  if (layerId === "oceantrax") {
    return `(${strict} OR ${lineHasNoCountryAttribution()})`;
  }
  return strict;
}

export function isAllCountriesSelected(
  selected: ReadonlySet<string>,
  filterableCountries: readonly string[]
): boolean {
  return (
    filterableCountries.length > 0 &&
    filterableCountries.every((country) => selected.has(country))
  );
}

export function applyCountryFilter(
  layerById: Map<string, GeoJSONLayer>,
  selectedCountries: ReadonlySet<string>,
  filterableCountries: readonly string[] = ALL_COUNTRIES
): void {
  const expression = isAllCountriesSelected(selectedCountries, filterableCountries)
    ? ""
    : buildCountryExpression(selectedCountries);

  for (const layerId of COUNTRY_FILTER_LAYER_IDS) {
    const layer = layerById.get(layerId);
    if (layer) layer.definitionExpression = expression;
  }

  const allCountriesSelected = isAllCountriesSelected(
    selectedCountries,
    filterableCountries
  );

  for (const layerId of COUNTRY_FILTER_LINE_LAYER_IDS) {
    const layer = layerById.get(layerId);
    if (!layer) continue;

    if (allCountriesSelected) {
      layer.definitionExpression = "";
    } else if (selectedCountries.size === 0) {
      layer.definitionExpression = "1=0";
    } else {
      layer.definitionExpression = buildLineCountryExpression(
        selectedCountries,
        filterableCountries,
        layerId
      );
    }
  }
}

export function getCountryCountWhere(
  selectedCountries: ReadonlySet<string>,
  filterableCountries: readonly string[] = ALL_COUNTRIES
): string {
  if (isAllCountriesSelected(selectedCountries, filterableCountries)) return "1=1";
  return buildCountryExpression(selectedCountries);
}

export function getLineLayerCountWhere(
  selectedCountries: ReadonlySet<string>,
  filterableCountries: readonly string[],
  layerId: (typeof COUNTRY_FILTER_LINE_LAYER_IDS)[number]
): string {
  if (isAllCountriesSelected(selectedCountries, filterableCountries)) return "1=1";
  if (selectedCountries.size === 0) return "1=0";
  return buildLineCountryExpression(selectedCountries, filterableCountries, layerId);
}
