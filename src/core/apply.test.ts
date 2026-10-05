import { describe, expect, it } from "vitest";
import { applyTransition } from "./apply";
import { createEmptyData } from "./schema";
import { addTask, setCurrent } from "./tasks";
import { advance, durationsFrom, initialTimer, reset, start } from "./timer";

const T0 = Date.UTC(2026, 9, 5, 8, 0);
const MIN = 60_000;
let n = 0;
const id = () => `s${++n}`;

function withTask(current: boolean) {
  const d = createEmptyData("mac-a", T0);
  d.tasks = addTask([], { title: "Audit", size: "M" }, T0, "t1");
  if (current) d.tasks = setCurrent(d.tasks, "t1", T0);
  d.timer = start(initialTimer(), T0);
  return d;
}

describe("transition du minuteur → données", () => {
  it("un focus terminé ajoute un pomodoro à la tâche en cours", () => {
    const d = withTask(true);
    const r = applyTransition(d, advance(d.timer, durationsFrom(d.settings), T0 + 25 * MIN), id);
    expect(r.tasks[0]!.pomodorosSpent).toBe(1);
    expect(r.sessions).toEqual([
      expect.objectContaining({
        type: "focus",
        taskId: "t1",
        completed: true,
        endedAt: "2026-10-05T10:25:00.000+02:00",
      }),
    ]);
    expect(r.timer.phase).toBe("short_break");
  });

  it("un focus interrompu est enregistré sans pomodoro", () => {
    const d = withTask(true);
    const r = applyTransition(d, reset(d.timer, T0 + 5 * MIN), id);
    expect(r.tasks[0]!.pomodorosSpent).toBe(0);
    expect(r.sessions[0]).toMatchObject({ completed: false, taskId: "t1" });
  });

  it("focus libre : session sans tâche (D-009)", () => {
    const d = withTask(false);
    const r = applyTransition(d, advance(d.timer, durationsFrom(d.settings), T0 + 25 * MIN), id);
    expect(r.sessions[0]!.taskId).toBeUndefined();
    expect(r.tasks[0]!.pomodorosSpent).toBe(0);
  });

  it("rien à appliquer : même objet, pas d'écriture inutile", () => {
    const d = withTask(true);
    expect(applyTransition(d, advance(d.timer, durationsFrom(d.settings), T0 + MIN), id)).toBe(d);
  });
});
