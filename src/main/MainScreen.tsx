// Vue complète, provisoire : remplacée par les onglets Tâches / Activité / Réglages en Phase 4.

import { currentTask } from "../core/tasks";
import { durationsFrom, isPaused, remainingMs } from "../core/timer";
import { fr } from "../i18n/fr";
import { useSakura } from "../state/store";
import { formatClock } from "../ui/format";
import { useNow } from "../ui/hooks";
import styles from "./MainScreen.module.css";

export function MainScreen() {
  const s = useSakura();
  const now = useNow();

  if (s.status !== "ready" || !s.data) {
    return (
      <main className={styles.main}>
        <h1 className={styles.title}>Sakura</h1>
        <p>{s.status === "ready" ? "" : fr.status[s.status]}</p>
        {s.detail && <p className={styles.muted}>{s.detail}</p>}
        {s.backups.map((b) => (
          <button key={b} className={styles.btn} onClick={() => s.restore(b)}>
            Restaurer {b}
          </button>
        ))}
      </main>
    );
  }
  const { data, dispatch } = s;
  const t = data.timer;
  const cur = currentTask(data.tasks);
  const list = data.tasks.filter((x) => x.status !== "dropped").sort((a, b) => a.order - b.order);
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Sakura</h1>
      <p className={styles.muted}>
        {formatClock(remainingMs(t, durationsFrom(data.settings), now))} ·{" "}
        {t.phase === "idle" ? fr.phase.idle : isPaused(t) ? fr.phase.paused : fr.phaseLong[t.phase]}
        {cur ? ` · ${cur.title}` : ""}
      </p>
      <ul className={styles.list}>
        {list.map((x) => (
          <li key={x.id}>
            <label>
              <input
                type="checkbox"
                checked={x.status === "done"}
                onChange={(e) =>
                  dispatch({
                    type: "task/setStatus",
                    id: x.id,
                    status: e.target.checked ? "done" : "todo",
                  })
                }
              />{" "}
              {x.title} <span className={styles.muted}>· {x.size}</span>
            </label>
          </li>
        ))}
      </ul>
    </main>
  );
}
