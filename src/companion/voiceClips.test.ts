import { describe, expect, it } from "vitest";
import { clipKey, clipUrl } from "./voiceClips";

describe("clips de voix", () => {
  const manifest = { voiceId: "v", model: "m", clips: { "es/focus-1": "¡Allá vamos!" } };
  const urls = { "../assets/rai/voice/es/focus-1.mp3": "/assets/focus-1.mp3" };

  it("clé par langue, réaction et variante", () => {
    expect(clipKey("ru", "taskDone", 2)).toBe("ru/taskDone-2");
  });

  it("le clip sert seulement s'il dit le texte actuel", () => {
    expect(clipUrl("es", "focus", 1, "¡Allá vamos!", manifest, urls)).toBe("/assets/focus-1.mp3");
    expect(clipUrl("es", "focus", 1, "¡Vamos!", manifest, urls)).toBeNull();
    expect(clipUrl("ja", "focus", 1, "行くぞ！", manifest, urls)).toBeNull();
    expect(clipUrl("es", "focus", 1, "¡Allá vamos!", null, urls)).toBeNull();
  });
});
