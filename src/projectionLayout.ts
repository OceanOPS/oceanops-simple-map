import {
  is3dProjection,
  isCustomFlatBasemapProjection,
  type ProjectionId,
} from "./projections";

/** Flat map uses a 2:1 shell; globe fills the viewport (sphere layout). */
export function applyProjectionShellLayout(projection: ProjectionId): void {
  document.body.classList.remove(
    "flat-projection",
    "globe-projection",
    "flat-mapserver-basemap"
  );
  if (is3dProjection(projection)) {
    document.body.classList.add("globe-projection");
    return;
  }
  document.body.classList.add("flat-projection");
  if (isCustomFlatBasemapProjection(projection)) {
    document.body.classList.add("flat-mapserver-basemap");
  }
}
