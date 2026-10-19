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
import { fill, grade, LINES } from "./lines";

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
    discreet: false,
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

  it("focus lancé : il se met au travail et le dit", () => {
    const s = step(initialCompanion(T0, "2026-10-18"), tick({ phase: "focus" }));
    expect(poseOf(s, T0)).toBe("focus");
    expect(s.bubble?.reaction).toBe("focus");
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
    expect(s.bubble?.reaction).toBe("wake");
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
    expect(s.bubble?.reaction).toBe("transform");
  });

  it("une pause de 2 min dans l'activité remet la série à zéro", () => {
    let s = initialCompanion(T0, "2026-10-18");
    s = run(s, T0, 300, () => ({ phase: "focus", idleMs: 1_000 }));
    s = run(s, T0 + 300_000, 130, (now) => ({ phase: "focus", idleMs: now - (T0 + 300_000) }));
    s = run(s, T0 + 430_000, 400, () => ({ phase: "focus", idleMs: 1_000 }));
    expect(s.superOn).toBe(false);
  });

  it("prolongation : forme super immédiate, avec sa réplique", () => {
    const s = step(initialCompanion(T0, "2026-10-18"), tick({ phase: "focus", overtime: true }));
    expect(s.superOn).toBe(true);
    expect(s.bubble?.reaction).toBe("super");
  });

  it("pause : onigiri", () => {
    const s = step(initialCompanion(T0, "2026-10-18"), tick({ phase: "break" }));
    expect(poseOf(s, T0)).toBe("pause");
    expect(s.bubble?.reaction).toBe("break");
  });

  it("minuteur arrêté depuis 2 min et tu es là : il s'impatiente, puis se tait 10 min", () => {
    let s = initialCompanion(T0, "2026-10-18");
    s = run(s, T0, 125, () => ({}));
    expect(s.mood).toBe("impatient");
    expect(s.bubble?.reaction).toBe("impatient");
    const said = s.lastImpatientAt;
    s = run(s, T0 + 125_000, 300, () => ({}));
    expect(s.lastImpatientAt).toBe(said);
  });

  it("après une pause qui s'éternise, la réplique change", () => {
    let s = initialCompanion(T0, "2026-10-18");
    s = step(s, tick({ phase: "break" }));
    // La réplique de pause vient d'être dite : celle-ci attend la fin du délai de 3 min.
    s = run(s, T0 + 1000, 200, () => ({ phase: "idle" }));
    expect(s.variants.longBreak).toBe(1);
    expect(s.variants.impatient).toBeUndefined();
  });

  it("absent : il ne parle pas dans le vide", () => {
    let s = initialCompanion(T0, "2026-10-18");
    s = run(s, T0, 200, () => ({ idleMs: 10 * MIN }));
    expect(s.mood).toBe("impatient");
    expect(s.bubble).toBeNull();
  });
});

describe("Rai : réactions et répliques", () => {
  it("tâche cochée : saut de victoire, réplique même juste après une autre", () => {
    let s = step(initialCompanion(T0, "2026-10-18"), tick({ phase: "focus" }));
    s = step(s, tick({ now: T0 + 1000, phase: "focus" }), [{ type: "taskDone" }]);
    expect(poseOf(s, T0 + 1500)).toBe("victoire");
    expect(s.bubble?.reaction).toBe("taskDone");
  });

  it("balade : il file, avec une réplique ordinaire", () => {
    const s = step(initialCompanion(T0, "2026-10-18"), tick({ phase: "break" }), [
      { type: "wander" },
    ]);
    expect(poseOf(s, T0 + 100)).toBe("esquive");
    // La réplique de pause vient d'être dite : celle de balade attend son tour.
    expect(s.bubble?.reaction).toBe("break");
  });

  it("une réplique ordinaire attend 3 min après la précédente", () => {
    let s = step(initialCompanion(T0, "2026-10-18"), tick({ phase: "focus" }));
    s = step(s, tick({ now: T0 + 30_000, phase: "break" }));
    expect(s.bubble).toBeNull(); // la réplique de pause est retenue
    s = step(s, tick({ now: T0 + BUBBLE_COOLDOWN_MS + 1000, phase: "focus" }));
    expect(s.bubble?.reaction).toBe("focus");
  });

  it("mode discret : rien pendant le focus, sauf la fin de session", () => {
    let s = step(initialCompanion(T0, "2026-10-18"), tick({ phase: "focus", discreet: true }));
    expect(s.bubble).toBeNull();
    s = step(s, tick({ now: T0 + 1000, phase: "focus", discreet: true }), [{ type: "taskDone" }]);
    expect(s.bubble).toBeNull();
    expect(poseOf(s, T0 + 1500)).toBe("victoire");
    s = step(s, tick({ now: T0 + 2000, phase: "focus", discreet: true }), [{ type: "focusEnd" }]);
    expect(s.bubble?.reaction).toBe("focusEnd");
  });

  it("les variantes tournent", () => {
    let s = initialCompanion(T0, "2026-10-18");
    const seen = new Set<number>();
    for (let i = 0; i < LINES.taskDone.length; i++) {
      s = step(s, tick({ now: T0 + i * 10_000 }), [{ type: "taskDone" }]);
      seen.add(s.bubble!.variant);
    }
    expect(seen.size).toBe(LINES.taskDone.length);
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

  it("chaque réplique existe dans les trois langues", () => {
    for (const [r, lines] of Object.entries(LINES))
      for (const l of lines)
        for (const k of ["ja", "romaji", "fr", "en"] as const) expect(l[k], r).toBeTruthy();
  });

  it("appréciation et gabarit du bulletin", () => {
    expect(grade(6, 2)).toMatchObject({ g: 16 });
    expect(grade(0, 5).g).toBe(1);
    expect(fill(LINES.report[0]!.fr, { p: 6, n: 2, g: 16, c: "pas mal du tout." })).toBe(
      "6 pomodoros, 2 siestes. 16/20 : pas mal du tout.",
    );
  });
});
