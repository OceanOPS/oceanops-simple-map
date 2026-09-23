import type { Category } from "./categories";
import { formatCountriesWithFlagsHtml } from "./goshipPopup";
import { stackNetworkLabels } from "./mooringStacks";
import { countryNamesMatch } from "./lineCrossCountryCruise";
import {
  getContributingCountryLabel,
  isDisplayableGeoCountry,
  isIgnoredGeoCountry,
} from "./countryFilters";
import { countryFlagUrl, getIsoCodeForGeoCountry } from "./countryFlags";

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

function parseSensorProviderCountries(csv: string): string[] {
  const seen = new Set<string>();
  const countries: string[] = [];
  for (const raw of csv.split(",")) {
    const trimmed = raw.trim();
    const key = trimmed.toUpperCase();
    if (!hasCountryValue(trimmed) || seen.has(key)) continue;
    seen.add(key);
    countries.push(trimmed);
  }
  return countries;
}

function crossProgramSensorCountries(
  sensorCsv: string,
  contributingCountry: string
): string[] {
  return parseSensorProviderCountries(sensorCsv).filter(
    (country) => !countryNamesMatch(contributingCountry, country)
  );
}

function formatCountryLabelHtml(country: string, reportingIso?: string): string {
  if (!country) return "";
  const label = getContributingCountryLabel(country, reportingIso);
  const iso =
    reportingIso?.trim().toUpperCase() ||
    getIsoCodeForGeoCountry(country);
  if (iso && iso.length === 2) {
    const flag = `<img class="o-legend-country-flag-img o-map-popup-flag" src="${countryFlagUrl(iso)}" width="20" height="15" alt="${escapeHtml(label)} flag" loading="lazy" decoding="async">`;
    return `<span class="o-map-popup-country">${flag}<span>${escapeHtml(label)}</span></span>`;
  }
  return formatCountriesWithFlagsHtml(country) || escapeHtml(label);
}

function platformCountryFieldsHtml(attrs: Record<string, unknown>): string {
  const contributingCountry = String(attrs.country_name ?? "").trim();
  const reportingIso = String(attrs.country_iso_reporting ?? "").trim();
  const contributingCountryHtml = isDisplayableGeoCountry(contributingCountry)
    ? `<p><b>Contributing country:</b> ${formatCountryLabelHtml(contributingCountry, reportingIso)}</p>`
    : "";
  const shipCountry = String(attrs.country_ship ?? "").trim();
  const shipCountryHtml =
    hasCountryValue(shipCountry) &&
    !countryNamesMatch(contributingCountry, shipCountry)
      ? `<p><b>Ship country:</b> ${formatCountryLabelHtml(shipCountry)}</p>`
      : "";
  const sensorCountries = crossProgramSensorCountries(
    String(attrs.country_sensor_provider ?? ""),
    contributingCountry
  );
  const sensorCountryHtml =
    sensorCountries.length > 0
      ? `<p>In addition to sensors from the contributing country, at least one cross-program sensor from ${formatCountriesWithFlagsHtml(sensorCountries.join(", "))}</p>`
      : "";
  return contributingCountryHtml + shipCountryHtml + sensorCountryHtml;
}

function inspectAtOceanOpsLinksHtml(ptfRef: string): string {
  const refs = ptfRef
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  const unique = [...new Set(refs)];
  if (unique.length === 0) return "";

  const links = unique.map((ref) => {
    const url = `https://www.ocean-ops.org/board/wa/Platform?ref=${encodeURIComponent(ref)}`;
    const label = unique.length === 1 ? "Inspect at OceanOPS" : `Inspect ${escapeHtml(ref)} at OceanOPS`;
    return `<a target="_blank" rel="noopener noreferrer" href="${url}">${label}</a>`;
  });

  return `<p>${links.join("<br>")}</p>`;
}

/** Popup for co-located mooring stacks (multiple networks at one site). */
export function mooringStackPopupContent() {
  return ({ graphic }: { graphic: { attributes: Record<string, unknown> } }) => {
    const attrs = graphic.attributes;
    const stackMask = Number(attrs.stack_mask ?? 0);
    const typeLabels = stackNetworkLabels(stackMask);
    const typeHtml =
      typeLabels.length > 0
        ? typeLabels.map((label) => escapeHtml(label)).join("; ")
        : escapeHtml("Co-located mooring stack");

    const ptfRef = String(attrs.ptf_ref ?? "").trim();
    const inspectHtml = inspectAtOceanOpsLinksHtml(ptfRef);

    return `<div class="o-map-popup">
          <p><b>Type:</b> ${typeHtml}</p>
          ${ptfRef ? `<p><b>Reference:</b> ${escapeHtml(ptfRef)}</p>` : ""}
          <p><b>Model:</b> ${escapeHtml(String(attrs.ptf_model ?? ""))}</p>
          ${platformCountryFieldsHtml(attrs)}
          ${inspectHtml}
          </div>`;
  };
}

export function platformPopupContent(cat: Category) {
  return ({ graphic }: { graphic: { attributes: Record<string, unknown> } }) => {
    const attrs = graphic.attributes;
    const ptfRef = String(attrs.ptf_ref ?? "").trim();

    return `<div class="o-map-popup">
          <p><b>Type:</b> ${escapeHtml(cat.label)}</p>
          ${ptfRef ? `<p><b>Reference:</b> ${escapeHtml(ptfRef)}</p>` : ""}
          <p><b>Model:</b> ${escapeHtml(String(attrs.ptf_model ?? ""))}</p>
          ${platformCountryFieldsHtml(attrs)}
          ${inspectAtOceanOpsLinksHtml(ptfRef)}
          </div>`;
  };
}
