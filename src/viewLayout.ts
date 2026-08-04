import { is3dProjection, type ProjectionId } from "./projections";
import type { GlobeView } from "./viewHolder";

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
  if (!is3dProjection(projection)) {
    await view.goTo(
      {
        center: [0, 20],
        zoom: 3,
      },
      { animate: false }
    );
    return;
  }

  if (layerUnion) {
    await view.goTo(layerUnion, { animate: false, duration: 0 }).catch(() => {});
  }
}
