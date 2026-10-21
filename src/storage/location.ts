// Emplacement du fichier de données, propre à chaque Mac (D-029) : il ne peut pas vivre dans
// le fichier de données lui-même. Stocké dans `<config de l'app>/location.json`.

import { invoke } from "@tauri-apps/api/core";
import { joinPath } from "./dataStore";
import { defaultDataDir, tauriFs } from "./tauriFs";

const configFile = async () => joinPath(await invoke<string>("app_config_dir"), "location.json");

export async function resolveDataDir(): Promise<string> {
  try {
    const text = await tauriFs.readText(await configFile());
    const dir = text ? (JSON.parse(text) as { dataDir?: unknown }).dataDir : null;
    if (typeof dir === "string" && dir.startsWith("/")) return dir;
  } catch {
    // Fichier de config absent ou illisible : emplacement par défaut.
  }
  return defaultDataDir();
}

export async function saveDataDir(dir: string): Promise<void> {
  const path = await configFile();
  await tauriFs.mkdirp(path.slice(0, path.lastIndexOf("/")));
  await tauriFs.writeAtomic(path, JSON.stringify({ dataDir: dir }, null, 2));
}
