import fs from "fs";
import path from "path";
import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

/**
 * Inline plugin: serve web-ifc IIFE build at a fixed URL for pthread workers.
 *
 * web-ifc MT mode spawns Emscripten pthread workers that need to load the
 * same JavaScript as the main module. The IIFE build is a classic (non-ESM)
 * script compatible with importScripts() inside Blob workers.
 *
 * Dev:   middleware serves the file at /__web-ifc-pthread.js
 * Build: emits the file as a static asset in the output directory
 */
function webIfcPthreadPlugin(): Plugin {
  const IIFE_PATH = path.resolve(__dirname, "node_modules/web-ifc/web-ifc-api-iife.js");
  const SERVE_PATH = "/__web-ifc-pthread.js";

  return {
    name: "web-ifc-pthread",
    configureServer(server) {
      server.middlewares.use(SERVE_PATH, (_req, res) => {
        res.setHeader("Content-Type", "application/javascript");
        fs.createReadStream(IIFE_PATH).pipe(res);
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: SERVE_PATH.slice(1), // strip leading /
        source: fs.readFileSync(IIFE_PATH, "utf-8"),
      });
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), react(), webIfcPthreadPlugin()],
  optimizeDeps: {
    exclude: ["web-ifc"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3333,
    // COOP/COEP headers enable crossOriginIsolated + SharedArrayBuffer,
    // required for web-ifc MT mode and ParallelMeshBVHWorker.
    // require-corp is used over credentialless because credentialless
    // does not enable crossOriginIsolated in all browsers (e.g. Firefox).
    // Safe here because the project has no external CDN resources.
    // Production deployments must also set these headers on the web server.
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  worker: {
    format: "es",
  },
  build: {
    chunkSizeWarningLimit: 1000, // 기본 500kB → 1000kB
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three", "three-mesh-bvh"],
          "web-ifc": ["web-ifc"],
        },
      },
    },
  },
});
