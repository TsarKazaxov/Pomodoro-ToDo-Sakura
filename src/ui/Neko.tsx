// Neko dans l'ensō (D-043). Rendu SVG net (`crispEdges`) ; image fixe si l'utilisateur réduit
// les animations.

import { memo, useMemo } from "react";
import { FRAMES, framePaths, type Mood } from "./nekoSprite";
import { useReducedMotion } from "./hooks";

const LABEL: Record<Mood, string> = {
  sleep: "Neko dort",
  work: "Neko travaille",
  overtime: "Neko continue de travailler",
  tea: "Neko boit son thé",
  wait: "Neko attend",
};

export const Neko = memo(function Neko(props: { mood: Mood; tick: number; className?: string }) {
  const still = useReducedMotion();
  const frame = still ? 0 : props.tick % 2;
  const paths = useMemo(() => framePaths(FRAMES[props.mood][frame]!), [props.mood, frame]);
  return (
    <svg
      className={props.className}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      role="img"
      aria-label={LABEL[props.mood]}
    >
      {paths.map((p) => (
        <path key={p.fill} fill={p.fill} d={p.d} />
      ))}
    </svg>
  );
});
