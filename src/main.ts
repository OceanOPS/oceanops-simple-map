import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import EsriMap from "@arcgis/core/Map.js";
import type SceneView from "@arcgis/core/views/SceneView.js";
import { categories, type Category, type Shape } from "./categories";
import {
  applyOperationalLayerStackOrder,
  sortedOperationalLayerIds,
} from "./layerStackOrder";
import { attachLegend } from "./legend";
import {
  applyViewNavigationDefaults,
  applyPopupDefaults,
  createGlobeView,
  mountBasemapProjectionControl,
  stripBasemapLabels,
  type BasemapKind,
} from "./map";
import {
  is3dProjection,
  PROJECTION_3D_GLOBE,
  type ProjectionId,
} from "./projections";
import { goshipPopupContent } from "./goshipPopup";
import { platformPopupContent } from "./platformPopup";
import { getMooringStackGeoJsonUrls } from "./mooringStackGeojson";
import { applyMooringStackSymbology } from "./mooringStackSymbology";
import { bindGlobeLineWidthZoomSync } from "./lineWidthZoom";
import {
  makeCategoryRenderer,
  makeGoshipLineRenderer,
  makeMooredBuoysRenderer,
  makeOceanSitesRenderer,
  makeOceanTraxLineRenderer,
} from "./renderers";
import { OCEANTRAX_ACTIVE_DEFINITION } from "./oceanTraxFilter";
import type { GlobeView, ViewHolder } from "./viewHolder";
import {
  fitViewInitialExtent,
  refreshViewLayout,
} from "./viewLayout";
import { applyProjectionShellLayout } from "./projectionLayout";
import { mountMapServerLoader } from "./mapServerLoader";
import { bindMapEmbedResizeSync, bindMapFullscreenEmbedSync, bindMapFullscreenSync } from "./mapFullscreen";

const BASE = import.meta.env.BASE_URL;

/** Line layers exported as `{id}.geojson` (densified) + `{id}_undensified.geojson`. */
const DENSIFIED_LINE_LAYER_IDS = new Set(["goship", "oceantrax"]);

function geojsonLayerUrl(cat: Category, projection: ProjectionId): string {
  if (
    cat.type === "line" &&
    DENSIFIED_LINE_LAYER_IDS.has(cat.id) &&
    !is3dProjection(projection)
  ) {
    return `${BASE}geojson/${cat.id}_undensified.geojson`;
  }
  return `${BASE}geojson/${cat.id}.geojson`;
}

function linePopupContent(cat: Category): string {
  return `<div class="o-map-popup">
          <p><b>Type:</b> ${cat.label}</p>
          <p><b>Name:</b> {line_name}</p>
          <p><a target="_blank" rel="noopener noreferrer" href="https://www.ocean-ops.org/board/wa/InspectLine?name={line_name}">Inspect at OceanOPS</a></p>
          </div>`;
}

function lineLayerPopupTemplate(cat: Category) {
  if (cat.id === "goship" || cat.id === "oceantrax") {
    return {
      title: "{line_name}",
      content: goshipPopupContent(cat),
    };
  }

  return {
    title: "{line_name}",
    content: linePopupContent(cat),
  };
}

function createGeoJsonLayer(
  cat: Category,
  projection: ProjectionId,
  layerUrl?: string
): GeoJSONLayer {
  const kind =
    cat.type === "image" ? "image" : cat.type === "line" ? "line" : "point";
  const renderer =
    cat.id === "goship"
      ? makeGoshipLineRenderer(projection, cat.color)
      : cat.id === "oceantrax"
        ? makeOceanTraxLineRenderer(projection, cat.color)
        : cat.id === "moored_buoys" && is3dProjection(projection)
          ? makeMooredBuoysRenderer(projection, cat.color)
          : cat.id === "oceansites" && is3dProjection(projection)
            ? makeOceanSitesRenderer(projection, cat.color)
            : makeCategoryRenderer(
            projection,
            kind,
            cat.color,
            cat.type === "image" ? cat.imagePath : undefined,
            cat.type === "point" ? ((cat.shape ?? "circle") as Shape) : undefined,
            undefined,
            cat.type === "point" ? (cat.markerSize ?? undefined) : undefined
          );

  const layer = new GeoJSONLayer({
    url: layerUrl ?? geojsonLayerUrl(cat, projection),
    title: cat.label,
    outFields: ["*"],
    renderer,
    definitionExpression:
      cat.id === "oceantrax" ? OCEANTRAX_ACTIVE_DEFINITION : undefined,
    popupTemplate:
      cat.type === "line"
        ? lineLayerPopupTemplate(cat)
        : {
            title: "{ptf_ref}",
            content: platformPopupContent(cat),
          },
  });

  if (is3dProjection(projection)) {
    const mooringElevationMeters: Partial<Record<string, string>> = {
      moored_buoys: "0",
      oceansites: "1",
      soconet_moorings: "2",
    };
    const mooringElevation = mooringElevationMeters[cat.id];

    layer.elevationInfo =
      cat.type === "line"
        ? { mode: "on-the-ground" }
        : mooringElevation
          ? {
              mode: "absolute-height",
              featureExpressionInfo: { expression: mooringElevation },
            }
          : {
              mode: "absolute-height",
              featureExpressionInfo: { expression: "0" },
            };
    layer.screenSizePerspectiveEnabled = true;
  }

  return layer;
}

async function addOperationalLayers(
  map: EsriMap,
  projection: ProjectionId,
  layerById: Map<string, GeoJSONLayer>
): Promise<void> {
  layerById.clear();
  const layerPromises: Promise<unknown>[] = [];
  const use3d = is3dProjection(projection);

  const mooringStackUrls = use3d ? await getMooringStackGeoJsonUrls(BASE) : undefined;

  const layersToAdd = use3d
    ? sortedOperationalLayerIds()
        .map((id) => categories.find((c) => c.id === id))
        .filter((c): c is (typeof categories)[number] => c != null)
    : [...categories];

  for (const cat of layersToAdd) {
    const layerUrl = mooringStackUrls
      ? cat.id === "moored_buoys"
        ? mooringStackUrls.mooredBuoys
        : cat.id === "oceansites"
          ? mooringStackUrls.oceansites
          : cat.id === "soconet_moorings"
            ? mooringStackUrls.soconetMoorings
            : undefined
      : undefined;
    const layer = createGeoJsonLayer(cat as Category, projection, layerUrl);
    map.add(layer);
    layerById.set(cat.id, layer);
    layerPromises.push(layer.when());
  }

  await Promise.all(layerPromises);
  applyOperationalLayerStackOrder(map, layerById);
  if (use3d) {
    applyMooringStackSymbology(layerById, projection);
  }
}

async function computeLayerUnion(layerById: Map<string, GeoJSONLayer>) {
  let union: __esri.Extent | null = null;
  for (const layer of layerById.values()) {
    const ext = layer.fullExtent ?? null;
    if (ext) union = union ? union.union(ext) : ext;
  }
  return union;
}

function wirePointerCursor(view: GlobeView) {
  let isDragging = false;

  if (view.container) {
    view.container.style.cursor = "grab";
  }

  view.on("drag", (event) => {
    if (event.action === "start") {
      isDragging = true;
      if (view.container) view.container.style.cursor = "grabbing";
    } else if (event.action === "end") {
      isDragging = false;
      if (view.container) view.container.style.cursor = "grab";
    }
  });

  view.on("pointer-move", async (event) => {
    if (isDragging || !view.container) return;
    try {
      const response = await view.hitTest(event);
      view.container.style.cursor =
        response.results.length > 0 ? "pointer" : "grab";
    } catch {
      /* ignore */
    }
  });
}

function createRotationController(
  viewHolder: ViewHolder,
  getProjection: () => ProjectionId
) {
  let isRotating = true;
  let rotationFrame: number | undefined;
  let onRotationStateChange: (() => void) | null = null;

  const rotate = () => {
    if (!isRotating || !is3dProjection(getProjection())) return;
    const view = viewHolder.view;
    if (view.type !== "3d") return;

    const sceneView = view as SceneView;
    const camera = sceneView.camera.clone();
    if (camera.position.longitude != null) {
      camera.position.longitude += 0.1;
      sceneView.goTo(camera, { animate: false }).catch(() => {});
    }
    rotationFrame = requestAnimationFrame(rotate);
  };

  const stopRotation = () => {
    if (!isRotating) return;
    isRotating = false;
    if (rotationFrame !== undefined) cancelAnimationFrame(rotationFrame);
    onRotationStateChange?.();
  };

  const toggleRotation = () => {
    if (!is3dProjection(getProjection())) return false;
    if (isRotating) stopRotation();
    else {
      isRotating = true;
      rotate();
      onRotationStateChange?.();
    }
    return isRotating;
  };

  viewHolder.view.on("drag", stopRotation);
  viewHolder.view.on("key-down", stopRotation);
  viewHolder.view.on("double-click", stopRotation);

  rotate();

  return {
    toggleRotation,
    isRotating: () => isRotating,
    setRotationStateChangeCallback: (cb: () => void) => {
      onRotationStateChange = cb;
    },
    stopRotation,
  };
}

(async () => {
  const viewHolder: ViewHolder = { view: null! };
  const layerById = new Map<string, GeoJSONLayer>();

  let currentProjection: ProjectionId = PROJECTION_3D_GLOBE;
  let currentBasemapKind: BasemapKind = "map";
  let rotationApi = {
    toggleRotation: () => false,
    isRotating: () => false,
    setRotationStateChangeCallback: (_cb: () => void) => {},
    stopRotation: () => {},
  };
  let unbindMapServerLoader: (() => void) | null = null;
  let unbindMapFullscreen: (() => void) | null = null;
  let unbindMapFullscreenEmbed: (() => void) | null = null;
  let unbindMapEmbedResize: (() => void) | null = null;
  let unbindGlobeLineWidthZoom: (() => void) | null = null;

  if (window.self !== window.top) {
    document.documentElement.classList.add("map-embedded");
    document.body.classList.add("map-embedded");
  }

  const onShellLayoutChange = () => {
    void refreshViewLayout(viewHolder.view);
  };

  const attachLegendToView = () => {
    attachLegend(
      viewHolder,
      layerById,
      () => rotationApi.toggleRotation(),
      () => rotationApi.isRotating(),
      (cb) => rotationApi.setRotationStateChangeCallback(cb),
      () => rotationApi.stopRotation(),
      () => currentProjection,
      onShellLayoutChange
    );
  };

  async function initView(projection: ProjectionId, basemapKind: BasemapKind) {
    const container = document.getElementById("viewDiv");
    if (!container) throw new Error("viewDiv not found");

    applyProjectionShellLayout(projection);

    const { map, view } = createGlobeView(
      projection,
      basemapKind,
      container as HTMLDivElement
    );
    viewHolder.view = view;
    applyViewNavigationDefaults(view);
    applyPopupDefaults(view);
    await refreshViewLayout(view);
    await stripBasemapLabels(map);
    await addOperationalLayers(map, projection, layerById);
    wirePointerCursor(view);
    await refreshViewLayout(view);
    const layerUnion = await computeLayerUnion(layerById);
    await fitViewInitialExtent(view, projection, layerUnion);
    await refreshViewLayout(view);

    unbindMapServerLoader?.();
    const mapShell = document.getElementById("mapShell");
    if (mapShell) {
      unbindMapServerLoader = mountMapServerLoader(
        mapShell,
        view,
        () => currentProjection
      );
    }

    mountBasemapProjectionControl(view, {
      viewHolder,
      getProjection: () => currentProjection,
      getBasemapKind: () => currentBasemapKind,
      onBasemapKindChange: (kind) => {
        currentBasemapKind = kind;
      },
      onProjectionChange: async (next) => {
        await swapProjection(next);
      },
      onShellLayoutChange,
    });

    rotationApi = createRotationController(viewHolder, () => currentProjection);
    if (!is3dProjection(projection)) {
      rotationApi.stopRotation();
    }
    unbindMapFullscreen?.();
    unbindMapFullscreen = bindMapFullscreenSync(onShellLayoutChange);
    unbindMapFullscreenEmbed?.();
    unbindMapFullscreenEmbed = bindMapFullscreenEmbedSync(onShellLayoutChange);
    unbindMapEmbedResize?.();
    unbindMapEmbedResize = bindMapEmbedResizeSync(onShellLayoutChange);

    unbindGlobeLineWidthZoom?.();
    unbindGlobeLineWidthZoom = is3dProjection(projection)
      ? bindGlobeLineWidthZoomSync(view, layerById, () => currentProjection)
      : null;

    attachLegendToView();
  }

  async function swapProjection(projection: ProjectionId) {
    rotationApi.stopRotation();
    unbindMapServerLoader?.();
    unbindMapServerLoader = null;
    unbindMapFullscreen?.();
    unbindMapFullscreen = null;
    unbindMapFullscreenEmbed?.();
    unbindMapFullscreenEmbed = null;
    unbindMapEmbedResize?.();
    unbindMapEmbedResize = null;
    unbindGlobeLineWidthZoom?.();
    unbindGlobeLineWidthZoom = null;

    const oldView = viewHolder.view;
    const oldMap = oldView.map;
    oldView.container = null;
    oldView.destroy();
    oldMap?.destroy();

    currentProjection = projection;
    await new Promise((r) => setTimeout(r, 100));

    await initView(projection, currentBasemapKind);
    await refreshViewLayout(viewHolder.view);
  }

  await initView(currentProjection, currentBasemapKind);
})().catch((err) => {
  console.error("Map failed to initialize:", err);
});
