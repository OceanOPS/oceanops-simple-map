/**
 * Pacific-centered flat map (150°W). Uses the same ArcGIS Ocean MapServer as Web Mercator
 * (CDN tiles: …/World_Ocean_Base/MapServer/tile/{level}/{row}/{col}).
 */
import Basemap from "@arcgis/core/Basemap.js";
import TileLayer from "@arcgis/core/layers/TileLayer.js";
import { PACIFIC_CENTRAL_MERIDIAN } from "./projections";

export const OCEAN_MAP_SERVER =
  "https://services.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer";

export const SATELLITE_MAP_SERVER =
  "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer";

export function createOceanTileLayer() {
  return new TileLayer({ url: OCEAN_MAP_SERVER });
}

export function createSatelliteTileLayer() {
  return new TileLayer({ url: SATELLITE_MAP_SERVER });
}

export function createPacificOceanBasemap() {
  return new Basemap({
    baseLayers: [createOceanTileLayer()],
    referenceLayers: [],
  });
}

export function createPacificSatelliteBasemap() {
  return new Basemap({
    baseLayers: [createSatelliteTileLayer()],
    referenceLayers: [],
  });
}

/** Default Pacific flat-map center (150°W). */
export const PLATE_CARREE_DEFAULT_CENTER: [number, number] = [
  PACIFIC_CENTRAL_MERIDIAN,
  20,
];
