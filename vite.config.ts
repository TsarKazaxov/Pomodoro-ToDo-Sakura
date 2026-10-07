import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Tauri attend un port fixe et ne veut pas que Vite efface ses logs.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true, watch: { ignored: ["**/src-tauri/**"] } },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: { target: "safari14", sourcemap: false },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Fuseau fixe : les tests de dates ne dépendent pas de la machine qui les lance.
    env: { TZ: "Europe/Paris" },
  },
});
