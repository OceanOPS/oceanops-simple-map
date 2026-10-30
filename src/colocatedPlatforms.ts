import { categories } from "./categories";
import {
  MOORING_STACK_BITS,
  MOORING_STACK_LAYER_ID,
  STACK_MEMBERS_JSON_FIELD,
  type MooringStackLayerId,
} from "./mooringStacks";

export type ColocatedPlatformMember = {
  layer_id: string;
  ptf_ref: string;
  ptf_id?: number;
  wigos_ref?: string;
  goos_networks?: string;
  country_name?: string;
  country_iso_reporting?: string;
};

function uniqueNonEmptyStrings(...values: unknown[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    ordered.push(trimmed);
  }
  return ordered;
}

function joinUniqueStrings(...values: unknown[]): string {
  return uniqueNonEmptyStrings(...values).join(" / ");
}

/** Layers that use the OceanOPS platform inspect popup (not lines / overlay). */
export function isColocatedPopupLayer(
  layerId: string | undefined
): layerId is string {
  if (!layerId || layerId === MOORING_STACK_LAYER_ID) return false;
  const cat = categories.find((entry) => entry.id === layerId);
  return cat != null && cat.type === "point";
}

export function memberFromPlatformAttributes(
  layerId: string,
  properties: Record<string, unknown>
): ColocatedPlatformMember {
  const ptfIdRaw = properties.ptf_id;
  const ptfId =
    typeof ptfIdRaw === "number"
      ? ptfIdRaw
      : ptfIdRaw != null && ptfIdRaw !== ""
        ? Number(ptfIdRaw)
        : undefined;

  const member: ColocatedPlatformMember = {
    layer_id: layerId,
    ptf_ref: String(properties.ptf_ref ?? "").trim(),
  };
  if (ptfId != null && !Number.isNaN(ptfId)) member.ptf_id = ptfId;

  const wigos = String(properties.wigos_ref ?? properties.wigos_id ?? "").trim();
  if (wigos) member.wigos_ref = wigos;

  const goos = String(properties.goos_networks ?? "").trim();
  if (goos) member.goos_networks = goos;

  const country = String(properties.country_name ?? "").trim();
  if (country) member.country_name = country;

  const iso = String(properties.country_iso_reporting ?? "").trim();
  if (iso) member.country_iso_reporting = iso;

  return member;
}

export type ColocatedGraphicHit = {
  graphic: __esri.Graphic;
  layer: __esri.Layer | null | undefined;
};

function layerForColocatedHit(hit: ColocatedGraphicHit): __esri.Layer | undefined {
  return (hit.layer ?? hit.graphic.layer) as __esri.Layer | undefined;
}

export function colocatedMembersFromHits(
  hits: ColocatedGraphicHit[],
  resolveLayerId: (layer: __esri.Layer) => string | undefined
): ColocatedPlatformMember[] {
  const members: ColocatedPlatformMember[] = [];
  for (const hit of hits) {
    const layer = layerForColocatedHit(hit);
    if (!layer) continue;
    const layerId = resolveLayerId(layer);
    if (!isColocatedPopupLayer(layerId)) continue;
    members.push(
      memberFromPlatformAttributes(
        layerId,
        hit.graphic.attributes as Record<string, unknown>
      )
    );
  }
  return members;
}

/** @deprecated Prefer colocatedMembersFromHits — graphic.layer is often unset on hitTest. */
export function colocatedMembersFromGraphics(
  graphics: __esri.Graphic[],
  resolveLayerId: (layer: __esri.Layer) => string | undefined
): ColocatedPlatformMember[] {
  return colocatedMembersFromHits(
    graphics.map((graphic) => ({ graphic, layer: graphic.layer as __esri.Layer })),
    resolveLayerId
  );
}

export function parseColocatedMembersFromAttrs(
  attrs: Record<string, unknown>
): ColocatedPlatformMember[] {
  const raw = attrs[STACK_MEMBERS_JSON_FIELD];
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ColocatedPlatformMember =>
        item != null &&
        typeof item === "object" &&
        typeof (item as ColocatedPlatformMember).layer_id === "string" &&
        typeof (item as ColocatedPlatformMember).ptf_ref === "string"
    );
  } catch {
    return [];
  }
}

export function buildSyntheticColocatedAttributes(
  members: ColocatedPlatformMember[],
  sourceGraphics: __esri.Graphic[]
): Record<string, unknown> {
  let stackMask = 0;
  for (const member of members) {
    if (member.layer_id in MOORING_STACK_BITS) {
      stackMask |= MOORING_STACK_BITS[member.layer_id as MooringStackLayerId];
    }
  }
  const anchorGraphic = sourceGraphics[0];
  const anchorAttrs = (anchorGraphic?.attributes ?? {}) as Record<string, unknown>;

  return {
    ...anchorAttrs,
    stack_mask: stackMask,
    ptf_ref: joinUniqueStrings(...members.map((member) => member.ptf_ref)),
    ptf_family_name: joinUniqueStrings(
      ...sourceGraphics.map((graphic) => graphic.attributes?.ptf_family_name)
    ),
    [STACK_MEMBERS_JSON_FIELD]: JSON.stringify(members),
  };
}
