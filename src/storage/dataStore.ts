// Lecture et écriture du fichier de données, sauvegardes quotidiennes, rechargement.
//
// Toutes les opérations disque passent par `FsAdapter` : en production, des commandes Rust
// (écriture atomique avec fsync, voir src-tauri/src/store.rs) ; en test, un disque en mémoire.

import { dayKeyAt } from "../core/time";
import { parseDataFile, serialize } from "../core/schema";
import type { DataFile } from "../core/types";

export interface FsAdapter {
  /** Contenu du fichier, ou `null` s'il n'existe pas. */
  readText(path: string): Promise<string | null>;
  /** Écrit dans un fichier temporaire puis le renomme : jamais de fichier à moitié écrit. */
  writeAtomic(path: string, text: string): Promise<void>;
  /** Noms des entrées du dossier ; vide s'il n'existe pas. */
  listDir(path: string): Promise<string[]>;
  remove(path: string): Promise<void>;
  mkdirp(path: string): Promise<void>;
  /** Date de modification en ms, ou `null` si le fichier n'existe pas. */
  mtime(path: string): Promise<number | null>;
}

export const DATA_FILE = "sakura-data.json";
export const BACKUP_DIR = "backups";
export const KEEP_BACKUPS = 7;
const BACKUP_RE = /^sakura-data-(\d{4}-\d{2}-\d{2})\.json$/;

export const joinPath = (...parts: string[]) =>
  parts.map((p, i) => (i === 0 ? p.replace(/\/+$/, "") : p.replace(/^\/+|\/+$/g, ""))).join("/");

export type LoadResult =
  | { kind: "ok"; data: DataFile }
  | { kind: "missing" }
  /** Fichier évincé par le stockage optimisé d'iCloud : on attend son téléchargement (D-014). */
  | { kind: "icloud_pending" }
  | { kind: "corrupt"; reason: string; detail: string; backups: string[] }
  | { kind: "too_new"; detail: string };

export type SaveResult =
  | { kind: "saved" }
  /** Le fichier a changé sur le disque depuis la dernière lecture : relire avant d'écrire (D-014). */
  | { kind: "stale" };

export class DataStore {
  private knownMtime: number | null = null;

  constructor(
    private readonly fs: FsAdapter,
    readonly dir: string,
    private readonly now: () => number = Date.now,
  ) {}

  get filePath() {
    return joinPath(this.dir, DATA_FILE);
  }
  private get backupDir() {
    return joinPath(this.dir, BACKUP_DIR);
  }

  async load(): Promise<LoadResult> {
    const text = await this.fs.readText(this.filePath);
    if (text === null) {
      const names = await this.fs.listDir(this.dir);
      if (names.includes(`.${DATA_FILE}.icloud`)) return { kind: "icloud_pending" };
      this.knownMtime = null;
      return { kind: "missing" };
    }
    this.knownMtime = await this.fs.mtime(this.filePath);
    const r = parseDataFile(text);
    if (r.ok) return { kind: "ok", data: r.data };
    if (r.reason === "too_new") return { kind: "too_new", detail: r.detail };
    return {
      kind: "corrupt",
      reason: r.reason,
      detail: r.detail,
      backups: await this.listBackups(),
    };
  }

  /** Vrai si un autre processus (un autre Mac via iCloud) a modifié le fichier depuis notre lecture. */
  async hasExternalChange(): Promise<boolean> {
    return (await this.fs.mtime(this.filePath)) !== this.knownMtime;
  }

  /**
   * Écrit le fichier. Refuse (`stale`) si le fichier a changé depuis la dernière lecture, sauf
   * `force`. Avant la première écriture du jour, copie la version précédente en sauvegarde.
   */
  async save(data: DataFile, opts: { force?: boolean } = {}): Promise<SaveResult> {
    if (!opts.force && (await this.hasExternalChange())) return { kind: "stale" };
    await this.fs.mkdirp(this.dir);
    await this.backupBeforeFirstWriteOfDay();
    await this.fs.writeAtomic(this.filePath, serialize(data));
    this.knownMtime = await this.fs.mtime(this.filePath);
    return { kind: "saved" };
  }

  /** Sauvegardes disponibles, la plus récente d'abord. */
  async listBackups(): Promise<string[]> {
    const names = await this.fs.listDir(this.backupDir);
    return names
      .filter((n) => BACKUP_RE.test(n))
      .sort()
      .reverse();
  }

  /** Remplace le fichier principal par la sauvegarde `name` et la charge. */
  async restoreBackup(name: string): Promise<LoadResult> {
    if (!BACKUP_RE.test(name)) throw new Error(`Nom de sauvegarde invalide : ${name}`);
    const text = await this.fs.readText(joinPath(this.backupDir, name));
    if (text === null) throw new Error(`Sauvegarde introuvable : ${name}`);
    const r = parseDataFile(text);
    if (!r.ok)
      return {
        kind: "corrupt",
        reason: r.reason,
        detail: r.detail,
        backups: await this.listBackups(),
      };
    await this.fs.writeAtomic(this.filePath, text);
    this.knownMtime = await this.fs.mtime(this.filePath);
    return { kind: "ok", data: r.data };
  }

  private async backupBeforeFirstWriteOfDay() {
    const name = `sakura-data-${dayKeyAt(this.now())}.json`;
    const existing = await this.listBackups();
    if (existing.includes(name)) return;
    const current = await this.fs.readText(this.filePath);
    // On ne sauvegarde qu'un fichier lisible : une sauvegarde corrompue ne sert à rien.
    if (current === null || !parseDataFile(current).ok) return;
    await this.fs.mkdirp(this.backupDir);
    await this.fs.writeAtomic(joinPath(this.backupDir, name), current);
    const all = [name, ...existing].sort().reverse();
    for (const old of all.slice(KEEP_BACKUPS)) await this.fs.remove(joinPath(this.backupDir, old));
  }
}
