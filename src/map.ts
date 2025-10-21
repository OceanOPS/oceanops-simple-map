import esriConfig from "@arcgis/core/config.js";
import Map from "@arcgis/core/Map.js";
import SceneView from "@arcgis/core/views/SceneView.js";
import Basemap from "@arcgis/core/Basemap.js";
import TileLayer from "@arcgis/core/layers/TileLayer.js";
export async function initMap(containerId = "viewDiv") {
  esriConfig.assetsPath = "https://js.arcgis.com/4.33/@arcgis/core/assets";

  const oceanBase = new TileLayer({
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer"
  });

  const basemap = new Basemap({
    baseLayers: [oceanBase],
    referenceLayers: []
  });

  const map = new Map({
    basemap
  });

  const view = new SceneView({
    container: containerId,
    map,
    camera: { position: { longitude: 0, latitude: 20, z: 3.0e7 }, tilt: 20 },
    qualityProfile: "low",
    environment: { 
      atmosphereEnabled: false, 
      starsEnabled: false,
      lighting: {
        type: "virtual", 
        directShadowsEnabled: false
      },
      background: { type: "color", color: [11, 30, 66, 1] }
    }
  });

  await view.when();
  return { map, view };
}
