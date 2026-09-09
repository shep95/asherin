import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { seoPrerenderPlugin } from "./scripts/seoPrerenderPlugin";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    // /asherin.ide is a standalone static page in public/asherin.ide/.
    // Without this the dev/preview server treats the dotted path as a file
    // request and falls through to the SPA shell (404 page).
    {
      name: "asherin-ide-static-route",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === "/asherin.ide" || req.url === "/asherin.ide/") {
            req.url = "/asherin.ide/index.html";
          }
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === "/asherin.ide" || req.url === "/asherin.ide/") {
            req.url = "/asherin.ide/index.html";
          }
          next();
        });
      },
    },
    react(),
    mode === "development" && componentTagger(),
    seoPrerenderPlugin(),
    mcpPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ["sweph-wasm"],
  },
}));
