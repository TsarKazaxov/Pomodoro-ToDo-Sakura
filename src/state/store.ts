// Source de vérité de l'interface. En Phase 3, la fenêtre widget et la fenêtre principale
// partageront cet état via les événements Tauri ; pour l'instant, une seule fenêtre.

import { create } from "zustand";
import { applyTransition } from "../core/apply";
import { createEmptyData } from "../core/schema";
import { addTask, parseQuickAdd, setStatus } from "../core/tasks";
import * as timer from "../core/timer";
import type { DataFile, TaskStatus } from "../core/types";
import type { DataStore, LoadResult } from "../storage/dataStore";

export type Status = Exclude<LoadResult["kind"], "ok"> | "loading" | "ready" | "error";

interface State {
  status: Status;
  detail: string;
  backups: string[];
  data: DataFile | null;
  now: number;
  init(store: DataStore, deviceId: string): Promise<void>;
  restore(name: string): Promise<void>;
  tick(now?: number): void;
  toggle(): void;
  skip(): void;
  reset(): void;
  quickAdd(raw: string, priority: boolean): boolean;
  setTaskStatus(id: string, status: TaskStatus): void;
}

let disk: DataStore | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const SAVE_DELAY_MS = 300;

export const useSakura = create<State>((set, get) => {
  /** Remplace les données et planifie l'écriture (regroupée : 300 ms). */
  const commit = (data: DataFile) => {
    set({ data });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void persist(), SAVE_DELAY_MS);
  };

  const persist = async () => {
    const data = get().data;
    if (!disk || !data) return;
    try {
      const r = await disk.save(data);
      // D-014 : un autre Mac a écrit entre-temps ; sa version gagne, on la relit.
      if (r.kind === "stale") await load();
    } catch (e) {
      set({ status: "error", detail: String(e) });
    }
  };

  const applyLoad = (r: LoadResult) => {
    if (r.kind === "ok") set({ status: "ready", data: r.data, detail: "", backups: [] });
    else if (r.kind === "corrupt") set({ status: "corrupt", detail: r.detail, backups: r.backups });
    else if (r.kind === "too_new") set({ status: "too_new", detail: r.detail });
    else set({ status: r.kind });
  };

  const load = async () => applyLoad(await disk!.load());

  return {
    status: "loading",
    detail: "",
    backups: [],
    data: null,
    now: Date.now(),

    async init(store, deviceId) {
      disk = store;
      try {
        const r = await store.load();
        if (r.kind === "missing") {
          const data = createEmptyData(deviceId, Date.now());
          await store.save(data);
          set({ status: "ready", data });
        } else applyLoad(r);
      } catch (e) {
        set({ status: "error", detail: String(e) });
      }
    },

    async restore(name) {
      if (disk) applyLoad(await disk.restoreBackup(name));
    },

    tick(now = Date.now()) {
      set({ now });
      const data = get().data;
      if (!data) return;
      const next = applyTransition(
        data,
        timer.advance(data.timer, timer.durationsFrom(data.settings), now),
      );
      if (next !== data) commit(next);
    },

    toggle() {
      const data = get().data;
      if (data) commit({ ...data, timer: timer.toggle(data.timer, Date.now()) });
    },
    skip() {
      const data = get().data;
      if (data) commit(applyTransition(data, timer.skip(data.timer, Date.now())));
    },
    reset() {
      const data = get().data;
      if (data) commit(applyTransition(data, timer.reset(data.timer, Date.now())));
    },

    quickAdd(raw, priority) {
      const data = get().data;
      const parsed = parseQuickAdd(raw);
      if (!data || !parsed) return false;
      commit({ ...data, tasks: addTask(data.tasks, { ...parsed, priority }, Date.now()) });
      return true;
    },

    setTaskStatus(id, status) {
      const data = get().data;
      if (data) commit({ ...data, tasks: setStatus(data.tasks, id, status, Date.now()) });
    },
  };
});
