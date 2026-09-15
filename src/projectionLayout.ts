import { is3dProjection, type ProjectionId } from "./projections";

/** Flat map uses a 2:1 shell; globe fills the viewport (sphere layout). */
export function applyProjectionShellLayout(projection: ProjectionId): void {
  document.body.classList.remove("flat-projection", "globe-projection");
  document.body.classList.add(
    is3dProjection(projection) ? "globe-projection" : "flat-projection"
  );
}
