import type { Category } from "./categories";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hasCountryValue(value: unknown): boolean {
  const text = String(value ?? "").trim();
  return text.length > 0 && text.toUpperCase() !== "UNKNOWN";
}

export function platformPopupContent(cat: Category) {
  return ({ graphic }: { graphic: { attributes: Record<string, unknown> } }) => {
    const attrs = graphic.attributes;
    const ptfRef = String(attrs.ptf_ref ?? "").trim();
    const shipCountryHtml = hasCountryValue(attrs.country_ship)
      ? `<p><b>Ship country:</b> ${escapeHtml(String(attrs.country_ship).trim())}</p>`
      : "";

    const inspectUrl = ptfRef
      ? `https://www.ocean-ops.org/board/wa/Platform?ref=${encodeURIComponent(ptfRef)}`
      : "";

    return `<div class="o-map-popup">
          <p><b>Type:</b> ${escapeHtml(cat.label)}</p>
          <p><b>Reference:</b> ${escapeHtml(ptfRef)}</p>
          <p><b>Model:</b> ${escapeHtml(String(attrs.ptf_model ?? ""))}</p>
          <p><b>Contributing country:</b> ${escapeHtml(String(attrs.country_name ?? ""))}</p>
          ${shipCountryHtml}
          ${inspectUrl ? `<p><a target="_blank" rel="noopener noreferrer" href="${inspectUrl}">Inspect at OceanOPS</a></p>` : ""}
          </div>`;
  };
}
