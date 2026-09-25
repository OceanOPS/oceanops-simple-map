import type { GlobeView } from "./viewHolder";

export const SEARCH_TOGGLE_HINT =
  "Search platforms and reference observatories";

/** Hover label matching the map legend / menu control (issue #99). */
export function appendToolbarHint(button: HTMLElement, text: string): void {
  button.classList.add("o-map-control-with-hint");
  const existing = button.querySelector(".o-map-toolbar-hint");
  if (existing) {
    existing.textContent = text;
    return;
  }
  const hint = document.createElement("span");
  hint.className = "o-map-toolbar-hint";
  hint.textContent = text;
  button.appendChild(hint);
}

/** Top-left stack: menu → zoom → compass → rotation → basemap/expand → search. */
export function syncLeftToolbarOrder(view: GlobeView): void {
  const move = (target: HTMLElement | string, index: number) => {
    try {
      view.ui.move(target, { position: "top-left", index });
    } catch {
      /* widget not mounted yet */
    }
  };

  const legendToggle = document.getElementById("legend-toggle");
  const searchBar = document.getElementById("platform-search-bar");
  const displayMenu = document.querySelector(".o-map-display-menu");
  const rotation = document.querySelector(".o-rotation-toggle");

  if (legendToggle) move(legendToggle, 0);
  move("zoom", 1);
  move("compass", 2);
  if (rotation) move(rotation as HTMLElement, 3);
  if (displayMenu) move(displayMenu as HTMLElement, 4);
  if (searchBar) move(searchBar, 5);
}
