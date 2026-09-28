import type { GlobeView } from "./viewHolder";

export const SEARCH_TOGGLE_HINT =
  "Search platforms and reference observatories";

export const ZOOM_IN_HINT = "Zoom in";
export const ZOOM_OUT_HINT = "Zoom out";
export const RESET_MAP_ORIENTATION_HINT = "Reset map orientation";
export const MAP_ROTATION_HINT = "Map rotation";

/** Hover label matching the map legend / menu control (issue #99). */
export function appendToolbarHint(button: HTMLElement, text: string): void {
  stripNativeTooltips(button);
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

/** Esri/Calcite set `title` → native tooltip; we use custom hover hints only. */
function stripNativeTooltips(root: HTMLElement): void {
  root.removeAttribute("title");
  root.querySelectorAll<HTMLElement>("[title]").forEach((el) => {
    el.removeAttribute("title");
  });
  if (root.shadowRoot) {
    root.shadowRoot.querySelectorAll<HTMLElement>("[title]").forEach((el) => {
      el.removeAttribute("title");
    });
    root.shadowRoot.querySelectorAll<HTMLElement>("button, calcite-button").forEach((el) => {
      el.removeAttribute("title");
    });
  }
}

const titleStripObservers = new WeakMap<HTMLElement, MutationObserver>();

function ensureNativeTooltipsStripped(widgetRoot: HTMLElement): void {
  stripNativeTooltips(widgetRoot);
  if (titleStripObservers.has(widgetRoot)) return;

  const observer = new MutationObserver(() => {
    stripNativeTooltips(widgetRoot);
  });
  observer.observe(widgetRoot, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["title"],
  });
  titleStripObservers.set(widgetRoot, observer);
}

/** Hint on a wrapper — do not inject into Esri/Calcite buttons (breaks +/− chrome). */
function wrapNavigationControlWithHint(control: HTMLElement, hint: string): void {
  let wrap = control.closest(".o-map-toolbar-hint-wrap") as HTMLElement | null;

  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "o-map-toolbar-hint-wrap o-map-control-with-hint";
    const parent = control.parentElement;
    if (!parent) return;
    parent.insertBefore(wrap, control);
    wrap.appendChild(control);
  }

  control.querySelector(".o-map-toolbar-hint")?.remove();
  control.classList.remove("o-map-control-with-hint");
  stripNativeTooltips(control);
  control.setAttribute("aria-label", hint);
  appendToolbarHint(wrap, hint);

  const widgetRoot = control.closest<HTMLElement>(".esri-compass, .esri-zoom");
  if (widgetRoot) ensureNativeTooltipsStripped(widgetRoot);
}

function findCompassControl(root: ParentNode): HTMLElement | null {
  return (
    root.querySelector<HTMLElement>(".esri-compass.esri-widget--button") ??
    root.querySelector<HTMLElement>(".esri-compass .esri-widget--button") ??
    root.querySelector<HTMLElement>(".esri-compass")
  );
}

/** Esri zoom + compass widgets (issue #99 hover hints). */
export function wireNavigationControlHints(root: ParentNode = document): boolean {
  let wired = false;

  const zoom = root.querySelector(".esri-zoom");
  if (zoom) {
    const buttons = zoom.querySelectorAll<HTMLElement>(".esri-widget--button");
    if (buttons.length >= 1) {
      wrapNavigationControlWithHint(buttons[0]!, ZOOM_IN_HINT);
      wired = true;
    }
    if (buttons.length >= 2) {
      wrapNavigationControlWithHint(buttons[1]!, ZOOM_OUT_HINT);
      wired = true;
    }
  }

  const compass = findCompassControl(root);
  if (compass) {
    wrapNavigationControlWithHint(compass, RESET_MAP_ORIENTATION_HINT);
    wired = true;
  }

  return wired;
}

const NAV_HINT_RETRY_MS = [0, 50, 200, 600];

export function ensureNavigationControlHints(view: GlobeView): void {
  const root = view.container ?? document;
  const tryWire = () => wireNavigationControlHints(root);

  for (const delay of NAV_HINT_RETRY_MS) {
    if (delay === 0) {
      tryWire();
    } else {
      window.setTimeout(tryWire, delay);
    }
  }

  void view.when().then(() => {
    for (const delay of NAV_HINT_RETRY_MS) {
      window.setTimeout(tryWire, delay);
    }
  });
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
  const rotationSection = document.querySelector(
    ".o-map-toolbar-section--rotation"
  );

  if (legendToggle) move(legendToggle, 0);
  move("zoom", 1);
  move("compass", 2);
  if (rotationSection) move(rotationSection as HTMLElement, 3);
  if (displayMenu) move(displayMenu as HTMLElement, 4);
  if (searchBar) move(searchBar, 5);
}
