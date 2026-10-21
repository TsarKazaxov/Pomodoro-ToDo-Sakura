// Géométrie de l'ensō : un trait de pinceau fermé (surface) et sa ligne centrale (révélation).
// Calculé une fois par graine. Pas de filtre SVG de « grain » comme dans le prototype : la
// rugosité est dans le tracé lui-même, ce qui ne coûte rien au rendu (budget CPU, brief §3).

function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface EnsoGeometry {
  /** Surface du trait, à remplir. */
  brush: string;
  /** Ligne centrale, de longueur normalisée 1 via `pathLength`. */
  center: string;
}

const cache = new Map<number, EnsoGeometry>();

/** Ensō dans un repère 100 × 100 ; même graine → même tracé. */
export function ensoGeometry(seed = 11): EnsoGeometry {
  const hit = cache.get(seed);
  if (hit) return hit;
  const r = rng(seed * 7919);
  const ph1 = r() * 6;
  const ph2 = r() * 6;
  const N = 140;
  const a0 = ((-104 + r() * 8) * Math.PI) / 180;
  const sweep = ((330 + r() * 12) * Math.PI) / 180;
  const R = 38;
  const outer: [number, number][] = [];
  const inner: [number, number][] = [];
  const center: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = a0 + t * sweep;
    const rad = R + 1.3 * Math.sin(3 * a + ph1) + 0.7 * Math.sin(7 * a + ph2);
    let w = t < 0.05 ? 5 + (t / 0.05) * 5.5 : 10.5 * (1 - 0.82 * Math.pow((t - 0.05) / 0.95, 1.25));
    w += 0.7 * Math.sin(13 * a + ph2) + (t > 0.8 ? (r() - 0.5) * 1.2 : 0);
    w = Math.max(1.1, w);
    // Bords irréguliers du pinceau : léger bruit indépendant de chaque côté.
    const jo = (r() - 0.5) * 0.5;
    const ji = (r() - 0.5) * 0.5;
    const c = Math.cos(a);
    const s = Math.sin(a);
    outer.push([50 + (rad + w / 2 + jo) * c, 50 + (rad + w / 2 + jo) * s]);
    inner.push([50 + (rad - w / 2 + ji) * c, 50 + (rad - w / 2 + ji) * s]);
    center.push([50 + rad * c, 50 + rad * s]);
  }
  const f = (p: [number, number]) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
  const start = center[0]!;
  const cap: [number, number] = [
    start[0] - 2.6 * Math.cos(a0 + 0.3),
    start[1] - 2.6 * Math.sin(a0 + 0.3),
  ];
  const geo = {
    brush: `M${outer.map(f).join("L")}L${inner.reverse().map(f).join("L")}Q${f(cap)} ${f(outer[0]!)}Z`,
    center: `M${center.map(f).join("L")}`,
  };
  cache.set(seed, geo);
  return geo;
}

/** Avancement affiché : par paliers de 1/12 si le mouvement est réduit. */
export function displayedProgress(p: number, reducedMotion: boolean): number {
  const clamped = Math.min(1, Math.max(0, p));
  return reducedMotion ? Math.floor(clamped * 12 + 1e-9) / 12 : clamped;
}
