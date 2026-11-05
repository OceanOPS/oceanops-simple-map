/**
 * Pre-rendered tile pyramids for the flat basemaps (Plate Carrée, Equal Earth).
 *
 * Tiles are built and served by `oceanops-basemap-tiles` (Docker/nginx). Set
 * `VITE_FLAT_BASEMAP_TILES_URL` to the service root ending in `/tiles`, e.g.
 * `https://basemap-tiles.example.org/tiles`. Deeper zooms use live MapServer export
 * (see `getFlatTileHandoffScale`).
 *
 * Leave unset or `off` for MapServer export only (local dev without the tile service).
 *
 * The grid below MUST stay in sync with `oceanops-basemap-tiles/scheme.mjs`.
 */
import Extent from "@arcgis/core/geometry/Extent.js";
import Point from "@arcgis/core/geometry/Point.js";
import SpatialReference from "@arcgis/core/geometry/SpatialReference.js";
import LOD from "@arcgis/core/layers/support/LOD.js";
import TileInfo from "@arcgis/core/layers/support/TileInfo.js";
import BaseTileLayer from "@arcgis/core/layers/BaseTileLayer.js";
import {
  EQUAL_EARTH_SPATIAL_REFERENCE,
  EQUAL_EARTH_WORLD_EXTENT,
} from "./equalEarthBasemap";
import { PLATE_CARREE_WORLD_EXTENT } from "./plateCarreeBasemap";

export type FlatTileProjection = "plate-carree" | "equal-earth";
export type FlatTileBasemap = "map" | "satellite";

const TILE_SIZE = 512;
const TILE_DPI = 96;
/** Esri's metres-per-degree for scale <-> resolution conversion on geographic SRs. */
const METERS_PER_DEGREE = 111_319.490_793_273_58;

/** Finest pyramid level on the basemap-tiles service (must match `build-tiles.mjs` defaults). */
export const FLAT_TILE_MAX_LEVEL = { pc: 6, ee: 7 } as const;

type FlatTileScheme = {
  /** Folder name under the tiles root. */
  folder: "pc" | "ee";
  spatialReference: SpatialReference;
  extent: Extent;
  /** Units per pixel at level 0. */
  resolution0: number;
  maxLevel: number;
};

function getScheme(projection: FlatTileProjection): FlatTileScheme {
  if (projection === "plate-carree") {
    return {
      folder: "pc",
      spatialReference: SpatialReference.WGS84,
      extent: PLATE_CARREE_WORLD_EXTENT,
      resolution0: 180 / TILE_SIZE,
      maxLevel: FLAT_TILE_MAX_LEVEL.pc,
    };
  }
  return {
    folder: "ee",
    spatialReference: EQUAL_EARTH_SPATIAL_REFERENCE,
    extent: EQUAL_EARTH_WORLD_EXTENT,
    resolution0: (EQUAL_EARTH_WORLD_EXTENT.xmax - EQUAL_EARTH_WORLD_EXTENT.xmin) / TILE_SIZE,
    maxLevel: FLAT_TILE_MAX_LEVEL.ee,
  };
}

const KIND_FOLDER: Record<FlatTileBasemap, string> = {
  map: "ocean",
  satellite: "imagery",
};

function readTilesEnv(): string {
  return ((import.meta.env.VITE_FLAT_BASEMAP_TILES_URL as string | undefined) ?? "").trim();
}

/** Root URL of the tile pyramid (`…/tiles`), or null when tiles are disabled. */
export function getFlatBasemapTilesBaseUrl(): string | null {
  const raw = readTilesEnv();
  if (!raw || raw.toLowerCase() === "off") return null;
  return raw.replace(/\/+$/, "");
}

export function isFlatBasemapTilesEnabled(): boolean {
  return getFlatBasemapTilesBaseUrl() !== null;
}

/**
 * View scale below which the pre-rendered tiles are too coarse and the live MapServer export
 * should be shown instead. Allows a little overzoom (~1.3x) of the finest level.
 */
export function getFlatTileHandoffScale(projection: FlatTileProjection): number {
  const scheme = getScheme(projection);
  const metersPerUnit = scheme.spatialReference.isGeographic ? METERS_PER_DEGREE : 1;
  const resolution = scheme.resolution0 / 2 ** scheme.maxLevel;
  return ((resolution * metersPerUnit * TILE_DPI) / 0.0254) * 0.75;
}

function buildTileInfo(scheme: FlatTileScheme): TileInfo {
  const metersPerUnit = scheme.spatialReference.isGeographic ? METERS_PER_DEGREE : 1;
  const lods: LOD[] = [];
  for (let level = 0; level <= scheme.maxLevel; level++) {
    const resolution = scheme.resolution0 / 2 ** level;
    lods.push(
      new LOD({
        level,
        resolution,
        scale: (resolution * metersPerUnit * TILE_DPI) / 0.0254,
      })
    );
  }
  return new TileInfo({
    dpi: TILE_DPI,
    size: [TILE_SIZE, TILE_SIZE],
    origin: new Point({
      x: scheme.extent.xmin,
      y: scheme.extent.ymax,
      spatialReference: scheme.spatialReference,
    }),
    spatialReference: scheme.spatialReference,
    lods,
  });
}

type FlatTileLayerProperties = __esri.BaseTileLayerProperties & { urlTemplate: string };

const FlatBasemapTileLayer = (
  BaseTileLayer as unknown as {
    createSubclass(definition: object): new (properties: FlatTileLayerProperties) => BaseTileLayer;
  }
).createSubclass({
  properties: { urlTemplate: {} },
  getTileUrl(this: { urlTemplate: string }, level: number, row: number, col: number): string {
    return this.urlTemplate
      .replace("{level}", String(level))
      .replace("{col}", String(col))
      .replace("{row}", String(row));
  },
});

export function createFlatTileLayer(
  projection: FlatTileProjection,
  kind: FlatTileBasemap,
  id: string
): BaseTileLayer {
  const base = getFlatBasemapTilesBaseUrl();
  if (!base) throw new Error("Flat basemap tiles are disabled");

  const scheme = getScheme(projection);
  return new FlatBasemapTileLayer({
    id,
    urlTemplate: `${base}/${KIND_FOLDER[kind]}/${scheme.folder}/{level}/{col}/{row}.webp`,
    tileInfo: buildTileInfo(scheme),
    spatialReference: scheme.spatialReference,
    fullExtent: scheme.extent.clone(),
    maxScale: getFlatTileHandoffScale(projection),
  });
}
