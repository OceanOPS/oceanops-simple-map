#!/usr/bin/env node
/**
 * Production builds must point flat basemaps at the oceanops-basemap-tiles service.
 * Set VITE_FLAT_BASEMAP_TILES_URL in Netlify / CI (https://…/tiles).
 *
 * Local dev: skip with no env, or use http://localhost:8081/tiles when Docker is up.
 * MapServer-only fallback: VITE_FLAT_BASEMAP_TILES_URL=off
 */
const raw = (process.env.VITE_FLAT_BASEMAP_TILES_URL ?? "").trim();
const requireUrl =
  process.env.CI === "true" ||
  process.env.NETLIFY === "true" ||
  process.env.REQUIRE_FLAT_BASEMAP_TILES_URL === "1";

if (!requireUrl) {
  if (!raw || raw.toLowerCase() === "off") {
    console.warn(
      "[build] VITE_FLAT_BASEMAP_TILES_URL is unset or off — flat maps use MapServer export only."
    );
  }
  process.exit(0);
}

if (!raw || raw.toLowerCase() === "off") {
  console.error(
    "[build] VITE_FLAT_BASEMAP_TILES_URL is required in CI/Netlify (e.g. https://basemap-tiles.example.org/tiles)."
  );
  process.exit(1);
}

let url;
try {
  url = new URL(raw);
} catch {
  console.error("[build] VITE_FLAT_BASEMAP_TILES_URL is not a valid URL:", raw);
  process.exit(1);
}

if (url.protocol !== "https:" && !raw.includes("localhost") && !raw.includes("127.0.0.1")) {
  console.error("[build] VITE_FLAT_BASEMAP_TILES_URL must use https in production:", raw);
  process.exit(1);
}

console.log("[build] Flat basemap tiles:", raw.replace(/\/+$/, ""));
