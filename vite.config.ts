import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { seoPrerenderPlugin } from "./scripts/seoPrerenderPlugin";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// /asherin.ide is a standalone static page in public/asherin.ide/.
// Without this the dev/preview server treats the dotted path as a file
// request and falls through to the SPA shell (404 page).
const asherinIdeStaticRoute = (): Plugin => {
  const rewrite = (server: { middlewares: { use: (fn: (req: { url?: string }, res: unknown, next: () => void) => void) => void } }) => {
    server.middlewares.use((req, _res, next) => {
      if (req.url === "/asherin.ide" || req.url === "/asherin.ide/") {
        req.url = "/asherin.ide/index.html";
      }
      // Dotted SPA route: vite's history fallback skips paths containing a dot.
      if (req.url === "/asherin.analytics" || req.url === "/asherin.analytics/") {
        req.url = "/index.html";
      }
      if (req.url === "/asherin.acatalepsy" || req.url === "/asherin.acatalepsy/") {
        req.url = "/index.html";
      }
      next();
    });
  };
  return {
    name: "asherin-ide-static-route",
    configureServer: rewrite,
    configurePreviewServer: rewrite,
  };
};

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
    asherinIdeStaticRoute(),
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
