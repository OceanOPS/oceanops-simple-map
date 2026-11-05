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
import {
  createFlatTileLayer,
  getFlatTileHandoffScale,
  isFlatBasemapTilesEnabled,
  type FlatTileProjection,
} from "./flatBasemapTiles";
import { PACIFIC_CENTRAL_MERIDIAN } from "./projections";

export const OCEAN_MAP_SERVER =
  "https://services.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer";

export const SATELLITE_MAP_SERVER =
  "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer";

/** Avoid MapServer export cap (2048) misaligning basemap vs GeoJSON on large / hi-DPI views. */
export const FLAT_MAP_IMAGE_MAX_SIZE = 4096;

export function createFlatMapImageLayer(url: string): MapImageLayer {
  return new MapImageLayer({
    url,
    sublayers: [{ id: 0, legendEnabled: false }],
    imageMaxWidth: FLAT_MAP_IMAGE_MAX_SIZE,
    imageMaxHeight: FLAT_MAP_IMAGE_MAX_SIZE,
  });
}

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

export const FLAT_BASEMAP_MAP_LAYER_ID = "flat-basemap-map";
export const FLAT_BASEMAP_SATELLITE_LAYER_ID = "flat-basemap-satellite";
/** MapServer export layers that take over below the finest pre-rendered tile level. */
export const FLAT_BASEMAP_DETAIL_MAP_LAYER_ID = "flat-basemap-detail-map";
export const FLAT_BASEMAP_DETAIL_SATELLITE_LAYER_ID = "flat-basemap-detail-satellite";

export type FlatBasemapKind = "map" | "satellite";

/**
 * Ocean + satellite basemaps for a flat projection.
 *
 * With `VITE_FLAT_BASEMAP_TILES_URL` set: tiles from the basemap-tiles service for overview
 * levels, plus MapServer export below the handoff scale. With tiles off or unset: MapServer
 * export at every scale (dev fallback).
 */
export function addDualMapImageBasemaps(
  group: GroupLayer,
  activeKind: FlatBasemapKind,
  projection: FlatTileProjection
): void {
  const mapExport = createFlatMapImageLayer(OCEAN_MAP_SERVER);
  const satelliteExport = createFlatMapImageLayer(SATELLITE_MAP_SERVER);

  if (!isFlatBasemapTilesEnabled()) {
    mapExport.id = FLAT_BASEMAP_MAP_LAYER_ID;
    satelliteExport.id = FLAT_BASEMAP_SATELLITE_LAYER_ID;
    mapExport.visible = activeKind === "map";
    satelliteExport.visible = activeKind === "satellite";
    group.addMany([mapExport, satelliteExport]);
    return;
  }

  const mapTiles = createFlatTileLayer(projection, "map", FLAT_BASEMAP_MAP_LAYER_ID);
  const satelliteTiles = createFlatTileLayer(
    projection,
    "satellite",
    FLAT_BASEMAP_SATELLITE_LAYER_ID
  );

  const handoffScale = getFlatTileHandoffScale(projection);
  mapExport.id = FLAT_BASEMAP_DETAIL_MAP_LAYER_ID;
  satelliteExport.id = FLAT_BASEMAP_DETAIL_SATELLITE_LAYER_ID;
  mapExport.minScale = handoffScale;
  satelliteExport.minScale = handoffScale;

  mapTiles.visible = activeKind === "map";
  mapExport.visible = activeKind === "map";
  satelliteTiles.visible = activeKind === "satellite";
  satelliteExport.visible = activeKind === "satellite";

  group.addMany([mapTiles, satelliteTiles, mapExport, satelliteExport]);
}

/** Toggle visibility instead of remove/add (avoids MapServer loader + UI churn). */
export function applyFlatBasemapKindToGroup(
  group: GroupLayer,
  kind: FlatBasemapKind
): boolean {
  const mapLayer = group.findLayerById(FLAT_BASEMAP_MAP_LAYER_ID);
  const satelliteLayer = group.findLayerById(FLAT_BASEMAP_SATELLITE_LAYER_ID);
  if (!mapLayer || !satelliteLayer) return false;
  mapLayer.visible = kind === "map";
  satelliteLayer.visible = kind === "satellite";

  const detailMap = group.findLayerById(FLAT_BASEMAP_DETAIL_MAP_LAYER_ID);
  const detailSatellite = group.findLayerById(FLAT_BASEMAP_DETAIL_SATELLITE_LAYER_ID);
  if (detailMap) detailMap.visible = kind === "map";
  if (detailSatellite) detailSatellite.visible = kind === "satellite";
  return true;
}

/**
 * Ships as a plain layer rather than a `Basemap`: a `Basemap` reports the MapServer's
 * cached Web Mercator spatial reference, which the 4326 view rejects.
 */
export function createPlateCarreeBasemapGroup(kind: FlatBasemapKind) {
  const group = new GroupLayer({
    id: PLATE_CARREE_BASEMAP_GROUP_ID,
    listMode: "hide",
  });
  addDualMapImageBasemaps(group, kind, "plate-carree");
  return group;
}
