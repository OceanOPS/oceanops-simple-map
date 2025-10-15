import { categories } from "./categories";

const BASE = import.meta.env.BASE_URL;

export function makeSwatch(cat: (typeof categories)[number]) {
  // use inline SVG for crisp shapes
  const svgNS = "http://www.w3.org/2000/svg";

  if (cat.type === "point") {
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");

    if (cat.shape === "circle" || !cat.shape) {
      const c = document.createElementNS(svgNS, "circle");
      c.setAttribute("cx", "7"); c.setAttribute("cy", "7"); c.setAttribute("r", "5");
      c.setAttribute("fill", cat.color);
      c.setAttribute("stroke", "#1a1a1aff"); c.setAttribute("stroke-width", "1");
      svg.appendChild(c);
    } else if (cat.shape === "square") {
      const r = document.createElementNS(svgNS, "rect");
      r.setAttribute("x", "2"); r.setAttribute("y", "2");
      r.setAttribute("width", "10"); r.setAttribute("height", "10");
      r.setAttribute("fill", cat.color);
      r.setAttribute("stroke", "#000000ff"); r.setAttribute("stroke-width", "1");
      svg.appendChild(r);
    } else if (cat.shape === "triangle") {
      const p = document.createElementNS(svgNS, "polygon");
      p.setAttribute("points", "7,2 12,12 2,12"); // upright triangle
      p.setAttribute("fill", cat.color);
      p.setAttribute("stroke", "#000000ff"); p.setAttribute("stroke-width", "1");
      svg.appendChild(p);
    }
    return svg;
  }

  if (cat.type === "image") {
    const img = document.createElement("img");
    img.src = `${BASE}${cat.imagePath}`;
    img.width = 18; img.height = 18;
    img.style.objectFit = "contain";
    img.style.border = "none";
    img.style.borderRadius = "3px";
    return img;
  }

  // line
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "12");
  const line = document.createElementNS(svgNS, "line");
  line.setAttribute("x1", "2"); line.setAttribute("y1", "6");
  line.setAttribute("x2", "18"); line.setAttribute("y2", "6");
  line.setAttribute("stroke", cat.color);
  line.setAttribute("stroke-width", "3");
  line.setAttribute("stroke-linecap", "round");
  svg.appendChild(line);
  return svg;
}
