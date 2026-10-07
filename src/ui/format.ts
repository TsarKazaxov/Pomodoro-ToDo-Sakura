/** 1 499 000 ms → « 25:00 » (arrondi à la seconde supérieure, comme un minuteur). */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const dayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/** « 2026-10-05 » → « Lundi 5 octobre ». */
export function formatDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const s = dayFmt.format(new Date(y, m - 1, d));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
