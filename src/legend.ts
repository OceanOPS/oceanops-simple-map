// legend.ts
import type SceneView from "@arcgis/core/views/SceneView";
import type Layer from "@arcgis/core/layers/Layer";
import type GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import { categories } from "./categories";
import {
  ALL_COUNTRIES,
  EU_COUNTRIES,
  G7_COUNTRIES,
  OTHER_COUNTRIES,
  applyCountryFilter,
  getCountryCountWhere,
  getCountryLabel,
  type CountryName,
} from "./countryFilters";

const BASE = import.meta.env.BASE_URL;

const GROUP_PICTOS: Record<string, string> = {
  ship: `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 17h16l-1.8-3.6H5.8L4 17zm3.2-7.2 2.6-4.8h4.4l2.6 4.8H7.2z" fill="#f8f8f8"/>
      <path d="M2 19h20" stroke="#f8f8f8" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  `,
  fixed: `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="10" y="3" width="4" height="13" fill="#f8f8f8"/>
      <path d="M5 18h14" stroke="#f8f8f8" stroke-width="2" stroke-linecap="round"/>
      <path d="M3 20h18" stroke="#f8f8f8" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  `,
  mobile: `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="9" r="5" fill="#f8f8f8"/>
      <path d="M2 19c2.5-2 5-3 10-3s7.5 1 10 3" stroke="#f8f8f8" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  `,
  country: `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="#f8f8f8" stroke-width="1.5"/>
      <path d="M3 12h18M12 3c2.5 2.8 3.8 6 4 9s-1.5 6.2-4 9M12 3c-2.5 2.8-3.8 6-4 9s1.5 6.2 4 9" stroke="#f8f8f8" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  `,
};

const CHEVRON_ICON = `
  <svg class="o-legend-group-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;

/** Inline SVG / IMG swatch that matches each category's symbology */
function makeSwatch(cat: (typeof categories)[number]) {
  const svgNS = "http://www.w3.org/2000/svg";

  // Create container
  const container = document.createElement("div");
  container.className = "o-legend-swatch";
  container.style.cssText = `
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  `;

  if (cat.type === "point") {
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");

    if (cat.shape === "square") {
      const r = document.createElementNS(svgNS, "rect");
      r.setAttribute("x", "2"); r.setAttribute("y", "2");
      r.setAttribute("width", "10"); r.setAttribute("height", "10");
      r.setAttribute("fill", cat.color);
      r.setAttribute("stroke", "#fff"); r.setAttribute("stroke-width", "1");
      svg.appendChild(r);
      container.appendChild(svg);
      return container;
    }

    if (cat.shape === "triangle") {
      const p = document.createElementNS(svgNS, "polygon");
      p.setAttribute("points", "7,2 12,12 2,12");
      p.setAttribute("fill", cat.color);
      p.setAttribute("stroke", "#fff"); p.setAttribute("stroke-width", "1");
      svg.appendChild(p);
      container.appendChild(svg);
      return container;
    }

    // default: circle
    const c = document.createElementNS(svgNS, "circle");
    c.setAttribute("cx", "7"); c.setAttribute("cy", "7"); c.setAttribute("r", "5");
    c.setAttribute("fill", cat.color);
    c.setAttribute("stroke", "#fff"); c.setAttribute("stroke-width", "1");
    svg.appendChild(c);
    container.appendChild(svg);
    return container;
  }

  if (cat.type === "image") {
    const img = document.createElement("img");
    img.src = `${BASE}${cat.imagePath}`;
    img.width = 18; img.height = 18;
    img.style.objectFit = "contain";
    container.appendChild(img);
    return container;
  }

  // line
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "12");
  const line = document.createElementNS(svgNS, "line");
  line.setAttribute("x1", "2"); line.setAttribute("y1", "6");
  line.setAttribute("x2", "18"); line.setAttribute("y2", "6");
  line.setAttribute("stroke", cat.color);
  line.setAttribute("stroke-width", "3");
  line.setAttribute("stroke-linecap", "round");
  svg.appendChild(line);
  container.appendChild(svg);
  return container;
}

function createCollapsibleGroup(
  parent: HTMLElement,
  options: {
    key: string;
    title: string;
    nested?: boolean;
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
  groupHeader.innerHTML = `
    ${GROUP_PICTOS[options.key] ? `<span class="o-legend-group-icon">${GROUP_PICTOS[options.key]}</span>` : ""}
    <span class="o-legend-group-label">${options.title}</span>
    ${CHEVRON_ICON}
  `;

  const groupBody = document.createElement("div");
  groupBody.className = "o-legend-group-body";

  groupHeader.addEventListener("click", () => {
    const isOpen = groupSection.classList.toggle("open");
    groupHeader.setAttribute("aria-expanded", String(isOpen));
    options.onToggle?.(isOpen);
  });

  groupSection.append(groupHeader, groupBody);
  parent.appendChild(groupSection);

  return { groupSection, groupBody };
}

function createCheckboxRow(
  labelText: string,
  className = "o-legend-filter-row"
) {
  const row = document.createElement("label");
  row.className = className;
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.gap = "8px";
  row.style.margin = "12px 0";
  row.style.cursor = "pointer";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = true;

  const text = document.createElement("span");
  text.textContent = labelText;
  text.style.flex = "1";

  row.append(checkbox, text);
  return { row, checkbox, text };
}

/**
 * Build the legend UI, wire up layer toggles, and show feature counts.
 * Pass the `layerById` map you already maintain in main.ts.
 */
export function attachLegend(
  view: SceneView,
  layerById: Map<string, Layer>,
  toggleRotation: () => boolean,
  isRotating: () => boolean,
  setRotationStateChangeCallback: (callback: () => void) => void,
  stopRotation: () => void
) {
  // nuke any previous legend, backdrop and toggle button
  document.getElementById("legend")?.remove();
  document.getElementById("legend-backdrop")?.remove();
  document.getElementById("legend-toggle")?.remove();
  document.body.classList.remove("menu-open");

  // Create toggle button
  const toggleButton = document.createElement("button");
  toggleButton.id = "legend-toggle";
  toggleButton.className = "o-legend-toggle";
  toggleButton.title = "Toggle filters";
  toggleButton.setAttribute("aria-label", "Filtros");
  toggleButton.setAttribute("aria-expanded", "false");
  toggleButton.innerHTML = `
    <svg width="18" height="17" viewBox="0 0 18 17" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.1842 11.9459C11.3767 11.9459 12.3816 12.7232 12.6909 13.7838H18V15.1622H12.6909C12.3816 16.2228 11.3767 17 10.1842 17C8.99173 17 7.9868 16.2228 7.67748 15.1622H0V13.7838H7.67748C7.9868 12.7232 8.99173 11.9459 10.1842 11.9459ZM10.1842 13.3243C9.7972 13.3243 9.45478 13.5053 9.23869 13.7838C9.08961 13.9759 9 14.214 9 14.473C9 14.732 9.08961 14.97 9.23869 15.1622C9.45478 15.4406 9.7972 15.6216 10.1842 15.6216C10.5712 15.6216 10.9136 15.4406 11.1297 15.1622C11.2788 14.97 11.3684 14.732 11.3684 14.473C11.3684 14.214 11.2788 13.9759 11.1297 13.7838C10.9136 13.5053 10.5712 13.3243 10.1842 13.3243ZM4.02632 5.97297C5.2188 5.97297 6.22373 6.75021 6.53305 7.81081H18V9.18919H6.53305C6.22373 10.2498 5.2188 11.027 4.02632 11.027C2.83383 11.027 1.8289 10.2498 1.51958 9.18919H0V7.81081H1.51958C1.8289 6.75021 2.83383 5.97297 4.02632 5.97297ZM4.02632 7.35135C3.37229 7.35135 2.84211 7.86562 2.84211 8.5C2.84211 9.13438 3.37229 9.64865 4.02632 9.64865C4.68034 9.64865 5.21053 9.13438 5.21053 8.5C5.21053 7.86562 4.68034 7.35135 4.02632 7.35135ZM13.9737 0C15.1662 0 16.1711 0.777233 16.4804 1.83784H18V3.21622H16.4804C16.1711 4.27682 15.1662 5.05405 13.9737 5.05405C12.7812 5.05405 11.7763 4.27682 11.467 3.21622H0V1.83784H11.467C11.7763 0.777233 12.7812 0 13.9737 0ZM13.9737 1.37838C13.5867 1.37838 13.2443 1.55936 13.0282 1.83784C12.8791 2.02997 12.7895 2.26804 12.7895 2.52703C12.7895 2.78602 12.8791 3.02409 13.0282 3.21622C13.2443 3.4947 13.5867 3.67568 13.9737 3.67568C14.3607 3.67568 14.7031 3.4947 14.9192 3.21622C15.0683 3.02409 15.1579 2.78602 15.1579 2.52703C15.1579 2.26804 15.0683 2.02997 14.9192 1.83784C14.7031 1.55936 14.3607 1.37838 13.9737 1.37838Z" fill="#184596"/>
    </svg>
  `;
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
      toggleButton.setAttribute("aria-expanded", "false");
    } else {
      legend.classList.add("open");
      backdrop.classList.add("open");
      document.body.classList.add("menu-open");
      toggleButton.setAttribute("aria-expanded", "true");
    }
  };

  toggleButton.addEventListener("click", togglePanel);

  // Close menu when clicking on backdrop (mobile)
  backdrop.addEventListener("click", togglePanel);

  const countNodes = new Map<string, HTMLSpanElement>();
  const layerCheckboxes: HTMLInputElement[] = [];
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
  selectAllText.textContent = "Show/Hide All";
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

  // Add select all row to content (will be added before first group)
  content.appendChild(selectAllRow);

  const selectedCountries = new Set<string>(ALL_COUNTRIES);
  const countryCheckboxRefs = new Map<string, HTMLInputElement[]>();

  const updateLayerCounts = async () => {
    const where = getCountryCountWhere(selectedCountries);

    for (const [id, layer] of layerById) {
      if (id === "goship") {
        const node = countNodes.get(id);
        if (node) node.textContent = " (46)";
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
        const node = countNodes.get(id);
        if (node) node.textContent = ` (${n.toLocaleString()})`;
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
    const checkedCount = selectedCountries.size;
    const totalCount = ALL_COUNTRIES.length;

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

  const applyCountrySelection = (selectAllCheckbox: HTMLInputElement) => {
    applyCountryFilter(layerById as Map<string, GeoJSONLayer>, selectedCountries);
    updateCountrySelectAllState(selectAllCheckbox);
    updateLayerCounts();
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
      const { row, checkbox } = createCheckboxRow(getCountryLabel(country), "o-legend-country-row");
      registerCountryCheckbox(country, checkbox, selectAllCheckbox);
      container.appendChild(row);
    }
  };

  // Define groups: Ship (first 5), Fixed (next 5), Mobile (rest)
  const groups = [
    { key: "ship", title: "Ship", startIndex: 0, endIndex: 5 },
    { key: "fixed", title: "Fixed", startIndex: 5, endIndex: 10 },
    { key: "mobile", title: "Mobile", startIndex: 10, endIndex: categories.length }
  ];

  groups.forEach((group) => {
    const { groupBody } = createCollapsibleGroup(content, {
      key: group.key,
      title: group.title,
    });

    // Add categories in this group
    for (let i = group.startIndex; i < group.endIndex && i < categories.length; i++) {
      const cat = categories[i];
      const { row, checkbox: cb } = createCheckboxRow(cat.label);

      const swatch = makeSwatch(cat);
      row.insertBefore(swatch, row.children[1]);

      const count = document.createElement("span");
      count.textContent = " (…)";
      count.style.opacity = "0.7";
      count.style.fontSize = "12px";
      countNodes.set(cat.id, count);
      row.appendChild(count);

      cb.addEventListener("change", () => {
        const layer = layerById.get(cat.id);
        if (layer) (layer as GeoJSONLayer).visible = cb.checked;
        updateSelectAllState();
      });

      layerCheckboxes.push(cb);
      groupBody.appendChild(row);
    }
  });

  const { groupBody: countryBody } = createCollapsibleGroup(content, {
    key: "country",
    title: "Country",
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

    for (const country of ALL_COUNTRIES) {
      if (shouldCheck) selectedCountries.add(country);
      else selectedCountries.delete(country);
      syncCountryCheckboxUI(country);
    }

    applyCountrySelection(countrySelectAllCheckbox);
  });
  countryBody.appendChild(countrySelectAllRow);

  const countryGroups = [
    { key: "g7", title: "G7", countries: G7_COUNTRIES },
    { key: "eu", title: "EU", countries: EU_COUNTRIES },
    { key: "other", title: "Other", countries: OTHER_COUNTRIES },
  ];

  for (const countryGroup of countryGroups) {
    const { groupBody } = createCollapsibleGroup(countryBody, {
      key: countryGroup.key,
      title: countryGroup.title,
      nested: true,
    });
    addCountryRows(countryGroup.countries, groupBody, countrySelectAllCheckbox);
  }

  // Create footer and add it to content (not legend)
  const footer = document.createElement("div");
  footer.className = "o-legend-footer";
  footer.innerHTML = `
    <p>Latest locations of operational platforms as of October 2025. XBT reference lines sampled since 2024, and sampled GO-SHIP lines since 2015. Data source: OceanOPS.</p>
    <p class="o-legend-disclaimer">Disclaimer: The depiction and use of boundaries, geographic names and related data shown on the OceanOPS map and included in country lists and tables are not warranted to be error free nor do they imply official endorsement or acceptance by the Intergovernmental Oceanographic Commission of UNESCO and the World Meteorological Organization. Statistics in this report are gradually made more accurate by OceanOPS based on data and metadata availability. Please contact <a href="mailto:support@ocean-ops.org" target="_blank" rel="noopener noreferrer">support@ocean-ops.org</a> for any discrepancies.</p>
  `;
  content.appendChild(footer);

  legend.appendChild(content);

  for (const layer of layerById.values()) {
    const when = (layer as GeoJSONLayer).when?.() ?? Promise.resolve();
    when.then(() => updateLayerCounts());
  }
}
