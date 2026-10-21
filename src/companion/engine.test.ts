import { describe, expect, it } from "vitest";
import {
  BUBBLE_COOLDOWN_MS,
  initialCompanion,
  isBlinking,
  poseOf,
  SLEEP_AFTER_MS,
  step,
  SUPER_AFTER_MS,
  type CompanionEvent,
  type CompanionState,
  type Tick,
} from "./engine";
import { clipText, fill, grade, LINES } from "./lines";

const T0 = Date.UTC(2026, 9, 18, 8, 0);
const MIN = 60_000;

function tick(over: Partial<Tick> = {}): Tick {
  return {
    now: T0,
    phase: "idle",
    paused: false,
    overtime: false,
    idleMs: 1_000,
    hour: 10,
    day: "2026-10-18",
    pomodorosToday: 0,
    ...over,
  };
}

/** Rejoue `seconds` secondes ; `at(s)` donne le tick de la seconde s. */
function run(
  s: CompanionState,
  from: number,
  seconds: number,
  at: (now: number) => Partial<Tick>,
  events: (now: number) => CompanionEvent[] = () => [],
) {
  for (let i = 0; i < seconds; i++) {
    const now = from + i * 1000;
    s = step(s, tick({ now, ...at(now) }), events(now));
  }
  return s;
}

describe("Rai : humeur", () => {
  it("minuteur arrêté : pose de base, il cligne des yeux de temps en temps", () => {
    const s = step(initialCompanion(T0, "2026-10-18"), tick());
    expect(s.mood).toBe("idle");
    expect(poseOf(s, T0 + 5_000)).toBe("base");
    expect(isBlinking(T0 + 9_000 * 4 + 500)).toBe(true);
  });

  it("focus lancé : il se met au travail, sans rien dire", () => {
    const s = step(initialCompanion(T0, "2026-10-18"), tick({ phase: "focus" }));
    expect(poseOf(s, T0)).toBe("focus");
    expect(s.bubble).toBeNull();
  });

  it("3 min sans clavier ni souris pendant un focus : il s'endort, puis sursaute à ton retour", () => {
    let s = initialCompanion(T0, "2026-10-18");
    s = run(s, T0, 200, (now) => ({ phase: "focus", idleMs: now - T0 }));
    expect(s.asleep).toBe(true);
    expect(poseOf(s, T0 + 200_000)).toBe("dodo");
    expect(s.naps).toBe(1);
    const back = T0 + 260_000;
    s = step(s, tick({ now: back, phase: "focus", idleMs: 500 }));
    expect(s.asleep).toBe(false);
    expect(poseOf(s, back)).toBe("sursaut");
    expect(s.bubble).toBeNull(); // tu reprends le travail : pas de bavardage
    expect(poseOf(s, back + 3_000)).toBe("focus");
  });

  it("pas de sommeil hors focus ni quand le minuteur est suspendu", () => {
    let s = initialCompanion(T0, "2026-10-18");
    s = run(s, T0, 5, () => ({ phase: "focus", paused: true, idleMs: SLEEP_AFTER_MS * 2 }));
    expect(s.asleep).toBe(false);
    expect(poseOf(s, T0 + 5_000)).toBe("attente");
  });

  it("10 min de focus sans décrocher : transformation puis forme super", () => {
    let s = initialCompanion(T0, "2026-10-18");
    s = run(s, T0, SUPER_AFTER_MS / 1000 + 2, () => ({ phase: "focus", idleMs: 2_000 }));
    expect(s.superOn).toBe(true);
    expect(s.transforms).toBe(1);
    const now = T0 + SUPER_AFTER_MS + 1_000;
    expect(poseOf(s, now)).toBe("transfo");
    expect(poseOf(s, now + 2_000)).toBe("super");
    expect(s.bubble).toBeNull(); // en plein focus : la transformation se voit, elle ne s'entend pas
  });

  it("une pause de 2 min dans l'activité remet la série à zéro", () => {
    let s = initialCompanion(T0, "2026-10-18");
    s = run(s, T0, 300, () => ({ phase: "focus", idleMs: 1_000 }));
    s = run(s, T0 + 300_000, 130, (now) => ({ phase: "focus", idleMs: now - (T0 + 300_000) }));
    s = run(s, T0 + 430_000, 400, () => ({ phase: "focus", idleMs: 1_000 }));
    expect(s.superOn).toBe(false);
  });

  it("prolongation : forme super immédiate, en silence", () => {
    const s = step(initialCompanion(T0, "2026-10-18"), tick({ phase: "focus", overtime: true }));
    expect(s.superOn).toBe(true);
    expect(s.bubble).toBeNull();
  });

  it("pause : onigiri, sans réplique (la fin du focus vient de l'annoncer)", () => {
    const s = step(initialCompanion(T0, "2026-10-18"), tick({ phase: "break" }));
    expect(poseOf(s, T0)).toBe("pause");
    expect(s.bubble).toBeNull();
  });

  it("minuteur arrêté longtemps : il attend, mais ne te le reproche jamais", () => {
    let s = initialCompanion(T0, "2026-10-18");
    s = run(s, T0, 40 * 60, () => ({}));
    expect(s.mood).toBe("impatient");
    expect(poseOf(s, T0 + 40 * MIN)).toBe("attente");
    expect(s.bubble).toBeNull();
    expect(s.variants).toEqual({});
  });

  it("aucune réplique pendant tout un focus sans événement", () => {
    let s = initialCompanion(T0, "2026-10-18");
    // 25 min : activité, puis 4 min sans clavier (sommeil), retour, forme super.
    s = run(s, T0, 25 * 60, (now) => ({
      phase: "focus",
      idleMs: now - T0 > 5 * MIN && now - T0 < 9 * MIN ? now - T0 - 5 * MIN : 1_000,
    }));
    expect(s.naps).toBe(1);
    expect(s.transforms).toBe(1);
    expect(s.variants).toEqual({});
  });
});

describe("Rai : réactions et répliques", () => {
  it("tâche cochée : saut de victoire, réplique même juste après une autre", () => {
    let s = step(initialCompanion(T0, "2026-10-18"), tick({ phase: "focus" }));
    s = step(s, tick({ now: T0 + 1000, phase: "focus" }), [{ type: "taskDone" }]);
    expect(poseOf(s, T0 + 1500)).toBe("victoire");
    expect(s.bubble?.reaction).toBe("taskDone");
  });

  it("balade et esquive : il file, sans rien dire", () => {
    let s = step(initialCompanion(T0, "2026-10-18"), tick({ phase: "break" }), [
      { type: "wander" },
    ]);
    expect(poseOf(s, T0 + 100)).toBe("esquive");
    expect(s.bubble).toBeNull();
    s = step(s, tick({ now: T0 + 1000, phase: "focus" }), [{ type: "linger" }]);
    expect(s.bubble).toBeNull();
  });

  it("tâches cochées en rafale : une réplique, puis les pétales seuls pendant 3 min", () => {
    let s = step(initialCompanion(T0, "2026-10-18"), tick(), [{ type: "taskDone" }]);
    expect(s.bubble?.reaction).toBe("taskDone");
    const first = s.bubble!.since;
    s = step(s, tick({ now: T0 + 60_000 }), [{ type: "taskDone" }]);
    expect(poseOf(s, T0 + 60_500)).toBe("victoire");
    expect(s.bubble?.since ?? first).toBe(first);
    s = step(s, tick({ now: T0 + BUBBLE_COOLDOWN_MS + 1000 }), [{ type: "taskDone" }]);
    expect(s.bubble?.since).toBe(T0 + BUBBLE_COOLDOWN_MS + 1000);
  });

  it("fin de focus, fin de pause et clic sur lui : toujours une réplique", () => {
    let s = step(initialCompanion(T0, "2026-10-18"), tick({ phase: "focus" }), [
      { type: "taskDone" },
    ]);
    for (const [i, type] of (["focusEnd", "breakEnd", "poke"] as const).entries()) {
      s = step(s, tick({ now: T0 + (i + 1) * 1000 }), [{ type }]);
      expect(s.bubble?.reaction).toBe(type);
    }
  });

  it("les variantes tournent", () => {
    let s = initialCompanion(T0, "2026-10-18");
    const seen = new Set<number>();
    for (let i = 0; i < LINES.poke.length; i++) {
      s = step(s, tick({ now: T0 + i * 10_000 }), [{ type: "poke" }]);
      seen.add(s.bubble!.variant);
    }
    expect(seen.size).toBe(LINES.poke.length);
  });

  it("bulletin du soir : une fois par jour, avec les chiffres du jour", () => {
    let s = initialCompanion(T0, "2026-10-18");
    s = { ...s, naps: 2, transforms: 1 };
    s = step(s, tick({ hour: 18, pomodorosToday: 6 }));
    expect(poseOf(s, T0)).toBe("bulletin");
    expect(s.bubble?.vars).toEqual({ p: 6, n: 2, t: 1 });
    const again = step(s, tick({ now: T0 + 20_000, hour: 19, pomodorosToday: 6 }));
    expect(again.reportDay).toBe("2026-10-18");
    expect(poseOf(again, T0 + 20_000)).not.toBe("bulletin");
  });

  it("pas de bulletin en plein focus", () => {
    const s = step(initialCompanion(T0, "2026-10-18"), tick({ hour: 18, phase: "focus" }));
    expect(s.reportDay).toBeNull();
  });

  it("nouveau jour : compteurs remis à zéro", () => {
    let s = { ...initialCompanion(T0, "2026-10-18"), naps: 3 };
    s = step(s, tick({ day: "2026-10-19" }));
    expect(s.naps).toBe(0);
  });

  it("chaque réplique existe dans les cinq langues, avec ses variables", () => {
    for (const [r, lines] of Object.entries(LINES))
      for (const l of lines) {
        const vars = (t: string) => (t.match(/\{\w\}/g) ?? []).sort().join();
        for (const k of ["ja", "romaji", "fr", "en", "es", "ru"] as const) {
          expect(l[k], r).toBeTruthy();
          expect(vars(l[k]), `${r} ${k}`).toBe(vars(l.fr));
        }
      }
  });

  it("clip du bulletin : le titre seul, sans chiffres", () => {
    expect(clipText("report", LINES.report[0]!, "es")).toBe("¡El boletín de hoy!");
    expect(clipText("focusEnd", LINES.focusEnd[1]!, "ru")).toBe("Отлично. Перерыв.");
  });

  it("appréciation et gabarit du bulletin", () => {
    expect(grade(6, 2)).toMatchObject({ g: 16 });
    expect(grade(0, 5).g).toBe(1);
    expect(fill(LINES.report[0]!.fr, { p: 6, n: 2, g: 16, c: "pas mal du tout." })).toBe(
      "6 pomodoros, 2 siestes. 16/20 : pas mal du tout.",
    );
  });
});
