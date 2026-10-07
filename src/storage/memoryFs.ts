// Disque en mémoire pour les tests du DataStore.

import type { FsAdapter } from "./dataStore";

export class MemoryFs implements FsAdapter {
  files = new Map<string, { text: string; mtime: number }>();
  dirs = new Set<string>();
  private tick = 1;
  /** Nombre d'écritures, pour vérifier qu'aucune n'a eu lieu. */
  writes = 0;

  private parent(path: string) {
    return path.slice(0, path.lastIndexOf("/"));
  }

  /** Simule une écriture faite par un autre Mac. */
  externalWrite(path: string, text: string) {
    this.files.set(path, { text, mtime: this.tick++ });
  }

  async readText(path: string) {
    return this.files.get(path)?.text ?? null;
  }
  async writeAtomic(path: string, text: string) {
    if (!this.dirs.has(this.parent(path))) throw new Error(`Dossier absent : ${this.parent(path)}`);
    this.writes++;
    this.files.set(path, { text, mtime: this.tick++ });
  }
  async listDir(path: string) {
    const prefix = path + "/";
    const names = new Set<string>();
    for (const p of [...this.files.keys(), ...this.dirs]) {
      if (p.startsWith(prefix)) names.add(p.slice(prefix.length).split("/")[0]!);
    }
    return [...names];
  }
  async remove(path: string) {
    this.files.delete(path);
  }
  async mkdirp(path: string) {
    let p = path;
    while (p) {
      this.dirs.add(p);
      p = this.parent(p);
    }
  }
  async mtime(path: string) {
    return this.files.get(path)?.mtime ?? null;
  }
}
