/** Keep Esri GeoJSONLayer field inference stable (null/bool mixes drop fields). */

const INTEGER_PROPS = new Set([
  "ptf_id",
  "line_id",
  "stack_mask",
  "soconet_mooring_count",
]);

const BOOLEAN_AS_INT_PROPS = new Set([
  "sampled_in_edition",
  "last_cruise_ship_masked",
  "next_cruise_ship_masked",
]);

function truthy(value: unknown): boolean {
  return value === true || value === 1 || value === "true" || value === "1";
}

export function normalizeFeatureProperties(
  props: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined) {
      out[key] =
        INTEGER_PROPS.has(key) || BOOLEAN_AS_INT_PROPS.has(key) ? 0 : "";
      continue;
    }
    if (BOOLEAN_AS_INT_PROPS.has(key)) {
      out[key] = truthy(value) ? 1 : 0;
      continue;
    }
    if (INTEGER_PROPS.has(key)) {
      const n = Number(value);
      out[key] = Number.isFinite(n) ? Math.trunc(n) : 0;
      continue;
    }
    out[key] = value;
  }

  return out;
}

type FeatureCollectionLike = {
  type: "FeatureCollection";
  features: Array<{ properties?: Record<string, unknown> | null }>;
};

export function normalizeFeatureCollection<T extends FeatureCollectionLike>(
  collection: T
): T {
  for (const feature of collection.features) {
    if (!feature.properties) continue;
    feature.properties = normalizeFeatureProperties(
      feature.properties as Record<string, unknown>
    ) as typeof feature.properties;
  }
  return collection;
}
