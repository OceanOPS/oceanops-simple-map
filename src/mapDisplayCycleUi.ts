/** Shared affordances: basemap / projection cycle controls (preview + label = active option). */

/** Map layer → satellite layer (matches toggle order). */
export const BASEMAP_KIND_CYCLE = ["map", "satellite"] as const;

export function setBasemapPreviewContent(
  button: HTMLButtonElement,
  previewMarkup: string
): void {
  button.innerHTML = previewMarkup;
}

export function setCycleOptionLabel(labelEl: HTMLElement, optionLabel: string): void {
  labelEl.className = "o-basemap-kind-label";
  labelEl.textContent = optionLabel;
}

export function mountProjectionStepDots(activeIndex: number, total: number): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "o-map-projection-steps";
  row.setAttribute("aria-hidden", "true");
  for (let i = 0; i < total; i++) {
    const dot = document.createElement("span");
    dot.className = `o-map-projection-steps__dot${i === activeIndex ? " is-active" : ""}`;
    row.appendChild(dot);
  }
  return row;
}

export function updateProjectionStepDots(row: HTMLElement, activeIndex: number): void {
  const dots = row.querySelectorAll(".o-map-projection-steps__dot");
  dots.forEach((dot, i) => {
    dot.classList.toggle("is-active", i === activeIndex);
  });
}
