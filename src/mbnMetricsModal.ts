import type GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import { categories, type Category } from "./categories";
import { makeCategorySwatch } from "./categorySwatch";
import { closeCountryMetricsModal } from "./countryMetricsModal";
import { closeGoshipMetricsModal } from "./goshipMetricsModal";
import {
  appendMbnTierToFeatureWhere,
  type MbnGoosTier,
} from "./mooringBuoyGoosTier";
import { queryMooringLayerCount } from "./mooringStacks";
import { makeNetworkIconImg } from "./networkIcons";
import { closeSoconetMetricsModal } from "./soconetMetricsModal";

const MODAL_ID = "mbn-metrics-modal";

const TIER_ROWS: Array<{
  tier: MbnGoosTier;
  label: string;
}> = [
  {
    tier: "tropical",
    label:
      "Tropical moored buoys – MBN subcomponent, part of the global arrays",
  },
  {
    tier: "coastal",
    label:
      "Coastal and National moored buoys – MBN subcomponent, part of regional systems",
  },
];

function removeExistingModal(): void {
  document.getElementById(MODAL_ID)?.remove();
}

export function closeMbnMetricsModal(): void {
  removeExistingModal();
  document.body.classList.remove("o-country-modal-open");
}

function mooredBuoysCategory(): Category | undefined {
  return categories.find((cat) => cat.id === "moored_buoys");
}

function appendBreakdownRow(
  list: HTMLElement,
  label: string,
  count: number
): void {
  const item = document.createElement("li");
  const cat = mooredBuoysCategory();
  const picto = cat ? makeCategorySwatch(cat) : document.createElement("span");
  const nameSpan = document.createElement("span");
  nameSpan.className = "o-country-modal-network";
  nameSpan.textContent = label;
  const countSpan = document.createElement("span");
  countSpan.className = "o-legend-count";
  countSpan.textContent = count.toLocaleString();
  item.append(picto, nameSpan, countSpan);
  list.appendChild(item);
}

async function loadMbnBreakdown(
  layerById: Map<string, GeoJSONLayer>,
  where: string
): Promise<{ tropical: number; coastal: number }> {
  const [tropical, coastal] = await Promise.all(
    TIER_ROWS.map(({ tier }) =>
      queryMooringLayerCount(
        "moored_buoys",
        layerById,
        appendMbnTierToFeatureWhere(where, tier)
      )
    )
  );
  return { tropical, coastal };
}

export async function openMbnMetricsModal(
  layerById: Map<string, GeoJSONLayer>,
  where: string
): Promise<void> {
  closeCountryMetricsModal();
  closeGoshipMetricsModal();
  closeSoconetMetricsModal();
  removeExistingModal();
  document.body.classList.add("o-country-modal-open");

  const backdrop = document.createElement("div");
  backdrop.id = MODAL_ID;
  backdrop.className = "o-country-modal-backdrop";

  const dialog = document.createElement("div");
  dialog.className = "o-country-modal";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "o-mbn-modal-title");

  const header = document.createElement("div");
  header.className = "o-country-modal-header";

  const titleWrap = document.createElement("div");
  titleWrap.className = "o-country-modal-title-wrap";
  const pictoWrap = document.createElement("span");
  pictoWrap.className = "o-country-modal-title-flag";
  const titlePicto =
    makeNetworkIconImg("moored_buoys") ??
    (mooredBuoysCategory()
      ? makeCategorySwatch(mooredBuoysCategory()!)
      : null);
  if (titlePicto) pictoWrap.append(titlePicto);
  const title = document.createElement("h2");
  title.id = "o-mbn-modal-title";
  title.className = "o-country-modal-title";
  title.textContent = "Moored buoys – MBN";
  titleWrap.append(pictoWrap, title);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "o-country-modal-close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.textContent = "×";

  header.append(titleWrap, closeBtn);

  const body = document.createElement("div");
  body.className = "o-country-modal-body";
  body.innerHTML = `<p class="o-country-modal-loading">Loading breakdown…</p>`;

  dialog.append(header, body);
  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);

  const close = () => {
    document.removeEventListener("keydown", onKeyDown);
    closeMbnMetricsModal();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  document.addEventListener("keydown", onKeyDown);
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });

  closeBtn.focus();

  try {
    const breakdown = await loadMbnBreakdown(layerById, where);
    body.replaceChildren();

    const list = document.createElement("ul");
    list.className = "o-country-modal-list";
    appendBreakdownRow(list, TIER_ROWS[0]!.label, breakdown.tropical);
    appendBreakdownRow(list, TIER_ROWS[1]!.label, breakdown.coastal);
    body.appendChild(list);
  } catch {
    body.innerHTML = `<p class="o-country-modal-empty">Could not load MBN breakdown.</p>`;
  }
}
