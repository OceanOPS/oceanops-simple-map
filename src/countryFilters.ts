import type GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import { categories } from "./categories";

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
  "EUMETNET",
  "EUROPE",
  "FINLAND",
  "FRANCE",
  "GERMANY",
  "GREECE",
  "HONG KONG",
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
  "THAILAND",
  "TONGA",
  "TUVALU",
  "UAE",
  "UK",
  "UKRAINE",
  "UN",
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
  "EUMETNET",
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
  .filter((cat) => cat.id !== "ship_oceano" && cat.id !== "goship")
  .map((cat) => cat.id);

/** Line layers without `country_name` yet — hidden only when no country is selected (step 2 adds per-line country). */
export const COUNTRY_FILTER_LINE_LAYER_IDS = ["goship", "ship_oceano"] as const;

const COUNTRY_LABELS: Record<string, string> = {
  USA: "United States",
  UK: "United Kingdom",
  UAE: "United Arab Emirates",
  "SOUTH KOREA": "South Korea",
  PNG: "Papua New Guinea",
  EUMETNET: "EUMETNET",
  EUROPE: "Europe",
  "MARSHALL IS.": "Marshall Islands",
  "COOK ISLANDS": "Cook Islands",
  "NEW ZEALAND": "New Zealand",
  "SOUTH AFRICA": "South Africa",
  "PUERTO RICO": "Puerto Rico",
  "HONG KONG": "Hong Kong",
  "VIET NAM": "Viet Nam",
  "WALLIS/FUTUNA": "Wallis and Futuna",
  UN: "United Nations",
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

export function buildCountryExpression(countries: Iterable<string>): string {
  const values = [...countries];
  if (values.length === 0) return "1=0";

  const list = values
    .map((country) => `'${country.replace(/'/g, "''")}'`)
    .join(", ");

  return `country_name IN (${list})`;
}

export function isAllCountriesSelected(
  selected: ReadonlySet<string>,
  expectedCount: number = ALL_COUNTRIES.length
): boolean {
  return selected.size === expectedCount;
}

export function applyCountryFilter(
  layerById: Map<string, GeoJSONLayer>,
  selectedCountries: ReadonlySet<string>
): void {
  const expression = isAllCountriesSelected(selectedCountries)
    ? ""
    : buildCountryExpression(selectedCountries);

  for (const layerId of COUNTRY_FILTER_LAYER_IDS) {
    const layer = layerById.get(layerId);
    if (layer) layer.definitionExpression = expression;
  }

  const lineExpression = selectedCountries.size === 0 ? "1=0" : "";
  for (const layerId of COUNTRY_FILTER_LINE_LAYER_IDS) {
    const layer = layerById.get(layerId);
    if (layer) layer.definitionExpression = lineExpression;
  }
}

export function getCountryCountWhere(selectedCountries: ReadonlySet<string>): string {
  if (isAllCountriesSelected(selectedCountries)) return "1=1";
  return buildCountryExpression(selectedCountries);
}
