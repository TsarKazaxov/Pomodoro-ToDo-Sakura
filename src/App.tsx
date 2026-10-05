// Écran provisoire de la Phase 2 : vérifie de bout en bout, dans l'app installée, que le
// minuteur, les tâches et le fichier de données fonctionnent. Remplacé en Phase 3.

import { useEffect, useState } from "react";
import { currentTask } from "./core/tasks";
import { durationsFrom, isPaused, remainingMs } from "./core/timer";
import { DataStore } from "./storage/dataStore";
import { MemoryFs } from "./storage/memoryFs";
import { defaultDataDir, tauriFs } from "./storage/tauriFs";
import { useSakura } from "./state/store";
import styles from "./App.module.css";

const inTauri = "__TAURI_INTERNALS__" in window;

function deviceId(): string {
  try {
    const k = "sakura.deviceId";
    const v = localStorage.getItem(k) ?? crypto.randomUUID();
    localStorage.setItem(k, v);
    return v;
  } catch {
    return crypto.randomUUID();
  }
}

const fmt = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

const PHASE = {
  idle: "Arrêté",
  focus: "Focus",
  short_break: "Pause courte",
  long_break: "Pause longue",
};

export function App() {
  const s = useSakura();
  const [dir, setDir] = useState("");
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = inTauri ? await defaultDataDir() : "/apercu";
      if (cancelled) return;
      setDir(d);
      await useSakura
        .getState()
        .init(new DataStore(inTauri ? tauriFs : new MemoryFs(), d), deviceId());
    })();
    const id = setInterval(() => useSakura.getState().tick(), 250);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (s.status !== "ready" || !s.data) {
    return (
      <main className={styles.main}>
        <h1 className={styles.title}>Sakura</h1>
        <p>État du fichier : {s.status}</p>
        {s.detail && <p className={styles.muted}>{s.detail}</p>}
        {s.backups.map((b) => (
          <button key={b} className={styles.btn} onClick={() => void s.restore(b)}>
            Restaurer {b}
          </button>
        ))}
      </main>
    );
  }

  const { data, now } = s;
  const t = data.timer;
  const cur = currentTask(data.tasks);
  const open = data.tasks.filter((x) => x.status !== "dropped").sort((a, b) => a.order - b.order);

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Sakura · socle</h1>
      <p className={styles.muted}>
        {inTauri ? "Données : " : "Aperçu navigateur, rien n'est enregistré : "}
        <code>{dir}</code>
      </p>

      <section className={styles.timer}>
        <div className={styles.time}>{fmt(remainingMs(t, durationsFrom(data.settings), now))}</div>
        <div className={styles.muted}>
          {isPaused(t) ? "Suspendu" : PHASE[t.phase]} · {t.focusCount} focus dans le cycle
          {cur ? ` · ${cur.title}` : ""}
        </div>
        <div className={styles.row}>
          <button className={styles.btn} onClick={s.toggle}>
            {t.phase === "idle" ? "Démarrer" : isPaused(t) ? "Reprendre" : "Suspendre"}
          </button>
          <button className={styles.btn} onClick={s.skip}>
            Passer
          </button>
          <button className={styles.btn} onClick={s.reset}>
            Réinitialiser
          </button>
        </div>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (s.quickAdd(draft, true)) setDraft("");
        }}
      >
        <input
          className={styles.input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ajouter : Relire la spec #S"
          aria-label="Ajout rapide"
        />
      </form>

      <ul className={styles.list}>
        {open.map((x) => (
          <li key={x.id}>
            <label>
              <input
                type="checkbox"
                checked={x.status === "done"}
                onChange={(e) => s.setTaskStatus(x.id, e.target.checked ? "done" : "todo")}
              />{" "}
              {x.title}{" "}
              <span className={styles.muted}>
                · {x.size} · {x.pomodorosSpent} pomodoro(s)
              </span>
            </label>{" "}
            {x.status !== "done" && x.status !== "doing" && (
              <button className={styles.link} onClick={() => s.setTaskStatus(x.id, "doing")}>
                en cours
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className={styles.muted}>
        {data.tasks.length} tâches · {data.sessions.length} sessions enregistrées
      </p>
    </main>
  );
}
