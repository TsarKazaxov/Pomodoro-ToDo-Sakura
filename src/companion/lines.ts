// Répliques de Rai (D-044, D-047) : une seule langue à la fois, au choix (japonais, espagnol,
// russe, français, anglais). Plusieurs variantes par réaction, tirées à tour de rôle.
// Ce fichier est aussi lu par `scripts/rai-voice.mjs` (clips ElevenLabs) : pas d'import
// autre que de types.

import type { RaiLang } from "../core/types";

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

export type Line = Record<RaiLang, string> & {
  /** Lecture du japonais, en petit à côté. */
  romaji: string;
};

export const LINES: Record<Reaction, Line[]> = {
  impatient: [
    {
      ja: "まだかよ〜？",
      romaji: "Mada ka yo~?",
      fr: "On attend quoi, la retraite ?",
      en: "What are we waiting for, retirement?",
      es: "¿A qué esperamos, a la jubilación?",
      ru: "Чего ждём, пенсии?",
    },
    {
      ja: "暇だなぁ…",
      romaji: "Hima da naa…",
      fr: "Je m'ennuie, là.",
      en: "I'm so bored.",
      es: "Me aburro, eh.",
      ru: "Скукота…",
    },
    {
      ja: "始めようぜ！",
      romaji: "Hajimeyō ze!",
      fr: "Allez, on lance un focus ?",
      en: "Come on, let's start a focus?",
      es: "Venga, ¿empezamos un focus?",
      ru: "Ну что, начнём фокус?",
    },
  ],
  longBreak: [
    {
      ja: "長いぞ！",
      romaji: "Nagai zo!",
      fr: "La pause, c'est 5 min. Pas 5 ans.",
      en: "A break is 5 minutes. Not 5 years.",
      es: "La pausa son 5 minutos. No 5 años.",
      ru: "Перерыв — 5 минут. Не 5 лет.",
    },
    {
      ja: "おーい、戻ってこい！",
      romaji: "Ōi, modotte koi!",
      fr: "Ohé ! On revient au boulot ?",
      en: "Hey! Back to work?",
      es: "¡Eh! ¿Volvemos al curro?",
      ru: "Эй! Возвращаемся к работе?",
    },
  ],
  focus: [
    {
      ja: "集中！",
      romaji: "Shūchū!",
      fr: "Chut. Je code.",
      en: "Shh. I'm coding.",
      es: "Chis. Estoy programando.",
      ru: "Тсс. Я работаю.",
    },
    {
      ja: "行くぞ！",
      romaji: "Iku zo!",
      fr: "C'est parti !",
      en: "Here we go!",
      es: "¡Allá vamos!",
      ru: "Поехали!",
    },
    {
      ja: "本気出すか。",
      romaji: "Honki dasu ka.",
      fr: "Bon. On s'y met pour de vrai.",
      en: "Alright. For real this time.",
      es: "Venga. Esta vez en serio.",
      ru: "Ладно. Теперь всерьёз.",
    },
  ],
  transform: [
    {
      ja: "本気モード！",
      romaji: "Honki mōdo!",
      fr: "Ce niveau de concentration… c'est illégal.",
      en: "This level of focus should be illegal.",
      es: "Este nivel de concentración… es ilegal.",
      ru: "Такая концентрация… это незаконно.",
    },
    {
      ja: "覚醒！",
      romaji: "Kakusei!",
      fr: "Mode éveil activé !",
      en: "Awakening mode on!",
      es: "¡Modo despertar activado!",
      ru: "Режим пробуждения включён!",
    },
  ],
  super: [
    {
      ja: "まだやるのか！？",
      romaji: "Mada yaru no ka!?",
      fr: "Encore ? T'es un monstre.",
      en: "Still going? You're a monster.",
      es: "¿Todavía? Eres un monstruo.",
      ru: "Всё ещё? Ты монстр.",
    },
    {
      ja: "止まらねぇ！",
      romaji: "Tomaranē!",
      fr: "Rien ne t'arrête !",
      en: "Nothing can stop you!",
      es: "¡Nada te detiene!",
      ru: "Тебя не остановить!",
    },
  ],
  sleep: [
    {
      ja: "すやすや…",
      romaji: "Suya suya…",
      fr: "Zzz… travail profond. Très profond.",
      en: "Zzz… deep work. Very deep.",
      es: "Zzz… trabajo profundo. Muy profundo.",
      ru: "Хррр… глубокая работа. Очень глубокая.",
    },
    {
      ja: "ぐーぐー…",
      romaji: "Gū gū…",
      fr: "Zzz… réveille-moi quand tu bosses.",
      en: "Zzz… wake me when you're working.",
      es: "Zzz… despiértame cuando trabajes.",
      ru: "Хррр… разбуди, когда начнёшь работать.",
    },
  ],
  wake: [
    {
      ja: "寝てないし！",
      romaji: "Netenai shi!",
      fr: "J'dormais pas ! Je… méditais.",
      en: "I wasn't sleeping! I was… meditating.",
      es: "¡No dormía! Estaba… meditando.",
      ru: "Я не спал! Я… медитировал.",
    },
    {
      ja: "はっ！",
      romaji: "Ha!",
      fr: "Hein ? Quoi ? J'suis là !",
      en: "Huh? What? I'm here!",
      es: "¿Eh? ¿Qué? ¡Estoy aquí!",
      ru: "А? Что? Я здесь!",
    },
  ],
  focusEnd: [
    {
      ja: "休憩だ！",
      romaji: "Kyūkei da!",
      fr: "Driiing ! Pause, ordre du sensei.",
      en: "Riiing! Break time, sensei's orders.",
      es: "¡Riiing! Pausa, órdenes del sensei.",
      ru: "Дзынь! Перерыв, приказ сэнсэя.",
    },
    {
      ja: "よくやった！",
      romaji: "Yoku yatta!",
      fr: "Bien joué ! Pause méritée.",
      en: "Well done! You earned a break.",
      es: "¡Bien hecho! Te has ganado la pausa.",
      ru: "Молодец! Перерыв заслужен.",
    },
  ],
  break: [
    {
      ja: "いただきます！",
      romaji: "Itadakimasu!",
      fr: "Onigiri time. Lâche ce clavier.",
      en: "Onigiri time. Drop that keyboard.",
      es: "Hora del onigiri. Suelta el teclado.",
      ru: "Время онигири. Отпусти клавиатуру.",
    },
    {
      ja: "ひと休み〜",
      romaji: "Hito yasumi~",
      fr: "Étire-toi, bois un verre d'eau.",
      en: "Stretch, drink some water.",
      es: "Estírate, bebe un vaso de agua.",
      ru: "Потянись, выпей воды.",
    },
  ],
  breakEnd: [
    {
      ja: "さあ、戻るぞ！",
      romaji: "Saa, modoru zo!",
      fr: "Fin de la pause. Au boulot !",
      en: "Break's over. Back to work!",
      es: "Se acabó la pausa. ¡A currar!",
      ru: "Перерыв окончен. За работу!",
    },
  ],
  taskDone: [
    {
      ja: "やった！",
      romaji: "Yatta!",
      fr: "Et de une ! Qui est le boss ?",
      en: "One down! Who's the boss?",
      es: "¡Una menos! ¿Quién manda aquí?",
      ru: "Минус одна! Кто тут босс?",
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
  dodge: [
    {
      ja: "失礼！",
      romaji: "Shitsurei!",
      fr: "Oups, je gêne ? J'me tire.",
      en: "Oops, in your way? I'm out.",
      es: "Uy, ¿molesto? Me piro.",
      ru: "Ой, мешаю? Ухожу.",
    },
    {
      ja: "じゃあな！",
      romaji: "Jā na!",
      fr: "Je bouge, je bouge !",
      en: "Moving, moving!",
      es: "¡Me muevo, me muevo!",
      ru: "Двигаюсь, двигаюсь!",
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
  ],
  wander: [
    {
      ja: "ぶらぶら〜",
      romaji: "Bura bura~",
      fr: "Je me dégourdis les pattes.",
      en: "Just stretching my legs.",
      es: "Estirando las patas.",
      ru: "Разминаю лапы.",
    },
    {
      ja: "ちょっと散歩！",
      romaji: "Chotto sanpo!",
      fr: "Petite balade, je reviens.",
      en: "Quick stroll, be right back.",
      es: "Paseíto rápido, ahora vuelvo.",
      ru: "Небольшая прогулка, скоро вернусь.",
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
