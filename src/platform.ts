// Pont vers l'app macOS. Hors Tauri (aperçu navigateur avec `npm run dev`), les appels sont
// sans effet pour que l'interface reste utilisable.

import { invoke } from "@tauri-apps/api/core";
import { ask, message, open, save } from "@tauri-apps/plugin-dialog";
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

export const hideMain = () => call("hide_main");

// ---------- dialogues (Réglages : dossier, import, export) ----------

export async function pickFolder(title: string): Promise<string | null> {
  if (!inTauri) return null;
  const r = await open({ directory: true, multiple: false, title });
  return typeof r === "string" ? r : null;
}

export async function pickJsonFile(title: string): Promise<string | null> {
  if (!inTauri) return null;
  const r = await open({
    multiple: false,
    title,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  return typeof r === "string" ? r : null;
}

export async function pickSavePath(title: string, defaultPath: string): Promise<string | null> {
  if (!inTauri) return null;
  const r = await save({ title, defaultPath, filters: [{ name: "JSON", extensions: ["json"] }] });
  if (!r) return null;
  return r.endsWith(".json") ? r : `${r}.json`;
}

export async function confirmDialog(
  text: string,
  okLabel: string,
  cancelLabel = "Annuler",
): Promise<boolean> {
  if (!inTauri) return window.confirm(text);
  return ask(text, { title: "Sakura", kind: "warning", okLabel, cancelLabel });
}

export async function infoDialog(text: string, kind: "info" | "error" = "info"): Promise<void> {
  if (!inTauri) {
    window.alert(text);
    return;
  }
  await message(text, { title: "Sakura", kind });
}
