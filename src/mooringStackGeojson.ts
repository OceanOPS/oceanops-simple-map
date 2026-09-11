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

function toBlobUrl(collection: FeatureCollection): string {
  return URL.createObjectURL(
    new Blob([JSON.stringify(collection)], { type: "application/json" })
  );
}

export type MooringStackGeoJsonUrls = {
  mooredBuoys: string;
  oceansites: string;
  soconetMoorings: string;
};

let cachedUrls: MooringStackGeoJsonUrls | null = null;
const blobUrls: string[] = [];

function revokeBlobUrls(): void {
  for (const url of blobUrls) URL.revokeObjectURL(url);
  blobUrls.length = 0;
  cachedUrls = null;
}

/** Tag overlapping mooring layers with stack flags for hollow-ring symbology. */
export async function getMooringStackGeoJsonUrls(
  baseUrl: string
): Promise<MooringStackGeoJsonUrls> {
  if (cachedUrls) return cachedUrls;

  const [oceansites, soconetMoorings, mooredBuoys] = await Promise.all([
    fetchGeoJson(`${baseUrl}geojson/oceansites.geojson`),
    fetchGeoJson(`${baseUrl}geojson/soconet_moorings.geojson`),
    fetchGeoJson(`${baseUrl}geojson/moored_buoys.geojson`),
  ]);

  const oceansitesKeys = pointKeys(oceansites);
  const soconetKeys = pointKeys(soconetMoorings);
  const mooredKeys = pointKeys(mooredBuoys);

  const augmentedMoored: FeatureCollection = {
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

  const augmentedOceansites: FeatureCollection = {
    type: "FeatureCollection",
    features: oceansites.features.map((feature) => {
      const [lon, lat] = feature.geometry.coordinates;
      const key = mooringCoordKey(lon, lat);
      const stack_soconet = soconetKeys.has(key) ? 1 : 0;
      const stack_moored = mooredKeys.has(key) ? 1 : 0;
      return {
        ...feature,
        properties: {
          ...feature.properties,
          stack_soconet,
          stack_moored,
          mooring_stacked: stack_soconet || stack_moored ? 1 : 0,
        },
      };
    }),
  };

  const augmentedSoconet: FeatureCollection = {
    type: "FeatureCollection",
    features: soconetMoorings.features.map((feature) => {
      const [lon, lat] = feature.geometry.coordinates;
      const key = mooringCoordKey(lon, lat);
      const stack_oceansites = oceansitesKeys.has(key) ? 1 : 0;
      const stack_moored = mooredKeys.has(key) ? 1 : 0;
      return {
        ...feature,
        properties: {
          ...feature.properties,
          stack_oceansites,
          stack_moored,
          mooring_stacked: stack_oceansites || stack_moored ? 1 : 0,
        },
      };
    }),
  };

  revokeBlobUrls();

  const urls: MooringStackGeoJsonUrls = {
    mooredBuoys: toBlobUrl(augmentedMoored),
    oceansites: toBlobUrl(augmentedOceansites),
    soconetMoorings: toBlobUrl(augmentedSoconet),
  };

  blobUrls.push(urls.mooredBuoys, urls.oceansites, urls.soconetMoorings);
  cachedUrls = urls;
  return urls;
}

/** @deprecated Use getMooringStackGeoJsonUrls */
export async function getMooredBuoysGeoJsonUrl(baseUrl: string): Promise<string> {
  const urls = await getMooringStackGeoJsonUrls(baseUrl);
  return urls.mooredBuoys;
}
