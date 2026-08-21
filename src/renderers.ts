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

/** Diameter of the 3D path tube used for line layers, in meters. */
export const LINE_3D_WIDTH_METERS = 20000;

/** 3D path tube — solid sampled lines; follows globe surface including dateline jumps. */
function makeGoshipPathSymbol3D(color: string, width: number) {
  return {
    type: "line-3d",
    symbolLayers: [
      {
        type: "path",
        profile: "circle",
        material: { color },
        width,
        cap: "round",
        join: "round",
      },
    ],
  } as any;
}

/** 3D flat line with dash pattern — requires antimeridian-split geometry (see densifyLayer). */
function makeGoshipDashedLineSymbol3D(color: string) {
  return {
    type: "line-3d",
    symbolLayers: [
      {
        type: "line",
        size: 3,
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

/** Native ship PNG aspect (38×21). */
const SHIP_MARKER_WIDTH = 16;
const SHIP_MARKER_HEIGHT = 9;

export function makeImageRenderer2D(imagePath: string) {
  return new SimpleRenderer({
    symbol: new PictureMarkerSymbol({
      url: `${BASE}${imagePath}`,
      width: SHIP_MARKER_WIDTH,
      height: SHIP_MARKER_HEIGHT,
    }),
  });
}

export function makePointRenderer2D(color: string, shape: Shape = "circle") {
  return new SimpleRenderer({
    symbol: new SimpleMarkerSymbol({
      style: markerStyle(shape),
      color,
      size: 8,
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

/** Ocean TraX (SOT): active sampled lines vs design lines not sampled. */
export const OCEAN_TRAX_ACTIVE_COLOR = "#43a047";
export const OCEAN_TRAX_INACTIVE_COLOR = "#c87832";

/** GO-SHIP: solid = sampled this edition, dash = design line not sampled. */
export function makeDualStyleLineRenderer(
  projection: ProjectionId,
  solidColor: string,
  dashColor: string
) {
  const use3d = is3dProjection(projection);
  if (use3d) {
    return new UniqueValueRenderer({
      field: "line_style",
      uniqueValueInfos: [
        {
          value: "solid",
          symbol: makeGoshipPathSymbol3D(solidColor, LINE_3D_WIDTH_METERS),
        },
        {
          value: "dash",
          symbol: makeGoshipDashedLineSymbol3D(dashColor),
        },
      ],
      defaultSymbol: makeGoshipDashedLineSymbol3D(dashColor),
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

export function makeOceanTraxLineRenderer(projection: ProjectionId) {
  return makeDualStyleLineRenderer(
    projection,
    OCEAN_TRAX_ACTIVE_COLOR,
    OCEAN_TRAX_INACTIVE_COLOR
  );
}

/** GO-SHIP: solid = sampled this edition, dash = design line not sampled. */
export function makeGoshipLineRenderer(projection: ProjectionId, color: string) {
  return makeDualStyleLineRenderer(projection, color, color);
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
