// État de l'interface, partagé entre les fenêtres (D-026).
//
// - Le widget est la fenêtre **propriétaire** : il lit et écrit le fichier, fait avancer le
//   minuteur, calcule les récompenses et diffuse l'état à chaque changement.
// - La fenêtre principale est **cliente** : elle envoie ses actions et reçoit l'état.
// Un seul écrivain du fichier : aucune course entre fenêtres.

import { create } from "zustand";
import { emptyCombo, stepCombo, type ComboState } from "../core/combo";
import { createEmptyData } from "../core/schema";
import type { DataFile } from "../core/types";
import type { DataStore, LoadResult } from "../storage/dataStore";
import { reduce, type Action, type Effect } from "./actions";

export type Status = Exclude<LoadResult["kind"], "ok"> | "loading" | "ready" | "error";

export interface Snapshot {
  status: Status;
  detail: string;
  backups: string[];
  data: DataFile | null;
  /** Dossier du fichier de données sur ce Mac. */
  dataDir: string;
}

export type Reward =
  | { kind: "task"; tier: number; points: number; origin: string }
  | { kind: "focus"; breakMinutes: number; taskTitle?: string };

/** Messages entre fenêtres. En production : événements Tauri (src/state/tauriTransport.ts). */
export interface Transport {
  /** Client → propriétaire. */
  sendAction(msg: ClientMessage): void;
  onAction(cb: (msg: ClientMessage) => void): void;
  /** Propriétaire → clients. */
  broadcastState(s: Snapshot): void;
  onState(cb: (s: Snapshot) => void): void;
  broadcastReward(r: Reward): void;
  onReward(cb: (r: Reward) => void): void;
  /** Un client qui s'ouvre demande l'état courant. */
  requestState(): void;
  onRequestState(cb: () => void): void;
}

export type ClientMessage =
  | { kind: "action"; action: Action; origin: string }
  | { kind: "restore"; name: string }
  /** Nouvel emplacement. `keep` : garder nos données (`ours`) ou celles déjà là-bas (`theirs`). */
  | { kind: "relocate"; dir: string; keep: "ours" | "theirs" };

/** Effets de bord du propriétaire : son, pluie de pétales plein écran. */
export interface OwnerHooks {
  playChime?(strikes: number, gain: number): void;
  /** Pluie hors de la fenêtre d'origine, paliers 3 et plus (D-027). */
  screenRain?(tier: number, origin: string): void;
  /** Après chaque chargement du fichier (premier lancement, fichier illisible…). */
  afterLoad?(s: Snapshot): void;
  /** Mémorise l'emplacement choisi, sur ce Mac (D-029). */
  saveLocation?(dir: string): Promise<void>;
}

interface State extends Snapshot {
  role: "owner" | "client" | null;
  combo: ComboState;
  dispatch(action: Action): void;
  restore(name: string): void;
  relocate(dir: string, keep: "ours" | "theirs"): void;
}

const SAVE_DELAY_MS = 300;
const EXTERNAL_CHECK_MS = 5_000;

type Ctx = {
  transport: Transport;
  label: string;
  disk?: DataStore;
  openStore?: (dir: string) => DataStore;
  hooks: OwnerHooks;
  now: () => number;
  saveTimer?: ReturnType<typeof setTimeout>;
  saving: boolean;
};
let ctx: Ctx | null = null;
const rewardListeners = new Set<(r: Reward) => void>();

/** Récompenses vues par cette fenêtre (pétales). Renvoie la fonction de désabonnement. */
export function onReward(cb: (r: Reward) => void): () => void {
  rewardListeners.add(cb);
  return () => rewardListeners.delete(cb);
}
const emitReward = (r: Reward) => rewardListeners.forEach((cb) => cb(r));

export const useSakura = create<State>((_set, get) => ({
  role: null,
  status: "loading",
  detail: "",
  backups: [],
  data: null,
  dataDir: "",
  combo: emptyCombo(),

  dispatch(action) {
    if (!ctx) return;
    if (get().role === "client") {
      ctx.transport.sendAction({ kind: "action", action, origin: ctx.label });
      return;
    }
    applyOwner(action, ctx.label);
  },

  restore(name) {
    if (!ctx) return;
    if (get().role === "client") ctx.transport.sendAction({ kind: "restore", name });
    else void restoreOwner(name);
  },

  relocate(dir, keep) {
    if (!ctx) return;
    if (get().role === "client") ctx.transport.sendAction({ kind: "relocate", dir, keep });
    else void relocateOwner(dir, keep);
  },
}));

// ---------- propriétaire ----------

function snapshot(): Snapshot {
  const { status, detail, backups, data, dataDir } = useSakura.getState();
  return { status, detail, backups, data, dataDir };
}

function broadcast() {
  ctx?.transport.broadcastState(snapshot());
}

function applyLoad(r: LoadResult) {
  if (r.kind === "ok")
    useSakura.setState({ status: "ready", data: r.data, detail: "", backups: [] });
  else if (r.kind === "corrupt")
    useSakura.setState({ status: "corrupt", detail: r.detail, backups: r.backups, data: null });
  else if (r.kind === "too_new")
    useSakura.setState({ status: "too_new", detail: r.detail, data: null });
  else useSakura.setState({ status: r.kind, data: null });
  broadcast();
  ctx?.hooks.afterLoad?.(snapshot());
}

async function persist() {
  if (!ctx?.disk) return;
  const data = useSakura.getState().data;
  if (!data) return;
  ctx.saving = true;
  try {
    const r = await ctx.disk.save(data);
    // D-014 : un autre Mac a écrit entre-temps ; sa version gagne.
    if (r.kind === "stale") applyLoad(await ctx.disk.load());
  } catch (e) {
    useSakura.setState({ status: "error", detail: String(e) });
    broadcast();
  } finally {
    ctx.saving = false;
  }
}

function schedulePersist() {
  if (!ctx) return;
  clearTimeout(ctx.saveTimer);
  ctx.saveTimer = setTimeout(() => {
    ctx!.saveTimer = undefined;
    void persist();
  }, SAVE_DELAY_MS);
}

function handleEffects(effects: Effect[], origin: string, data: DataFile) {
  if (!ctx) return;
  for (const e of effects) {
    let reward: Reward | null = null;
    if (e.kind === "taskDone") {
      const r = stepCombo(useSakura.getState().combo, e.taskId, ctx.now());
      useSakura.setState({ combo: r.state });
      reward = { kind: "task", tier: r.tier, points: e.points, origin };
      if (data.settings.soundEnabled)
        ctx.hooks.playChime?.(r.tier, (0.55 + r.tier * 0.1) * data.settings.soundVolume);
      if (r.tier >= 3) ctx.hooks.screenRain?.(r.tier, origin);
    } else if (e.kind === "focusDone") {
      const title = e.taskId ? data.tasks.find((t) => t.id === e.taskId)?.title : undefined;
      reward = title
        ? { kind: "focus", breakMinutes: e.breakMinutes, taskTitle: title }
        : { kind: "focus", breakMinutes: e.breakMinutes };
      if (data.settings.soundEnabled) ctx.hooks.playChime?.(2, data.settings.soundVolume);
    } else if (e.kind === "breakDone") {
      if (data.settings.soundEnabled) ctx.hooks.playChime?.(1, 0.5 * data.settings.soundVolume);
    }
    if (reward) {
      emitReward(reward);
      ctx.transport.broadcastReward(reward);
    }
  }
}

function applyOwner(action: Action, origin: string) {
  if (!ctx) return;
  const { data, status } = useSakura.getState();
  if (!data || status !== "ready") return;
  const r = reduce(data, action, ctx.now());
  if (r.data === data && r.effects.length === 0) return;
  useSakura.setState({ data: r.data });
  broadcast();
  schedulePersist();
  handleEffects(r.effects, origin, r.data);
}

async function restoreOwner(name: string) {
  if (ctx?.disk) applyLoad(await ctx.disk.restoreBackup(name));
}

/**
 * Change l'emplacement du fichier (D-029). `ours` : nos données sont écrites là-bas (on écrase
 * un éventuel fichier). `theirs` : on adopte le fichier déjà présent là-bas.
 */
async function relocateOwner(dir: string, keep: "ours" | "theirs") {
  if (!ctx?.openStore) return;
  await flush();
  const next = ctx.openStore(dir);
  try {
    if (keep === "theirs") {
      const r = await next.load();
      if (r.kind !== "ok") throw new Error(`Le fichier de ${dir} n'est pas lisible (${r.kind}).`);
      ctx.disk = next;
      useSakura.setState({ dataDir: dir });
      applyLoad(r);
    } else {
      const data = useSakura.getState().data;
      if (!data) return;
      await next.load();
      await next.save(data, { force: true });
      ctx.disk = next;
      useSakura.setState({ dataDir: dir });
      broadcast();
    }
    await ctx.hooks.saveLocation?.(dir);
  } catch (e) {
    useSakura.setState({ detail: e instanceof Error ? e.message : String(e) });
    broadcast();
  }
}

/** Relit le fichier s'il a été modifié ailleurs (autre Mac via iCloud) et rien n'est en attente. */
export async function checkExternalChange(): Promise<boolean> {
  if (!ctx?.disk || ctx.saveTimer || ctx.saving) return false;
  if (!(await ctx.disk.hasExternalChange())) return false;
  applyLoad(await ctx.disk.load());
  return true;
}

export async function initOwner(opts: {
  transport: Transport;
  label: string;
  dataDir: string;
  openStore: (dir: string) => DataStore;
  deviceId: string;
  hooks?: OwnerHooks;
  now?: () => number;
}): Promise<() => void> {
  const disk = opts.openStore(opts.dataDir);
  ctx = {
    transport: opts.transport,
    label: opts.label,
    disk,
    openStore: opts.openStore,
    hooks: opts.hooks ?? {},
    now: opts.now ?? Date.now,
    saving: false,
  };
  useSakura.setState({ role: "owner", dataDir: opts.dataDir });
  const t = opts.transport;
  t.onAction((msg) => {
    if (msg.kind === "action") applyOwner(msg.action, msg.origin);
    else if (msg.kind === "restore") void restoreOwner(msg.name);
    else void relocateOwner(msg.dir, msg.keep);
  });
  t.onRequestState(broadcast);
  try {
    const r = await disk.load();
    if (r.kind === "missing") {
      const data = createEmptyData(opts.deviceId, ctx.now());
      await disk.save(data);
      applyLoad({ kind: "ok", data });
    } else applyLoad(r);
  } catch (e) {
    useSakura.setState({ status: "error", detail: String(e) });
    broadcast();
  }
  const tick = setInterval(() => applyOwner({ type: "timer/tick" }, opts.label), 1000);
  const ext = setInterval(() => void checkExternalChange(), EXTERNAL_CHECK_MS);
  return () => {
    clearInterval(tick);
    clearInterval(ext);
  };
}

/** Vide l'écriture en attente (fermeture de l'app). */
export async function flush() {
  if (ctx?.saveTimer) {
    clearTimeout(ctx.saveTimer);
    ctx.saveTimer = undefined;
    await persist();
  }
}

// ---------- client ----------

export function initClient(opts: { transport: Transport; label: string }) {
  ctx = { transport: opts.transport, label: opts.label, hooks: {}, now: Date.now, saving: false };
  useSakura.setState({ role: "client" });
  opts.transport.onState((s) => useSakura.setState(s));
  opts.transport.onReward(emitReward);
  opts.transport.requestState();
}

/** Tests uniquement. */
export function __resetStore() {
  ctx = null;
  rewardListeners.clear();
  useSakura.setState({
    role: null,
    status: "loading",
    detail: "",
    backups: [],
    data: null,
    dataDir: "",
    combo: emptyCombo(),
  });
}
