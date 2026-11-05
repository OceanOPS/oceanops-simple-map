import Extent from "@arcgis/core/geometry/Extent.js";
import Point from "@arcgis/core/geometry/Point.js";
import SpatialReference from "@arcgis/core/geometry/SpatialReference.js";
import { PACIFIC_CENTRAL_MERIDIAN } from "./projections";

const WGS84 = SpatialReference.WGS84;

/** Keep longitudes in one 360° window around the Pacific map center (Plate Carrée / Equal Earth). */
export function normalizeLongitudeForPacificView(
  lon: number,
  centralMeridian = PACIFIC_CENTRAL_MERIDIAN
): number {
  let x = lon;
  while (x - centralMeridian > 180) x -= 360;
  while (x - centralMeridian < -180) x += 360;
  return x;
}

function pathsFromGeometry(geometry: __esri.Geometry): number[][][] {
  if (geometry.type === "polyline") {
    return ((geometry as __esri.Polyline).paths ?? []) as number[][][];
  }
  if (geometry.type === "multipoint") {
    const points = (geometry as __esri.Multipoint).points ?? [];
    return points.length ? [points as number[][]] : [];
  }
  if (geometry.type === "point") {
    const p = geometry as __esri.Point;
    const lon = p.longitude ?? 0;
    const lat = p.latitude ?? 0;
    return [[[lon, lat]]];
  }
  return [];
}

export type LineFlyToTarget = {
  goTo: __esri.Geometry | __esri.Extent;
  popupLocation: __esri.Point;
};

/**
 * GO-SHIP / OceanTraX lines that cross the dateline often include both −180° and +180°
 * vertices. ArcGIS extent then spans the world at that latitude and search “Zoom to”
 * lands on the wrong meridian (e.g. Africa instead of the Pacific).
 */
export function lineFlyToTarget(
  geometry: __esri.Geometry,
  usePacificFlatView: boolean
): LineFlyToTarget {
  const paths = pathsFromGeometry(geometry);
  if (paths.length === 0 || !usePacificFlatView) {
    const center =
      geometry.type === "polyline"
        ? (geometry as __esri.Polyline).extent?.center
        : geometry.extent?.center;
    const popupLocation =
      center ??
      new Point({
        longitude: 0,
        latitude: 0,
        spatialReference: WGS84,
      });
    return { goTo: geometry, popupLocation };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const path of paths) {
    for (const coord of path) {
      const lon = Number(coord[0]);
      const lat = Number(coord[1]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      const x = normalizeLongitudeForPacificView(lon);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, lat);
      maxY = Math.max(maxY, lat);
    }
  }

  if (!Number.isFinite(minX)) {
    return lineFlyToTarget(geometry, false);
  }

  const lonSpan = maxX - minX;
  const latSpan = maxY - minY;
  const padLon = Math.max(3, lonSpan * 0.12);
  const padLat = Math.max(2, (latSpan || 4) * 0.25);

  const extent = new Extent({
    xmin: minX - padLon,
    ymin: minY - padLat,
    xmax: maxX + padLon,
    ymax: maxY + padLat,
    spatialReference: WGS84,
  });

  const popupLocation = new Point({
    longitude: (minX + maxX) / 2,
    latitude: (minY + maxY) / 2,
    spatialReference: WGS84,
  });

  return { goTo: extent, popupLocation };
}
