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
  toggleButton.title = "Toggle filters";
  toggleButton.setAttribute("aria-label", "Filtros");
  toggleButton.setAttribute("aria-expanded", "false");
  toggleButton.innerHTML = `
    <svg width="18" height="17" viewBox="0 0 18 17" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.1842 11.9459C11.3767 11.9459 12.3816 12.7232 12.6909 13.7838H18V15.1622H12.6909C12.3816 16.2228 11.3767 17 10.1842 17C8.99173 17 7.9868 16.2228 7.67748 15.1622H0V13.7838H7.67748C7.9868 12.7232 8.99173 11.9459 10.1842 11.9459ZM10.1842 13.3243C9.7972 13.3243 9.45478 13.5053 9.23869 13.7838C9.08961 13.9759 9 14.214 9 14.473C9 14.732 9.08961 14.97 9.23869 15.1622C9.45478 15.4406 9.7972 15.6216 10.1842 15.6216C10.5712 15.6216 10.9136 15.4406 11.1297 15.1622C11.2788 14.97 11.3684 14.732 11.3684 14.473C11.3684 14.214 11.2788 13.9759 11.1297 13.7838C10.9136 13.5053 10.5712 13.3243 10.1842 13.3243ZM4.02632 5.97297C5.2188 5.97297 6.22373 6.75021 6.53305 7.81081H18V9.18919H6.53305C6.22373 10.2498 5.2188 11.027 4.02632 11.027C2.83383 11.027 1.8289 10.2498 1.51958 9.18919H0V7.81081H1.51958C1.8289 6.75021 2.83383 5.97297 4.02632 5.97297ZM4.02632 7.35135C3.37229 7.35135 2.84211 7.86562 2.84211 8.5C2.84211 9.13438 3.37229 9.64865 4.02632 9.64865C4.68034 9.64865 5.21053 9.13438 5.21053 8.5C5.21053 7.86562 4.68034 7.35135 4.02632 7.35135ZM13.9737 0C15.1662 0 16.1711 0.777233 16.4804 1.83784H18V3.21622H16.4804C16.1711 4.27682 15.1662 5.05405 13.9737 5.05405C12.7812 5.05405 11.7763 4.27682 11.467 3.21622H0V1.83784H11.467C11.7763 0.777233 12.7812 0 13.9737 0ZM13.9737 1.37838C13.5867 1.37838 13.2443 1.55936 13.0282 1.83784C12.8791 2.02997 12.7895 2.26804 12.7895 2.52703C12.7895 2.78602 12.8791 3.02409 13.0282 3.21622C13.2443 3.4947 13.5867 3.67568 13.9737 3.67568C14.3607 3.67568 14.7031 3.4947 14.9192 3.21622C15.0683 3.02409 15.1579 2.78602 15.1579 2.52703C15.1579 2.26804 15.0683 2.02997 14.9192 1.83784C14.7031 1.55936 14.3607 1.37838 13.9737 1.37838Z" fill="#184596"/>
    </svg>
  `;
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
