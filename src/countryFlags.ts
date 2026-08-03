import type { CountryName } from "./countryFilters";
import partnerMeta from "../public/data/partnerCountries.json";

/** ISO 3166-1 alpha-2 for GeoJSON `country_name` (from partner export index). */
export function getCountryIsoCode(country: CountryName): string | undefined {
  const iso = partnerMeta.byGeoCountryName[country as keyof typeof partnerMeta.byGeoCountryName];
  return iso || undefined;
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
