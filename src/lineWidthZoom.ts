import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";
import type GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import type SceneView from "@arcgis/core/views/SceneView.js";
import { categories } from "./categories";
import {
  GLOBE_CAMERA_Z_REF,
  lineSizePxForCameraZ,
  makeGoshipLineRenderer,
  makeOceanTraxLineRenderer,
} from "./renderers";
import { is3dProjection, PROJECTION_3D_GLOBE, type ProjectionId } from "./projections";
import type { GlobeView } from "./viewHolder";

const DUAL_LINE_LAYER_IDS = new Set(["goship", "oceantrax"]);

/** Scale ship line width with globe camera altitude (thin when de-zoomed). */
export function bindGlobeLineWidthZoomSync(
  view: GlobeView,
  layerById: Map<string, GeoJSONLayer>,
  getProjection: () => ProjectionId
): () => void {
  let lastSize = -1;

  const apply = (cameraZ: number) => {
    if (!is3dProjection(getProjection()) || view.type !== "3d") return;

    const lineSizePx = lineSizePxForCameraZ(cameraZ);
    if (lineSizePx === lastSize) return;
    lastSize = lineSizePx;

    for (const cat of categories) {
      if (cat.type !== "line" || !DUAL_LINE_LAYER_IDS.has(cat.id)) continue;
      const layer = layerById.get(cat.id);
      if (!layer) continue;

      layer.renderer =
        cat.id === "goship"
          ? makeGoshipLineRenderer(PROJECTION_3D_GLOBE, cat.color, lineSizePx)
          : makeOceanTraxLineRenderer(PROJECTION_3D_GLOBE, cat.color, lineSizePx);
    }
  };

  const sceneView = view as SceneView;
  const watch = reactiveUtils.watch(
    () => sceneView.camera?.position?.z ?? GLOBE_CAMERA_Z_REF,
    (cameraZ) => apply(cameraZ),
    { initial: true }
  );

  return () => watch.remove();
}
