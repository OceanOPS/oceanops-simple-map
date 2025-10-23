import esriConfig from "@arcgis/core/config.js";
import Map from "@arcgis/core/Map.js";
import SceneView from "@arcgis/core/views/SceneView.js";
import Basemap from "@arcgis/core/Basemap.js";
// import TileLayer from "@arcgis/core/layers/TileLayer.js"; // Only needed for Ocean base
export async function initMap(containerId = "viewDiv") {
  esriConfig.assetsPath = "https://js.arcgis.com/4.33/@arcgis/core/assets";

  // ===== BASEMAP OPTIONS - Uncomment one to try =====

  // CURRENT: Ocean base (default)
  // const oceanBase = new TileLayer({
  //   url: "https://services.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer"
  // });
  // const basemap = new Basemap({
  //   baseLayers: [oceanBase],
  //   referenceLayers: []
  // });

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

  // OPTION 10: Oceans (focused on oceanographic data - RECOMMENDED!)
  // const basemap = Basemap.fromId("oceans");

  // OPTION 11: Streets Navigation (clean navigation style)
  // const basemap = Basemap.fromId("streets-navigation-vector");

  // OPTION 12: Streets Relief (with terrain shading)
  // const basemap = Basemap.fromId("streets-relief-vector");

   // ===== 3D OPTIMIZED BASEMAPS (Best for SceneView/Globe) =====

  // OPTION 13: Gray 3D (ultra minimal light - RECOMMENDED for clean look)
  // const basemap = Basemap.fromId("gray-3d");

  // OPTION 14: Dark Gray 3D (ultra minimal dark - no labels)
  // const basemap = Basemap.fromId("dark-gray-3d");

  // OPTION 15: Topo 3D (topographic optimized for 3D)
  // const basemap = Basemap.fromId("topo-3d");

  // OPTION 16: Navigation 3D (clean navigation for 3D)
  const basemapId = "navigation-3d";
  const basemap = Basemap.fromId(basemapId);

  // OPTION 17: Navigation Dark 3D (dark navigation for 3D)
  // const basemap = Basemap.fromId("navigation-dark-3d");

  // OPTION 18: Streets 3D (detailed streets for 3D)
  // const basemap = Basemap.fromId("streets-3d");

  // OPTION 19: Streets Dark 3D (dark streets for 3D)
  // const basemap = Basemap.fromId("streets-dark-3d");

  // OPTION 20: OSM 3D (OpenStreetMap for 3D)
  // const basemap = Basemap.fromId("osm-3d");

  // ===== END BASEMAP OPTIONS =====

  const map = new Map({
    basemap
  });

  const view = new SceneView({
    container: containerId,
    map,
    camera: { position: { longitude: 0, latitude: 0, z: 2.2e7 }, tilt: 0 },
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

  // Remove labels and boundaries from basemap after it loads
  if (map.basemap) {
    // Remove all reference layers (labels, place names, boundaries)
    map.basemap.referenceLayers.removeAll();

    // Wait for base layers to load, then filter out label layers
    const baseLayers = map.basemap.baseLayers;
    const removeLabels = async () => {
      // Wait for all layers to load
      const loadPromises = baseLayers.map((layer: any) => layer.load?.() || Promise.resolve());
      await Promise.all(loadPromises);

      const layersToRemove: any[] = [];
      baseLayers.forEach((layer: any) => {
        // Remove layers that contain "label", "reference", "place", or "text" in their title/id/url
        const title = (layer.title || "").toLowerCase();
        const id = (layer.id || "").toLowerCase();
        const url = (layer.url || "").toLowerCase();
        if (title.includes("label") || title.includes("reference") || title.includes("place") || title.includes("text") ||
            id.includes("label") || id.includes("reference") || id.includes("place") || id.includes("text") ||
            url.includes("label") || url.includes("reference") || url.includes("place") || url.includes("text")) {
          layersToRemove.push(layer);
        }
      });
      layersToRemove.forEach(layer => baseLayers.remove(layer));
    };
    removeLabels();
  }

  // Disable mouse wheel zoom using new API
  view.navigation.actionMap.mouseWheel = "none";

  // Move navigation controls to bottom-right
  view.ui.move("zoom", "bottom-right");
  view.ui.move("compass", "bottom-right");
  view.ui.remove("navigation-toggle");

  // Auto-rotate globe until user interacts
  let isRotating = true;
  let rotationFrame: number;

  const rotate = () => {
    if (!isRotating) return;

    const camera = view.camera.clone();
    if (camera.position.longitude !== null && camera.position.longitude !== undefined) {
      camera.position.longitude += 0.1; // Rotation speed
      view.goTo(camera, { animate: false }).catch(() => {});
    }
    rotationFrame = requestAnimationFrame(rotate);
  };

  const stopRotation = () => {
    if (isRotating) {
      isRotating = false;
      if (rotationFrame) cancelAnimationFrame(rotationFrame);
    }
  };

  // Stop rotation on user interaction
  view.on("drag", stopRotation);
  view.on("mouse-wheel", stopRotation);
  view.on("key-down", stopRotation);
  view.on("double-click", stopRotation);

  // Start rotation
  rotate();

  return { map, view };
}
