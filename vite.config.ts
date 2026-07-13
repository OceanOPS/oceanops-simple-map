import { defineConfig } from "vite";

export default defineConfig({
  base: "/demos/simple-arcgis-map/",
  server: {
    port: 5174,
    strictPort: true,
  },
});
