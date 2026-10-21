// État C : vue complète (brief §4). Onglets Tâches, Activité, Réglages ; premier lancement.

import { useEffect, useState } from "react";
import { fr } from "../i18n/fr";
import { onReward, useSakura } from "../state/store";
import { spawnPetals } from "../ui/petals";
import { ActivityTab } from "./ActivityTab";
import { Onboarding } from "./Onboarding";
import { SettingsTab } from "./SettingsTab";
import { TasksTab } from "./TasksTab";
import styles from "./main.module.css";

type Tab = "tasks" | "activity" | "settings";
const TABS: [Tab, string][] = [
  ["tasks", "Tâches"],
  ["activity", "Activité"],
  ["settings", "Réglages"],
];

export function MainApp() {
  const status = useSakura((s) => s.status);
  const data = useSakura((s) => s.data);
  const [tab, setTab] = useState<Tab>("tasks");

  // Tâche cochée ici : les pétales tombent dans cette fenêtre (D-027).
  useEffect(
    () =>
      onReward((r) => {
        if (r.kind !== "task" || r.origin !== "main" || r.tier >= 4) return;
        spawnPetals({
          count: [16, 28, 40][r.tier - 1]! + 2 * r.points,
          from: { x: 0, y: 0, w: innerWidth, h: 60 },
          fall: innerHeight * 0.7,
          gust: r.tier === 3 ? -140 : -30,
        });
      }),
    [],
  );

  if (status !== "ready" || !data) return <StatusScreen />;
  if (!data.settings.onboarded) return <Onboarding />;

  return (
    <div className={styles.app}>
      <nav className={styles.tabs} role="tablist" aria-label="Sections">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            className={styles.tab}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <section
        className={styles.panel}
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
      >
        {tab === "tasks" && <TasksTab data={data} />}
        {tab === "activity" && <ActivityTab data={data} />}
        {tab === "settings" && <SettingsTab data={data} />}
      </section>
    </div>
  );
}

/** Chargement, iCloud, fichier illisible ou trop récent (brief §4, états à concevoir). */
function StatusScreen() {
  const { status, detail, backups, restore } = useSakura();
  const title = status === "ready" ? "" : fr.status[status];
  return (
    <main className={styles.statusScreen}>
      <div
        className={`${styles.statusCard} ${status === "corrupt" || status === "error" ? styles.alert : ""}`}
      >
        <h1 className={styles.statusTitle}>{title}</h1>
        {status === "corrupt" && (
          <>
            <p>
              <b>sakura-data.json</b> est endommagé ({detail}). Rien n'a été écrasé.
            </p>
            {backups.length > 0 ? (
              <>
                <p>Restaure la dernière sauvegarde pour reprendre où tu en étais.</p>
                <div className={styles.row}>
                  {backups.slice(0, 3).map((b, i) => (
                    <button
                      key={b}
                      className={`${styles.btn} ${i === 0 ? styles.primary : ""}`}
                      onClick={() => restore(b)}
                    >
                      Restaurer la sauvegarde du {b.slice(12, 22).split("-").reverse().join("/")}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p>
                Aucune sauvegarde n'existe encore. Choisis un autre fichier dans Réglages après
                l'avoir déplacé, ou contacte-moi.
              </p>
            )}
          </>
        )}
        {status === "too_new" && (
          <p>
            Ce fichier a été écrit par une version plus récente de Sakura ({detail}). Mets l'app à
            jour depuis la page Releases ; ton fichier n'a pas été modifié.
          </p>
        )}
        {status === "icloud_pending" && (
          <p>
            Le minuteur fonctionne déjà. Tes tâches s'afficheront dès que le fichier sera
            téléchargé.
          </p>
        )}
        {status === "error" && <p className={styles.muted}>{detail}</p>}
      </div>
    </main>
  );
}
