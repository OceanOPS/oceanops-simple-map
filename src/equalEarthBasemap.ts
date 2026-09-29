/**
 * Equal Earth flat-map basemap.
 *
 * Same ocean / satellite MapServer pair as Plate Carrée — dynamic export in the view's
 * Equal Earth spatial reference (not the separate Equal Earth vector thematic basemap).
 */
import Extent from "@arcgis/core/geometry/Extent.js";
import SpatialReference from "@arcgis/core/geometry/SpatialReference.js";
import GroupLayer from "@arcgis/core/layers/GroupLayer.js";
import {
  createFlatMapImageLayer,
  OCEAN_MAP_SERVER,
  SATELLITE_MAP_SERVER,
} from "./plateCarreeBasemap";
import { PACIFIC_CENTRAL_MERIDIAN } from "./projections";

/** Pacific-centred Equal Earth (150°W), aligned with Plate Carrée framing. */
export const EQUAL_EARTH_CENTER_LONGITUDE = PACIFIC_CENTRAL_MERIDIAN;

const EQUAL_EARTH_WKT = `PROJCS["Equal Earth (world)_2",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Equal_Earth"],PARAMETER["False_Easting",0.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",${EQUAL_EARTH_CENTER_LONGITUDE}],UNIT["Meter",1.0]]`;

export const EQUAL_EARTH_SPATIAL_REFERENCE = new SpatialReference({ wkt: EQUAL_EARTH_WKT });

const HALF_WORLD_X = 1.724_395_856_221_439e7;
const HALF_WORLD_Y = 8_392_927.098_466_456;

/** Full Equal Earth world extent from ArcGIS Equal Earth tile services. */
export const EQUAL_EARTH_WORLD_EXTENT = new Extent({
  xmin: -HALF_WORLD_X,
  ymin: -HALF_WORLD_Y,
  xmax: HALF_WORLD_X,
  ymax: HALF_WORLD_Y,
  spatialReference: EQUAL_EARTH_SPATIAL_REFERENCE,
});

export const EQUAL_EARTH_WORLD_X_SPAN = HALF_WORLD_X * 2;
export const EQUAL_EARTH_WORLD_Y_SPAN = HALF_WORLD_Y * 2;

/** Id used to find the basemap group when stacking operational layers. */
export const EQUAL_EARTH_BASEMAP_GROUP_ID = "equal-earth-basemap-group";

export function createEqualEarthBasemapGroup(kind: "map" | "satellite") {
  const group = new GroupLayer({
    id: EQUAL_EARTH_BASEMAP_GROUP_ID,
    listMode: "hide",
  });
  group.add(
    createFlatMapImageLayer(
      kind === "satellite" ? SATELLITE_MAP_SERVER : OCEAN_MAP_SERVER
    )
  );
  return group;
}
