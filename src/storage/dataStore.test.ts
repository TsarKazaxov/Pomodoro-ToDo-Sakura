import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyData, parseDataFile, SCHEMA_VERSION, serialize } from "../core/schema";
import { addTask, setStatus } from "../core/tasks";
import { DATA_FILE, DataStore, KEEP_BACKUPS } from "./dataStore";
import { MemoryFs } from "./memoryFs";

const DIR = "/Users/anton/Library/Mobile Documents/com~apple~CloudDocs/Sakura";
const FILE = `${DIR}/${DATA_FILE}`;
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 5, 8, 0);

let fs: MemoryFs;
let now: number;
let store: DataStore;

beforeEach(() => {
  fs = new MemoryFs();
  now = T0;
  store = new DataStore(fs, DIR, () => now);
});

const sample = () => {
  const d = createEmptyData("mac-a", now);
  d.tasks = addTask([], { title: "Audit de l'onboarding", size: "M" }, now, "t1");
  return d;
};

describe("premier lancement", () => {
  it("signale un fichier absent", async () => {
    expect(await store.load()).toEqual({ kind: "missing" });
  });

  it("crée le dossier et le fichier à la première écriture", async () => {
    await store.load();
    expect(await store.save(sample())).toEqual({ kind: "saved" });
    const r = await store.load();
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.data.tasks[0]!.title).toBe("Audit de l'onboarding");
  });

  it("attend un fichier encore dans iCloud plutôt que de le croire absent", async () => {
    await fs.mkdirp(DIR);
    fs.externalWrite(`${DIR}/.${DATA_FILE}.icloud`, "");
    expect(await store.load()).toEqual({ kind: "icloud_pending" });
  });
});

describe("aller-retour", () => {
  it("relit exactement ce qui a été écrit", async () => {
    const d = sample();
    d.tasks = setStatus(d.tasks, "t1", "done", now);
    d.sessions = [
      {
        id: "s1",
        type: "focus",
        taskId: "t1",
        startedAt: d.updatedAt,
        endedAt: d.updatedAt,
        completed: true,
        pausedMs: 0,
      },
    ];
    d.timer = {
      phase: "focus",
      next: "focus",
      startedAt: now,
      pausedAt: null,
      pausedMs: 0,
      focusCount: 2,
    };
    await store.save(d);
    const r = parseDataFile(fs.files.get(FILE)!.text);
    expect(r).toEqual({ ok: true, data: d });
  });

  it("supporte 1 000 tâches", async () => {
    const d = sample();
    for (let i = 0; i < 1000; i++)
      d.tasks = addTask(d.tasks, { title: `Tâche ${i}`, size: "S" }, now, `x${i}`);
    await store.save(d);
    const r = await store.load();
    expect(r.kind === "ok" && r.data.tasks.length).toBe(1001);
  });
});

describe("fichier corrompu", () => {
  it("JSON illisible : propose les sauvegardes", async () => {
    await store.save(sample());
    now += DAY;
    await store.save(sample()); // crée la sauvegarde du jour
    fs.externalWrite(FILE, '{"schemaVersion": 1, "tasks": [');
    const r = await store.load();
    expect(r).toMatchObject({
      kind: "corrupt",
      reason: "invalid_json",
      backups: ["sakura-data-2026-10-06.json"],
    });
  });

  it("forme invalide : indique où", async () => {
    await fs.mkdirp(DIR);
    const d = JSON.parse(serialize(sample()));
    d.tasks[0].size = "XXL";
    fs.externalWrite(FILE, JSON.stringify(d));
    expect(await store.load()).toMatchObject({
      kind: "corrupt",
      reason: "invalid_shape",
      detail: "tasks[0].size",
    });
  });

  it("restaure une sauvegarde", async () => {
    await store.save(sample());
    now += DAY;
    await store.save(sample());
    fs.externalWrite(FILE, "corrompu");
    const r = await store.restoreBackup("sakura-data-2026-10-06.json");
    expect(r.kind).toBe("ok");
    expect((await store.load()).kind).toBe("ok");
  });

  it("refuse un nom de sauvegarde qui sort du dossier", async () => {
    await expect(store.restoreBackup("../sakura-data.json")).rejects.toThrow();
  });

  it("un fichier d'une version plus récente n'est pas écrasé", async () => {
    await fs.mkdirp(DIR);
    fs.externalWrite(FILE, JSON.stringify({ ...sample(), schemaVersion: SCHEMA_VERSION + 1 }));
    expect((await store.load()).kind).toBe("too_new");
  });
});

describe("sauvegardes quotidiennes", () => {
  it("copie la version de la veille avant la première écriture du jour", async () => {
    const d = sample();
    await store.save(d);
    expect(await store.listBackups()).toEqual([]); // rien à sauvegarder avant la première écriture
    now += DAY;
    const d2 = { ...d, tasks: [] };
    await store.save(d2);
    const backup = fs.files.get(`${DIR}/backups/sakura-data-2026-10-06.json`)!.text;
    expect(parseDataFile(backup)).toMatchObject({ ok: true, data: { tasks: [{ id: "t1" }] } });
  });

  it("une seule sauvegarde par jour", async () => {
    await store.save(sample());
    now += DAY;
    await store.save(sample());
    await store.save(sample());
    expect(await store.listBackups()).toHaveLength(1);
  });

  it(`garde les ${KEEP_BACKUPS} plus récentes`, async () => {
    await store.save(sample());
    for (let i = 0; i < 10; i++) {
      now += DAY;
      await store.save(sample());
    }
    const b = await store.listBackups();
    expect(b).toHaveLength(KEEP_BACKUPS);
    expect(b[0]).toBe("sakura-data-2026-10-15.json");
    expect(b[b.length - 1]).toBe("sakura-data-2026-10-09.json");
  });
});

describe("modification par un autre Mac (D-014)", () => {
  it("détecte le changement", async () => {
    await store.save(sample());
    expect(await store.hasExternalChange()).toBe(false);
    fs.externalWrite(FILE, serialize(sample()));
    expect(await store.hasExternalChange()).toBe(true);
  });

  it("refuse d'écraser un fichier modifié ailleurs tant qu'on ne l'a pas relu", async () => {
    await store.save(sample());
    fs.externalWrite(FILE, serialize({ ...sample(), deviceId: "mac-b" }));
    const writes = fs.writes;
    expect(await store.save(sample())).toEqual({ kind: "stale" });
    expect(fs.writes).toBe(writes);
    await store.load();
    expect(await store.save(sample())).toEqual({ kind: "saved" });
  });

  it("refuse aussi au démarrage si le fichier existe mais n'a jamais été lu", async () => {
    await fs.mkdirp(DIR);
    fs.externalWrite(FILE, serialize(sample()));
    expect(await store.save(sample())).toEqual({ kind: "stale" });
  });
});
