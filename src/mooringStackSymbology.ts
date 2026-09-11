import type GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import { categories } from "./categories";
import type { ProjectionId } from "./projections";
import {
  makeMooredBuoysRenderer,
  makeOceanSitesRenderer,
  type MooringStackVisibility,
} from "./renderers";

export function getMooringStackVisibility(
  layerById: ReadonlyMap<string, GeoJSONLayer>
): MooringStackVisibility {
  return {
    oceansites: layerById.get("oceansites")?.visible ?? false,
    soconetMoorings: layerById.get("soconet_moorings")?.visible ?? false,
  };
}

/** Re-evaluate hollow vs solid mooring squares when stack partner layers are toggled. */
export function applyMooringStackSymbology(
  layerById: ReadonlyMap<string, GeoJSONLayer>,
  projection: ProjectionId
): void {
  const stackVisibility = getMooringStackVisibility(layerById);

  const mooredLayer = layerById.get("moored_buoys");
  const mooredCat = categories.find((c) => c.id === "moored_buoys");
  if (mooredLayer && mooredCat) {
    mooredLayer.renderer = makeMooredBuoysRenderer(
      projection,
      mooredCat.color,
      stackVisibility
    );
  }

  const oceansitesLayer = layerById.get("oceansites");
  const oceansitesCat = categories.find((c) => c.id === "oceansites");
  if (oceansitesLayer && oceansitesCat) {
    oceansitesLayer.renderer = makeOceanSitesRenderer(
      projection,
      oceansitesCat.color,
      { soconetMoorings: stackVisibility.soconetMoorings }
    );
  }
}

/** @deprecated Use applyMooringStackSymbology */
export function applyMooredBuoysStackSymbology(
  layerById: ReadonlyMap<string, GeoJSONLayer>,
  projection: ProjectionId
): void {
  applyMooringStackSymbology(layerById, projection);
}
