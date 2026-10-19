import { describe, expect, it } from "vitest";
import { clipKey, clipUrl } from "./voiceClips";

describe("clips de voix", () => {
  const manifest = { voiceId: "v", model: "m", clips: { "es/focusEnd-1": "Bien hecho. Pausa." } };
  const urls = { "../assets/rai/voice/es/focusEnd-1.mp3": "/assets/focusEnd-1.mp3" };

  it("clé par langue, réaction et variante", () => {
    expect(clipKey("ru", "taskDone", 2)).toBe("ru/taskDone-2");
  });

  it("le clip sert seulement s'il dit le texte actuel", () => {
    expect(clipUrl("es", "focusEnd", 1, "Bien hecho. Pausa.", manifest, urls)).toBe(
      "/assets/focusEnd-1.mp3",
    );
    expect(clipUrl("es", "focusEnd", 1, "¡Pausa!", manifest, urls)).toBeNull();
    expect(clipUrl("ja", "focusEnd", 1, "よくやった！", manifest, urls)).toBeNull();
    expect(clipUrl("es", "focusEnd", 1, "Bien hecho. Pausa.", null, urls)).toBeNull();
  });
});
