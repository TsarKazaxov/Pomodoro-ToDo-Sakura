import { describe, expect, it } from "vitest";
import { FRAMES, framePaths, PALETTE } from "./nekoSprite";

describe("Neko", () => {
  it("chaque image fait 16 × 16 cases, toutes de couleur connue", () => {
    for (const [mood, frames] of Object.entries(FRAMES))
      for (const rows of frames) {
        expect(rows, mood).toHaveLength(16);
        for (const row of rows) {
          expect(row, `${mood} « ${row} »`).toHaveLength(16);
          for (const ch of row) expect(ch === "." || ch in PALETTE, `${mood} : ${ch}`).toBe(true);
        }
      }
  });

  it("les deux images d'une humeur diffèrent (sinon rien ne bouge)", () => {
    for (const [mood, [a, b]] of Object.entries(FRAMES)) expect(a, mood).not.toEqual(b);
  });

  it("une suite de cases identiques devient un seul rectangle", () => {
    const rows = ["kkk." + ".".repeat(12), ...Array(15).fill(".".repeat(16))];
    expect(framePaths(rows)).toEqual([{ fill: PALETTE.k, d: "M0 0h3v1h-3z" }]);
  });
});
