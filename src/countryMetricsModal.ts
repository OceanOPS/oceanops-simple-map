import { appendCountryFlag, getCountryIsoCode } from "./countryFlags";
import { getCountryLabel, type CountryName } from "./countryFilters";
import { makeNetworkPicto } from "./categorySwatch";
import {
  getCountryNetworkBreakdown,
  getCountryTotal,
  loadPartnerCountriesData,
  partnerDataFootnote,
} from "./countryMetrics";

const MODAL_ID = "country-metrics-modal";

function removeExistingModal(): void {
  document.getElementById(MODAL_ID)?.remove();
}

export function closeCountryMetricsModal(): void {
  removeExistingModal();
  document.body.classList.remove("o-country-modal-open");
}

export async function openCountryMetricsModal(
  country: CountryName,
  getVisibleLayerIds: () => ReadonlySet<string>
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

  const totalEl = document.createElement("p");
  totalEl.className = "o-country-modal-total";
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

  const footnote = document.createElement("p");
  footnote.className = "o-country-modal-footnote";
  footnote.textContent = "Loading…";

  dialog.append(header, totalEl, body, footnote);
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
    const data = await loadPartnerCountriesData();
    const visible = getVisibleLayerIds();
    const total = getCountryTotal(country, data, visible);
    const rows = getCountryNetworkBreakdown(country, data, visible);

    footnote.textContent = partnerDataFootnote(data);
    totalEl.textContent = `${total.toLocaleString()} platforms across visible networks`;

    if (rows.length === 0) {
      body.innerHTML =
        `<p class="o-country-modal-empty">No platforms for this country on the visible networks.</p>`;
      return;
    }

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

    body.replaceChildren(list);
  } catch {
    totalEl.textContent = "";
    footnote.textContent = "";
    body.innerHTML = `<p class="o-country-modal-empty">Could not load partner country data.</p>`;
  }
}
