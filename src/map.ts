import esriConfig from "@arcgis/core/config.js";
import Extent from "@arcgis/core/geometry/Extent.js";
import SpatialReference from "@arcgis/core/geometry/SpatialReference.js";
import Map from "@arcgis/core/Map.js";
import SceneView from "@arcgis/core/views/SceneView.js";
import MapView from "@arcgis/core/views/MapView.js";
import Basemap from "@arcgis/core/Basemap.js";
import TileLayer from "@arcgis/core/layers/TileLayer.js";
import {
  is3dProjection,
  PROJECTION_3D_GLOBE,
  PROJECTION_WEB_MERCATOR,
  type ProjectionId,
} from "./projections";
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

export function createNavigationBasemap() {
  // ===== BASEMAP OPTIONS - Uncomment one to try =====

  // CURRENT: Ocean base (default)
  const oceanBase = new TileLayer({
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer",
  });
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

export function createSatelliteBasemap() {
  return Basemap.fromId("satellite");
}

export function basemapForKind(kind: BasemapKind) {
  return kind === "satellite" ? createSatelliteBasemap() : createNavigationBasemap();
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
    basemap: basemapForKind(basemapKind),
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

  const view = new MapView({
    container,
    map,
    center: [0, 20],
    zoom: 3,
    constraints: {
      geometry: WEB_MERCATOR_NAV_BOUNDS,
      rotationEnabled: false,
      minZoom: 3,
      snapToZoom: false,
    },
    highlightOptions: {
      color: [244, 139, 37, 1],
      haloOpacity: 0.9,
      fillOpacity: 0.2,
    },
  });
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

  const basemapHeading = document.createElement("span");
  basemapHeading.className = "o-map-display-heading";
  basemapHeading.textContent = "Basemap";

  const previewBtn = document.createElement("button");
  previewBtn.type = "button";
  previewBtn.className = "o-basemap-preview-btn";
  previewBtn.title = "Switch ocean / satellite basemap";
  previewBtn.setAttribute("aria-label", "Switch basemap");

  const basemapHint = document.createElement("span");
  basemapHint.className = "o-basemap-kind-label";

  basemapSection.append(basemapHeading, previewBtn, basemapHint);

  const divider = document.createElement("div");
  divider.className = "o-map-display-divider";
  divider.setAttribute("aria-hidden", "true");

  // —— Projection ——
  const projectionSection = document.createElement("div");
  projectionSection.className = "o-map-display-section o-map-display-section--projection";

  const projectionHeading = document.createElement("span");
  projectionHeading.className = "o-map-display-heading";
  projectionHeading.textContent = "Projection";

  const projectionChoices = document.createElement("div");
  projectionChoices.className = "o-projection-choices";
  projectionChoices.setAttribute("role", "group");
  projectionChoices.setAttribute("aria-label", "Map projection");

  const globeBtn = document.createElement("button");
  globeBtn.type = "button";
  globeBtn.className = "o-projection-choice";
  globeBtn.dataset.projection = PROJECTION_3D_GLOBE;
  globeBtn.textContent = "3D Globe";

  const mercatorBtn = document.createElement("button");
  mercatorBtn.type = "button";
  mercatorBtn.className = "o-projection-choice";
  mercatorBtn.dataset.projection = PROJECTION_WEB_MERCATOR;
  mercatorBtn.textContent = "Web Mercator";

  projectionChoices.append(globeBtn, mercatorBtn);
  projectionSection.append(projectionHeading, projectionChoices);

  const syncProjectionButtons = (projection: ProjectionId) => {
    const is3d = projection === PROJECTION_3D_GLOBE;
    globeBtn.classList.toggle("is-active", is3d);
    mercatorBtn.classList.toggle("is-active", !is3d);
    globeBtn.setAttribute("aria-pressed", String(is3d));
    mercatorBtn.setAttribute("aria-pressed", String(!is3d));
  };

  const updateBasemapUi = () => {
    const basemapKind = options.getBasemapKind();

    if (basemapKind === "map") {
      previewBtn.innerHTML = `<div class="o-basemap-preview" style="background-image: url('${BASE}img/satelite.jpeg');"></div>`;
      basemapHint.textContent = "Tap for satellite";
    } else {
      previewBtn.innerHTML = `<div class="o-basemap-preview" style="background-image: url('${BASE}img/map.jpeg');"></div>`;
      basemapHint.textContent = "Tap for ocean map";
    }
  };

  const updateUi = () => {
    updateBasemapUi();
    syncProjectionButtons(options.getProjection());
  };

  updateUi();

  previewBtn.addEventListener("click", () => {
    const next = options.getBasemapKind() === "map" ? "satellite" : "map";
    options.onBasemapKindChange(next);
    const map = options.viewHolder.view.map;
    if (map) map.basemap = basemapForKind(next);
    updateBasemapUi();
  });

  const onProjectionPick = async (target: ProjectionId) => {
    if (target === options.getProjection()) return;
    projectionChoices.classList.add("is-busy");
    globeBtn.disabled = true;
    mercatorBtn.disabled = true;
    try {
      await options.onProjectionChange(target);
      updateUi();
    } finally {
      projectionChoices.classList.remove("is-busy");
      globeBtn.disabled = false;
      mercatorBtn.disabled = false;
    }
  };

  globeBtn.addEventListener("click", () => void onProjectionPick(PROJECTION_3D_GLOBE));
  mercatorBtn.addEventListener("click", () => void onProjectionPick(PROJECTION_WEB_MERCATOR));

  menu.append(basemapSection, divider, projectionSection);
  view.ui.add(menu, { position: "top-left", index: 4 });
}

export function mountBasemapControlOnView(
  view: GlobeView,
  options: MapChromeOptions
): void {
  mountBasemapProjectionControl(view, options);
}
