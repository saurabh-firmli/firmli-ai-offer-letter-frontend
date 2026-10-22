import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "path";

// https://vitejs.dev/config/
// Env vars come from .env.development.local (dev) / .env (build). Only VITE_* keys
// reach the browser; read them through src/config.ts, never import.meta.env.
export default defineConfig({
  plugins: [react()],

  // One vendor bundle (~560 kB) is fine for an internal admin app.
  build: { chunkSizeWarningLimit: 1000 },

  // Offer letter backend runs on 3000; this app owns 3005 (5173 is task-manager).
  // strictPort: fail loudly instead of silently hopping to another port.
  server: {
    port: 3005,
    strictPort: true,
    host: "0.0.0.0",
    open: !process.env.DOCKER_ENV,
  },

  preview: {
    port: 3005,
    strictPort: true,
  },

  resolve: {
    alias: {
      "@": resolve(process.cwd(), "src"),
    },
  },

  // Default environment is "node" for pure-logic tests. A component test opts in
  // with `// @vitest-environment jsdom` on its first line.
  test: {
    environment: "node",
    globals: true,
    setupFiles: [resolve(process.cwd(), "src/test/setup.ts")],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
