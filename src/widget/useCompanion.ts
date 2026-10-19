// Rai dans le widget (D-044) : fait vivre le moteur de comportement au rythme de la seconde,
// lui transmet les événements (tâche cochée, fin de focus…), et prononce ses répliques dans une
// seule langue (D-047) : clip enregistré s'il existe, sinon voix de macOS.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  initialCompanion,
  poseOf,
  step,
  type CompanionEvent,
  type CompanionState,
  type Pose,
} from "../companion/engine";
import { clipText, fill, grade, LINES, type Reaction } from "../companion/lines";
import { clipUrl } from "../companion/voiceClips";
import { dayKeyAt, dayKeyOf } from "../core/time";
import { isOvertime, isPaused } from "../core/timer";
import type { DataFile, RaiLang } from "../core/types";
import { lastInputAt, speak, stopSpeaking } from "../platform";
import { playClip, stopClip } from "../ui/sound";

export interface Speech {
  /** Identifiant de la réplique (change à chaque nouvelle bulle). */
  key: number;
  lang: RaiLang;
  /** La réplique, dans la langue de Rai. */
  text: string;
  /** Lecture du japonais (japonais seulement). */
  romaji: string;
  /** Sous-titre en français ; vide si désactivé ou si Rai parle déjà français. */
  sub: string;
  /** Pour retrouver le clip enregistré. */
  reaction: Reaction;
  variant: number;
}

export function useCompanion(data: DataFile, now: number) {
  const s = data.settings;
  const lang = s.companionLang;
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
        vars.c = gr[lang];
        vars.r = gr.romaji;
        vars.f = gr.fr;
      }
      const v = (c: string) => ({ ...vars, c: vars[c] ?? "" });
      speech = {
        key: b.since,
        lang,
        text: fill(line[lang], v("c")),
        romaji: lang === "ja" ? fill(line.romaji, v("r")) : "",
        sub: s.companionSubtitles && lang !== "fr" ? fill(line.fr, v("f")) : "",
        reaction: b.reaction,
        variant: b.variant,
      };
    }
    setView((v) =>
      v.pose === poseOf(next, now) && v.speech?.key === speech?.key
        ? v
        : { pose: poseOf(next, now), speech },
    );
    // Voix : une fois par réplique, dans une seule langue.
    if (speech && speech.key !== spoken.current && s.showCompanion && s.companionVoice) {
      spoken.current = speech.key;
      const said = speech;
      const line = LINES[said.reaction][said.variant] ?? LINES[said.reaction][0]!;
      const url = clipUrl(lang, said.reaction, said.variant, clipText(said.reaction, line, lang));
      const macos = () => void speak([{ text: said.text, lang }], s.soundVolume);
      if (url) {
        void stopSpeaking();
        void playClip(url, s.soundVolume).then((ok) => ok || macos());
      } else {
        stopClip();
        macos();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- un pas par seconde, au tick
  }, [now]);

  return { pose: view.pose, speech: view.speech, push };
}
