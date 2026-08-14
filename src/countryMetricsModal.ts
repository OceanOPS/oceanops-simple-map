import type GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import { appendCountryFlag, getCountryIsoCode } from "./countryFlags";
import { getCountryLabel, type CountryName } from "./countryFilters";
import { makeNetworkPicto } from "./categorySwatch";
import {
  getCountryBreakdownFromMap,
  getCountrySensorBreakdownFromMap,
  getCountrySensorContributorBreakdownFromMap,
  getCountrySensorTotalFromMap,
  getCountryShipBreakdownFromMap,
  getCountryShipContributorBreakdownFromMap,
  getCountryShipTotalFromMap,
  getCountryTotalFromMap,
  loadPartnerCountriesData,
  type CountryContributorCount,
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

function appendContributorBreakdownList(
  parent: HTMLElement,
  rows: CountryContributorCount[]
): void {
  const list = document.createElement("ul");
  list.className = "o-country-modal-list o-country-modal-list--contributors";

  for (const row of rows) {
    const item = document.createElement("li");

    const flag = document.createElement("span");
    flag.className = "o-country-modal-contributor-flag";
    appendCountryFlag(flag, row.isoCode, row.label);

    const nameSpan = document.createElement("span");
    nameSpan.className = "o-country-modal-network";
    nameSpan.textContent = row.label;

    const countSpan = document.createElement("span");
    countSpan.className = "o-legend-count";
    countSpan.textContent = row.displayCount;

    item.append(flag, nameSpan, countSpan);
    list.appendChild(item);
  }

  parent.appendChild(list);
}

function appendBreakdownSection(
  parent: HTMLElement,
  title: string,
  count: number,
  description: string,
  rows: CountryLayerCount[],
  emptyMessage: string
): void {
  const section = document.createElement("section");
  section.className = "o-country-modal-section";

  const heading = document.createElement("h3");
  heading.className = "o-country-modal-section-title";
  heading.textContent = `${title} (${count.toLocaleString()})`;
  section.appendChild(heading);

  const desc = document.createElement("p");
  desc.className = "o-country-modal-section-desc";
  desc.textContent = description;
  section.appendChild(desc);

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

type BreakdownView = "network" | "country";

function appendToggleBreakdownSection(
  parent: HTMLElement,
  title: string,
  count: number,
  description: string,
  networkRows: CountryLayerCount[],
  contributorRows: CountryContributorCount[],
  emptyMessage: string,
  toggleAriaLabel: string
): void {
  const section = document.createElement("section");
  section.className = "o-country-modal-section";

  const heading = document.createElement("h3");
  heading.className = "o-country-modal-section-title";
  heading.textContent = `${title} (${count.toLocaleString()})`;
  section.appendChild(heading);

  const desc = document.createElement("p");
  desc.className = "o-country-modal-section-desc";
  desc.textContent = description;
  section.appendChild(desc);

  const toggle = document.createElement("div");
  toggle.className = "o-country-modal-view-toggle";
  toggle.setAttribute("role", "tablist");
  toggle.setAttribute("aria-label", toggleAriaLabel);

  const networkBtn = document.createElement("button");
  networkBtn.type = "button";
  networkBtn.className = "o-country-modal-view-btn active";
  networkBtn.setAttribute("role", "tab");
  networkBtn.setAttribute("aria-selected", "true");
  networkBtn.textContent = "By network";

  const countryBtn = document.createElement("button");
  countryBtn.type = "button";
  countryBtn.className = "o-country-modal-view-btn";
  countryBtn.setAttribute("role", "tab");
  countryBtn.setAttribute("aria-selected", "false");
  countryBtn.textContent = "By country";

  toggle.append(networkBtn, countryBtn);
  section.appendChild(toggle);

  const panel = document.createElement("div");
  panel.className = "o-country-modal-view-panel";
  panel.setAttribute("role", "tabpanel");
  section.appendChild(panel);

  let activeView: BreakdownView = "network";

  const renderPanel = () => {
    panel.replaceChildren();
    const rows = activeView === "network" ? networkRows : contributorRows;

    if (rows.length === 0) {
      const empty = document.createElement("p");
      empty.className = "o-country-modal-empty";
      empty.textContent = emptyMessage;
      panel.appendChild(empty);
      return;
    }

    if (activeView === "network") {
      appendBreakdownList(panel, networkRows);
    } else {
      appendContributorBreakdownList(panel, contributorRows);
    }
  };

  const setView = (view: BreakdownView) => {
    activeView = view;
    const isNetwork = view === "network";
    networkBtn.classList.toggle("active", isNetwork);
    countryBtn.classList.toggle("active", !isNetwork);
    networkBtn.setAttribute("aria-selected", String(isNetwork));
    countryBtn.setAttribute("aria-selected", String(!isNetwork));
    renderPanel();
  };

  networkBtn.addEventListener("click", () => setView("network"));
  countryBtn.addEventListener("click", () => setView("country"));

  renderPanel();
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
  body.innerHTML = `<p class="o-country-modal-loading">Loading breakdown…</p>`;

  dialog.append(header, body);
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
    const [
      programTotal,
      shipTotal,
      sensorTotal,
      programRows,
      shipNetworkRows,
      shipContributorRows,
      sensorNetworkRows,
      sensorContributorRows,
    ] = await Promise.all([
      getCountryTotalFromMap(country, layerById, visible),
      getCountryShipTotalFromMap(country, layerById, visible),
      getCountrySensorTotalFromMap(country, layerById, visible),
      getCountryBreakdownFromMap(country, layerById, visible),
      getCountryShipBreakdownFromMap(country, layerById, visible),
      getCountryShipContributorBreakdownFromMap(country, layerById, visible),
      getCountrySensorBreakdownFromMap(country, layerById, visible),
      getCountrySensorContributorBreakdownFromMap(country, layerById, visible),
    ]);

    body.replaceChildren();
    appendBreakdownSection(
      body,
      "Contributing country",
      programTotal,
      "Platforms this country operates or contributes.",
      programRows,
      "None on the selected networks.",
    );
    appendToggleBreakdownSection(
      body,
      "Ships under this flag",
      shipTotal,
      "Platforms deployed from ships flying this flag when the operating country is different (ship time).",
      shipNetworkRows,
      shipContributorRows,
      "No cross-flag deployments on the selected networks.",
      "Ship flag breakdown view",
    );
    appendToggleBreakdownSection(
      body,
      "Sensors from this country",
      sensorTotal,
      "Platforms with sensors provided by this country when the program country is different (cross-program sensors).",
      sensorNetworkRows,
      sensorContributorRows,
      "No cross-program sensors on the selected networks.",
      "Sensor provider breakdown view",
    );
  } catch {
    body.innerHTML = `<p class="o-country-modal-empty">Could not load partner country data.</p>`;
  }
}
