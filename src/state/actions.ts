// Toutes les modifications des données passent par une action et `reduce`, fonction pure.
// Les deux fenêtres envoient des actions ; seule la fenêtre propriétaire (le widget) les
// applique, écrit le fichier et diffuse le nouvel état (D-026).

import { applyTransition } from "../core/apply";
import { addTask, moveTask, parseQuickAdd, setCurrent, setStatus, updateTask } from "../core/tasks";
import * as timer from "../core/timer";
import type { Corner, DataFile, Settings, Task, TaskStatus } from "../core/types";

export type Action =
  | { type: "timer/toggle" }
  | { type: "timer/skip" }
  | { type: "timer/reset" }
  /** `lastInputAt` : dernière activité clavier/souris, pour la prolongation (D-042). */
  | { type: "timer/tick"; lastInputAt?: number | null }
  | { type: "task/quickAdd"; raw: string; priority: boolean }
  | { type: "task/setStatus"; id: string; status: TaskStatus }
  | { type: "task/setCurrent"; id: string | null }
  | { type: "task/update"; id: string; patch: Partial<Pick<Task, "title" | "size" | "priority">> }
  | { type: "task/move"; id: string; beforeId: string | null }
  | { type: "settings/update"; patch: Partial<Settings> }
  | { type: "onboarding/complete"; focusMinutes: number; corner: Corner; firstTask: string }
  /** Import d'un export JSON : remplace tâches, sessions et réglages. */
  | { type: "data/import"; data: DataFile };

/** Ce qui mérite une récompense ou un signal à l'utilisateur. */
export type Effect =
  | { kind: "focusDone"; taskId?: string; breakMinutes: number }
  | { kind: "breakDone" }
  /** Le focus est arrivé à son terme pendant que tu travaillais : il se prolonge (D-042). */
  | { kind: "overtime" }
  | { kind: "taskDone"; taskId: string; points: number };

export interface Reduced {
  data: DataFile;
  effects: Effect[];
}

function timerEffects(before: DataFile, after: DataFile, tr: timer.Transition): Effect[] {
  const effects: Effect[] = [];
  const cur = before.tasks.find((t) => t.status === "doing");
  for (const s of tr.sessions) {
    if (!s.completed) continue;
    if (s.type === "focus") {
      const breakMinutes =
        after.timer.phase === "long_break"
          ? after.settings.longBreakMinutes
          : after.settings.shortBreakMinutes;
      effects.push(
        cur
          ? { kind: "focusDone", taskId: cur.id, breakMinutes }
          : { kind: "focusDone", breakMinutes },
      );
    } else effects.push({ kind: "breakDone" });
  }
  if (before.timer.overtimeAt === null && after.timer.overtimeAt !== null)
    effects.push({ kind: "overtime" });
  return effects;
}

export function reduce(data: DataFile, action: Action, now: number): Reduced {
  const same = { data, effects: [] };
  switch (action.type) {
    case "timer/tick":
    case "timer/skip":
    case "timer/reset": {
      const d = timer.durationsFrom(data.settings);
      const tr =
        action.type === "timer/tick"
          ? timer.advance(data.timer, d, now, {
              lastInputAt: action.lastInputAt ?? null,
              extend: data.settings.extendWhileActive,
            })
          : action.type === "timer/skip"
            ? timer.skip(data.timer, now, d)
            : timer.reset(data.timer, now);
      const next = applyTransition(data, tr);
      return next === data ? same : { data: next, effects: timerEffects(data, next, tr) };
    }
    case "timer/toggle": {
      // En prolongation, le bouton principal lance la pause (« Faire la pause »).
      if (timer.isOvertime(data.timer)) return reduce(data, { type: "timer/skip" }, now);
      // Rattrape d'abord une phase échue, pour ne jamais suspendre un focus déjà terminé.
      const caught = reduce(data, { type: "timer/tick" }, now);
      const t = timer.toggle(caught.data.timer, now);
      return { data: { ...caught.data, timer: t }, effects: caught.effects };
    }
    case "task/quickAdd": {
      const parsed = parseQuickAdd(action.raw);
      if (!parsed) return same;
      return {
        data: {
          ...data,
          tasks: addTask(data.tasks, { ...parsed, priority: action.priority }, now),
        },
        effects: [],
      };
    }
    case "task/setStatus": {
      const before = data.tasks.find((t) => t.id === action.id);
      if (!before || before.status === action.status) return same;
      const tasks = setStatus(data.tasks, action.id, action.status, now);
      const effects: Effect[] =
        action.status === "done"
          ? [
              {
                kind: "taskDone",
                taskId: before.id,
                points: data.settings.scale[before.size].points,
              },
            ]
          : [];
      return { data: { ...data, tasks }, effects };
    }
    case "task/setCurrent":
      return { data: { ...data, tasks: setCurrent(data.tasks, action.id, now) }, effects: [] };
    case "task/update":
      return {
        data: { ...data, tasks: updateTask(data.tasks, action.id, action.patch, now) },
        effects: [],
      };
    case "task/move":
      return {
        data: { ...data, tasks: moveTask(data.tasks, action.id, action.beforeId) },
        effects: [],
      };
    case "settings/update":
      return { data: { ...data, settings: { ...data.settings, ...action.patch } }, effects: [] };
    case "onboarding/complete": {
      let tasks = data.tasks;
      const parsed = parseQuickAdd(action.firstTask);
      if (parsed) {
        tasks = addTask(tasks, { ...parsed, priority: true }, now);
        tasks = setCurrent(tasks, tasks[0]!.id, now);
      }
      const settings = {
        ...data.settings,
        focusMinutes: action.focusMinutes,
        corner: action.corner,
        onboarded: true,
      };
      return { data: { ...data, tasks, settings }, effects: [] };
    }
    case "data/import":
      // On garde l'appareil et le minuteur en cours : seul le contenu est remplacé.
      return {
        data: {
          ...action.data,
          deviceId: data.deviceId,
          timer: data.timer,
          settings: { ...action.data.settings, onboarded: true },
        },
        effects: [],
      };
  }
}
