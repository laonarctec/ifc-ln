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
