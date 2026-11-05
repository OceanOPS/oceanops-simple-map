/** Sampled GO-SHIP lines — same basis as the global network legend (partner / solid lines). */

export const GOSHIP_SAMPLED_LINE_WHERE =
  "(line_style = 'solid' OR sampled_in_edition = 1 OR sampled_in_edition = true)";

export function isGoshipSampledLineAttributes(
  attrs: Record<string, unknown>
): boolean {
  return (
    attrs.sampled_in_edition === true ||
    attrs.sampled_in_edition === 1 ||
    attrs.sampled_in_edition === "true" ||
    String(attrs.line_style ?? "") === "solid"
  );
}

/** Legend / country totals; map display still shows dashed design lines. */
export function appendGoshipLegendCountWhere(where: string): string {
  if (!where || where === "1=1") return GOSHIP_SAMPLED_LINE_WHERE;
  return `(${where}) AND ${GOSHIP_SAMPLED_LINE_WHERE}`;
}
