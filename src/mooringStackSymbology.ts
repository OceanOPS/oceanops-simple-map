import type GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import { categories } from "./categories";
import type { ProjectionId } from "./projections";
import { makeMooredBuoysRenderer, type MooringStackVisibility } from "./renderers";

export function getMooringStackVisibility(
  layerById: ReadonlyMap<string, GeoJSONLayer>
): MooringStackVisibility {
  return {
    oceansites: layerById.get("oceansites")?.visible ?? false,
    soconetMoorings: layerById.get("soconet_moorings")?.visible ?? false,
  };
}

/** Re-evaluate hollow vs solid moored buoys when stack partner layers are toggled. */
export function applyMooredBuoysStackSymbology(
  layerById: ReadonlyMap<string, GeoJSONLayer>,
  projection: ProjectionId
): void {
  const layer = layerById.get("moored_buoys");
  const cat = categories.find((c) => c.id === "moored_buoys");
  if (!layer || !cat) return;

  layer.renderer = makeMooredBuoysRenderer(
    projection,
    cat.color,
    getMooringStackVisibility(layerById)
  );
}
