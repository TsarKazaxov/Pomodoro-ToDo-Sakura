// Clips de voix de Rai enregistrés à l'avance (D-047), générés par `scripts/rai-voice.mjs`
// (ElevenLabs) dans `src/assets/rai/voice/<langue>/<réaction>-<variante>.mp3`. Un clip ne sert
// que si le manifeste dit qu'il prononce exactement le texte actuel de la réplique : une
// réplique modifiée retombe sur la voix de macOS jusqu'au prochain enregistrement.

import type { RaiLang } from "../core/types";
import type { Reaction } from "./lines";

interface Manifest {
  voiceId: string;
  model: string;
  clips: Record<string, string>;
}

const MANIFEST =
  Object.values(
    import.meta.glob<Manifest>("../assets/rai/voice/manifest.json", {
      eager: true,
      import: "default",
    }),
  )[0] ?? null;

const URLS = import.meta.glob<string>("../assets/rai/voice/*/*.mp3", {
  eager: true,
  query: "?url",
  import: "default",
});

export const clipKey = (lang: RaiLang, reaction: Reaction, variant: number) =>
  `${lang}/${reaction}-${variant}`;

/** URL du clip de cette réplique, s'il existe et prononce bien `text`. */
export function clipUrl(
  lang: RaiLang,
  reaction: Reaction,
  variant: number,
  text: string,
  manifest: Manifest | null = MANIFEST,
  urls: Record<string, string> = URLS,
): string | null {
  const key = clipKey(lang, reaction, variant);
  if (manifest?.clips[key] !== text) return null;
  return urls[`../assets/rai/voice/${key}.mp3`] ?? null;
}

/** Nombre de clips à jour par langue (affiché dans les Réglages). */
export function clipCount(lang: RaiLang): number {
  if (!MANIFEST) return 0;
  return Object.keys(MANIFEST.clips).filter(
    (k) => k.startsWith(`${lang}/`) && URLS[`../assets/rai/voice/${k}.mp3`],
  ).length;
}
