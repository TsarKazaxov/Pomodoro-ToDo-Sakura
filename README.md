# Sakura

Minuteur Pomodoro, tâches du jour et heatmap d'effort, dans une petite fenêtre toujours visible sur macOS.

Création d'un projet codé qui sert de Pomodoro sur mon mac pour qu'il soit toujours visible à l'écran et me permettent de aussi prioriser mieux mes tâches sans devoir les garder en tête. Et ainsi, je peux durant la journée, fermer ou changer le statut de ces tâches.

> Installation et utilisation : README complet en Phase 6. Décisions : [`DECISIONS.md`](DECISIONS.md). Hors périmètre : [`BACKLOG.md`](BACKLOG.md). Prototype : [`design/prototype.html`](design/prototype.html).

## Récupérer l'app sans rien installer

Chaque pull request construit un `.dmg` universel (Apple Silicon + Intel) sur un Mac de GitHub :
onglet **Actions** → workflow **Build macOS** → artefact **Sakura-macOS-dmg**.

## Développer sur un Mac

Prérequis : Xcode Command Line Tools, Rust (`rustup`), Node 20+.

```bash
npm install
npm run tauri dev     # lance l'app avec rechargement à chaud
npm test              # tests du minuteur, des calculs et du stockage
npm run lint && npm run typecheck
cd src-tauri && cargo test
```

## Organisation

| Dossier | Contenu |
|---|---|
| `src/core/` | Logique pure, sans Tauri : minuteur, calculs, tâches, schéma du fichier |
| `src/storage/` | Lecture/écriture du fichier de données, sauvegardes, rechargement |
| `src/state/` | État de l'interface (Zustand) |
| `src-tauri/` | App macOS (Rust) : fenêtres, accès disque atomique |
| `design/` | Prototype validé en Phase 1 |
