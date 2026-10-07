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

  it("prolongation : effet unique, puis « Faire la pause » compte le pomodoro (D-042)", () => {
    let d = base();
    d = reduce(d, { type: "task/setCurrent", id: firstId(d) }, T0).data;
    d = reduce(d, { type: "timer/toggle" }, T0).data;
    const end = T0 + 25 * MIN;
    const r = reduce(d, { type: "timer/tick", lastInputAt: end }, end + 1000);
    expect(r.effects).toEqual([{ kind: "overtime" }]);
    expect(r.data.tasks[0]!.pomodorosSpent).toBe(0);
    const again = reduce(r.data, { type: "timer/tick", lastInputAt: end + 2000 }, end + 2000);
    expect(again.effects).toEqual([]);
    const brk = reduce(again.data, { type: "timer/toggle" }, end + 10 * MIN);
    expect(brk.data.timer.phase).toBe("short_break");
    expect(brk.data.tasks[0]!.pomodorosSpent).toBe(1);
    expect(brk.data.sessions[brk.data.sessions.length - 1]).toMatchObject({
      type: "focus",
      completed: true,
    });
    expect(brk.effects[0]).toMatchObject({ kind: "focusDone", breakMinutes: 5 });
  });

  it("réglage de prolongation coupé : la pause démarre comme avant", () => {
    let d = base();
    d = reduce(d, { type: "settings/update", patch: { extendWhileActive: false } }, T0).data;
    d = reduce(d, { type: "timer/toggle" }, T0).data;
    const end = T0 + 25 * MIN;
    const r = reduce(d, { type: "timer/tick", lastInputAt: end }, end + 1000);
    expect(r.data.timer.phase).toBe("short_break");
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

  it("premier lancement : réglages, première tâche épinglée et en cours", () => {
    const d = reduce(
      createEmptyData("mac-a", T0),
      {
        type: "onboarding/complete",
        focusMinutes: 45,
        corner: "top-left",
        firstTask: "Synthèse #M",
      },
      T0,
    ).data;
    expect(d.settings).toMatchObject({ focusMinutes: 45, corner: "top-left", onboarded: true });
    expect(d.tasks[0]).toMatchObject({
      title: "Synthèse",
      size: "M",
      priority: true,
      status: "doing",
    });
  });

  it("premier lancement sans tâche", () => {
    const d = reduce(
      createEmptyData("mac-a", T0),
      { type: "onboarding/complete", focusMinutes: 25, corner: "top-right", firstTask: "" },
      T0,
    ).data;
    expect(d.tasks).toEqual([]);
    expect(d.settings.onboarded).toBe(true);
  });

  it("l'import remplace le contenu mais garde l'appareil et le minuteur", () => {
    const mine = reduce(base(), { type: "timer/toggle" }, T0).data;
    const other = { ...createEmptyData("mac-b", T0), tasks: [] };
    const d = reduce(mine, { type: "data/import", data: other }, T0).data;
    expect(d.tasks).toEqual([]);
    expect(d.deviceId).toBe("mac-a");
    expect(d.timer).toBe(mine.timer);
  });
});
