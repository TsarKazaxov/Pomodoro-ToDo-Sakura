// Phase 5, étape 19 : deux instances de Sakura sur le même fichier (deux Mac via iCloud, ou
// iCloud qui remplace le fichier), sur le vrai disque.

import { mkdtemp, rm, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyData } from "../src/core/schema";
import { addTask } from "../src/core/tasks";
import { DATA_FILE, DataStore } from "../src/storage/dataStore";
import { nodeFs } from "./nodeFs";

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
let dir: string;
let macA: DataStore;
let macB: DataStore;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "sakura-"));
  macA = new DataStore(nodeFs, dir);
  macB = new DataStore(nodeFs, dir);
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const withTask = (device: string, title: string) => {
  const d = createEmptyData(device, Date.now());
  d.tasks = addTask([], { title, size: "S" }, Date.now());
  return d;
};

describe("deux Mac, un fichier", () => {
  it("le Mac B voit ce que le Mac A a écrit", async () => {
    await macA.load();
    await macA.save(withTask("A", "Écrite sur A"));
    const r = await macB.load();
    expect(r.kind === "ok" && r.data.tasks[0]!.title).toBe("Écrite sur A");
  });

  it("A détecte l'écriture de B et ne l'écrase pas avant de l'avoir relue (D-014)", async () => {
    await macA.load();
    await macA.save(withTask("A", "Version A"));
    await macB.load();
    await pause(20);
    await macB.save(withTask("B", "Version B"));
    expect(await macA.hasExternalChange()).toBe(true);
    expect(await macA.save(withTask("A", "A écrase ?"))).toEqual({ kind: "stale" });
    const r = await macA.load();
    expect(r.kind === "ok" && r.data.tasks[0]!.title).toBe("Version B");
    expect(await macA.save(withTask("A", "Après relecture"))).toEqual({ kind: "saved" });
  });

  it("un fichier remplacé par iCloud avec une date plus ancienne est aussi détecté", async () => {
    await macA.load();
    await macA.save(withTask("A", "Locale"));
    await pause(20);
    await nodeFs.writeAtomic(join(dir, DATA_FILE), JSON.stringify(withTask("B", "Venue d'iCloud")));
    const old = new Date(Date.now() - 3600_000);
    await utimes(join(dir, DATA_FILE), old, old);
    expect(await macA.hasExternalChange()).toBe(true);
  });

  it("aucun fichier temporaire ne traîne après les écritures", async () => {
    await macA.load();
    for (let i = 0; i < 5; i++) await macA.save(withTask("A", `v${i}`));
    const names = await nodeFs.listDir(dir);
    expect(names.filter((n) => n.endsWith(".tmp"))).toEqual([]);
  });
});
