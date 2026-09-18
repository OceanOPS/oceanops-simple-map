export const PROJECTION_3D_GLOBE = "3d-globe" as const;
export const PROJECTION_WEB_MERCATOR = "web-mercator" as const;
/** Plate Carrée (EPSG:4326), view centered on the Pacific. */
export const PROJECTION_PLATE_CARREE_PACIFIC = "plate-carree-pacific" as const;
/** Equal Earth (equal-area), Pacific-centred (150°W). */
export const PROJECTION_EQUAL_EARTH = "equal-earth" as const;

/** Central meridian for the Pacific Plate Carrée view (150°W). */
export const PACIFIC_CENTRAL_MERIDIAN = -150;

export type ProjectionId =
  | typeof PROJECTION_3D_GLOBE
  | typeof PROJECTION_WEB_MERCATOR
  | typeof PROJECTION_PLATE_CARREE_PACIFIC
  | typeof PROJECTION_EQUAL_EARTH;

export const PROJECTION_CYCLE: readonly ProjectionId[] = [
  PROJECTION_3D_GLOBE,
  PROJECTION_WEB_MERCATOR,
  PROJECTION_PLATE_CARREE_PACIFIC,
  PROJECTION_EQUAL_EARTH,
];

export function is3dProjection(projection: ProjectionId): boolean {
  return projection === PROJECTION_3D_GLOBE;
}

export function isWebMercatorProjection(projection: ProjectionId): boolean {
  return projection === PROJECTION_WEB_MERCATOR;
}

export function isPlateCarreeProjection(projection: ProjectionId): boolean {
  return projection === PROJECTION_PLATE_CARREE_PACIFIC;
}

export function isEqualEarthProjection(projection: ProjectionId): boolean {
  return projection === PROJECTION_EQUAL_EARTH;
}

/** Flat views with a custom basemap layer (not Web Mercator `map.basemap`). */
export function isCustomFlatBasemapProjection(projection: ProjectionId): boolean {
  return isPlateCarreeProjection(projection) || isEqualEarthProjection(projection);
}

export function isFlatProjection(projection: ProjectionId): boolean {
  return !is3dProjection(projection);
}

/** Cycle Globe → Web Mercator → Plate Carrée → Equal Earth → Globe. */
export function toggleProjection(projection: ProjectionId): ProjectionId {
  const index = PROJECTION_CYCLE.indexOf(projection);
  return PROJECTION_CYCLE[(index + 1) % PROJECTION_CYCLE.length];
}

export function projectionLabel(projection: ProjectionId): string {
  switch (projection) {
    case PROJECTION_3D_GLOBE:
      return "3D Globe";
    case PROJECTION_WEB_MERCATOR:
      return "Web Mercator";
    case PROJECTION_PLATE_CARREE_PACIFIC:
      return "Plate Carrée (150°W)";
    case PROJECTION_EQUAL_EARTH:
      return "Equal Earth (150°W)";
  }
}
