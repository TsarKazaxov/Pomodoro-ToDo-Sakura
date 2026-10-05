// Accès disque de production : commandes Rust définies dans src-tauri/src/store.rs (D-022).

import { invoke } from "@tauri-apps/api/core";
import type { FsAdapter } from "./dataStore";

export const tauriFs: FsAdapter = {
  readText: (path) => invoke<string | null>("fs_read_text", { path }),
  writeAtomic: (path, text) => invoke<void>("fs_write_atomic", { path, contents: text }),
  listDir: (path) => invoke<string[]>("fs_list_dir", { path }),
  remove: (path) => invoke<void>("fs_remove", { path }),
  mkdirp: (path) => invoke<void>("fs_mkdirp", { path }),
  mtime: (path) => invoke<number | null>("fs_mtime", { path }),
};

/** Dossier par défaut : iCloud Drive/Sakura s'il existe, sinon le dossier de données de l'app. */
export const defaultDataDir = () => invoke<string>("default_data_dir");
