import Extent from "@arcgis/core/geometry/Extent.js";
import SpatialReference from "@arcgis/core/geometry/SpatialReference.js";
import MapView from "@arcgis/core/views/MapView.js";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";
import {
  EQUAL_EARTH_WORLD_EXTENT,
  EQUAL_EARTH_WORLD_X_SPAN,
  EQUAL_EARTH_WORLD_Y_SPAN,
} from "./equalEarthBasemap";
import {
  PLATE_CARREE_CENTER_LONGITUDE,
  PLATE_CARREE_WORLD_EXTENT,
} from "./plateCarreeBasemap";
import {
  isEqualEarthProjection,
  isPlateCarreeProjection,
  type ProjectionId,
} from "./projections";
import type { GlobeView } from "./viewHolder";

const WORLD_LON_SPAN = 360;
const WORLD_LAT_SPAN = 180;
/** Matches `#viewDiv` width/margin transition in `style.css`. */
const SHELL_TRANSITION_MS = 320;

let flatWorldLayoutRefitting = false;

export function isFlatWorldLayoutRefitting(): boolean {
  return flatWorldLayoutRefitting;
}

async function withFlatWorldLayoutRefitting<T>(fn: () => Promise<T>): Promise<T> {
  flatWorldLayoutRefitting = true;
  try {
    return await fn();
  } finally {
    flatWorldLayoutRefitting = false;
  }
}

export function clearFlatViewDivWidthLimit(): void {
  const viewDiv = document.getElementById("viewDiv");
  if (!viewDiv) return;
  viewDiv.style.removeProperty("max-width");
  viewDiv.style.removeProperty("margin-right");
}

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

  // Full-world longitude span: keep xmin/xmax in [-180, 180] (MapView goTo hangs on e.g. -330..30).
  if (halfLon >= WORLD_LON_SPAN / 2 - 1e-9) {
    return new Extent({
      xmin: -180,
      ymin: -halfLat,
      xmax: 180,
      ymax: halfLat,
      spatialReference: SpatialReference.WGS84,
    });
  }

  return new Extent({
    xmin: centerLongitude - halfLon,
    ymin: -halfLat,
    xmax: centerLongitude + halfLon,
    ymax: halfLat,
    spatialReference: SpatialReference.WGS84,
  });
}

/** Extent that fills the viewport while keeping the full Equal Earth world in frame. */
export function equalEarthExtentForViewport(width: number, height: number): Extent {
  const aspect = width / height;
  const worldAspect = EQUAL_EARTH_WORLD_X_SPAN / EQUAL_EARTH_WORLD_Y_SPAN;

  const ySpan =
    aspect > worldAspect
      ? Math.min(EQUAL_EARTH_WORLD_Y_SPAN, EQUAL_EARTH_WORLD_X_SPAN / aspect)
      : EQUAL_EARTH_WORLD_Y_SPAN;

  const halfY = ySpan / 2;
  const halfX = EQUAL_EARTH_WORLD_X_SPAN / 2;

  return new Extent({
    xmin: -halfX,
    ymin: -halfY,
    xmax: halfX,
    ymax: halfY,
    spatialReference: EQUAL_EARTH_WORLD_EXTENT.spatialReference,
  });
}

/** Fit Equal Earth to the shell and lock zoom-out at that framing. */
export async function fitEqualEarthView(view: MapView): Promise<void> {
  await withFlatWorldLayoutRefitting(async () => {
    await view.when();

    clearFlatViewDivWidthLimit();
    await refreshViewLayout(view);

    const fittedExtent =
      view.width && view.height
        ? equalEarthExtentForViewport(view.width, view.height)
        : EQUAL_EARTH_WORLD_EXTENT.clone();
    await view.goTo(fittedExtent, { animate: false });

    view.constraints.geometry = EQUAL_EARTH_WORLD_EXTENT.clone();
    view.constraints.minScale = view.scale;
  });
}

/** Fit Plate Carrée to the shell and lock zoom-out at that framing. */
export async function fitPlateCarreeView(view: MapView): Promise<void> {
  await withFlatWorldLayoutRefitting(async () => {
    await view.when();

    clearFlatViewDivWidthLimit();
    await refreshViewLayout(view);

    const fittedExtent =
      view.width && view.height
        ? plateCarreeExtentForViewport(
            view.width,
            view.height,
            PLATE_CARREE_CENTER_LONGITUDE
          )
        : PLATE_CARREE_WORLD_EXTENT.clone();
    await view.goTo(fittedExtent, { animate: false });

    if (PLATE_CARREE_CENTER_LONGITUDE !== 0) {
      await view
        .goTo(
          { center: [PLATE_CARREE_CENTER_LONGITUDE, 0], scale: view.scale },
          { animate: false }
        )
        .catch(() => {});
    }

    view.constraints.geometry = PLATE_CARREE_WORLD_EXTENT.clone();
    view.constraints.minScale = view.scale;
  });
}

function isFlatWorldScale(mapView: MapView): boolean {
  const minScale = mapView.constraints.minScale;
  if (minScale == null) return true;
  return mapView.scale >= minScale * 0.995;
}

/** Re-fit a world-framed flat view when the map shell changes size (menu open/close, resize). */
export async function reflowFlatWorldViewIfWorldScale(
  view: GlobeView,
  projection: ProjectionId
): Promise<void> {
  if (view.type !== "2d" || flatWorldLayoutRefitting) return;

  const mapView = view as MapView;
  await refreshViewLayout(mapView);
  if (!isFlatWorldScale(mapView)) return;

  if (isPlateCarreeProjection(projection)) {
    await fitPlateCarreeView(mapView);
    return;
  }
  if (isEqualEarthProjection(projection)) {
    await fitEqualEarthView(mapView);
  }
}

/** @deprecated Use reflowFlatWorldViewIfWorldScale */
export async function reflowPlateCarreeIfWorldScale(
  view: GlobeView,
  projection: ProjectionId
): Promise<void> {
  await reflowFlatWorldViewIfWorldScale(view, projection);
}

/** @deprecated Use bindFlatWorldLayoutSync */
export function bindPlateCarreeLayoutSync(
  view: GlobeView,
  getProjection: () => ProjectionId
): () => void {
  return bindFlatWorldLayoutSync(view, getProjection);
}

/**
 * Refit Plate Carrée / Equal Earth when `#viewDiv` resizes while at world scale.
 */
export function bindFlatWorldLayoutSync(
  view: GlobeView,
  getProjection: () => ProjectionId
): () => void {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const schedule = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (flatWorldLayoutRefitting) return;
      void reflowFlatWorldViewIfWorldScale(view, getProjection());
    }, SHELL_TRANSITION_MS);
  };

  const sizeWatch = reactiveUtils.watch(
    () => [view.width, view.height] as const,
    schedule
  );

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    sizeWatch.remove();
  };
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

  if (isEqualEarthProjection(projection)) {
    if (view.type === "2d") {
      await fitEqualEarthView(view as MapView);
    }
    return;
  }

  if (layerUnion) {
    await view.goTo(layerUnion, { animate: false, duration: 0 }).catch(() => {});
  }
}
