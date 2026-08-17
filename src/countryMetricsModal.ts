import type GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import { appendCountryFlag, getCountryIsoCode } from "./countryFlags";
import { getCountryLabel, type CountryName } from "./countryFilters";
import { makeNetworkPicto } from "./categorySwatch";
import {
  getCountryBreakdownFromMap,
  getCountrySensorPlatformCountryBreakdownFromMap,
  getCountrySensorTotalFromMap,
  getCountryShipPlatformCountryBreakdownFromMap,
  getCountryShipTotalFromMap,
  getCountryTotalFromMap,
  groupPlatformCountryRows,
  loadPartnerCountriesData,
  type PlatformCountryCount,
  type PlatformWithCountries,
} from "./countryMetrics";
import type { CountryLayerCount } from "./partnerCountriesData";

const MODAL_ID = "country-metrics-modal";

const EXPAND_OPEN_LABEL = "−";
const EXPAND_CLOSED_LABEL = "+";

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

function appendGoosContributionGroup(parent: HTMLElement): HTMLElement {
  const group = document.createElement("div");
  group.className = "o-country-modal-group";

  const header = document.createElement("div");
  header.className = "o-country-modal-group-header";

  const title = document.createElement("h2");
  title.className = "o-country-modal-group-title";
  title.textContent = "Countries collaboration";

  header.append(title);
  group.appendChild(header);
  parent.appendChild(group);

  return group;
}

type BreakdownView = "platformCountry" | "emanuela";

function appendEmanuelaTable(parent: HTMLElement, rows: PlatformCountryCount[]): void {
  const table = document.createElement("table");
  table.className = "o-country-modal-emanuela-table";

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th scope="col">Count</th>
      <th scope="col">Platform</th>
      <th scope="col">Country</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  for (const row of rows) {
    const tr = document.createElement("tr");

    const countCell = document.createElement("td");
    countCell.className = "o-country-modal-emanuela-count";
    countCell.textContent = row.count.toLocaleString();

    const platformCell = document.createElement("td");
    platformCell.className = "o-country-modal-emanuela-platform";
    const picto = makeNetworkPicto(row.layerId);
    const platformName = document.createElement("span");
    platformName.textContent = row.label;
    platformCell.append(picto, platformName);

    const countryCell = document.createElement("td");
    countryCell.className = "o-country-modal-emanuela-country";
    const flag = document.createElement("span");
    flag.className = "o-country-modal-contributor-flag";
    flag.setAttribute("title", row.countryLabel);
    flag.setAttribute("aria-label", row.countryLabel);
    appendCountryFlag(flag, row.isoCode, row.countryLabel);
    countryCell.appendChild(flag);

    tr.append(countCell, platformCell, countryCell);
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  parent.appendChild(table);
}

function appendExpandablePlatformList(
  parent: HTMLElement,
  platforms: PlatformWithCountries[]
): void {
  const list = document.createElement("ul");
  list.className = "o-country-modal-list o-country-modal-list--expandable";

  for (const platform of platforms) {
    const block = document.createElement("li");
    block.className = "o-country-modal-platform-block";

    const header = document.createElement("div");
    header.className = "o-country-modal-platform-header";

    const expandBtn = document.createElement("button");
    expandBtn.type = "button";
    expandBtn.className = "o-country-modal-expand-btn";
    expandBtn.setAttribute("aria-expanded", "false");
    expandBtn.setAttribute("aria-label", `Show countries for ${platform.label}`);
    expandBtn.textContent = EXPAND_CLOSED_LABEL;

    const picto = makeNetworkPicto(platform.layerId);
    const nameSpan = document.createElement("span");
    nameSpan.className = "o-country-modal-network";
    nameSpan.textContent = platform.label;

    const countSpan = document.createElement("span");
    countSpan.className = "o-legend-count";
    countSpan.textContent = platform.displayCount;

    header.append(picto, nameSpan, countSpan, expandBtn);

    const children = document.createElement("ul");
    children.className = "o-country-modal-platform-countries";
    children.hidden = true;

    for (const country of platform.countries) {
      const child = document.createElement("li");

      const flag = document.createElement("span");
      flag.className = "o-country-modal-contributor-flag";
      appendCountryFlag(flag, country.isoCode, country.label);

      const countryName = document.createElement("span");
      countryName.className = "o-country-modal-network";
      countryName.textContent = country.label;

      const childCount = document.createElement("span");
      childCount.className = "o-legend-count";
      childCount.textContent = country.displayCount;

      child.append(flag, countryName, childCount);
      children.appendChild(child);
    }

    expandBtn.addEventListener("click", () => {
      const isOpen = block.classList.toggle("open");
      children.hidden = !isOpen;
      expandBtn.textContent = isOpen ? EXPAND_OPEN_LABEL : EXPAND_CLOSED_LABEL;
      expandBtn.setAttribute("aria-expanded", String(isOpen));
      expandBtn.setAttribute(
        "aria-label",
        isOpen ? `Hide countries for ${platform.label}` : `Show countries for ${platform.label}`
      );
    });

    block.append(header, children);
    list.appendChild(block);
  }

  parent.appendChild(list);
}

function appendShipFlagSectionTitle(
  heading: HTMLHeadingElement,
  count: number,
  countryLabel: string,
  isoCode: string | undefined
): void {
  heading.className = "o-country-modal-section-title o-country-modal-section-title--inline";
  heading.append(`${count.toLocaleString()} Operational platforms deployed from `);

  const flagWrap = document.createElement("span");
  flagWrap.className = "o-country-modal-section-title-flag";
  appendCountryFlag(flagWrap, isoCode, countryLabel);
  heading.append(flagWrap, document.createTextNode(` ${countryLabel} ships`));
}

function appendSensorProviderSectionTitle(
  heading: HTMLHeadingElement,
  count: number,
  countryLabel: string,
  isoCode: string | undefined
): void {
  heading.className = "o-country-modal-section-title o-country-modal-section-title--inline";
  heading.append(`${count.toLocaleString()} Operational platforms with sensors provided by `);

  const flagWrap = document.createElement("span");
  flagWrap.className = "o-country-modal-section-title-flag";
  appendCountryFlag(flagWrap, isoCode, countryLabel);
  heading.append(flagWrap, document.createTextNode(` ${countryLabel}`));
}

function appendToggleBreakdownSection(
  parent: HTMLElement,
  title: string | ((heading: HTMLHeadingElement) => void),
  count: number,
  description: string | undefined,
  platformCountryRows: PlatformCountryCount[],
  emptyMessage: string,
  toggleAriaLabel: string
): void {
  const section = document.createElement("section");
  section.className = "o-country-modal-section";

  const heading = document.createElement("h3");
  if (typeof title === "function") {
    title(heading);
  } else {
    heading.className = "o-country-modal-section-title";
    heading.textContent = `${title} (${count.toLocaleString()})`;
  }
  section.appendChild(heading);

  if (description) {
    const desc = document.createElement("p");
    desc.className = "o-country-modal-section-desc";
    desc.textContent = description;
    section.appendChild(desc);
  }

  const toggle = document.createElement("div");
  toggle.className = "o-country-modal-view-toggle";
  toggle.setAttribute("role", "tablist");
  toggle.setAttribute("aria-label", toggleAriaLabel);

  const platformBtn = document.createElement("button");
  platformBtn.type = "button";
  platformBtn.className = "o-country-modal-view-btn active";
  platformBtn.setAttribute("role", "tab");
  platformBtn.setAttribute("aria-selected", "true");
  platformBtn.textContent = "Platform › country";

  const emanuelaBtn = document.createElement("button");
  emanuelaBtn.type = "button";
  emanuelaBtn.className = "o-country-modal-view-btn";
  emanuelaBtn.setAttribute("role", "tab");
  emanuelaBtn.setAttribute("aria-selected", "false");
  emanuelaBtn.textContent = "Emanuela proposition";

  toggle.append(platformBtn, emanuelaBtn);
  section.appendChild(toggle);

  const panel = document.createElement("div");
  panel.className = "o-country-modal-view-panel";
  panel.setAttribute("role", "tabpanel");
  section.appendChild(panel);

  const platforms = groupPlatformCountryRows(platformCountryRows);
  let activeView: BreakdownView = "platformCountry";

  const renderPanel = () => {
    panel.replaceChildren();

    if (platformCountryRows.length === 0) {
      const empty = document.createElement("p");
      empty.className = "o-country-modal-empty";
      empty.textContent = emptyMessage;
      panel.appendChild(empty);
      return;
    }

    if (activeView === "platformCountry") {
      appendExpandablePlatformList(panel, platforms);
    } else {
      appendEmanuelaTable(panel, platformCountryRows);
    }
  };

  const setView = (view: BreakdownView) => {
    activeView = view;
    const isPlatform = view === "platformCountry";
    platformBtn.classList.toggle("active", isPlatform);
    emanuelaBtn.classList.toggle("active", !isPlatform);
    platformBtn.setAttribute("aria-selected", String(isPlatform));
    emanuelaBtn.setAttribute("aria-selected", String(!isPlatform));
    renderPanel();
  };

  platformBtn.addEventListener("click", () => setView("platformCountry"));
  emanuelaBtn.addEventListener("click", () => setView("emanuela"));

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
      shipPlatformCountryRows,
      sensorPlatformCountryRows,
    ] = await Promise.all([
      getCountryTotalFromMap(country, layerById, visible),
      getCountryShipTotalFromMap(country, layerById, visible),
      getCountrySensorTotalFromMap(country, layerById, visible),
      getCountryBreakdownFromMap(country, layerById, visible),
      getCountryShipPlatformCountryBreakdownFromMap(country, layerById, visible),
      getCountrySensorPlatformCountryBreakdownFromMap(country, layerById, visible),
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

    const goosGroup = appendGoosContributionGroup(body);
    appendToggleBreakdownSection(
      goosGroup,
      (heading) =>
        appendShipFlagSectionTitle(
          heading,
          shipTotal,
          label,
          getCountryIsoCode(country)
        ),
      shipTotal,
      undefined,
      shipPlatformCountryRows,
      "No cross-flag deployments on the selected networks.",
      "Ship flag breakdown view",
    );
    appendToggleBreakdownSection(
      goosGroup,
      (heading) =>
        appendSensorProviderSectionTitle(
          heading,
          sensorTotal,
          label,
          getCountryIsoCode(country)
        ),
      sensorTotal,
      undefined,
      sensorPlatformCountryRows,
      "No cross-program sensors on the selected networks.",
      "Sensor provider breakdown view",
    );
  } catch {
    body.innerHTML = `<p class="o-country-modal-empty">Could not load partner country data.</p>`;
  }
}
