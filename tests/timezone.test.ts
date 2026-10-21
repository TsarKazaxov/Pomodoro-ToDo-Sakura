// Phase 6 : changement de fuseau (voyage, ou Mac réglé autrement). Les jours déjà enregistrés
// ne bougent pas (D-007) ; les nouveaux suivent l'heure locale du moment.

import { afterEach, describe, expect, it } from "vitest";
import { createEmptyData } from "../src/core/schema";
import { buildDayMap, streak } from "../src/core/stats";
import { addTask, setStatus } from "../src/core/tasks";
import { dayKeyAt } from "../src/core/time";
import { advance, durationsFrom, initialTimer, remainingMs, start } from "../src/core/timer";

const original = process.env.TZ;
afterEach(() => {
  process.env.TZ = original;
});

describe("changement de fuseau", () => {
  it("une tâche cochée à Paris reste sur son jour une fois à Tokyo", () => {
    process.env.TZ = "Europe/Paris";
    const at = Date.UTC(2026, 9, 5, 21, 30); // 23:30 à Paris, le 5
    const d = createEmptyData("mac", at);
    d.tasks = addTask([], { title: "Tard le soir", size: "M" }, at, "t");
    d.tasks = setStatus(d.tasks, "t", "done", at);
    expect(dayKeyAt(at)).toBe("2026-10-05");

    process.env.TZ = "Asia/Tokyo"; // 06:30 le 6 à Tokyo
    expect(dayKeyAt(at)).toBe("2026-10-06");
    const days = buildDayMap(d.tasks, d.sessions, d.settings.scale);
    expect([...days.keys()]).toEqual(["2026-10-05"]);
    expect(streak(days, dayKeyAt(at))).toBe(1); // hier encore actif : la série tient
  });

  it("un focus lancé avant de changer de fuseau garde sa durée exacte", () => {
    process.env.TZ = "Europe/Paris";
    const t0 = Date.UTC(2026, 9, 5, 8, 0);
    const d = durationsFrom(createEmptyData("mac", t0).settings);
    const t = start(initialTimer(), t0);
    process.env.TZ = "America/New_York";
    expect(remainingMs(t, d, t0 + 10 * 60_000)).toBe(15 * 60_000);
    expect(advance(t, d, t0 + 25 * 60_000).sessions[0]!.endedAt).toBe(t0 + 25 * 60_000);
  });

  it("passage à l'heure d'hiver pendant un focus : 25 vraies minutes", () => {
    process.env.TZ = "Europe/Paris";
    const t0 = Date.UTC(2026, 9, 25, 0, 50); // 02:50 heure d'été, 10 min avant le recul
    const d = durationsFrom(createEmptyData("mac", t0).settings);
    const r = advance(start(initialTimer(), t0), d, t0 + 25 * 60_000);
    expect(r.sessions[0]!.endedAt - r.sessions[0]!.startedAt).toBe(25 * 60_000);
  });
});
