import type { Category } from "./categories";
import { countryFlagUrl, getIsoCodeForGeoCountry } from "./countryFlags";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Comma-separated GeoJSON country names → inline flag + label spans. */
export function formatCountriesWithFlagsHtml(countriesCsv: string): string {
  const parts = countriesCsv
    .split(",")
    .map((s) => s.trim())
    .filter((name) => name && name !== "Unknown");
  if (parts.length === 0) return "";

  return parts
    .map((name) => {
      const iso = getIsoCodeForGeoCountry(name);
      const flag = iso
        ? `<img class="o-legend-country-flag-img o-map-popup-flag" src="${countryFlagUrl(iso)}" width="20" height="15" alt="${escapeHtml(name)} flag" loading="lazy" decoding="async">`
        : "";
      return `<span class="o-map-popup-country">${flag}<span>${escapeHtml(name)}</span></span>`;
    })
    .join('<span class="o-map-popup-country-sep">, </span>');
}

export function goshipPopupContent(cat: Category) {
  return ({ graphic }: { graphic: { attributes: Record<string, unknown> } }) => {
    const attrs = graphic.attributes;
    const lineName = String(attrs.line_name ?? "");
    const lastCruise = String(attrs.last_cruise_display ?? "No cruise recorded");
    const countriesRaw = String(
      attrs.last_cruise_country ||
        attrs.last_cruise_by ||
        attrs.last_cruise_countries ||
        ""
    );
    const countriesHtml = formatCountriesWithFlagsHtml(countriesRaw);

    const lastCruiseBody = countriesHtml
      ? `${escapeHtml(lastCruise)} — ${countriesHtml}`
      : escapeHtml(lastCruise);

    return `<div class="o-map-popup">
          <p><b>Type:</b> ${escapeHtml(cat.label)}</p>
          <p><b>Name:</b> ${escapeHtml(lineName)}</p>
          <p class="o-map-popup-last-cruise"><b>Last cruise:</b> ${lastCruiseBody}</p>
          <p><a target="_blank" rel="noopener noreferrer" href="https://www.ocean-ops.org/board/wa/InspectLine?name=${encodeURIComponent(lineName)}">Inspect at OceanOPS</a></p>
          </div>`;
  };
}
