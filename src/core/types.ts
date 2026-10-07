// Modèle de données de Sakura. Voir brief §2 et DECISIONS.md (D-005, D-014, D-023).

export type Size = "XS" | "S" | "M" | "L" | "XL";
export const SIZES: readonly Size[] = ["XS", "S", "M", "L", "XL"];

export type TaskStatus = "todo" | "doing" | "done" | "dropped";
export const TASK_STATUSES: readonly TaskStatus[] = ["todo", "doing", "done", "dropped"];

/** Horodatage ISO 8601 en heure locale avec décalage, ex. `2026-10-05T14:03:00.000+02:00` (D-007). */
export type LocalIso = string;

export interface Task {
  id: string;
  title: string;
  size: Size;
  /** « Tâche du jour » épinglée. */
  priority: boolean;
  /** `doing` = tâche en cours du minuteur ; au plus une à la fois. */
  status: TaskStatus;
  createdAt: LocalIso;
  completedAt?: LocalIso;
  /** Incrémenté à chaque focus terminé sur cette tâche. */
  pomodorosSpent: number;
  order: number;
  updatedAt: LocalIso;
}

export type PhaseType = "focus" | "short_break" | "long_break";
export const PHASE_TYPES: readonly PhaseType[] = ["focus", "short_break", "long_break"];

export interface Session {
  id: string;
  type: PhaseType;
  taskId?: string;
  startedAt: LocalIso;
  endedAt: LocalIso;
  /** `false` si interrompue (Passer, Réinitialiser). */
  completed: boolean;
  /** Temps cumulé en état « suspendu » pendant la session. */
  pausedMs: number;
}

export interface ScaleEntry {
  points: number;
  expectedPomodoros: number;
}
export type Scale = Record<Size, ScaleEntry>;

/** Position du widget : quatre coins et le milieu de chaque bord (D-041). */
export type Corner =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";
export const CORNERS: readonly Corner[] = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

export type Theme = "auto" | "light" | "dark";
export const THEMES: readonly Theme[] = ["auto", "light", "dark"];

export interface Settings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  focusesBeforeLongBreak: number;
  scale: Scale;
  corner: Corner;
  soundEnabled: boolean;
  /** 0 à 1. */
  soundVolume: number;
  theme: Theme;
  launchAtLogin: boolean;
  /** Avec plusieurs écrans, le widget rejoint l'écran du curseur (D-038). */
  followCursorScreen: boolean;
  /** Fin de focus pendant que tu travailles : le focus se prolonge, la pause attend (D-042). */
  extendWhileActive: boolean;
  /** Neko, le compagnon pixel dans l'ensō (D-043). */
  showCompanion: boolean;
  /** Premier lancement terminé. */
  onboarded: boolean;
}

/**
 * État persistant du minuteur. Les instants sont en millisecondes epoch (D-023) :
 * le minuteur se calcule toujours depuis ces horodatages, jamais depuis un compteur.
 */
export interface TimerState {
  phase: PhaseType | "idle";
  /** Phase lancée par le prochain « Démarrer » quand `phase` vaut `idle`. */
  next: PhaseType;
  startedAt: number | null;
  /** Défini quand le minuteur est suspendu. */
  pausedAt: number | null;
  pausedMs: number;
  /** Focus terminés dans le cycle courant, pour décider de la pause longue. */
  focusCount: number;
  /**
   * Prolongation (D-042) : fin prévue du focus dépassée pendant que tu travaillais. Le focus
   * continue de compter ; la pause démarre quand tu t'arrêtes. `null` hors prolongation.
   */
  overtimeAt: number | null;
  /** Dernière activité constatée pendant la prolongation, rafraîchie toutes les 30 s. */
  lastActiveAt: number | null;
}

export interface DataFile {
  schemaVersion: number;
  /** Mac auteur de la dernière écriture. */
  deviceId: string;
  updatedAt: LocalIso;
  tasks: Task[];
  sessions: Session[];
  settings: Settings;
  timer: TimerState;
}
