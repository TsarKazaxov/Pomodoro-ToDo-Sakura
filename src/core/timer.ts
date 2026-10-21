// Moteur du minuteur Pomodoro, sans effet de bord.
//
// Règle d'or (brief §5) : le temps restant se calcule depuis `startedAt`, `pausedMs` et
// l'heure courante. Aucun compteur n'est incrémenté, donc une veille du Mac de deux heures
// ne fausse rien : au réveil, `advance` rejoue les fins de phase à leur heure exacte.
//
// Enchaînement (D-016) : fin de focus → la pause démarre seule ; fin de pause → on attend.
//
// Prolongation (D-042) : si tu travailles encore quand le focus arrive à son terme, il se
// prolonge et continue de compter. La pause démarre quand tu t'arrêtes (2 min sans clavier ni
// souris), à l'heure de ta dernière activité ; ou tout de suite si tu cliques « Faire la pause ».

import type { PhaseType, Settings, TimerState } from "./types";

export interface Durations {
  focusMs: number;
  shortBreakMs: number;
  longBreakMs: number;
  focusesBeforeLongBreak: number;
}

/** Activité au clavier ou à la souris, mesurée par macOS (toutes apps confondues). */
export interface Activity {
  /** Dernière frappe ou mouvement, en ms epoch ; `null` si inconnue. */
  lastInputAt: number | null;
  /** Réglage « Continuer le focus si je travaille encore ». */
  extend: boolean;
}

/** Activité dans les 30 s avant la fin du focus : tu es en train de travailler. */
export const ACTIVE_WINDOW_MS = 30_000;
/** La fin du focus doit être toute récente : après une veille, pas de prolongation. */
export const END_SLACK_MS = 5_000;
/** 2 min sans activité : tu t'es arrêté, la pause démarre (à l'heure de ta dernière activité). */
export const IDLE_END_MS = 2 * 60_000;
/** Pas de rafraîchissement de `lastActiveAt` : borne le temps compté après une veille. */
export const ACTIVE_REFRESH_MS = 30_000;

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
    overtimeAt: null,
    lastActiveAt: null,
  };
}

export function phaseDuration(phase: PhaseType, d: Durations): number {
  return phase === "focus" ? d.focusMs : phase === "short_break" ? d.shortBreakMs : d.longBreakMs;
}

export const isIdle = (t: TimerState) => t.phase === "idle";
export const isPaused = (t: TimerState) => t.phase !== "idle" && t.pausedAt !== null;
export const isRunning = (t: TimerState) => t.phase !== "idle" && t.pausedAt === null;
export const isOvertime = (t: TimerState) => t.phase === "focus" && t.overtimeAt !== null;

export function elapsedMs(t: TimerState, now: number): number {
  if (t.phase === "idle" || t.startedAt === null) return 0;
  const end = t.pausedAt ?? now;
  return Math.max(0, end - t.startedAt - t.pausedMs);
}

/** Temps de focus au-delà de la durée prévue (0 hors prolongation). */
export function overtimeMs(t: TimerState, d: Durations, now: number): number {
  return isOvertime(t) ? Math.max(0, elapsedMs(t, now) - d.focusMs) : 0;
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
  return {
    ...t,
    phase,
    startedAt: at,
    pausedAt: null,
    pausedMs: 0,
    overtimeAt: null,
    lastActiveAt: null,
  };
}

function stop(t: TimerState): TimerState {
  return {
    ...t,
    phase: "idle",
    next: "focus",
    startedAt: null,
    pausedAt: null,
    pausedMs: 0,
    overtimeAt: null,
    lastActiveAt: null,
  };
}

/** Focus terminé à `at` (prévu ou prolongé) : session complète, puis la pause démarre. */
function completeFocus(t: TimerState, at: number, d: Durations): Transition {
  const session: SessionDraft = {
    type: "focus",
    startedAt: t.startedAt ?? at,
    endedAt: at,
    completed: true,
    pausedMs: t.pausedMs,
  };
  const focusCount = t.focusCount + 1;
  return {
    timer: begin({ ...t, focusCount }, breakAfter(focusCount, d), at),
    sessions: [session],
  };
}

/** « Faire la pause » pendant une prolongation : le focus s'arrête maintenant. */
export function endOvertime(t: TimerState, d: Durations, now: number): Transition {
  return isOvertime(t) ? completeFocus(t, now, d) : { timer: t, sessions: [] };
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
 * Avec `act`, un focus qui se termine pendant que tu travailles se prolonge (D-042).
 */
export function advance(t: TimerState, d: Durations, now: number, act?: Activity): Transition {
  const sessions: SessionDraft[] = [];
  let cur = t;
  while (isRunning(cur) && cur.startedAt !== null && cur.phase !== "idle") {
    if (cur.overtimeAt !== null) {
      // Dernière activité, bornée par le dernier rafraîchissement : après une veille ou une
      // app fermée, l'activité au réveil ne prolonge pas le focus rétroactivement.
      const last =
        act?.extend && act.lastInputAt !== null
          ? Math.min(act.lastInputAt, (cur.lastActiveAt ?? cur.overtimeAt) + ACTIVE_REFRESH_MS)
          : null;
      if (last !== null && now - last < IDLE_END_MS) {
        if (last - (cur.lastActiveAt ?? cur.overtimeAt) >= ACTIVE_REFRESH_MS)
          cur = { ...cur, lastActiveAt: last };
        break;
      }
      const tr = completeFocus(cur, last === null ? now : Math.max(cur.overtimeAt, last), d);
      sessions.push(...tr.sessions);
      cur = tr.timer;
      continue;
    }
    const dur = phaseDuration(cur.phase, d);
    const endAt = cur.startedAt + cur.pausedMs + dur;
    if (endAt > now) break;
    if (
      cur.phase === "focus" &&
      act?.extend &&
      act.lastInputAt !== null &&
      now - endAt <= END_SLACK_MS &&
      now - act.lastInputAt <= ACTIVE_WINDOW_MS
    ) {
      cur = { ...cur, overtimeAt: endAt, lastActiveAt: Math.max(endAt, act.lastInputAt) };
      break;
    }
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
export function skip(t: TimerState, now: number, d?: Durations): Transition {
  // En prolongation, le focus est déjà complet : « Passer » lance la pause.
  if (isOvertime(t) && d) return endOvertime(t, d, now);
  const s = interrupted(t, now);
  if (!s) return { timer: t, sessions: [] };
  const timer = t.phase === "focus" ? begin(t, "short_break", now) : endBreak(t);
  return { timer, sessions: [s] };
}

/** « Réinitialiser » : interrompt la phase en cours et revient à l'arrêt, prêt pour un focus. */
export function reset(t: TimerState, now: number): Transition {
  if (isOvertime(t) && t.startedAt !== null) {
    const done: SessionDraft = {
      type: "focus",
      startedAt: t.startedAt,
      endedAt: now,
      completed: true,
      pausedMs: t.pausedMs,
    };
    return { timer: stop({ ...t, focusCount: t.focusCount + 1 }), sessions: [done] };
  }
  const s = interrupted(t, now);
  return { timer: stop(t), sessions: s ? [s] : [] };
}
