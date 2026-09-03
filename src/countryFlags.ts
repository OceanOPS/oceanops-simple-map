import type { CountryName } from "./countryFilters";
import { getPartnerDataSnapshot } from "./partnerCountriesData";

/** ISO 3166-1 alpha-2 for GeoJSON `country_name` (from partner export index). */
export function getCountryIsoCode(country: CountryName): string | undefined {
  const iso = getPartnerDataSnapshot().byGeoCountryName[country];
  return iso || undefined;
}

/** ISO code for a raw GeoJSON `country_name`, when mapped in partner export. */
export function getIsoCodeForGeoCountry(geoName: string): string | undefined {
  const key = geoName.trim().toUpperCase();
  if (!key) return undefined;

  const data = getPartnerDataSnapshot();
  const iso = data.byGeoCountryName[key];
  if (iso && iso.length === 2) return iso;

  // OceanOPS DB names (e.g. "United States") vs GeoJSON keys ("USA").
  for (const country of data.countries) {
    if (country.name.toUpperCase() === key) return country.countryCode;
  }

  return undefined;
}

export function countryFlagUrl(isoCode: string, width = 20): string {
  return `https://flagcdn.com/w${width}/${isoCode.toLowerCase()}.png`;
}

export function appendCountryFlag(
  container: HTMLElement,
  isoCode: string | undefined,
  label: string
): void {
  container.replaceChildren();
  if (!isoCode || isoCode.length !== 2) return;

  const img = document.createElement("img");
  img.className = "o-legend-country-flag-img";
  img.src = countryFlagUrl(isoCode);
  img.width = 20;
  img.height = 15;
  img.alt = `${label} flag`;
  img.loading = "lazy";
  img.decoding = "async";
  img.addEventListener("error", () => {
    img.remove();
  });
  container.appendChild(img);
}
