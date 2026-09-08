import { categories, type Category, SOCONET_COLOR, MOORING_SQUARE_MARKER_SIZES } from "./categories";
import { makeNetworkIconImg } from "./networkIcons";

const BASE = import.meta.env.BASE_URL;

const svgNS = "http://www.w3.org/2000/svg";

function appendLineSample(
  container: HTMLElement,
  color: string,
  style: "solid" | "dash"
) {
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "28");
  svg.setAttribute("height", "12");
  svg.setAttribute("viewBox", "0 0 28 12");
  svg.setAttribute("aria-hidden", "true");

  const line = document.createElementNS(svgNS, "line");
  line.setAttribute("x1", "2");
  line.setAttribute("y1", "6");
  line.setAttribute("x2", "26");
  line.setAttribute("y2", "6");
  line.setAttribute("stroke", color);
  line.setAttribute("stroke-width", "3");
  line.setAttribute("stroke-linecap", "round");
  if (style === "dash") {
    line.setAttribute("stroke-dasharray", "5 3");
  }

  svg.appendChild(line);
  container.appendChild(svg);
}

function appendStackedDualLineSwatch(
  container: HTMLDivElement,
  solidColor: string,
  dashColor: string
) {
  container.classList.add("o-legend-swatch--dual-line", "o-legend-swatch--dual-line-stacked");
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("viewBox", "0 0 20 20");

  const solid = document.createElementNS(svgNS, "line");
  solid.setAttribute("x1", "2");
  solid.setAttribute("y1", "6");
  solid.setAttribute("x2", "18");
  solid.setAttribute("y2", "6");
  solid.setAttribute("stroke", solidColor);
  solid.setAttribute("stroke-width", "2.5");
  solid.setAttribute("stroke-linecap", "round");

  const dashed = document.createElementNS(svgNS, "line");
  dashed.setAttribute("x1", "2");
  dashed.setAttribute("y1", "14");
  dashed.setAttribute("x2", "18");
  dashed.setAttribute("y2", "14");
  dashed.setAttribute("stroke", dashColor);
  dashed.setAttribute("stroke-width", "2.5");
  dashed.setAttribute("stroke-linecap", "round");
  dashed.setAttribute("stroke-dasharray", "4 3");

  svg.append(solid, dashed);
  container.appendChild(svg);
}

function legendSquarePx(markerSize: number): number {
  return Math.max(6, Math.round(markerSize * 1.05));
}

function appendSquareSwatch(container: HTMLElement, color: string, markerSize = 8) {
  const px = legendSquarePx(markerSize);
  const pad = Math.max(1, Math.floor((14 - px) / 2));
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "14");
  svg.setAttribute("viewBox", "0 0 14 14");
  svg.setAttribute("aria-hidden", "true");
  svg.style.display = "block";
  svg.style.flexShrink = "0";
  const r = document.createElementNS(svgNS, "rect");
  r.setAttribute("x", String(pad));
  r.setAttribute("y", String(pad));
  r.setAttribute("width", String(px));
  r.setAttribute("height", String(px));
  r.setAttribute("fill", color);
  r.setAttribute("stroke", "#fff");
  r.setAttribute("stroke-width", "1");
  svg.appendChild(r);
  container.appendChild(svg);
}

/** SOCONET legend: ship + square side by side, same colour. */
export function makeSoconetDualSwatch(
  imagePath: string,
  color: string = SOCONET_COLOR
): HTMLDivElement {
  const container = document.createElement("div");
  container.className = "o-legend-swatch o-legend-swatch--soconet-dual";
  container.setAttribute("aria-hidden", "true");

  const img = document.createElement("img");
  img.src = `${BASE}${imagePath}`;
  img.className = "o-legend-swatch-img";
  img.alt = "";
  img.decoding = "async";

  container.appendChild(img);
  appendSquareSwatch(container, color, MOORING_SQUARE_MARKER_SIZES.soconet_moorings);
  return container;
}

export function getCategoryById(layerId: string): Category | undefined {
  return categories.find((cat) => cat.id === layerId) as Category | undefined;
}

/** Legend-style swatch matching each category's map symbology. */
export function makeCategorySwatch(cat: Category): HTMLDivElement {
  const svgNS = "http://www.w3.org/2000/svg";

  const container = document.createElement("div");
  container.className = "o-legend-swatch";
  container.setAttribute("aria-hidden", "true");

  if (cat.id === "soconet" && cat.type === "image") {
    return makeSoconetDualSwatch(cat.imagePath, cat.color);
  }

  if (cat.type === "point") {
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");

    if (cat.shape === "square") {
      const px = legendSquarePx(cat.markerSize ?? 8);
      const pad = Math.max(1, Math.floor((14 - px) / 2));
      const r = document.createElementNS(svgNS, "rect");
      r.setAttribute("x", String(pad));
      r.setAttribute("y", String(pad));
      r.setAttribute("width", String(px));
      r.setAttribute("height", String(px));
      r.setAttribute("fill", cat.color);
      r.setAttribute("stroke", "#fff");
      r.setAttribute("stroke-width", "1");
      svg.setAttribute("viewBox", "0 0 14 14");
      svg.appendChild(r);
      container.appendChild(svg);
      return container;
    }

    if (cat.shape === "triangle") {
      const p = document.createElementNS(svgNS, "polygon");
      p.setAttribute("points", "7,2 12,12 2,12");
      p.setAttribute("fill", cat.color);
      p.setAttribute("stroke", "#fff");
      p.setAttribute("stroke-width", "1");
      svg.appendChild(p);
      container.appendChild(svg);
      return container;
    }

    const c = document.createElementNS(svgNS, "circle");
    c.setAttribute("cx", "7");
    c.setAttribute("cy", "7");
    c.setAttribute("r", "5");
    c.setAttribute("fill", cat.color);
    c.setAttribute("stroke", "#fff");
    c.setAttribute("stroke-width", "1");
    svg.appendChild(c);
    container.appendChild(svg);
    return container;
  }

  if (cat.type === "image") {
    const img = document.createElement("img");
    img.src = `${BASE}${cat.imagePath}`;
    img.className = "o-legend-swatch-img";
    img.alt = "";
    img.decoding = "async";
    container.appendChild(img);
    return container;
  }

  if (cat.id === "goship") {
    appendStackedDualLineSwatch(container, cat.color, cat.color);
    return container;
  }

  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "12");
  const line = document.createElementNS(svgNS, "line");
  line.setAttribute("x1", "2");
  line.setAttribute("y1", "6");
  line.setAttribute("x2", "18");
  line.setAttribute("y2", "6");
  line.setAttribute("stroke", cat.color);
  line.setAttribute("stroke-width", "3");
  line.setAttribute("stroke-linecap", "round");
  svg.appendChild(line);
  container.appendChild(svg);
  return container;
}

/** Small inline line icon for prose-style legend notes. */
export function makeInlineLineSample(
  color: string,
  style: "solid" | "dash"
): HTMLSpanElement {
  const wrap = document.createElement("span");
  wrap.className = "o-legend-inline-line";
  wrap.setAttribute("aria-hidden", "true");
  appendLineSample(wrap, color, style);
  return wrap;
}

export type NetworksDataNoteOptions = {
  asOf: string;
};

const LAST_12_MONTHS = "the last 12 months";

/** Networks footer — platform locations + inline XBT/GO-SHIP line keys. */
export function buildNetworksDataNote({
  asOf,
}: NetworksDataNoteOptions): HTMLParagraphElement {
  const oceantrax = categories.find((cat) => cat.id === "oceantrax");
  const goship = categories.find((cat) => cat.id === "goship");
  const xbtColor = oceantrax?.color ?? "#faa62d";
  const goshipColor = goship?.color ?? "#ee2f2b";

  const paragraph = document.createElement("p");
  paragraph.className = "o-legend-data-note__text";

  paragraph.append(`Latest locations of operational platforms as of ${asOf}. `);
  paragraph.append("XBT reference lines ");
  paragraph.append(makeInlineLineSample(xbtColor, "solid"));
  paragraph.append(` sampled in ${LAST_12_MONTHS}. `);
  paragraph.append("GO-SHIP lines: ");
  paragraph.append(makeInlineLineSample(goshipColor, "solid"));
  paragraph.append(` sampled in ${LAST_12_MONTHS}, `);
  paragraph.append(makeInlineLineSample(goshipColor, "dash"));
  paragraph.append(
    ` not sampled in ${LAST_12_MONTHS}. Data source: OceanOPS.`
  );

  return paragraph;
}

/** Solid/dash line sample row (shared by sidebar legend and GO-SHIP modal). */
export function createLineStyleRow(
  color: string,
  style: "solid" | "dash",
  label: string
): HTMLElement {
  const row = document.createElement("div");
  row.className = "o-legend-line-style-row";

  const sample = document.createElement("span");
  sample.className = "o-legend-line-style-sample";
  appendLineSample(sample, color, style);

  const text = document.createElement("span");
  text.className = "o-legend-line-style-label";
  text.textContent = label;

  row.append(sample, text);
  return row;
}

export function makeNetworkPicto(
  layerId: string,
  _context: "legend" | "modal" = "legend"
): HTMLElement {
  const icon = makeNetworkIconImg(layerId);
  if (icon) return icon;

  const cat = getCategoryById(layerId);
  if (cat) return makeCategorySwatch(cat);

  const placeholder = document.createElement("span");
  placeholder.className = "o-network-picto o-network-picto--empty";
  placeholder.setAttribute("aria-hidden", "true");
  return placeholder;
}
