// Estimation et temps passé (D-046) : chaque taille vaut un temps de focus, le temps passé sur
// une tâche est la somme de ses sessions de focus (et de celles de ses sous-tâches), focus en
// cours compris. On compare les deux pour voir ce qui reste, ou de combien on a dépassé.

import { elapsedMs } from "./timer";
import type { DataFile, Scale, Session, Size, Task } from "./types";

const MIN = 60_000;

/** Durée de concentration d'une session (pauses du minuteur déduites). */
export function sessionFocusMs(s: Session): number {
  return Math.max(0, Date.parse(s.endedAt) - Date.parse(s.startedAt) - s.pausedMs);
}

export const childrenOf = (tasks: readonly Task[], id: string) =>
  tasks.filter((t) => t.parentId === id).sort((a, b) => a.order - b.order);

/** Pomodoros attendus pour une taille, d'après la durée de focus réglée. */
export function expectedPomodoros(scale: Scale, size: Size, focusMinutes: number): number {
  return Math.max(1, Math.round(scale[size].minutes / Math.max(1, focusMinutes)));
}

/** Temps de focus passé par tâche (elle seule), en ms, focus en cours compris. */
export function spentByTask(data: DataFile, now: number): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of data.sessions) {
    if (s.type !== "focus" || !s.taskId) continue;
    m.set(s.taskId, (m.get(s.taskId) ?? 0) + sessionFocusMs(s));
  }
  const cur = data.tasks.find((t) => t.status === "doing");
  if (cur && data.timer.phase === "focus")
    m.set(cur.id, (m.get(cur.id) ?? 0) + elapsedMs(data.timer, now));
  return m;
}

export interface Effort {
  /** Temps de focus passé, sous-tâches comprises (minutes). */
  spentMin: number;
  /** Estimation de la tâche : la durée de sa taille (minutes). */
  budgetMin: number;
  /** Ce qui reste (0 si dépassé) et le dépassement (0 sinon). */
  remainingMin: number;
  overMin: number;
  /** Avancement, de 0 à 1 (peut dépasser 1). */
  ratio: number;
  /** Sous-tâches : nombre, terminées, et somme de leurs estimations (minutes). */
  subtasks: { total: number; done: number; plannedMin: number };
}

export function effortOf(
  task: Task,
  tasks: readonly Task[],
  spent: Map<string, number>,
  scale: Scale,
): Effort {
  const kids = childrenOf(tasks, task.id).filter((t) => t.status !== "dropped");
  const ms = [task, ...kids].reduce((a, t) => a + (spent.get(t.id) ?? 0), 0);
  const spentMin = Math.round(ms / MIN);
  const budgetMin = scale[task.size].minutes;
  return {
    spentMin,
    budgetMin,
    remainingMin: Math.max(0, budgetMin - spentMin),
    overMin: Math.max(0, spentMin - budgetMin),
    ratio: budgetMin ? spentMin / budgetMin : 0,
    subtasks: {
      total: kids.length,
      done: kids.filter((t) => t.status === "done").length,
      plannedMin: kids.reduce((a, t) => a + scale[t.size].minutes, 0),
    },
  };
}

/** `45 min`, `2 h`, `2 h 30`. */
export function formatMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
}

/** Équivalent en journées de travail, au quart de journée près : `≈ ¼ jour`, `≈ 1 jour ½`. */
export function daysLabel(min: number, focusHoursPerDay: number): string {
  const days = min / (Math.max(1, focusHoursPerDay) * 60);
  if (days < 0.2) return "< ¼ jour";
  const quarters = Math.round(days * 4);
  const whole = Math.floor(quarters / 4);
  const frac = ["", "¼", "½", "¾"][quarters % 4]!;
  if (whole === 0) return `≈ ${frac} jour`;
  return `≈ ${whole} jour${whole > 1 ? "s" : ""}${frac ? ` ${frac}` : ""}`;
}
