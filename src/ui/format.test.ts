import { describe, expect, it } from "vitest";
import { formatClock, formatDayKey, plural } from "./format";
import { displayedProgress, ensoGeometry } from "./ensoPath";

describe("formatage", () => {
  it("affiche le temps restant arrondi à la seconde supérieure", () => {
    expect(formatClock(25 * 60_000)).toBe("25:00");
    expect(formatClock(59_001)).toBe("01:00");
    expect(formatClock(999)).toBe("00:01");
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(-5)).toBe("00:00");
  });
  it("écrit les jours en français", () => {
    expect(formatDayKey("2026-10-05")).toBe("Lundi 5 octobre");
  });
  it("accorde au pluriel", () => {
    expect(plural(1, "point", "points")).toBe("1 point");
    expect(plural(3, "point", "points")).toBe("3 points");
  });
});

describe("ensō", () => {
  it("même graine → même tracé, mis en cache", () => {
    expect(ensoGeometry(11)).toBe(ensoGeometry(11));
    expect(ensoGeometry(11).brush).not.toBe(ensoGeometry(5).brush);
  });
  it("avance par paliers de 1/12 en mouvement réduit", () => {
    expect(displayedProgress(0.5, false)).toBe(0.5);
    expect(displayedProgress(0.16, true)).toBeCloseTo(1 / 12);
    expect(displayedProgress(1, true)).toBe(1);
    expect(displayedProgress(1.4, false)).toBe(1);
  });
});
