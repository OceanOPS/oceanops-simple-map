import type { Category } from "./categories";
import { countryFlagUrl, getIsoCodeForGeoCountry } from "./countryFlags";
import { isCrossCountryCruise } from "./lineCrossCountryCruise";

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

function formatLastCruiseCountriesHtml(attrs: Record<string, unknown>): string {
  const shipCountry = String(attrs.last_cruise_ship_country ?? "").trim();
  const cruiseCountriesRaw = String(
    attrs.last_cruise_countries || attrs.last_cruise_country || ""
  ).trim();

  if (isCrossCountryCruise(shipCountry, cruiseCountriesRaw)) {
    const byHtml = formatCountriesWithFlagsHtml(shipCountry);
    const forHtml = formatCountriesWithFlagsHtml(cruiseCountriesRaw);
    return `<span class="o-map-popup-cross-country">by ${byHtml} for ${forHtml}</span>`;
  }

  return formatCountriesWithFlagsHtml(cruiseCountriesRaw);
}

export function goshipPopupContent(cat: Category) {
  return ({ graphic }: { graphic: { attributes: Record<string, unknown> } }) => {
    const attrs = graphic.attributes;
    const lineName = String(attrs.line_name ?? "");
    const lastCruise = String(attrs.last_cruise_display ?? "No cruise recorded");
    const countriesHtml = formatLastCruiseCountriesHtml(attrs);

    const lastCruiseBody = countriesHtml
      ? `${escapeHtml(lastCruise)} — ${countriesHtml}`
      : escapeHtml(lastCruise);

    const cruiseRef = String(attrs.last_cruise_ref ?? "").trim();
    const lineUrl = `https://www.ocean-ops.org/board/wa/InspectLine?name=${encodeURIComponent(lineName)}`;
    const cruiseUrl = cruiseRef
      ? `https://www.ocean-ops.org/board/wa/InspectCruise?ref=${encodeURIComponent(cruiseRef)}`
      : "";

    const actionsHtml = cruiseUrl
      ? `<p class="o-map-popup-actions">
          <a class="o-map-popup-action" target="_blank" rel="noopener noreferrer" href="${lineUrl}">Inspect line</a>
          <a class="o-map-popup-action" target="_blank" rel="noopener noreferrer" href="${cruiseUrl}">Inspect cruise</a>
        </p>`
      : `<p class="o-map-popup-actions">
          <a class="o-map-popup-action" target="_blank" rel="noopener noreferrer" href="${lineUrl}">Inspect line</a>
        </p>`;

    return `<div class="o-map-popup">
          <p><b>Type:</b> ${escapeHtml(cat.label)}</p>
          <p><b>Name:</b> ${escapeHtml(lineName)}</p>
          <p class="o-map-popup-last-cruise"><b>Latest cruise:</b> ${lastCruiseBody}</p>
          ${actionsHtml}
          </div>`;
  };
}
