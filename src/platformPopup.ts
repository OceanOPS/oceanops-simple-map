import type { Category } from "./categories";
import { formatCountriesWithFlagsHtml } from "./goshipPopup";
import { countryNamesMatch } from "./lineCrossCountryCruise";
import { isIgnoredGeoCountry, normalizeGeoCountryKey } from "./countryFilters";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hasCountryValue(value: unknown): boolean {
  const text = String(value ?? "").trim();
  return text.length > 0 && !isIgnoredGeoCountry(text);
}

function formatCountryLabelHtml(country: string): string {
  if (!country) return "";
  return formatCountriesWithFlagsHtml(country) || escapeHtml(country);
}

export function platformPopupContent(cat: Category) {
  return ({ graphic }: { graphic: { attributes: Record<string, unknown> } }) => {
    const attrs = graphic.attributes;
    const ptfRef = String(attrs.ptf_ref ?? "").trim();
    const contributingCountry = String(attrs.country_name ?? "").trim();
    const contributingKey = normalizeGeoCountryKey(contributingCountry);
    const contributingCountryHtml = contributingKey
      ? `<p><b>Contributing country:</b> ${formatCountryLabelHtml(contributingKey)}</p>`
      : "";
    const shipCountry = String(attrs.country_ship ?? "").trim();
    const shipCountryHtml =
      hasCountryValue(shipCountry) &&
      !countryNamesMatch(contributingCountry, shipCountry)
        ? `<p><b>Ship country:</b> ${formatCountryLabelHtml(shipCountry)}</p>`
        : "";

    const inspectUrl = ptfRef
      ? `https://www.ocean-ops.org/board/wa/Platform?ref=${encodeURIComponent(ptfRef)}`
      : "";

    return `<div class="o-map-popup">
          <p><b>Type:</b> ${escapeHtml(cat.label)}</p>
          <p><b>Reference:</b> ${escapeHtml(ptfRef)}</p>
          <p><b>Model:</b> ${escapeHtml(String(attrs.ptf_model ?? ""))}</p>
          ${contributingCountryHtml}
          ${shipCountryHtml}
          ${inspectUrl ? `<p><a target="_blank" rel="noopener noreferrer" href="${inspectUrl}">Inspect at OceanOPS</a></p>` : ""}
          </div>`;
  };
}
