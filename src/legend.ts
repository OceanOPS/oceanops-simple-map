// legend.ts
import type SceneView from "@arcgis/core/views/SceneView";
import type Layer from "@arcgis/core/layers/Layer";
import { categories } from "./categories";

const BASE = import.meta.env.BASE_URL;

/** Inline SVG / IMG swatch that matches each category’s symbology */
function makeSwatch(cat: (typeof categories)[number]) {
  const svgNS = "http://www.w3.org/2000/svg";

  if (cat.type === "point") {
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");

    if (cat.shape === "square") {
      const r = document.createElementNS(svgNS, "rect");
      r.setAttribute("x", "2"); r.setAttribute("y", "2");
      r.setAttribute("width", "10"); r.setAttribute("height", "10");
      r.setAttribute("fill", cat.color);
      r.setAttribute("stroke", "#000"); r.setAttribute("stroke-width", "1");
      svg.appendChild(r);
      return svg;
    }

    if (cat.shape === "triangle") {
      const p = document.createElementNS(svgNS, "polygon");
      p.setAttribute("points", "7,2 12,12 2,12");
      p.setAttribute("fill", cat.color);
      p.setAttribute("stroke", "#000"); p.setAttribute("stroke-width", "1");
      svg.appendChild(p);
      return svg;
    }

    // default: circle
    const c = document.createElementNS(svgNS, "circle");
    c.setAttribute("cx", "7"); c.setAttribute("cy", "7"); c.setAttribute("r", "5");
    c.setAttribute("fill", cat.color);
    c.setAttribute("stroke", "#1a1a1a"); c.setAttribute("stroke-width", "1");
    svg.appendChild(c);
    return svg;
  }

  if (cat.type === "image") {
    const img = document.createElement("img");
    img.src = `${BASE}${cat.imagePath}`;
    img.width = 18; img.height = 18;
    img.style.objectFit = "contain";
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

/**
 * Build the legend UI, wire up layer toggles, and show feature counts.
 * Pass the `layerById` map you already maintain in main.ts.
 */
export function attachLegend(
  view: SceneView,
  layerById: Map<string, Layer>
) {
  // nuke any previous legend and toggle button
  document.getElementById("legend")?.remove();
  document.getElementById("legend-toggle")?.remove();

  // Create toggle button
  const toggleButton = document.createElement("button");
  toggleButton.id = "legend-toggle";
  toggleButton.className = "o-legend-toggle";
  toggleButton.innerHTML = "☰";
  toggleButton.title = "Toggle filters";
  toggleButton.setAttribute("aria-expanded", "false");
  view.ui.add(toggleButton, "top-left");

  const legend = document.createElement("div");
  legend.id = "legend";
  legend.className = "o-legend";
  legend.innerHTML = `<strong>GOOS Status report 2025</strong>`;
  legend.innerHTML += `<br>(in situ Networks)`;
  legend.style.display = "none"; // Hidden by default
  view.ui.add(legend, "top-left");

  // Toggle functionality
  toggleButton.addEventListener("click", () => {
    const isHidden = legend.style.display === "none";
    legend.style.display = isHidden ? "block" : "none";
    toggleButton.setAttribute("aria-expanded", isHidden ? "true" : "false");
  });

  const countNodes = new Map<string, HTMLSpanElement>();
  const list = document.createElement("div");
  list.style.marginTop = "8px";

  for (const cat of categories) {
    const row = document.createElement("label");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "8px";
    row.style.margin = "6px 0";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = true;

    const swatch = makeSwatch(cat);

    const text = document.createElement("span");
    text.textContent = cat.label;

    const count = document.createElement("span");
    count.textContent = " (…)";
    count.style.opacity = "0.7";
    countNodes.set(cat.id, count);

    cb.addEventListener("change", () => {
      const layer = layerById.get(cat.id);
      if (layer) (layer as any).visible = cb.checked;
    });

    row.append(cb, swatch, text, count);
    list.appendChild(row);
  }

  legend.appendChild(list);

  // After UI is built, query counts from each layer when ready
  for (const [id, layer] of layerById) {
    // guard: only layers with queryFeatureCount
    const canCount = typeof (layer as any).queryFeatureCount === "function";
    const when = (layer as any).when?.() ?? Promise.resolve();
    when.then(async () => {
      if (!canCount) {
        const node = countNodes.get(id);
        if (node) node.textContent = "";
        return;
      }
      try {
        const n = await (layer as any).queryFeatureCount({ where: "1=1" });
        const node = countNodes.get(id);
        if (node) node.textContent = ` (${n.toLocaleString()})`;
      } catch {
        const node = countNodes.get(id);
        if (node) node.textContent = "";
      }
    });
  }
}
