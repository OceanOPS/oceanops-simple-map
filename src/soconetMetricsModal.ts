import type GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import { getLayerDisplayLabel } from "./categories";
import { makeNetworkPicto } from "./categorySwatch";
import { closeCountryMetricsModal } from "./countryMetricsModal";
import { closeGoshipMetricsModal } from "./goshipMetricsModal";

const MODAL_ID = "soconet-metrics-modal";

function removeExistingModal(): void {
  document.getElementById(MODAL_ID)?.remove();
}

export function closeSoconetMetricsModal(): void {
  removeExistingModal();
  document.body.classList.remove("o-country-modal-open");
}

type SoconetBreakdown = {
  shipCount: number;
  mooringCount: number;
};

async function loadSoconetBreakdown(
  layerById: Map<string, GeoJSONLayer>,
  where: string
): Promise<SoconetBreakdown> {
  const shipLayer = layerById.get("soconet");
  const moorLayer = layerById.get("soconet_moorings");
  if (!shipLayer || !moorLayer) {
    throw new Error("SOCONET layers unavailable");
  }

  const [shipCount, mooringCount] = await Promise.all([
    shipLayer.queryFeatureCount({ where }),
    moorLayer.queryFeatureCount({ where }),
  ]);

  return { shipCount, mooringCount };
}

function soconetBreakdownPicto(
  layerId: "soconet" | "soconet_moorings"
): HTMLElement {
  // Ships = VOS-style ship icon; moorings = DBCP moored buoy (network table icons).
  return makeNetworkPicto(layerId === "soconet" ? "vos" : "soconet_moorings", "modal");
}

function appendBreakdownRow(
  list: HTMLElement,
  layerId: "soconet" | "soconet_moorings",
  count: number
): void {
  const item = document.createElement("li");
  const picto = soconetBreakdownPicto(layerId);
  const nameSpan = document.createElement("span");
  nameSpan.className = "o-country-modal-network";
  nameSpan.textContent = getLayerDisplayLabel(layerId, "modal");
  const countSpan = document.createElement("span");
  countSpan.className = "o-legend-count";
  countSpan.textContent = ` (${count.toLocaleString()})`;
  item.append(picto, nameSpan, countSpan);
  list.appendChild(item);
}

export async function openSoconetMetricsModal(
  layerById: Map<string, GeoJSONLayer>,
  where: string
): Promise<void> {
  closeCountryMetricsModal();
  closeGoshipMetricsModal();
  removeExistingModal();
  document.body.classList.add("o-country-modal-open");

  const backdrop = document.createElement("div");
  backdrop.id = MODAL_ID;
  backdrop.className = "o-country-modal-backdrop";

  const dialog = document.createElement("div");
  dialog.className = "o-country-modal";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "o-soconet-modal-title");

  const header = document.createElement("div");
  header.className = "o-country-modal-header";

  const titleWrap = document.createElement("div");
  titleWrap.className = "o-country-modal-title-wrap";
  const picto = makeNetworkPicto("soconet", "modal");
  picto.classList.add("o-country-modal-title-flag");
  const title = document.createElement("h2");
  title.id = "o-soconet-modal-title";
  title.className = "o-country-modal-title";
  title.textContent = getLayerDisplayLabel("soconet");
  titleWrap.append(picto, title);

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
    closeSoconetMetricsModal();
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
    const breakdown = await loadSoconetBreakdown(layerById, where);
    body.replaceChildren();

    const list = document.createElement("ul");
    list.className = "o-country-modal-list";
    appendBreakdownRow(list, "soconet", breakdown.shipCount);
    appendBreakdownRow(list, "soconet_moorings", breakdown.mooringCount);
    body.appendChild(list);
  } catch {
    body.innerHTML = `<p class="o-country-modal-empty">Could not load SOCONET breakdown.</p>`;
  }
}
