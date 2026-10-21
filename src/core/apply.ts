// Applique une transition du minuteur aux données : sessions enregistrées, pomodoros comptés.

import { addPomodoro, currentTask, newId } from "./tasks";
import type { Transition } from "./timer";
import { toLocalIso } from "./time";
import type { DataFile, Session } from "./types";

/**
 * Chaque session de focus est rattachée à la tâche en cours ; un focus terminé lui ajoute un
 * pomodoro. Sans tâche en cours (focus libre, D-009), la session est enregistrée sans tâche.
 * Renvoie `data` inchangé (même référence) s'il n'y a rien à appliquer.
 */
export function applyTransition(
  data: DataFile,
  tr: Transition,
  makeId: () => string = newId,
): DataFile {
  if (tr.sessions.length === 0 && tr.timer === data.timer) return data;
  const cur = currentTask(data.tasks);
  let tasks = data.tasks;
  const sessions = [...data.sessions];
  for (const s of tr.sessions) {
    const session: Session = {
      id: makeId(),
      type: s.type,
      startedAt: toLocalIso(s.startedAt),
      endedAt: toLocalIso(s.endedAt),
      completed: s.completed,
      pausedMs: s.pausedMs,
    };
    if (s.type === "focus" && cur) session.taskId = cur.id;
    sessions.push(session);
    if (s.type === "focus" && s.completed && cur) tasks = addPomodoro(tasks, cur.id, s.endedAt);
  }
  return { ...data, tasks, sessions, timer: tr.timer };
}
