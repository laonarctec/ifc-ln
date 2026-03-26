import path from "path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [tailwindcss(), react()],
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
    // NOTE: COOP/COEP headers are needed for web-ifc MT mode and
    // ParallelMeshBVHWorker (SharedArrayBuffer). Currently disabled because
    // web-ifc MT spawns internal pthread workers that Vite dev server cannot
    // resolve. Re-enable when MT support is properly configured.
    // headers: {
    //   "Cross-Origin-Opener-Policy": "same-origin",
    //   "Cross-Origin-Embedder-Policy": "credentialless",
    // },
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
