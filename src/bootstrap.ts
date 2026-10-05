// Démarrage d'une fenêtre : le widget devient propriétaire des données, la vue complète cliente.

import { inTauri, petalRain, showMain, windowLabel } from "./platform";
import { initClient, initOwner } from "./state/store";
import { tauriTransport } from "./state/tauriTransport";
import { DataStore } from "./storage/dataStore";
import { MemoryFs } from "./storage/memoryFs";
import { resolveDataDir, saveDataDir } from "./storage/location";
import { tauriFs } from "./storage/tauriFs";
import { chime } from "./ui/sound";
import { localTransport } from "./state/localTransport";

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

export function startWindow(): "widget" | "main" | "rain" {
  if (location.hash.startsWith("#rain=")) return "rain";
  const label = windowLabel();
  const transport = inTauri ? tauriTransport : localTransport;
  if (label === "widget") {
    void (async () => {
      const fs = inTauri ? tauriFs : new MemoryFs();
      // Aperçu navigateur : `?seed=1` charge les données de démonstration (`&load=1000` : 1 000 tâches de plus).
      if (!inTauri && import.meta.env.DEV) {
        const q = new URLSearchParams(location.search);
        if (q.has("seed")) {
          const { demoData } = await import("./dev/seed");
          const { serialize } = await import("./core/schema");
          await fs.mkdirp("/apercu");
          await fs.writeAtomic(
            "/apercu/sakura-data.json",
            serialize(demoData(Date.now(), Number(q.get("load")) || 0)),
          );
        }
      }
      await initOwner({
        transport,
        label,
        dataDir: inTauri ? await resolveDataDir() : "/apercu",
        openStore: (dir) => new DataStore(fs, dir),
        deviceId: deviceId(),
        hooks: {
          playChime: (strikes, gain) => chime(strikes, gain),
          screenRain: (tier, origin) => {
            if (tier >= 4) void petalRain("screen");
            else if (origin === "widget") void petalRain("around");
          },
          // Premier lancement ou fichier à réparer : la vue complète s'ouvre d'elle-même.
          afterLoad: (s) => {
            if (s.status !== "ready" || !s.data?.settings.onboarded) void showMain();
          },
          saveLocation: (dir) => (inTauri ? saveDataDir(dir) : Promise.resolve()),
        },
      });
    })();
    return "widget";
  }
  initClient({ transport, label });
  return "main";
}
