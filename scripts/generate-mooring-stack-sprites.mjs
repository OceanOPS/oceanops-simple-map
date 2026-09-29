/**
 * Generate static mooring stack PNG sprites.
 * Run: npm run generate:mooring-stacks
 *
 * Filenames match STACK_PNG_BY_MASK in src/mooringStacks.ts (outer → inner).
 * Sprites render at 2× then display at half size so a 1 px border ≈ 0.5 px on the map.
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

/** Triple stack (mask 7) — outer 9, middle 7, inner 3. */
const TRIPLE_SIZES = {
  moored_buoys: 9,
  oceansites: 7,
  soconet_moorings: 3,
};

/** Two-network stacks (masks 3, 5, 6) — outer 7, inner 5 (n / n−2). */
const TWO_STACK_OUTER = 7;
const TWO_STACK_INNER = 5;

/** Keep in sync with MOORING_STACK_BORDER_WIDTH in src/categories.ts (display px). */
const BORDER_DISPLAY = 0.5;
const RENDER_SCALE = 2;
const BORDER_PX = BORDER_DISPLAY * RENDER_SCALE;

const DRAW_ORDER = ["moored_buoys", "oceansites", "soconet_moorings"];
const BITS = { moored_buoys: 1, oceansites: 2, soconet_moorings: 4 };

function layersForMask(mask) {
  return DRAW_ORDER.filter((id) => (mask & BITS[id]) !== 0);
}

function contentSizeForMask(mask) {
  return mask === 7 ? TRIPLE_SIZES.moored_buoys : TWO_STACK_OUTER;
}

function sizeForLayer(mask, layerId) {
  if (mask === 7) return TRIPLE_SIZES[layerId];
  const layers = layersForMask(mask);
  return layerId === layers[0] ? TWO_STACK_OUTER : TWO_STACK_INNER;
}

function squareTopLeft(canvasSize, squareSize) {
  return Math.floor((canvasSize - squareSize) / 2);
}

/** 1 px outline at render scale (≈ 0.5 px when displayed). */
function strokeSquareOutline(ctx, x, y, size) {
  ctx.fillStyle = "#000000";
  ctx.fillRect(x, y, size, 1);
  ctx.fillRect(x, y + size - 1, size, 1);
  ctx.fillRect(x, y + 1, 1, size - 2);
  ctx.fillRect(x + size - 1, y + 1, 1, size - 2);
}

function drawSprite(mask) {
  const layers = layersForMask(mask);
  const contentSize = contentSizeForMask(mask) * RENDER_SCALE;
  const pad = BORDER_PX;
  const canvasSize = contentSize + 2 * pad;
  const canvas = createCanvas(canvasSize, canvasSize);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvasSize, canvasSize);
  ctx.imageSmoothingEnabled = false;

  for (const layerId of layers) {
    const squareSize = sizeForLayer(mask, layerId) * RENDER_SCALE;
    const offset = pad + squareTopLeft(contentSize, squareSize);
    ctx.fillStyle = COLORS[layerId];
    ctx.fillRect(offset, offset, squareSize, squareSize);
  }

  // Border outside the colored squares — all stack composites, 0.5 px on the map.
  strokeSquareOutline(ctx, 0, 0, canvasSize);

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
