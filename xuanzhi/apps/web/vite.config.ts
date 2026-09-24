import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@xuanzhi/shared-types": path.resolve(__dirname, "../../packages/shared-types/src/index.ts"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    // Same-origin API in development: cookies + CSRF header work without CORS.
    proxy: { "/api": { target: process.env.VITE_API_PROXY ?? "http://localhost:8787", changeOrigin: false } },
  },
  build: { outDir: "dist", sourcemap: false, chunkSizeWarningLimit: 1500 },
  test: { environment: "jsdom", globals: true, setupFiles: ["./src/test/setup.ts"], include: ["src/**/*.test.tsx", "src/**/*.test.ts"] },
});
