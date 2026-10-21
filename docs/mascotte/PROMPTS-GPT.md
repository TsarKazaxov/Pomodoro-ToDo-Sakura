# Rai — pack de prompts pour générer la mascotte (ChatGPT)

But : obtenir des illustrations **cohérentes entre elles** de Rai, découpables et animables dans le widget.
Tout se fait **dans une seule conversation ChatGPT**, dans l'ordre. Les prompts sont en anglais (les générateurs d'images le suivent mieux) ; les explications sont en français.

## Avant de commencer

1. Ouvre une nouvelle conversation ChatGPT (modèle avec génération d'images).
2. Joins les deux croquis : `rai.png` (forme normale) et `rai-super.png` (forme super). Ils fixent la silhouette et les couleurs, pas le style.
3. Colle le **prompt 0**, puis les autres un par un. Après chaque image : vérifie la checklist en bas de page ; si le personnage dérive, utilise le **prompt de correction**.
4. Télécharge chaque image avec **exactement** le nom de fichier indiqué.

---

## Prompt 0 — Mise en place (texte seul, pas d'image)

```
You are going to be my character illustrator for a small desktop mascot. I will ask for a series of images of the SAME original character. Consistency between images is the top priority: same design, same colors, same proportions, same art style, same framing, same lighting. Do not generate anything yet; just confirm you understood and summarise the rules below in 5 bullet points.

PROJECT
The mascot lives in a Pomodoro timer widget on a Mac. It sits at the edge of the screen (about 120 pixels tall on screen) and reacts to what I do: it works when I work, falls asleep when I stop touching the computer, celebrates when I finish a task. The app animates the images by swapping poses and adding effects (Zzz, sweat drops, speed lines, sparks, aura). So every image must be a clean, isolated character I can cut out and swap.

CHARACTER — "RAI" (keep this text as the reference for every image)
Rai is an ORIGINAL character: a young raijū, the thunder beast of Japanese folklore, imagined as a small fox–hedgehog creature, about 40 cm tall, proud, cocky and impatient but lovable.
- Fur: deep indigo blue (#3B4CCA) with darker blue shadows (#2A3696).
- Head: three large quills on the back of the head, swept backwards, sharp and slightly curved like blades.
- Ears: two tall pointed fox ears with pink inner fur (#F4A7B9).
- Face: cream-white muzzle (#FFF7EA), small black nose, cat-like "ω" mouth, a small yellow lightning-bolt mark on the forehead (#FFD23F).
- Eyes: large expressive anime eyes, amber iris (#F2A13A) with dark pupil and sharp white highlights.
- Body: cream-white chest and belly, slim but sturdy limbs, white paws with a thin yellow band on the feet. No clothes, no shoes, no gloves (accessories only when I ask).
- Tail: a bright yellow zigzag lightning bolt (#FFD23F) with orange shading (#E0A000).
- Proportions: about 3.5 heads tall. NOT chibi, NOT a baby.
It must not look like Sonic the Hedgehog or any existing character: no red sneakers, no white gloves, no green eyes, fox ears always visible.

ART STYLE (same for every image)
Realistic shōnen manga illustration in full color: confident ink linework with varied line weight, cel shading with 2–3 tones, subtle screentone texture inside the shadows, dramatic rim light, detailed fur strands on the silhouette edges, intense expressive eyes. Key light from the top left. Not pixel art, not a 3D render, not watercolor, not a children's book style.

FRAMING (same for every image unless I say otherwise)
- Square image, 1024 × 1024 px, PNG with a TRANSPARENT background. If transparency is impossible, use a perfectly flat pure green background #00FF00 with no gradient and no shadow.
- Full body visible, nothing cropped, comfortable margin all around.
- Character centered horizontally, three-quarter view facing slightly to the viewer's left.
- Character about 75% of the image height; feet resting on an invisible baseline at 90% of the image height (same baseline in every image, even when sitting).
- No ground, no cast shadow, no background objects, no text, no speech bubbles, no signature, no watermark.
- Do NOT draw effects (Zzz, sweat drops, speed lines, sparks, glow, aura, motion blur): the app adds them.
```

## Prompt 1 — Planche de référence (la plus importante)

Nom : `rai-sheet.png` (format paysage accepté pour celle-ci)

```
Image 1 — character reference sheet of Rai, using the two attached sketches only for silhouette and colors, in the art style defined above. Landscape 1536 × 1024, plain white background for this sheet only. Show Rai standing in a neutral relaxed pose in four views side by side, same size, same baseline: front, three-quarter left, side profile left, back. Under them, a row of 6 head close-ups showing expressions: neutral, cocky grin, focused/determined, sleepy, startled, laughing. No text labels.
```

## Prompt 2 — Planche de la forme super

Nom : `rai-super-sheet.png`

```
Image 2 — same layout as image 1, same character, but in his SUPER FORM (inspired by the classic "golden super transformation" of shōnen manga): the fur turns radiant gold (#FFCF3A) with warm orange shadows (#E09A00), the three quills rise upward like a flame, the eyes turn crimson red (#E5383B), the lightning tail turns white-hot yellow. For this sheet only, add a soft golden aura and small electric sparks around him. Same proportions, same design otherwise.
```

## Prompt 3 — Image de base (posture de repos)

Nom : `rai-base.png`

```
Image 3 — Rai (normal form, exactly as in image 1), standing relaxed, weight on one leg, arms loose, light confident smile, eyes open looking toward the viewer. Follow the FRAMING rules exactly. This image becomes the master reference for every next pose: keep this exact scale, baseline and position for all following images.
```

## Prompts 4 à 20 — Les poses

Pour chaque prompt, ChatGPT doit partir de `rai-base.png`. Les variantes « b » s'obtiennent en **modifiant** l'image « a » précédente (consistance maximale).

**4 · `rai-base-blink.png`** (clignement des yeux)
```
Edit image 3: identical in every way, but Rai's eyes are closed (relaxed closed eyelids). Nothing else changes, same pixels everywhere else if possible.
```

**5 · `rai-attente-a.png`** (il s'impatiente)
```
Same character, same framing as image 3. Rai stands with arms crossed, one foot lifted to tap impatiently, bored half-lidded eyes glancing to the side, slightly annoyed pout.
```

**6 · `rai-attente-b.png`**
```
Edit the previous image: identical, but the lifted foot is now down on the baseline and the eyes look at the viewer with raised eyebrows.
```

**7 · `rai-focus-a.png`** (il bosse)
```
Same character, same framing. Rai sits cross-legged on the baseline behind a small open laptop seen from the back (the lid faces the viewer, plain dark grey lid with a tiny yellow lightning logo). He wears a red hachimaki headband (#E5383B) tied at the back with two fluttering tails. Fierce focused eyes on the screen, paws on the keyboard.
```

**8 · `rai-focus-b.png`**
```
Edit the previous image: identical, but his paws are in a different typing position (left paw raised, right paw pressing) and the headband tails flutter in a different direction.
```

**9 · `rai-transfo.png`** (la transformation)
```
Same character, same framing. Mid-transformation: Rai crouches with clenched fists, shouting with determination, the fur changing from indigo (feet) to gold (head) in a sharp gradient, quills starting to rise, eyes turning red. No aura, no sparks (added by the app).
```

**10 · `rai-super-a.png`** (forme super)
```
Same character in SUPER FORM as in image 2, same framing as image 3. Standing tall, fists clenched at his sides, quills raised, crimson eyes, cocky confident grin. No aura and no sparks (added by the app).
```

**11 · `rai-super-b.png`**
```
Edit the previous image: identical, but quills and fur slightly shifted as if blown upward by energy, and one fist raised to chest height.
```

**12 · `rai-dodo-a.png`** (il bâille)
```
Same character, normal form, same framing. Rai sits on the baseline, yawning hugely: mouth wide open, eyes squeezed shut, one paw stretching upward, ears slightly lowered.
```

**13 · `rai-dodo-b.png`** (il dort)
```
Same character, same framing. Rai sleeps sitting on the baseline: head drooping forward, eyes closed, mouth slightly open, ears and quills relaxed and drooping, paws resting on his lap. Peaceful but funny. Do not draw any Zzz or bubble.
```

**14 · `rai-sursaut.png`** (réveil en sursaut)
```
Same character, same framing. Rai jumps in the air startled (feet just above the baseline), eyes wide with tiny pupils, fur and quills bristling, arms flailing, mouth open in a gasp. Classic manga startle pose.
```

**15 · `rai-reveil.png`** (fin du focus)
```
Same character, same framing. Rai holds up a ringing red twin-bell alarm clock with one paw above his head, shouting with his mouth wide open, other paw pointing at the viewer, determined eyes.
```

**16 · `rai-pause-a.png`** (pause onigiri)
```
Same character, same framing. Rai sits on the baseline holding an onigiri (triangular rice ball with a nori strip) with both paws, eyes closed in bliss, happy smile.
```

**17 · `rai-pause-b.png`**
```
Edit the previous image: identical, but Rai is taking a big bite of the onigiri, cheeks puffed, a bite mark in the rice ball.
```

**18 · `rai-victoire.png`** (tâche cochée)
```
Same character, same framing. Rai jumps joyfully (feet above the baseline), one paw raised making a V sign, winking, big triumphant grin, tail up.
```

**19 · `rai-esquive.png`** (il file)
```
Same character, same framing. Rai sprints to the viewer's left in side profile, body leaning forward, legs in a long running stride, ears and quills swept back, cocky grin. No motion blur, no speed lines (added by the app).
```

**20 · `rai-moque.png`** (il se moque, pour les répliques ironiques)
```
Same character, same framing. Rai stands with a paw over his mouth, snickering, half-lidded mocking eyes, eyebrows raised, other paw on his hip.
```

**21 · `rai-akanbe.png`** (quand je clique sur lui)
```
Same character, same framing. Rai does the Japanese "akanbe" teasing gesture: pulling down his lower eyelid with one paw and sticking his tongue out, playful.
```

**22 · `rai-salut.png`** (4ᵉ pomodoro bouclé)
```
Same character, same framing. Rai bows formally like a martial arts student, paws together in front of his chest, eyes closed, respectful.
```

**23 · `rai-bulletin.png`** (bulletin du soir)
```
Same character, same framing. Rai holds an open paper scroll in front of him with both paws, reading it with a skeptical teacher look, one eyebrow raised. The scroll is blank (no text).
```

**24 · `rai-icon.png`** (icône, optionnelle)
```
Same character. Square 1024 × 1024, transparent background: Rai's head only, front three-quarter view, cocky grin, filling 85% of the image. Same style.
```

---

## Bonus — sa voix (optionnel, pour plus tard)

Rai dit chaque réplique en japonais, puis dans ta langue. Par défaut, l'app utilise les voix de macOS. Pour une vraie voix « anime », il faudra des clips audio générés avec un outil de synthèse vocale. Le texte de chaque réplique (japonais, romanisation, français, anglais) est dans docs/mascotte/PLAN.md et sur le moodboard. Fiche de voix à donner à l'outil :

```
Voice for "Rai", a cocky, energetic young male anime mascot (shōnen sidekick). Bright, slightly raspy, fast-paced, playful and teasing; exaggerated reactions (gasps, yawns, battle cries). Japanese lines with natural Tokyo intonation; French and English lines with the same character, light Japanese accent.
```

## Prompt de correction (si une image dérive)

```
This image drifted from the reference. Regenerate it matching image 3 (rai-base) exactly: same face shape, same three swept-back quills, same fox ears with pink inside, same indigo #3B4CCA fur, same amber eyes, same lightning-bolt tail, same proportions (3.5 heads tall), same scale and baseline, transparent background, no effects, no text. Only the pose and expression I asked for should change.
```

## Checklist pour chaque image

- [ ] Même visage, mêmes trois piquants, mêmes oreilles de renard, même queue en éclair.
- [ ] Mêmes couleurs (indigo, crème, jaune) ; yeux ambre (rouges seulement en forme super).
- [ ] Fond transparent (ou vert #00FF00 parfaitement uni).
- [ ] Rien de coupé ; personnage centré ; pieds sur la même ligne de base.
- [ ] Pas de texte, pas d'effets, pas d'ombre au sol.
- [ ] Le nom de fichier correspond.

## Ce qu'il faut me rapporter

Les fichiers PNG ci-dessus, de préférence dans un ZIP. Les « b » sont optionnelles mais rendent l'animation bien plus vivante. Minimum viable : `rai-base`, `rai-base-blink`, `rai-focus-a`, `rai-super-a`, `rai-dodo-a`, `rai-dodo-b`, `rai-sursaut`, `rai-reveil`, `rai-pause-a`, `rai-victoire`, `rai-esquive`.
