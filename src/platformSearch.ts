import type GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import { categories, getLayerDisplayLabel } from "./categories";
import {
  MOORING_STACK_BITS,
  MOORING_STACK_LAYER_ID,
  stackNetworkLabels,
  type MooringStackLayerId,
} from "./mooringStacks";
import type { GlobeView } from "./viewHolder";

type SearchHit = {
  label: string;
  wmo: string;
  network: string;
  layerId: string;
  objectId: number | null;
  isLine: boolean;
  stackMask: number;
};

const MAX_SUGGESTIONS = 8;
const MIN_QUERY_LENGTH = 1;
const PAGE_SIZE = 2000;

const LINE_LAYER_IDS = new Set<string>(
  categories.filter((cat) => cat.type === "line").map((cat) => cat.id)
);

export type PlatformSearchController = {
  rebuild: () => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: () => boolean;
  setOpenChangeListener: (listener: (() => void) | null) => void;
};

export function mountPlatformSearch(options: {
  shell: HTMLElement;
  getView: () => GlobeView;
  getLayers: () => ReadonlyMap<string, GeoJSONLayer>;
  stopRotation: () => void;
}): PlatformSearchController {
  document.getElementById("platform-search")?.remove();

  const root = document.createElement("div");
  root.id = "platform-search";
  root.className = "o-platform-search";
  let panelOpen = false;
  let onOpenChange: (() => void) | null = null;
  let setPanelOpen: (open: boolean) => void;

  const input = document.createElement("input");
  input.type = "search";
  input.className = "o-platform-search-input";
  input.placeholder = "Enter reference number or line name";
  input.setAttribute("aria-label", "Enter reference number or line name");
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", "platform-search-list");
  input.autocomplete = "off";
  input.spellcheck = false;

  const list = document.createElement("ul");
  list.id = "platform-search-list";
  list.className = "o-platform-search-list";
  list.setAttribute("role", "listbox");
  list.hidden = true;

  const status = document.createElement("p");
  status.className = "o-platform-search-status";
  status.hidden = true;

  root.append(input, list, status);
  options.shell.appendChild(root);

  let hits: SearchHit[] = [];
  let indexGeneration = 0;
  let indexing = false;
  let activeIndex = -1;
  let shown: SearchHit[] = [];

  const setStatus = (text: string) => {
    status.hidden = !text;
    status.textContent = text;
  };

  const closeList = () => {
    list.hidden = true;
    list.replaceChildren();
    input.setAttribute("aria-expanded", "false");
    activeIndex = -1;
    shown = [];
  };

  setPanelOpen = (open: boolean) => {
    panelOpen = open;
    root.classList.toggle("is-open", open);
    if (!open) {
      closeList();
      input.blur();
      setStatus("");
    }
    onOpenChange?.();
  };

  const renderList = (matches: SearchHit[]) => {
    shown = matches;
    activeIndex = matches.length > 0 ? 0 : -1;
    list.replaceChildren();
    if (matches.length === 0) {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      return;
    }

    matches.forEach((hit, index) => {
      const item = document.createElement("li");
      item.className = "o-platform-search-option";
      item.setAttribute("role", "option");
      item.id = `platform-search-option-${index}`;
      if (index === activeIndex) item.classList.add("is-active");

      const label = document.createElement("span");
      label.className = "o-platform-search-option-label";
      label.textContent = hit.label;

      const meta = document.createElement("span");
      meta.className = "o-platform-search-option-meta";
      meta.textContent =
        hit.wmo && hit.wmo !== hit.label ? `${hit.network} · WMO ${hit.wmo}` : hit.network;

      item.append(label, meta);
      item.addEventListener("mousedown", (event) => {
        event.preventDefault();
        void selectHit(hit);
      });
      list.appendChild(item);
    });

    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    syncActiveOption();
  };

  const syncActiveOption = () => {
    const options = list.querySelectorAll(".o-platform-search-option");
    options.forEach((node, index) => {
      node.classList.toggle("is-active", index === activeIndex);
    });
    if (activeIndex >= 0) {
      input.setAttribute("aria-activedescendant", `platform-search-option-${activeIndex}`);
      options[activeIndex]?.scrollIntoView({ block: "nearest" });
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  };

  const refreshSuggestions = () => {
    const query = input.value.trim().toLowerCase();
    if (query.length < MIN_QUERY_LENGTH) {
      closeList();
      setStatus(indexing ? "Indexing platforms…" : "");
      return;
    }
    if (indexing || hits.length === 0) {
      closeList();
      setStatus(indexing ? "Indexing platforms…" : "No platforms indexed yet.");
      return;
    }
    setStatus("");
    renderList(matchHits(hits, query));
    if (shown.length === 0) setStatus("No match.");
  };

  const selectHit = async (hit: SearchHit) => {
    closeList();
    setStatus("Going to platform…");
    options.stopRotation();
    revealNetworks(hit);
    try {
      const view = options.getView();
      const layer = options.getLayers().get(hit.layerId);
      if (!view || !layer) {
        setStatus("Platform layer is not available.");
        return;
      }
      const { feature } = await fetchFeature(layer, hit);
      if (!feature?.geometry) {
        setStatus("Could not locate that platform.");
        return;
      }
      await flyToFeature(view, feature.geometry, hit.isLine);
      if (layer.popupTemplate) feature.popupTemplate = layer.popupTemplate;
      const location =
        feature.geometry.type === "point"
          ? feature.geometry
          : feature.geometry.extent?.center;
      if (location?.type === "point") {
        await view.openPopup({
          features: [feature],
          location,
        });
      }
      input.value = "";
      setPanelOpen(false);
    } catch (error) {
      console.warn("Platform search failed", error);
      setStatus("Could not locate that platform.");
    }
  };

  input.addEventListener("input", refreshSuggestions);
  input.addEventListener("focus", refreshSuggestions);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!list.hidden) {
        closeList();
        setStatus("");
        return;
      }
      setPanelOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      if (shown.length === 0) return;
      event.preventDefault();
      activeIndex = (activeIndex + 1) % shown.length;
      syncActiveOption();
      return;
    }
    if (event.key === "ArrowUp") {
      if (shown.length === 0) return;
      event.preventDefault();
      activeIndex = (activeIndex - 1 + shown.length) % shown.length;
      syncActiveOption();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const hit = shown[activeIndex] ?? shown[0];
      if (hit) void selectHit(hit);
    }
  });

  document.addEventListener("pointerdown", (event) => {
    const target = event.target as Node;
    if (root.contains(target)) return;
    if (document.getElementById("platform-search-toggle")?.contains(target)) return;
    closeList();
    if (panelOpen && !root.contains(target)) setPanelOpen(false);
  });

  const rebuild = () => {
    const generation = ++indexGeneration;
    indexing = true;
    hits = [];
    if (input.value.trim().length >= MIN_QUERY_LENGTH) {
      setStatus("Indexing platforms…");
    }
    void buildSearchIndex(options.getLayers()).then((next) => {
      if (generation !== indexGeneration) return;
      hits = next;
      indexing = false;
      root.dataset.indexCount = String(next.length);
      if (document.activeElement === input) refreshSuggestions();
      else if (status.textContent === "Indexing platforms…") setStatus("");
    });
  };

  rebuild();

  return {
    rebuild,
    open: () => {
      setPanelOpen(true);
      input.focus();
    },
    close: () => setPanelOpen(false),
    toggle: () => {
      if (panelOpen) setPanelOpen(false);
      else {
        setPanelOpen(true);
        input.focus();
      }
    },
    isOpen: () => panelOpen,
    setOpenChangeListener: (listener) => {
      onOpenChange = listener;
    },
  };
}

function matchHits(hits: SearchHit[], query: string): SearchHit[] {
  const ranked: { hit: SearchHit; rank: number }[] = [];
  for (const hit of hits) {
    const rank = matchRank(hit, query);
    if (rank == null) continue;
    ranked.push({ hit, rank });
  }
  ranked.sort(
    (a, b) =>
      a.rank - b.rank ||
      a.hit.label.length - b.hit.label.length ||
      a.hit.label.localeCompare(b.hit.label) ||
      a.hit.network.localeCompare(b.hit.network)
  );
  return ranked.slice(0, MAX_SUGGESTIONS).map((entry) => entry.hit);
}

function matchRank(hit: SearchHit, query: string): number | null {
  const label = hit.label.toLowerCase();
  const wmo = hit.wmo.toLowerCase();
  if (label.startsWith(query)) return 0;
  if (wmo && wmo.startsWith(query)) return 1;
  if (label.includes(query)) return 2;
  if (wmo && wmo.includes(query)) return 3;
  return null;
}

async function buildSearchIndex(
  layerById: ReadonlyMap<string, GeoJSONLayer>
): Promise<SearchHit[]> {
  const hits: SearchHit[] = [];
  const tasks: Promise<void>[] = [];

  for (const cat of categories) {
    const layer = layerById.get(cat.id);
    if (!layer) continue;
    const isLine = LINE_LAYER_IDS.has(cat.id);
    tasks.push(
      indexLayer(layer, cat.id, getLayerDisplayLabel(cat.id), isLine, hits)
    );
  }

  const stackLayer = layerById.get(MOORING_STACK_LAYER_ID);
  if (stackLayer) {
    tasks.push(
      indexLayer(stackLayer, MOORING_STACK_LAYER_ID, "", false, hits)
    );
  }

  await Promise.all(tasks);
  return hits;
}

async function indexLayer(
  layer: GeoJSONLayer,
  layerId: string,
  network: string,
  isLine: boolean,
  hits: SearchHit[]
): Promise<void> {
  const outFields = isLine ? ["line_name"] : ["ptf_ref", "wmo", "stack_mask"];
  let start = 0;

  while (true) {
    let result;
    try {
      result = await layer.queryFeatures({
        where: "1=1",
        outFields,
        returnGeometry: false,
        start,
        num: PAGE_SIZE,
      });
    } catch (error) {
      if (start !== 0) return;
      try {
        result = await layer.queryFeatures({
          where: "1=1",
          outFields: isLine ? ["line_name"] : ["ptf_ref"],
          returnGeometry: false,
        });
      } catch (fallbackError) {
        console.warn("Platform search index failed", layerId, error, fallbackError);
        return;
      }
    }

    for (const feature of result.features) {
      const objectId = readObjectId(feature);
      const attrs = feature.attributes ?? {};
      const stackMask = Number(attrs.stack_mask ?? 0);
      const networkLabel =
        layerId === MOORING_STACK_LAYER_ID
          ? stackNetworkLabels(stackMask).join("; ") || "Co-located moorings"
          : network;
      const wmo = String(attrs.wmo ?? "").trim();
      const rawLabel = isLine
        ? String(attrs.line_name ?? "").trim()
        : String(attrs.ptf_ref ?? "").trim();
      if (!rawLabel) continue;

      const labels =
        layerId === MOORING_STACK_LAYER_ID ? splitStackRefs(rawLabel) : [rawLabel];
      for (const label of labels) {
        hits.push({
          label,
          wmo,
          network: networkLabel,
          layerId,
          objectId,
          isLine,
          stackMask,
        });
      }
    }

    if (result.features.length === 0) break;
    if (!result.exceededTransferLimit && result.features.length < PAGE_SIZE) break;
    start += result.features.length;
  }
}

function readObjectId(feature: __esri.Graphic): number | null {
  const raw = feature.getObjectId?.() ?? feature.attributes?.objectId ?? feature.attributes?.OBJECTID;
  const objectId = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(objectId) ? objectId : null;
}

function splitStackRefs(value: string): string[] {
  const parts = value
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? [...new Set(parts)] : [];
}

function revealNetworks(hit: SearchHit): void {
  const layerIds =
    hit.layerId === MOORING_STACK_LAYER_ID
      ? stackLayerIds(hit.stackMask)
      : [hit.layerId === "soconet_moorings" ? "soconet" : hit.layerId];

  for (const layerId of new Set(layerIds)) {
    const checkbox = document.querySelector<HTMLInputElement>(
      `input[data-layer-id="${layerId}"]`
    );
    if (!checkbox || checkbox.checked) continue;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));
  }
}

function stackLayerIds(stackMask: number): string[] {
  const ids: string[] = [];
  for (const layerId of Object.keys(MOORING_STACK_BITS) as MooringStackLayerId[]) {
    if ((stackMask & MOORING_STACK_BITS[layerId]) === 0) continue;
    ids.push(layerId === "soconet_moorings" ? "soconet" : layerId);
  }
  return ids;
}

async function fetchFeature(
  layer: GeoJSONLayer,
  hit: SearchHit
): Promise<{ feature: __esri.Graphic | null; filteredOut: boolean }> {
  const escaped = hit.label.replace(/'/g, "''");
  const field = hit.isLine ? "line_name" : "ptf_ref";
  const where =
    hit.layerId === MOORING_STACK_LAYER_ID
      ? `(ptf_ref = '${escaped}' OR ptf_ref LIKE '%${escaped}%')`
      : `${field} = '${escaped}'`;
  const query = () =>
    layer.queryFeatures({
      where,
      outFields: ["*"],
      returnGeometry: true,
    });

  const first = await query();
  const matched = pickFeature(first.features, hit.objectId);
  if (matched?.geometry) {
    return { feature: matched, filteredOut: false };
  }

  const saved = layer.definitionExpression ?? "";
  if (!saved || saved === "1=1") {
    return { feature: matched, filteredOut: false };
  }

  layer.definitionExpression = "1=1";
  try {
    const second = await query();
    const feature = pickFeature(second.features, hit.objectId);
    return {
      feature,
      filteredOut: feature != null,
    };
  } finally {
    layer.definitionExpression = saved;
  }
}

function pickFeature(
  features: __esri.Graphic[],
  objectId: number | null
): __esri.Graphic | null {
  if (features.length === 0) return null;
  if (objectId == null) return features[0];
  return features.find((feature) => readObjectId(feature) === objectId) ?? features[0];
}

async function flyToFeature(
  view: GlobeView,
  geometry: __esri.Geometry,
  isLine: boolean
): Promise<void> {
  if (isLine) {
    await view.goTo(geometry, { animate: true, duration: 700 });
    return;
  }
  await view.goTo(
    { target: geometry, zoom: view.type === "3d" ? 5 : 7 },
    { animate: true, duration: 700 }
  );
}
