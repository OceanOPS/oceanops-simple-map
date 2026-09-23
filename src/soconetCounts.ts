import type GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import { queryMooringLayerCount } from "./mooringStacks";

export type SoconetPlatformCounts = {
  shipCount: number;
  mooringCount: number;
  total: number;
};

/** Count every SOCONET platform (cruises + mooring sites), including co-located stacks. */
export async function querySoconetPlatformCounts(
  layerById: ReadonlyMap<string, GeoJSONLayer>,
  where: string
): Promise<SoconetPlatformCounts> {
  const shipLayer = layerById.get("soconet");
  if (!shipLayer) {
    throw new Error("SOCONET cruise layer is not available");
  }

  const [shipCount, mooringCount] = await Promise.all([
    shipLayer.queryFeatureCount({ where }),
    queryMooringLayerCount("soconet_moorings", layerById, where),
  ]);

  return {
    shipCount,
    mooringCount,
    total: shipCount + mooringCount,
  };
}
