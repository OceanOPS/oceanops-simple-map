import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer.js";
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer.js";
import PointSymbol3D from "@arcgis/core/symbols/PointSymbol3D.js";
import IconSymbol3DLayer from "@arcgis/core/symbols/IconSymbol3DLayer.js";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol.js";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol.js";
import PictureMarkerSymbol from "@arcgis/core/symbols/PictureMarkerSymbol.js";
import { MOORING_SQUARE_MARKER_SIZES, type Shape } from "./categories";
import { is3dProjection, type ProjectionId } from "./projections";

const BASE = import.meta.env.BASE_URL;

export function makeImageRenderer3D(imagePath: string, tintColor?: string) {
  return new SimpleRenderer({
    symbol: new PointSymbol3D({
      symbolLayers: [
        new IconSymbol3DLayer({
          resource: { href: `${BASE}${imagePath}` },
          size: 11,
          anchor: "center",
          ...(tintColor ? { material: { color: tintColor } } : {}),
        }),
      ],
    }),
  });
}

export function makePointRenderer3D(color: string, shape: Shape = "circle", size = 5) {
  return new SimpleRenderer({
    symbol: new PointSymbol3D({
      symbolLayers: [
        new IconSymbol3DLayer({
          resource: { primitive: shape },
          material: { color },
          size,
          outline: { color: "black", size: 0.5 },
        }),
      ],
    }),
  });
}

/** Outline width (px) for hollow mooring stack rings — keep subtle vs inner tiers. */
export const MOORING_STACK_OUTLINE_WIDTH = 1.5;

/** Largest mooring tier: hollow ring so inner squares stay visible in SceneView. */
export function makeHollowSquareRenderer3D(color: string, size: number) {
  return new SimpleRenderer({
    symbol: new PointSymbol3D({
      symbolLayers: [
        new IconSymbol3DLayer({
          resource: { primitive: "square" },
          material: { color: [0, 0, 0, 0] },
          size,
          outline: { color, size: MOORING_STACK_OUTLINE_WIDTH },
        }),
      ],
    }),
  });
}

/** Screen size (px) for 3D ship lines when zoomed in — solid and dashed share the same width. */
export const LINE_3D_LINE_SIZE_PX = 3;
/** Very thin ship lines when the globe camera is pulled back. */
export const LINE_3D_LINE_SIZE_PX_UNZOOMED = 1.5;

/** Default SceneView camera altitude (m) — matches `createGlobeView`. */
export const GLOBE_CAMERA_Z_REF = 2.2e7;
/** Approximate closest globe camera altitude (m) used for width interpolation. */
export const GLOBE_CAMERA_Z_MIN = 2.5e6;

function globeZoomFactor(cameraZ: number): number {
  const z = Math.max(cameraZ, GLOBE_CAMERA_Z_MIN);
  if (z >= GLOBE_CAMERA_Z_REF) return 1;
  const logRef = Math.log(GLOBE_CAMERA_Z_REF);
  const logMin = Math.log(GLOBE_CAMERA_Z_MIN);
  return (Math.log(z) - logMin) / (logRef - logMin);
}

/** Interpolate line width (px) from zoomed-in to very thin when de-zoomed. */
export function lineSizePxForCameraZ(cameraZ: number): number {
  const t = globeZoomFactor(cameraZ);
  return (
    LINE_3D_LINE_SIZE_PX +
    (LINE_3D_LINE_SIZE_PX_UNZOOMED - LINE_3D_LINE_SIZE_PX) * t
  );
}

/** Diameter of generic 3D path tubes (non ship dual-style layers), in meters. */
export const LINE_3D_WIDTH_METERS = 20000;

/** 3D solid line (screen px) — same width as dashed lines. */
function makeGoshipSolidLineSymbol3D(color: string, sizePx: number) {
  return {
    type: "line-3d",
    symbolLayers: [
      {
        type: "line",
        size: sizePx,
        material: { color },
        cap: "round",
        join: "round",
      },
    ],
  } as any;
}

/** 3D dashed line — requires antimeridian-split geometry (see densifyLayer). */
function makeGoshipDashedLineSymbol3D(color: string, sizePx: number) {
  return {
    type: "line-3d",
    symbolLayers: [
      {
        type: "line",
        size: sizePx,
        material: { color },
        cap: "round",
        join: "round",
        pattern: {
          type: "style",
          style: "dash",
        },
      },
    ],
  } as any;
}

export function makeLineRenderer3D(color: string) {
  return new SimpleRenderer({
    symbol: {
      type: "line-3d",
      symbolLayers: [
        {
          type: "path",
          material: { color },
          width: LINE_3D_WIDTH_METERS,
        },
      ],
    } as any,
  });
}

function markerStyle(shape: Shape): "circle" | "square" | "triangle" {
  if (shape === "square") return "square";
  if (shape === "triangle") return "triangle";
  return "circle";
}

/** Web Mercator ship PNG aspect (38×21). */
const MERCATOR_SHIP_WIDTH = 11;
const MERCATOR_SHIP_HEIGHT = 6;
const MERCATOR_POINT_SIZE = 5;

export function makeImageRenderer2D(imagePath: string, tintColor?: string) {
  return new SimpleRenderer({
    symbol: new PictureMarkerSymbol({
      url: `${BASE}${imagePath}`,
      width: MERCATOR_SHIP_WIDTH,
      height: MERCATOR_SHIP_HEIGHT,
      ...(tintColor ? { color: tintColor } : {}),
    }),
  });
}

export function makePointRenderer2D(color: string, shape: Shape = "circle", size = MERCATOR_POINT_SIZE) {
  return new SimpleRenderer({
    symbol: new SimpleMarkerSymbol({
      style: markerStyle(shape),
      color,
      size,
      outline: { color: [0, 0, 0, 1], width: 0.5 },
    }),
  });
}

export function makeHollowSquareRenderer2D(color: string, size: number) {
  return new SimpleRenderer({
    symbol: new SimpleMarkerSymbol({
      style: "square",
      color: [0, 0, 0, 0],
      size,
      outline: { color, width: MOORING_STACK_OUTLINE_WIDTH },
    }),
  });
}

function makeStyledLineSymbol2D(
  color: string,
  style: "solid" | "dash" = "solid"
) {
  return new SimpleLineSymbol({
    color,
    width: 2,
    style,
  });
}

export function makeLineRenderer2D(color: string) {
  return new SimpleRenderer({
    symbol: makeStyledLineSymbol2D(color, "solid"),
  });
}

/** GO-SHIP / OceanTraX: solid vs dash by line_style field. */
export function makeDualStyleLineRenderer(
  projection: ProjectionId,
  solidColor: string,
  dashColor: string,
  lineSizePx = LINE_3D_LINE_SIZE_PX
) {
  const use3d = is3dProjection(projection);
  if (use3d) {
    return new UniqueValueRenderer({
      field: "line_style",
      uniqueValueInfos: [
        {
          value: "solid",
          symbol: makeGoshipSolidLineSymbol3D(solidColor, lineSizePx),
        },
        {
          value: "dash",
          symbol: makeGoshipDashedLineSymbol3D(dashColor, lineSizePx),
        },
      ],
      defaultSymbol: makeGoshipDashedLineSymbol3D(dashColor, lineSizePx),
    });
  }

  return new UniqueValueRenderer({
    field: "line_style",
    uniqueValueInfos: [
      {
        value: "solid",
        symbol: makeStyledLineSymbol2D(solidColor, "solid"),
      },
      {
        value: "dash",
        symbol: makeStyledLineSymbol2D(dashColor, "dash"),
      },
    ],
    defaultSymbol: makeStyledLineSymbol2D(dashColor, "dash"),
  });
}

/** OceanTraX (SOT): solid = active, dash = reactivate — same orange for both. */
export function makeOceanTraxLineRenderer(
  projection: ProjectionId,
  color: string,
  lineSizePx?: number
) {
  return makeDualStyleLineRenderer(projection, color, color, lineSizePx);
}

/** GO-SHIP: solid = sampled this edition, dash = design line not sampled. */
export function makeGoshipLineRenderer(
  projection: ProjectionId,
  color: string,
  lineSizePx?: number
) {
  return makeDualStyleLineRenderer(projection, color, color, lineSizePx);
}

/** Solid when alone; hollow ring when a visible stack partner shares the location. */
export type MooringStackVisibility = {
  oceansites: boolean;
  soconetMoorings: boolean;
};

export type OceanSitesStackVisibility = {
  soconetMoorings: boolean;
};

function makeStackedSquareRenderer(
  projection: ProjectionId,
  color: string,
  size: number,
  valueExpression: string
) {
  const use3d = is3dProjection(projection);
  const solidSymbol = use3d
    ? new PointSymbol3D({
        symbolLayers: [
          new IconSymbol3DLayer({
            resource: { primitive: "square" },
            material: { color },
            size,
            outline: { color: "black", size: 0.5 },
          }),
        ],
      })
    : new SimpleMarkerSymbol({
        style: "square",
        color,
        size,
        outline: { color: [0, 0, 0, 1], width: 0.5 },
      });
  const hollowSymbol = use3d
    ? new PointSymbol3D({
        symbolLayers: [
          new IconSymbol3DLayer({
            resource: { primitive: "square" },
            material: { color: [0, 0, 0, 0] },
            size,
            outline: { color, size: MOORING_STACK_OUTLINE_WIDTH },
          }),
        ],
      })
    : new SimpleMarkerSymbol({
        style: "square",
        color: [0, 0, 0, 0],
        size,
        outline: { color, width: MOORING_STACK_OUTLINE_WIDTH },
      });

  return new UniqueValueRenderer({
    valueExpression,
    uniqueValueInfos: [
      { value: 0, symbol: solidSymbol },
      { value: 1, symbol: hollowSymbol },
      { value: "0", symbol: solidSymbol },
      { value: "1", symbol: hollowSymbol },
    ],
    defaultSymbol: solidSymbol,
  });
}

export function makeMooredBuoysRenderer(
  projection: ProjectionId,
  color: string,
  stackVisibility: MooringStackVisibility = { oceansites: true, soconetMoorings: true }
) {
  const stackedSize = MOORING_SQUARE_MARKER_SIZES.moored_buoys;
  const oceansitesOn = stackVisibility.oceansites ? 1 : 0;
  const soconetOn = stackVisibility.soconetMoorings ? 1 : 0;

  return makeStackedSquareRenderer(
    projection,
    color,
    stackedSize,
    `
      var hollow = 0;
      if ($feature.stack_oceansites == 1 && ${oceansitesOn} == 1) { hollow = 1; }
      if ($feature.stack_soconet == 1 && ${soconetOn} == 1) { hollow = 1; }
      return hollow;
    `
  );
}

/** Solid when alone; hollow ring when SOCONET moorings share the location. */
export function makeOceanSitesRenderer(
  projection: ProjectionId,
  color: string,
  stackVisibility: OceanSitesStackVisibility = { soconetMoorings: true }
) {
  const size = MOORING_SQUARE_MARKER_SIZES.oceansites;
  const soconetOn = stackVisibility.soconetMoorings ? 1 : 0;

  return makeStackedSquareRenderer(
    projection,
    color,
    size,
    `
      var hollow = 0;
      if ($feature.stack_soconet == 1 && ${soconetOn} == 1) { hollow = 1; }
      return hollow;
    `
  );
}

export function makeCategoryRenderer(
  projection: ProjectionId,
  kind: "image" | "line" | "point",
  color: string,
  imagePath?: string,
  shape?: Shape,
  imageTintColor?: string,
  pointSize = MERCATOR_POINT_SIZE
) {
  const use3d = is3dProjection(projection);
  if (kind === "image") {
    return use3d
      ? makeImageRenderer3D(imagePath ?? "", imageTintColor)
      : makeImageRenderer2D(imagePath ?? "", imageTintColor);
  }
  if (kind === "line") {
    return use3d ? makeLineRenderer3D(color) : makeLineRenderer2D(color);
  }
  return use3d
    ? makePointRenderer3D(color, shape ?? "circle", pointSize)
    : makePointRenderer2D(color, shape ?? "circle", pointSize);
}
