import { describe, expect, it } from "vitest";
import { createEmptyData } from "../core/schema";
import { reduce } from "./actions";

const T0 = Date.UTC(2026, 9, 5, 8, 0);
const MIN = 60_000;

function base() {
  let d = createEmptyData("mac-a", T0);
  d = reduce(d, { type: "task/quickAdd", raw: "Audit #M", priority: true }, T0).data;
  return d;
}
const firstId = (d: ReturnType<typeof base>) => d.tasks[0]!.id;

describe("réducteur", () => {
  it("ajout rapide épinglé depuis le widget", () => {
    expect(base().tasks[0]).toMatchObject({ title: "Audit", size: "M", priority: true });
  });

  it("un ajout vide ne change rien", () => {
    const d = base();
    expect(reduce(d, { type: "task/quickAdd", raw: " ", priority: true }, T0).data).toBe(d);
  });

  it("cocher une tâche produit une récompense pondérée par ses points", () => {
    const d = base();
    const r = reduce(d, { type: "task/setStatus", id: firstId(d), status: "done" }, T0);
    expect(r.effects).toEqual([{ kind: "taskDone", taskId: firstId(d), points: 3 }]);
  });

  it("recocher une tâche déjà terminée ne récompense pas deux fois", () => {
    let d = base();
    d = reduce(d, { type: "task/setStatus", id: firstId(d), status: "done" }, T0).data;
    expect(
      reduce(d, { type: "task/setStatus", id: firstId(d), status: "done" }, T0).effects,
    ).toEqual([]);
  });

  it("fin de focus : effet avec la tâche en cours et la durée de la pause", () => {
    let d = base();
    d = reduce(d, { type: "task/setCurrent", id: firstId(d) }, T0).data;
    d = reduce(d, { type: "timer/toggle" }, T0).data;
    const r = reduce(d, { type: "timer/tick" }, T0 + 25 * MIN);
    expect(r.effects).toEqual([{ kind: "focusDone", taskId: firstId(d), breakMinutes: 5 }]);
    expect(r.data.tasks[0]!.pomodorosSpent).toBe(1);
  });

  it("un tick sans fin de phase ne crée pas de nouvel état (pas d'écriture disque)", () => {
    let d = base();
    d = reduce(d, { type: "timer/toggle" }, T0).data;
    expect(reduce(d, { type: "timer/tick" }, T0 + MIN).data).toBe(d);
  });

  it("suspendre après la fin réelle d'un focus le termine d'abord", () => {
    const d = reduce(base(), { type: "timer/toggle" }, T0).data;
    const r = reduce(d, { type: "timer/toggle" }, T0 + 26 * MIN);
    expect(r.effects[0]).toMatchObject({ kind: "focusDone" });
    expect(r.data.timer).toMatchObject({ phase: "short_break", pausedAt: T0 + 26 * MIN });
  });

  it("les réglages se fusionnent", () => {
    const d = reduce(
      base(),
      { type: "settings/update", patch: { corner: "bottom-left" } },
      T0,
    ).data;
    expect(d.settings).toMatchObject({ corner: "bottom-left", focusMinutes: 25 });
  });
});
