import { describe, expect, it } from "vitest";
import { DEFAULT_SCALE } from "./schema";
import {
  adaptiveThresholds,
  averagePoints,
  buildDayMap,
  calibration,
  completionRate,
  DEFAULT_THRESHOLDS,
  heatGrid,
  heatLevel,
  shouldSplit,
  streak,
  verdictOf,
  type DayMap,
  type DayStats,
} from "./stats";
import type { Session, Size, Task } from "./types";

let seq = 0;
function task(
  size: Size,
  completedAt?: string,
  pomodoros = 0,
  status: Task["status"] = completedAt ? "done" : "todo",
): Task {
  const t: Task = {
    id: `t${++seq}`,
    title: "Tâche",
    size,
    priority: false,
    status,
    createdAt: "2026-09-01T09:00:00.000+02:00",
    pomodorosSpent: pomodoros,
    order: seq,
    updatedAt: "2026-09-01T09:00:00.000+02:00",
  };
  if (completedAt) t.completedAt = completedAt;
  return t;
}
function focus(endedAt: string, completed = true): Session {
  return { id: `s${++seq}`, type: "focus", startedAt: endedAt, endedAt, completed, pausedMs: 0 };
}
const day = (points: number, pomodoros = 0, interrupted = 0): DayStats => ({
  points,
  taskIds: [],
  pomodoros,
  interrupted,
});

describe("points par jour", () => {
  it("additionne les points des tâches terminées, pas leur nombre", () => {
    const m = buildDayMap(
      [
        task("XL", "2026-10-05T10:00:00.000+02:00"),
        task("XS", "2026-10-05T11:00:00.000+02:00"),
        task("M"),
      ],
      [],
      DEFAULT_SCALE,
    );
    expect(m.get("2026-10-05")).toMatchObject({ points: 9, taskIds: ["t1", "t2"] });
  });

  it("compte les focus terminés et interrompus, ignore les pauses", () => {
    const s = [
      focus("2026-10-05T10:25:00.000+02:00"),
      focus("2026-10-05T11:10:00.000+02:00", false),
    ];
    s.push({ ...s[0]!, id: "b", type: "short_break" });
    expect(buildDayMap([], s, DEFAULT_SCALE).get("2026-10-05")).toMatchObject({
      pomodoros: 1,
      interrupted: 1,
      points: 0,
    });
  });

  it("une tâche abandonnée ne rapporte rien", () => {
    const t = task("L", "2026-10-05T10:00:00.000+02:00", 3, "dropped");
    expect(buildDayMap([t], [], DEFAULT_SCALE).size).toBe(0);
  });

  it("suit le barème des réglages", () => {
    const scale = { ...DEFAULT_SCALE, M: { points: 10, expectedPomodoros: 4 } };
    expect(
      buildDayMap([task("M", "2026-10-05T10:00:00.000+02:00")], [], scale).get("2026-10-05")!
        .points,
    ).toBe(10);
  });

  it("range une tâche dans son jour local, même vue depuis un autre fuseau (D-007)", () => {
    // Cochée à 23:30 à Tokyo : c'est le 5 octobre là-bas, le 5 à 16:30 à Paris, mais 14:30 UTC.
    const m = buildDayMap([task("S", "2026-10-05T23:30:00.000+09:00")], [], DEFAULT_SCALE);
    expect([...m.keys()]).toEqual(["2026-10-05"]);
  });
});

describe("niveaux de heatmap", () => {
  it.each([
    [0, 0],
    [1, 1],
    [2, 1],
    [3, 2],
    [5, 2],
    [6, 3],
    [9, 3],
    [10, 4],
    [40, 4],
  ])("%i points → niveau %i", (p, lv) => {
    expect(heatLevel(p)).toBe(lv);
  });

  it("garde les seuils par défaut avant 30 jours de données", () => {
    const m: DayMap = new Map(
      Array.from({ length: 29 }, (_, i) => [`2026-09-${String(i + 1).padStart(2, "0")}`, day(20)]),
    );
    expect(adaptiveThresholds(m)).toEqual(DEFAULT_THRESHOLDS);
  });

  it("recalcule les seuils sur les quartiles après 30 jours", () => {
    const m: DayMap = new Map();
    for (let i = 0; i < 40; i++) m.set(`k${i}`, day(i + 1)); // 1 … 40
    m.set("vide", day(0)); // les jours à 0 point sont ignorés
    expect(adaptiveThresholds(m)).toEqual([11, 21, 30]);
  });

  it("garde des seuils strictement croissants même si tous les jours se ressemblent", () => {
    const m: DayMap = new Map(Array.from({ length: 35 }, (_, i) => [`k${i}`, day(3)]));
    const th = adaptiveThresholds(m);
    expect(th[0]).toBeLessThan(th[1]);
    expect(th[1]).toBeLessThan(th[2]);
  });
});

describe("grille de heatmap", () => {
  it("a 7 lignes par semaine, lundi en premier, aujourd'hui dans la dernière colonne", () => {
    const g = heatGrid("2026-10-07", 12); // un mercredi
    expect(g).toHaveLength(84);
    expect(g[0]).toBe("2026-07-20"); // lundi, 11 semaines plus tôt
    expect(g[77]).toBe("2026-10-05"); // lundi de la semaine courante
    expect(g[79]).toBe("2026-10-07");
    expect(g.slice(80)).toEqual([null, null, null, null]);
  });

  it("traverse le passage à l'heure d'hiver sans sauter de jour", () => {
    const g = heatGrid("2026-11-01", 2).filter((k): k is string => k !== null);
    expect(g).toContain("2026-10-25");
    expect(g).toContain("2026-10-26");
    expect(new Set(g).size).toBe(g.length);
  });
});

describe("calibration", () => {
  const done = (size: Size, pomodoros: number[]) =>
    pomodoros.map((p) => task(size, "2026-10-01T10:00:00.000+02:00", p));

  it("n'affiche rien sous 5 tâches terminées", () => {
    const c = calibration(done("M", [4, 4, 4, 4]), DEFAULT_SCALE).find((x) => x.size === "M")!;
    expect(c).toMatchObject({ count: 4, ratio: null, verdict: null });
  });

  it("compare les pomodoros réels moyens aux attendus", () => {
    const c = calibration(done("M", [5, 6, 6, 5, 6]), DEFAULT_SCALE).find((x) => x.size === "M")!;
    expect(c.average).toBeCloseTo(5.6);
    expect(c.ratio).toBeCloseTo(1.4);
    expect(c.verdict).toBe("underestimate");
  });

  it("détecte la surestimation", () => {
    const c = calibration(done("L", [5, 6, 5, 6, 5]), DEFAULT_SCALE).find((x) => x.size === "L")!;
    expect(c.verdict).toBe("overestimate");
  });

  it.each([
    [0.79, "overestimate"],
    [0.8, "accurate"],
    [1.2, "accurate"],
    [1.21, "underestimate"],
  ] as const)("ratio %f → %s", (r, v) => expect(verdictOf(r)).toBe(v));

  it("ignore les tâches sans pomodoro et les abandonnées (D-008)", () => {
    const tasks = [
      ...done("S", [2, 2, 2, 2]),
      task("S", "2026-10-01T10:00:00.000+02:00", 0),
      task("S", undefined, 9, "dropped"),
    ];
    expect(calibration(tasks, DEFAULT_SCALE).find((x) => x.size === "S")!.count).toBe(4);
  });

  it("utilise 12 comme attendu pour XL", () => {
    const c = calibration(done("XL", [12, 12, 12, 12, 12]), DEFAULT_SCALE).find(
      (x) => x.size === "XL",
    )!;
    expect(c).toMatchObject({ expected: 12, ratio: 1, verdict: "accurate" });
  });
});

describe("indicateurs", () => {
  const m: DayMap = new Map([
    ["2026-10-01", day(3, 2)],
    ["2026-10-02", day(0, 3)], // focus sans tâche terminée : jour actif
    ["2026-10-03", day(5, 4, 2)],
    ["2026-10-04", day(2, 1)],
  ]);

  it("compte la série de jours actifs jusqu'à hier si aujourd'hui est encore vide", () => {
    expect(streak(m, "2026-10-05")).toBe(4);
  });

  it("inclut aujourd'hui dès qu'il est actif", () => {
    expect(streak(new Map([...m, ["2026-10-05", day(1, 1)]]), "2026-10-05")).toBe(5);
  });

  it("une journée vide passée casse la série", () => {
    expect(streak(m, "2026-10-06")).toBe(0);
  });

  it("moyenne des points sur 7 jours, aujourd'hui compris", () => {
    expect(averagePoints(m, "2026-10-04")).toBeCloseTo(10 / 7);
  });

  it("taux de focus terminés", () => {
    expect(completionRate(m, "2026-10-04")).toBeCloseTo(10 / 12);
    expect(completionRate(new Map(), "2026-10-04")).toBeNull();
  });

  it("conseille de découper une XL", () => {
    expect(shouldSplit(task("XL"), DEFAULT_SCALE)).toBe(true);
    expect(shouldSplit(task("M", undefined, 13), DEFAULT_SCALE)).toBe(true);
    expect(shouldSplit(task("M", undefined, 4), DEFAULT_SCALE)).toBe(false);
  });
});
