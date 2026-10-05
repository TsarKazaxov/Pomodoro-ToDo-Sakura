import { useMemo } from "react";
import { adaptiveThresholds, buildDayMap, heatGrid, heatLevel } from "../core/stats";
import type { DataFile } from "../core/types";
import { formatDayKey, plural } from "./format";
import styles from "./Heatmap.module.css";

interface Props {
  data: DataFile;
  today: string;
  weeks: number;
  size?: "mini" | "big";
}

/** Grille façon GitHub : une case par jour, couleur = points des tâches terminées (D-013). */
export function Heatmap({ data, today, weeks, size = "mini" }: Props) {
  const days = useMemo(
    () => buildDayMap(data.tasks, data.sessions, data.settings.scale),
    [data.tasks, data.sessions, data.settings.scale],
  );
  const th = useMemo(() => adaptiveThresholds(days), [days]);
  const grid = useMemo(() => heatGrid(today, weeks), [today, weeks]);
  return (
    <div
      className={`${styles.heat} ${styles[size]}`}
      role="img"
      aria-label={`Activité des ${weeks} dernières semaines`}
    >
      {grid.map((k, i) => {
        if (!k) return <i key={i} className={styles.future} />;
        const d = days.get(k);
        const lv = heatLevel(d?.points ?? 0, th);
        const dot = !!d && d.points === 0 && d.pomodoros > 0;
        const title = d
          ? `${formatDayKey(k)} · ${plural(d.points, "point", "points")} · ${plural(d.taskIds.length, "tâche", "tâches")} · ${plural(d.pomodoros, "pomodoro", "pomodoros")}`
          : `${formatDayKey(k)} · rien`;
        return (
          <i
            key={k}
            data-day={k}
            title={title}
            className={[
              styles[`l${lv}`],
              dot ? styles.dot : "",
              k === today ? styles.today : "",
            ].join(" ")}
          />
        );
      })}
    </div>
  );
}
