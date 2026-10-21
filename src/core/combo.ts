// Série de tâches cochées, pour la récompense graduelle (D-019).
// Chaque tâche cochée moins de 10 min après la précédente fait monter d'un palier (max 4).

export interface ComboState {
  count: number;
  lastAt: number;
  /** Tâches déjà comptées dans la série : recocher ne fait pas monter. */
  taskIds: readonly string[];
}

export const COMBO_WINDOW_MS = 10 * 60_000;
export const MAX_TIER = 4;

export const emptyCombo = (): ComboState => ({ count: 0, lastAt: 0, taskIds: [] });

export function stepCombo(
  state: ComboState,
  taskId: string,
  now: number,
  windowMs = COMBO_WINDOW_MS,
): { state: ComboState; tier: number } {
  const live = state.count > 0 && now - state.lastAt <= windowMs;
  const base = live ? state : emptyCombo();
  if (base.taskIds.includes(taskId)) return { state: base, tier: Math.min(base.count, MAX_TIER) };
  const next = { count: base.count + 1, lastAt: now, taskIds: [...base.taskIds, taskId] };
  return { state: next, tier: Math.min(next.count, MAX_TIER) };
}

/** Série visible (badge « Série ×N ») : au moins 2 tâches et fenêtre encore ouverte. */
export function comboVisible(state: ComboState, now: number, windowMs = COMBO_WINDOW_MS): boolean {
  return state.count >= 2 && now - state.lastAt <= windowMs;
}
