import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "path";

// https://vitejs.dev/config/
// Env vars come from .env.development.local (dev) / .env or the environment (build). Only VITE_*
// keys reach the browser; read them through src/config.ts, never import.meta.env.
const config = {
  plugins: [react()],

  // One vendor bundle (~560 kB) is fine for an internal admin app.
  build: { chunkSizeWarningLimit: 1000 },

  // Offer letter backend runs on 5000; this app owns 3005 (5173 is task-manager).
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
};

export default defineConfig(({ command, mode }) => {
  // A build without the API url would silently call nothing (src/config.ts only defaults it in dev).
  if (command === "build" && !loadEnv(mode, process.cwd(), "VITE_").VITE_API_BASE_URL) {
    throw new Error(
      "VITE_API_BASE_URL is required for a build, e.g. VITE_API_BASE_URL=https://api.example.com/v1"
    );
  }

  return config;
});
