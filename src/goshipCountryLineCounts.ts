import type { CountryName } from "./countryFilters";
import { getCountryIsoCode, getIsoCodeForGeoCountry } from "./countryFlags";
import { countryNameMatchesFilter, parseProgramCountryNames } from "./lineCrossCountryCruise";
import { isGoshipSampledLineAttributes } from "./goshipSampledLines";

const BASE = import.meta.env.BASE_URL;

let featureAttributesPromise: Promise<Record<string, unknown>[]> | null = null;

function parseEditionCountryCodes(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
}

function goshipLineMatchesCountry(
  attrs: Record<string, unknown>,
  country: CountryName,
  iso: string
): boolean {
  if (parseEditionCountryCodes(attrs.edition_country_codes).includes(iso)) {
    return true;
  }
  return parseProgramCountryNames(String(attrs.last_cruise_countries ?? "")).some(
    (name) => countryNameMatchesFilter(country, name)
  );
}

async function loadGoshipFeatureAttributes(): Promise<Record<string, unknown>[]> {
  if (!featureAttributesPromise) {
    featureAttributesPromise = (async () => {
      const urls = [
        `${BASE}geojson/goship.geojson`,
        `${BASE}geojson/goship_undensified.geojson`,
      ];
      for (const url of urls) {
        try {
          const response = await fetch(url, { cache: "force-cache" });
          if (!response.ok) continue;
          const geo = (await response.json()) as {
            features?: Array<{ properties?: Record<string, unknown> }>;
          };
          return (geo.features ?? []).map((feature) => feature.properties ?? {});
        } catch {
          continue;
        }
      }
      return [];
    })();
  }
  return featureAttributesPromise;
}

/** Sampled GO-SHIP transect names for a legend country (ignores map country filter). */
export async function listGoshipSampledLineNamesForCountry(
  country: CountryName
): Promise<string[]> {
  const iso = (getCountryIsoCode(country) ?? getIsoCodeForGeoCountry(country))?.toUpperCase();
  if (!iso) return [];

  const attributes = await loadGoshipFeatureAttributes();
  const names = attributes
    .filter(
      (attrs) =>
        isGoshipSampledLineAttributes(attrs) &&
        goshipLineMatchesCountry(attrs, country, iso)
    )
    .map((attrs) => String(attrs.line_name ?? "").trim())
    .filter(Boolean);

  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}
