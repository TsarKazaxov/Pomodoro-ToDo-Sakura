import { describe, expect, it } from "vitest";
import { addTask } from "./tasks";
import { createEmptyData, DEFAULT_SCALE, parseDataFile, serialize } from "./schema";
import { daysLabel, effortOf, expectedPomodoros, formatMinutes, spentByTask } from "./effort";
import { toLocalIso } from "./time";
import { start } from "./timer";
import type { DataFile, Session } from "./types";

const T0 = Date.UTC(2026, 9, 19, 8, 0);
const MIN = 60_000;

function focus(taskId: string, at: number, minutes: number, pausedMs = 0): Session {
  return {
    id: `s${at}`,
    type: "focus",
    taskId,
    startedAt: toLocalIso(at),
    endedAt: toLocalIso(at + minutes * MIN + pausedMs),
    completed: true,
    pausedMs,
  };
}

function project(): DataFile {
  const d = createEmptyData("mac-a", T0);
  d.tasks = addTask(d.tasks, { title: "Refonte", size: "L" }, T0, "p");
  d.tasks = addTask(d.tasks, { title: "Maquettes", size: "M", parentId: "p" }, T0, "a");
  d.tasks = addTask(d.tasks, { title: "Tests", size: "S", parentId: "p" }, T0, "b");
  return d;
}

describe("estimation et temps passé (D-046)", () => {
  it("le temps passé d'une tâche inclut ses sous-tâches, pauses du minuteur déduites", () => {
    const d = project();
    d.sessions = [focus("p", T0, 25), focus("a", T0 + 30 * MIN, 25, 5 * MIN), focus("b", T0, 50)];
    const e = effortOf(
      d.tasks.find((t) => t.id === "p")!,
      d.tasks,
      spentByTask(d, T0),
      d.settings.scale,
    );
    expect(e).toMatchObject({ spentMin: 100, budgetMin: 240, remainingMin: 140, overMin: 0 });
    expect(e.subtasks).toEqual({ total: 2, done: 0, plannedMin: 180 });
  });

  it("dépassement : ce qui a été passé au-delà de l'estimation", () => {
    const d = project();
    d.sessions = [focus("b", T0, 90)];
    const e = effortOf(
      d.tasks.find((t) => t.id === "b")!,
      d.tasks,
      spentByTask(d, T0),
      d.settings.scale,
    );
    expect(e).toMatchObject({ spentMin: 90, budgetMin: 60, remainingMin: 0, overMin: 30 });
  });

  it("le focus en cours compte déjà", () => {
    const d = project();
    d.tasks = d.tasks.map((t) => (t.id === "a" ? { ...t, status: "doing" as const } : t));
    d.timer = start(d.timer, T0);
    const spent = spentByTask(d, T0 + 12 * MIN);
    expect(Math.round((spent.get("a") ?? 0) / MIN)).toBe(12);
  });

  it("pomodoros attendus : durée de la taille ÷ durée du focus", () => {
    expect(expectedPomodoros(DEFAULT_SCALE, "M", 25)).toBe(5);
    expect(expectedPomodoros(DEFAULT_SCALE, "XS", 50)).toBe(1);
  });

  it("formats lisibles", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(120)).toBe("2 h");
    expect(formatMinutes(150)).toBe("2 h 30");
    expect(daysLabel(60, 4)).toBe("≈ ¼ jour");
    expect(daysLabel(120, 4)).toBe("≈ ½ jour");
    expect(daysLabel(240, 4)).toBe("≈ 1 jour");
    expect(daysLabel(600, 4)).toBe("≈ 2 jours ½");
    expect(daysLabel(30, 4)).toBe("< ¼ jour");
  });

  it("anciens fichiers : l'estimation en pomodoros devient une durée", () => {
    const raw = JSON.parse(serialize(createEmptyData("mac-a", T0)));
    raw.settings.scale.M = { points: 3, expectedPomodoros: 4 };
    const r = parseDataFile(JSON.stringify(raw));
    expect(r.ok && r.data.settings.scale.M).toEqual({ points: 3, minutes: 100 });
  });

  it("sous-tâche orpheline ou imbriquée : elle redevient indépendante", () => {
    const d = project();
    d.tasks = addTask(d.tasks, { title: "Imbriquée", size: "XS", parentId: "a" }, T0, "c");
    d.tasks = addTask(d.tasks, { title: "Orpheline", size: "XS", parentId: "zz" }, T0, "o");
    const r = parseDataFile(serialize(d));
    const byId = new Map(r.ok ? r.data.tasks.map((t) => [t.id, t]) : []);
    expect(byId.get("a")?.parentId).toBe("p");
    expect(byId.get("c")?.parentId).toBeUndefined();
    expect(byId.get("o")?.parentId).toBeUndefined();
  });
});
