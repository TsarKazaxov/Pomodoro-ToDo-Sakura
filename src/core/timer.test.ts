import { describe, expect, it } from "vitest";
import {
  advance,
  initialTimer,
  isPaused,
  pause,
  progress,
  remainingMs,
  reset,
  skip,
  start,
  toggle,
  type Durations,
} from "./timer";
import type { TimerState } from "./types";

const MIN = 60_000;
const D: Durations = {
  focusMs: 25 * MIN,
  shortBreakMs: 5 * MIN,
  longBreakMs: 15 * MIN,
  focusesBeforeLongBreak: 4,
};
const T0 = Date.UTC(2026, 9, 5, 8, 0); // 5 oct. 2026, 10:00 à Paris

/** Lance un focus à `at` et le laisse se terminer, pause comprise. */
function fullFocus(t: TimerState, at: number) {
  const started = start(t, at);
  return advance(started, D, at + 25 * MIN);
}

describe("état initial et démarrage", () => {
  it("affiche la durée du prochain focus à l'arrêt", () => {
    const t = initialTimer();
    expect(remainingMs(t, D, T0)).toBe(25 * MIN);
    expect(progress(t, D, T0)).toBe(0);
  });

  it("décompte depuis l'horodatage de départ", () => {
    const t = start(initialTimer(), T0);
    expect(t.phase).toBe("focus");
    expect(remainingMs(t, D, T0 + 10 * MIN)).toBe(15 * MIN);
    expect(progress(t, D, T0 + 10 * MIN)).toBeCloseTo(0.4);
  });

  it("démarrer un minuteur déjà en marche ne change rien", () => {
    const t = start(initialTimer(), T0);
    expect(start(t, T0 + MIN)).toBe(t);
  });
});

describe("suspension", () => {
  it("fige le temps restant pendant la suspension", () => {
    let t = start(initialTimer(), T0);
    t = pause(t, T0 + 10 * MIN);
    expect(isPaused(t)).toBe(true);
    expect(remainingMs(t, D, T0 + 60 * MIN)).toBe(15 * MIN);
  });

  it("reprend là où il s'était arrêté", () => {
    let t = start(initialTimer(), T0);
    t = pause(t, T0 + 10 * MIN);
    t = start(t, T0 + 40 * MIN);
    expect(t.pausedMs).toBe(30 * MIN);
    expect(remainingMs(t, D, T0 + 45 * MIN)).toBe(10 * MIN);
  });

  it("toggle alterne suspendre et reprendre", () => {
    let t = toggle(initialTimer(), T0);
    t = toggle(t, T0 + MIN);
    expect(isPaused(t)).toBe(true);
    t = toggle(t, T0 + 2 * MIN);
    expect(isPaused(t)).toBe(false);
    expect(remainingMs(t, D, T0 + 2 * MIN)).toBe(24 * MIN);
  });

  it("un focus suspendu n'arrive jamais à son terme", () => {
    let t = start(initialTimer(), T0);
    t = pause(t, T0 + 24 * MIN);
    const r = advance(t, D, T0 + 10 * 60 * MIN);
    expect(r.sessions).toHaveLength(0);
    expect(r.timer).toBe(t);
  });

  it("un focus avec suspension se termine décalé de la durée suspendue", () => {
    let t = start(initialTimer(), T0);
    t = pause(t, T0 + 5 * MIN);
    t = start(t, T0 + 15 * MIN);
    expect(advance(t, D, T0 + 34 * MIN).sessions).toHaveLength(0);
    const r = advance(t, D, T0 + 35 * MIN);
    expect(r.sessions[0]).toMatchObject({
      type: "focus",
      completed: true,
      endedAt: T0 + 35 * MIN,
      pausedMs: 10 * MIN,
    });
  });
});

describe("enchaînement des phases (D-016)", () => {
  it("fin de focus : la pause courte démarre seule, à l'heure exacte de fin", () => {
    const t = start(initialTimer(), T0);
    const r = advance(t, D, T0 + 25 * MIN + 3000);
    expect(r.sessions).toEqual([
      { type: "focus", startedAt: T0, endedAt: T0 + 25 * MIN, completed: true, pausedMs: 0 },
    ]);
    expect(r.timer).toMatchObject({
      phase: "short_break",
      startedAt: T0 + 25 * MIN,
      focusCount: 1,
    });
    expect(remainingMs(r.timer, D, T0 + 25 * MIN + 3000)).toBe(5 * MIN - 3000);
  });

  it("fin de pause : le minuteur attend un focus", () => {
    const t = fullFocus(initialTimer(), T0).timer;
    const r = advance(t, D, T0 + 30 * MIN);
    expect(r.sessions[0]).toMatchObject({ type: "short_break", completed: true });
    expect(r.timer).toMatchObject({ phase: "idle", next: "focus", startedAt: null });
  });

  it("le 4e focus mène à une pause longue, qui remet le cycle à zéro", () => {
    let t = initialTimer();
    let at = T0;
    for (let i = 0; i < 3; i++) {
      t = fullFocus(t, at).timer;
      expect(t.phase).toBe("short_break");
      t = advance(t, D, at + 30 * MIN).timer;
      at += 30 * MIN;
    }
    t = fullFocus(t, at).timer;
    expect(t).toMatchObject({ phase: "long_break", focusCount: 4 });
    t = advance(t, D, at + 40 * MIN).timer;
    expect(t).toMatchObject({ phase: "idle", focusCount: 0 });
  });

  it("le nombre de focus avant la pause longue est réglable", () => {
    const d2 = { ...D, focusesBeforeLongBreak: 2 };
    let t = advance(start(initialTimer(), T0), d2, T0 + 25 * MIN).timer;
    t = advance(t, d2, T0 + 30 * MIN).timer;
    t = advance(start(t, T0 + 30 * MIN), d2, T0 + 55 * MIN).timer;
    expect(t.phase).toBe("long_break");
  });
});

describe("veille du Mac", () => {
  it("veille de 2 h pendant un focus : focus et pause terminés à leur heure réelle", () => {
    const t = start(initialTimer(), T0 + 5 * MIN);
    const r = advance(t, D, T0 + 2 * 60 * MIN);
    expect(r.sessions).toEqual([
      {
        type: "focus",
        startedAt: T0 + 5 * MIN,
        endedAt: T0 + 30 * MIN,
        completed: true,
        pausedMs: 0,
      },
      {
        type: "short_break",
        startedAt: T0 + 30 * MIN,
        endedAt: T0 + 35 * MIN,
        completed: true,
        pausedMs: 0,
      },
    ]);
    expect(r.timer).toMatchObject({ phase: "idle", next: "focus", focusCount: 1 });
  });

  it("veille pendant le focus qui précède la pause longue", () => {
    let t: TimerState = { ...initialTimer(), focusCount: 3 };
    t = start(t, T0);
    const r = advance(t, D, T0 + 3 * 60 * MIN);
    expect(r.sessions.map((s) => s.type)).toEqual(["focus", "long_break"]);
    expect(r.sessions[1]!.endedAt).toBe(T0 + 40 * MIN);
    expect(r.timer.focusCount).toBe(0);
  });

  it("réveil avant la fin : rien ne se termine, le temps restant est exact", () => {
    const t = start(initialTimer(), T0);
    const r = advance(t, D, T0 + 20 * MIN);
    expect(r.sessions).toHaveLength(0);
    expect(remainingMs(r.timer, D, T0 + 20 * MIN)).toBe(5 * MIN);
  });

  it("une horloge qui recule (changement d'heure manuel) ne donne pas de temps négatif", () => {
    const t = start(initialTimer(), T0);
    expect(remainingMs(t, D, T0 - 10 * MIN)).toBe(25 * MIN);
  });
});

describe("Passer et Réinitialiser", () => {
  it("passer un focus l'enregistre comme interrompu et lance une pause courte", () => {
    const t = start({ ...initialTimer(), focusCount: 3 }, T0);
    const r = skip(t, T0 + 10 * MIN);
    expect(r.sessions).toEqual([
      { type: "focus", startedAt: T0, endedAt: T0 + 10 * MIN, completed: false, pausedMs: 0 },
    ]);
    // Un focus passé ne compte pas : pas de pause longue.
    expect(r.timer).toMatchObject({
      phase: "short_break",
      startedAt: T0 + 10 * MIN,
      focusCount: 3,
    });
  });

  it("passer une pause revient à l'arrêt, prêt pour un focus", () => {
    const t = fullFocus(initialTimer(), T0).timer;
    const r = skip(t, T0 + 26 * MIN);
    expect(r.sessions[0]).toMatchObject({ type: "short_break", completed: false });
    expect(r.timer).toMatchObject({ phase: "idle", next: "focus" });
  });

  it("passer une pause longue clôt le cycle", () => {
    const t: TimerState = { ...initialTimer(), phase: "long_break", startedAt: T0, focusCount: 4 };
    expect(skip(t, T0 + MIN).timer.focusCount).toBe(0);
  });

  it("passer à l'arrêt ne fait rien", () => {
    const t = initialTimer();
    expect(skip(t, T0)).toEqual({ timer: t, sessions: [] });
  });

  it("passer un focus suspendu compte la suspension jusqu'à maintenant", () => {
    let t = start(initialTimer(), T0);
    t = pause(t, T0 + 5 * MIN);
    expect(skip(t, T0 + 15 * MIN).sessions[0]!.pausedMs).toBe(10 * MIN);
  });

  it("réinitialiser interrompt la phase et revient à l'arrêt", () => {
    const t = start(initialTimer(), T0);
    const r = reset(t, T0 + 3 * MIN);
    expect(r.sessions[0]).toMatchObject({ type: "focus", completed: false });
    expect(r.timer).toMatchObject({
      phase: "idle",
      next: "focus",
      startedAt: null,
      pausedAt: null,
    });
  });

  it("réinitialiser à l'arrêt n'enregistre rien", () => {
    expect(reset(initialTimer(), T0).sessions).toHaveLength(0);
  });
});
