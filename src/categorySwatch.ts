import { categories, type Category } from "./categories";
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

function appendDualLineSwatch(
  container: HTMLDivElement,
  solidColor: string,
  dashColor: string
) {
  container.classList.add("o-legend-swatch--dual-line");
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "32");
  svg.setAttribute("height", "12");
  svg.setAttribute("viewBox", "0 0 32 12");

  const solid = document.createElementNS(svgNS, "line");
  solid.setAttribute("x1", "1");
  solid.setAttribute("y1", "6");
  solid.setAttribute("x2", "11");
  solid.setAttribute("y2", "6");
  solid.setAttribute("stroke", solidColor);
  solid.setAttribute("stroke-width", "3");
  solid.setAttribute("stroke-linecap", "round");

  const dashed = document.createElementNS(svgNS, "line");
  dashed.setAttribute("x1", "20");
  dashed.setAttribute("y1", "6");
  dashed.setAttribute("x2", "30");
  dashed.setAttribute("y2", "6");
  dashed.setAttribute("stroke", dashColor);
  dashed.setAttribute("stroke-width", "3");
  dashed.setAttribute("stroke-linecap", "round");
  dashed.setAttribute("stroke-dasharray", "4 3");

  svg.append(solid, dashed);
  container.appendChild(svg);
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

  if (cat.type === "point") {
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");

    if (cat.shape === "square") {
      const r = document.createElementNS(svgNS, "rect");
      r.setAttribute("x", "2");
      r.setAttribute("y", "2");
      r.setAttribute("width", "10");
      r.setAttribute("height", "10");
      r.setAttribute("fill", cat.color);
      r.setAttribute("stroke", "#fff");
      r.setAttribute("stroke-width", "1");
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
    appendDualLineSwatch(container, cat.color, cat.color);
    return container;
  }

  if (cat.id === "oceantrax") {
    appendDualLineSwatch(container, cat.color, cat.color);
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

function appendLineStyleRow(
  parent: HTMLElement,
  color: string,
  style: "solid" | "dash",
  label: string
) {
  parent.appendChild(createLineStyleRow(color, style, label));
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

function appendLineStyleGroupTitle(parent: HTMLElement, title: string) {
  const heading = document.createElement("p");
  heading.className = "o-legend-line-style-title";
  heading.textContent = title;
  parent.appendChild(heading);
}

/** Visual solid/dash key for Ocean TraX and GO-SHIP (replaces footer prose). */
export function makeLineStyleLegend(goshipSinceYear = "2025"): HTMLElement {
  const oceantrax = categories.find((cat) => cat.id === "oceantrax");
  const goship = categories.find((cat) => cat.id === "goship");

  const wrap = document.createElement("div");
  wrap.className = "o-legend-line-styles";

  if (oceantrax) {
    const group = document.createElement("div");
    group.className = "o-legend-line-style-group";
    appendLineStyleGroupTitle(group, "Ocean TraX");
    appendLineStyleRow(group, oceantrax.color, "solid", "Active");
    appendLineStyleRow(group, oceantrax.color, "dash", "Reactivate");
    wrap.appendChild(group);
  }

  if (goship) {
    const group = document.createElement("div");
    group.className = "o-legend-line-style-group";
    appendLineStyleGroupTitle(group, "GO-SHIP");
    appendLineStyleRow(
      group,
      goship.color,
      "solid",
      `Sampled since ${goshipSinceYear}`
    );
    appendLineStyleRow(
      group,
      goship.color,
      "dash",
      `Not sampled since ${goshipSinceYear}`
    );
    wrap.appendChild(group);
  }

  return wrap;
}

export function makeNetworkPicto(layerId: string): HTMLElement {
  const icon = makeNetworkIconImg(layerId);
  if (icon) return icon;

  const cat = getCategoryById(layerId);
  if (cat) return makeCategorySwatch(cat);

  const placeholder = document.createElement("span");
  placeholder.className = "o-network-picto o-network-picto--empty";
  placeholder.setAttribute("aria-hidden", "true");
  return placeholder;
}
