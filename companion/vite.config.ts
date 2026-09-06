import { defineConfig } from "vite";
import { resolve } from "node:path";

// Electron loads the bundle over file://, so the base must be relative or the
// window comes up blank with absolute /assets requests.
export default defineConfig({
  root: resolve(__dirname, "renderer"),
  base: "./",
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    target: "chrome120",
  },
});
