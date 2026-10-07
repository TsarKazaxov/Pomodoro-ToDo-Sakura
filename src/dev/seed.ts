// Données de démonstration, en développement uniquement (`/?view=widget&seed=1`) :
// 30 tâches courantes et 120 jours d'historique, comme le prototype de la Phase 1.

import { createEmptyData, DEFAULT_SCALE } from "../core/schema";
import { toLocalIso } from "../core/time";
import type { DataFile, Session, Size, Task } from "../core/types";

const TITLES = [
  "Audit de l'onboarding",
  "Maquette de l'écran de paiement",
  "Revue accessibilité du formulaire",
  "Atelier avec l'équipe produit",
  "Prototype du tableau de bord",
  "Synthèse des entretiens utilisateurs",
  "Mettre à jour la bibliothèque d'icônes",
  "États vides de la recherche",
  "Spec du composant Toast",
  "Préparer la démo de vendredi",
  "Répondre aux retours dev sur le header",
  "Benchmark des filtres",
  "Parcours de résiliation",
  "Revoir les tokens de couleur",
  "Guide des tests utilisateurs",
  "Wireframes des notifications",
  "Microcopy des messages d'erreur",
  "Handoff de la page profil",
  "Planifier le sprint design",
  "Refonte des cartes produit",
  "Vérifier les contrastes du mode sombre",
  "Écran de bienvenue mobile",
  "Documenter le composant Tableau",
  "Variantes du bouton principal",
  "Animation de chargement",
  "Relire la PR du menu",
  "Carte d'empathie client B2B",
  "Entretien client n° 4",
  "Nettoyer le fichier Figma",
  "Revue design hebdo",
  "Arborescence du centre d'aide",
];
const FACTOR: Record<Size, number> = { XS: 1, S: 0.72, M: 1.38, L: 1.08, XL: 1.2 };

function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

export function demoData(now: number, extraTasks = 0): DataFile {
  const r = rng(20261005);
  const pick = <T>(a: readonly T[]) => a[Math.floor(r() * a.length)]!;
  const d = createEmptyData("demo", now);
  const tasks: Task[] = [];
  const sessions: Session[] = [];
  let n = 0;
  const day0 = new Date(now);
  day0.setHours(0, 0, 0, 0);
  let xl = 0;
  for (let back = 119; back >= 1; back--) {
    const day = new Date(day0);
    day.setDate(day.getDate() - back);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    if (r() > (weekend ? 0.12 : 0.82)) continue;
    const count = Math.floor(r() * 3.4 * (0.55 + 0.45 * (1 - back / 120)) + 0.6);
    for (let i = 0; i < count; i++) {
      let size: Size = ((x) =>
        x < 0.25 ? "XS" : x < 0.55 ? "S" : x < 0.85 ? "M" : x < 0.97 ? "L" : "XL")(r());
      if (size === "XL" && xl++ >= 3) size = "L";
      const p = Math.max(
        1,
        Math.round(DEFAULT_SCALE[size].expectedPomodoros * FACTOR[size] * (0.78 + r() * 0.44)),
      );
      const at = new Date(day);
      at.setHours(9 + Math.floor(r() * 9), Math.floor(r() * 60));
      const iso = toLocalIso(at.getTime());
      const id = `h${n++}`;
      tasks.push({
        id,
        title: pick(TITLES),
        size,
        priority: false,
        status: "done",
        createdAt: iso,
        completedAt: iso,
        pomodorosSpent: p,
        order: 1000 + n,
        updatedAt: iso,
      });
      for (let k = 0; k < Math.min(p, 6); k++)
        sessions.push({
          id: `s${n}-${k}`,
          type: "focus",
          taskId: id,
          startedAt: iso,
          endedAt: iso,
          completed: true,
          pausedMs: 0,
        });
    }
    if (count === 0) {
      const iso = toLocalIso(day.getTime() + 10 * 3600_000);
      sessions.push({
        id: `f${back}`,
        type: "focus",
        startedAt: iso,
        endedAt: iso,
        completed: true,
        pausedMs: 0,
      });
    }
    if (r() < 0.35) {
      const iso = toLocalIso(day.getTime() + 15 * 3600_000);
      sessions.push({
        id: `i${back}`,
        type: "focus",
        startedAt: iso,
        endedAt: iso,
        completed: false,
        pausedMs: 0,
      });
    }
  }
  const nowIso = toLocalIso(now);
  TITLES.slice(0, 30).forEach((title, i) => {
    const status = i === 0 ? "doing" : i < 26 ? "todo" : i < 29 ? "done" : "dropped";
    const size: Size = i === 2 ? "XL" : pick(["XS", "S", "S", "M", "M", "L"] as const);
    const t: Task = {
      id: `t${i}`,
      title,
      size,
      priority: i < 5,
      status,
      createdAt: nowIso,
      pomodorosSpent: i === 0 ? 2 : status === "done" ? 2 : 0,
      order: i,
      updatedAt: nowIso,
    };
    if (status === "done") t.completedAt = nowIso;
    tasks.push(t);
  });
  for (let i = 0; i < extraTasks; i++) {
    tasks.push({
      id: `x${i}`,
      title: `Tâche de charge ${i}`,
      size: pick(["XS", "S", "M", "L"] as const),
      priority: false,
      status: "todo",
      createdAt: nowIso,
      pomodorosSpent: 0,
      order: 30 + i,
      updatedAt: nowIso,
    });
  }
  d.tasks = tasks;
  d.sessions = sessions;
  d.settings.onboarded = true;
  return d;
}
