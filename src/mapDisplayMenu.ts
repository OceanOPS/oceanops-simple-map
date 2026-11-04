import {
  PROJECTION_3D_GLOBE,
  PROJECTION_CYCLE,
  PROJECTION_EQUAL_EARTH,
  PROJECTION_PLATE_CARREE_PACIFIC,
  projectionLabel,
  toggleProjection,
  type ProjectionId,
} from "./projections";
import {
  BASEMAP_KIND_CYCLE,
  mountProjectionStepDots,
  setBasemapPreviewContent,
  setCycleOptionLabel,
  updateProjectionStepDots,
} from "./mapDisplayCycleUi";
import {
  appendToolbarHint,
  clearToolbarHint,
  syncLeftToolbarOrder,
} from "./mapToolbar";
import type { GlobeView, ViewHolder } from "./viewHolder";
import { isMapFullscreen, setMapFullscreen } from "./mapFullscreen";
import "./mapDisplayCycleUi.css";
import {
  applyBasemapKind,
  isMapMouseWheelZoomEnabled,
  setMapMouseWheelZoomEnabled,
  type BasemapKind,
} from "./map";

const BASE = import.meta.env.BASE_URL;

export interface MapChromeOptions {
  viewHolder: ViewHolder;
  getProjection: () => ProjectionId;
  getBasemapKind: () => BasemapKind;
  onBasemapKindChange: (kind: BasemapKind) => void;
  onProjectionChange: (projection: ProjectionId) => Promise<void>;
  onShellLayoutChange?: () => void;
}

/** Basemap preview + projection picker (bottom-left stack). */
export function mountBasemapProjectionControl(
  view: GlobeView,
  options: MapChromeOptions
): void {
  const menu = document.createElement("div");
  menu.className = "o-map-display-menu";

  const basemapSection = document.createElement("div");
  basemapSection.className = "o-map-display-section o-map-display-section--basemap";

  const previewBtn = document.createElement("button");
  previewBtn.type = "button";
  previewBtn.className = "o-basemap-preview-btn";
  previewBtn.setAttribute("aria-label", "Switch basemap");

  const basemapSteps = mountProjectionStepDots(0, BASEMAP_KIND_CYCLE.length);

  const basemapHint = document.createElement("span");
  basemapHint.className = "o-basemap-kind-label";

  basemapSection.append(previewBtn, basemapSteps, basemapHint);

  const divider = document.createElement("div");
  divider.className = "o-map-display-divider";
  divider.setAttribute("aria-hidden", "true");

  const projectionSection = document.createElement("div");
  projectionSection.className = "o-map-display-section o-map-display-section--projection";

  const projectionPreviewBtn = document.createElement("button");
  projectionPreviewBtn.type = "button";
  projectionPreviewBtn.className = "o-basemap-preview-btn";

  const projectionSteps = mountProjectionStepDots(0, PROJECTION_CYCLE.length);

  const projectionHint = document.createElement("span");
  projectionHint.className = "o-basemap-kind-label";

  projectionSection.append(projectionPreviewBtn, projectionSteps, projectionHint);

  const divider2 = document.createElement("div");
  divider2.className = "o-map-display-divider";
  divider2.setAttribute("aria-hidden", "true");

  const scrollWheelSection = document.createElement("div");
  scrollWheelSection.className =
    "o-map-display-section o-map-display-section--scroll-wheel";

  const scrollWheelSwitch = document.createElement("button");
  scrollWheelSwitch.type = "button";
  scrollWheelSwitch.className = "o-map-scroll-wheel-switch";
  scrollWheelSwitch.setAttribute("role", "switch");
  scrollWheelSwitch.setAttribute("aria-checked", "false");
  scrollWheelSwitch.setAttribute("aria-label", "Enable mouse wheel zoom");
  scrollWheelSwitch.innerHTML = `<span class="o-map-scroll-wheel-switch__track" aria-hidden="true"><span class="o-map-scroll-wheel-switch__thumb"></span></span>`;

  const scrollWheelHint = document.createElement("span");
  scrollWheelHint.className = "o-basemap-kind-label";
  scrollWheelHint.textContent = "Scroll zoom";

  const syncScrollWheelUi = () => {
    const enabled = isMapMouseWheelZoomEnabled();
    scrollWheelSwitch.classList.toggle("is-on", enabled);
    scrollWheelSwitch.setAttribute("aria-checked", enabled ? "true" : "false");
    const actionLabel = enabled
      ? "Disable mouse wheel zoom"
      : "Enable mouse wheel zoom";
    scrollWheelSwitch.setAttribute("aria-label", actionLabel);
    appendToolbarHint(scrollWheelSwitch, actionLabel);
  };

  scrollWheelSwitch.addEventListener("click", () => {
    const view = options.viewHolder.view;
    setMapMouseWheelZoomEnabled(view, !isMapMouseWheelZoomEnabled());
    syncScrollWheelUi();
    scrollWheelSwitch.blur();
  });

  setMapMouseWheelZoomEnabled(options.viewHolder.view, false);
  syncScrollWheelUi();
  scrollWheelSection.append(scrollWheelSwitch, scrollWheelHint);

  const divider3 = document.createElement("div");
  divider3.className = "o-map-display-divider";
  divider3.setAttribute("aria-hidden", "true");

  const fullscreenSection = document.createElement("div");
  fullscreenSection.className = "o-map-display-section o-map-display-section--fullscreen";

  const fullscreenBtn = document.createElement("button");
  fullscreenBtn.type = "button";
  fullscreenBtn.className = "o-map-fullscreen-toggle";
  fullscreenBtn.setAttribute("aria-label", "Expand map");

  const expandIcon = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  const compressIcon = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  const syncFullscreenUi = () => {
    const active = isMapFullscreen();
    const actionLabel = active ? "Collapse map" : "Expand map";
    fullscreenBtn.classList.toggle("is-active", active);
    fullscreenBtn.innerHTML = active ? compressIcon : expandIcon;
    fullscreenBtn.setAttribute("aria-label", actionLabel);
    appendToolbarHint(fullscreenBtn, actionLabel);
  };

  fullscreenBtn.addEventListener("click", () => {
    void setMapFullscreen(!isMapFullscreen(), options.onShellLayoutChange);
  });

  document.addEventListener("fullscreenchange", syncFullscreenUi);
  document.addEventListener("map-fullscreen-change", syncFullscreenUi);
  syncFullscreenUi();

  fullscreenSection.append(fullscreenBtn);

  const projectionPreviewImage = (target: ProjectionId): string => {
    switch (target) {
      case PROJECTION_3D_GLOBE:
        return "globe.jpeg";
      case PROJECTION_PLATE_CARREE_PACIFIC:
      case PROJECTION_EQUAL_EARTH:
        return "mercator.jpeg";
    }
  };

  const syncProjectionUi = (projection: ProjectionId) => {
    const currentIndex = PROJECTION_CYCLE.indexOf(projection);
    updateProjectionStepDots(
      projectionSteps,
      currentIndex >= 0 ? currentIndex : 0
    );
    const next = toggleProjection(projection);
    const preview = projectionPreviewImage(projection);
    const switchLabel = `Switch to ${projectionLabel(next)}`;
    setBasemapPreviewContent(
      projectionPreviewBtn,
      `<div class="o-basemap-preview" style="background-image: url('${BASE}img/${preview}');"></div>`
    );
    setCycleOptionLabel(projectionHint, projectionLabel(projection));
    projectionPreviewBtn.setAttribute("aria-label", switchLabel);
    clearToolbarHint(projectionPreviewBtn);
  };

  const updateBasemapUi = () => {
    const basemapKind = options.getBasemapKind();
    const basemapIndex = BASEMAP_KIND_CYCLE.indexOf(basemapKind);
    updateProjectionStepDots(
      basemapSteps,
      basemapIndex >= 0 ? basemapIndex : 0
    );

    if (basemapKind === "map") {
      setBasemapPreviewContent(
        previewBtn,
        `<div class="o-basemap-preview" style="background-image: url('${BASE}img/map.jpeg');"></div>`
      );
      setCycleOptionLabel(basemapHint, "Map layer");
      previewBtn.setAttribute("aria-label", "Switch to satellite layer");
    } else {
      setBasemapPreviewContent(
        previewBtn,
        `<div class="o-basemap-preview" style="background-image: url('${BASE}img/satelite.jpeg');"></div>`
      );
      setCycleOptionLabel(basemapHint, "Satellite layer");
      previewBtn.setAttribute("aria-label", "Switch to map layer");
    }
    clearToolbarHint(previewBtn);
  };

  const updateUi = () => {
    updateBasemapUi();
    syncProjectionUi(options.getProjection());
  };

  updateUi();

  previewBtn.addEventListener("click", () => {
    const next = options.getBasemapKind() === "map" ? "satellite" : "map";
    options.onBasemapKindChange(next);
    const map = options.viewHolder.view.map;
    if (map) applyBasemapKind(map, next, options.getProjection());
    updateBasemapUi();
  });

  projectionPreviewBtn.addEventListener("click", () => {
    void (async () => {
      const target = toggleProjection(options.getProjection());
      projectionSection.classList.add("is-busy");
      projectionPreviewBtn.disabled = true;
      try {
        await options.onProjectionChange(target);
        updateUi();
      } finally {
        projectionSection.classList.remove("is-busy");
        projectionPreviewBtn.disabled = false;
      }
    })();
  });

  menu.append(
    basemapSection,
    divider,
    projectionSection,
    divider2,
    scrollWheelSection,
    divider3,
    fullscreenSection
  );
  (menu as HTMLElement & { _refreshDisplayMenu?: () => void })._refreshDisplayMenu =
    updateUi;
  view.ui.add(menu, { position: "top-left", index: 4 });
  syncLeftToolbarOrder(view);
}

export function mountBasemapControlOnView(
  view: GlobeView,
  options: MapChromeOptions
): void {
  mountBasemapProjectionControl(view, options);
}
