// Pont vers l'app macOS. Hors Tauri (aperçu navigateur avec `npm run dev`), les appels sont
// sans effet pour que l'interface reste utilisable.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as autostartEnabled,
} from "@tauri-apps/plugin-autostart";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
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

// ---------- barre de menu, raccourcis, notifications, démarrage (Phase 5) ----------

/** Événement envoyé par Rust (barre de menu, raccourci global). Renvoie la désinscription. */
export function onAppEvent(name: "toggle" | "quick-add" | "quit", cb: () => void): () => void {
  if (!inTauri) return () => {};
  const p = listen(`sakura://${name}`, cb);
  return () => void p.then((un) => un());
}

export const trayUpdate = (title: string, toggleLabel: string, running: boolean) =>
  call("tray_update", { title, toggleLabel, running });
export const quitApp = () => call("quit_app");

let notifyAllowed: boolean | null = null;
export async function notify(title: string, body: string) {
  if (!inTauri) return;
  try {
    notifyAllowed ??= (await isPermissionGranted()) || (await requestPermission()) === "granted";
    if (notifyAllowed) sendNotification({ title, body });
  } catch (e) {
    console.error("notification", e);
  }
}

/** Aligne l'ouverture au démarrage du Mac sur le réglage (app installée seulement). */
export async function syncAutostart(enabled: boolean) {
  if (!inTauri || import.meta.env.DEV) return;
  try {
    if ((await autostartEnabled()) === enabled) return;
    if (enabled) await enableAutostart();
    else await disableAutostart();
  } catch (e) {
    console.error("autostart", e);
  }
}

/** Avec plusieurs écrans, le widget suit l'écran du curseur (D-038). */
export const setFollowScreen = (enabled: boolean) => call("set_follow_screen", { enabled });

// ---------- déplacer le widget (D-040) ----------

const PRESS_POLL_MS = 40;
const PRESS_MAX_MS = 60_000;

/**
 * Bouton enfoncé sur le widget replié : lance le glisser natif de la fenêtre, puis attend que le
 * bouton soit relâché. Renvoie « drag » si la fenêtre a bougé, « click » sinon (D-041).
 * Le glisser natif avale le relâchement : on interroge l'état du bouton côté macOS.
 */
export async function pressWidget(): Promise<"drag" | "click"> {
  if (!inTauri) {
    await new Promise((r) => document.addEventListener("mouseup", r, { once: true }));
    return "click";
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const win = getCurrentWindow();
  let moved = false;
  const unlisten = await win.onMoved(() => {
    moved = true;
  });
  try {
    await call("widget_drag_start");
    void win.startDragging().catch((e) => console.error("startDragging", e));
    const t0 = Date.now();
    while (Date.now() - t0 < PRESS_MAX_MS) {
      await new Promise((r) => window.setTimeout(r, PRESS_POLL_MS));
      const down = await invoke<boolean>("mouse_pressed").catch(() => false);
      if (!down) break;
    }
    // Dernier événement « moved » éventuel, émis juste avant le relâchement.
    await new Promise((r) => window.setTimeout(r, PRESS_POLL_MS));
    return moved ? "drag" : "click";
  } finally {
    unlisten();
  }
}

/** Donne le focus au widget : un clic ailleurs le fera alors se replier (D-041). */
export async function focusWidget(): Promise<void> {
  if (!inTauri) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow()
    .setFocus()
    .catch((e) => console.error("setFocus", e));
}

/** Aimante le widget au coin le plus proche de l'écran où il a été lâché. */
export async function widgetSnap(): Promise<{ corner: Corner; movedScreen: boolean } | null> {
  if (!inTauri) return null;
  return invoke<{ corner: Corner; movedScreen: boolean }>("widget_snap").catch((e) => {
    console.error("widget_snap", e);
    return null;
  });
}
