// Moteur du minuteur Pomodoro, sans effet de bord.
//
// Règle d'or (brief §5) : le temps restant se calcule depuis `startedAt`, `pausedMs` et
// l'heure courante. Aucun compteur n'est incrémenté, donc une veille du Mac de deux heures
// ne fausse rien : au réveil, `advance` rejoue les fins de phase à leur heure exacte.
//
// Enchaînement (D-016) : fin de focus → la pause démarre seule ; fin de pause → on attend.

import type { PhaseType, Settings, TimerState } from "./types";

export interface Durations {
  focusMs: number;
  shortBreakMs: number;
  longBreakMs: number;
  focusesBeforeLongBreak: number;
}

export function durationsFrom(s: Settings): Durations {
  return {
    focusMs: s.focusMinutes * 60_000,
    shortBreakMs: s.shortBreakMinutes * 60_000,
    longBreakMs: s.longBreakMinutes * 60_000,
    focusesBeforeLongBreak: s.focusesBeforeLongBreak,
  };
}

/** Une session à enregistrer ; le magasin y ajoute l'id et la tâche en cours. */
export interface SessionDraft {
  type: PhaseType;
  startedAt: number;
  endedAt: number;
  completed: boolean;
  pausedMs: number;
}

export interface Transition {
  timer: TimerState;
  sessions: SessionDraft[];
}

export function initialTimer(): TimerState {
  return {
    phase: "idle",
    next: "focus",
    startedAt: null,
    pausedAt: null,
    pausedMs: 0,
    focusCount: 0,
  };
}

export function phaseDuration(phase: PhaseType, d: Durations): number {
  return phase === "focus" ? d.focusMs : phase === "short_break" ? d.shortBreakMs : d.longBreakMs;
}

export const isIdle = (t: TimerState) => t.phase === "idle";
export const isPaused = (t: TimerState) => t.phase !== "idle" && t.pausedAt !== null;
export const isRunning = (t: TimerState) => t.phase !== "idle" && t.pausedAt === null;

export function elapsedMs(t: TimerState, now: number): number {
  if (t.phase === "idle" || t.startedAt === null) return 0;
  const end = t.pausedAt ?? now;
  return Math.max(0, end - t.startedAt - t.pausedMs);
}

export function remainingMs(t: TimerState, d: Durations, now: number): number {
  if (t.phase === "idle") return phaseDuration(t.next, d);
  return Math.max(0, phaseDuration(t.phase, d) - elapsedMs(t, now));
}

/** Avancement de la phase en cours, de 0 à 1 (0 à l'arrêt). */
export function progress(t: TimerState, d: Durations, now: number): number {
  if (t.phase === "idle") return 0;
  return Math.min(1, elapsedMs(t, now) / phaseDuration(t.phase, d));
}

function begin(t: TimerState, phase: PhaseType, at: number): TimerState {
  return { ...t, phase, startedAt: at, pausedAt: null, pausedMs: 0 };
}

function stop(t: TimerState): TimerState {
  return { ...t, phase: "idle", next: "focus", startedAt: null, pausedAt: null, pausedMs: 0 };
}

/** Fin d'une pause, terminée ou passée. Une pause longue clôt le cycle. */
function endBreak(t: TimerState): TimerState {
  return stop(t.phase === "long_break" ? { ...t, focusCount: 0 } : t);
}

function breakAfter(focusCount: number, d: Durations): PhaseType {
  return focusCount > 0 && focusCount % d.focusesBeforeLongBreak === 0
    ? "long_break"
    : "short_break";
}

/** Démarre la phase suivante, ou reprend si suspendu. Sans effet si déjà en marche. */
export function start(t: TimerState, now: number): TimerState {
  if (t.phase === "idle") return begin(t, t.next, now);
  if (t.pausedAt !== null)
    return { ...t, pausedMs: t.pausedMs + (now - t.pausedAt), pausedAt: null };
  return t;
}

export function pause(t: TimerState, now: number): TimerState {
  return isRunning(t) ? { ...t, pausedAt: now } : t;
}

export function toggle(t: TimerState, now: number): TimerState {
  return isRunning(t) ? pause(t, now) : start(t, now);
}

/**
 * Termine toutes les phases échues jusqu'à `now`, chacune à son heure de fin réelle.
 * À appeler à chaque tick et au réveil. Au plus deux fins (focus puis pause) par appel.
 */
export function advance(t: TimerState, d: Durations, now: number): Transition {
  const sessions: SessionDraft[] = [];
  let cur = t;
  while (isRunning(cur) && cur.startedAt !== null && cur.phase !== "idle") {
    const dur = phaseDuration(cur.phase, d);
    const endAt = cur.startedAt + cur.pausedMs + dur;
    if (endAt > now) break;
    sessions.push({
      type: cur.phase,
      startedAt: cur.startedAt,
      endedAt: endAt,
      completed: true,
      pausedMs: cur.pausedMs,
    });
    if (cur.phase === "focus") {
      const focusCount = cur.focusCount + 1;
      cur = begin({ ...cur, focusCount }, breakAfter(focusCount, d), endAt);
    } else {
      cur = endBreak(cur);
    }
  }
  return { timer: cur, sessions };
}

function interrupted(t: TimerState, now: number): SessionDraft | null {
  if (t.phase === "idle" || t.startedAt === null) return null;
  const pausedMs = t.pausedMs + (t.pausedAt !== null ? now - t.pausedAt : 0);
  return { type: t.phase, startedAt: t.startedAt, endedAt: now, completed: false, pausedMs };
}

/**
 * « Passer » : la phase en cours est enregistrée comme interrompue (D-016).
 * Un focus passé ne compte pas dans le cycle : il mène toujours à une pause courte.
 * À l'arrêt, ne fait rien.
 */
export function skip(t: TimerState, now: number): Transition {
  const s = interrupted(t, now);
  if (!s) return { timer: t, sessions: [] };
  const timer = t.phase === "focus" ? begin(t, "short_break", now) : endBreak(t);
  return { timer, sessions: [s] };
}

/** « Réinitialiser » : interrompt la phase en cours et revient à l'arrêt, prêt pour un focus. */
export function reset(t: TimerState, now: number): Transition {
  const s = interrupted(t, now);
  return { timer: stop(t), sessions: s ? [s] : [] };
}
