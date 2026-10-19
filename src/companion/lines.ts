// Répliques de Rai (D-044) : japonais d'abord, puis la traduction choisie (français ou anglais).
// Plusieurs variantes par réaction, tirées à tour de rôle.

export type Reaction =
  | "impatient"
  | "longBreak"
  | "focus"
  | "transform"
  | "super"
  | "sleep"
  | "wake"
  | "focusEnd"
  | "break"
  | "breakEnd"
  | "taskDone"
  | "dodge"
  | "poke"
  | "wander"
  | "report";

export interface Line {
  ja: string;
  romaji: string;
  fr: string;
  en: string;
}

export const LINES: Record<Reaction, Line[]> = {
  impatient: [
    {
      ja: "まだかよ〜？",
      romaji: "Mada ka yo~?",
      fr: "On attend quoi, la retraite ?",
      en: "What are we waiting for, retirement?",
    },
    { ja: "暇だなぁ…", romaji: "Hima da naa…", fr: "Je m'ennuie, là.", en: "I'm so bored." },
    {
      ja: "始めようぜ！",
      romaji: "Hajimeyō ze!",
      fr: "Allez, on lance un focus ?",
      en: "Come on, let's start a focus?",
    },
  ],
  longBreak: [
    {
      ja: "長いぞ！",
      romaji: "Nagai zo!",
      fr: "La pause, c'est 5 min. Pas 5 ans.",
      en: "A break is 5 minutes. Not 5 years.",
    },
    {
      ja: "おーい、戻ってこい！",
      romaji: "Ōi, modotte koi!",
      fr: "Ohé ! On revient au boulot ?",
      en: "Hey! Back to work?",
    },
  ],
  focus: [
    { ja: "集中！", romaji: "Shūchū!", fr: "Chut. Je code.", en: "Shh. I'm coding." },
    { ja: "行くぞ！", romaji: "Iku zo!", fr: "C'est parti !", en: "Here we go!" },
    {
      ja: "本気出すか。",
      romaji: "Honki dasu ka.",
      fr: "Bon. On s'y met pour de vrai.",
      en: "Alright. For real this time.",
    },
  ],
  transform: [
    {
      ja: "本気モード！",
      romaji: "Honki mōdo!",
      fr: "Ce niveau de concentration… c'est illégal.",
      en: "This level of focus should be illegal.",
    },
    { ja: "覚醒！", romaji: "Kakusei!", fr: "Mode éveil activé !", en: "Awakening mode on!" },
  ],
  super: [
    {
      ja: "まだやるのか！？",
      romaji: "Mada yaru no ka!?",
      fr: "Encore ? T'es un monstre.",
      en: "Still going? You're a monster.",
    },
    {
      ja: "止まらねぇ！",
      romaji: "Tomaranē!",
      fr: "Rien ne t'arrête !",
      en: "Nothing can stop you!",
    },
  ],
  sleep: [
    {
      ja: "すやすや…",
      romaji: "Suya suya…",
      fr: "Zzz… travail profond. Très profond.",
      en: "Zzz… deep work. Very deep.",
    },
    {
      ja: "ぐーぐー…",
      romaji: "Gū gū…",
      fr: "Zzz… réveille-moi quand tu bosses.",
      en: "Zzz… wake me when you're working.",
    },
  ],
  wake: [
    {
      ja: "寝てないし！",
      romaji: "Netenai shi!",
      fr: "J'dormais pas ! Je… méditais.",
      en: "I wasn't sleeping! I was… meditating.",
    },
    { ja: "はっ！", romaji: "Ha!", fr: "Hein ? Quoi ? J'suis là !", en: "Huh? What? I'm here!" },
  ],
  focusEnd: [
    {
      ja: "休憩だ！",
      romaji: "Kyūkei da!",
      fr: "Driiing ! Pause, ordre du sensei.",
      en: "Riiing! Break time, sensei's orders.",
    },
    {
      ja: "よくやった！",
      romaji: "Yoku yatta!",
      fr: "Bien joué ! Pause méritée.",
      en: "Well done! You earned a break.",
    },
  ],
  break: [
    {
      ja: "いただきます！",
      romaji: "Itadakimasu!",
      fr: "Onigiri time. Lâche ce clavier.",
      en: "Onigiri time. Drop that keyboard.",
    },
    {
      ja: "ひと休み〜",
      romaji: "Hito yasumi~",
      fr: "Étire-toi, bois un verre d'eau.",
      en: "Stretch, drink some water.",
    },
  ],
  breakEnd: [
    {
      ja: "さあ、戻るぞ！",
      romaji: "Saa, modoru zo!",
      fr: "Fin de la pause. Au boulot !",
      en: "Break's over. Back to work!",
    },
  ],
  taskDone: [
    {
      ja: "やった！",
      romaji: "Yatta!",
      fr: "Et de une ! Qui est le boss ?",
      en: "One down! Who's the boss?",
    },
    { ja: "最高！", romaji: "Saikō!", fr: "Trop fort !", en: "Awesome!" },
    { ja: "次！", romaji: "Tsugi!", fr: "Suivante !", en: "Next!" },
  ],
  dodge: [
    {
      ja: "失礼！",
      romaji: "Shitsurei!",
      fr: "Oups, je gêne ? J'me tire.",
      en: "Oops, in your way? I'm out.",
    },
    { ja: "じゃあな！", romaji: "Jā na!", fr: "Je bouge, je bouge !", en: "Moving, moving!" },
  ],
  poke: [
    { ja: "なんだよ？", romaji: "Nan da yo?", fr: "Quoi ? Pas touche.", en: "What? Hands off." },
    {
      ja: "くすぐったい！",
      romaji: "Kusuguttai!",
      fr: "Hé, ça chatouille !",
      en: "Hey, that tickles!",
    },
  ],
  wander: [
    {
      ja: "ぶらぶら〜",
      romaji: "Bura bura~",
      fr: "Je me dégourdis les pattes.",
      en: "Just stretching my legs.",
    },
    {
      ja: "ちょっと散歩！",
      romaji: "Chotto sanpo!",
      fr: "Petite balade, je reviens.",
      en: "Quick stroll, be right back.",
    },
  ],
  report: [
    {
      ja: "今日の成績！",
      romaji: "Kyō no seiseki!",
      fr: "{p} pomodoros, {n} siestes. {g}/20 : {c}",
      en: "{p} pomodoros, {n} naps. {g}/20: {c}",
    },
  ],
};

/** Appréciation du bulletin du soir. */
export function grade(pomodoros: number, naps: number): { g: number; fr: string; en: string } {
  const g = Math.max(0, Math.min(20, 6 + 2 * pomodoros - naps));
  if (g >= 16) return { g, fr: "pas mal du tout.", en: "not bad at all." };
  if (g >= 11) return { g, fr: "peut mieux faire.", en: "could do better." };
  return { g, fr: "on en reparle demain.", en: "let's talk tomorrow." };
}

export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w)\}/g, (_, k: string) => String(vars[k] ?? ""));
}
