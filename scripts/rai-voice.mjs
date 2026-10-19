#!/usr/bin/env node
// Clips de voix de Rai (D-047) : enregistre chaque réplique de src/companion/lines.ts avec la
// voix ElevenLabs choisie dans src/assets/rai/voice/voice.json, une fois par langue.
// Seuls les clips manquants ou dont le texte a changé sont refaits (manifest.json).
//
//   ELEVENLABS_API_KEY=… node --experimental-strip-types scripts/rai-voice.mjs
//   DRY_RUN=1 node --experimental-strip-types scripts/rai-voice.mjs   # compte, sans appel
//
// Lancé par .github/workflows/rai-voice.yml quand voice.json ou les répliques changent.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { clipText, LINES } from "../src/companion/lines.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "src/assets/rai/voice");
const config = JSON.parse(readFileSync(join(dir, "voice.json"), "utf8"));
const manifestPath = join(dir, "manifest.json");
const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, "utf8"))
  : { voiceId: "", model: "", clips: {} };
const dry = process.env.DRY_RUN === "1";
const key = process.env.ELEVENLABS_API_KEY ?? "";

if (!config.voiceId) {
  console.log("Pas de voix choisie (voiceId vide dans voice.json) : rien à faire.");
  process.exit(0);
}
if (!dry && !key) {
  console.log("Secret ELEVENLABS_API_KEY absent : rien à faire.");
  process.exit(0);
}

// Nouvelle voix ou nouveau modèle : tout est à refaire.
const sameVoice = manifest.voiceId === config.voiceId && manifest.model === config.model;
const clips = sameVoice ? { ...manifest.clips } : {};

const todo = [];
for (const lang of config.langs) {
  for (const [reaction, lines] of Object.entries(LINES)) {
    lines.forEach((line, variant) => {
      const id = `${lang}/${reaction}-${variant}`;
      const text = clipText(reaction, line, lang);
      const file = join(dir, `${id}.mp3`);
      if (clips[id] === text && existsSync(file)) return;
      todo.push({ id, lang, text, file });
    });
  }
}
const chars = todo.reduce((n, t) => n + t.text.length, 0);
console.log(`${todo.length} clips à enregistrer, ${chars} caractères.`);
if (dry) {
  for (const t of todo) console.log(`  ${t.id}  ${t.text}`);
  process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tts(t) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.voiceId)}?output_format=mp3_44100_64`;
  const body = { text: t.text, model_id: config.model, voice_settings: config.settings };
  // Seuls les modèles « v2.5 » acceptent qu'on leur impose la langue.
  if (/_v2_5$/.test(config.model)) body.language_code = t.lang;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify(body),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const msg = await res.text();
    if (res.status === 429 || res.status >= 500) {
      await sleep(2000 * 2 ** attempt);
      continue;
    }
    throw new Error(`${t.id} : ${res.status} ${msg}`);
  }
  throw new Error(`${t.id} : trop de tentatives`);
}

let done = 0;
try {
  for (const t of todo) {
    const audio = await tts(t);
    mkdirSync(dirname(t.file), { recursive: true });
    writeFileSync(t.file, audio);
    clips[t.id] = t.text;
    done++;
    console.log(`  ✓ ${t.id}  ${t.text}`);
  }
} finally {
  // Même en cas d'échec, garder ce qui a été enregistré.
  const sorted = Object.fromEntries(Object.entries(clips).sort(([a], [b]) => a.localeCompare(b)));
  const out = { voiceId: config.voiceId, model: config.model, clips: sorted };
  writeFileSync(manifestPath, JSON.stringify(out, null, 2) + "\n");
  console.log(`${done}/${todo.length} clips enregistrés.`);
}
