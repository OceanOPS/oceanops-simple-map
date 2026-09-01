import Extent from "@arcgis/core/geometry/Extent.js";
import SpatialReference from "@arcgis/core/geometry/SpatialReference.js";
import MapView from "@arcgis/core/views/MapView.js";
import {
  PLATE_CARREE_CENTER_LONGITUDE,
  PLATE_CARREE_WORLD_EXTENT,
} from "./plateCarreeBasemap";
import {
  is3dProjection,
  isPlateCarreeProjection,
  type ProjectionId,
} from "./projections";
import type { GlobeView } from "./viewHolder";

const WORLD_LON_SPAN = 360;
const WORLD_LAT_SPAN = 180;

/** Extent that fills the viewport width (no side gaps) while keeping a 360° longitude window. */
export function plateCarreeExtentForViewport(
  width: number,
  height: number,
  centerLongitude: number = PLATE_CARREE_CENTER_LONGITUDE
): Extent {
  const aspect = width / height;
  const worldAspect = WORLD_LON_SPAN / WORLD_LAT_SPAN;

  // Wider than 2:1 → fill width and trim latitude; narrower → full ±90°.
  const latSpan =
    aspect > worldAspect
      ? Math.min(WORLD_LAT_SPAN, WORLD_LON_SPAN / aspect)
      : WORLD_LAT_SPAN;

  const halfLat = latSpan / 2;
  const halfLon = WORLD_LON_SPAN / 2;

  return new Extent({
    xmin: centerLongitude - halfLon,
    ymin: -halfLat,
    xmax: centerLongitude + halfLon,
    ymax: halfLat,
    spatialReference: SpatialReference.WGS84,
  });
}

/** Fit Plate Carrée to the shell and lock zoom-out at that framing. */
export async function fitPlateCarreeView(view: MapView): Promise<void> {
  await view.when();

  const extent =
    view.width && view.height
      ? plateCarreeExtentForViewport(
          view.width,
          view.height,
          PLATE_CARREE_CENTER_LONGITUDE
        )
      : PLATE_CARREE_WORLD_EXTENT.clone();

  await view.goTo(extent, { animate: false });

  view.constraints.geometry = PLATE_CARREE_WORLD_EXTENT.clone();
  view.constraints.minScale = view.scale;
}

/** MapView often mounts at wrong size until resize (especially after SceneView → MapView). */
export async function refreshViewLayout(view: GlobeView): Promise<void> {
  await view.when();
  if ("resize" in view && typeof view.resize === "function") {
    view.resize();
  }

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      if ("resize" in view && typeof view.resize === "function") {
        view.resize();
      }
      resolve();
    });
  });

  window.dispatchEvent(new Event("resize"));
}

export async function fitViewInitialExtent(
  view: GlobeView,
  projection: ProjectionId,
  layerUnion: __esri.Extent | null
): Promise<void> {
  if (isPlateCarreeProjection(projection)) {
    if (view.type === "2d") {
      await fitPlateCarreeView(view as MapView);
    }
    return;
  }

  if (!is3dProjection(projection)) {
    await view.goTo({ center: [0, 20], zoom: 3 }, { animate: false });
    return;
  }

  if (layerUnion) {
    await view.goTo(layerUnion, { animate: false, duration: 0 }).catch(() => {});
  }
}
