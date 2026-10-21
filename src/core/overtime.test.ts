// Prolongation du focus pendant que tu travailles (D-042).

import { describe, expect, it } from "vitest";
import {
  advance,
  endOvertime,
  IDLE_END_MS,
  initialTimer,
  isOvertime,
  overtimeMs,
  remainingMs,
  reset,
  skip,
  start,
  type Activity,
  type Durations,
} from "./timer";

const MIN = 60_000;
const D: Durations = {
  focusMs: 25 * MIN,
  shortBreakMs: 5 * MIN,
  longBreakMs: 15 * MIN,
  focusesBeforeLongBreak: 4,
};
const T0 = Date.UTC(2026, 9, 5, 8, 0);
const END = T0 + 25 * MIN;
const active = (at: number): Activity => ({ lastInputAt: at, extend: true });

/** Focus lancé à T0, arrivé à son terme pendant que tu tapes. */
function inOvertime() {
  const tr = advance(start(initialTimer(), T0), D, END + 1000, active(END + 500));
  expect(tr.sessions).toEqual([]);
  expect(isOvertime(tr.timer)).toBe(true);
  return tr.timer;
}

describe("prolongation du focus", () => {
  it("tu travailles à la fin du focus : il se prolonge, aucune pause, rien d'enregistré", () => {
    const t = inOvertime();
    expect(t.phase).toBe("focus");
    expect(t.overtimeAt).toBe(END);
    expect(remainingMs(t, D, END + 1000)).toBe(0);
    expect(overtimeMs(t, D, END + 10 * MIN)).toBe(10 * MIN);
  });

  it("tu n'as rien touché depuis plus de 30 s : la pause démarre comme avant", () => {
    const tr = advance(start(initialTimer(), T0), D, END + 1000, active(END - 40_000));
    expect(tr.timer.phase).toBe("short_break");
    expect(tr.sessions[0]?.endedAt).toBe(END);
  });

  it("réglage désactivé : la pause démarre comme avant", () => {
    const tr = advance(start(initialTimer(), T0), D, END + 1000, {
      lastInputAt: END + 500,
      extend: false,
    });
    expect(tr.timer.phase).toBe("short_break");
  });

  it("tu continues : le focus reste en cours, l'activité est notée toutes les 30 s", () => {
    let t = inOvertime();
    for (let s = 2; s <= 600; s++) {
      t = advance(t, D, END + s * 1000, active(END + s * 1000 - 300)).timer;
      expect(isOvertime(t)).toBe(true);
    }
    expect(t.lastActiveAt).toBeGreaterThanOrEqual(END + 570_000);
  });

  it("tu t'arrêtes : 2 min plus tard, la pause démarre à l'heure de ta dernière activité", () => {
    let t = inOvertime();
    const stoppedAt = END + 12 * MIN;
    for (let s = 2; s <= 12 * 60; s += 2)
      t = advance(t, D, END + s * 1000, active(END + s * 1000)).timer;
    const before = advance(t, D, stoppedAt + IDLE_END_MS - 1000, active(stoppedAt));
    expect(isOvertime(before.timer)).toBe(true);
    const tr = advance(t, D, stoppedAt + IDLE_END_MS, active(stoppedAt));
    expect(tr.sessions).toEqual([
      { type: "focus", startedAt: T0, endedAt: stoppedAt, completed: true, pausedMs: 0 },
    ]);
    expect(tr.timer).toMatchObject({
      phase: "short_break",
      startedAt: stoppedAt,
      focusCount: 1,
      overtimeAt: null,
    });
    // La pause a déjà couru 2 min : il en reste 3.
    expect(remainingMs(tr.timer, D, stoppedAt + IDLE_END_MS)).toBe(3 * MIN);
  });

  it("le Mac dort pendant la prolongation : le temps de veille ne compte pas", () => {
    let t = inOvertime();
    for (let s = 2; s <= 300; s++) t = advance(t, D, END + s * 1000, active(END + s * 1000)).timer;
    const wake = END + 3 * 60 * MIN;
    // Au réveil, tu bouges la souris : l'activité récente ne doit pas prolonger 3 h de sommeil.
    const tr = advance(t, D, wake, active(wake));
    const focus = tr.sessions.find((x) => x.type === "focus");
    expect(focus?.endedAt).toBeLessThanOrEqual(END + 300_000 + 30_000);
    expect(focus?.endedAt).toBeGreaterThanOrEqual(END + 270_000);
    // La pause de 5 min est finie depuis longtemps : retour à l'arrêt.
    expect(tr.timer.phase).toBe("idle");
  });

  it("après une veille, une fin de focus ancienne ne se prolonge pas", () => {
    const wake = END + 2 * 60 * MIN;
    const tr = advance(start(initialTimer(), T0), D, wake, active(wake));
    expect(isOvertime(tr.timer)).toBe(false);
    expect(tr.sessions.map((s) => s.type)).toEqual(["focus", "short_break"]);
  });

  it("« Faire la pause » : le focus s'arrête maintenant, complet, et la pause démarre", () => {
    const t = inOvertime();
    const at = END + 7 * MIN;
    const tr = endOvertime(t, D, at);
    expect(tr.sessions).toEqual([
      { type: "focus", startedAt: T0, endedAt: at, completed: true, pausedMs: 0 },
    ]);
    expect(tr.timer).toMatchObject({ phase: "short_break", startedAt: at, focusCount: 1 });
    expect(skip(t, at, D)).toEqual(tr);
  });

  it("« Réinitialiser » en prolongation garde le focus comme terminé", () => {
    const tr = reset(inOvertime(), END + 3 * MIN);
    expect(tr.sessions[0]).toMatchObject({ completed: true, endedAt: END + 3 * MIN });
    expect(tr.timer).toMatchObject({ phase: "idle", focusCount: 1, overtimeAt: null });
  });

  it("le 4ᵉ focus prolongé mène à la pause longue", () => {
    let t = { ...start(initialTimer(), T0), focusCount: 3 };
    t = advance(t, D, END + 1000, active(END)).timer;
    const tr = endOvertime(t, D, END + 2 * MIN);
    expect(tr.timer.phase).toBe("long_break");
  });

  it("sans information d'activité, une prolongation en cours s'arrête aussitôt", () => {
    const t = inOvertime();
    const tr = advance(t, D, END + 5000, { lastInputAt: null, extend: true });
    expect(tr.sessions[0]?.endedAt).toBe(END + 5000);
    expect(tr.timer.phase).toBe("short_break");
  });
});
