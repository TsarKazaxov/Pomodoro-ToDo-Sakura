// Onglet Tâches : backlog complet, glisser-déposer, filtres, édition en ligne, épinglage.

import { memo, useCallback, useMemo, useRef, useState } from "react";
import { childrenOf, effortOf, formatMinutes, spentByTask } from "../core/effort";
import {
  SIZES,
  TASK_STATUSES,
  type DataFile,
  type Size,
  type Task,
  type TaskStatus,
} from "../core/types";
import { useSakura } from "../state/store";
import { useNow } from "../ui/hooks";
import styles from "./main.module.css";

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "À faire",
  doing: "En cours",
  done: "Terminée",
  dropped: "Abandonnée",
};
const FILTERS: [TaskStatus | "open" | "all", string][] = [
  ["open", "Ouvertes"],
  ["todo", "À faire"],
  ["doing", "En cours"],
  ["done", "Terminées"],
  ["dropped", "Abandonnées"],
  ["all", "Toutes"],
];

export function TasksTab({ data }: { data: DataFile }) {
  const dispatch = useSakura((s) => s.dispatch);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<(typeof FILTERS)[number][0]>("open");
  const [sizes, setSizes] = useState<Set<Size>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const dragRef = useRef<string | null>(null);
  const dnd = useMemo<DnD>(
    () => ({
      start(id) {
        dragRef.current = id;
        setDragId(id);
      },
      end() {
        dragRef.current = null;
        setDragId(null);
        setOverId(null);
      },
      over(id) {
        setOverId((cur) => (cur === id ? cur : id));
      },
      drop(id) {
        const from = dragRef.current;
        if (from && from !== id) dispatch({ type: "task/move", id: from, beforeId: id });
        dragRef.current = null;
        setDragId(null);
        setOverId(null);
      },
    }),
    [dispatch],
  );

  // Tâches de premier niveau ; une tâche apparaît aussi si l'une de ses sous-tâches correspond
  // aux filtres (D-046).
  const matches = useCallback(
    (t: Task) =>
      (status === "all"
        ? true
        : status === "open"
          ? t.status === "todo" || t.status === "doing"
          : t.status === status) &&
      (sizes.size === 0 || sizes.has(t.size)),
    [status, sizes],
  );
  const list = useMemo(
    () =>
      data.tasks
        .filter((t) => !t.parentId)
        .filter((t) => matches(t) || childrenOf(data.tasks, t.id).some(matches))
        .sort((a, b) => a.order - b.order),
    [data.tasks, matches],
  );
  const now = useNow(15_000);
  const spent = useMemo(() => spentByTask(data, now), [data, now]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggleOpen = useCallback(
    (id: string) =>
      setOpen((prev) => {
        const n = new Set(prev);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    [],
  );
  const counts = useMemo(() => {
    const c = { todo: 0, doing: 0, done: 0, dropped: 0 };
    for (const t of data.tasks) c[t.status]++;
    return c;
  }, [data.tasks]);

  const toggleSize = (s: Size) =>
    setSizes((prev) => {
      const n = new Set(prev);
      if (n.has(s)) n.delete(s);
      else n.add(s);
      return n;
    });

  return (
    <div className={styles.tasks}>
      <div className={styles.toolbar}>
        <input
          className={styles.add}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              dispatch({ type: "task/quickAdd", raw: draft, priority: false });
              setDraft("");
            }
          }}
          placeholder="Nouvelle tâche, ex. : Audit du parcours de paiement #L"
          aria-label="Nouvelle tâche"
        />
        <div className={styles.chips} role="group" aria-label="Filtrer par statut">
          {FILTERS.map(([id, label]) => (
            <button
              key={id}
              className={styles.chip}
              aria-pressed={status === id}
              onClick={() => setStatus(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={styles.chips} role="group" aria-label="Filtrer par taille">
          {SIZES.map((s) => (
            <button
              key={s}
              className={styles.chip}
              aria-pressed={sizes.has(s)}
              onClick={() => toggleSize(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {data.tasks.length === 0 ? (
        <p className={styles.emptyState}>
          Aucune tâche pour l'instant. Écris la première ci-dessus, par exemple{" "}
          <code>Revoir la maquette #M</code> : le
          <code>#M</code> donne sa taille (XS, S, M, L ou XL).
        </p>
      ) : list.length === 0 ? (
        <p className={styles.emptyState}>Aucune tâche ne correspond à ces filtres.</p>
      ) : (
        <ul className={styles.taskList} onDragOver={(e) => dragId && e.preventDefault()}>
          {list.flatMap((t) => {
            const e = effortOf(t, data.tasks, spent, data.settings.scale);
            const expanded = open.has(t.id);
            const rows = [
              <TaskRow
                key={t.id}
                task={t}
                spentMin={e.spentMin}
                budgetMin={e.budgetMin}
                subDone={e.subtasks.done}
                subTotal={e.subtasks.total}
                expanded={expanded}
                onToggle={toggleOpen}
                dragging={dragId === t.id}
                over={overId === t.id && dragId !== t.id}
                dnd={dnd}
              />,
            ];
            if (expanded) {
              for (const c of childrenOf(data.tasks, t.id).filter(matches)) {
                const ce = effortOf(c, data.tasks, spent, data.settings.scale);
                rows.push(
                  <TaskRow
                    key={c.id}
                    task={c}
                    child
                    spentMin={ce.spentMin}
                    budgetMin={ce.budgetMin}
                    subDone={0}
                    subTotal={0}
                    expanded={false}
                    onToggle={toggleOpen}
                    dragging={false}
                    over={false}
                    dnd={dnd}
                  />,
                );
              }
              rows.push(
                <li key={`${t.id}-add`} className={styles.subAdd}>
                  <SubtaskInput
                    parentId={t.id}
                    planned={e.subtasks.plannedMin}
                    budget={e.budgetMin}
                  />
                </li>,
              );
            }
            return rows;
          })}
        </ul>
      )}
      <p className={styles.foot}>
        {data.tasks.length} tâches · {counts.todo} à faire · {counts.doing} en cours · {counts.done}{" "}
        terminées · {counts.dropped} abandonnées. Glisse une ligne par sa poignée pour la
        réordonner.
      </p>
    </div>
  );
}

interface DnD {
  start(id: string): void;
  end(): void;
  over(id: string): void;
  drop(id: string): void;
}

interface RowProps {
  task: Task;
  /** Sous-tâche, affichée en retrait sous sa tâche. */
  child?: boolean;
  spentMin: number;
  budgetMin: number;
  subDone: number;
  subTotal: number;
  expanded: boolean;
  onToggle(id: string): void;
  dragging: boolean;
  over: boolean;
  /** Stable d'un rendu à l'autre : seules les lignes modifiées se redessinent (1 000 tâches). */
  dnd: DnD;
}

/**
 * L'état arrive de la fenêtre propriétaire par copie (D-026) : chaque tâche est un nouvel objet
 * à chaque mise à jour. On compare donc les champs affichés, pas les références.
 */
function sameRow(a: RowProps, b: RowProps): boolean {
  const x = a.task;
  const y = b.task;
  return (
    a.child === b.child &&
    a.spentMin === b.spentMin &&
    a.budgetMin === b.budgetMin &&
    a.subDone === b.subDone &&
    a.subTotal === b.subTotal &&
    a.expanded === b.expanded &&
    a.onToggle === b.onToggle &&
    a.dragging === b.dragging &&
    a.over === b.over &&
    a.dnd === b.dnd &&
    x.id === y.id &&
    x.title === y.title &&
    x.size === y.size &&
    x.status === y.status &&
    x.priority === y.priority &&
    x.pomodorosSpent === y.pomodorosSpent
  );
}

const TaskRow = memo(function TaskRow({
  task: t,
  child,
  spentMin,
  budgetMin,
  subDone,
  subTotal,
  expanded,
  onToggle,
  dragging,
  over,
  dnd,
}: RowProps) {
  const dispatch = useSakura((s) => s.dispatch);
  const title = useRef<HTMLInputElement>(null);
  const commitTitle = () => {
    const v = title.current?.value.trim() ?? "";
    if (v && v !== t.title) dispatch({ type: "task/update", id: t.id, patch: { title: v } });
    else if (title.current) title.current.value = t.title;
  };
  return (
    <li
      className={[
        styles.taskRow,
        styles[`is_${t.status}`],
        child ? styles.subRow : "",
        dragging ? styles.dragging : "",
        over ? styles.over : "",
      ].join(" ")}
      draggable={!child}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", t.id);
        dnd.start(t.id);
      }}
      onDragEnd={dnd.end}
      onDragOver={(e) => {
        e.preventDefault();
        dnd.over(t.id);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dnd.drop(t.id);
      }}
    >
      {child ? (
        <span className={styles.grip} aria-hidden="true">
          ↳
        </span>
      ) : (
        <span className={styles.grip} aria-hidden="true" title="Glisser pour réordonner">
          ⋮⋮
        </span>
      )}
      <input
        type="checkbox"
        className={styles.tick}
        checked={t.status === "done"}
        onChange={(e) =>
          dispatch({ type: "task/setStatus", id: t.id, status: e.target.checked ? "done" : "todo" })
        }
        aria-label={`Terminer ${t.title}`}
      />
      <input
        ref={title}
        className={styles.titleInput}
        defaultValue={t.title}
        key={t.title}
        onBlur={commitTitle}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape" && title.current) {
            title.current.value = t.title;
            title.current.blur();
          }
        }}
        aria-label="Titre"
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
      />
      <select
        className={styles.sizeSelect}
        value={t.size}
        onChange={(e) =>
          dispatch({ type: "task/update", id: t.id, patch: { size: e.target.value as Size } })
        }
        aria-label="Taille"
      >
        {SIZES.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <span
        className={`${styles.pom} ${spentMin > budgetMin ? styles.overBudget : ""}`}
        title={
          spentMin > budgetMin
            ? `Dépassé de ${formatMinutes(spentMin - budgetMin)}`
            : `Reste ${formatMinutes(budgetMin - spentMin)} sur l'estimation`
        }
      >
        {formatMinutes(spentMin)} / {formatMinutes(budgetMin)}
        <i
          className={styles.effortBar}
          style={
            { "--p": Math.min(1, budgetMin ? spentMin / budgetMin : 0) } as React.CSSProperties
          }
          aria-hidden="true"
        />
      </span>
      {child ? (
        <span />
      ) : (
        <button
          className={styles.subToggle}
          aria-expanded={expanded}
          onClick={() => onToggle(t.id)}
          title={subTotal ? "Sous-tâches" : "Ajouter des sous-tâches"}
        >
          {subTotal ? `${subDone}/${subTotal}` : "＋"}
          <span className={styles.srOnly}> sous-tâches</span>
        </button>
      )}
      <button
        className={styles.pin}
        aria-pressed={t.priority}
        aria-label={t.priority ? "Retirer des priorités du jour" : "Épingler en priorité du jour"}
        title={t.priority ? "Retirer des priorités du jour" : "Épingler en priorité du jour"}
        onClick={() =>
          dispatch({ type: "task/update", id: t.id, patch: { priority: !t.priority } })
        }
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path
            fill="currentColor"
            d="M9.8 1.5 14.5 6.2 13.4 7.3 12.6 6.9 9.9 9.6 10.2 12.4 9.1 13.5 6.6 11 3.2 14.4 1.6 14.4 1.6 12.8 5 9.4 2.5 6.9 3.6 5.8 6.4 6.1 9.1 3.4 8.7 2.6Z"
          />
        </svg>
      </button>
      <select
        className={styles.statusSelect}
        value={t.status}
        onChange={(e) =>
          dispatch({ type: "task/setStatus", id: t.id, status: e.target.value as TaskStatus })
        }
        aria-label="Statut"
      >
        {TASK_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    </li>
  );
}, sameRow);

/** Ajout d'une sous-tâche sous la tâche dépliée, avec le total estimé du découpage. */
function SubtaskInput({
  parentId,
  planned,
  budget,
}: {
  parentId: string;
  planned: number;
  budget: number;
}) {
  const dispatch = useSakura((s) => s.dispatch);
  const [draft, setDraft] = useState("");
  return (
    <>
      <input
        className={styles.add}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft.trim()) {
            dispatch({ type: "task/addSubtask", parentId, raw: draft });
            setDraft("");
          }
        }}
        placeholder="Sous-tâche, ex. : Maquette mobile #S"
        aria-label="Nouvelle sous-tâche"
      />
      <span className={`${styles.subPlan} ${planned > budget ? styles.overBudget : ""}`}>
        Découpage : {formatMinutes(planned)} sur {formatMinutes(budget)} estimées
      </span>
    </>
  );
}
