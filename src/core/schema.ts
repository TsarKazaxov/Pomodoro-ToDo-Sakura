// Fichier de données : valeurs par défaut, validation, migrations de version.
//
// Une lecture ne « répare » jamais en silence une tâche ou une session illisible : on refuse le
// fichier et on propose la dernière sauvegarde (brief §4, fichier corrompu). Seuls les réglages
// manquants sont complétés par défaut, ce qui permet d'ajouter des réglages sans migration.

import { initialTimer } from "./timer";
import { toLocalIso } from "./time";
import {
  CORNERS,
  PHASE_TYPES,
  SIZES,
  TASK_STATUSES,
  THEMES,
  type DataFile,
  type Scale,
  type Session,
  type Settings,
  type Task,
  type TimerState,
} from "./types";

export const SCHEMA_VERSION = 1;

export const DEFAULT_SCALE: Scale = {
  XS: { points: 1, expectedPomodoros: 1 },
  S: { points: 2, expectedPomodoros: 2 },
  M: { points: 3, expectedPomodoros: 4 },
  L: { points: 5, expectedPomodoros: 8 },
  XL: { points: 8, expectedPomodoros: 12 },
};

export function defaultSettings(): Settings {
  return {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    focusesBeforeLongBreak: 4,
    scale: structuredClone(DEFAULT_SCALE),
    corner: "top-right",
    soundEnabled: true,
    soundVolume: 0.6,
    theme: "auto",
    launchAtLogin: true,
    dataDir: null,
    onboarded: false,
  };
}

export function createEmptyData(deviceId: string, now: number): DataFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    deviceId,
    updatedAt: toLocalIso(now),
    tasks: [],
    sessions: [],
    settings: defaultSettings(),
    timer: initialTimer(),
  };
}

export function serialize(data: DataFile): string {
  return JSON.stringify(data, null, 2) + "\n";
}

// ---------- lecture ----------

export type ParseResult =
  | { ok: true; data: DataFile }
  | { ok: false; reason: "invalid_json" | "invalid_shape" | "too_new"; detail: string };

class ShapeError extends Error {}

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isIso = (v: unknown): v is string => isStr(v) && /^\d{4}-\d{2}-\d{2}T/.test(v);
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  isStr(v) && (list as readonly string[]).includes(v);

function fail(where: string): never {
  throw new ShapeError(where);
}

function readTask(v: unknown, i: number): Task {
  const at = `tasks[${i}]`;
  if (!isObj(v)) fail(at);
  const {
    id,
    title,
    size,
    priority,
    status,
    createdAt,
    completedAt,
    pomodorosSpent,
    order,
    updatedAt,
  } = v;
  if (!isStr(id) || !id) fail(`${at}.id`);
  if (!isStr(title)) fail(`${at}.title`);
  if (!oneOf(SIZES, size)) fail(`${at}.size`);
  if (!oneOf(TASK_STATUSES, status)) fail(`${at}.status`);
  if (!isIso(createdAt)) fail(`${at}.createdAt`);
  if (completedAt !== undefined && !isIso(completedAt)) fail(`${at}.completedAt`);
  if (status === "done" && completedAt === undefined) fail(`${at}.completedAt`);
  if (!isNum(pomodorosSpent) || pomodorosSpent < 0) fail(`${at}.pomodorosSpent`);
  if (!isNum(order)) fail(`${at}.order`);
  const task: Task = {
    id,
    title,
    size,
    priority: priority === true,
    status,
    createdAt,
    pomodorosSpent: Math.floor(pomodorosSpent),
    order,
    updatedAt: isIso(updatedAt) ? updatedAt : createdAt,
  };
  if (status === "done" && isIso(completedAt)) task.completedAt = completedAt;
  return task;
}

function readSession(v: unknown, i: number): Session {
  const at = `sessions[${i}]`;
  if (!isObj(v)) fail(at);
  const { id, type, taskId, startedAt, endedAt, completed, pausedMs } = v;
  if (!isStr(id) || !id) fail(`${at}.id`);
  if (!oneOf(PHASE_TYPES, type)) fail(`${at}.type`);
  if (taskId !== undefined && !isStr(taskId)) fail(`${at}.taskId`);
  if (!isIso(startedAt)) fail(`${at}.startedAt`);
  if (!isIso(endedAt)) fail(`${at}.endedAt`);
  if (typeof completed !== "boolean") fail(`${at}.completed`);
  const s: Session = {
    id,
    type,
    startedAt,
    endedAt,
    completed,
    pausedMs: isNum(pausedMs) ? pausedMs : 0,
  };
  if (isStr(taskId)) s.taskId = taskId;
  return s;
}

const posInt = (v: unknown, def: number, max: number) =>
  isNum(v) && v >= 1 && v <= max ? Math.round(v) : def;

function readSettings(v: unknown): Settings {
  const d = defaultSettings();
  if (!isObj(v)) return d;
  const scale = structuredClone(DEFAULT_SCALE);
  if (isObj(v.scale)) {
    for (const size of SIZES) {
      const e = v.scale[size];
      if (isObj(e)) {
        scale[size] = {
          points: posInt(e.points, scale[size].points, 100),
          expectedPomodoros: posInt(e.expectedPomodoros, scale[size].expectedPomodoros, 100),
        };
      }
    }
  }
  return {
    focusMinutes: posInt(v.focusMinutes, d.focusMinutes, 180),
    shortBreakMinutes: posInt(v.shortBreakMinutes, d.shortBreakMinutes, 60),
    longBreakMinutes: posInt(v.longBreakMinutes, d.longBreakMinutes, 120),
    focusesBeforeLongBreak: posInt(v.focusesBeforeLongBreak, d.focusesBeforeLongBreak, 12),
    scale,
    corner: oneOf(CORNERS, v.corner) ? v.corner : d.corner,
    soundEnabled: typeof v.soundEnabled === "boolean" ? v.soundEnabled : d.soundEnabled,
    soundVolume: isNum(v.soundVolume) ? Math.min(1, Math.max(0, v.soundVolume)) : d.soundVolume,
    theme: oneOf(THEMES, v.theme) ? v.theme : d.theme,
    launchAtLogin: typeof v.launchAtLogin === "boolean" ? v.launchAtLogin : d.launchAtLogin,
    dataDir: isStr(v.dataDir) && v.dataDir ? v.dataDir : null,
    onboarded: v.onboarded === true,
  };
}

/** Un minuteur illisible n'empêche pas d'ouvrir le fichier : on repart à l'arrêt. */
function readTimer(v: unknown): TimerState {
  const t = initialTimer();
  if (!isObj(v)) return t;
  const phase = v.phase === "idle" || oneOf(PHASE_TYPES, v.phase) ? v.phase : null;
  if (phase === null) return t;
  const next = oneOf(PHASE_TYPES, v.next) ? v.next : "focus";
  const focusCount = isNum(v.focusCount) && v.focusCount >= 0 ? Math.floor(v.focusCount) : 0;
  if (phase === "idle") return { ...t, next, focusCount };
  if (!isNum(v.startedAt)) return t;
  return {
    phase,
    next,
    startedAt: v.startedAt,
    pausedAt: isNum(v.pausedAt) ? v.pausedAt : null,
    pausedMs: isNum(v.pausedMs) && v.pausedMs >= 0 ? v.pausedMs : 0,
    focusCount,
  };
}

/**
 * Migrations : `MIGRATIONS[n]` transforme un fichier de version n en version n + 1.
 * Aucune pour l'instant ; la version 1 est la première publiée.
 */
const MIGRATIONS: Record<number, (raw: Raw) => Raw> = {};

export function migrate(raw: Raw): Raw {
  let cur = raw;
  const version = cur.schemaVersion;
  if (!isNum(version) || version < 1) throw new ShapeError("schemaVersion");
  let v = version;
  while (v < SCHEMA_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new ShapeError(`migration ${v} → ${v + 1} manquante`);
    cur = { ...step(cur), schemaVersion: v + 1 };
    v = v + 1;
  }
  return cur;
}

export function parseDataFile(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, reason: "invalid_json", detail: (e as Error).message };
  }
  try {
    if (!isObj(raw)) fail("racine");
    if (isNum(raw.schemaVersion) && raw.schemaVersion > SCHEMA_VERSION) {
      return {
        ok: false,
        reason: "too_new",
        detail: `version ${raw.schemaVersion}, cette app lit jusqu'à ${SCHEMA_VERSION}`,
      };
    }
    const m = migrate(raw);
    if (!Array.isArray(m.tasks)) fail("tasks");
    if (!Array.isArray(m.sessions)) fail("sessions");
    const tasks = m.tasks.map(readTask);
    const ids = new Set<string>();
    for (const t of tasks) {
      if (ids.has(t.id)) fail(`tâche en double ${t.id}`);
      ids.add(t.id);
    }
    const data: DataFile = {
      schemaVersion: SCHEMA_VERSION,
      deviceId: isStr(m.deviceId) ? m.deviceId : "",
      updatedAt: isIso(m.updatedAt) ? m.updatedAt : toLocalIso(0),
      tasks,
      sessions: m.sessions.map(readSession),
      settings: readSettings(m.settings),
      timer: readTimer(m.timer),
    };
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ShapeError) return { ok: false, reason: "invalid_shape", detail: e.message };
    throw e;
  }
}
