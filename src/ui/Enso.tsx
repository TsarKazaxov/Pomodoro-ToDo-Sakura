import { useId, useRef } from "react";
import { displayedProgress, ensoGeometry } from "./ensoPath";
import { useReducedMotion } from "./hooks";
import styles from "./Enso.module.css";

interface Props {
  /** 0 à 1 : part du cercle déjà tracée. */
  progress: number;
  /** Ton du trait : encre pendant le focus, sakura pendant la pause. */
  tone?: "ink" | "sakura";
  /** Rosit brièvement le trait (palier 3 et plus de la récompense). */
  bloom?: boolean;
  seed?: number;
  className?: string;
}

/** Minuteur ensō : le trait se dessine (stroke-dashoffset d'un masque) à mesure que le temps passe. */
export function Enso({ progress, tone = "ink", bloom = false, seed = 11, className }: Props) {
  const id = useId().replace(/:/g, "");
  const geo = ensoGeometry(seed);
  const reduced = useReducedMotion();
  const p = displayedProgress(progress, reduced);
  // Retour en arrière (nouvelle phase) : sans transition, sinon le cercle se « dé-dessine ».
  const last = useRef(p);
  const instant = reduced || p < last.current;
  last.current = p;
  return (
    <svg
      className={[
        styles.enso,
        tone === "sakura" ? styles.sakura : "",
        bloom ? styles.bloom : "",
        className ?? "",
      ].join(" ")}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <defs>
        <mask id={`m${id}`} maskUnits="userSpaceOnUse" x="-5" y="-5" width="110" height="110">
          <path
            className={instant ? undefined : styles.reveal}
            d={geo.center}
            pathLength={1}
            stroke="#fff"
            strokeWidth={18}
            fill="none"
            strokeDasharray="1 1"
            strokeDashoffset={1 - p}
          />
        </mask>
      </defs>
      <path className={styles.ghost} d={geo.brush} />
      <path className={styles.ink} d={geo.brush} mask={`url(#m${id})`} />
    </svg>
  );
}
