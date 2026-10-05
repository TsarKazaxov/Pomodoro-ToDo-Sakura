// Pont vers l'app macOS. Hors Tauri (aperçu navigateur avec `npm run dev`), les appels sont
// sans effet pour que l'interface reste utilisable.

import { invoke } from "@tauri-apps/api/core";
import type { Corner } from "./core/types";

export const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Fenêtre courante : `widget`, `main`, ou une pluie de pétales (`petals-N`). */
export function windowLabel(): string {
  if (!inTauri) return new URLSearchParams(location.search).get("view") ?? "main";
  const internals = (
    window as unknown as { __TAURI_INTERNALS__: { metadata: { currentWindow: { label: string } } } }
  ).__TAURI_INTERNALS__;
  return internals.metadata.currentWindow.label;
}

const call = (cmd: string, args?: Record<string, unknown>) =>
  inTauri ? invoke<void>(cmd, args).catch((e) => console.error(cmd, e)) : Promise.resolve();

export const widgetLayout = (corner: Corner, width: number, height: number) =>
  call("widget_layout", { corner, width, height });
export const showMain = () => call("show_main");
export const petalRain = (mode: "around" | "screen") => call("petal_rain", { mode });
