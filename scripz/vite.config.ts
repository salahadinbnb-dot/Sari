import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  // GitHub Pages serves project sites under /<repo>/ — the deploy workflow sets VITE_BASE_PATH.
  base: process.env.VITE_BASE_PATH || "/",
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  worker: {
    format: "es" as const,
  },
  optimizeDeps: {
    // transformers.js ships its own WebAssembly loaders; pre-bundling breaks them in dev.
    exclude: ["@huggingface/transformers"],
  },
  build: {
    chunkSizeWarningLimit: 2500,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
}));
