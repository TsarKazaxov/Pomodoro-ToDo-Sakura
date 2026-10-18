# Prompt pour la nouvelle conversation Claude Code (implémentation de Rai)

À coller dans une **nouvelle** session Claude Code sur ce dépôt, avec les images générées jointes (ZIP) :

```
Contexte : application macOS « Sakura » (Tauri 2 + React + TypeScript), branche de travail actuelle du dépôt. Lis d'abord README.md, DECISIONS.md (D-001 à D-043), docs/mascotte/PLAN.md et docs/mascotte/PROMPTS-GPT.md. Le moodboard validé est décrit dans PLAN.md.

Mission : remplacer Neko (D-043) par Rai, une mascotte manga vivante qui réagit à mon travail, en suivant docs/mascotte/PLAN.md, en totale autonomie. Ne me pose une question que si elle est vraiment bloquante.

Entrées : les images PNG jointes (noms définis dans PROMPTS-GPT.md). Mets-les dans assets/rai/source/, détoure-les si le fond est vert (#00FF00), convertis-les en WebP ~256 px de haut dans src/assets/rai/, et fais-moi une planche de contrôle avant de continuer.

Ordre :
0. Prototype technique d'abord, à me faire tester sur Mac : fenêtre transparente dont les zones vides laissent passer les clics, voix système japonaise puis française, coût CPU d'une animation.
1. Moteur de comportement pur et testé (src/companion/), répliques ja/romaji/fr/en avec variantes.
2. Fenêtre compagnon (Rai + fiche du minuteur), dispositions selon la position, bulles.
3. Voix (activable), langue de traduction FR/EN/aucune, japonais en premier, mode discret, réglages.
4. Esquive quand mon curseur s'attarde, balade en pause, bulletin du soir.
5. Qualité : budget CPU < 2 % (D-036), réduction des animations respectée, tests, DECISIONS.md, docs/QA.md, version 1.1.0, .dmg via la CI.

Règles du dépôt : français dans l'interface et la doc, décisions consignées dans DECISIONS.md, tests verts avant chaque push, commits clairs, pousse sur la branche de travail, pas de nouvelle PR (la PR #1 existe). À chaque nouveau .dmg, redonne-moi la commande : xattr -cr /Applications/Sakura.app
```

## Pourquoi une nouvelle conversation

- Celle-ci est très longue (déjà résumée une fois) : une session neuve part d'un contexte propre, et tout ce qu'il faut savoir est dans le dépôt (DECISIONS.md, PLAN.md, PROMPTS-GPT.md).
- Le chantier commence quand les images existent : la nouvelle session les reçoit d'emblée.
