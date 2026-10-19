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
import { CORNERS, type Corner, type DataFile, type Settings } from "../core/types";
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
  setHitRects,
  lastInputAt,
  focusWidget,
  pressWidget,
  widgetSnap,
} from "../platform";
import { flush, onReward, useSakura, type Reward } from "../state/store";
import { Enso } from "../ui/Enso";
import { formatClock } from "../ui/format";
import { Heatmap } from "../ui/Heatmap";
import { useNow } from "../ui/hooks";
import { spawnPetals } from "../ui/petals";
import { Rai, RAI_SIZE } from "./Rai";
import { useCompanion } from "./useCompanion";
import { useHoverExpand } from "./useHoverExpand";
import styles from "./Widget.module.css";

/** Marge transparente autour de la carte, pour son ombre. */
export const SHADOW_MARGIN = 10;
export const COMPACT = { w: 240, h: 64 };
export const EXPANDED = { w: 360, h: 520 };
/** Fiche repliée quand Rai parle : la réplique prend la place du minuteur (D-044). */
export const TALK_H = 88;
const RAI_GAP = 4;
const WANDER_MS = 3 * 60_000;

/**
 * Disposition de Rai et de la fiche (D-044) : au milieu d'un bord haut ou bas, la fiche passe
 * sous (ou au-dessus de) Rai ; partout ailleurs, à côté de lui, du côté de l'écran.
 */
export function companionLayout(corner: Corner, open: boolean, rai: boolean) {
  const [v = "top", h = "right"] = corner.split("-");
  const card = open ? EXPANDED : { w: COMPACT.w, h: rai ? TALK_H : COMPACT.h };
  const m = SHADOW_MARGIN;
  const off = RAI_SIZE + RAI_GAP + m;
  if (!rai) return { frame: { w: card.w + 2 * m, h: card.h + 2 * m }, card: {}, rai: {} };
  const stacked = h === "center";
  const frame = stacked
    ? { w: Math.max(RAI_SIZE, card.w) + 2 * m, h: RAI_SIZE + RAI_GAP + card.h + 2 * m }
    : { w: RAI_SIZE + RAI_GAP + card.w + 2 * m, h: Math.max(RAI_SIZE, card.h) + 2 * m };
  const cardPos: React.CSSProperties = stacked
    ? v === "bottom"
      ? { bottom: off }
      : { top: off }
    : h === "left"
      ? { left: off }
      : { right: off };
  const raiPos: React.CSSProperties = {
    ...(h === "left"
      ? { left: m }
      : h === "right"
        ? { right: m }
        : { left: `calc(50% - ${RAI_SIZE / 2}px)` }),
    ...(v === "top"
      ? { top: m }
      : v === "bottom"
        ? { bottom: m }
        : { top: `calc(50% - ${RAI_SIZE / 2}px)` }),
  };
  return { frame, card: cardPos, rai: raiPos };
}

/** Rai file de l'autre côté quand il gêne (D-044). */
export function mirrorCorner(corner: Corner): Corner {
  const [v, h] = corner.split("-");
  if (h === "center") return `${v === "top" ? "bottom" : "top"}-center` as Corner;
  return `${v}-${h === "left" ? "right" : "left"}` as Corner;
}
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
  // Place choisie, et place provisoire pendant une balade de pause (D-045).
  const homeCorner = data.settings.corner;
  const [wander, setWander] = useState<Corner | null>(null);
  const corner = wander ?? homeCorner;
  const openRef = useRef(open);
  openRef.current = open;
  const showRai = data.settings.showCompanion;
  const rai = useCompanion(data, now);

  // Fenêtre : on l'agrandit avant l'animation d'ouverture, on la réduit après celle de fermeture.
  useLayoutEffect(() => {
    let cancelled = false;
    let t: number | undefined;
    if (open) {
      const f = companionLayout(corner, true, showRai).frame;
      void widgetLayout(corner, f.w, f.h).then(() => {
        if (!cancelled) setExpandedFrame(true);
      });
    } else {
      setExpandedFrame(false);
      const f = companionLayout(corner, false, showRai).frame;
      t = window.setTimeout(() => void widgetLayout(corner, f.w, f.h), RESIZE_MS);
    }
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, corner, showRai]);

  // Widget replié, bouton enfoncé (D-040, D-041) :
  // - glissé : il s'aimante à la position la plus proche (coin ou milieu d'un bord) ; posé sur
  //   un autre écran, il y reste : le suivi de l'écran du curseur est coupé ;
  // - simple clic : il s'ouvre, épinglé, jusqu'au prochain clic à l'extérieur.
  const pressing = useRef(false);
  const press = useCallback(
    async (e: React.MouseEvent, onClick: () => void) => {
      if (open || e.button !== 0 || pressing.current) return;
      e.preventDefault();
      pressing.current = true;
      suspend(true);
      try {
        if ((await pressWidget()) === "click") {
          onClick();
          return;
        }
        const snap = await widgetSnap();
        if (!snap) return;
        setWander(null);
        const patch: Partial<Settings> = { corner: snap.corner };
        if (snap.movedScreen) patch.followCursorScreen = false;
        dispatch({ type: "settings/update", patch });
      } finally {
        pressing.current = false;
        suspend(false);
      }
    },
    [dispatch, open, suspend],
  );
  const openByClick = useCallback(() => {
    pin();
    void focusWidget();
  }, [pin]);

  // Rai : un clic le taquine ; le curseur qui s'attarde sur lui pendant un focus le fait filer.
  const pushRai = rai.push;
  const linger = useRef<number | undefined>(undefined);
  const onRaiDown = (e: React.MouseEvent) => {
    window.clearTimeout(linger.current);
    if (open) pushRai({ type: "poke" });
    else void press(e, () => pushRai({ type: "poke" }));
  };
  const onRaiEnter = () => {
    window.clearTimeout(linger.current);
    linger.current = window.setTimeout(() => {
      if (openRef.current || pressing.current || data.timer.phase !== "focus") return;
      pushRai({ type: "linger" });
      window.setTimeout(() => {
        setWander(null);
        dispatch({ type: "settings/update", patch: { corner: mirrorCorner(corner) } });
      }, 750);
    }, 2_000);
  };
  const onRaiLeave = () => window.clearTimeout(linger.current);

  // Balade : pendant une pause, toutes les 3 min si tu ne touches à rien, Rai change de place ;
  // à la fin de la pause, il rentre chez lui.
  const lastWander = useRef(0);
  const inBreak = data.timer.phase === "short_break" || data.timer.phase === "long_break";
  useEffect(() => {
    if (!inBreak) {
      lastWander.current = 0;
      if (wander) setWander(null);
      return;
    }
    if (lastWander.current === 0) lastWander.current = now;
    if (!showRai || !data.settings.companionWander || open) return;
    const last = lastInputAt();
    if (now - lastWander.current < WANDER_MS || (last !== null && now - last < 15_000)) return;
    lastWander.current = now;
    const options = CORNERS.filter((c) => c !== corner);
    const next = options[Math.floor(Math.random() * options.length)] ?? null;
    pushRai({ type: "wander" });
    window.setTimeout(() => setWander(next), 750);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- au tick
  }, [now, inBreak]);

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
        // La prolongation, elle, se lit dans l'état du minuteur (forme super).
        if (r.kind === "task") pushRai({ type: "taskDone" });
        else if (r.kind === "focus") pushRai({ type: "focusEnd" });
        else if (r.kind === "break") pushRai({ type: "breakEnd" });
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
    [pushRai],
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

  const layout = companionLayout(corner, open && expandedFrame, showRai);
  useHitRects(now);
  const speech = showRai && data.settings.companionBubbles ? rai.speech : null;
  const talking = !!speech && !open;
  const [, hSide] = corner.split("-");

  return (
    <>
      {showRai && (
        <Rai
          pose={rai.pose}
          flip={hSide === "left"}
          style={layout.rai}
          onMouseDown={onRaiDown}
          onMouseEnter={onRaiEnter}
          onMouseLeave={onRaiLeave}
        />
      )}
      <div
        ref={card}
        className={[
          styles.card,
          anchorClass(corner),
          open && expandedFrame ? styles.open : "",
          talking ? styles.talk : "",
          isBreak ? styles.break : "",
        ].join(" ")}
        style={layout.card}
        data-hit
        {...handlers}
        onBlur={handlers.onBlur}
      >
        {pending && <span className={styles.pending} aria-label="Focus terminé" />}

        {talking && speech && (
          <div
            className={styles.speech}
            onMouseDown={(e) => void press(e, openByClick)}
            aria-live="polite"
            lang="ja"
          >
            {data.settings.companionJapanese && (
              <span className={styles.ja}>
                {speech.ja}
                <small className={styles.romaji}>{speech.romaji}</small>
              </span>
            )}
            {speech.text && (
              <span className={styles.tr} lang={data.settings.companionLang}>
                {speech.text}
              </span>
            )}
          </div>
        )}

        <div
          className={styles.compact}
          aria-hidden={open || talking}
          onMouseDown={(e) => void press(e, openByClick)}
          title="Cliquer pour ouvrir · glisser pour déplacer"
        >
          <div className={styles.miniEnso}>{enso}</div>
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
                <div className={styles.bigTime}>{time}</div>
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
    </>
  );
}

/**
 * Signale à macOS les zones opaques du widget (fiche, Rai, avec la marge de l'ombre) : le reste de
 * la fenêtre, transparent, laisse passer les clics (D-045). Recalculé à chaque changement de taille
 * (ouverture, bulle) et à chaque seconde, envoyé seulement s'il a changé.
 */
function useHitRects(now: number) {
  const last = useRef("");
  const report = useCallback(() => {
    const rects = [...document.querySelectorAll<HTMLElement>("[data-hit]")].map((el) => {
      const r = el.getBoundingClientRect();
      return [r.left - 4, r.top - 4, r.width + 8, r.height + 8].map(Math.round) as [
        number,
        number,
        number,
        number,
      ];
    });
    const key = JSON.stringify(rects);
    if (key !== last.current) {
      last.current = key;
      void setHitRects(rects);
    }
  }, []);
  useEffect(() => {
    const ro = new ResizeObserver(report);
    document.querySelectorAll("[data-hit]").forEach((el) => ro.observe(el));
    window.addEventListener("resize", report);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", report);
    };
  });
  useEffect(report, [now, report]);
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
