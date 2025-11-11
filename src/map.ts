import esriConfig from "@arcgis/core/config.js";
import Map from "@arcgis/core/Map.js";
import SceneView from "@arcgis/core/views/SceneView.js";
import Basemap from "@arcgis/core/Basemap.js";
import TileLayer from "@arcgis/core/layers/TileLayer.js";
export async function initMap(containerId = "viewDiv") {
  esriConfig.assetsPath = "https://js.arcgis.com/4.33/@arcgis/core/assets";

  const BASE = import.meta.env.BASE_URL;

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
  // const basemapId = "navigation-3d";

  // Pre-load both basemaps for smooth switching
  // Ocean base (default)
  const oceanBase = new TileLayer({
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer"
  });
  const navigationBasemap = new Basemap({
    baseLayers: [oceanBase],
    referenceLayers: []
  });
  const satelliteBasemap = Basemap.fromId("satellite");

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
    basemap: navigationBasemap
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
    },
    highlightOptions: {
      color: [244, 139, 37, 1], // #f48b25 in RGBA
      haloOpacity: 0.9,
      fillOpacity: 0.2
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

  // Add basemap selector FIRST so it appears at the top
  const basemapToggle = document.createElement("button");
  basemapToggle.className = "o-basemap-toggle";
  basemapToggle.title = "Change basemap";
  basemapToggle.setAttribute("aria-label", "Change basemap");

  let currentBasemap: "map" | "satellite" = "map";

  const updateToggleContent = () => {
    if (currentBasemap === "map") {
      // Show satellite preview
      basemapToggle.innerHTML = `
        <div class="o-basemap-preview" style="background-image: url('${BASE}img/satelite.jpeg');"></div>
        <span>Satellite</span>
      `;
    } else {
      // Show map preview
      basemapToggle.innerHTML = `
        <div class="o-basemap-preview" style="background-image: url('${BASE}img/map.jpeg');"></div>
        <span>Map</span>
      `;
    }
  };

  updateToggleContent();

  basemapToggle.addEventListener("click", async () => {
    currentBasemap = currentBasemap === "map" ? "satellite" : "map";
    updateToggleContent();

    if (currentBasemap === "satellite") {
      map.basemap = satelliteBasemap;
    } else {
      map.basemap = navigationBasemap;
    }
  });

  view.ui.add(basemapToggle, { position: "top-left", index: 4 });

  // Remove navigation toggle
  view.ui.remove("navigation-toggle");

  // NOTE: zoom and compass will be moved to specific positions after legend is added
  // This happens in attachLegend function

  // Auto-rotate globe until user interacts
  let isRotating = true;
  let rotationFrame: number;
  let onRotationStateChange: (() => void) | null = null;

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
      if (onRotationStateChange) onRotationStateChange();
    }
  };

  const startRotation = () => {
    if (!isRotating) {
      isRotating = true;
      rotate();
      if (onRotationStateChange) onRotationStateChange();
    }
  };

  const toggleRotation = () => {
    if (isRotating) {
      stopRotation();
    } else {
      startRotation();
    }
    return isRotating;
  };

  const setRotationStateChangeCallback = (callback: () => void) => {
    onRotationStateChange = callback;
  };

  // Stop rotation on user interaction
  view.on("drag", stopRotation);
  view.on("key-down", stopRotation);
  view.on("double-click", stopRotation);

  // Cursor management: grab for map, pointer for features
  let isDragging = false;

  // Set initial cursor
  if (view.container) {
    view.container.style.cursor = "grab";
  }

  // Change to grabbing cursor while dragging
  view.on("drag", (event) => {
    if (event.action === "start") {
      isDragging = true;
      if (view.container) view.container.style.cursor = "grabbing";
    } else if (event.action === "end") {
      isDragging = false;
      if (view.container) view.container.style.cursor = "grab";
    }
  });

  // Change cursor to pointer when hovering over features
  view.on("pointer-move", async (event) => {
    if (isDragging || !view.container) return;

    try {
      const response = await view.hitTest(event);
      if (response.results.length > 0) {
        view.container.style.cursor = "pointer";
      } else {
        view.container.style.cursor = "grab";
      }
    } catch {
      // Ignore hitTest errors
    }
  });

  // Start rotation
  rotate();

  return {
    map,
    view,
    toggleRotation,
    isRotating: () => isRotating,
    setRotationStateChangeCallback,
    stopRotation
  };
}
