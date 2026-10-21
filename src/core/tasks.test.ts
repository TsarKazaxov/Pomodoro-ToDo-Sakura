import { describe, expect, it } from "vitest";
import { comboVisible, emptyCombo, stepCombo } from "./combo";
import {
  addPomodoro,
  addTask,
  currentTask,
  moveTask,
  parseQuickAdd,
  priorities,
  setCurrent,
  setStatus,
  updateTask,
} from "./tasks";
import { dayKeyOf } from "./time";
import type { Task } from "./types";

const T0 = Date.UTC(2026, 9, 5, 8, 0);
const MIN = 60_000;

function seed(): Task[] {
  let ts: Task[] = [];
  ts = addTask(ts, { title: "C", size: "L" }, T0, "c");
  ts = addTask(ts, { title: "B", size: "M", priority: true }, T0, "b");
  ts = addTask(ts, { title: "A", size: "S", priority: true }, T0, "a");
  return ts;
}

describe("ajout rapide (D-017)", () => {
  it.each([
    ["Relire la spec #M", { title: "Relire la spec", size: "M" }],
    ["Audit #xl", { title: "Audit", size: "XL" }],
    ["  Écran paiement   #XS  ", { title: "Écran paiement", size: "XS" }],
    ["Sans taille", { title: "Sans taille", size: "S" }],
    ["Bug C# du lecteur", { title: "Bug C# du lecteur", size: "S" }],
    ["Tag inconnu #XXL", { title: "Tag inconnu #XXL", size: "S" }],
  ])("%s", (raw, expected) => {
    expect(parseQuickAdd(raw)).toEqual(expected);
  });

  it("refuse un titre vide", () => {
    expect(parseQuickAdd("   ")).toBeNull();
    expect(parseQuickAdd("#M")).toBeNull();
  });
});

describe("opérations sur les tâches", () => {
  it("ajoute en tête de liste", () => {
    const ts = seed();
    expect(ts.map((t) => [t.id, t.order])).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 2],
    ]);
    expect(ts[0]).toMatchObject({ status: "todo", pomodorosSpent: 0, priority: true });
  });

  it("cocher date la tâche dans le jour local", () => {
    const ts = setStatus(seed(), "a", "done", T0);
    expect(dayKeyOf(ts.find((t) => t.id === "a")!.completedAt!)).toBe("2026-10-05");
  });

  it("décocher efface la date de fin (D-010)", () => {
    let ts = setStatus(seed(), "a", "done", T0);
    ts = setStatus(ts, "a", "todo", T0 + MIN);
    expect(ts.find((t) => t.id === "a")!.completedAt).toBeUndefined();
  });

  it("une seule tâche en cours à la fois", () => {
    let ts = setCurrent(seed(), "a", T0);
    ts = setCurrent(ts, "b", T0);
    expect(ts.filter((t) => t.status === "doing").map((t) => t.id)).toEqual(["b"]);
    expect(currentTask(ts)!.id).toBe("b");
    ts = setCurrent(ts, null, T0);
    expect(currentTask(ts)).toBeUndefined();
  });

  it("compte un pomodoro", () => {
    expect(addPomodoro(seed(), "b", T0).find((t) => t.id === "b")!.pomodorosSpent).toBe(1);
  });

  it("modifie titre et taille", () => {
    const t = updateTask(seed(), "c", { title: "C2", size: "XS" }, T0 + MIN).find(
      (x) => x.id === "c",
    )!;
    expect(t).toMatchObject({ title: "C2", size: "XS" });
  });

  it("réordonne par glisser-déposer", () => {
    const order = (ts: Task[]) => [...ts].sort((x, y) => x.order - y.order).map((t) => t.id);
    expect(order(moveTask(seed(), "c", "a"))).toEqual(["c", "a", "b"]);
    expect(order(moveTask(seed(), "a", null))).toEqual(["b", "c", "a"]);
    expect(order(moveTask(seed(), "a", "a"))).toEqual(["a", "b", "c"]);
  });

  it("priorités : épinglées et encore ouvertes, dans l'ordre", () => {
    const ts = setStatus(seed(), "a", "done", T0);
    expect(priorities(ts).map((t) => t.id)).toEqual(["b"]);
  });
});

describe("série de tâches cochées (D-019)", () => {
  it("monte d'un palier par tâche cochée dans les 10 min", () => {
    let s = emptyCombo();
    const tiers = ["a", "b", "c", "d", "e"].map((id, i) => {
      const r = stepCombo(s, id, T0 + i * 9 * MIN);
      s = r.state;
      return r.tier;
    });
    expect(tiers).toEqual([1, 2, 3, 4, 4]);
  });

  it("repart à 1 après plus de 10 min", () => {
    let r = stepCombo(emptyCombo(), "a", T0);
    r = stepCombo(r.state, "b", T0 + 10 * MIN + 1);
    expect(r.tier).toBe(1);
  });

  it("recocher la même tâche ne fait pas monter", () => {
    let r = stepCombo(emptyCombo(), "a", T0);
    r = stepCombo(r.state, "a", T0 + MIN);
    expect(r.tier).toBe(1);
  });

  it("badge visible à partir de 2, tant que la fenêtre est ouverte", () => {
    let r = stepCombo(emptyCombo(), "a", T0);
    expect(comboVisible(r.state, T0)).toBe(false);
    r = stepCombo(r.state, "b", T0 + MIN);
    expect(comboVisible(r.state, T0 + 5 * MIN)).toBe(true);
    expect(comboVisible(r.state, T0 + 12 * MIN)).toBe(false);
  });
});
