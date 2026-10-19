// Répliques de Rai (D-044, D-047, D-048) : une seule langue à la fois, au choix (japonais,
// espagnol, russe, français, anglais). Plusieurs variantes par réaction, tirées à tour de rôle.
// Ce fichier est aussi lu par `scripts/rai-voice.mjs` (clips ElevenLabs) : pas d'import
// autre que de types.

import type { RaiLang } from "../core/types";

export type Reaction = "focusEnd" | "breakEnd" | "taskDone" | "poke" | "report";

export type Line = Record<RaiLang, string> & {
  /** Lecture du japonais, en petit à côté. */
  romaji: string;
};

/**
 * D-048 : seulement ce qui t'apprend quelque chose (fin de focus, fin de pause), ce que tu as
 * fait (tâche cochée), ce que tu as cherché (clic sur Rai) et le bulletin du soir. Phrases
 * courtes : l'information d'abord, une seule idée, pas de reproche.
 */
export const LINES: Record<Reaction, Line[]> = {
  focusEnd: [
    {
      ja: "休憩だ！",
      romaji: "Kyūkei da!",
      fr: "Pause ! Lâche le clavier.",
      en: "Break! Let go of the keyboard.",
      es: "¡Pausa! Suelta el teclado.",
      ru: "Перерыв! Отпусти клавиатуру.",
    },
    {
      ja: "よくやった！",
      romaji: "Yoku yatta!",
      fr: "Bien joué. Pause.",
      en: "Nice work. Break time.",
      es: "Bien hecho. Pausa.",
      ru: "Отлично. Перерыв.",
    },
    {
      ja: "ひと休み〜",
      romaji: "Hito yasumi~",
      fr: "Pause. Lève-toi, étire-toi.",
      en: "Break. Get up, stretch.",
      es: "Pausa. Levántate y estírate.",
      ru: "Перерыв. Встань, потянись.",
    },
  ],
  breakEnd: [
    {
      ja: "休憩おわり。",
      romaji: "Kyūkei owari.",
      fr: "Fin de la pause.",
      en: "Break's over.",
      es: "Se acabó la pausa.",
      ru: "Перерыв окончен.",
    },
    {
      ja: "準備いい？",
      romaji: "Junbi ii?",
      fr: "Pause finie. On relance ?",
      en: "Break's done. Ready?",
      es: "Pausa terminada. ¿Seguimos?",
      ru: "Перерыв всё. Продолжим?",
    },
  ],
  taskDone: [
    {
      ja: "やった！",
      romaji: "Yatta!",
      fr: "Et de une !",
      en: "One down!",
      es: "¡Una menos!",
      ru: "Минус одна!",
    },
    {
      ja: "最高！",
      romaji: "Saikō!",
      fr: "Trop fort !",
      en: "Awesome!",
      es: "¡Qué crack!",
      ru: "Круто!",
    },
    {
      ja: "次！",
      romaji: "Tsugi!",
      fr: "Suivante !",
      en: "Next!",
      es: "¡Siguiente!",
      ru: "Следующая!",
    },
  ],
  poke: [
    {
      ja: "なんだよ？",
      romaji: "Nan da yo?",
      fr: "Quoi ? Pas touche.",
      en: "What? Hands off.",
      es: "¿Qué? Sin tocar.",
      ru: "Что? Руки прочь.",
    },
    {
      ja: "くすぐったい！",
      romaji: "Kusuguttai!",
      fr: "Hé, ça chatouille !",
      en: "Hey, that tickles!",
      es: "¡Eh, que me haces cosquillas!",
      ru: "Эй, щекотно!",
    },
    {
      ja: "暇なの？",
      romaji: "Hima na no?",
      fr: "T'as pas du travail, toi ?",
      en: "Don't you have work to do?",
      es: "¿No tienes trabajo?",
      ru: "Тебе работать не надо?",
    },
  ],
  report: [
    {
      ja: "今日の成績：ポモドーロ{p}回、昼寝{n}回。{g}点。{c}",
      romaji: "Kyō no seiseki: pomodoro {p}-kai, hirune {n}-kai. {g}-ten. {c}",
      fr: "{p} pomodoros, {n} siestes. {g}/20 : {c}",
      en: "{p} pomodoros, {n} naps. {g}/20: {c}",
      es: "{p} pomodoros, {n} siestas. {g}/20: {c}",
      ru: "Помидоров: {p}, снов: {n}. {g}/20: {c}",
    },
  ],
};

/**
 * Texte des clips de voix enregistrés à l'avance (D-047) : la réplique elle-même, sauf pour le
 * bulletin, dont les chiffres changent chaque soir — le clip n'en dit que le titre.
 */
export const REPORT_TITLE: Record<RaiLang, string> = {
  ja: "今日の成績！",
  fr: "Le bulletin du jour !",
  en: "Today's report card!",
  es: "¡El boletín de hoy!",
  ru: "Итоги дня!",
};

export function clipText(reaction: Reaction, line: Line, lang: RaiLang): string {
  return reaction === "report" ? REPORT_TITLE[lang] : line[lang];
}

type Grade = Record<RaiLang | "romaji", string> & { g: number };

/** Appréciation du bulletin du soir. */
export function grade(pomodoros: number, naps: number): Grade {
  const g = Math.max(0, Math.min(20, 6 + 2 * pomodoros - naps));
  if (g >= 16)
    return {
      g,
      ja: "なかなかやるじゃん。",
      romaji: "Nakanaka yaru jan.",
      fr: "pas mal du tout.",
      en: "not bad at all.",
      es: "nada mal.",
      ru: "очень неплохо.",
    };
  if (g >= 11)
    return {
      g,
      ja: "まだまだだな。",
      romaji: "Madamada da na.",
      fr: "peut mieux faire.",
      en: "could do better.",
      es: "puede mejorar.",
      ru: "можно и лучше.",
    };
  return {
    g,
    ja: "明日、話そう。",
    romaji: "Ashita, hanasō.",
    fr: "on en reparle demain.",
    en: "let's talk tomorrow.",
    es: "mañana hablamos.",
    ru: "поговорим завтра.",
  };
}

export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w)\}/g, (_, k: string) => String(vars[k] ?? ""));
}
