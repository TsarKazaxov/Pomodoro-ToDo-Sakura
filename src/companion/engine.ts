// Comportement de Rai (D-044), sans effet de bord : à chaque seconde, l'état du minuteur et ton
// activité donnent son humeur (pose continue) ; les événements (tâche cochée, fin de focus, clic…)
// déclenchent des réactions brèves.
//
// Parole (D-048) : il ne parle que lorsque c'est utile ou que tu l'as cherché — fin du focus, fin
// de la pause, tâche cochée, clic sur lui, bulletin du soir. Le reste (travail, sommeil, forme
// super, impatience, balade) se voit à sa pose, en silence : jamais de voix au milieu d'un focus.

import { LINES, type Reaction } from "./lines";

export type Pose =
  | "base"
  | "blink"
  | "attente"
  | "focus"
  | "transfo"
  | "super"
  | "dodo"
  | "sursaut"
  | "reveil"
  | "pause"
  | "victoire"
  | "esquive"
  | "bulletin";

export type Mood = "idle" | "impatient" | "paused" | "focus" | "super" | "sleep" | "break";

export type CompanionEvent =
  | { type: "taskDone" }
  | { type: "focusEnd" }
  | { type: "breakEnd" }
  | { type: "poke" }
  | { type: "linger" }
  | { type: "wander" };

export interface Tick {
  now: number;
  phase: "idle" | "focus" | "break";
  paused: boolean;
  overtime: boolean;
  /** Temps sans clavier ni souris ; `null` si inconnu. */
  idleMs: number | null;
  /** Heure locale (0–23) et jour local, pour le bulletin du soir. */
  hour: number;
  day: string;
  /** Pomodoros terminés aujourd'hui. */
  pomodorosToday: number;
}

export interface Bubble {
  reaction: Reaction;
  variant: number;
  since: number;
  until: number;
  vars?: Record<string, string | number>;
}

export interface CompanionState {
  mood: Mood;
  moodSince: number;
  /** Phase du minuteur au tick précédent. */
  lastPhase: Tick["phase"];
  /** Minuteur à l'arrêt depuis… */
  idleSince: number;
  /** Réaction brève en cours (pose imposée jusqu'à `until`). */
  act: { pose: Pose; until: number } | null;
  bubble: Bubble | null;
  lastBubbleAt: number;
  /** Début de l'activité continue pendant le focus (série vers la forme super). */
  activeSince: number | null;
  asleep: boolean;
  superOn: boolean;
  day: string;
  naps: number;
  transforms: number;
  reportDay: string | null;
  variants: Partial<Record<Reaction, number>>;
}

export const SLEEP_AFTER_MS = 3 * 60_000;
export const WAKE_UNDER_MS = 5_000;
/** Pause d'activité qui casse la série vers la forme super. */
export const STREAK_BREAK_MS = 2 * 60_000;
export const SUPER_AFTER_MS = 10 * 60_000;
export const IMPATIENT_AFTER_MS = 2 * 60_000;
/** Délai minimal entre deux répliques de tâche cochée (les pétales fêtent les suivantes). */
export const BUBBLE_COOLDOWN_MS = 3 * 60_000;
export const BUBBLE_MS = 5_000;
export const REPORT_HOUR = 18;

/** Réplique à chaque fois ; les autres (tâche cochée) attendent 3 min après la précédente. */
const ALWAYS: ReadonlySet<Reaction> = new Set(["focusEnd", "breakEnd", "poke", "report"]);

const ACTS: Record<CompanionEvent["type"], { pose: Pose; ms: number; reaction?: Reaction }> = {
  taskDone: { pose: "victoire", ms: 2_400, reaction: "taskDone" },
  focusEnd: { pose: "reveil", ms: 3_000, reaction: "focusEnd" },
  breakEnd: { pose: "reveil", ms: 2_500, reaction: "breakEnd" },
  poke: { pose: "sursaut", ms: 1_400, reaction: "poke" },
  linger: { pose: "esquive", ms: 800 },
  wander: { pose: "esquive", ms: 800 },
};

export function initialCompanion(now: number, day: string): CompanionState {
  return {
    mood: "idle",
    moodSince: now,
    lastPhase: "idle",
    idleSince: now,
    act: null,
    bubble: null,
    lastBubbleAt: -Infinity,
    activeSince: null,
    asleep: false,
    superOn: false,
    day,
    naps: 0,
    transforms: 0,
    reportDay: null,
    variants: {},
  };
}

function say(
  s: CompanionState,
  t: Tick,
  reaction: Reaction,
  vars?: Record<string, string | number>,
): CompanionState {
  if (!ALWAYS.has(reaction) && t.now - s.lastBubbleAt < BUBBLE_COOLDOWN_MS) return s;
  const n = LINES[reaction].length;
  const variant = (s.variants[reaction] ?? 0) % n;
  const ms = reaction === "report" ? 9_000 : BUBBLE_MS;
  return {
    ...s,
    bubble: { reaction, variant, since: t.now, until: t.now + ms, ...(vars ? { vars } : {}) },
    lastBubbleAt: t.now,
    variants: { ...s.variants, [reaction]: variant + 1 },
  };
}

/** Une seconde de la vie de Rai. */
export function step(prev: CompanionState, t: Tick, events: CompanionEvent[] = []): CompanionState {
  let s = prev;
  if (s.day !== t.day) s = { ...s, day: t.day, naps: 0, transforms: 0 };
  if (s.act && s.act.until <= t.now) s = { ...s, act: null };
  if (s.bubble && s.bubble.until <= t.now) s = { ...s, bubble: null };

  if (t.phase !== s.lastPhase && t.phase === "idle") s = { ...s, idleSince: t.now };
  const running = t.phase === "focus" && !t.paused;
  const idle = t.idleMs ?? 0;

  // Sommeil pendant un focus sans activité, réveil en sursaut quand tu reviens (en silence :
  // tu reprends le travail, ce n'est pas le moment de te parler).
  if (running && !s.asleep && t.idleMs !== null && idle >= SLEEP_AFTER_MS) {
    s = { ...s, asleep: true, naps: s.naps + 1 };
  } else if (s.asleep && (!running || idle < WAKE_UNDER_MS)) {
    s = { ...s, asleep: false };
    if (running) s = { ...s, act: { pose: "sursaut", until: t.now + 2_200 } };
  }

  // Série d'activité pendant le focus : au bout de 10 min, ou en prolongation, forme super.
  let activeSince = s.activeSince;
  if (!running || idle >= STREAK_BREAK_MS) activeSince = null;
  else if (activeSince === null) activeSince = t.now;
  const superOn =
    running &&
    !s.asleep &&
    (t.overtime || (activeSince !== null && t.now - activeSince >= SUPER_AFTER_MS));
  s = { ...s, activeSince };
  if (superOn && !s.superOn) {
    s = {
      ...s,
      superOn,
      transforms: s.transforms + 1,
      act: { pose: "transfo", until: t.now + 1_800 },
    };
  } else if (superOn !== s.superOn) s = { ...s, superOn };

  // Humeur de fond.
  const mood: Mood =
    t.phase === "break"
      ? "break"
      : t.phase === "focus"
        ? t.paused
          ? "paused"
          : s.asleep
            ? "sleep"
            : s.superOn
              ? "super"
              : "focus"
        : t.now - s.idleSince >= IMPATIENT_AFTER_MS
          ? "impatient"
          : "idle";
  if (mood !== s.mood) s = { ...s, mood, moodSince: t.now };

  // Événements.
  for (const e of events) {
    const a = ACTS[e.type];
    s = { ...s, act: { pose: a.pose, until: t.now + a.ms } };
    if (a.reaction) s = say(s, t, a.reaction);
  }

  // Bulletin du soir, une fois par jour, quand tu es là et pas en plein focus.
  if (t.hour >= REPORT_HOUR && s.reportDay !== t.day && t.phase !== "focus" && idle < 60_000) {
    s = { ...s, reportDay: t.day, act: { pose: "bulletin", until: t.now + 9_000 } };
    s = say(s, t, "report", { p: t.pomodorosToday, n: s.naps, t: s.transforms });
  }

  return { ...s, lastPhase: t.phase };
}

/** Clignement : 1,2 s toutes les 9 s, quand il ne fait rien d'autre. */
export const isBlinking = (now: number) => now % 9_000 < 1_200;

/** Pose affichée. */
export function poseOf(s: CompanionState, now: number): Pose {
  if (s.act && s.act.until > now) return s.act.pose;
  switch (s.mood) {
    case "focus":
      return "focus";
    case "super":
      return "super";
    case "sleep":
      return "dodo";
    case "break":
      return "pause";
    case "impatient":
    case "paused":
      return "attente";
    default:
      return isBlinking(now) ? "blink" : "base";
  }
}
