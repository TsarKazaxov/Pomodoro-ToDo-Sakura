// Onglet Activité : heatmap 26 semaines, calibration par taille, indicateurs, points par jour.

import { useMemo, useState } from "react";
import {
  adaptiveThresholds,
  averagePoints,
  buildDayMap,
  calibration,
  completionRate,
  heatGrid,
  heatLevel,
  streak,
  type DayStats,
} from "../core/stats";
import { addDays, dayKeyAt } from "../core/time";
import type { DataFile } from "../core/types";
import { formatDayKey, plural } from "../ui/format";
import { useNow } from "../ui/hooks";
import styles from "./main.module.css";

const WEEKS = 26;
const CELL = 13;
const GAP = 3;
const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "short" });
const shortMonth = (key: string) => {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return monthFmt.format(new Date(y, m - 1, d)).replace(".", "");
};
const fmt1 = (n: number) => n.toFixed(1).replace(".", ",");

interface Tip {
  key: string;
  x: number;
  y: number;
}

export function ActivityTab({ data }: { data: DataFile }) {
  const now = useNow(60_000);
  const today = dayKeyAt(now);
  const days = useMemo(() => buildDayMap(data.tasks, data.sessions, data.settings.scale), [data]);
  const th = useMemo(() => adaptiveThresholds(days), [days]);
  const grid = useMemo(() => heatGrid(today, WEEKS), [today]);
  const calib = useMemo(() => calibration(data.tasks, data.settings.scale), [data]);
  const [tip, setTip] = useState<Tip | null>(null);
  const titles = useMemo(
    () => new Map(data.tasks.map((t) => [t.id, `${t.title} · ${t.size}`])),
    [data.tasks],
  );

  const rate = completionRate(days, today);
  const st = streak(days, today);
  const hasData = days.size > 0;

  // Libellés de mois : au premier lundi de chaque mois visible.
  const months: { col: number; label: string }[] = [];
  for (let w = 0; w < WEEKS; w++) {
    const k = grid[w * 7];
    if (!k) continue;
    const prev = w > 0 ? grid[(w - 1) * 7] : null;
    if (!prev || prev.slice(5, 7) !== k.slice(5, 7)) months.push({ col: w, label: shortMonth(k) });
  }

  return (
    <div className={styles.activity}>
      <div className={styles.stats}>
        <Stat value={fmt1(averagePoints(days, today))} label="points par jour, moyenne 7 jours" />
        <Stat
          value={String(st)}
          label={st > 1 ? "jours actifs d'affilée" : "jour actif d'affilée"}
        />
        <Stat
          value={rate === null ? "—" : `${Math.round(rate * 100)} %`}
          label="pomodoros terminés, 30 derniers jours"
        />
        <Stat value={String(days.get(today)?.points ?? 0)} label="points aujourd'hui" />
      </div>

      <section>
        <div className={styles.cardTitle}>
          <h2>26 semaines</h2>
          <div className={styles.legend}>
            Moins
            {[0, 1, 2, 3, 4].map((l) => (
              <i key={l} style={{ background: `var(--m${l})` }} />
            ))}
            Plus <span>· point = pomodoros sans tâche terminée</span>
          </div>
        </div>
        {!hasData && (
          <p className={styles.emptyState}>
            Ta première case se colorera quand tu termineras une tâche.
          </p>
        )}
        <div className={styles.scrollX}>
          <div className={styles.heatFrame}>
            <div className={styles.heatMonths} style={{ width: WEEKS * (CELL + GAP) }}>
              {months.map((m) => (
                <span key={m.col} style={{ left: m.col * (CELL + GAP) }}>
                  {m.label}
                </span>
              ))}
            </div>
            <div className={styles.heatDays}>
              <span>lun</span>
              <span />
              <span>mer</span>
              <span />
              <span>ven</span>
              <span />
              <span />
            </div>
            <div
              className={styles.heatBig}
              role="img"
              aria-label="Activité des 26 dernières semaines"
              onMouseLeave={() => setTip(null)}
            >
              {grid.map((k, i) => {
                if (!k) return <i key={i} className={styles.future} />;
                const d = days.get(k);
                const lv = heatLevel(d?.points ?? 0, th);
                return (
                  <i
                    key={k}
                    className={[
                      styles[`l${lv}`],
                      d && d.points === 0 && d.pomodoros > 0 ? styles.dot : "",
                      k === today ? styles.today : "",
                    ].join(" ")}
                    onMouseEnter={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setTip({ key: k, x: r.left + r.width / 2, y: r.top });
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
        {tip && <DayTip tip={tip} day={days.get(tip.key)} titles={titles} />}
      </section>

      <section>
        <div className={styles.cardTitle}>
          <h2>Calibration</h2>
          <span className={styles.muted}>
            Pomodoros réels ÷ attendus, par taille. Visible dès 5 tâches terminées avec au moins un
            pomodoro.
          </span>
        </div>
        <div className={styles.calibHead}>
          <span />
          <span />
          <span className={styles.calibAxis}>
            <span>0,4</span>
            <span>1 = juste</span>
            <span>2</span>
          </span>
          <span />
        </div>
        {calib.map((c) => (
          <div key={c.size} className={styles.calibRow}>
            <span className={`${styles.size} ${c.size === "XL" ? styles.xl : ""}`}>{c.size}</span>
            {c.ratio === null ? (
              <>
                <span className={styles.muted}>
                  {c.count} terminée{c.count > 1 ? "s" : ""} sur 5 nécessaires
                </span>
                <Scale />
                <span className={styles.muted}>Pas encore assez de données</span>
              </>
            ) : (
              <>
                <span className={styles.muted}>
                  {fmt1(c.average!)} réels / {c.expected} attendus · {c.count} tâches
                </span>
                <Scale ratio={c.ratio} />
                <span className={c.verdict === "accurate" ? undefined : styles.warn}>
                  {c.verdict === "accurate"
                    ? "Estimation juste"
                    : c.verdict === "overestimate"
                      ? `Tu surestimes tes ${c.size}`
                      : `Tu sous-estimes tes ${c.size}`}{" "}
                  <span className={styles.muted}>(×{c.ratio.toFixed(2).replace(".", ",")})</span>
                </span>
              </>
            )}
          </div>
        ))}
      </section>

      <section>
        <div className={styles.cardTitle}>
          <h2>Points par jour</h2>
          <span className={styles.muted}>30 derniers jours</span>
        </div>
        <Bars days={days} today={today} />
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className={styles.stat}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

const pos = (r: number) => Math.min(100, Math.max(0, ((r - 0.4) / 1.6) * 100));

function Scale({ ratio }: { ratio?: number }) {
  return (
    <div
      className={styles.scale}
      title={ratio === undefined ? undefined : `Ratio ${ratio.toFixed(2)}`}
    >
      <div className={styles.axis} />
      {ratio !== undefined && (
        <>
          <div
            className={styles.band}
            style={{ left: `${pos(0.8)}%`, width: `${pos(1.2) - pos(0.8)}%` }}
          />
          <div className={styles.one} style={{ left: `${pos(1)}%` }} />
          <div className={styles.mark} style={{ left: `${pos(ratio)}%` }} />
        </>
      )}
    </div>
  );
}

function DayTip({
  tip,
  day,
  titles,
}: {
  tip: Tip;
  day: DayStats | undefined;
  titles: Map<string, string>;
}) {
  const d = day ?? { points: 0, taskIds: [], pomodoros: 0, interrupted: 0 };
  const left = Math.min(innerWidth - 250, Math.max(8, tip.x - 120));
  return (
    <div className={styles.tip} style={{ left, top: tip.y - 8 }} role="tooltip">
      <b>{formatDayKey(tip.key)}</b>
      <br />
      {plural(d.points, "point", "points")} · {plural(d.taskIds.length, "tâche", "tâches")} ·{" "}
      {plural(d.pomodoros, "pomodoro", "pomodoros")}
      {d.taskIds.length > 0 && (
        <ul>
          {d.taskIds.slice(0, 4).map((id) => (
            <li key={id}>{titles.get(id) ?? "Tâche supprimée"}</li>
          ))}
          {d.taskIds.length > 4 && <li>+ {d.taskIds.length - 4} autres</li>}
        </ul>
      )}
    </div>
  );
}

function Bars({ days, today }: { days: Map<string, DayStats>; today: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const list = Array.from({ length: 30 }, (_, i) => {
    const k = addDays(today, i - 29);
    return { k, p: days.get(k)?.points ?? 0 };
  });
  const max = Math.max(10, ...list.map((x) => x.p));
  const W = 600;
  const H = 120;
  const top = 12;
  const bot = 18;
  const bw = W / 30;
  const y = (v: number) => top + (H - top - bot) * (1 - v / max);
  const h = hover === null ? null : list[hover]!;
  return (
    <div className={styles.bars}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Points par jour, 30 derniers jours"
        onMouseLeave={() => setHover(null)}
      >
        <line x1={0} x2={W} y1={H - bot} y2={H - bot} />
        <line x1={0} x2={W} y1={y(max / 2)} y2={y(max / 2)} strokeDasharray="2 3" />
        <text x={0} y={y(max / 2) - 3}>
          {Math.round(max / 2)} pts
        </text>
        {list.map((x, i) => {
          const bh = ((H - top - bot) * x.p) / max;
          return (
            <g key={x.k} onMouseEnter={() => setHover(i)}>
              {x.p > 0 && (
                <rect
                  className={`${styles.bar} ${i === 29 ? styles.barToday : ""} ${hover === i ? styles.barHover : ""}`}
                  x={i * bw + 3}
                  y={H - bot - bh}
                  width={bw - 6}
                  height={bh}
                  rx={2}
                />
              )}
              <rect className={styles.hit} x={i * bw} y={0} width={bw} height={H} />
              {(i % 7 === 1 || i === 29) && (
                <text x={i * bw + bw / 2} y={H - 4} textAnchor="middle">
                  {i === 29 ? "auj." : `${Number(x.k.slice(8))} ${shortMonth(x.k)}`}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className={styles.muted} aria-live="polite">
        {h
          ? `${formatDayKey(h.k)} : ${plural(h.p, "point", "points")}`
          : "Survole une barre pour le détail."}
      </p>
    </div>
  );
}
