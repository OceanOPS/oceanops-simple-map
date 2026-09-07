import type Map from "@arcgis/core/Map.js";
import type GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import { categories, mapLayerStackRank } from "./categories";
import { PLATE_CARREE_BASEMAP_GROUP_ID } from "./plateCarreeBasemap";

/** Operational GeoJSON layer ids in bottom → top draw order. */
export function sortedOperationalLayerIds(): string[] {
  return categories
    .map((category, index) => ({
      id: category.id,
      rank: mapLayerStackRank(category.id, index),
    }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ id }) => id);
}

function operationalLayerBaseIndex(map: Map): number {
  const basemapGroup = map.findLayerById(PLATE_CARREE_BASEMAP_GROUP_ID);
  if (!basemapGroup) return 0;
  return map.layers.indexOf(basemapGroup) + 1;
}

/** MapView layer order (SceneView ignores this — moored buoys use a hollow ring instead). */
export function applyOperationalLayerStackOrder(
  map: Map,
  layerById: ReadonlyMap<string, GeoJSONLayer>
): void {
  const baseIndex = operationalLayerBaseIndex(map);
  const sortedIds = sortedOperationalLayerIds();

  for (let i = sortedIds.length - 1; i >= 0; i--) {
    const layer = layerById.get(sortedIds[i]);
    if (!layer || !map.layers.includes(layer)) continue;
    map.reorder(layer, baseIndex + i);
  }
}
