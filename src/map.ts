import esriConfig from "@arcgis/core/config.js";
import Extent from "@arcgis/core/geometry/Extent.js";
import SpatialReference from "@arcgis/core/geometry/SpatialReference.js";
import Map from "@arcgis/core/Map.js";
import SceneView from "@arcgis/core/views/SceneView.js";
import MapView from "@arcgis/core/views/MapView.js";
import Basemap from "@arcgis/core/Basemap.js";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";
import {
  is3dProjection,
  isPlateCarreeProjection,
  PROJECTION_3D_GLOBE,
  PROJECTION_WEB_MERCATOR,
  projectionLabel,
  toggleProjection,
  type ProjectionId,
} from "./projections";
import {
  createPacificOceanBasemap,
  createPacificSatelliteBasemap,
  createOceanTileLayer,
  PLATE_CARREE_DEFAULT_CENTER,
  PLATE_CARREE_DEFAULT_ZOOM,
  PLATE_CARREE_MIN_ZOOM,
} from "./plateCarreeBasemap";
import type { GlobeView, ViewHolder } from "./viewHolder";

esriConfig.assetsPath = "https://js.arcgis.com/4.33/@arcgis/core/assets";

export type BasemapKind = "map" | "satellite";

const BASE = import.meta.env.BASE_URL;

/** Web Mercator valid world (matches ~±85° latitude). */
export const WEB_MERCATOR_NAV_BOUNDS = new Extent({
  xmin: -20037508.342787,
  ymin: -19971868.88040863,
  xmax: 20037508.342787,
  ymax: 19971868.88040863,
  spatialReference: SpatialReference.WebMercator,
});

export function createNavigationBasemapMercator() {
  // ===== BASEMAP OPTIONS - Uncomment one to try =====

  // Ocean base — ArcGIS CDN tiles (Web Mercator)
  const oceanBase = createOceanTileLayer();
  const basemap = new Basemap({
    baseLayers: [oceanBase],
    referenceLayers: [],
  });

  // OPTION 1: Gray Vector (light minimalist)
  // const basemap = Basemap.fromId("gray-vector");

  // OPTION 2: Dark Gray Vector (dark minimalist)
  // const basemap = Basemap.fromId("dark-gray-vector");

  // OPTION 3: Streets Night (dark with urban details)
  // const basemap = Basemap.fromId("streets-night-vector");

  // OPTION 4: Satellite imagery
  // const basemap = Basemap.fromId("satellite");

  // OPTION 5: Hybrid (satellite + labels)
  // const basemap = Basemap.fromId("hybrid");

  // OPTION 6: Topographic modern
  // const basemap = Basemap.fromId("topo-vector");

  // OPTION 7: Terrain with relief
  // const basemap = Basemap.fromId("terrain");

  // OPTION 8: OSM (OpenStreetMap)
  // const basemap = Basemap.fromId("osm");

  // OPTION 9: Streets modern
  // const basemap = Basemap.fromId("streets-vector");

  // OPTION 10: Oceans (focused on oceanographic data - RECOMMENDED!)
  // const basemap = Basemap.fromId("oceans");

  // OPTION 11: Streets Navigation (clean navigation style)
  // const basemap = Basemap.fromId("streets-navigation-vector");

  // OPTION 12: Streets Relief (with terrain shading)
  // const basemap = Basemap.fromId("streets-relief-vector");

  // ===== 3D OPTIMIZED BASEMAPS (Best for SceneView/Globe) =====

  // OPTION 13: Gray 3D (ultra minimal light - RECOMMENDED for clean look)
  // const basemap = Basemap.fromId("gray-3d");

  // OPTION 14: Dark Gray 3D (ultra minimal dark - no labels)
  // const basemap = Basemap.fromId("dark-gray-3d");

  // OPTION 15: Topo 3D (topographic optimized for 3D)
  // const basemap = Basemap.fromId("topo-3d");

  // OPTION 16: Navigation 3D (clean navigation for 3D)
  // const basemapId = "navigation-3d";

  // OPTION 17: Navigation Dark 3D (dark navigation for 3D)
  // const basemap = Basemap.fromId("navigation-dark-3d");

  // OPTION 18: Streets 3D (detailed streets for 3D)
  // const basemap = Basemap.fromId("streets-3d");

  // OPTION 19: Streets Dark 3D (dark streets for 3D)
  // const basemap = Basemap.fromId("streets-dark-3d");

  // OPTION 20: OSM 3D (OpenStreetMap for 3D)
  // const basemap = Basemap.fromId("osm-3d");

  // ===== END BASEMAP OPTIONS =====

  return basemap;
}

/** Ocean base for 3D globe (Web Mercator tiles). */
export function createNavigationBasemap() {
  return createNavigationBasemapMercator();
}

export function createSatelliteBasemap() {
  return Basemap.fromId("satellite");
}

export function basemapForKind(kind: BasemapKind, projection: ProjectionId) {
  if (isPlateCarreeProjection(projection)) {
    return kind === "satellite"
      ? createPacificSatelliteBasemap()
      : createPacificOceanBasemap();
  }
  return kind === "satellite" ? createSatelliteBasemap() : createNavigationBasemapMercator();
}

function createFlatMapView(
  container: HTMLDivElement | string,
  map: Map,
  projection: ProjectionId
): MapView {
  const pacificCentered = isPlateCarreeProjection(projection);

  return new MapView({
    container,
    map,
    center: pacificCentered ? PLATE_CARREE_DEFAULT_CENTER : [0, 20],
    zoom: pacificCentered ? PLATE_CARREE_DEFAULT_ZOOM : 3,
    constraints: {
      geometry: WEB_MERCATOR_NAV_BOUNDS,
      rotationEnabled: false,
      minZoom: pacificCentered ? PLATE_CARREE_MIN_ZOOM : 3,
      snapToZoom: false,
    },
    highlightOptions: {
      color: [244, 139, 37, 1],
      haloOpacity: 0.9,
      fillOpacity: 0.2,
    },
  });
}

export async function stripBasemapLabels(map: Map) {
  if (!map.basemap) return;
  map.basemap.referenceLayers.removeAll();
  const baseLayers = map.basemap.baseLayers;
  const loadPromises = baseLayers.map((layer: __esri.Layer) => layer.load?.() ?? Promise.resolve());
  await Promise.all(loadPromises);

  const layersToRemove: __esri.Layer[] = [];
  baseLayers.forEach((layer: __esri.Layer) => {
    const title = (layer.title || "").toLowerCase();
    const id = (layer.id || "").toLowerCase();
    const url = ("url" in layer ? String(layer.url) : "").toLowerCase();
    if (
      /label|reference|place|text/.test(title) ||
      /label|reference|place|text/.test(id) ||
      /label|reference|place|text/.test(url)
    ) {
      layersToRemove.push(layer);
    }
  });
  layersToRemove.forEach((layer) => baseLayers.remove(layer));
}

export function createGlobeView(
  projection: ProjectionId,
  basemapKind: BasemapKind,
  container: HTMLDivElement | string
): { map: Map; view: GlobeView } {
  const map = new Map({
    basemap: basemapForKind(basemapKind, projection),
  });

  if (is3dProjection(projection)) {
    const view = new SceneView({
      container,
      map,
      camera: { position: { longitude: 0, latitude: 0, z: 2.2e7 }, tilt: 0 },
      qualityProfile: "low",
      environment: {
        atmosphereEnabled: false,
        starsEnabled: false,
        lighting: {
          type: "virtual",
          directShadowsEnabled: false,
        },
        background: { type: "color", color: [11, 30, 66, 1] },
      },
      highlightOptions: {
        color: [244, 139, 37, 1],
        haloOpacity: 0.9,
        fillOpacity: 0.2,
      },
    });
    return { map, view };
  }

  const view = createFlatMapView(container, map, projection);
  return { map, view };
}

const GLOBE_DOUBLE_CLICK_ZOOM_OUT_STEP = 1;

function zoomOutGlobeAtPoint(sceneView: SceneView, mapPoint: __esri.Point): void {
  void sceneView.goTo(
    {
      target: mapPoint,
      zoom: sceneView.zoom - GLOBE_DOUBLE_CLICK_ZOOM_OUT_STEP,
    },
    { animate: true, duration: 600 }
  );
}

const POPUP_SHADOW_SCROLLBAR_STYLE_ID = "o-popup-scrollbar-styles";

/** Scrollbar styling for Calcite panel content inside Esri popup shadow DOM. */
const POPUP_SHADOW_SCROLLBAR_CSS = `
.content-wrapper {
  scrollbar-width: thin;
  scrollbar-color: #f48b25 rgba(255, 255, 255, 0.12);
}
.content-wrapper::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.content-wrapper::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 5px;
}
.content-wrapper::-webkit-scrollbar-thumb {
  background: #f48b25;
  border-radius: 5px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.content-wrapper::-webkit-scrollbar-thumb:hover {
  background: #f6a555;
}
`;

function injectPopupShadowScrollbarStyles(shadowRoot: ShadowRoot): void {
  if (!shadowRoot.querySelector(".content-wrapper")) return;
  if (shadowRoot.getElementById(POPUP_SHADOW_SCROLLBAR_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = POPUP_SHADOW_SCROLLBAR_STYLE_ID;
  style.textContent = POPUP_SHADOW_SCROLLBAR_CSS;
  shadowRoot.appendChild(style);
}

function traverseShadowTree(node: Node, visitElement: (el: Element) => void): void {
  if (node instanceof Element) {
    visitElement(node);
    node.shadowRoot?.childNodes.forEach((child) => traverseShadowTree(child, visitElement));
  }
  node.childNodes.forEach((child) => traverseShadowTree(child, visitElement));
}

function patchPopupCalciteScrollbars(popupRoot: Element): void {
  traverseShadowTree(popupRoot, (el) => {
    const shadow = (el as HTMLElement).shadowRoot;
    if (shadow) injectPopupShadowScrollbarStyles(shadow);
  });
}

export function applyPopupDefaults(view: GlobeView): void {
  if (!view.popup) return;
  view.popup.visibleElements = {
    closeButton: true,
    collapseButton: true,
    featureNavigation: true,
    heading: true,
    spinner: true,
    actionBar: true,
  };

  let patchScheduled = false;
  const schedulePopupScrollbarPatch = () => {
    if (patchScheduled) return;
    patchScheduled = true;
    requestAnimationFrame(() => {
      patchScheduled = false;
      const popupEl = view.container?.querySelector(".esri-popup");
      if (popupEl) patchPopupCalciteScrollbars(popupEl);
    });
  };

  reactiveUtils.watch(
    () => view.popup?.visible,
    (visible) => {
      if (visible) schedulePopupScrollbarPatch();
    }
  );

  if (view.container) {
    const observer = new MutationObserver(() => {
      if (view.popup?.visible) schedulePopupScrollbarPatch();
    });
    observer.observe(view.container, { childList: true, subtree: true });
  }
}

export function applyViewNavigationDefaults(view: GlobeView) {
  view.navigation.actionMap.mouseWheel = "none";
  if ("ui" in view) {
    view.ui.remove("navigation-toggle");
  }

  view.on("double-click", (event) => {
    if (event.button !== 2) return;
    event.stopPropagation();

    if (view.type === "2d") {
      const mapView = view as MapView;
      const minZoom = mapView.constraints.minZoom ?? 0;
      void mapView.goTo(
        {
          center: event.mapPoint,
          zoom: Math.max(minZoom, mapView.zoom - 1),
        },
        { animate: true, duration: 250 }
      );
      return;
    }

    zoomOutGlobeAtPoint(view as SceneView, event.mapPoint);
  });
}

export interface MapChromeOptions {
  viewHolder: ViewHolder;
  getProjection: () => ProjectionId;
  getBasemapKind: () => BasemapKind;
  onBasemapKindChange: (kind: BasemapKind) => void;
  onProjectionChange: (projection: ProjectionId) => Promise<void>;
}

/** Basemap preview + projection picker (bottom-left stack). */
export function mountBasemapProjectionControl(
  view: GlobeView,
  options: MapChromeOptions
): void {
  const menu = document.createElement("div");
  menu.className = "o-map-display-menu";

  // —— Basemap (layer) ——
  const basemapSection = document.createElement("div");
  basemapSection.className = "o-map-display-section o-map-display-section--basemap";

  const previewBtn = document.createElement("button");
  previewBtn.type = "button";
  previewBtn.className = "o-basemap-preview-btn";
  previewBtn.title = "Switch ocean / satellite basemap";
  previewBtn.setAttribute("aria-label", "Switch basemap");

  const basemapHint = document.createElement("span");
  basemapHint.className = "o-basemap-kind-label";

  basemapSection.append(previewBtn, basemapHint);

  const divider = document.createElement("div");
  divider.className = "o-map-display-divider";
  divider.setAttribute("aria-hidden", "true");

  // —— Projection (preview + label: show only the non-active option) ——
  const projectionSection = document.createElement("div");
  projectionSection.className = "o-map-display-section o-map-display-section--projection";

  const projectionPreviewBtn = document.createElement("button");
  projectionPreviewBtn.type = "button";
  projectionPreviewBtn.className = "o-basemap-preview-btn";

  const projectionHint = document.createElement("span");
  projectionHint.className = "o-basemap-kind-label";

  projectionSection.append(projectionPreviewBtn, projectionHint);

  const syncProjectionUi = (projection: ProjectionId) => {
    const next = toggleProjection(projection);
    const preview =
      next === PROJECTION_3D_GLOBE
        ? "globe.jpeg"
        : next === PROJECTION_WEB_MERCATOR
          ? "mercator.jpeg"
          : "mercator.jpeg";
    projectionPreviewBtn.innerHTML = `<div class="o-basemap-preview" style="background-image: url('${BASE}img/${preview}');"></div>`;
    projectionHint.textContent = projectionLabel(next);
    projectionPreviewBtn.title = `Switch to ${projectionLabel(next)}`;
    projectionPreviewBtn.setAttribute("aria-label", `Switch to ${projectionLabel(next)}`);
  };

  const updateBasemapUi = () => {
    const basemapKind = options.getBasemapKind();

    if (basemapKind === "map") {
      previewBtn.innerHTML = `<div class="o-basemap-preview" style="background-image: url('${BASE}img/satelite.jpeg');"></div>`;
      basemapHint.textContent = "Satellite layer";
    } else {
      previewBtn.innerHTML = `<div class="o-basemap-preview" style="background-image: url('${BASE}img/map.jpeg');"></div>`;
      basemapHint.textContent = "Map layer";
    }
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
    if (map) map.basemap = basemapForKind(next, options.getProjection());
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

  menu.append(basemapSection, divider, projectionSection);
  view.ui.add(menu, { position: "top-left", index: 4 });
}

export function mountBasemapControlOnView(
  view: GlobeView,
  options: MapChromeOptions
): void {
  mountBasemapProjectionControl(view, options);
}
