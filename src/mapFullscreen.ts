const FULLSCREEN_BODY_CLASS = "map-fullscreen";
export const MAP_FULLSCREEN_MESSAGE = "oceanops-simple-map-fullscreen";

export function isMapFullscreen(): boolean {
  return document.body.classList.contains(FULLSCREEN_BODY_CLASS);
}

function mapShell(): HTMLElement | null {
  return document.getElementById("mapShell");
}

function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function notifyParent(active: boolean): void {
  if (!isEmbedded()) return;
  window.parent.postMessage({ type: MAP_FULLSCREEN_MESSAGE, active }, "*");
}

function notifyChange(onLayoutChange?: () => void): void {
  document.dispatchEvent(new CustomEvent("map-fullscreen-change"));
  onLayoutChange?.();
}

async function notifyLayout(onLayoutChange?: () => void): Promise<void> {
  notifyChange(onLayoutChange);
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      notifyChange(onLayoutChange);
      resolve();
    });
  });
}

function syncMenuOpenWithLegendPanel(): void {
  const legend = document.getElementById("legend");
  document.body.classList.toggle(
    "menu-open",
    legend?.classList.contains("open") ?? false
  );
}

export async function setMapFullscreen(
  active: boolean,
  onLayoutChange?: () => void
): Promise<void> {
  const shell = mapShell();
  if (!shell) return;

  const embedded = isEmbedded();

  if (active) {
    document.body.classList.add(FULLSCREEN_BODY_CLASS);
    document.documentElement.classList.add(FULLSCREEN_BODY_CLASS);
    syncMenuOpenWithLegendPanel();
    notifyParent(true);

    if (!embedded) {
      try {
        if (document.fullscreenElement !== shell && shell.requestFullscreen) {
          await shell.requestFullscreen();
        }
      } catch {
        /* CSS-only fullscreen when the browser blocks the API */
      }
    }
  } else {
    document.body.classList.remove(FULLSCREEN_BODY_CLASS);
    document.documentElement.classList.remove(FULLSCREEN_BODY_CLASS);
    notifyParent(false);

    if (!embedded) {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      } catch {
        /* ignore */
      }
    }
  }

  await notifyLayout(onLayoutChange);
}

/** Parent iframes can push the map back to normal mode. */
export function bindMapFullscreenEmbedSync(
  onLayoutChange?: () => void
): () => void {
  const onMessage = (event: MessageEvent) => {
    if (event.data?.type !== MAP_FULLSCREEN_MESSAGE) return;
    if (typeof event.data.active !== "boolean") return;

    const active = event.data.active;
    document.body.classList.toggle(FULLSCREEN_BODY_CLASS, active);
    document.documentElement.classList.toggle(FULLSCREEN_BODY_CLASS, active);
    if (active) syncMenuOpenWithLegendPanel();
    void notifyLayout(onLayoutChange);
  };

  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}

/** Sync CSS state when the user exits via Esc or browser chrome. */
export function bindMapFullscreenSync(onLayoutChange?: () => void): () => void {
  const onFullscreenChange = () => {
    if (isEmbedded()) return;

    const shell = mapShell();
    const nativeActive = shell != null && document.fullscreenElement === shell;

    if (!nativeActive && isMapFullscreen()) {
      document.body.classList.remove(FULLSCREEN_BODY_CLASS);
      document.documentElement.classList.remove(FULLSCREEN_BODY_CLASS);
      void notifyLayout(onLayoutChange);
      return;
    }

    if (nativeActive && !isMapFullscreen()) {
      document.body.classList.add(FULLSCREEN_BODY_CLASS);
      document.documentElement.classList.add(FULLSCREEN_BODY_CLASS);
      syncMenuOpenWithLegendPanel();
      void notifyLayout(onLayoutChange);
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !isMapFullscreen()) return;
    void setMapFullscreen(false, onLayoutChange);
  };

  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("keydown", onKeyDown);
  return () => {
    document.removeEventListener("fullscreenchange", onFullscreenChange);
    document.removeEventListener("keydown", onKeyDown);
  };
}
