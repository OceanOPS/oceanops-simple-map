import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import EsriMap from "@arcgis/core/Map.js";
import type SceneView from "@arcgis/core/views/SceneView.js";
import { categories, type Category, type Shape } from "./categories";
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
import { LINE_3D_WIDTH_METERS, makeCategoryRenderer, makeGoshipLineRenderer, makeOceanTraxLineRenderer } from "./renderers";
import type { GlobeView, ViewHolder } from "./viewHolder";
import { fitViewInitialExtent, refreshViewLayout } from "./viewLayout";
import { applyProjectionShellLayout } from "./projectionLayout";

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

function createGeoJsonLayer(cat: Category, projection: ProjectionId): GeoJSONLayer {
  const kind =
    cat.type === "image" ? "image" : cat.type === "line" ? "line" : "point";
  const renderer =
    cat.id === "goship"
      ? makeGoshipLineRenderer(projection, cat.color)
      : cat.id === "oceantrax"
        ? makeOceanTraxLineRenderer(projection, cat.color)
        : makeCategoryRenderer(
          projection,
          kind,
          cat.color,
          cat.type === "image" ? cat.imagePath : undefined,
          cat.type === "point" ? ((cat.shape ?? "circle") as Shape) : undefined
        );

  const layer = new GeoJSONLayer({
    url: geojsonLayerUrl(cat, projection),
    title: cat.label,
    outFields: ["*"],
    renderer,
    popupTemplate:
      cat.type === "line"
        ? lineLayerPopupTemplate(cat)
        : {
            title: "{ptf_ref}",
            content: platformPopupContent(cat),
          },
  });

  if (is3dProjection(projection)) {
    layer.elevationInfo =
      cat.type === "line"
        ? { mode: "on-the-ground" }
        : {
            mode: "absolute-height",
            featureExpressionInfo: { expression: "0" },
            // Clear the line path tubes so platforms never z-fight with them while the globe rotates.
            offset: LINE_3D_WIDTH_METERS,
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

  for (const cat of categories) {
    const layer = createGeoJsonLayer(cat as Category, projection);
    map.add(layer);
    layerById.set(cat.id, layer);
    layerPromises.push(layer.when());
  }

  await Promise.all(layerPromises);
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

  const attachLegendToView = () => {
    attachLegend(
      viewHolder,
      layerById,
      () => rotationApi.toggleRotation(),
      () => rotationApi.isRotating(),
      (cb) => rotationApi.setRotationStateChangeCallback(cb),
      () => rotationApi.stopRotation(),
      () => currentProjection
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
    });

    rotationApi = createRotationController(viewHolder, () => currentProjection);
    if (!is3dProjection(projection)) {
      rotationApi.stopRotation();
    }
    attachLegendToView();
  }

  async function swapProjection(projection: ProjectionId) {
    rotationApi.stopRotation();

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
