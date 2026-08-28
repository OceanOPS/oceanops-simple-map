import type { Category } from "./categories";
import { countryFlagUrl, getIsoCodeForGeoCountry } from "./countryFlags";
import {
  getGeoCountryLabel,
  normalizeGeoCountryKey,
} from "./countryFilters";
import {
  formatCruiseDate,
  getEditionCruisesForLine,
  parseShipMaskedFlag,
  type EditionCruiseRow,
} from "./lineEditionCruises";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Comma-separated GeoJSON country names → inline flag + label spans. */
export function formatCountriesWithFlagsHtml(countriesCsv: string): string {
  const seen = new Set<string>();
  const canonicalNames: string[] = [];

  for (const raw of countriesCsv.split(",")) {
    const canonical = normalizeGeoCountryKey(raw.trim());
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    canonicalNames.push(canonical);
  }

  if (canonicalNames.length === 0) return "";

  return canonicalNames
    .map((canonical) => {
      const label = getGeoCountryLabel(canonical);
      const iso = getIsoCodeForGeoCountry(canonical);
      const flag = iso
        ? `<img class="o-legend-country-flag-img o-map-popup-flag" src="${countryFlagUrl(iso)}" width="20" height="15" alt="${escapeHtml(label)} flag" loading="lazy" decoding="async">`
        : "";
      return `<span class="o-map-popup-country">${flag}<span>${escapeHtml(label)}</span></span>`;
    })
    .join('<span class="o-map-popup-country-sep">, </span>');
}

function formatCountryCell(country: string, masked = false): string {
  if (masked) return "Masked";
  const trimmed = country.trim();
  if (!trimmed) return "—";
  return formatCountriesWithFlagsHtml(trimmed) || escapeHtml(trimmed);
}

function formatShipNameCell(cruise: EditionCruiseRow): string {
  if (cruise.ship_masked) return "Masked";
  return cruise.ship_name?.trim() || "—";
}

function formatEditionRowLinkCell(href: string, innerHtml: string): string {
  return `<a class="o-map-popup-edition-cell-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${innerHtml}</a>`;
}

function formatCruisesTableHtml(cruises: EditionCruiseRow[]): string {
  const rows = cruises
    .map((cruise) => {
      const date = formatCruiseDate(cruise.cruise_date);
      const shipName = formatShipNameCell(cruise);
      const cruiseUrl = cruise.cruise_ref
        ? `https://www.ocean-ops.org/board/wa/InspectCruise?ref=${encodeURIComponent(cruise.cruise_ref)}`
        : "";
      const rowClass = cruiseUrl
        ? "o-map-popup-edition-row o-map-popup-edition-row--link"
        : "o-map-popup-edition-row";

      const ref = cruise.cruise_ref || "—";
      const programCell = formatCountryCell(cruise.program_country ?? "");
      const shipCountryCell = formatCountryCell(
        cruise.ship_country ?? "",
        cruise.ship_masked
      );

      if (!cruiseUrl) {
        return `<tr class="${rowClass}">
        <td class="o-map-popup-edition-ref">${escapeHtml(ref)}</td>
        <td>${programCell}</td>
        <td>${escapeHtml(date)}</td>
        <td>${escapeHtml(shipName)}</td>
        <td>${shipCountryCell}</td>
      </tr>`;
      }

      return `<tr class="${rowClass}">
        <td class="o-map-popup-edition-ref">${formatEditionRowLinkCell(cruiseUrl, escapeHtml(ref))}</td>
        <td>${formatEditionRowLinkCell(cruiseUrl, programCell)}</td>
        <td>${formatEditionRowLinkCell(cruiseUrl, escapeHtml(date))}</td>
        <td>${formatEditionRowLinkCell(cruiseUrl, escapeHtml(shipName))}</td>
        <td>${formatEditionRowLinkCell(cruiseUrl, shipCountryCell)}</td>
      </tr>`;
    })
    .join("");

  return `<div class="o-map-popup-edition-table-wrap">
    <table class="o-map-popup-edition-table">
      <thead>
        <tr>
          <th scope="col">Ref</th>
          <th scope="col">Program country</th>
          <th scope="col">Departure date</th>
          <th scope="col">Ship name</th>
          <th scope="col">Ship country</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function latestCruiseRowFromAttrs(
  attrs: Record<string, unknown>
): EditionCruiseRow | null {
  const display = String(attrs.last_cruise_display ?? "").trim();
  if (!display || display === "No cruise recorded") return null;

  const cruiseRef = String(attrs.last_cruise_ref ?? "").trim();

  return {
    cruise_ref: cruiseRef,
    cruise_date: formatCruiseDate(attrs.last_cruise_date, display),
    ship_name: String(attrs.last_cruise_ship ?? "").trim(),
    ship_country: String(attrs.last_cruise_ship_country ?? "").trim(),
    program_country: String(
      attrs.last_cruise_countries || attrs.last_cruise_country || ""
    ).trim(),
    ship_masked: parseShipMaskedFlag(attrs.last_cruise_ship_masked),
  };
}

function renderCruiseSection(
  title: string,
  cruises: EditionCruiseRow[]
): string {
  if (cruises.length === 0) return "";
  return `<section class="o-map-popup-cruise-section">
          <p class="o-map-popup-cruise-section-title">${title}</p>
          ${formatCruisesTableHtml(cruises)}
        </section>`;
}

function resolveCruiseRows(
  attrs: Record<string, unknown>,
  editionCruises: EditionCruiseRow[]
): EditionCruiseRow[] {
  if (editionCruises.length > 0) return editionCruises;
  const latest = latestCruiseRowFromAttrs(attrs);
  return latest ? [latest] : [];
}

function formatLineStatus(status: unknown): string {
  const value = String(status ?? "").trim().toLowerCase();
  if (value === "active") return "Active";
  if (value === "reactivate") return "Reactivate";
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "—";
}

function renderPopupHtml(
  cat: Category,
  attrs: Record<string, unknown>,
  editionCruises: EditionCruiseRow[]
): string {
  const lineName = String(attrs.line_name ?? "");
  const isOceanTrax = cat.id === "oceantrax";
  const cruises = isOceanTrax ? [] : resolveCruiseRows(attrs, editionCruises);
  const sectionTitle =
    editionCruises.length >= 2 ? "Edition cruises" : "Latest cruise";

  const cruiseSectionHtml = isOceanTrax
    ? ""
    : cruises.length > 0
      ? renderCruiseSection(sectionTitle, cruises)
      : '<p class="o-map-popup-last-cruise"><b>Latest cruise:</b> No cruise recorded</p>';

  const networkStatusHtml =
    cat.id === "oceantrax"
      ? `<p><b>Network status:</b> ${escapeHtml(formatLineStatus(attrs.line_status))}</p>`
      : "";

  const lineUrl = `https://www.ocean-ops.org/board/wa/InspectLine?name=${encodeURIComponent(lineName)}`;
  const actionsHtml = `<p class="o-map-popup-actions">
          <a class="o-map-popup-action" target="_blank" rel="noopener noreferrer" href="${lineUrl}">Inspect line</a>
        </p>`;

  return `<div class="o-map-popup">
          <p><b>Type:</b> ${escapeHtml(cat.label)}</p>
          <p><b>Name:</b> ${escapeHtml(lineName)}</p>
          ${networkStatusHtml}
          ${cruiseSectionHtml}
          ${actionsHtml}
          </div>`;
}

export function goshipPopupContent(cat: Category) {
  return async ({
    graphic,
  }: {
    graphic: { attributes: Record<string, unknown> };
  }) => {
    const attrs = graphic.attributes;
    const lineName = String(attrs.line_name ?? "");
    const editionCruises =
      cat.id === "oceantrax"
        ? []
        : await getEditionCruisesForLine(cat.id, lineName, attrs);
    return renderPopupHtml(cat, attrs, editionCruises);
  };
}
