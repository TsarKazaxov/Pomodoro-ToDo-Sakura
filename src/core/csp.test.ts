// La page doit pouvoir lire ses propres fichiers (clips de voix de Rai, D-049) : sans
// `connect-src 'self'`, le chargement échoue en silence et la voix de macOS prend le relais.

import { describe, expect, it } from "vitest";
import raw from "../../src-tauri/tauri.conf.json?raw";

const conf = JSON.parse(raw) as {
  app: { security: { csp: string } };
};
const directive = (name: string) =>
  conf.app.security.csp
    .split(";")
    .map((d) => d.trim().split(/\s+/))
    .find(([n]) => n === name)
    ?.slice(1) ?? [];

describe("CSP de l'app", () => {
  it("autorise la page à charger ses clips de voix", () => {
    expect(directive("connect-src")).toContain("'self'");
    expect(directive("media-src")).toContain("'self'");
  });

  it("garde l'accès aux commandes Tauri", () => {
    expect(directive("connect-src")).toEqual(
      expect.arrayContaining(["ipc:", "http://ipc.localhost"]),
    );
  });
});
