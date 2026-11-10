import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/demos/simple-arcgis-map-2026/",
  server: {
    port: 5174,
    strictPort: true,
  },
});
