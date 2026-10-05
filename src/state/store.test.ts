import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { serialize, createEmptyData } from "../core/schema";
import { DATA_FILE, DataStore } from "../storage/dataStore";
import { MemoryFs } from "../storage/memoryFs";
import {
  __resetStore,
  checkExternalChange,
  flush,
  initOwner,
  onReward,
  useSakura,
  type ClientMessage,
  type Reward,
  type Snapshot,
  type Transport,
} from "./store";

const DIR = "/data";
const last = <T>(a: T[]) => a[a.length - 1];
const T0 = Date.UTC(2026, 9, 5, 8, 0);

class FakeTransport implements Transport {
  states: Snapshot[] = [];
  rewards: Reward[] = [];
  actionCb?: (m: ClientMessage) => void;
  helloCb?: () => void;
  sendAction() {}
  onAction(cb: (m: ClientMessage) => void) {
    this.actionCb = cb;
  }
  broadcastState(s: Snapshot) {
    this.states.push(s);
  }
  onState() {}
  broadcastReward(r: Reward) {
    this.rewards.push(r);
  }
  onReward() {}
  requestState() {}
  onRequestState(cb: () => void) {
    this.helloCb = cb;
  }
}

let fs: MemoryFs;
let tr: FakeTransport;
let now: number;
let stop: () => void;
const chimes: number[] = [];
const rains: number[] = [];

async function boot() {
  stop = await initOwner({
    transport: tr,
    label: "widget",
    disk: new DataStore(fs, DIR, () => now),
    deviceId: "mac-a",
    now: () => now,
    hooks: { playChime: (n) => chimes.push(n), screenRain: (tier) => rains.push(tier) },
  });
}
const dispatch = (a: Parameters<ReturnType<typeof useSakura.getState>["dispatch"]>[0]) =>
  useSakura.getState().dispatch(a);
const mainFile = () => fs.files.get(`${DIR}/${DATA_FILE}`)!.text;
const ids = () => useSakura.getState().data!.tasks.map((t) => t.id);

beforeEach(() => {
  vi.useFakeTimers();
  __resetStore();
  fs = new MemoryFs();
  tr = new FakeTransport();
  now = T0;
  chimes.length = 0;
  rains.length = 0;
});
afterEach(() => {
  stop?.();
  vi.useRealTimers();
});

describe("fenêtre propriétaire", () => {
  it("crée le fichier au premier lancement et diffuse l'état", async () => {
    await boot();
    expect(useSakura.getState().status).toBe("ready");
    expect(fs.files.has(`${DIR}/${DATA_FILE}`)).toBe(true);
    expect(last(tr.states)?.status).toBe("ready");
  });

  it("applique une action, diffuse, puis écrit après 300 ms", async () => {
    await boot();
    dispatch({ type: "task/quickAdd", raw: "Audit #M", priority: true });
    expect(last(tr.states)?.data?.tasks).toHaveLength(1);
    expect(mainFile()).not.toContain("Audit");
    await vi.advanceTimersByTimeAsync(300);
    expect(mainFile()).toContain("Audit");
  });

  it("regroupe plusieurs actions rapprochées en une écriture", async () => {
    await boot();
    await vi.advanceTimersByTimeAsync(1000);
    const before = fs.files.get(`${DIR}/${DATA_FILE}`)!.mtime;
    for (let i = 0; i < 5; i++) dispatch({ type: "task/quickAdd", raw: `T${i}`, priority: false });
    await vi.advanceTimersByTimeAsync(300);
    // mtime de MemoryFs = compteur d'écritures : sauvegarde du jour + une seule écriture des données.
    expect(fs.files.get(`${DIR}/${DATA_FILE}`)!.mtime - before).toBe(2);
    expect(mainFile()).toContain("T4");
  });

  it("applique les actions envoyées par la fenêtre principale", async () => {
    await boot();
    tr.actionCb!({
      kind: "action",
      action: { type: "task/quickAdd", raw: "Depuis main", priority: false },
      origin: "main",
    });
    expect(useSakura.getState().data!.tasks[0]!.title).toBe("Depuis main");
  });

  it("répond à une fenêtre qui s'ouvre avec l'état courant", async () => {
    await boot();
    const n = tr.states.length;
    tr.helloCb!();
    expect(tr.states).toHaveLength(n + 1);
  });

  it("série de tâches : paliers, son, pluie hors fenêtre dès le 3e (D-019, D-027)", async () => {
    await boot();
    for (let i = 0; i < 4; i++)
      dispatch({ type: "task/quickAdd", raw: `T${i} #XS`, priority: true });
    const seen: Reward[] = [];
    onReward((r) => seen.push(r));
    for (const id of ids()) {
      dispatch({ type: "task/setStatus", id, status: "done" });
      now += 60_000;
    }
    expect(seen.map((r) => r.kind === "task" && r.tier)).toEqual([1, 2, 3, 4]);
    expect(seen[0]).toMatchObject({ points: 1, origin: "widget" });
    expect(tr.rewards).toHaveLength(4);
    expect(chimes).toEqual([1, 2, 3, 4]);
    expect(rains).toEqual([3, 4]);
  });

  it("fin de focus détectée par le tick : pomodoro compté et récompense", async () => {
    await boot();
    dispatch({ type: "task/quickAdd", raw: "Audit #M", priority: true });
    dispatch({ type: "task/setCurrent", id: ids()[0]! });
    dispatch({ type: "timer/toggle" });
    now += 25 * 60_000;
    await vi.advanceTimersByTimeAsync(1000);
    expect(useSakura.getState().data!.tasks[0]!.pomodorosSpent).toBe(1);
    expect(last(tr.rewards)).toEqual({ kind: "focus", breakMinutes: 5, taskTitle: "Audit" });
  });

  it("le son respecte le réglage", async () => {
    await boot();
    dispatch({ type: "settings/update", patch: { soundEnabled: false } });
    dispatch({ type: "task/quickAdd", raw: "A", priority: false });
    dispatch({ type: "task/setStatus", id: ids()[0]!, status: "done" });
    expect(chimes).toEqual([]);
  });

  it("recharge une modification faite par un autre Mac", async () => {
    await boot();
    await flush();
    const other = createEmptyData("mac-b", now);
    other.tasks = [
      {
        id: "x",
        title: "Depuis l'autre Mac",
        size: "S",
        priority: false,
        status: "todo",
        createdAt: other.updatedAt,
        pomodorosSpent: 0,
        order: 0,
        updatedAt: other.updatedAt,
      },
    ];
    fs.externalWrite(`${DIR}/${DATA_FILE}`, serialize(other));
    expect(await checkExternalChange()).toBe(true);
    expect(ids()).toEqual(["x"]);
  });

  it("n'écrase pas un fichier corrompu : expose les sauvegardes", async () => {
    await fs.mkdirp(DIR);
    fs.externalWrite(`${DIR}/${DATA_FILE}`, "{oups");
    await boot();
    expect(useSakura.getState().status).toBe("corrupt");
    dispatch({ type: "task/quickAdd", raw: "A", priority: false });
    await vi.advanceTimersByTimeAsync(500);
    expect(fs.files.get(`${DIR}/${DATA_FILE}`)!.text).toBe("{oups");
  });
});
