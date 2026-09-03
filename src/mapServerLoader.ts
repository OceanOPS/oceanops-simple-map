import * as reactiveUtils from "@arcgis/core/core/reactiveUtils.js";
import GroupLayer from "@arcgis/core/layers/GroupLayer.js";
import { PLATE_CARREE_BASEMAP_GROUP_ID } from "./plateCarreeBasemap";
import { isPlateCarreeProjection, type ProjectionId } from "./projections";
import type { GlobeView } from "./viewHolder";

const SHOW_DELAY_MS = 200;
const HIDE_DELAY_MS = 150;

/** Shown while the Plate Carrée MapImageLayer waits on MapServer export. */
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
    if (!isPlateCarreeProjection(getProjection()) || !updating) {
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

    const group = view.map?.findLayerById(
      PLATE_CARREE_BASEMAP_GROUP_ID
    ) as GroupLayer | undefined;
    const layer = group?.layers.getItemAt(0);

    if (layer?.type !== "map-image" || view.type !== "2d") {
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
      const group = view.map?.findLayerById(
        PLATE_CARREE_BASEMAP_GROUP_ID
      ) as GroupLayer | undefined;
      return `${group?.layers.length ?? 0}:${group?.layers.getItemAt(0)?.id ?? ""}`;
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
