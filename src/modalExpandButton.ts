const EXPAND_CHEVRON_ICON = `
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path
      d="M3.5 5.25 7 8.75l3.5-3.5"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
`;

export function createModalExpandButton(ariaLabel: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "o-country-modal-expand-btn";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", ariaLabel);
  button.innerHTML = EXPAND_CHEVRON_ICON;
  return button;
}

export function setModalExpandButtonState(
  button: HTMLButtonElement,
  isOpen: boolean,
  ariaLabel: string
): void {
  button.setAttribute("aria-expanded", String(isOpen));
  button.setAttribute("aria-label", ariaLabel);
}
