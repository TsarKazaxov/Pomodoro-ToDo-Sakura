// FsAdapter sur le vrai disque (Node), pour les tests d'intégration : même contrat que les
// commandes Rust (écriture atomique par renommage, date de modification en ms).

import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import type { FsAdapter } from "../src/storage/dataStore";

const notFound = (e: unknown) => (e as NodeJS.ErrnoException).code === "ENOENT";

export const nodeFs: FsAdapter = {
  async readText(path) {
    try {
      return await fs.readFile(path, "utf8");
    } catch (e) {
      if (notFound(e)) return null;
      throw e;
    }
  },
  async writeAtomic(path, text) {
    const tmp = join(dirname(path), `.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);
    await fs.writeFile(tmp, text);
    await fs.rename(tmp, path);
  },
  async listDir(path) {
    try {
      return await fs.readdir(path);
    } catch (e) {
      if (notFound(e)) return [];
      throw e;
    }
  },
  async remove(path) {
    await fs.rm(path, { force: true });
  },
  async mkdirp(path) {
    await fs.mkdir(path, { recursive: true });
  },
  async mtime(path) {
    try {
      return Math.floor((await fs.stat(path)).mtimeMs);
    } catch (e) {
      if (notFound(e)) return null;
      throw e;
    }
  },
};
