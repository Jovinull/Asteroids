import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "./" : "/",
  server: {
    port: 5173,
    strictPort: true,
  },
}));
