import { isMapFullscreen } from "./mapFullscreen";

export const MAP_EMBED_SCROLL_MESSAGE = "oceanops-map-embed-scroll";

function isMapSurfaceTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("#viewDiv")) return true;
  return false;
}

/** Report-card iframe: one-finger vertical drag scrolls the host page; two fingers still pan/zoom the map. */
export function bindEmbeddedParentScrollForward(): () => void {
  let lastY = 0;
  let tracking = false;

  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) {
      tracking = false;
      return;
    }
    if (isMapFullscreen()) {
      tracking = false;
      return;
    }
    if (!isMapSurfaceTarget(event.target)) {
      tracking = false;
      return;
    }
    tracking = true;
    lastY = event.touches[0].clientY;
  };

  const onTouchMove = (event: TouchEvent) => {
    if (!tracking || event.touches.length !== 1) return;
    if (isMapFullscreen()) return;

    const y = event.touches[0].clientY;
    const deltaY = lastY - y;
    lastY = y;

    if (Math.abs(deltaY) < 0.5) return;

    window.parent.postMessage(
      { type: MAP_EMBED_SCROLL_MESSAGE, deltaY },
      "*"
    );
  };

  const endTouch = () => {
    tracking = false;
  };

  const opts: AddEventListenerOptions = { passive: true };
  window.addEventListener("touchstart", onTouchStart, opts);
  window.addEventListener("touchmove", onTouchMove, opts);
  window.addEventListener("touchend", endTouch, opts);
  window.addEventListener("touchcancel", endTouch, opts);

  return () => {
    window.removeEventListener("touchstart", onTouchStart, opts);
    window.removeEventListener("touchmove", onTouchMove, opts);
    window.removeEventListener("touchend", endTouch, opts);
    window.removeEventListener("touchcancel", endTouch, opts);
  };
}
