// Neko, le compagnon pixel de l'ensō (D-043) : un petit chat blanc façon maneki-neko, grille
// 16 × 16. Une humeur par état du minuteur, deux images par humeur, alternées au rythme du
// tick d'une seconde déjà en place : aucune animation de plus à faire tourner (D-036).

export type Mood = "sleep" | "work" | "overtime" | "tea" | "wait";

/** Couleur de chaque lettre de la grille ; « . » = transparent. */
export const PALETTE: Record<string, string> = {
  k: "#2b2622", // trait
  w: "#fffaf2", // pelage
  p: "#f2a7b8", // intérieur des oreilles, joues
  n: "#e47d93", // truffe
  r: "#c8432f", // hachimaki, collier
  y: "#e0b040", // grelot
  g: "#7aa05a", // matcha
  c: "#5c7f45", // bol
  s: "#b9b3aa", // vapeur, « z »
  u: "#7fb8e0", // goutte de sueur
};

const EAR_ROWS = [
  "................",
  "..k..........k..",
  "..kk........kk..",
  "..kpk......kpk..",
] as const;
const EARS: string[] = [...EAR_ROWS];
const HEAD = "..kwwkkkkkkwwk..";
const FACE = ".kwwwwwwwwwwwwk.";
const EYES_OPEN = ".kwwkwwwwwwkwwk.";
const EYES_SHUT = ".kwkkwwwwwwkkwk.";
const CHEEKS = ".kpwwwwnnwwwwpk.";
const MOUTH = ".kwwwwwkkwwwwwk.";
const COLLAR = "..kkrrrrrrrrkk..";
const BELL = "..kwwwwyywwwwk..";
const BODY = ".kwwwwwwwwwwwwk.";
const PAWS = ".kwwkkwwwwkkwwk.";
const BASE = "..kkkkkkkkkkkk..";

/** Pose assise, de la ligne 4 (tête) à la ligne 15 (socle). */
function sitting(eyes: string, over: Partial<Record<number, string>> = {}): string[] {
  const rows = [
    ...EARS,
    HEAD,
    FACE,
    FACE,
    eyes,
    CHEEKS,
    MOUTH,
    COLLAR,
    BELL,
    BODY,
    BODY,
    PAWS,
    BASE,
  ];
  for (const [i, row] of Object.entries(over)) rows[Number(i)] = row as string;
  return rows;
}

/** Remplace des cases d'une ligne : `put(row, col, "abc")`. */
function put(row: string, col: number, s: string): string {
  return row.slice(0, col) + s + row.slice(col + s.length);
}

// Focus : bandeau rouge (hachimaki) noué sur le côté, les pattes tapent.
const BAND = ".krrrrrrrrrrrrk.";
const work = (tailUp: boolean, leftPaw: boolean) =>
  sitting(EYES_OPEN, {
    4: tailUp ? put(HEAD, 14, "r") : HEAD,
    5: put(BAND, 15, "r"),
    6: tailUp ? FACE : put(FACE, 15, "r"),
    14: leftPaw ? ".kkkkwwwwwwkkwk." : ".kwkkwwwwwwkkkk.",
  });

export const FRAMES: Record<Mood, [string[], string[]]> = {
  // Minuteur arrêté : il dort, un « z » monte.
  sleep: [
    sitting(EYES_SHUT, { 1: put(EAR_ROWS[1], 15, "s") }),
    sitting(EYES_SHUT, { 0: put(EAR_ROWS[0], 14, "s"), 2: put(EAR_ROWS[2], 15, "s") }),
  ],
  work: [work(false, true), work(true, false)],
  // Prolongation : il continue, une goutte de sueur perle.
  overtime: [
    work(false, true).map((r, i) => (i === 7 ? put(r, 15, "u") : r)),
    work(true, false).map((r, i) => (i === 8 ? put(r, 15, "u") : r)),
  ],
  // Pause : les yeux fermés, un bol de matcha fumant entre les pattes.
  tea: [
    sitting(EYES_SHUT, {
      11: "..kwwwswwwwwwk..",
      12: ".kwwwkggggkwwwk.",
      13: ".kwwwkcccckwwwk.",
      14: ".kwwwwkkkkwwwwk.",
    }),
    sitting(EYES_SHUT, {
      11: "..kwwwwwwswwwk..",
      12: ".kwwwkggggkwwwk.",
      13: ".kwwwkcccckwwwk.",
      14: ".kwwwwkkkkwwwwk.",
    }),
  ],
  // Suspendu : assis, il attend en clignant des yeux.
  wait: [sitting(EYES_OPEN), sitting(EYES_SHUT)],
};

/**
 * Une image en chemins SVG, un par couleur : chaque suite de cases identiques d'une ligne
 * devient un rectangle. Une dizaine d'éléments au lieu de deux cents.
 */
export function framePaths(rows: string[]): { fill: string; d: string }[] {
  const byColor = new Map<string, string[]>();
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x] ?? ".";
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      const fill = PALETTE[ch];
      if (fill) {
        const parts = byColor.get(fill) ?? [];
        parts.push(`M${x} ${y}h${end - x}v1h${x - end}z`);
        byColor.set(fill, parts);
      }
      x = end;
    }
  });
  return [...byColor].map(([fill, parts]) => ({ fill, d: parts.join("") }));
}
