import { categories, type Category } from "./categories";
import { makeNetworkIconImg } from "./networkIcons";

const BASE = import.meta.env.BASE_URL;

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
    img.width = 18;
    img.height = 18;
    img.alt = "";
    img.decoding = "async";
    container.appendChild(img);
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
