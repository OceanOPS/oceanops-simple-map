import { initMap } from "./map";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer.js";
import PointSymbol3D from "@arcgis/core/symbols/PointSymbol3D.js";
import IconSymbol3DLayer from "@arcgis/core/symbols/IconSymbol3DLayer.js";
import { categories, type Shape } from "./categories";
import { attachLegend } from "./legend";

const BASE = import.meta.env.BASE_URL;

export function makeImageRenderer(imagePath: string) {
  return new SimpleRenderer({
    symbol: new PointSymbol3D({
      symbolLayers: [
        new IconSymbol3DLayer({
          resource: { href: `${BASE}${imagePath}` },
          size: 11,
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
          size: 5,
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
        width: 20000,
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
      popupTemplate: cat.type === 'line' ? 
      {
        title: "{name}",
        content: `
          <b>Type:</b> ${cat.label}<br>
          <b>Name:</b> {name}<br><br>
          <a target="_blank" href="https://www.ocean-ops.org/board/wa/InspectLine?name={name}">Inspect at OceanOPS</a>
        `,
      } : {
        title: "{ptf_ref}",
        content: `
          <b>Type:</b> ${cat.label}<br>
          <b>Reference:</b> {ptf_ref}<br>
          <b>Model:</b> {ptf_model}<br>
          <b>Country:</b> {country_name}<br><br>
          <a target="_blank" href="https://www.ocean-ops.org/board/wa/Platform?ref={ptf_ref}">Inspect at OceanOPS</a>
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
  
  attachLegend(view, layerById);
})();
