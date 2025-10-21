import esriConfig from "@arcgis/core/config.js";
import Map from "@arcgis/core/Map.js";
import SceneView from "@arcgis/core/views/SceneView.js";
import Basemap from "@arcgis/core/Basemap.js";
import TileLayer from "@arcgis/core/layers/TileLayer.js";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer.js";
export async function initMap(containerId = "viewDiv") {
  esriConfig.assetsPath = "https://js.arcgis.com/4.33/@arcgis/core/assets";

  // ===== BASEMAP OPTIONS - Uncomment one to try =====

  // CURRENT: Ocean base (default)
  const oceanBase = new TileLayer({
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer"
  });
  const basemap = new Basemap({
    baseLayers: [oceanBase],
    referenceLayers: []
  });

  // OPTION 1: Gray Vector (light minimalist)
  // const basemap = Basemap.fromId("gray-vector");

  // OPTION 2: Dark Gray Vector (dark minimalist)
  // const basemap = Basemap.fromId("dark-gray-vector");

  // OPTION 3: Streets Night (dark with urban details)
  // const basemap = Basemap.fromId("streets-night-vector");

  // OPTION 4: Satellite imagery
  // const basemap = Basemap.fromId("satellite");

  // OPTION 5: Hybrid (satellite + labels)
  // const basemap = Basemap.fromId("hybrid");

  // OPTION 6: Topographic modern
  // const basemap = Basemap.fromId("topo-vector");

  // OPTION 7: Terrain with relief
  // const basemap = Basemap.fromId("terrain");

  // OPTION 8: OSM (OpenStreetMap)
  // const basemap = Basemap.fromId("osm");

  // OPTION 9: Streets modern
  // const basemap = Basemap.fromId("streets-vector");

  // ===== END BASEMAP OPTIONS =====

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

  // Disable mouse wheel zoom using new API
  view.navigation.actionMap.mouseWheel = "none";

  // Move navigation controls to bottom-right
  view.ui.move("zoom", "bottom-right");
  view.ui.move("compass", "bottom-right");
  view.ui.remove("navigation-toggle");

  return { map, view };
}
