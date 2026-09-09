export type LayerKind = "point" | "image" | "line";
export type Shape = "circle" | "square" | "triangle" ;

/** Square marker sizes for overlapping fixed moorings (largest → smallest). */
export const MOORING_SQUARE_MARKER_SIZES = {
  moored_buoys: 10,
  oceansites: 7,
  soconet_moorings: 5,
} as const;

/** Map draw order for nested mooring squares (bottom → top). */
export const MAP_LAYER_STACK: Partial<Record<string, number>> = {
  moored_buoys: 910,
  oceansites: 911,
  soconet_moorings: 912,
};

/** Layers that share locations and must stay stacked (largest bottom, smallest top). */
export const MOORING_STACK_LAYER_IDS = [
  "moored_buoys",
  "oceansites",
  "soconet_moorings",
] as const;

export function mapLayerStackRank(layerId: string, defaultIndex: number): number {
  return MAP_LAYER_STACK[layerId] ?? defaultIndex;
}

/** Test colour for SOCONET ships + moorings (replacing blue ship). */
export const SOCONET_COLOR = "#e8bceb";

export type Category =
  | {
      id: string;
      label: string;
      color: string;
      type: "image";
      imagePath: string;
      /** Toggle this layer together with the primary legend row (e.g. moorings). */
      legendCompanionId?: string;
    }
  | { id: string; label: string; color: string; type: "line" }
  | {
      id: string;
      label: string;
      color: string;
      type: "point";
      shape?: Shape;
      /** Point marker diameter (px); used for nested mooring squares. */
      markerSize?: number;
      /** Omit separate legend row — controlled by the companion primary layer. */
      legendHidden?: boolean;
    };

export const categories = [
  { id: 'vos',                        label: 'Ship based meteorological – VOS',                 color: '#8B0000', type: 'image', imagePath: '/img/ship_yellow.png' },
  { id: 'oceantrax',                        label: 'Ship based oceanographic – Ocean TraX',                 color: '#faa62d', type: 'line' },
  { id: 'asap',                        label: 'Ship based aerological – ASAP',                 color: '#d38724ff', type: 'image', imagePath: '/img/ship_orange.png' },
  {
    id: 'soconet',
    label: 'Surface ocean CO₂ – SOCONET',
    color: SOCONET_COLOR,
    type: 'image',
    imagePath: '/img/ship_pink.png',
    legendCompanionId: 'soconet_moorings',
  },
  {
    id: 'soconet_moorings',
    label: 'Surface ocean CO₂ – SOCONET',
    color: SOCONET_COLOR,
    type: 'point',
    shape: 'square',
    markerSize: MOORING_SQUARE_MARKER_SIZES.soconet_moorings,
    legendHidden: true,
  },
  { id: 'goship',                      label: 'Repeated transects – GO-SHIP',         color: '#ee2f2b', type: 'line' },
  { id: 'fvon',                      label: 'Fishing vessels – FVON',         color: '#9d39e0ff', type: 'image', imagePath: '/img/ship_violet.png' },
  { id: 'gloss',                      label: 'Sea level gauges – GLOSS',         color: '#faa62d', type: 'point', shape: 'square' },
  { id: 'oceansites',                      label: 'Time series sites – OceanSITES',         color: '#40a62e', type: 'point', shape: 'square', markerSize: MOORING_SQUARE_MARKER_SIZES.oceansites  },
  { id: 'moored_buoys',                 label: 'Moored buoys – MB',          color: '#ec2324', type: 'point', shape: 'square', markerSize: 5 },
  { id: 'tsunami_buoys',                      label: 'Tsunami buoys – TSU',         color: '#ffff00', type: 'point', shape: 'triangle'  },
  { id: 'hf_radars',                      label: 'High Frequency radars - HF radars',         color: '#ffffff', type: 'point', shape: 'square'  },
  { id: 'drifting_buoys',               label: 'Drifting buoys – GDA',        color: '#28c3f3', type: 'point', shape: 'circle' },
  { id: 'argo',                        label: 'Profiling floats – Argo',      color: '#2357a7', type: 'point', shape: 'circle' },
  { id: 'oceangliders',                      label: 'Gliders – OceanGliders',         color: '#71bf44', type: 'point', shape: 'circle'  },
  { id: 'anibos',                      label: 'Animal borne sensors - AniBOS',         color: '#ffffff', type: 'point', shape: 'circle' },
] as const satisfies readonly Category[];

/** Layer ids toggled together with a legend row (primary + companions). */
export function legendLayerIdsForCategory(cat: Category): string[] {
  if (cat.type === "image" && cat.legendCompanionId) {
    return [cat.id, cat.legendCompanionId];
  }
  return [cat.id];
}

export function isLegendRowCategory(cat: Category): boolean {
  return !("legendHidden" in cat && cat.legendHidden);
}

/** Labels in country modal / breakdown lists (distinct sub-layers). */
export function getLayerDisplayLabel(
  layerId: string,
  context: "legend" | "modal" = "legend"
): string {
  if (context === "modal") {
    if (layerId === "soconet") return "Surface ocean CO₂ / ship - SOCONET";
    if (layerId === "soconet_moorings")
      return "Surface ocean CO₂ / moored buoys - SOCONET";
  }
  const cat = categories.find((c) => c.id === layerId);
  return cat?.label ?? layerId;
}
