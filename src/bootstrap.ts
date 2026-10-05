// Démarrage d'une fenêtre : le widget devient propriétaire des données, la vue complète cliente.

import { inTauri, petalRain, windowLabel } from "./platform";
import { initClient, initOwner } from "./state/store";
import { tauriTransport } from "./state/tauriTransport";
import { DataStore } from "./storage/dataStore";
import { MemoryFs } from "./storage/memoryFs";
import { defaultDataDir, tauriFs } from "./storage/tauriFs";
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
      const dir = inTauri ? await defaultDataDir() : "/apercu";
      await initOwner({
        transport,
        label,
        disk: new DataStore(inTauri ? tauriFs : new MemoryFs(), dir),
        deviceId: deviceId(),
        hooks: {
          playChime: (strikes, gain) => chime(strikes, gain),
          screenRain: (tier, origin) => {
            if (tier >= 4) void petalRain("screen");
            else if (origin === "widget") void petalRain("around");
          },
        },
      });
    })();
    return "widget";
  }
  initClient({ transport, label });
  return "main";
}
