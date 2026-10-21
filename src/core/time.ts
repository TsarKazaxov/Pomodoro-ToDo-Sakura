// Dates et « jours » de Sakura.
//
// Un jour est une clé `AAAA-MM-JJ`. On la lit directement dans l'horodatage local stocké
// (D-007) : un changement de fuseau ultérieur ne déplace donc pas les cases de la heatmap.
// Toute l'arithmétique sur les clés se fait en UTC pour ignorer les changements d'heure.

import type { LocalIso } from "./types";

export type DayKey = string;

const pad = (n: number, w = 2) => String(Math.abs(n)).padStart(w, "0");

/** `ms` epoch → ISO local avec décalage, ex. `2026-10-05T14:03:00.000+02:00`. */
export function toLocalIso(ms: number): LocalIso {
  const d = new Date(ms);
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}` +
    `${sign}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`
  );
}

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Jour local d'un horodatage stocké. */
export function dayKeyOf(iso: LocalIso): DayKey {
  const k = iso.slice(0, 10);
  if (!KEY_RE.test(k)) throw new Error(`Horodatage invalide : ${iso}`);
  return k;
}

/** Jour local de l'instant `ms` sur cette machine. */
export function dayKeyAt(ms: number): DayKey {
  return dayKeyOf(toLocalIso(ms));
}

function keyToUtc(key: DayKey): number {
  if (!KEY_RE.test(key)) throw new Error(`Jour invalide : ${key}`);
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function utcToKey(ms: number): DayKey {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const DAY_MS = 86_400_000;

export function addDays(key: DayKey, n: number): DayKey {
  return utcToKey(keyToUtc(key) + n * DAY_MS);
}

/** Nombre de jours de `a` à `b` (positif si `b` est après `a`). */
export function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((keyToUtc(b) - keyToUtc(a)) / DAY_MS);
}

/** 0 = lundi … 6 = dimanche. */
export function weekdayMon0(key: DayKey): number {
  return (new Date(keyToUtc(key)).getUTCDay() + 6) % 7;
}
