import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ["sweph-wasm"],
  },
  esbuild: {
    // Strip noisy logging from production bundles — keeps console.error for ops.
    drop: mode === "production" ? ["debugger"] : [],
    pure: mode === "production" ? ["console.log", "console.info", "console.debug"] : [],
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Split heavy third-party libs into their own long-cacheable chunks
        // so the initial route bundle stays lean.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-dom") || id.includes("scheduler") || id.includes("/react/")) {
            return "vendor-react";
          }
          if (id.includes("@radix-ui") || id.includes("lucide-react") || id.includes("cmdk")) {
            return "vendor-ui";
          }
          if (id.includes("@tanstack")) return "vendor-query";
          if (id.includes("react-router")) return "vendor-router";
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("three") || id.includes("@react-three")) return "vendor-three";
          if (id.includes("monaco-editor") || id.includes("@monaco-editor")) return "vendor-monaco";
          if (id.includes("@ffmpeg")) return "vendor-ffmpeg";
          if (id.includes("@blueprintjs")) return "vendor-blueprint";
          if (id.includes("leaflet")) return "vendor-leaflet";
          if (id.includes("astronomy-engine")) return "vendor-astro";
          if (id.includes("framer-motion") || id.includes("motion")) return "vendor-motion";
          return "vendor";
        },
      },
    },
  },
}));
