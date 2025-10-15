import { initMap } from "./map";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer.js";
import PointSymbol3D from "@arcgis/core/symbols/PointSymbol3D.js";
import IconSymbol3DLayer from "@arcgis/core/symbols/IconSymbol3DLayer.js";
import { categories, type Shape } from "./categories";
import {makeSwatch} from './legend.ts';

const BASE = import.meta.env.BASE_URL;

export function makeImageRenderer(imagePath: string) {
  return new SimpleRenderer({
    symbol: new PointSymbol3D({
      symbolLayers: [
        new IconSymbol3DLayer({
          resource: { href: `${BASE}${imagePath}` },
          size: 10,
          anchor: "center",
        })
      ]
    })
  });
}

export function makePointRenderer3D(color: string, shape: Shape = "circle") {
  return new SimpleRenderer({
    symbol: new PointSymbol3D({
      symbolLayers: [
        new IconSymbol3DLayer({
          resource: { primitive: shape },
          material: { color },
          size: 4,
          outline: { color: "black", size: 0.5 },
        }),
      ],
    })
  });
}

function makeLineRenderer(color: string) {
  return new SimpleRenderer({
    symbol: {
      type: "line-3d",
      symbolLayers: [{
        type: "path",
        material: { color },
        width: 40000
      }]
    } as any
  });
}



(async () => {
  const { map, view } = await initMap("viewDiv");

  const layerById = new Map<string, GeoJSONLayer>();
  const layerPromises: Promise<unknown>[] = [];
  const BASE = import.meta.env.BASE_URL;

  for (const cat of categories) {

    const renderer =
  cat.type === "image"
    ? makeImageRenderer(cat.imagePath ?? '') 
    : cat.type === "line"
    ? makeLineRenderer(cat.color)
    : makePointRenderer3D(cat.color, (cat.shape ?? "circle") as Shape);


    const layer = new GeoJSONLayer({
      url: `${BASE}geojson/${cat.id}.geojson`,
      title: cat.label,
      outFields: ["*"],
      renderer: renderer,
      elevationInfo: cat.type === 'line'
        ? { mode: "on-the-ground" }
        : { mode: "absolute-height", featureExpressionInfo: { expression: "0" }, offset: 0 },
      screenSizePerspectiveEnabled: true,
      popupTemplate: {
        title: "{ptf_ref}",
        content: `
          <b>Type:</b> ${cat.label}<br>
          <b>Reference:</b> {ptf_ref}<br>
          <b>Model:</b> {ptf_model}<br>
          <b>Country:</b> {country_name}
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

    const swatch = makeSwatch(cat);

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
