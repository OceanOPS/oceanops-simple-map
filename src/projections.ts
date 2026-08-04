export const PROJECTION_3D_GLOBE = "3d-globe" as const;
export const PROJECTION_WEB_MERCATOR = "web-mercator" as const;

export type ProjectionId =
  | typeof PROJECTION_3D_GLOBE
  | typeof PROJECTION_WEB_MERCATOR;

export function is3dProjection(projection: ProjectionId): boolean {
  return projection === PROJECTION_3D_GLOBE;
}

export function toggleProjection(projection: ProjectionId): ProjectionId {
  return projection === PROJECTION_3D_GLOBE
    ? PROJECTION_WEB_MERCATOR
    : PROJECTION_3D_GLOBE;
}
