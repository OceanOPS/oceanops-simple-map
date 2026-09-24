import { categories, type Category } from "./categories";
import {
  MOORING_STACK_BITS,
  stackNetworkLabels,
  type MooringStackLayerId,
} from "./mooringStacks";

const STACK_LAYER_ORDER: MooringStackLayerId[] = [
  "moored_buoys",
  "oceansites",
  "soconet_moorings",
];

/** Short platform type beside ref in popup title (OceanOPS inspect window spec). */
const INSPECT_PLATFORM_TYPE: Record<string, string> = {
  vos: "Ship Weather Station",
  oceantrax: "Expendable Bathythermograph Line",
  asap: "Atmospheric Profiler",
  soconet: "Underway System",
  soconet_moorings: "Moored Buoy",
  goship: "Repeated Line",
  fvon: "Underway System",
  gloss: "Tide Gauge",
  oceansites: "Moored Buoy",
  moored_buoys: "Moored Buoy",
  tsunami_buoys: "Moored Buoy",
  hf_radars: "HF Radar",
  drifting_buoys: "Drifting Buoy",
  argo: "Profiling Float",
  oceangliders: "Underwater Glider",
  anibos: "Marine Animal",
};

export function getCategoryById(layerId: string): Category | undefined {
  return categories.find((entry) => entry.id === layerId);
}

export function platformInspectTypeName(layerId: string): string {
  const mapped = INSPECT_PLATFORM_TYPE[layerId];
  if (mapped) return mapped;
  return getCategoryById(layerId)?.label ?? layerId;
}

export function goosObservingNetworkName(layerId: string): string {
  const label = getCategoryById(layerId)?.label ?? "";
  const parts = label.split(/\s*[–-]\s*/);
  return parts.length > 1 ? parts[parts.length - 1].trim() : label.trim();
}

/** PTF_FAMILY.name from export when present; else map inspect label for the layer. */
export function platformFamilyNameFromAttrs(
  attrs: Record<string, unknown> | undefined,
  layerId: string
): string {
  const fromDb = String(attrs?.ptf_family_name ?? "").trim();
  if (fromDb) return fromDb;
  return platformInspectTypeName(layerId);
}

/** GOOS network names from export when present; else legend network suffix. */
export function goosObservingNetworkFromAttrs(
  attrs: Record<string, unknown> | undefined,
  layerId: string
): string {
  const fromDb = String(attrs?.goos_networks ?? "").trim();
  if (fromDb) return fromDb;
  return goosObservingNetworkName(layerId);
}

export function platformInspectPopupTitle(
  layerId: string,
  ptfRef: string,
  attrs?: Record<string, unknown>
): string {
  const ref = ptfRef.trim();
  const typeName = platformFamilyNameFromAttrs(attrs, layerId);
  if (!ref) return typeName;
  return `${ref} - ${typeName}`;
}

export function stackInspectPopupTitle(
  stackMask: number,
  ptfRef: string,
  attrs?: Record<string, unknown>
): string {
  const ref = ptfRef.trim();
  const familyFromDb = String(attrs?.ptf_family_name ?? "").trim();
  if (familyFromDb) {
    if (!ref) return familyFromDb;
    return `${ref} - ${familyFromDb}`;
  }

  const typeNames: string[] = [];
  for (const layerId of STACK_LAYER_ORDER) {
    if ((stackMask & MOORING_STACK_BITS[layerId]) === 0) continue;
    typeNames.push(platformInspectTypeName(layerId));
  }
  const unique = [...new Set(typeNames)];
  const typeLabel =
    unique.length > 0
      ? unique.join("; ")
      : stackNetworkLabels(stackMask).join("; ") || "Co-located mooring stack";
  if (!ref) return typeLabel;
  return `${ref} - ${typeLabel}`;
}

export const POPUP_ZOOM_ACTION_ID = "oceanops-zoom-to";

export const POPUP_ZOOM_ACTION = {
  title: "Zoom to",
  id: POPUP_ZOOM_ACTION_ID,
  type: "button" as const,
};
