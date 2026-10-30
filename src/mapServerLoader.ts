import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";
import GroupLayer from "@arcgis/core/layers/GroupLayer.js";
import { EQUAL_EARTH_BASEMAP_GROUP_ID } from "./equalEarthBasemap";
import { PLATE_CARREE_BASEMAP_GROUP_ID } from "./plateCarreeBasemap";
import {
  isCustomFlatBasemapProjection,
  type ProjectionId,
} from "./projections";
import type { GlobeView } from "./viewHolder";

const SHOW_DELAY_MS = 200;
const HIDE_DELAY_MS = 150;

const MAP_IMAGE_BASEMAP_GROUP_IDS = [
  PLATE_CARREE_BASEMAP_GROUP_ID,
  EQUAL_EARTH_BASEMAP_GROUP_ID,
] as const;

function findMapImageBasemapLayer(map: __esri.Map | null | undefined) {
  for (const groupId of MAP_IMAGE_BASEMAP_GROUP_IDS) {
    const group = map?.findLayerById(groupId) as GroupLayer | undefined;
    const layer = group?.layers.getItemAt(0);
    if (layer?.type === "map-image") return layer;
  }
  return undefined;
}

/** Shown while a flat MapImageLayer basemap waits on MapServer export. */
export function mountMapServerLoader(
  shell: HTMLElement,
  view: GlobeView,
  getProjection: () => ProjectionId
): () => void {
  const overlay = document.createElement("div");
  overlay.className = "o-mapserver-loader";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <div class="o-mapserver-loader__bar" aria-hidden="true"></div>
    <div class="o-mapserver-loader__panel">
      <div class="o-mapserver-loader__ring" aria-hidden="true"></div>
      <span class="o-mapserver-loader__label">Loading map</span>
    </div>
  `;
  shell.appendChild(overlay);

  let showTimer: ReturnType<typeof setTimeout> | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let layerWatch: __esri.WatchHandle | null = null;
  let attachGeneration = 0;

  const setVisible = (visible: boolean) => {
    overlay.classList.toggle("is-active", visible);
    overlay.setAttribute("aria-hidden", visible ? "false" : "true");
  };

  const cancelShow = () => {
    if (showTimer) {
      clearTimeout(showTimer);
      showTimer = null;
    }
  };

  const cancelHide = () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  };

  const onUpdating = (updating: boolean) => {
    if (!isCustomFlatBasemapProjection(getProjection()) || !updating) {
      cancelShow();
      if (!overlay.classList.contains("is-active")) return;
      cancelHide();
      hideTimer = setTimeout(() => {
        hideTimer = null;
        setVisible(false);
      }, HIDE_DELAY_MS);
      return;
    }

    cancelHide();
    if (overlay.classList.contains("is-active") || showTimer) return;

    showTimer = setTimeout(() => {
      showTimer = null;
      setVisible(true);
    }, SHOW_DELAY_MS);
  };

  const attachToBasemap = () => {
    layerWatch?.remove();
    layerWatch = null;
    attachGeneration += 1;
    const generation = attachGeneration;

    const layer = findMapImageBasemapLayer(view.map);

    if (!layer || view.type !== "2d") {
      onUpdating(false);
      return;
    }

    void view.whenLayerView(layer).then((layerView) => {
      if (generation !== attachGeneration) return;

      layerWatch = reactiveUtils.watch(
        () => layerView.updating,
        onUpdating,
        { initial: true }
      );
    });
  };

  const mapWatch = reactiveUtils.watch(
    () => {
      const layer = findMapImageBasemapLayer(view.map);
      return `${layer?.id ?? ""}:${layer?.type ?? ""}`;
    },
    attachToBasemap,
    { initial: true }
  );

  return () => {
    cancelShow();
    cancelHide();
    attachGeneration += 1;
    layerWatch?.remove();
    mapWatch.remove();
    overlay.remove();
  };
}
