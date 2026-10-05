// Premier lancement (brief §4) : trois champs, puis bascule sur le widget compact.

import { useState } from "react";
import type { Corner } from "../core/types";
import { hideMain } from "../platform";
import { useSakura } from "../state/store";
import { Enso } from "../ui/Enso";
import { CornerPicker } from "./SettingsTab";
import styles from "./main.module.css";

const DURATIONS = [15, 25, 45, 50];

export function Onboarding() {
  const dispatch = useSakura((s) => s.dispatch);
  const [focus, setFocus] = useState(25);
  const [corner, setCorner] = useState<Corner>("top-right");
  const [task, setTask] = useState("");
  return (
    <main className={styles.onboardWrap}>
      <form
        className={styles.onboard}
        onSubmit={(e) => {
          e.preventDefault();
          dispatch({ type: "onboarding/complete", focusMinutes: focus, corner, firstTask: task });
          void hideMain();
        }}
      >
        <header>
          <Enso progress={1} seed={23} className={styles.onboardEnso} />
          <div>
            <h1>Bienvenue dans Sakura</h1>
            <p>Un minuteur, tes tâches du jour, et ton rythme dans le temps.</p>
          </div>
        </header>
        <div className={styles.field}>
          <span id="ob-focus">Durée d'un focus</span>
          <div className={styles.seg} role="group" aria-labelledby="ob-focus">
            {DURATIONS.map((d) => (
              <button key={d} type="button" aria-pressed={focus === d} onClick={() => setFocus(d)}>
                {d} min
              </button>
            ))}
          </div>
        </div>
        <div className={styles.field}>
          <span>Coin de l'écran pour le widget</span>
          <CornerPicker value={corner} onChange={setCorner} />
        </div>
        <div className={styles.field}>
          <label htmlFor="ob-task">Ta première tâche</label>
          <input
            id="ob-task"
            className={styles.add}
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Synthèse des entretiens #M"
          />
          <small>
            Ajoute <b>#XS</b>, <b>#S</b>, <b>#M</b>, <b>#L</b> ou <b>#XL</b> pour estimer l'effort.
            Sans rien, ce sera S.
          </small>
        </div>
        <div>
          <button type="submit" className={`${styles.btn} ${styles.primary}`}>
            Commencer
          </button>
        </div>
      </form>
    </main>
  );
}
