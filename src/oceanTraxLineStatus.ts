/** User-facing labels for Ocean TraX `line_status` (network design, not cruise-based). */

export function normalizeOceanTraxLineStatus(status: unknown): string {
  return String(status ?? "").trim().toLowerCase();
}

export function oceanTraxStatusLabel(status: unknown): string {
  switch (normalizeOceanTraxLineStatus(status)) {
    case "active":
      return "Operational";
    case "reactivate":
      return "To reactivate";
    default: {
      const value = String(status ?? "").trim();
      return value ? value.charAt(0).toUpperCase() + value.slice(1) : "—";
    }
  }
}

export function oceanTraxStatusDetail(status: unknown): string {
  switch (normalizeOceanTraxLineStatus(status)) {
    case "active":
      return "Part of the current Ocean TraX network design and considered operational.";
    case "reactivate":
      return "In the network design but marked for reactivation—not currently operational.";
    default:
      return "Status from the Ocean TraX network design in OceanOPS (not based on cruise activity).";
  }
}

export const OCEAN_TRAX_LEGEND_ACTIVE = "Operational in network";
export const OCEAN_TRAX_LEGEND_REACTIVATE = "To reactivate";
export const OCEAN_TRAX_LEGEND_NOTE =
  "Line status reflects the Ocean TraX network design, not recent cruises.";
