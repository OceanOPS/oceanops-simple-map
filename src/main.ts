import { initMap } from "./map";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer.js";
import PointSymbol3D from "@arcgis/core/symbols/PointSymbol3D.js";
import IconSymbol3DLayer from "@arcgis/core/symbols/IconSymbol3DLayer.js";
import { categories } from "./categories";

const BASE = import.meta.env.BASE_URL;

export function makeShipRenderer() {
  return new SimpleRenderer({
    symbol: new PointSymbol3D({
      symbolLayers: [
        new IconSymbol3DLayer({
          resource: { href: `${BASE}img/ship.png` },
          size: 10,
          anchor: "center",
        })
      ]
    })
  });
}

function makePointRenderer3D(color: string) {
  return new SimpleRenderer({
    symbol: new PointSymbol3D({
      symbolLayers: [
        new IconSymbol3DLayer({
          resource: { primitive: "circle" },
          material: { color },
          size: 4,
          outline: { color: "white", size: 0.5 },
        }),
      ],
    })
  });
}

(async () => {
  const { map, view } = await initMap("viewDiv");

  const layerById = new Map<string, GeoJSONLayer>();
  const layerPromises: Promise<unknown>[] = [];
  const BASE = import.meta.env.BASE_URL;

  for (const cat of categories) {

    const renderer =
    cat.id === "ship"
      ? makeShipRenderer()
      : makePointRenderer3D(cat.color);

    const layer = new GeoJSONLayer({
      url: `${BASE}/geojson/${cat.id}.geojson`,
      title: cat.label,
      outFields: ["*"],
      renderer: renderer,
      elevationInfo: {
        mode: "absolute-height",
        featureExpressionInfo: { expression: "0" },
        offset: 0,
      },
      screenSizePerspectiveEnabled: true,
      popupTemplate: {
        title: "{name}",      // uses field from GeoJSON
        content: `
          <b>Type:</b> ${cat.label}<br>
          <b>ID:</b> {name}
        `,
      },
    });

    map.add(layer);
    layerById.set(cat.id, layer);
    layerPromises.push(layer.when());
  }

  await Promise.all(layerPromises);
  let union: __esri.Extent | null = null;
  for (const layer of layerById.values()) {
    const ext = layer.fullExtent ?? null;
    if (ext) union = union ? union.union(ext) : ext;
  }
  if (union) view.goTo(union, { animate: false, duration: 0 }).catch(() => {});

  document.getElementById("legend")?.remove();
  const legend = document.createElement("div");
  legend.className = "o-legend";
  legend.innerHTML = `<strong>Layers</strong>`;
  view.ui.add(legend, "top-right");

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

    const swatch = document.createElement("span");
    swatch.style.cssText =
      "width:12px;height:12px;border:1px solid #888;border-radius:50%;display:inline-block;";
    swatch.style.background = cat.color;

    const text = document.createElement("span");
    text.textContent = cat.label;

    cb.addEventListener("change", () => {
      const layer = layerById.get(cat.id);
      if (layer) layer.visible = cb.checked;
    });

    row.append(cb, swatch, text);
    list.appendChild(row);
  }
  legend.appendChild(list);
})();
