import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer.js";
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer.js";
import type GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import PointSymbol3D from "@arcgis/core/symbols/PointSymbol3D.js";
import IconSymbol3DLayer from "@arcgis/core/symbols/IconSymbol3DLayer.js";
import PictureMarkerSymbol from "@arcgis/core/symbols/PictureMarkerSymbol.js";
import {
  categories,
  MAP_SQUARE_MARKER_SIZE,
  MOORING_NESTED_STACK_SIZES,
  MOORING_STACK_BORDER_WIDTH,
  MOORING_TWO_STACK_SIZE,
  type Shape,
} from "./categories";
import { is3dProjection, type ProjectionId } from "./projections";
import { makeCategoryRenderer } from "./renderers";

const BASE = import.meta.env.BASE_URL;

// ── Co-located mooring overlay (static PNGs for 2+ networks visible) ─────────

export const MOORING_STACK_LAYER_ID = "mooring_stacks";

/** Stack pins: how many SOCONET mooring platforms share this coordinate. */
export const SOCONET_MOORING_COUNT_FIELD = "soconet_mooring_count";

export const MOORING_STACK_BITS = {
  moored_buoys: 1,
  oceansites: 2,
  soconet_moorings: 4,
} as const;

export type MooringStackLayerId = keyof typeof MOORING_STACK_BITS;

/** JSON on stack-layer features: one entry per exported platform × map layer. */
export type MooringStackMember = {
  layer_id: MooringStackLayerId;
  ptf_ref: string;
  ptf_id?: number;
  wigos_ref?: string;
  goos_networks?: string;
  country_name?: string;
  country_iso_reporting?: string;
};

export const STACK_MEMBERS_JSON_FIELD = "stack_members_json";

const STACK_LABEL_LAYER_ORDER: MooringStackLayerId[] = [
  "moored_buoys",
  "oceansites",
  "soconet_moorings",
];

/** Legend labels for each network present in a co-located stack (e.g. MB + OceanSITES). */
export function stackNetworkLabels(stackMask: number): string[] {
  const labels: string[] = [];
  for (const layerId of STACK_LABEL_LAYER_ORDER) {
    if ((stackMask & MOORING_STACK_BITS[layerId]) === 0) continue;
    const cat = categories.find((entry) => entry.id === layerId);
    if (cat) labels.push(cat.label);
  }
  return labels;
}

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

function memberFromFeature(
  layerId: MooringStackLayerId,
  properties: Record<string, unknown>
): MooringStackMember {
  const ptfIdRaw = properties.ptf_id;
  const ptfId =
    typeof ptfIdRaw === "number"
      ? ptfIdRaw
      : ptfIdRaw != null && ptfIdRaw !== ""
        ? Number(ptfIdRaw)
        : undefined;

  const member: MooringStackMember = {
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

function buildStackMembers(
  entry: Partial<Record<MooringStackLayerId, PointFeature[]>>,
  stackMask: number
): MooringStackMember[] {
  const members: MooringStackMember[] = [];
  for (const layerId of STACK_LABEL_LAYER_ORDER) {
    if ((stackMask & MOORING_STACK_BITS[layerId]) === 0) continue;
    for (const feature of entry[layerId] ?? []) {
      members.push(memberFromFeature(layerId, feature.properties));
    }
  }
  return members;
}

/** @param attrs stack-layer graphic attributes */
export function parseStackMembersFromAttrs(
  attrs: Record<string, unknown>
): MooringStackMember[] {
  const raw = attrs[STACK_MEMBERS_JSON_FIELD];
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is MooringStackMember =>
        item != null &&
        typeof item === "object" &&
        typeof (item as MooringStackMember).layer_id === "string" &&
        typeof (item as MooringStackMember).ptf_ref === "string"
    );
  } catch {
    return [];
  }
}

const SOLO_BIT_TO_LAYER: Record<number, MooringStackLayerId> = {
  1: "moored_buoys",
  2: "oceansites",
  4: "soconet_moorings",
};

/** Display mask → PNG basename (outer → inner, e.g. mb-on-oceansites). */
export const STACK_PNG_BY_MASK: Record<number, string> = {
  3: "stack-mb-on-oceansites",
  5: "stack-mb-on-soconet",
  6: "stack-oceansites-on-soconet",
  7: "stack-mb-on-oceansites-on-soconet",
};

const PNG_DISPLAY_SIZE: Record<number, number> = {
  3: MOORING_TWO_STACK_SIZE + 2 * MOORING_STACK_BORDER_WIDTH,
  5: MOORING_TWO_STACK_SIZE + 2 * MOORING_STACK_BORDER_WIDTH,
  6: MOORING_TWO_STACK_SIZE + 2 * MOORING_STACK_BORDER_WIDTH,
  7: MOORING_NESTED_STACK_SIZES.moored_buoys + 2 * MOORING_STACK_BORDER_WIDTH,
};

export type MooringStackVisibility = {
  mooredBuoys: boolean;
  oceansites: boolean;
  soconetMoorings: boolean;
};

type PointFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: Record<string, unknown>;
};

type FeatureCollection = {
  type: "FeatureCollection";
  features: PointFeature[];
};

export type MooringStackData = {
  mooredBuoysSolo: string;
  oceansitesSolo: string;
  soconetMooringsSolo: string;
  stackLayer: string;
};

const COORD_DECIMALS = 4;
let cachedData: MooringStackData | null = null;
const blobUrls: string[] = [];

function popCount(mask: number): number {
  let count = 0;
  let value = mask;
  while (value) {
    count += value & 1;
    value >>= 1;
  }
  return count;
}

function totalPlatformsAtEntry(
  entry: Partial<Record<MooringStackLayerId, PointFeature[]>>
): number {
  let count = 0;
  for (const layerId of STACK_LABEL_LAYER_ORDER) {
    count += entry[layerId]?.length ?? 0;
  }
  return count;
}

/** One stack pin + paginated popup vs several solo features + Esri “1 of N”. */
function shouldBuildMooringStack(
  stackMask: number,
  entry: Partial<Record<MooringStackLayerId, PointFeature[]>>
): boolean {
  if (popCount(stackMask) >= 2) return true;
  return totalPlatformsAtEntry(entry) >= 2;
}

function stackPngUrl(displayMask: number): string {
  const basename = STACK_PNG_BY_MASK[displayMask];
  if (!basename) return "";
  return `${BASE}img/mooring-stacks/${basename}.png`;
}

function visibleStackMaskValues(visibleMask: number): number[] {
  const allowed: number[] = [];
  for (let mask = 1; mask <= 7; mask++) {
    if ((mask & visibleMask) !== 0) allowed.push(mask);
  }
  return allowed;
}

function stackMasksIncludingLayer(layerBit: number): number[] {
  const allowed: number[] = [];
  for (let mask = 1; mask <= 7; mask++) {
    if ((mask & layerBit) !== 0) allowed.push(mask);
  }
  return allowed;
}

function visibleMooringStackMask(visibility: MooringStackVisibility): number {
  let mask = 0;
  if (visibility.mooredBuoys) mask |= MOORING_STACK_BITS.moored_buoys;
  if (visibility.oceansites) mask |= MOORING_STACK_BITS.oceansites;
  if (visibility.soconetMoorings) mask |= MOORING_STACK_BITS.soconet_moorings;
  return mask;
}

/** Stack visibility + optional country filter for the overlay layer. */
export function buildMooringStackDefinitionExpression(
  visibleMask: number,
  countryExpression?: string
): string {
  if (visibleMask === 0 || countryExpression === "1=0") return "1=0";
  const stackPart = `stack_mask IN (${visibleStackMaskValues(visibleMask).join(",")})`;
  if (!countryExpression) return stackPart;
  return `(${stackPart}) AND (${countryExpression})`;
}

export function updateMooringStackDefinitionExpression(
  layerById: ReadonlyMap<string, GeoJSONLayer>,
  countryExpression?: string
): void {
  const stackLayer = layerById.get(MOORING_STACK_LAYER_ID);
  if (!stackLayer) return;

  const visibility = getMooringStackVisibility(layerById);
  const visibleMask = visibleMooringStackMask(visibility);
  stackLayer.definitionExpression = buildMooringStackDefinitionExpression(
    visibleMask,
    countryExpression
  );
}

export function mooringCoordKey(lon: number, lat: number): string {
  return `${lon.toFixed(COORD_DECIMALS)},${lat.toFixed(COORD_DECIMALS)}`;
}

async function fetchGeoJson(url: string): Promise<FeatureCollection> {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  return (await response.json()) as FeatureCollection;
}

function toBlobUrl(collection: FeatureCollection): string {
  return URL.createObjectURL(
    new Blob([JSON.stringify(collection)], { type: "application/json" })
  );
}

function soloFeatures(
  collection: FeatureCollection,
  stackedKeys: Set<string>
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: collection.features.filter((feature) => {
      const [lon, lat] = feature.geometry.coordinates;
      return !stackedKeys.has(mooringCoordKey(lon, lat));
    }),
  };
}

/** Split mooring GeoJSON into solo layers + one stacked-location overlay. */
export async function loadMooringStackData(baseUrl: string): Promise<MooringStackData> {
  if (cachedData) return cachedData;

  const [oceansites, soconetMoorings, mooredBuoys] = await Promise.all([
    fetchGeoJson(`${baseUrl}geojson/oceansites.geojson`),
    fetchGeoJson(`${baseUrl}geojson/soconet_moorings.geojson`),
    fetchGeoJson(`${baseUrl}geojson/moored_buoys.geojson`),
  ]);

  const byKey = new Map<
    string,
    Partial<Record<MooringStackLayerId, PointFeature[]>>
  >();

  const indexLayer = (
    layerId: MooringStackLayerId,
    collection: FeatureCollection
  ) => {
    for (const feature of collection.features) {
      if (feature.geometry?.type !== "Point") continue;
      const [lon, lat] = feature.geometry.coordinates;
      const key = mooringCoordKey(lon, lat);
      const entry = byKey.get(key) ?? {};
      const list = entry[layerId] ?? [];
      list.push(feature);
      entry[layerId] = list;
      byKey.set(key, entry);
    }
  };

  const soconetCountAtKey = new Map<string, number>();
  for (const feature of soconetMoorings.features) {
    if (feature.geometry?.type !== "Point") continue;
    const [lon, lat] = feature.geometry.coordinates;
    const key = mooringCoordKey(lon, lat);
    soconetCountAtKey.set(key, (soconetCountAtKey.get(key) ?? 0) + 1);
  }

  indexLayer("moored_buoys", mooredBuoys);
  indexLayer("oceansites", oceansites);
  indexLayer("soconet_moorings", soconetMoorings);

  const stackedKeys = new Set<string>();
  const stackFeatures: PointFeature[] = [];

  for (const [key, entry] of byKey) {
    let stackMask = 0;
    if (entry.moored_buoys?.length) stackMask |= MOORING_STACK_BITS.moored_buoys;
    if (entry.oceansites?.length) stackMask |= MOORING_STACK_BITS.oceansites;
    if (entry.soconet_moorings?.length) {
      stackMask |= MOORING_STACK_BITS.soconet_moorings;
    }

    if (!shouldBuildMooringStack(stackMask, entry)) continue;

    stackedKeys.add(key);

    const anchor =
      entry.moored_buoys?.[0] ??
      entry.oceansites?.[0] ??
      entry.soconet_moorings?.[0]!;

    const stackMembers = buildStackMembers(entry, stackMask);

    const ptfRef = joinUniqueStrings(...stackMembers.map((m) => m.ptf_ref));

    const ptfModel = joinUniqueStrings(
      ...STACK_LABEL_LAYER_ORDER.flatMap((layerId) =>
        (entry[layerId] ?? []).map((f) => f.properties?.ptf_model)
      ),
      anchor.properties?.ptf_model
    );

    const ptfFamilyName = joinUniqueStrings(
      ...STACK_LABEL_LAYER_ORDER.flatMap((layerId) =>
        (entry[layerId] ?? []).map((f) => f.properties?.ptf_family_name)
      ),
      anchor.properties?.ptf_family_name
    );

    const stackProps: Record<string, unknown> = {
      ...anchor.properties,
      stack_mask: stackMask,
      ptf_ref: ptfRef,
      ptf_model: ptfModel || anchor.properties?.ptf_model,
      ...(ptfFamilyName ? { ptf_family_name: ptfFamilyName } : {}),
      [STACK_MEMBERS_JSON_FIELD]: JSON.stringify(stackMembers),
    };
    if ((stackMask & MOORING_STACK_BITS.soconet_moorings) !== 0) {
      stackProps[SOCONET_MOORING_COUNT_FIELD] = soconetCountAtKey.get(key) ?? 1;
    }

    stackFeatures.push({
      type: "Feature",
      geometry: anchor.geometry,
      properties: stackProps,
    });
  }

  for (const url of blobUrls) URL.revokeObjectURL(url);
  blobUrls.length = 0;

  const data: MooringStackData = {
    mooredBuoysSolo: toBlobUrl(soloFeatures(mooredBuoys, stackedKeys)),
    oceansitesSolo: toBlobUrl(soloFeatures(oceansites, stackedKeys)),
    soconetMooringsSolo: toBlobUrl(soloFeatures(soconetMoorings, stackedKeys)),
    stackLayer: toBlobUrl({
      type: "FeatureCollection",
      features: stackFeatures,
    }),
  };

  blobUrls.push(
    data.mooredBuoysSolo,
    data.oceansitesSolo,
    data.soconetMooringsSolo,
    data.stackLayer
  );
  cachedData = data;
  return data;
}

function getMooringStackVisibility(
  layerById: ReadonlyMap<string, GeoJSONLayer>
): MooringStackVisibility {
  return {
    mooredBuoys: layerById.get("moored_buoys")?.visible ?? false,
    oceansites: layerById.get("oceansites")?.visible ?? false,
    soconetMoorings: layerById.get("soconet_moorings")?.visible ?? false,
  };
}

function soloLayerIdForVisibility(
  visibility: MooringStackVisibility
): MooringStackLayerId | undefined {
  const { mooredBuoys, oceansites, soconetMoorings } = visibility;
  if (mooredBuoys && !oceansites && !soconetMoorings) return "moored_buoys";
  if (oceansites && !mooredBuoys && !soconetMoorings) return "oceansites";
  if (soconetMoorings && !mooredBuoys && !oceansites) return "soconet_moorings";
  return undefined;
}

function makeMooringSoloSymbol(
  projection: ProjectionId,
  layerId: MooringStackLayerId
) {
  const cat = categories.find((c) => c.id === layerId);
  if (!cat || cat.type !== "point") {
    throw new Error(`Missing point category for ${layerId}`);
  }

  const markerSize =
    "markerSize" in cat && cat.markerSize != null
      ? cat.markerSize
      : MAP_SQUARE_MARKER_SIZE;
  const renderer = makeCategoryRenderer(
    projection,
    "point",
    cat.color,
    undefined,
    (cat.shape ?? "square") as Shape,
    undefined,
    markerSize
  );
  return (renderer as SimpleRenderer).symbol!;
}

function makeStackPngSymbol(
  projection: ProjectionId,
  displayMask: number
) {
  const displayPx = PNG_DISPLAY_SIZE[displayMask] ?? MAP_SQUARE_MARKER_SIZE;
  const url = stackPngUrl(displayMask);

  if (is3dProjection(projection)) {
    return new PointSymbol3D({
      symbolLayers: [
        new IconSymbol3DLayer({
          resource: { href: url },
          size: displayPx,
          anchor: "center",
        }),
      ],
    });
  }

  return new PictureMarkerSymbol({
    url,
    width: displayPx,
    height: displayPx,
  });
}

export function makeMooringStackRenderer(
  projection: ProjectionId,
  visibility: MooringStackVisibility
): SimpleRenderer | UniqueValueRenderer {
  const soloLayerId = soloLayerIdForVisibility(visibility);
  if (soloLayerId) {
    return new SimpleRenderer({
      symbol: makeMooringSoloSymbol(projection, soloLayerId),
    });
  }

  const mooredOn = visibility.mooredBuoys ? 1 : 0;
  const oceansitesOn = visibility.oceansites ? 1 : 0;
  const soconetOn = visibility.soconetMoorings ? 1 : 0;

  const uniqueValueInfos: Array<{ value: number | string; symbol: __esri.Symbol }> =
    [];

  for (let displayMask = 1; displayMask <= 7; displayMask++) {
    let symbol: __esri.Symbol | undefined;

    if (popCount(displayMask) === 1) {
      const layerId = SOLO_BIT_TO_LAYER[displayMask];
      if (layerId) symbol = makeMooringSoloSymbol(projection, layerId);
    } else {
      symbol = makeStackPngSymbol(projection, displayMask);
    }

    if (!symbol) continue;

    uniqueValueInfos.push({ value: displayMask, symbol });
    uniqueValueInfos.push({ value: String(displayMask), symbol });
  }

  const defaultInfo =
    uniqueValueInfos.find((info) => info.value === 3) ?? uniqueValueInfos[0];

  return new UniqueValueRenderer({
    valueExpression: `
      var m = DefaultValue($feature.stack_mask, 0);
      var d = 0;
      if ((m & 1) == 1 && ${mooredOn} == 1) { d = d + 1; }
      if ((m & 2) == 2 && ${oceansitesOn} == 1) { d = d + 2; }
      if ((m & 4) == 4 && ${soconetOn} == 1) { d = d + 4; }
      return d;
    `,
    uniqueValueInfos: uniqueValueInfos as __esri.UniqueValueRendererProperties["uniqueValueInfos"],
    defaultSymbol: defaultInfo?.symbol as __esri.UniqueValueRendererProperties["defaultSymbol"],
  });
}

/** Pick solo symbol or stack PNG when legend filters change. */
export function applyMooringStackSymbology(
  layerById: ReadonlyMap<string, GeoJSONLayer>,
  projection: ProjectionId,
  countryExpression?: string
): void {
  const stackLayer = layerById.get(MOORING_STACK_LAYER_ID);
  if (!stackLayer) return;

  const visibility = getMooringStackVisibility(layerById);
  updateMooringStackDefinitionExpression(layerById, countryExpression);
  stackLayer.renderer = makeMooringStackRenderer(projection, visibility);
  stackLayer.visible =
    visibility.mooredBuoys || visibility.oceansites || visibility.soconetMoorings;
}

function buildMooringStackLayerWhere(
  layerId: MooringStackLayerId,
  where: string
): string {
  const layerMasks = stackMasksIncludingLayer(MOORING_STACK_BITS[layerId]);
  const maskClause = `stack_mask IN (${layerMasks.join(",")})`;
  return where && where !== "1=1" ? `(${where}) AND ${maskClause}` : maskClause;
}

async function queryLayerFeaturesPaginated(
  layer: GeoJSONLayer,
  where: string,
  outFields: string[]
): Promise<Record<string, unknown>[]> {
  const attrs: Record<string, unknown>[] = [];
  const pageSize = 2000;
  let start = 0;

  while (true) {
    const result = await layer.queryFeatures({
      where,
      outFields,
      returnGeometry: false,
      start,
      num: pageSize,
    });

    for (const feature of result.features) {
      if (feature.attributes) attrs.push(feature.attributes);
    }

    if (result.features.length === 0) break;
    if (!result.exceededTransferLimit && result.features.length < pageSize) break;
    start += result.features.length;
  }

  return attrs;
}

/** Every SOCONET mooring platform (solo + all platforms at co-located stack pins). */
export async function querySoconetMooringPlatformCount(
  layerById: ReadonlyMap<string, GeoJSONLayer>,
  where: string
): Promise<number> {
  const soloLayer = layerById.get("soconet_moorings");
  const stackLayer = layerById.get(MOORING_STACK_LAYER_ID);

  let total = 0;

  if (soloLayer && typeof soloLayer.queryFeatureCount === "function") {
    total += await soloLayer.queryFeatureCount({ where });
  }

  if (stackLayer && typeof stackLayer.queryFeatures === "function") {
    const stackWhere = buildMooringStackLayerWhere("soconet_moorings", where);
    const attrs = await queryLayerFeaturesPaginated(stackLayer, stackWhere, [
      SOCONET_MOORING_COUNT_FIELD,
    ]);
    for (const row of attrs) {
      const n = Number(row[SOCONET_MOORING_COUNT_FIELD]);
      total += Number.isFinite(n) && n > 0 ? n : 1;
    }
  }

  return total;
}

export async function queryMooringLayerCount(
  layerId: MooringStackLayerId,
  layerById: ReadonlyMap<string, GeoJSONLayer>,
  where: string
): Promise<number> {
  if (layerId === "soconet_moorings") {
    return querySoconetMooringPlatformCount(layerById, where);
  }
  const soloLayer = layerById.get(layerId);
  const stackLayer = layerById.get(MOORING_STACK_LAYER_ID);

  let total = 0;

  if (soloLayer && typeof soloLayer.queryFeatureCount === "function") {
    total += await soloLayer.queryFeatureCount({ where });
  }

  if (stackLayer && typeof stackLayer.queryFeatureCount === "function") {
    total += await stackLayer.queryFeatureCount({
      where: buildMooringStackLayerWhere(layerId, where),
    });
  }

  return total;
}

/** Solo + co-located stack features for one mooring network layer. */
export async function queryMooringLayerFeatures(
  layerId: MooringStackLayerId,
  layerById: ReadonlyMap<string, GeoJSONLayer>,
  where: string,
  outFields: string[]
): Promise<Record<string, unknown>[]> {
  const attrs: Record<string, unknown>[] = [];
  const soloLayer = layerById.get(layerId);
  const stackLayer = layerById.get(MOORING_STACK_LAYER_ID);

  if (soloLayer && typeof soloLayer.queryFeatures === "function") {
    attrs.push(...(await queryLayerFeaturesPaginated(soloLayer, where, outFields)));
  }

  if (stackLayer && typeof stackLayer.queryFeatures === "function") {
    attrs.push(
      ...(await queryLayerFeaturesPaginated(
        stackLayer,
        buildMooringStackLayerWhere(layerId, where),
        outFields
      ))
    );
  }

  return attrs;
}

export function isMooringSquareLayerId(
  layerId: string
): layerId is MooringStackLayerId {
  return (
    layerId === "moored_buoys" ||
    layerId === "oceansites" ||
    layerId === "soconet_moorings"
  );
}
