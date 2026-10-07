// Pétales de sakura : éléments absolus animés en CSS (transform + opacity), retirés après
// l'animation. Rien ne tourne entre deux récompenses (brief §3 : < 2 % CPU au repos).

import "../styles/petals.css";

const PETAL =
  '<svg viewBox="0 0 14 13" aria-hidden="true"><path d="M7 .4C9.9 1.6 13.4 4.6 12.9 8.3 12.5 11 10.1 12.6 8.2 11.4L7 10.1 5.8 11.4C3.9 12.6 1.5 11 1.1 8.3.6 4.6 4.1 1.6 7 .4Z"/></svg>';

export const MAX_PETALS = 80;

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PetalOptions {
  count: number;
  /** Zone de départ des pétales. */
  from: Area;
  /** Hauteur de chute. */
  fall: number;
  /** Dérive horizontale moyenne (coup de vent). */
  gust?: number;
  /** Durée moyenne en secondes. */
  duration?: number;
  /** Étalement des départs, en secondes. */
  stagger?: number;
}

export function spawnPetals(o: PetalOptions) {
  if (prefersReducedMotion()) return;
  const n = Math.min(MAX_PETALS, Math.round(o.count));
  const base = o.duration ?? 2.6;
  for (let i = 0; i < n; i++) {
    const p = document.createElement("span");
    p.className = "sakura-petal";
    p.innerHTML = PETAL;
    const x0 = o.from.x + Math.random() * o.from.w;
    const y0 = o.from.y + Math.random() * o.from.h;
    const d = base + Math.random() * 0.9;
    const st = p.style;
    st.setProperty("--x0", `${x0}px`);
    st.setProperty("--y0", `${y0}px`);
    st.setProperty("--x1", `${x0 + (Math.random() - 0.5) * 160 + (o.gust ?? -30)}px`);
    st.setProperty("--y1", `${y0 + o.fall * (0.7 + Math.random() * 0.45)}px`);
    st.setProperty("--r0", `${Math.random() * 180}deg`);
    st.setProperty("--r1", `${Math.random() * 720 - 360}deg`);
    st.setProperty("--s", `${0.65 + Math.random() * 0.7}`);
    st.setProperty("--d", `${d}s`);
    st.setProperty("--delay", `${Math.random() * (o.stagger ?? 0.6)}s`);
    document.body.appendChild(p);
    window.setTimeout(() => p.remove(), (d + (o.stagger ?? 0.6) + 0.5) * 1000);
  }
}
