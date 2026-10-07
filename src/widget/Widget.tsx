// États A (compact) et B (déployé) de la fenêtre widget (brief §4).

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { comboVisible } from "../core/combo";
import { shouldSplit } from "../core/stats";
import { currentTask, priorities } from "../core/tasks";
import { dayKeyAt } from "../core/time";
import {
  durationsFrom,
  isOvertime,
  isPaused,
  overtimeMs,
  progress,
  remainingMs,
} from "../core/timer";
import type { Corner, DataFile, Settings } from "../core/types";
import { fr } from "../i18n/fr";
import {
  notify,
  onAppEvent,
  quitApp,
  showMain,
  syncAutostart,
  trayUpdate,
  widgetLayout,
  setFollowScreen,
  focusWidget,
  pressWidget,
  widgetSnap,
} from "../platform";
import { flush, onReward, useSakura, type Reward } from "../state/store";
import { Enso } from "../ui/Enso";
import { formatClock } from "../ui/format";
import { Heatmap } from "../ui/Heatmap";
import { Neko } from "../ui/Neko";
import type { Mood } from "../ui/nekoSprite";
import { useNow } from "../ui/hooks";
import { spawnPetals } from "../ui/petals";
import { useHoverExpand } from "./useHoverExpand";
import styles from "./Widget.module.css";

/** Marge transparente autour de la carte, pour son ombre. */
export const SHADOW_MARGIN = 10;
export const COMPACT = { w: 240, h: 64 };
export const EXPANDED = { w: 360, h: 520 };
const RESIZE_MS = 260;

const V_CLASS: Record<string, string | undefined> = {
  top: styles.vt,
  middle: styles.vm,
  bottom: styles.vb,
};
const H_CLASS: Record<string, string | undefined> = {
  left: styles.hl,
  center: styles.hc,
  right: styles.hr,
};
/** Classes de position de la carte dans sa fenêtre (D-041). */
export function anchorClass(corner: Corner): string {
  const [v = "", h = ""] = corner.split("-");
  return `${V_CLASS[v] ?? styles.vt} ${H_CLASS[h] ?? styles.hr}`;
}

export function Widget() {
  const status = useSakura((s) => s.status);
  const data = useSakura((s) => s.data);
  if (status !== "ready" || !data) return <WidgetStatus />;
  return <WidgetReady data={data} />;
}

/** Chargement, iCloud, fichier illisible : le widget renvoie vers la vue complète. */
function WidgetStatus() {
  const status = useSakura((s) => s.status);
  useEffect(() => {
    void widgetLayout("top-right", COMPACT.w + 2 * SHADOW_MARGIN, COMPACT.h + 2 * SHADOW_MARGIN);
    if (status === "corrupt" || status === "too_new" || status === "error") void showMain();
  }, [status]);
  const label = status === "ready" ? "" : fr.status[status];
  return (
    <div className={`${styles.card} ${anchorClass("top-right")}`}>
      <div className={styles.compact} style={{ gridTemplateColumns: "1fr" }}>
        <span className={styles.task}>{label}</span>
      </div>
    </div>
  );
}

function WidgetReady({ data }: { data: DataFile }) {
  const dispatch = useSakura((s) => s.dispatch);
  const combo = useSakura((s) => s.combo);
  const now = useNow();
  const card = useRef<HTMLDivElement>(null);
  const { open, setOpen, handlers, collapse, suspend, pin } = useHoverExpand(card);
  const quickInput = useRef<HTMLInputElement>(null);
  const focusQuickAdd = useRef(false);
  const [expandedFrame, setExpandedFrame] = useState(false);
  const [pending, setPending] = useState(false);
  const [bloom, setBloom] = useState(false);
  const [pop, setPop] = useState(0);
  const [draft, setDraft] = useState("");
  const corner = data.settings.corner;
  const openRef = useRef(open);
  openRef.current = open;

  // Fenêtre : on l'agrandit avant l'animation d'ouverture, on la réduit après celle de fermeture.
  useLayoutEffect(() => {
    let cancelled = false;
    let t: number | undefined;
    if (open) {
      void widgetLayout(
        corner,
        EXPANDED.w + 2 * SHADOW_MARGIN,
        EXPANDED.h + 2 * SHADOW_MARGIN,
      ).then(() => {
        if (!cancelled) setExpandedFrame(true);
      });
    } else {
      setExpandedFrame(false);
      t = window.setTimeout(
        () =>
          void widgetLayout(corner, COMPACT.w + 2 * SHADOW_MARGIN, COMPACT.h + 2 * SHADOW_MARGIN),
        RESIZE_MS,
      );
    }
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, corner]);

  // Widget replié, bouton enfoncé (D-040, D-041) :
  // - glissé : il s'aimante à la position la plus proche (coin ou milieu d'un bord) ; posé sur
  //   un autre écran, il y reste : le suivi de l'écran du curseur est coupé ;
  // - simple clic : il s'ouvre, épinglé, jusqu'au prochain clic à l'extérieur.
  const pressing = useRef(false);
  const press = useCallback(
    async (e: React.MouseEvent) => {
      if (open || e.button !== 0 || pressing.current) return;
      e.preventDefault();
      pressing.current = true;
      suspend(true);
      try {
        if ((await pressWidget()) === "click") {
          pin();
          void focusWidget();
          return;
        }
        const snap = await widgetSnap();
        if (!snap) return;
        const patch: Partial<Settings> = { corner: snap.corner };
        if (snap.movedScreen) patch.followCursorScreen = false;
        dispatch({ type: "settings/update", patch });
      } finally {
        pressing.current = false;
        suspend(false);
      }
    },
    [dispatch, open, pin, suspend],
  );

  // Pétales en attente (fin de focus pendant que le widget était replié) : au prochain déploiement.
  useEffect(() => {
    if (!expandedFrame || !pending) return;
    setPending(false);
    const t = window.setTimeout(() => petalsInCard(24), RESIZE_MS);
    return () => window.clearTimeout(t);
  }, [expandedFrame, pending]);

  // Barre de menu, raccourcis globaux et fermeture de l'app (Phase 5).
  useEffect(() => {
    const offs = [
      onAppEvent("toggle", () => dispatch({ type: "timer/toggle" })),
      onAppEvent("quick-add", () => {
        focusQuickAdd.current = true;
        setOpen(true);
      }),
      onAppEvent("quit", () => void flush().finally(() => void quitApp())),
    ];
    return () => offs.forEach((off) => off());
  }, [dispatch, setOpen]);

  // ⌥⌘N : le curseur va dans le champ d'ajout une fois le widget déployé.
  useEffect(() => {
    if (expandedFrame && focusQuickAdd.current) {
      focusQuickAdd.current = false;
      quickInput.current?.focus();
    }
  }, [expandedFrame]);

  useEffect(() => {
    void syncAutostart(data.settings.launchAtLogin);
  }, [data.settings.launchAtLogin]);

  useEffect(() => {
    void setFollowScreen(data.settings.followCursorScreen);
  }, [data.settings.followCursorScreen]);

  useEffect(
    () =>
      onReward((r: Reward) => {
        if (r.kind === "focus") {
          if (openRef.current) petalsInCard(24);
          else {
            setPending(true);
            void notify(
              "Focus terminé",
              `${r.taskTitle ? `« ${r.taskTitle} » · ` : ""}La pause de ${r.breakMinutes} min commence.`,
            );
          }
          return;
        }
        if (r.kind === "overtime") {
          void notify("Focus terminé", fr.overtimeNotice);
          return;
        }
        if (r.kind === "break") {
          if (!openRef.current)
            void notify("Pause terminée", "Lance le focus suivant quand tu es prêt.");
          return;
        }
        if (r.origin !== "widget") return;
        if (r.tier <= 2) petalsInCard((r.tier === 1 ? 16 : 28) + 2 * r.points);
        if (r.tier >= 2) setPop((n) => n + 1);
        if (r.tier >= 3) {
          setBloom(true);
          window.setTimeout(() => setBloom(false), 1100);
        }
      }),
    [],
  );

  function petalsInCard(count: number) {
    const b = card.current?.getBoundingClientRect();
    if (!b) return;
    spawnPetals({
      count,
      from: { x: b.left, y: b.top, w: b.width, h: Math.min(60, b.height) },
      fall: b.height,
    });
  }

  const t = data.timer;
  const d = durationsFrom(data.settings);
  const isBreak = t.phase === "short_break" || t.phase === "long_break";
  const paused = isPaused(t);
  const overtime = isOvertime(t);
  const cur = currentTask(data.tasks);
  const prio = priorities(data.tasks);
  const open3 = prio.slice(0, 3);
  const choices = data.tasks
    .filter((x) => x.status === "todo" || x.status === "doing")
    .sort((a, b) => Number(b.priority) - Number(a.priority) || a.order - b.order);
  const today = dayKeyAt(now);
  const todayPoints = data.tasks
    .filter((x) => x.status === "done" && x.completedAt?.startsWith(today))
    .reduce((n, x) => n + data.settings.scale[x.size].points, 0);
  const time = overtime
    ? `+${formatClock(overtimeMs(t, d, now))}`
    : formatClock(remainingMs(t, d, now));
  const pill =
    t.phase === "idle"
      ? fr.phase.idle
      : paused
        ? fr.phase.paused
        : isBreak
          ? fr.phase.break
          : overtime
            ? fr.phase.overtime
            : fr.phase.focus;
  const mood: Mood =
    t.phase === "idle"
      ? "sleep"
      : paused
        ? "wait"
        : isBreak
          ? "tea"
          : overtime
            ? "overtime"
            : "work";
  const tick = Math.floor(now / 1000);
  const neko = data.settings.showCompanion;
  const pillClass =
    t.phase === "idle" || paused ? "" : isBreak ? styles.pillBreak : styles.pillFocus;
  const cycle = data.settings.focusesBeforeLongBreak;
  const nInCycle = (t.focusCount % cycle) + 1;
  const phaseLine =
    t.phase === "idle"
      ? fr.nextFocus(nInCycle, cycle)
      : overtime
        ? fr.overtimeLine
        : t.phase === "focus"
          ? fr.focusOf(nInCycle, cycle)
          : fr.breakLine(
              fr.phaseLong[t.phase],
              t.phase === "long_break"
                ? data.settings.longBreakMinutes
                : data.settings.shortBreakMinutes,
            );
  const running = t.phase !== "idle" && !paused;
  const trayTitle = t.phase === "idle" ? "" : paused ? `‖ ${time}` : time;
  const toggleLabel =
    t.phase === "idle" ? fr.start : paused ? fr.resume : overtime ? fr.takeBreak : fr.suspend;
  const taskLine = cur ? cur.title : t.phase === "focus" ? fr.freeFocusRunning : fr.pickTask;
  useEffect(() => {
    void trayUpdate(trayTitle, toggleLabel, running);
  }, [trayTitle, toggleLabel, running]);
  const enso = (
    <Enso progress={progress(t, d, now)} tone={isBreak ? "sakura" : "ink"} bloom={bloom} />
  );

  return (
    <div
      ref={card}
      className={[
        styles.card,
        anchorClass(corner),
        open && expandedFrame ? styles.open : "",
        isBreak ? styles.break : "",
      ].join(" ")}
      {...handlers}
      onBlur={handlers.onBlur}
    >
      {pending && <span className={styles.pending} aria-label="Focus terminé" />}

      <div
        className={styles.compact}
        aria-hidden={open}
        onMouseDown={(e) => void press(e)}
        title="Cliquer pour ouvrir · glisser pour déplacer"
      >
        <div className={styles.miniEnso}>
          {enso}
          {neko && <Neko mood={mood} tick={tick} className={styles.miniNeko} />}
        </div>
        <div className={styles.compactText}>
          <div className={styles.time}>{time}</div>
          <div className={styles.task}>{taskLine}</div>
        </div>
        <span className={`${styles.pill} ${pillClass}`}>{pill}</span>
      </div>

      {/* Partie déployée montée seulement quand elle sert : replié, le widget ne met à jour
          que la ligne compacte chaque seconde (D-036). */}
      {open && (
        <div className={styles.expanded} aria-hidden={!open}>
          <button
            className={styles.collapse}
            onClick={collapse}
            aria-label="Réduire"
            title="Réduire (Échap)"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 8h8" />
            </svg>
          </button>
          <div className={styles.timer}>
            <div className={styles.bigEnso}>
              {enso}
              <div className={styles.bigTime}>
                {neko && <Neko mood={mood} tick={tick} className={styles.bigNeko} />}
                {time}
              </div>
            </div>
            <div className={styles.side}>
              <span className={`${styles.pill} ${pillClass}`}>{pill}</span>
              <div className={styles.phaseLine}>{phaseLine}</div>
              <div className={styles.ctrls}>
                <button
                  className={`${styles.btn} ${styles.primary}`}
                  onClick={() => dispatch({ type: "timer/toggle" })}
                >
                  {toggleLabel}
                </button>
                <button className={styles.btn} onClick={() => dispatch({ type: "timer/skip" })}>
                  {fr.skip}
                </button>
                <button
                  className={`${styles.btn} ${styles.icon}`}
                  onClick={() => dispatch({ type: "timer/reset" })}
                  aria-label={fr.reset}
                  title={fr.reset}
                >
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M2.5 8a5.5 5.5 0 1 0 1.7-4" />
                    <path d="M2.3 1.8v3h3" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div>
            <h3 className={styles.sectionTitle}>{fr.currentTask}</h3>
            <select
              className={styles.select}
              value={cur?.id ?? ""}
              onChange={(e) => dispatch({ type: "task/setCurrent", id: e.target.value || null })}
              aria-label={fr.currentTask}
            >
              <option value="">{fr.freeFocus}</option>
              {choices.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title} · {x.size}
                </option>
              ))}
            </select>
            {cur ? (
              <Dots
                spent={cur.pomodorosSpent}
                expected={data.settings.scale[cur.size].expectedPomodoros}
                xl={cur.size === "XL"}
              />
            ) : (
              <p className={styles.hintMuted}>{fr.freeFocusHint}</p>
            )}
            {cur && shouldSplit(cur, data.settings.scale) && (
              <p className={styles.hint}>{fr.splitHint}</p>
            )}
          </div>

          <div className={styles.prioBlock}>
            <div className={styles.sectionRow}>
              <h3 className={styles.sectionTitle}>{fr.priorities}</h3>
              {prio.length > 0 && <span className={styles.count}>{fr.pinned(prio.length)}</span>}
            </div>
            {open3.length === 0 ? (
              <p className={styles.empty}>
                {fr.noPriority} <code>{fr.quickAddExample}</code>.
              </p>
            ) : (
              <ul className={styles.prio}>
                {open3.map((x) => (
                  <li key={x.id}>
                    <input
                      type="checkbox"
                      className={styles.tick}
                      checked={false}
                      onChange={() =>
                        dispatch({ type: "task/setStatus", id: x.id, status: "done" })
                      }
                      aria-label={fr.complete(x.title)}
                    />
                    <span className={styles.prioTitle} title={x.title}>
                      {x.title}
                    </span>
                    <span className={`${styles.size} ${x.size === "XL" ? styles.xl : ""}`}>
                      {x.size}
                    </span>
                  </li>
                ))}
                {prio.length > 3 && <li className={styles.more}>{fr.more(prio.length - 3)}</li>}
              </ul>
            )}
            <input
              ref={quickInput}
              className={styles.quick}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && draft.trim()) {
                  dispatch({ type: "task/quickAdd", raw: draft, priority: true });
                  setDraft("");
                } else if (e.key === "Escape") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder={fr.quickAddPlaceholder}
              aria-label={fr.quickAddPlaceholder}
            />
          </div>

          <div className={styles.heatRow}>
            <Heatmap data={data} today={today} weeks={12} />
            <div className={styles.todayPts}>
              <b key={pop} className={pop ? styles.popped : undefined}>
                {todayPoints}
              </b>
              <span>{fr.todayPoints}</span>
            </div>
            {comboVisible(combo, now) && (
              <span className={styles.combo}>{fr.combo(combo.count)}</span>
            )}
          </div>

          <button className={styles.openLink} onClick={() => void showMain()}>
            {fr.open}
          </button>
        </div>
      )}
    </div>
  );
}

function Dots({ spent, expected, xl }: { spent: number; expected: number; xl: boolean }) {
  const shown = Math.min(Math.max(spent, expected), 12);
  return (
    <div className={styles.dots}>
      {Array.from({ length: shown }, (_, i) => (
        <i
          key={i}
          className={
            i < Math.min(spent, expected) ? styles.on : i < spent ? styles.over : undefined
          }
        />
      ))}
      <span>
        {spent} / {expected}
        {xl ? "+" : ""}
      </span>
    </div>
  );
}
