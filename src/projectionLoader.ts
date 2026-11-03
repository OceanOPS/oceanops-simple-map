const PROJECTION_LOADER_ID = "map-projection-loader";

/** Full-map loader while the view is rebuilt for a new projection. */
export function showProjectionLoader(): void {
  const shell = document.getElementById("mapShell");
  if (!shell) return;

  let overlay = document.getElementById(PROJECTION_LOADER_ID) as HTMLDivElement | null;
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = PROJECTION_LOADER_ID;
    overlay.className = "o-mapserver-loader o-projection-loader";
    overlay.innerHTML = `
    <div class="o-mapserver-loader__bar" aria-hidden="true"></div>
    <div class="o-mapserver-loader__panel">
      <div class="o-mapserver-loader__ring" aria-hidden="true"></div>
      <span class="o-mapserver-loader__label">Loading map</span>
    </div>
  `;
    shell.appendChild(overlay);
  }

  overlay.classList.add("is-active");
  overlay.setAttribute("aria-hidden", "false");
}

export function hideProjectionLoader(): void {
  const overlay = document.getElementById(PROJECTION_LOADER_ID);
  if (!overlay) return;
  overlay.classList.remove("is-active");
  overlay.setAttribute("aria-hidden", "true");
}
