import { describe, expect, it } from "vitest";
import {
  createEmptyData,
  defaultSettings,
  migrate,
  parseDataFile,
  SCHEMA_VERSION,
  serialize,
} from "./schema";

const T0 = Date.UTC(2026, 9, 5, 8, 0);

describe("schéma", () => {
  it("un fichier vide neuf se relit à l'identique", () => {
    const d = createEmptyData("mac-a", T0);
    expect(parseDataFile(serialize(d))).toEqual({ ok: true, data: d });
  });

  it("complète les réglages manquants par défaut", () => {
    const d = JSON.parse(serialize(createEmptyData("mac-a", T0)));
    delete d.settings.soundVolume;
    d.settings.focusMinutes = 50;
    const r = parseDataFile(JSON.stringify(d));
    expect(r.ok && r.data.settings).toEqual({ ...defaultSettings(), focusMinutes: 50 });
  });

  it("ramène un réglage hors limites à sa valeur par défaut", () => {
    const d = JSON.parse(serialize(createEmptyData("mac-a", T0)));
    d.settings.focusMinutes = -3;
    d.settings.soundVolume = 7;
    const r = parseDataFile(JSON.stringify(d));
    expect(r.ok && [r.data.settings.focusMinutes, r.data.settings.soundVolume]).toEqual([25, 1]);
  });

  it("un minuteur illisible repart à l'arrêt sans bloquer le fichier", () => {
    const d = JSON.parse(serialize(createEmptyData("mac-a", T0)));
    d.timer = { phase: "focus", startedAt: "pas un nombre" };
    const r = parseDataFile(JSON.stringify(d));
    expect(r.ok && r.data.timer.phase).toBe("idle");
  });

  it("refuse les tâches en double", () => {
    const d = createEmptyData("mac-a", T0);
    const t = {
      id: "a",
      title: "A",
      size: "S",
      priority: false,
      status: "todo",
      createdAt: d.updatedAt,
      pomodorosSpent: 0,
      order: 0,
      updatedAt: d.updatedAt,
    };
    const r = parseDataFile(JSON.stringify({ ...d, tasks: [t, t] }));
    expect(r).toMatchObject({ ok: false, reason: "invalid_shape" });
  });

  it("refuse une tâche terminée sans date de fin", () => {
    const d = createEmptyData("mac-a", T0);
    const t = {
      id: "a",
      title: "A",
      size: "S",
      priority: false,
      status: "done",
      createdAt: d.updatedAt,
      pomodorosSpent: 1,
      order: 0,
    };
    expect(parseDataFile(JSON.stringify({ ...d, tasks: [t] }))).toMatchObject({
      ok: false,
      detail: "tasks[0].completedAt",
    });
  });

  it("refuse un fichier sans version", () => {
    expect(() => migrate({ tasks: [] })).toThrow();
    expect(parseDataFile("{}")).toMatchObject({ ok: false, reason: "invalid_shape" });
  });

  it("signale un fichier d'une version future", () => {
    expect(parseDataFile(JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1 }))).toMatchObject({
      ok: false,
      reason: "too_new",
    });
  });

  it("signale un JSON illisible", () => {
    expect(parseDataFile("{")).toMatchObject({ ok: false, reason: "invalid_json" });
  });
});
