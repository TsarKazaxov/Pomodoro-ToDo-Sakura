import { describe, expect, it } from "vitest";
import { addDays, dayKeyAt, dayKeyOf, daysBetween, toLocalIso, weekdayMon0 } from "./time";

// vite.config.ts fixe TZ=Europe/Paris pour ces tests.
describe("horodatages locaux", () => {
  it("écrit l'heure locale et son décalage", () => {
    expect(toLocalIso(Date.UTC(2026, 9, 5, 12, 3, 4, 5))).toBe("2026-10-05T14:03:04.005+02:00");
    expect(toLocalIso(Date.UTC(2026, 11, 31, 23, 30))).toBe("2027-01-01T00:30:00.000+01:00");
  });

  it("reste un instant exact une fois relu", () => {
    const ms = Date.UTC(2026, 2, 29, 0, 59, 59, 999);
    expect(new Date(toLocalIso(ms)).getTime()).toBe(ms);
  });

  it("le jour est celui de l'heure locale, pas de l'UTC", () => {
    expect(dayKeyAt(Date.UTC(2026, 9, 5, 22, 30))).toBe("2026-10-06");
  });

  it("refuse un horodatage illisible", () => {
    expect(() => dayKeyOf("hier")).toThrow();
  });
});

describe("arithmétique des jours", () => {
  it("ajoute des jours à travers les mois et les changements d'heure", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("compte les jours entre deux dates", () => {
    expect(daysBetween("2026-10-01", "2026-10-31")).toBe(30);
    expect(daysBetween("2026-10-31", "2026-10-01")).toBe(-30);
  });

  it("lundi = 0, dimanche = 6", () => {
    expect(weekdayMon0("2026-10-05")).toBe(0);
    expect(weekdayMon0("2026-10-11")).toBe(6);
  });
});
