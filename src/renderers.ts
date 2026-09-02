import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer.js";
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer.js";
import PointSymbol3D from "@arcgis/core/symbols/PointSymbol3D.js";
import IconSymbol3DLayer from "@arcgis/core/symbols/IconSymbol3DLayer.js";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol.js";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol.js";
import PictureMarkerSymbol from "@arcgis/core/symbols/PictureMarkerSymbol.js";
import type { Shape } from "./categories";
import { is3dProjection, type ProjectionId } from "./projections";

const BASE = import.meta.env.BASE_URL;

export function makeImageRenderer3D(imagePath: string) {
  return new SimpleRenderer({
    symbol: new PointSymbol3D({
      symbolLayers: [
        new IconSymbol3DLayer({
          resource: { href: `${BASE}${imagePath}` },
          size: 11,
          anchor: "center",
        }),
      ],
    }),
  });
}

export function makePointRenderer3D(color: string, shape: Shape = "circle") {
  return new SimpleRenderer({
    symbol: new PointSymbol3D({
      symbolLayers: [
        new IconSymbol3DLayer({
          resource: { primitive: shape },
          material: { color },
          size: 5,
          outline: { color: "black", size: 0.5 },
        }),
      ],
    }),
  });
}

/** Screen size (px) for 3D ship lines — solid and dashed share the same width. */
export const LINE_3D_LINE_SIZE_PX = 3;

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

export function makeImageRenderer2D(imagePath: string) {
  return new SimpleRenderer({
    symbol: new PictureMarkerSymbol({
      url: `${BASE}${imagePath}`,
      width: MERCATOR_SHIP_WIDTH,
      height: MERCATOR_SHIP_HEIGHT,
    }),
  });
}

export function makePointRenderer2D(color: string, shape: Shape = "circle") {
  return new SimpleRenderer({
    symbol: new SimpleMarkerSymbol({
      style: markerStyle(shape),
      color,
      size: MERCATOR_POINT_SIZE,
      outline: { color: [0, 0, 0, 1], width: 0.5 },
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

/** GO-SHIP / Ocean TraX: solid vs dash by line_style field. */
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

/** Ocean TraX (SOT): solid = active, dash = reactivate — same orange for both. */
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

export function makeCategoryRenderer(
  projection: ProjectionId,
  kind: "image" | "line" | "point",
  color: string,
  imagePath?: string,
  shape?: Shape
) {
  const use3d = is3dProjection(projection);
  if (kind === "image") {
    return use3d
      ? makeImageRenderer3D(imagePath ?? "")
      : makeImageRenderer2D(imagePath ?? "");
  }
  if (kind === "line") {
    return use3d ? makeLineRenderer3D(color) : makeLineRenderer2D(color);
  }
  return use3d
    ? makePointRenderer3D(color, shape ?? "circle")
    : makePointRenderer2D(color, shape ?? "circle");
}
