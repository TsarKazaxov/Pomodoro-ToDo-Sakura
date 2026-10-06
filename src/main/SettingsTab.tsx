// Onglet Réglages (brief §4) : durées, cycle, barème, coin, son, thème, démarrage, données.

import { useState } from "react";
import { parseDataFile, serialize } from "../core/schema";
import { dayKeyAt } from "../core/time";
import {
  CORNERS,
  SIZES,
  THEMES,
  type Corner,
  type DataFile,
  type Settings,
  type Theme,
} from "../core/types";
import { confirmDialog, infoDialog, pickFolder, pickJsonFile, pickSavePath } from "../platform";
import { useSakura } from "../state/store";
import { DATA_FILE, joinPath } from "../storage/dataStore";
import { tauriFs } from "../storage/tauriFs";
import { chime } from "../ui/sound";
import styles from "./main.module.css";

const THEME_LABEL: Record<Theme, string> = { auto: "Auto", light: "Clair", dark: "Sombre" };

export function SettingsTab({ data }: { data: DataFile }) {
  const dispatch = useSakura((s) => s.dispatch);
  const dataDir = useSakura((s) => s.dataDir);
  const detail = useSakura((s) => s.detail);
  const s = data.settings;
  const set = (patch: Partial<Settings>) => dispatch({ type: "settings/update", patch });

  return (
    <div className={styles.settings}>
      <fieldset className={styles.fieldset}>
        <legend>Minuteur</legend>
        <NumberRow
          id="s-focus"
          label="Focus (min)"
          value={s.focusMinutes}
          min={1}
          max={180}
          onChange={(v) => set({ focusMinutes: v })}
        />
        <NumberRow
          id="s-short"
          label="Pause courte (min)"
          value={s.shortBreakMinutes}
          min={1}
          max={60}
          onChange={(v) => set({ shortBreakMinutes: v })}
        />
        <NumberRow
          id="s-long"
          label="Pause longue (min)"
          value={s.longBreakMinutes}
          min={1}
          max={120}
          onChange={(v) => set({ longBreakMinutes: v })}
        />
        <NumberRow
          id="s-cycle"
          label="Focus avant la pause longue"
          value={s.focusesBeforeLongBreak}
          min={1}
          max={12}
          onChange={(v) => set({ focusesBeforeLongBreak: v })}
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Barème d'effort</legend>
        <table className={styles.scaleTable}>
          <thead>
            <tr>
              <th>Taille</th>
              <th>Points</th>
              <th>Pomodoros attendus</th>
            </tr>
          </thead>
          <tbody>
            {SIZES.map((size) => (
              <tr key={size}>
                <td>
                  <span className={`${styles.size} ${size === "XL" ? styles.xl : ""}`}>{size}</span>
                </td>
                <td>
                  <NumberInput
                    label={`Points ${size}`}
                    value={s.scale[size].points}
                    min={1}
                    max={100}
                    onChange={(v) =>
                      set({ scale: { ...s.scale, [size]: { ...s.scale[size], points: v } } })
                    }
                  />
                </td>
                <td>
                  <NumberInput
                    label={`Pomodoros attendus ${size}`}
                    value={s.scale[size].expectedPomodoros}
                    min={1}
                    max={100}
                    onChange={(v) =>
                      set({
                        scale: { ...s.scale, [size]: { ...s.scale[size], expectedPomodoros: v } },
                      })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Widget</legend>
        <div className={styles.settingRow}>
          <span>Coin de l'écran</span>
          <CornerPicker value={s.corner} onChange={(corner) => set({ corner })} />
        </div>
        <div className={styles.settingRow}>
          <span>Thème</span>
          <div className={styles.seg} role="group" aria-label="Thème">
            {THEMES.map((t) => (
              <button key={t} aria-pressed={s.theme === t} onClick={() => set({ theme: t })}>
                {THEME_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.settingRow}>
          <label htmlFor="s-follow">Avec plusieurs écrans, suivre l'écran du curseur</label>
          <input
            id="s-follow"
            type="checkbox"
            className={styles.switch}
            checked={s.followCursorScreen}
            onChange={(e) => set({ followCursorScreen: e.target.checked })}
          />
        </div>
        <div className={styles.settingRow}>
          <label htmlFor="s-login">Lancer Sakura au démarrage du Mac</label>
          <input
            id="s-login"
            type="checkbox"
            className={styles.switch}
            checked={s.launchAtLogin}
            onChange={(e) => set({ launchAtLogin: e.target.checked })}
          />
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Son</legend>
        <div className={styles.settingRow}>
          <label htmlFor="s-sound">Tintement en fin de session</label>
          <input
            id="s-sound"
            type="checkbox"
            className={styles.switch}
            checked={s.soundEnabled}
            onChange={(e) => set({ soundEnabled: e.target.checked })}
          />
        </div>
        <div className={styles.settingRow}>
          <label htmlFor="s-vol">Volume</label>
          <input
            id="s-vol"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.soundVolume}
            disabled={!s.soundEnabled}
            onChange={(e) => set({ soundVolume: Number(e.target.value) })}
          />
        </div>
        <div className={styles.settingRow}>
          <span />
          <button className={styles.btnSmall} onClick={() => chime(1, s.soundVolume || 0.6)}>
            Écouter
          </button>
        </div>
      </fieldset>

      <DataSettings data={data} dataDir={dataDir} detail={detail} />
    </div>
  );
}

function DataSettings({
  data,
  dataDir,
  detail,
}: {
  data: DataFile;
  dataDir: string;
  detail: string;
}) {
  const { dispatch, relocate } = useSakura();
  const [busy, setBusy] = useState(false);
  const run = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      await infoDialog(
        `L'opération a échoué : ${e instanceof Error ? e.message : String(e)}`,
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const changeFolder = run(async () => {
    const dir = await pickFolder("Dossier des données de Sakura");
    if (!dir || dir === dataDir) return;
    const existing = await tauriFs.readText(joinPath(dir, DATA_FILE));
    if (existing === null) {
      relocate(dir, "ours");
      return;
    }
    if (
      await confirmDialog(
        "Ce dossier contient déjà des données Sakura. Les utiliser à la place des tiennes ?",
        "Utiliser ce fichier",
      )
    ) {
      relocate(dir, "theirs");
    } else if (
      await confirmDialog(
        "Remplacer le fichier de ce dossier par tes données actuelles ?",
        "Remplacer",
      )
    ) {
      relocate(dir, "ours");
    }
  });

  const exportJson = run(async () => {
    const path = await pickSavePath(
      "Exporter mes données",
      `sakura-export-${dayKeyAt(Date.now())}.json`,
    );
    if (!path) return;
    await tauriFs.writeAtomic(path, serialize(data));
    await infoDialog(`Exporté : ${data.tasks.length} tâches, ${data.sessions.length} sessions.`);
  });

  const importJson = run(async () => {
    const path = await pickJsonFile("Importer des données Sakura");
    if (!path) return;
    const text = await tauriFs.readText(path);
    const r = text === null ? null : parseDataFile(text);
    if (!r || !r.ok) {
      await infoDialog(
        `Ce fichier n'est pas un export Sakura lisible${r && !r.ok ? ` (${r.detail})` : ""}.`,
        "error",
      );
      return;
    }
    const ok = await confirmDialog(
      `Remplacer tes ${data.tasks.length} tâches par les ${r.data.tasks.length} du fichier ? Tes données actuelles restent dans la sauvegarde du jour.`,
      "Remplacer",
    );
    if (ok) dispatch({ type: "data/import", data: r.data });
  });

  return (
    <fieldset className={styles.fieldset}>
      <legend>Données</legend>
      <div className={styles.path}>{joinPath(dataDir, DATA_FILE)}</div>
      <p className={styles.muted}>
        {dataDir.includes("CloudDocs")
          ? "Dans iCloud Drive : sauvegardé et retrouvé sur un nouveau Mac. "
          : "Sur ce Mac uniquement. "}
        7 sauvegardes quotidiennes sont gardées dans le dossier « backups ».
      </p>
      {detail && <p className={styles.warn}>{detail}</p>}
      <div className={styles.row}>
        <button className={styles.btnSmall} disabled={busy} onClick={() => void changeFolder()}>
          Changer de dossier…
        </button>
        <button className={styles.btnSmall} disabled={busy} onClick={() => void exportJson()}>
          Exporter…
        </button>
        <button className={styles.btnSmall} disabled={busy} onClick={() => void importJson()}>
          Importer…
        </button>
      </div>
    </fieldset>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  onChange,
  id,
}: {
  label?: string;
  value: number;
  min: number;
  max: number;
  onChange(v: number): void;
  id?: string;
}) {
  const [text, setText] = useState(String(value));
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    setText(String(value));
  }
  return (
    <input
      id={id}
      type="number"
      className={styles.num}
      min={min}
      max={max}
      value={text}
      aria-label={label}
      onChange={(e) => {
        setText(e.target.value);
        const v = Math.round(Number(e.target.value));
        if (e.target.value !== "" && v >= min && v <= max) onChange(v);
      }}
      onBlur={() => setText(String(value))}
    />
  );
}

function NumberRow(props: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange(v: number): void;
}) {
  return (
    <div className={styles.settingRow}>
      <label htmlFor={props.id}>{props.label}</label>
      <NumberInput {...props} label={undefined} />
    </div>
  );
}

const CORNER_LABEL: Record<Corner, string> = {
  "top-left": "Haut gauche",
  "top-right": "Haut droite",
  "bottom-left": "Bas gauche",
  "bottom-right": "Bas droite",
};

export function CornerPicker({ value, onChange }: { value: Corner; onChange(c: Corner): void }) {
  return (
    <div className={styles.cornerPick} role="group" aria-label="Coin de l'écran">
      {CORNERS.map((c) => (
        <button
          key={c}
          type="button"
          data-corner={c}
          aria-label={CORNER_LABEL[c]}
          title={CORNER_LABEL[c]}
          aria-pressed={value === c}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  );
}
