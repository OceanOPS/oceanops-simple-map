/**
 * Flat-map basemaps.
 *
 * Web Mercator uses the cached ArcGIS tiles. Plate Carrée cannot: the caches are Web
 * Mercator only, and reprojecting them clientside is what caps the map at ~±85° and hides
 * Antarctica. `MapImageLayer` instead asks the same MapServer to render each extent in the
 * view's own spatial reference, so the whole world fits a 360x180 frame.
 */
import Extent from "@arcgis/core/geometry/Extent.js";
import GroupLayer from "@arcgis/core/layers/GroupLayer.js";
import MapImageLayer from "@arcgis/core/layers/MapImageLayer.js";
import SpatialReference from "@arcgis/core/geometry/SpatialReference.js";
import TileLayer from "@arcgis/core/layers/TileLayer.js";
import { PACIFIC_CENTRAL_MERIDIAN } from "./projections";

export const OCEAN_MAP_SERVER =
  "https://services.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer";

export const SATELLITE_MAP_SERVER =
  "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer";

export function createOceanTileLayer() {
  return new TileLayer({ url: OCEAN_MAP_SERVER });
}

/** Whole world in degrees — the natural 2:1 Plate Carrée frame, poles included. */
export const PLATE_CARREE_WORLD_EXTENT = new Extent({
  xmin: -180,
  ymin: -90,
  xmax: 180,
  ymax: 90,
  spatialReference: SpatialReference.WGS84,
});

/** Longitude the Plate Carrée view opens on. Set to 0 for a standard Atlantic-centred world. */
export const PLATE_CARREE_CENTER_LONGITUDE: number = PACIFIC_CENTRAL_MERIDIAN;

/** Id used to find and swap the basemap group when the map/satellite toggle fires. */
export const PLATE_CARREE_BASEMAP_GROUP_ID = "basemap-group";

/**
 * Ships as a plain layer rather than a `Basemap`: a `Basemap` reports the MapServer's
 * cached Web Mercator spatial reference, which the 4326 view rejects.
 */
export function createPlateCarreeBasemapGroup(kind: "map" | "satellite") {
  const group = new GroupLayer({
    id: PLATE_CARREE_BASEMAP_GROUP_ID,
    listMode: "hide",
  });
  group.add(
    new MapImageLayer({
      url: kind === "satellite" ? SATELLITE_MAP_SERVER : OCEAN_MAP_SERVER,
      sublayers: [{ id: 0, legendEnabled: false }],
    })
  );
  return group;
}
