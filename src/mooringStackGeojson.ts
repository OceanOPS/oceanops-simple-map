type PointFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: Record<string, unknown>;
};

type FeatureCollection = {
  type: "FeatureCollection";
  features: PointFeature[];
};

/** ~11 m — enough to match co-deployed moorings without merging distant points. */
const COORD_DECIMALS = 4;

export function mooringCoordKey(lon: number, lat: number): string {
  return `${lon.toFixed(COORD_DECIMALS)},${lat.toFixed(COORD_DECIMALS)}`;
}

function pointKeys(collection: FeatureCollection): Set<string> {
  const keys = new Set<string>();
  for (const feature of collection.features) {
    if (feature.geometry?.type !== "Point") continue;
    const [lon, lat] = feature.geometry.coordinates;
    keys.add(mooringCoordKey(lon, lat));
  }
  return keys;
}

async function fetchGeoJson(url: string): Promise<FeatureCollection> {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  return (await response.json()) as FeatureCollection;
}

let mooredBuoysBlobUrl: string | null = null;

/** Tag moored buoys with `mooring_stacked` when OceanSITES / SOCONET share the location. */
export async function getMooredBuoysGeoJsonUrl(baseUrl: string): Promise<string> {
  if (mooredBuoysBlobUrl) URL.revokeObjectURL(mooredBuoysBlobUrl);

  const [oceansites, soconetMoorings, mooredBuoys] = await Promise.all([
    fetchGeoJson(`${baseUrl}geojson/oceansites.geojson`),
    fetchGeoJson(`${baseUrl}geojson/soconet_moorings.geojson`),
    fetchGeoJson(`${baseUrl}geojson/moored_buoys.geojson`),
  ]);

  const oceansitesKeys = pointKeys(oceansites);
  const soconetKeys = pointKeys(soconetMoorings);

  const augmented: FeatureCollection = {
    type: "FeatureCollection",
    features: mooredBuoys.features.map((feature) => {
      const [lon, lat] = feature.geometry.coordinates;
      const key = mooringCoordKey(lon, lat);
      const stack_oceansites = oceansitesKeys.has(key) ? 1 : 0;
      const stack_soconet = soconetKeys.has(key) ? 1 : 0;
      return {
        ...feature,
        properties: {
          ...feature.properties,
          stack_oceansites,
          stack_soconet,
          mooring_stacked: stack_oceansites || stack_soconet ? 1 : 0,
        },
      };
    }),
  };

  mooredBuoysBlobUrl = URL.createObjectURL(
    new Blob([JSON.stringify(augmented)], { type: "application/json" })
  );
  return mooredBuoysBlobUrl;
}
