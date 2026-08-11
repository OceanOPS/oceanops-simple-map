import type GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import { appendCountryFlag, getCountryIsoCode } from "./countryFlags";
import { getCountryLabel, type CountryName } from "./countryFilters";
import { makeNetworkPicto } from "./categorySwatch";
import {
  getCountryBreakdownFromMap,
  getCountryShipBreakdownFromMap,
  getCountryShipTotalFromMap,
  getCountryTotalFromMap,
  loadPartnerCountriesData,
} from "./countryMetrics";
import type { CountryLayerCount } from "./partnerCountriesData";

const MODAL_ID = "country-metrics-modal";

function removeExistingModal(): void {
  document.getElementById(MODAL_ID)?.remove();
}

export function closeCountryMetricsModal(): void {
  removeExistingModal();
  document.body.classList.remove("o-country-modal-open");
}

function appendBreakdownList(parent: HTMLElement, rows: CountryLayerCount[]): void {
  const list = document.createElement("ul");
  list.className = "o-country-modal-list";

  for (const row of rows) {
    const item = document.createElement("li");
    const picto = makeNetworkPicto(row.layerId);
    const nameSpan = document.createElement("span");
    nameSpan.className = "o-country-modal-network";
    nameSpan.textContent = row.label;
    const countSpan = document.createElement("span");
    countSpan.className = "o-legend-count";
    countSpan.textContent = row.displayCount;
    item.append(picto, nameSpan, countSpan);
    list.appendChild(item);
  }

  parent.appendChild(list);
}

function appendBreakdownSection(
  parent: HTMLElement,
  title: string,
  rows: CountryLayerCount[],
  emptyMessage: string
): void {
  const section = document.createElement("section");
  section.className = "o-country-modal-section";

  const heading = document.createElement("h3");
  heading.className = "o-country-modal-section-title";
  heading.textContent = title;
  section.appendChild(heading);

  if (rows.length === 0) {
    const empty = document.createElement("p");
    empty.className = "o-country-modal-empty";
    empty.textContent = emptyMessage;
    section.appendChild(empty);
  } else {
    appendBreakdownList(section, rows);
  }

  parent.appendChild(section);
}

export async function openCountryMetricsModal(
  country: CountryName,
  getVisibleLayerIds: () => ReadonlySet<string>,
  layerById: Map<string, GeoJSONLayer>
): Promise<void> {
  removeExistingModal();
  document.body.classList.add("o-country-modal-open");

  const label = getCountryLabel(country);

  const backdrop = document.createElement("div");
  backdrop.id = MODAL_ID;
  backdrop.className = "o-country-modal-backdrop";

  const dialog = document.createElement("div");
  dialog.className = "o-country-modal";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "o-country-modal-title");

  const header = document.createElement("header");
  header.className = "o-country-modal-header";

  const titleWrap = document.createElement("div");
  titleWrap.className = "o-country-modal-title-wrap";

  const titleFlag = document.createElement("span");
  titleFlag.className = "o-country-modal-title-flag";
  appendCountryFlag(titleFlag, getCountryIsoCode(country), label);

  const title = document.createElement("h2");
  title.id = "o-country-modal-title";
  title.className = "o-country-modal-title";
  title.textContent = label;

  titleWrap.append(titleFlag, title);

  const totalEl = document.createElement("div");
  totalEl.className = "o-country-modal-totals";
  totalEl.textContent = "Loading totals…";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "o-country-modal-close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  `;

  header.append(titleWrap, closeBtn);

  const body = document.createElement("div");
  body.className = "o-country-modal-body";
  body.innerHTML = `<p class="o-country-modal-loading">Loading network breakdown…</p>`;

  dialog.append(header, totalEl, body);
  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  const close = () => {
    document.removeEventListener("keydown", onKeyDown);
    closeCountryMetricsModal();
  };

  document.addEventListener("keydown", onKeyDown);
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });

  closeBtn.focus();

  try {
    await loadPartnerCountriesData();
    const visible = getVisibleLayerIds();
    const [programTotal, shipTotal, programRows, shipRows] = await Promise.all([
      getCountryTotalFromMap(country, layerById, visible),
      getCountryShipTotalFromMap(country, layerById, visible),
      getCountryBreakdownFromMap(country, layerById, visible),
      getCountryShipBreakdownFromMap(country, layerById, visible),
    ]);

    totalEl.replaceChildren();
    const programLine = document.createElement("p");
    programLine.className = "o-country-modal-total-line";
    programLine.textContent = `${programTotal.toLocaleString()} contributing country platforms`;
    totalEl.appendChild(programLine);

    const shipLine = document.createElement("p");
    shipLine.className = "o-country-modal-total-line o-country-modal-total-line-ship";
    shipLine.textContent =
      shipTotal > 0
        ? `${shipTotal.toLocaleString()} on ships flagged to this country`
        : "No ship-flag deployments on visible networks";
    totalEl.appendChild(shipLine);

    body.replaceChildren();
    appendBreakdownSection(
      body,
      "By contributing country",
      programRows,
      "No platforms for this contributing country on the visible networks."
    );
    appendBreakdownSection(
      body,
      "By ship country",
      shipRows,
      "No platforms on ships flagged to this country on the visible networks."
    );
  } catch {
    totalEl.textContent = "";
    body.innerHTML = `<p class="o-country-modal-empty">Could not load partner country data.</p>`;
  }
}
