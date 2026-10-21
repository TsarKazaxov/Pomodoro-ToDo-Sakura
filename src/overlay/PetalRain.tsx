// Fenêtre de pluie (D-027) : transparente, plein écran, traversée par les clics, fermée par
// Rust après 5,5 s. Les paramètres arrivent dans l'URL : `#rain=screen&x=…&y=…&w=…&h=…`.

import { useEffect } from "react";
import { spawnPetals } from "../ui/petals";

export function parseRain(hash: string) {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const n = (k: string) => Number(p.get(k)) || 0;
  return {
    mode: p.get("rain") === "screen" ? "screen" : "around",
    x: n("x"),
    y: n("y"),
    w: n("w"),
    h: n("h"),
  } as const;
}

export function PetalRain() {
  useEffect(() => {
    const r = parseRain(location.hash);
    if (r.mode === "screen") {
      // Palier 4 : pluie sur tout l'écran, depuis le haut.
      spawnPetals({
        count: 72,
        from: { x: 0, y: -40, w: innerWidth, h: 40 },
        fall: innerHeight,
        gust: -80,
        duration: 3.4,
        stagger: 1.1,
      });
    } else {
      // Palier 3 : bourrasque autour du widget, qui déborde sur l'écran.
      spawnPetals({
        count: 48,
        from: { x: r.x - 120, y: r.y, w: r.w + 240, h: 60 },
        fall: Math.max(420, r.h + 200),
        gust: -140,
      });
    }
  }, []);
  return null;
}
