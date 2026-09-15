/**
 * Generate static mooring stack PNG sprites.
 * Run: npm run generate:mooring-stacks
 *
 * Filenames match STACK_PNG_BY_MASK in src/mooringStacks.ts (outer → inner).
 */
import { createCanvas } from "canvas";
import { mkdirSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../public/img/mooring-stacks");

const STACK_PNG_BY_MASK = {
  3: "stack-mb-on-oceansites",
  5: "stack-mb-on-soconet",
  6: "stack-oceansites-on-soconet",
  7: "stack-mb-on-oceansites-on-soconet",
};

const COLORS = {
  moored_buoys: "#ec2324",
  oceansites: "#40a62e",
  soconet_moorings: "#e8bceb",
};

const NESTED_SIZES = {
  moored_buoys: 9,
  oceansites: 5,
  soconet_moorings: 3,
};

const TRIPLE_OCEANSITES = 7;
const MB_SOCNET_SOCNET = 6;

const DRAW_ORDER = ["moored_buoys", "oceansites", "soconet_moorings"];
const BITS = { moored_buoys: 1, oceansites: 2, soconet_moorings: 4 };

function layersForMask(mask) {
  return DRAW_ORDER.filter((id) => (mask & BITS[id]) !== 0);
}

function sizeForLayer(mask, layerId) {
  if (mask === 7 && layerId === "oceansites") return TRIPLE_OCEANSITES;
  if (mask === 5 && layerId === "soconet_moorings") return MB_SOCNET_SOCNET;
  return NESTED_SIZES[layerId];
}

function squareTopLeft(canvasSize, squareSize) {
  return Math.floor((canvasSize - squareSize) / 2);
}

function drawSprite(mask) {
  const layers = layersForMask(mask);
  const outerSize = sizeForLayer(mask, layers[0]);
  const canvas = createCanvas(outerSize, outerSize);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, outerSize, outerSize);
  ctx.imageSmoothingEnabled = false;

  for (const layerId of layers) {
    const squareSize = sizeForLayer(mask, layerId);
    const offset = squareTopLeft(outerSize, squareSize);
    ctx.fillStyle = COLORS[layerId];
    ctx.fillRect(offset, offset, squareSize, squareSize);
  }

  return canvas;
}

mkdirSync(OUT_DIR, { recursive: true });

for (const mask of Object.keys(STACK_PNG_BY_MASK).map(Number)) {
  const basename = STACK_PNG_BY_MASK[mask];
  const canvas = drawSprite(mask);
  const outPath = join(OUT_DIR, `${basename}.png`);
  writeFileSync(outPath, canvas.toBuffer("image/png"));
  console.log(`Wrote ${outPath} (${canvas.width}x${canvas.height})`);
}

for (const legacy of ["stack-3.png", "stack-5.png", "stack-6.png", "stack-7.png"]) {
  try {
    unlinkSync(join(OUT_DIR, legacy));
    console.log(`Removed legacy ${legacy}`);
  } catch {
    /* already gone */
  }
}
