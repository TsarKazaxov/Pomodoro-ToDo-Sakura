// Opérations sur les tâches, sans effet de bord : chaque fonction renvoie un nouveau tableau.

import { toLocalIso } from "./time";
import { SIZES, type Size, type Task, type TaskStatus } from "./types";

/** Taille par défaut d'un ajout rapide sans `#taille` (D-017). */
export const DEFAULT_SIZE: Size = "S";

/** `Relire la spec #M` → `{ title: "Relire la spec", size: "M" }`. `null` si le titre est vide. */
export function parseQuickAdd(raw: string): { title: string; size: Size } | null {
  const m = raw.trim().match(/^(.*?)\s*#(XS|S|M|L|XL)$/i);
  const title = (m ? m[1]! : raw).trim();
  if (!title) return null;
  const size = m ? (m[2]!.toUpperCase() as Size) : DEFAULT_SIZE;
  return SIZES.includes(size) ? { title, size } : null;
}

export function newId(): string {
  return globalThis.crypto.randomUUID();
}

/** Ajoute une tâche en tête de liste. */
export function addTask(
  tasks: readonly Task[],
  input: { title: string; size: Size; priority?: boolean },
  now: number,
  id: string = newId(),
): Task[] {
  const iso = toLocalIso(now);
  const task: Task = {
    id,
    title: input.title,
    size: input.size,
    priority: input.priority ?? false,
    status: "todo",
    createdAt: iso,
    pomodorosSpent: 0,
    order: 0,
    updatedAt: iso,
  };
  return [task, ...tasks.map((t) => ({ ...t, order: t.order + 1 }))];
}

export function updateTask(
  tasks: readonly Task[],
  id: string,
  patch: Partial<Pick<Task, "title" | "size" | "priority">>,
  now: number,
): Task[] {
  return tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: toLocalIso(now) } : t));
}

/**
 * Change le statut. `done` date la tâche ; tout autre statut efface `completedAt` (D-010).
 * `doing` remet l'éventuelle autre tâche en cours à `todo` : une seule tâche en cours.
 */
export function setStatus(
  tasks: readonly Task[],
  id: string,
  status: TaskStatus,
  now: number,
): Task[] {
  const iso = toLocalIso(now);
  return tasks.map((t) => {
    if (t.id === id) {
      if (t.status === status) return t;
      const next: Task = { ...t, status, updatedAt: iso };
      if (status === "done") next.completedAt = iso;
      else delete next.completedAt;
      return next;
    }
    if (status === "doing" && t.status === "doing") return { ...t, status: "todo", updatedAt: iso };
    return t;
  });
}

export const currentTask = (tasks: readonly Task[]) => tasks.find((t) => t.status === "doing");

/** Choisit la tâche en cours ; `null` = focus libre. */
export function setCurrent(tasks: readonly Task[], id: string | null, now: number): Task[] {
  if (id) return setStatus(tasks, id, "doing", now);
  const cur = currentTask(tasks);
  return cur ? setStatus(tasks, cur.id, "todo", now) : [...tasks];
}

/** +1 pomodoro sur la tâche `id` (focus terminé). */
export function addPomodoro(tasks: readonly Task[], id: string, now: number): Task[] {
  return tasks.map((t) =>
    t.id === id ? { ...t, pomodorosSpent: t.pomodorosSpent + 1, updatedAt: toLocalIso(now) } : t,
  );
}

/** Déplace la tâche `id` à la position de `beforeId` (ou à la fin si `null`) et renumérote. */
export function moveTask(tasks: readonly Task[], id: string, beforeId: string | null): Task[] {
  const sorted = [...tasks].sort((a, b) => a.order - b.order);
  const from = sorted.findIndex((t) => t.id === id);
  if (from < 0 || id === beforeId) return [...tasks];
  const [moved] = sorted.splice(from, 1);
  const to = beforeId === null ? sorted.length : sorted.findIndex((t) => t.id === beforeId);
  sorted.splice(to < 0 ? sorted.length : to, 0, moved!);
  return sorted.map((t, i) => (t.order === i ? t : { ...t, order: i }));
}

/** Tâches épinglées encore ouvertes, dans l'ordre de la liste. */
export function priorities(tasks: readonly Task[]): Task[] {
  return tasks
    .filter((t) => t.priority && (t.status === "todo" || t.status === "doing"))
    .sort((a, b) => a.order - b.order);
}
