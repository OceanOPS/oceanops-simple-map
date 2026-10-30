import { categories, type Category } from "./categories";
import {
  parseColocatedMembersFromAttrs,
  type ColocatedPlatformMember,
} from "./colocatedPlatforms";
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

function mooringStackBitForGoosNetworkToken(token: string): number | null {
  const name = token.trim();
  if (!name) return null;
  if (/^MBN$/i.test(name)) return MOORING_STACK_BITS.moored_buoys;
  if (/^OceanSITES$/i.test(name)) return MOORING_STACK_BITS.oceansites;
  if (/^SOCONET$/i.test(name)) return MOORING_STACK_BITS.soconet_moorings;
  return null;
}

/**
 * Passport may list several GOOS networks at one site; the map only draws a subset
 * (solo layer or stack mask). Networks not represented on the symbol are "(not operational)",
 * except OceanSITES (editorial: never show that suffix on OceanSITES).
 */
export function formatGoosObservingNetworksDisplay(
  goosNetworks: string,
  visibleMooringMask: number
): string {
  const raw = goosNetworks.trim();
  if (!raw) return raw;

  const parts = raw.split(/\s*[,;/]\s*/).filter(Boolean);
  if (parts.length === 0) return raw;

  const notOperationalSuffix = "(not operational)";

  const formatted = parts.map((part) => {
    if (/\((?:closed|not operational)\)\s*$/i.test(part)) {
      const base = part.replace(/\s*\((?:closed|not operational)\)\s*$/i, "").trim();
      if (/^OceanSITES$/i.test(base)) return base;
      return part.replace(/\(closed\)\s*$/i, notOperationalSuffix);
    }
    const bit = mooringStackBitForGoosNetworkToken(part);
    if (bit == null) return part;
    if (/^OceanSITES$/i.test(part.trim())) return part.trim();
    if ((visibleMooringMask & bit) !== 0) return part;
    return `${part} ${notOperationalSuffix}`;
  });

  return formatted.join(", ");
}

export function visibleMooringMaskForLayer(layerId: string): number {
  if (layerId in MOORING_STACK_BITS) {
    return MOORING_STACK_BITS[layerId as MooringStackLayerId];
  }
  return 0;
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

/** Popup title when several platforms share one map pin (ref – type per platform). */
export function colocatedClusterPopupTitle(
  members: ColocatedPlatformMember[]
): string {
  const segments: string[] = [];
  const seenRef = new Set<string>();
  for (const member of members) {
    const ref = member.ptf_ref.trim();
    if (!ref || seenRef.has(ref)) continue;
    seenRef.add(ref);
    segments.push(platformInspectPopupTitle(member.layer_id, ref));
  }
  return segments.length > 0 ? segments.join("\n") : "Co-located platforms";
}

export function stackInspectPopupTitle(
  stackMask: number,
  ptfRef: string,
  attrs?: Record<string, unknown>
): string {
  const members = parseColocatedMembersFromAttrs(attrs ?? {});
  if (members.length >= 2) {
    return colocatedClusterPopupTitle(members);
  }
  if (members.length === 1) {
    const only = members[0]!;
    return platformInspectPopupTitle(only.layer_id, only.ptf_ref);
  }

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

