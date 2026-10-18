// Rai dans le widget (D-044) : fait vivre le moteur de comportement au rythme de la seconde,
// lui transmet les événements (tâche cochée, fin de focus…), et prononce ses répliques.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  initialCompanion,
  poseOf,
  step,
  type CompanionEvent,
  type CompanionState,
  type Pose,
} from "../companion/engine";
import { fill, grade, LINES } from "../companion/lines";
import { dayKeyAt, dayKeyOf } from "../core/time";
import { isOvertime, isPaused } from "../core/timer";
import type { DataFile } from "../core/types";
import { lastInputAt, speak } from "../platform";

export interface Speech {
  /** Identifiant de la réplique (change à chaque nouvelle bulle). */
  key: number;
  ja: string;
  romaji: string;
  /** Traduction dans la langue choisie ; vide si « aucune ». */
  text: string;
}

export function useCompanion(data: DataFile, now: number) {
  const s = data.settings;
  const engine = useRef<CompanionState>(initialCompanion(now, dayKeyAt(now)));
  const pending = useRef<CompanionEvent[]>([]);
  const [view, setView] = useState<{ pose: Pose; speech: Speech | null }>({
    pose: "base",
    speech: null,
  });
  const spoken = useRef(0);

  const push = useCallback((e: CompanionEvent) => {
    pending.current.push(e);
  }, []);

  const t = data.timer;
  const phase = t.phase === "idle" ? "idle" : t.phase === "focus" ? "focus" : ("break" as const);
  const today = dayKeyAt(now);
  const pomodorosToday = data.sessions.filter(
    (x) => x.type === "focus" && x.completed && dayKeyOf(x.endedAt) === today,
  ).length;

  useEffect(() => {
    const last = lastInputAt();
    const events = pending.current;
    pending.current = [];
    const next = step(
      engine.current,
      {
        now,
        phase,
        paused: isPaused(t),
        overtime: isOvertime(t),
        idleMs: last === null ? null : Math.max(0, now - last),
        hour: new Date(now).getHours(),
        day: today,
        pomodorosToday,
        discreet: s.companionDiscreet,
      },
      events,
    );
    engine.current = next;
    const b = next.bubble;
    let speech: Speech | null = null;
    if (b) {
      const line = LINES[b.reaction][b.variant] ?? LINES[b.reaction][0]!;
      const vars = b.vars ? { ...b.vars } : {};
      if (b.reaction === "report") {
        const gr = grade(Number(vars.p ?? 0), Number(vars.n ?? 0));
        vars.g = gr.g;
        vars.c = s.companionLang === "en" ? gr.en : gr.fr;
      }
      speech = {
        key: b.since,
        ja: line.ja,
        romaji: line.romaji,
        text: s.companionLang === "none" ? "" : fill(line[s.companionLang], vars),
      };
    }
    setView((v) =>
      v.pose === poseOf(next, now) && v.speech?.key === speech?.key
        ? v
        : { pose: poseOf(next, now), speech },
    );
    // Voix : une fois par réplique, japonais puis traduction.
    if (speech && speech.key !== spoken.current && s.showCompanion && s.companionVoice) {
      spoken.current = speech.key;
      const parts: { text: string; lang: string }[] = [];
      if (s.companionJapanese) parts.push({ text: speech.ja, lang: "ja" });
      if (speech.text) parts.push({ text: speech.text, lang: s.companionLang });
      if (parts.length) void speak(parts, s.soundVolume);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- un pas par seconde, au tick
  }, [now]);

  return { pose: view.pose, speech: view.speech, push };
}
