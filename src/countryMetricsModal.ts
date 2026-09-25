import type GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import { appendCountryFlag, getCountryIsoCode } from "./countryFlags";
import { getCountryLabel, type CountryName } from "./countryFilters";
import { makeNetworkPicto } from "./categorySwatch";
import { closeGoshipMetricsModal } from "./goshipMetricsModal";
import { closeSoconetMetricsModal } from "./soconetMetricsModal";
import {
  getCountryBreakdownFromMap,
  getCountryLineCrossCruisePlatformCountryBreakdownFromMap,
  getCountrySensorPlatformCountryBreakdownFromMap,
  getCountrySensorTotalFromMap,
  getCountryShipPlatformCountryBreakdownFromMap,
  getCountryTotalFromMap,
  // groupPlatformCountryRows, // Platform › country view (toggle hidden)
  loadPartnerCountriesData,
  type PlatformCountryCount,
  // type PlatformWithCountries,
} from "./countryMetrics";
import type { CountryLayerCount } from "./partnerCountriesData";

const MODAL_ID = "country-metrics-modal";

const EXPAND_OPEN_LABEL = "−";
const EXPAND_CLOSED_LABEL = "+";

/** Reference observatories (issue #107 popup list). */
const REFERENCE_OBSERVATORY_LAYER_IDS = new Set([
  "oceansites",
  "gloss",
  "goship",
  "soconet",
  "soconet_moorings",
  "oceantrax",
]);

const REFERENCE_OBSERVATORIES_POPUP =
  "OceanSITES, GLOSS, GO-SHIP, SOCONET, OceanTraX";

function splitPlatformAndReferenceCounts(rows: PlatformCountryCount[]): {
  platforms: number;
  referenceObservatories: number;
} {
  let platforms = 0;
  let referenceObservatories = 0;
  for (const row of rows) {
    if (REFERENCE_OBSERVATORY_LAYER_IDS.has(row.layerId)) {
      referenceObservatories += row.count;
    } else {
      platforms += row.count;
    }
  }
  return { platforms, referenceObservatories };
}

function splitLayerCounts(rows: CountryLayerCount[]): {
  platforms: number;
  referenceObservatories: number;
} {
  let platforms = 0;
  let referenceObservatories = 0;
  for (const row of rows) {
    if (REFERENCE_OBSERVATORY_LAYER_IDS.has(row.layerId)) {
      referenceObservatories += row.count;
    } else {
      platforms += row.count;
    }
  }
  return { platforms, referenceObservatories };
}

/** Issue #107 — omit zero counts; reference observatories term has hover list. */
function appendPlatformReferenceCountPhrase(
  parent: HTMLElement,
  platforms: number,
  referenceObservatories: number
): void {
  if (platforms > 0) {
    parent.append(
      `${platforms.toLocaleString()} platform${platforms === 1 ? "" : "s"}`
    );
    if (referenceObservatories > 0) {
      parent.append(" and ");
    }
  }

  if (referenceObservatories > 0) {
    appendReferenceObservatoriesTerm(parent, referenceObservatories);
  }

  if (platforms === 0 && referenceObservatories === 0) {
    parent.append("0 platforms");
  }
}

function mergePlatformCountryRows(
  ...groups: PlatformCountryCount[][]
): PlatformCountryCount[] {
  const merged = new Map<string, PlatformCountryCount>();

  for (const rows of groups) {
    for (const row of rows) {
      const key = `${row.layerId}\0${row.geoCountry}`;
      const existing = merged.get(key);
      if (existing) {
        existing.count += row.count;
        existing.displayCount = ` (${existing.count.toLocaleString()})`;
      } else {
        merged.set(key, { ...row });
      }
    }
  }

  return [...merged.values()].sort(
    (a, b) =>
      b.count - a.count ||
      a.label.localeCompare(b.label) ||
      a.countryLabel.localeCompare(b.countryLabel)
  );
}

function appendReferenceObservatoriesTerm(
  parent: HTMLElement,
  count: number
): void {
  parent.append(`${count.toLocaleString()} `);
  const wrap = document.createElement("span");
  wrap.className = "o-country-modal-ref-obs-term";
  wrap.tabIndex = 0;

  const label = document.createElement("span");
  label.className = "o-country-modal-ref-obs-label";
  label.textContent =
    count === 1 ? "reference observatory" : "reference observatories";

  const hint = document.createElement("span");
  hint.className = "o-country-modal-ref-obs-hint";
  hint.id = `o-country-modal-ref-obs-hint-${Math.random().toString(36).slice(2, 9)}`;
  hint.setAttribute("role", "tooltip");
  REFERENCE_OBSERVATORIES_POPUP.split(", ").forEach((name, index, names) => {
    const item = document.createElement("span");
    item.className = "o-country-modal-ref-obs-hint-item";
    item.textContent = name;
    hint.appendChild(item);
    if (index < names.length - 1) {
      hint.appendChild(document.createTextNode(", "));
    }
  });

  wrap.setAttribute("aria-describedby", hint.id);
  wrap.append(label, hint);
  parent.appendChild(wrap);

  const syncHintPlacement = () => {
    updateReferenceObservatoriesHintPlacement(wrap);
  };
  wrap.addEventListener("mouseenter", syncHintPlacement);
  wrap.addEventListener("focusin", syncHintPlacement);
  requestAnimationFrame(syncHintPlacement);
}

function updateReferenceObservatoriesHintPlacement(wrap: HTMLElement): void {
  const hint = wrap.querySelector(".o-country-modal-ref-obs-hint");
  const body = wrap.closest(".o-country-modal-body");
  if (!hint || !body) return;

  const termRect = wrap.getBoundingClientRect();
  const bodyRect = body.getBoundingClientRect();
  const spaceAbove = termRect.top - bodyRect.top;
  const hintHeight = 52;
  hint.classList.toggle(
    "o-country-modal-ref-obs-hint--below",
    spaceAbove < hintHeight + 14
  );
}

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
    const picto = makeNetworkPicto(row.layerId, "country-modal");
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
  title: string | ((heading: HTMLHeadingElement, count: number) => void),
  count: number,
  description: string | undefined,
  rows: CountryLayerCount[],
  emptyMessage: string
): void {
  const section = document.createElement("section");
  section.className = "o-country-modal-section";

  const heading = document.createElement("h3");
  if (typeof title === "function") {
    title(heading, count);
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

function appendInlineCountryPhrase(
  parent: HTMLElement,
  countryLabel: string,
  isoCode: string | undefined,
  suffix: string
): void {
  const phrase = document.createElement("span");
  phrase.className = "o-country-modal-section-title-phrase";

  const flagWrap = document.createElement("span");
  flagWrap.className = "o-country-modal-section-title-flag";
  appendCountryFlag(flagWrap, isoCode, countryLabel);

  phrase.append(flagWrap, document.createTextNode(` ${countryLabel}${suffix}`));
  parent.appendChild(phrase);
}

function appendOperatedPlatformsSectionTitle(
  heading: HTMLHeadingElement,
  platformRows: CountryLayerCount[],
  countryLabel: string,
  isoCode: string | undefined
): void {
  const { platforms, referenceObservatories } = splitLayerCounts(platformRows);
  heading.className = "o-country-modal-section-title o-country-modal-section-title--inline";
  appendPlatformReferenceCountPhrase(heading, platforms, referenceObservatories);
  heading.append(" operated by ");
  appendInlineCountryPhrase(heading, countryLabel, isoCode, ".");
}

function appendGoosContributionGroup(parent: HTMLElement): HTMLElement {
  const group = document.createElement("div");
  group.className = "o-country-modal-group";

  const header = document.createElement("div");
  header.className = "o-country-modal-group-header";

  const title = document.createElement("h2");
  title.className = "o-country-modal-group-title";
  title.textContent = "International collaboration";

  header.append(title);
  group.appendChild(header);
  parent.appendChild(group);

  return group;
}

type OperatingCountryGroup = {
  geoCountry: string;
  countryLabel: string;
  isoCode?: string;
  total: number;
  networks: PlatformCountryCount[];
};

function groupRowsByOperatingCountry(
  rows: PlatformCountryCount[]
): OperatingCountryGroup[] {
  const byCountry = new Map<string, OperatingCountryGroup>();

  for (const row of rows) {
    let group = byCountry.get(row.geoCountry);
    if (!group) {
      group = {
        geoCountry: row.geoCountry,
        countryLabel: row.countryLabel,
        isoCode: row.isoCode,
        total: 0,
        networks: [],
      };
      byCountry.set(row.geoCountry, group);
    }
    group.total += row.count;
    group.networks.push(row);
  }

  for (const group of byCountry.values()) {
    group.networks.sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label)
    );
  }

  return [...byCountry.values()].sort(
    (a, b) =>
      b.total - a.total || a.countryLabel.localeCompare(b.countryLabel)
  );
}

function appendCountryGroupedCollaborationList(
  parent: HTMLElement,
  rows: PlatformCountryCount[]
): void {
  const groups = groupRowsByOperatingCountry(rows);
  const list = document.createElement("ul");
  list.className =
    "o-country-modal-list o-country-modal-list--expandable o-country-modal-list--by-country";

  groups.forEach((group, index) => {
    const block = document.createElement("li");
    block.className = "o-country-modal-country-block";

    const header = document.createElement("div");
    header.className = "o-country-modal-country-header";

    const expandBtn = document.createElement("button");
    expandBtn.type = "button";
    expandBtn.className = "o-country-modal-expand-btn";
    expandBtn.setAttribute("aria-expanded", index === 0 ? "true" : "false");
    expandBtn.setAttribute(
      "aria-label",
      index === 0
        ? `Hide networks for ${group.countryLabel}`
        : `Show networks for ${group.countryLabel}`
    );
    expandBtn.textContent = index === 0 ? EXPAND_OPEN_LABEL : EXPAND_CLOSED_LABEL;

    const flag = document.createElement("span");
    flag.className = "o-country-modal-contributor-flag";
    flag.setAttribute("title", group.countryLabel);
    flag.setAttribute("aria-label", group.countryLabel);
    appendCountryFlag(flag, group.isoCode, group.countryLabel);

    const nameSpan = document.createElement("span");
    nameSpan.className = "o-country-modal-country-name";
    nameSpan.textContent = group.countryLabel;

    const totalSpan = document.createElement("span");
    totalSpan.className = "o-legend-count o-country-modal-country-total";
    totalSpan.textContent = group.total.toLocaleString();

    header.append(expandBtn, flag, nameSpan, totalSpan);

    const networks = document.createElement("ul");
    networks.className = "o-country-modal-country-networks";
    networks.hidden = index !== 0;

    for (const row of group.networks) {
      const item = document.createElement("li");
      item.className = "o-country-modal-country-network-row";

      const pictoSlot = document.createElement("span");
      pictoSlot.className = "o-country-modal-emanuela-picto-slot";
      pictoSlot.appendChild(makeNetworkPicto(row.layerId, "country-modal"));

      const label = document.createElement("span");
      label.className = "o-country-modal-emanuela-network-label";
      label.textContent = row.label;

      const count = document.createElement("span");
      count.className = "o-legend-count o-country-modal-country-network-count";
      count.textContent = row.count.toLocaleString();

      item.append(pictoSlot, label, count);
      networks.appendChild(item);
    }

    const toggle = () => {
      const isOpen = block.classList.toggle("open");
      networks.hidden = !isOpen;
      expandBtn.textContent = isOpen ? EXPAND_OPEN_LABEL : EXPAND_CLOSED_LABEL;
      expandBtn.setAttribute("aria-expanded", String(isOpen));
      expandBtn.setAttribute(
        "aria-label",
        isOpen
          ? `Hide networks for ${group.countryLabel}`
          : `Show networks for ${group.countryLabel}`
      );
    };

    expandBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggle();
    });
    header.addEventListener("click", toggle);

    if (index === 0) block.classList.add("open");

    block.append(header, networks);
    list.appendChild(block);
  });

  parent.appendChild(list);
}

/** Kept while Platform › country toggle is hidden. */
export function appendExpandablePlatformList(
  parent: HTMLElement,
  platforms: import("./countryMetrics").PlatformWithCountries[]
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

    const picto = makeNetworkPicto(platform.layerId, "country-modal");
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

function appendInternationalCollaborationSectionTitle(
  heading: HTMLHeadingElement,
  rows: PlatformCountryCount[],
  variant: "ship" | "sensor",
  countryLabel: string,
  isoCode: string | undefined
): void {
  const { platforms, referenceObservatories } =
    splitPlatformAndReferenceCounts(rows);

  heading.className = "o-country-modal-section-title o-country-modal-section-title--inline";

  const middle =
    variant === "ship"
      ? " deployed by research ships of "
      : " equipped with sensors provided by ";
  const suffix = " and operated by other countries.";

  appendPlatformReferenceCountPhrase(heading, platforms, referenceObservatories);
  heading.append(middle);
  appendInlineCountryPhrase(heading, countryLabel, isoCode, suffix);
}

function appendToggleBreakdownSection(
  parent: HTMLElement,
  title: string | ((heading: HTMLHeadingElement) => void),
  count: number,
  description: string | undefined,
  platformCountryRows: PlatformCountryCount[],
  emptyMessage: string,
  _toggleAriaLabel: string
): void {
  if (count === 0) return;

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

  // View toggle hidden — keep flattable table only (Platform › country view commented out).
  /*
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
  emanuelaBtn.textContent = "Flattable Platform / Country";

  toggle.append(platformBtn, emanuelaBtn);
  section.appendChild(toggle);
  */

  const panel = document.createElement("div");
  panel.className = "o-country-modal-view-panel";
  panel.setAttribute("role", "tabpanel");
  section.appendChild(panel);

  // const platforms = groupPlatformCountryRows(platformCountryRows);
  // let activeView: BreakdownView = "emanuela";

  const renderPanel = () => {
    panel.replaceChildren();

    if (platformCountryRows.length === 0) {
      const empty = document.createElement("p");
      empty.className = "o-country-modal-empty";
      empty.textContent = emptyMessage;
      panel.appendChild(empty);
      return;
    }

    appendCountryGroupedCollaborationList(panel, platformCountryRows);
  };

  /*
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
  */

  renderPanel();
  parent.appendChild(section);
}

export async function openCountryMetricsModal(
  country: CountryName,
  getVisibleLayerIds: () => ReadonlySet<string>,
  layerById: Map<string, GeoJSONLayer>
): Promise<void> {
  closeGoshipMetricsModal();
  closeSoconetMetricsModal();
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
      platformTotal,
      sensorTotal,
      platformRows,
      shipPlatformCountryRows,
      lineCrossCruisePlatformCountryRows,
      sensorPlatformCountryRows,
    ] = await Promise.all([
      getCountryTotalFromMap(country, layerById, visible),
      getCountrySensorTotalFromMap(country, layerById, visible),
      getCountryBreakdownFromMap(country, layerById, visible),
      getCountryShipPlatformCountryBreakdownFromMap(country, layerById, visible),
      getCountryLineCrossCruisePlatformCountryBreakdownFromMap(
        country,
        layerById,
        visible
      ),
      getCountrySensorPlatformCountryBreakdownFromMap(country, layerById, visible),
    ]);

    const shipCollaborationRows = mergePlatformCountryRows(
      shipPlatformCountryRows,
      lineCrossCruisePlatformCountryRows
    );
    const shipCollaborationTotal = shipCollaborationRows.reduce(
      (sum, row) => sum + row.count,
      0
    );

    body.replaceChildren();
    appendBreakdownSection(
      body,
      (heading) =>
        appendOperatedPlatformsSectionTitle(
          heading,
          platformRows,
          label,
          getCountryIsoCode(country)
        ),
      platformTotal,
      undefined,
      platformRows,
      "None on the selected networks.",
    );

    const goosGroup =
      shipCollaborationTotal > 0 || sensorTotal > 0
        ? appendGoosContributionGroup(body)
        : null;

    if (goosGroup && shipCollaborationTotal > 0) {
      appendToggleBreakdownSection(
        goosGroup,
        (heading) =>
          appendInternationalCollaborationSectionTitle(
            heading,
            shipCollaborationRows,
            "ship",
            label,
            getCountryIsoCode(country)
          ),
        shipCollaborationTotal,
        undefined,
        shipCollaborationRows,
        "No cross-flag deployments on the selected networks.",
        "Ship flag breakdown view",
      );
    }
    if (goosGroup && sensorTotal > 0) {
      appendToggleBreakdownSection(
        goosGroup,
        (heading) =>
          appendInternationalCollaborationSectionTitle(
            heading,
            sensorPlatformCountryRows,
            "sensor",
            label,
            getCountryIsoCode(country)
          ),
        sensorTotal,
        undefined,
        sensorPlatformCountryRows,
        "No cross-program sensors on the selected networks.",
        "Sensor provider breakdown view",
      );
    }
  } catch {
    body.innerHTML = `<p class="o-country-modal-empty">Could not load partner country data.</p>`;
  }
}
