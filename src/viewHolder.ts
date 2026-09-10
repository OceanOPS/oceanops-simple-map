import type MapView from "@arcgis/core/views/MapView.js";
import type SceneView from "@arcgis/core/views/SceneView.js";

export type GlobeView = SceneView | MapView;

/** Mutable ref so legend / controls survive projection swaps. */
export type ViewHolder = { view: GlobeView };
