// legend.ts
import type GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import { is3dProjection, type ProjectionId } from "./projections";
import type { ViewHolder } from "./viewHolder";
import { applyMooringStackSymbology } from "./mooringStackSymbology";
import { OCEANTRAX_ACTIVE_DEFINITION } from "./oceanTraxFilter";
import { categories, type Category, isLegendRowCategory, legendLayerIdsForCategory } from "./categories";
import { makeCategorySwatch } from "./categorySwatch";
import {
  EU_COUNTRIES,
  G7_COUNTRIES,
  SIDS_COUNTRIES,
  applyCountryFilter,
  getCountryCountWhere,
  getCountryLabel,
  getLineLayerCountWhere,
  isAllCountriesSelected,
  type CountryName,
  COUNTRY_FILTER_LINE_LAYER_IDS,
} from "./countryFilters";
import {
  getCountryProgramTotalFromMap,
  getFilterableCountryNames,
  getNetworkLegendTotal,
  getNetworkTotalFromPartner,
  getPartnerDataSnapshot,
  loadPartnerCountriesData,
} from "./countryMetrics";
import { LAYER_TO_PARTNER_NETWORK } from "./partnerNetworkMap";
import {
  closeCountryMetricsModal,
  openCountryMetricsModal,
} from "./countryMetricsModal";
import {
  closeGoshipMetricsModal,
  openGoshipMetricsModal,
} from "./goshipMetricsModal";
import {
  closeSoconetMetricsModal,
  openSoconetMetricsModal,
} from "./soconetMetricsModal";
import { appendCountryFlag, getCountryIsoCode } from "./countryFlags";

const BASE = import.meta.env.BASE_URL;

const MENU_TOGGLE_HINT = {
  closed: "Map Legend and Contributing Countries",
  open: "Hide map legend and contributing countries",
} as const;

const menuToggleIconClosed = `
  <svg width="20" height="16" viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="1" y="1" width="18" height="14" rx="2" stroke="#f8f8f8" stroke-width="1.75"/>
    <path d="M7 1V15" stroke="#f8f8f8" stroke-width="1.75"/>
    <path d="M10 5H16" stroke="#f8f8f8" stroke-width="1.75" stroke-linecap="round"/>
    <path d="M10 8H16" stroke="#f8f8f8" stroke-width="1.75" stroke-linecap="round"/>
    <path d="M10 11H14" stroke="#f8f8f8" stroke-width="1.75" stroke-linecap="round"/>
  </svg>
`;

const menuToggleIconOpen = `
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M10 3L5 8L10 13" stroke="#f8f8f8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;

function setMenuToggleState(button: HTMLButtonElement, isOpen: boolean) {
  button.classList.toggle("is-open", isOpen);
  button.setAttribute("aria-expanded", String(isOpen));
  button.setAttribute(
    "aria-label",
    isOpen ? MENU_TOGGLE_HINT.open : MENU_TOGGLE_HINT.closed,
  );
  button.removeAttribute("title");

  const icon = button.querySelector(".o-legend-toggle__icon");
  if (icon) {
    icon.innerHTML = isOpen ? menuToggleIconOpen : menuToggleIconClosed;
  }

  const hint = button.querySelector(".o-legend-toggle__hint");
  if (hint) {
    hint.textContent = isOpen ? MENU_TOGGLE_HINT.open : MENU_TOGGLE_HINT.closed;
  }
}

type ExportMetadata = {
  exportedAt?: string;
  OCEAN_GLIDERS_MIN_LOC_DATE?: string;
  ANIBOS_MIN_LOC_DATE?: string;
  FVON_MIN_LOC_DATE?: string;
  SOOP_XBT_SAMPLED_SINCE?: string;
  GOSHIP_EDITION_SINCE?: string;
  GOSHIP_RECENT_SINCE?: string;
  GOSHIP_SAMPLED_SINCE?: string;
  OBS_PERIOD_UNTIL?: string;
};

async function loadExportMetadata(): Promise<ExportMetadata | null> {
  try {
    const response = await fetch(`${BASE}geojson/export-metadata.json`, {
      cache: "no-cache",
    });
    if (!response.ok) return null;
    return (await response.json()) as ExportMetadata;
  } catch {
    return null;
  }
}

const GROUP_PICTOS: Record<string, string> = {
  country: `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="#f8f8f8" stroke-width="1.5"/>
      <path d="M3 12h18M12 3c2.5 2.8 3.8 6 4 9s-1.5 6.2-4 9M12 3c-2.5 2.8-3.8 6-4 9s1.5 6.2 4 9" stroke="#f8f8f8" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  `,
  networks: `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h6v5H4V6zm10 0h6v5h-6V6zM4 13h6v5H4v-5zm10 0h6v5h-6v-5z" stroke="#f8f8f8" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>
  `,
};

function getGroupPicto(key: string): string {
  return GROUP_PICTOS[key] ?? "";
}

const CHEVRON_ICON = `
  <svg class="o-legend-group-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;

function createCollapsibleGroup(
  parent: HTMLElement,
  options: {
    key: string;
    title: string;
    nested?: boolean;
    startOpen?: boolean;
    onToggle?: (isOpen: boolean) => void;
  }
) {
  const groupSection = document.createElement("div");
  groupSection.className = options.nested
    ? "o-legend-group o-legend-group-nested"
    : "o-legend-group";

  const groupHeader = document.createElement("button");
  groupHeader.type = "button";
  groupHeader.className = "o-legend-group-header";
  groupHeader.setAttribute("aria-expanded", "false");
  const groupPicto = getGroupPicto(options.key);
  groupHeader.innerHTML = `
    ${groupPicto ? `<span class="o-legend-group-icon">${groupPicto}</span>` : ""}
    <span class="o-legend-group-label">${options.title}</span>
    ${CHEVRON_ICON}
  `;

  const groupBody = document.createElement("div");
  groupBody.className = "o-legend-group-body";

  groupHeader.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = groupSection.classList.toggle("open");
    groupHeader.setAttribute("aria-expanded", String(isOpen));
    options.onToggle?.(isOpen);
  });

  groupSection.append(groupHeader, groupBody);
  parent.appendChild(groupSection);

  if (options.startOpen) {
    groupSection.classList.add("open");
    groupHeader.setAttribute("aria-expanded", "true");
  }

  return { groupSection, groupBody };
}

function createCheckboxRow(
  labelText: string,
  className = "o-legend-filter-row"
) {
  const row = document.createElement("label");
  row.className = className;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = true;

  const text = document.createElement("span");
  text.className = "o-legend-filter-row-label";
  text.textContent = labelText;

  row.append(checkbox, text);
  return { row, checkbox, text };
}

const NETWORK_DETAILS_PLUS_ICON = `
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
    <path d="M5.5 2.5v6M2.5 5.5h6" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>
  </svg>
`;

function formatNetworkLegendCount(value: number): string {
  return `(${value.toLocaleString()})`;
}

function createLegendNetworkDetailsBtn(options: {
  ariaLabel: string;
  title: string;
  onOpen: () => void;
}): { button: HTMLButtonElement; count: HTMLSpanElement } {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "o-legend-network-details-btn";
  button.setAttribute("aria-label", options.ariaLabel);
  button.title = options.title;

  const count = document.createElement("span");
  count.className = "o-legend-count o-legend-network-details-count";
  count.textContent = "(…)";
  count.setAttribute("aria-hidden", "true");

  const icon = document.createElement("span");
  icon.className = "o-legend-network-details-icon";
  icon.innerHTML = NETWORK_DETAILS_PLUS_ICON;
  icon.setAttribute("aria-hidden", "true");

  button.append(icon, count);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    options.onOpen();
  });

  return { button, count };
}

function createCountryFilterRow(
  labelText: string,
  geoCountry: CountryName,
  onMetricsOpen: () => void
) {
  const { row, checkbox, text: name } = createCheckboxRow(labelText);
  name.className = "o-legend-country-name";

  const flag = document.createElement("span");
  flag.className = "o-legend-country-flag";
  appendCountryFlag(flag, getCountryIsoCode(geoCountry), labelText);
  row.insertBefore(flag, name);

  const { button: metricsBtn, count: total } = createLegendNetworkDetailsBtn({
    ariaLabel: `View metrics for ${labelText}`,
    title: "View network breakdown",
    onOpen: onMetricsOpen,
  });
  row.appendChild(metricsBtn);

  return { row, checkbox, total, name };
}

/**
 * Build the legend UI, wire up layer toggles, and show feature counts.
 * Pass the `layerById` map you already maintain in main.ts.
 */
export function attachLegend(
  viewHolder: ViewHolder,
  layerById: Map<string, GeoJSONLayer>,
  toggleRotation: () => boolean,
  isRotating: () => boolean,
  setRotationStateChangeCallback: (callback: () => void) => void,
  stopRotation: () => void,
  getProjection: () => ProjectionId,
  onShellLayoutChange?: () => void
) {
  const view = viewHolder.view;
  // nuke any previous legend, backdrop and toggle button
  document.getElementById("legend")?.remove();
  document.getElementById("legend-backdrop")?.remove();
  document.getElementById("legend-toggle")?.remove();
  closeCountryMetricsModal();
  closeGoshipMetricsModal();
  closeSoconetMetricsModal();
  document.body.classList.remove("menu-open");

  // Create toggle button (sidebar panel — clearer icon + hover hint when closed)
  const toggleButton = document.createElement("button");
  toggleButton.id = "legend-toggle";
  toggleButton.type = "button";
  toggleButton.className = "o-legend-toggle";
  toggleButton.innerHTML = `
    <span class="o-legend-toggle__icon">${menuToggleIconClosed}</span>
    <span class="o-legend-toggle__hint">${MENU_TOGGLE_HINT.closed}</span>
  `;
  setMenuToggleState(toggleButton, false);
  view.ui.add(toggleButton, { position: "top-left", index: 0 });

  // Move zoom and compass after the menu button
  // Order: menu (0), zoom (1), compass (2), play/pause (3), satellite (4)
  view.ui.move("zoom", { position: "top-left", index: 1 });
  view.ui.move("compass", { position: "top-left", index: 2 });

  // Create play/pause button for rotation control
  const playPauseButton = document.createElement("button");
  playPauseButton.className = "o-rotation-toggle";
  playPauseButton.title = "Toggle auto-rotation";
  playPauseButton.setAttribute("aria-label", "Toggle auto-rotation");

  const updatePlayPauseIcon = () => {
    if (isRotating()) {
      // Show pause icon
      playPauseButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="3" width="3" height="10" fill="#f8f8f8" rx="1"/>
          <rect x="9" y="3" width="3" height="10" fill="#f8f8f8" rx="1"/>
        </svg>
      `;
    } else {
      // Show play icon
      playPauseButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 3L13 8L5 13V3Z" fill="#f8f8f8"/>
        </svg>
      `;
    }
  };

  updatePlayPauseIcon();

  // Register callback to update UI when rotation state changes
  setRotationStateChangeCallback(updatePlayPauseIcon);

  playPauseButton.addEventListener("click", () => {
    toggleRotation();
    updatePlayPauseIcon();
  });

  view.ui.add(playPauseButton, { position: "top-left", index: 3 });

  const syncRotationControlVisibility = () => {
    const show = is3dProjection(getProjection());
    playPauseButton.style.display = show ? "" : "none";
    if (!show) stopRotation();
  };
  syncRotationControlVisibility();

  // Stop rotation when compass is clicked
  const compass = document.querySelector(".esri-compass") as HTMLElement;
  if (compass) {
    compass.addEventListener("click", () => {
      stopRotation();
    });
  }

  // Create backdrop for mobile
  const backdrop = document.createElement("div");
  backdrop.id = "legend-backdrop";
  backdrop.className = "o-legend-backdrop";
  document.body.appendChild(backdrop);

  // Create legend panel (fixed sidebar)
  const legend = document.createElement("div");
  legend.id = "legend";
  legend.className = "o-legend-panel";

  // Add to document body (not to ArcGIS view.ui)
  document.body.appendChild(legend);

  // Toggle functionality
  const togglePanel = () => {
    const isOpen = legend.classList.contains("open");
    if (isOpen) {
      legend.classList.remove("open");
      backdrop.classList.remove("open");
      document.body.classList.remove("menu-open");
      setMenuToggleState(toggleButton, false);
    } else {
      legend.classList.add("open");
      backdrop.classList.add("open");
      document.body.classList.add("menu-open");
      setMenuToggleState(toggleButton, true);
    }
    onShellLayoutChange?.();
  };

  toggleButton.addEventListener("click", togglePanel);

  // Close menu when clicking on backdrop (mobile)
  backdrop.addEventListener("click", togglePanel);

  const countNodes = new Map<string, HTMLElement>();
  let exportMetadata: ExportMetadata | null = null;
  const layerCheckboxes: HTMLInputElement[] = [];
  const layerCheckboxById = new Map<string, HTMLInputElement>();
  const content = document.createElement("div");
  content.className = "o-legend-content";

  // Create header with logo, title and close button - now inside content
  const header = document.createElement("div");
  header.className = "o-legend-header";
  header.innerHTML = `
    <div class="o-legend-header-content">
      <img src="${BASE}img/oceanops-w.png" alt="OceanOPS" class="o-legend-logo" />
      <div class="o-legend-title">
        <h4>In Situ Networks as Monitored by OceanOPS</h4>
      </div>
    </div>
    <button class="o-legend-close" aria-label="Close menu">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>
  `;
  content.appendChild(header);

  const closeButton = header.querySelector(".o-legend-close") as HTMLButtonElement;
  closeButton.addEventListener("click", togglePanel);

  // Function to update select all checkbox state (defined early)
  const updateSelectAllState = () => {
    const checkedCount = layerCheckboxes.filter(cb => cb.checked).length;
    const totalCount = layerCheckboxes.length;

    if (checkedCount === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    } else if (checkedCount === totalCount) {
      selectAllCheckbox.checked = true;
      selectAllCheckbox.indeterminate = false;
    } else {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = true;
    }
  };

  // Add "Select All" checkbox
  const selectAllRow = document.createElement("label");
  selectAllRow.className = "o-legend-select-all";
  selectAllRow.style.display = "flex";
  selectAllRow.style.alignItems = "center";
  selectAllRow.style.gap = "8px";
  selectAllRow.style.cursor = "pointer";
  selectAllRow.style.fontWeight = "600";

  const selectAllCheckbox = document.createElement("input");
  selectAllCheckbox.type = "checkbox";
  selectAllCheckbox.checked = true;
  selectAllCheckbox.id = "select-all-checkbox";

  const selectAllText = document.createElement("span");
  selectAllText.textContent = "Show/Hide All Networks";
  selectAllText.style.flex = "1";

  selectAllRow.append(selectAllCheckbox, selectAllText);

  // Select all checkbox click handler
  selectAllCheckbox.addEventListener("change", () => {
    const shouldCheck = selectAllCheckbox.checked || selectAllCheckbox.indeterminate;

    layerCheckboxes.forEach(cb => {
      if (cb.checked !== shouldCheck) {
        cb.checked = shouldCheck;
        // Trigger change event to update layer visibility
        cb.dispatchEvent(new Event("change"));
      }
    });

    updateSelectAllState();
  });

  const filterableCountries = getFilterableCountryNames(getPartnerDataSnapshot());
  const filterableCountrySet = new Set<string>(filterableCountries);
  const selectedCountries = new Set<string>(filterableCountries);
  const countryCheckboxRefs = new Map<string, HTMLInputElement[]>();
  const countryTotalNodes = new Map<string, HTMLSpanElement[]>();
  const countryRowWrappers = new Map<string, HTMLElement>();

  const sortedFilterableCountries = [...filterableCountries].sort((a, b) =>
    getCountryLabel(a).localeCompare(getCountryLabel(b))
  );
  const g7Filterable = G7_COUNTRIES.filter((country) =>
    filterableCountrySet.has(country)
  );
  const euFilterable = EU_COUNTRIES.filter((country) =>
    filterableCountrySet.has(country)
  );
  const sidsFilterable = SIDS_COUNTRIES.filter((country) =>
    filterableCountrySet.has(country)
  );

  type CountryListFilter = "all" | "g7" | "eu" | "sids";
  let countryListFilter: CountryListFilter = "all";

  const getVisibleListCountries = (): CountryName[] => {
    if (countryListFilter === "g7") return g7Filterable;
    if (countryListFilter === "eu") return euFilterable;
    if (countryListFilter === "sids") return sidsFilterable;
    return sortedFilterableCountries;
  };

  const syncCountryListVisibility = () => {
    const visible = new Set(getVisibleListCountries());
    for (const country of filterableCountries) {
      const wrapper = countryRowWrappers.get(country);
      if (wrapper) wrapper.hidden = !visible.has(country);
    }
  };

  const registerCountryTotalNode = (country: CountryName, node: HTMLSpanElement) => {
    const refs = countryTotalNodes.get(country) ?? [];
    refs.push(node);
    countryTotalNodes.set(country, refs);
  };

  const setCountryTotalDisplay = (country: CountryName, text: string) => {
    for (const node of countryTotalNodes.get(country) ?? []) {
      node.textContent = text;
    }
  };

  const getVisibleLayerIds = (): Set<string> => {
    const visible = new Set<string>();
    for (const cat of categories) {
      if (!isLegendRowCategory(cat)) continue;
      const cb = layerCheckboxById.get(cat.id);
      if (!cb?.checked) continue;
      for (const layerId of legendLayerIdsForCategory(cat)) {
        visible.add(layerId);
      }
    }
    return visible;
  };

  const updateCountryRowCounts = async () => {
    const visible = getVisibleLayerIds();
    const layers = layerById as Map<string, GeoJSONLayer>;
    for (const country of filterableCountries) {
      if (!countryTotalNodes.has(country)) continue;
      const programTotal = await getCountryProgramTotalFromMap(country, layers, visible);
      setCountryTotalDisplay(country, formatNetworkLegendCount(programTotal));
    }
  };

  const lineLayerIds = new Set<string>(COUNTRY_FILTER_LINE_LAYER_IDS);

  const updateLayerCounts = async () => {
    const where = getCountryCountWhere(selectedCountries, filterableCountries);
    const allCountriesSelected = isAllCountriesSelected(
      selectedCountries,
      filterableCountries
    );

    for (const [id, layer] of layerById) {
      if (id === "soconet_moorings") continue;

      if (lineLayerIds.has(id)) {
        const node = countNodes.get(id);
        if (!node) continue;
        try {
          if (id === "goship" && allCountriesSelected) {
            const networkKey = LAYER_TO_PARTNER_NETWORK[id];
            const total = networkKey
              ? getNetworkTotalFromPartner(networkKey, getPartnerDataSnapshot())
              : 0;
            node.textContent = formatNetworkLegendCount(total);
            node.title = `${total.toLocaleString()} edition cruises (lead program country)`;
            continue;
          }

          if (id === "oceantrax" && allCountriesSelected) {
            const legendTotal = getNetworkLegendTotal(
              "oceantrax",
              getPartnerDataSnapshot()
            );
            if (legendTotal != null) {
              node.textContent = formatNetworkLegendCount(legendTotal);
              node.title = `${legendTotal.toLocaleString()} active OceanTraX lines`;
              continue;
            }
            const canCount =
              typeof (layer as GeoJSONLayer).queryFeatureCount === "function";
            if (!canCount) {
              node.textContent = "";
              continue;
            }
            const active = await (layer as GeoJSONLayer).queryFeatureCount({
              where: OCEANTRAX_ACTIVE_DEFINITION,
            });
            node.textContent = formatNetworkLegendCount(active);
            node.title = `${active.toLocaleString()} active OceanTraX lines`;
            continue;
          }

          const canCount = typeof (layer as GeoJSONLayer).queryFeatureCount === "function";
          if (!canCount) {
            node.textContent = "";
            continue;
          }
          const lineWhere = getLineLayerCountWhere(
            selectedCountries,
            filterableCountries,
            id as "goship" | "oceantrax"
          );
          const n = await (layer as GeoJSONLayer).queryFeatureCount({ where: lineWhere });
          node.textContent = formatNetworkLegendCount(n);
          node.title =
            id === "goship"
              ? `${n.toLocaleString()} lines with edition cruises (selected countries)`
              : `${n.toLocaleString()} active design lines (not filtered by country)`;
        } catch {
          node.textContent = "";
          node.removeAttribute("title");
        }
        continue;
      }

      const canCount = typeof (layer as GeoJSONLayer).queryFeatureCount === "function";
      if (!canCount) {
        const node = countNodes.get(id);
        if (node) node.textContent = "";
        continue;
      }

      try {
        const n = await (layer as GeoJSONLayer).queryFeatureCount({ where });
        let total = n;
        if (id === "soconet") {
          const moorLayer = layerById.get("soconet_moorings");
          if (moorLayer && typeof moorLayer.queryFeatureCount === "function") {
            total += await moorLayer.queryFeatureCount({ where });
          }
        }
        const node = countNodes.get(id);
        if (node) node.textContent = formatNetworkLegendCount(total);
      } catch {
        const node = countNodes.get(id);
        if (node) node.textContent = "";
      }
    }
  };

  const syncCountryCheckboxUI = (country: string) => {
    const checked = selectedCountries.has(country);
    for (const checkbox of countryCheckboxRefs.get(country) ?? []) {
      checkbox.checked = checked;
    }
  };

  const updateCountrySelectAllState = (selectAllCheckbox: HTMLInputElement) => {
    const visibleCountries = getVisibleListCountries();
    const checkedVisible = visibleCountries.filter((country) =>
      selectedCountries.has(country)
    ).length;

    if (checkedVisible === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    } else if (checkedVisible === visibleCountries.length) {
      selectAllCheckbox.checked = true;
      selectAllCheckbox.indeterminate = false;
    } else {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = true;
    }
  };

  const applyCountrySelection = (selectAllCheckbox: HTMLInputElement) => {
    applyCountryFilter(
      layerById as Map<string, GeoJSONLayer>,
      selectedCountries,
      filterableCountries
    );
    updateCountrySelectAllState(selectAllCheckbox);
    updateLayerCounts();
    void updateCountryRowCounts();
  };

  const registerCountryCheckbox = (
    country: CountryName,
    checkbox: HTMLInputElement,
    selectAllCheckbox: HTMLInputElement
  ) => {
    const refs = countryCheckboxRefs.get(country) ?? [];
    refs.push(checkbox);
    countryCheckboxRefs.set(country, refs);

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selectedCountries.add(country);
      else selectedCountries.delete(country);
      syncCountryCheckboxUI(country);
      applyCountrySelection(selectAllCheckbox);
    });
  };

  const addCountryRows = (
    countries: CountryName[],
    container: HTMLElement,
    selectAllCheckbox: HTMLInputElement
  ) => {
    for (const country of countries) {
      const { row, checkbox, total } = createCountryFilterRow(
        getCountryLabel(country),
        country,
        () => {
          void openCountryMetricsModal(
            country,
            getVisibleLayerIds,
            layerById as Map<string, GeoJSONLayer>
          );
        }
      );

      row.setAttribute("data-country", country);
      countryRowWrappers.set(country, row);
      registerCountryTotalNode(country, total);
      registerCountryCheckbox(country, checkbox, selectAllCheckbox);

      container.appendChild(row);
    }
  };

  // Network layers (flat list under Networks — no Ship / Fixed / Mobile sub-headers)
  selectAllRow.classList.add("o-legend-networks-select-all");

  const { groupBody: networksBody } = createCollapsibleGroup(content, {
    key: "networks",
    title: "Networks",
    startOpen: true,
  });
  networksBody.prepend(selectAllRow);

  for (const cat of categories) {
    if (!isLegendRowCategory(cat)) continue;
    const { row, checkbox: cb } = createCheckboxRow(cat.label);

    const swatch = makeCategorySwatch(cat as Category);
    row.insertBefore(swatch, row.children[1]);

    const openGoshipBreakdown = () => {
      const since =
        exportMetadata?.GOSHIP_EDITION_SINCE ??
        exportMetadata?.GOSHIP_SAMPLED_SINCE ??
        "2025-01-01";
      const until =
        exportMetadata?.OBS_PERIOD_UNTIL ??
        exportMetadata?.exportedAt ??
        new Date().toISOString().slice(0, 10);
      void openGoshipMetricsModal(since, until);
    };

    const openSoconetBreakdown = () => {
      const where = getCountryCountWhere(selectedCountries, filterableCountries);
      void openSoconetMetricsModal(
        layerById as Map<string, GeoJSONLayer>,
        where
      );
    };

    let countEl: HTMLSpanElement;
    if (cat.id === "goship") {
      const { button, count } = createLegendNetworkDetailsBtn({
        ariaLabel: "View GO-SHIP decadal reference lines",
        title: "View GO-SHIP decadal reference lines",
        onOpen: openGoshipBreakdown,
      });
      countEl = count;
      row.appendChild(button);
    } else if (cat.id === "soconet") {
      const { button, count } = createLegendNetworkDetailsBtn({
        ariaLabel: "View SOCONET breakdown",
        title: "View SOCONET breakdown (ships + moored buoys)",
        onOpen: openSoconetBreakdown,
      });
      countEl = count;
      row.appendChild(button);
    } else {
      countEl = document.createElement("span");
      countEl.className = "o-legend-count";
      countEl.textContent = "(…)";
      row.appendChild(countEl);
    }
    countNodes.set(cat.id, countEl);

    cb.addEventListener("change", () => {
      for (const layerId of legendLayerIdsForCategory(cat as Category)) {
        const layer = layerById.get(layerId);
        if (layer) (layer as GeoJSONLayer).visible = cb.checked;
      }
      updateSelectAllState();
      updateLayerCounts();
      void updateCountryRowCounts();
      if (is3dProjection(getProjection())) {
        applyMooringStackSymbology(layerById, getProjection());
      }
    });

    layerCheckboxes.push(cb);
    layerCheckboxById.set(cat.id, cb);
    networksBody.appendChild(row);
  }

  const { groupBody: countryBody } = createCollapsibleGroup(content, {
    key: "country",
    title: "Contributing countries",
    startOpen: true,
  });

  const countrySelectAllRow = document.createElement("label");
  countrySelectAllRow.className = "o-legend-select-all o-legend-country-select-all";
  countrySelectAllRow.style.display = "flex";
  countrySelectAllRow.style.alignItems = "center";
  countrySelectAllRow.style.gap = "8px";
  countrySelectAllRow.style.cursor = "pointer";
  countrySelectAllRow.style.fontWeight = "600";

  const countrySelectAllCheckbox = document.createElement("input");
  countrySelectAllCheckbox.type = "checkbox";
  countrySelectAllCheckbox.checked = true;

  const countrySelectAllText = document.createElement("span");
  countrySelectAllText.textContent = "Select all countries";
  countrySelectAllText.style.flex = "1";

  countrySelectAllRow.append(countrySelectAllCheckbox, countrySelectAllText);
  countrySelectAllCheckbox.addEventListener("change", () => {
    const shouldCheck =
      countrySelectAllCheckbox.checked || countrySelectAllCheckbox.indeterminate;
    const visibleCountries = new Set(getVisibleListCountries());

    for (const country of filterableCountries) {
      if (!visibleCountries.has(country)) continue;
      if (shouldCheck) selectedCountries.add(country);
      else selectedCountries.delete(country);
      syncCountryCheckboxUI(country);
    }

    applyCountrySelection(countrySelectAllCheckbox);
  });
  countryBody.appendChild(countrySelectAllRow);

  const countryGroupBtnRow = document.createElement("div");
  countryGroupBtnRow.className = "o-legend-country-group-btns";
  countryGroupBtnRow.setAttribute("role", "group");
  countryGroupBtnRow.setAttribute("aria-label", "Country group filters");

  const allFilterBtn = document.createElement("button");
  allFilterBtn.type = "button";
  allFilterBtn.className = "o-legend-country-group-btn active";
  allFilterBtn.textContent = "All";
  allFilterBtn.setAttribute("aria-pressed", "true");

  const g7FilterBtn = document.createElement("button");
  g7FilterBtn.type = "button";
  g7FilterBtn.className = "o-legend-country-group-btn";
  g7FilterBtn.textContent = "G7";
  g7FilterBtn.setAttribute("aria-pressed", "false");

  const euFilterBtn = document.createElement("button");
  euFilterBtn.type = "button";
  euFilterBtn.className = "o-legend-country-group-btn";
  euFilterBtn.textContent = "EU";
  euFilterBtn.setAttribute("aria-pressed", "false");

  const sidsFilterBtn = document.createElement("button");
  sidsFilterBtn.type = "button";
  sidsFilterBtn.className = "o-legend-country-group-btn";
  sidsFilterBtn.textContent = "SIDS";
  sidsFilterBtn.setAttribute("aria-pressed", "false");
  sidsFilterBtn.title =
    "Small Island Developing States (UN OHRLLS list — contributing countries on this map)";

  const updateCountryGroupFilterButtons = () => {
    allFilterBtn.classList.toggle("active", countryListFilter === "all");
    allFilterBtn.setAttribute("aria-pressed", String(countryListFilter === "all"));
    g7FilterBtn.classList.toggle("active", countryListFilter === "g7");
    g7FilterBtn.setAttribute("aria-pressed", String(countryListFilter === "g7"));
    euFilterBtn.classList.toggle("active", countryListFilter === "eu");
    euFilterBtn.setAttribute("aria-pressed", String(countryListFilter === "eu"));
    sidsFilterBtn.classList.toggle("active", countryListFilter === "sids");
    sidsFilterBtn.setAttribute("aria-pressed", String(countryListFilter === "sids"));
  };

  const applyCountryListFilter = (filter: CountryListFilter) => {
    countryListFilter = filter;
    syncCountryListVisibility();
    updateCountryGroupFilterButtons();

    selectedCountries.clear();
    if (filter === "all") {
      for (const country of filterableCountries) selectedCountries.add(country);
    } else {
      for (const country of getVisibleListCountries()) selectedCountries.add(country);
    }

    for (const country of filterableCountries) syncCountryCheckboxUI(country);
    applyCountrySelection(countrySelectAllCheckbox);
  };

  allFilterBtn.addEventListener("click", () => applyCountryListFilter("all"));
  g7FilterBtn.addEventListener("click", () => applyCountryListFilter("g7"));
  euFilterBtn.addEventListener("click", () => applyCountryListFilter("eu"));
  sidsFilterBtn.addEventListener("click", () => applyCountryListFilter("sids"));

  countryGroupBtnRow.appendChild(allFilterBtn);
  if (g7Filterable.length > 0) countryGroupBtnRow.appendChild(g7FilterBtn);
  if (euFilterable.length > 0) countryGroupBtnRow.appendChild(euFilterBtn);
  if (sidsFilterable.length > 0) countryGroupBtnRow.appendChild(sidsFilterBtn);
  countryBody.appendChild(countryGroupBtnRow);

  const countryList = document.createElement("div");
  countryList.className = "o-legend-country-list";
  countryBody.appendChild(countryList);

  addCountryRows(sortedFilterableCountries, countryList, countrySelectAllCheckbox);

  // Create footer and add it to content (not legend)
  const footer = document.createElement("div");
  footer.className = "o-legend-footer";
  const disclaimer = document.createElement("p");
  disclaimer.className = "o-legend-disclaimer";
  disclaimer.innerHTML =
    'Disclaimer: The depiction and use of boundaries, geographic names and related data shown on the OceanOPS map and included in country lists and tables are not warranted to be error free nor do they imply official endorsement or acceptance by the Intergovernmental Oceanographic Commission of UNESCO and the World Meteorological Organization. Statistics in this report are gradually made more accurate by OceanOPS based on data and metadata availability. Please contact <a href="mailto:support@ocean-ops.org" target="_blank" rel="noopener noreferrer">support@ocean-ops.org</a> for any discrepancies.';
  footer.append(disclaimer);
  content.appendChild(footer);

  void loadExportMetadata().then((metadata) => {
    if (metadata) exportMetadata = metadata;
  });

  legend.appendChild(content);

  void loadPartnerCountriesData()
    .then(() => {
      void updateCountryRowCounts();
      void updateLayerCounts();
    })
    .catch((err) => {
      console.error(err);
      for (const country of filterableCountries) {
        setCountryTotalDisplay(country, "");
      }
    });

  for (const layer of layerById.values()) {
    const when = layer.when?.() ?? Promise.resolve();
    when.then(() => updateLayerCounts());
  }

  syncRotationControlVisibility();
}
