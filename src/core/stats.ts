// Calculs de l'activité : points par jour, niveaux de heatmap, calibration, série, taux.
// Fonctions pures ; aucune ne lit l'horloge, le jour courant est toujours passé en argument.

import { addDays, dayKeyOf, daysBetween, weekdayMon0, type DayKey } from "./time";
import { SIZES, type Scale, type Session, type Size, type Task } from "./types";

export interface DayStats {
  points: number;
  /** Ids des tâches terminées ce jour-là. */
  taskIds: string[];
  /** Focus terminés. */
  pomodoros: number;
  /** Focus interrompus. */
  interrupted: number;
}

export type DayMap = Map<DayKey, DayStats>;

const emptyDay = (): DayStats => ({ points: 0, taskIds: [], pomodoros: 0, interrupted: 0 });

/** Agrège tâches terminées et sessions de focus par jour local. */
export function buildDayMap(
  tasks: readonly Task[],
  sessions: readonly Session[],
  scale: Scale,
): DayMap {
  const m: DayMap = new Map();
  const get = (k: DayKey) => {
    let d = m.get(k);
    if (!d) m.set(k, (d = emptyDay()));
    return d;
  };
  for (const t of tasks) {
    if (t.status !== "done" || !t.completedAt) continue;
    const d = get(dayKeyOf(t.completedAt));
    d.points += scale[t.size].points;
    d.taskIds.push(t.id);
  }
  for (const s of sessions) {
    if (s.type !== "focus") continue;
    const d = get(dayKeyOf(s.endedAt));
    if (s.completed) d.pomodoros++;
    else d.interrupted++;
  }
  return m;
}

// ---------- heatmap ----------

/**
 * Bornes hautes des niveaux 1 à 3 ; au-delà de la troisième, niveau 4.
 * Par défaut : 0 | 1–2 | 3–5 | 6–9 | 10+ (brief §2).
 */
export type Thresholds = readonly [number, number, number];
export const DEFAULT_THRESHOLDS: Thresholds = [2, 5, 9];
/** Jours actifs nécessaires avant de recalculer les seuils sur les quartiles. */
export const QUARTILE_MIN_DAYS = 30;

export function heatLevel(points: number, th: Thresholds = DEFAULT_THRESHOLDS): 0 | 1 | 2 | 3 | 4 {
  if (points <= 0) return 0;
  if (points <= th[0]) return 1;
  if (points <= th[1]) return 2;
  if (points <= th[2]) return 3;
  return 4;
}

/** Quantile par interpolation linéaire sur un tableau trié. */
function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo] ?? 0;
  const b = sorted[hi] ?? a;
  return a + (b - a) * (pos - lo);
}

/**
 * Seuils tirés des quartiles des jours à points > 0, dès 30 jours de données.
 * Les bornes sont arrondies et strictement croissantes pour que les 4 niveaux restent distincts.
 */
export function adaptiveThresholds(days: DayMap): Thresholds {
  const pts = [...days.values()]
    .map((d) => d.points)
    .filter((p) => p > 0)
    .sort((a, b) => a - b);
  if (pts.length < QUARTILE_MIN_DAYS) return DEFAULT_THRESHOLDS;
  const q1 = Math.max(1, Math.round(quantile(pts, 0.25)));
  const q2 = Math.max(q1 + 1, Math.round(quantile(pts, 0.5)));
  const q3 = Math.max(q2 + 1, Math.round(quantile(pts, 0.75)));
  return [q1, q2, q3];
}

/**
 * Jours d'une grille de `weeks` colonnes (lundi en haut), colonne la plus à droite = semaine
 * de `today`. Les jours après `today` valent `null`.
 */
export function heatGrid(today: DayKey, weeks: number): (DayKey | null)[] {
  const start = addDays(today, -weekdayMon0(today) - (weeks - 1) * 7);
  const out: (DayKey | null)[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const k = addDays(start, i);
    out.push(daysBetween(today, k) > 0 ? null : k);
  }
  return out;
}

// ---------- calibration ----------

export type Verdict = "overestimate" | "accurate" | "underestimate";

export interface Calibration {
  size: Size;
  /** Tâches prises en compte (terminées, au moins un pomodoro ; D-008). */
  count: number;
  expected: number;
  /** Moyenne réelle ; `null` si aucune tâche. */
  average: number | null;
  /** Réel ÷ attendu ; `null` tant que `count < minCount`. */
  ratio: number | null;
  verdict: Verdict | null;
}

export const CALIBRATION_MIN_COUNT = 5;

export function verdictOf(ratio: number): Verdict {
  if (ratio < 0.8) return "overestimate";
  if (ratio > 1.2) return "underestimate";
  return "accurate";
}

export function calibration(
  tasks: readonly Task[],
  scale: Scale,
  minCount = CALIBRATION_MIN_COUNT,
): Calibration[] {
  return SIZES.map((size) => {
    const done = tasks.filter(
      (t) => t.size === size && t.status === "done" && t.pomodorosSpent >= 1,
    );
    const expected = scale[size].expectedPomodoros;
    const average = done.length
      ? done.reduce((a, t) => a + t.pomodorosSpent, 0) / done.length
      : null;
    const enough = done.length >= minCount && average !== null;
    const ratio = enough ? average / expected : null;
    return {
      size,
      count: done.length,
      expected,
      average,
      ratio,
      verdict: ratio === null ? null : verdictOf(ratio),
    };
  });
}

// ---------- indicateurs ----------

const isActive = (d: DayStats | undefined) => !!d && (d.points > 0 || d.pomodoros > 0);

/**
 * Jours actifs consécutifs jusqu'à aujourd'hui. Un jour actif = au moins une tâche terminée ou un
 * focus terminé. Si aujourd'hui n'est pas encore actif, la série court jusqu'à hier : elle ne se
 * brise qu'une fois la journée passée.
 */
export function streak(days: DayMap, today: DayKey): number {
  let k = isActive(days.get(today)) ? today : addDays(today, -1);
  let n = 0;
  while (isActive(days.get(k))) {
    n++;
    k = addDays(k, -1);
  }
  return n;
}

/** Moyenne de points par jour sur les `n` derniers jours, aujourd'hui compris. */
export function averagePoints(days: DayMap, today: DayKey, n = 7): number {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += days.get(addDays(today, -i))?.points ?? 0;
  return sum / n;
}

/** Part des focus terminés sur les `n` derniers jours ; `null` sans aucun focus. */
export function completionRate(days: DayMap, today: DayKey, n = 30): number | null {
  let done = 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const d = days.get(addDays(today, -i));
    if (!d) continue;
    done += d.pomodoros;
    total += d.pomodoros + d.interrupted;
  }
  return total ? done / total : null;
}

/** Conseil de découpage : taille XL, ou plus de pomodoros passés que prévu pour une XL. */
export function shouldSplit(task: Task, scale: Scale): boolean {
  return task.size === "XL" || task.pomodorosSpent > scale.XL.expectedPomodoros;
}
