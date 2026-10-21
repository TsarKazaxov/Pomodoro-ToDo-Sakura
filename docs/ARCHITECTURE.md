# ARCHITECTURE — Sakura

Comment le code est organisé et quelles règles le gardent propre. Le produit est décrit dans
[`PRODUCT.md`](../PRODUCT.md), les choix datés dans [`DECISIONS.md`](../DECISIONS.md).

Stack : **Tauri 2** (Rust) + **React 18** + **TypeScript** strict + **Vite**, CSS Modules,
Zustand, Vitest. Pas de serveur.

---

## 1. Vue d'ensemble

```
┌──────────────────────────── App macOS (Rust, src-tauri/) ────────────────────────────┐
│  fenêtres · barre de menu · raccourcis globaux · natif macOS · disque · voix `say`   │
└───────────────▲───────────────────────────────▲───────────────────────────▲─────────┘
                │ commandes / événements Tauri  │                           │
   ┌────────────┴────────────┐      ┌───────────┴───────────┐     ┌─────────┴─────────┐
   │ Fenêtre WIDGET          │◀────▶│ Fenêtre VUE COMPLÈTE  │     │ Fenêtre PLUIE     │
   │ propriétaire des données│ état │ cliente (actions)     │     │ pétales, 5,5 s    │
   │ src/widget/             │      │ src/main/             │     │ src/overlay/      │
   └────────────┬────────────┘      └───────────────────────┘     └───────────────────┘
                │ seul écrivain
        ┌───────┴────────┐
        │ sakura-data.json│  iCloud Drive/Sakura/ ou ~/Library/Application Support/…
        └────────────────┘
```

**Une seule fenêtre écrit le fichier : le widget** (D-026). La vue complète envoie des actions
et reçoit l'état complet en retour. Aucune course entre fenêtres.

## 2. Couches (du plus pur au plus concret)

| Couche | Dossier | Règle |
|---|---|---|
| **Domaine** | `src/core/` | TypeScript pur : **aucun import** de React, Tauri, DOM ou du disque. Tout y est testé. Minuteur, tâches, effort, statistiques, schéma du fichier. |
| **Mascotte** | `src/companion/` | Pur aussi : `engine.ts` (humeur, réactions, quand parler), `lines.ts` (répliques, 5 langues), `voiceClips.ts` (quel clip pour quelle réplique). |
| **État** | `src/state/` | `actions.ts` = réducteur pur `(données, action) → (données, effets)` ; `store.ts` = Zustand + transport entre fenêtres (Tauri en prod, BroadcastChannel dans le navigateur). |
| **Stockage** | `src/storage/` | `dataStore.ts` : lecture/écriture, sauvegarde quotidienne, rechargement. Tout passe par une interface `FsAdapter` (Rust en prod, mémoire en test). |
| **Interface** | `src/widget/`, `src/main/`, `src/overlay/`, `src/ui/` | React + CSS Modules. Ne calcule rien de métier : appelle `core/` et envoie des actions. |
| **Pont natif** | `src/platform.ts` | Seul fichier qui appelle Tauri. Hors Tauri (navigateur), chaque appel est sans effet. |
| **Natif** | `src-tauri/src/` | Rust : `widget.rs` (fenêtre, ancrage, clics à travers le vide), `macos.rs`, `tray.rs`, `shortcuts.rs`, `store.rs` (écriture atomique), `voice.rs`. |

**Sens des dépendances** : interface → état → domaine. Le domaine ne dépend de rien.
Une nouvelle règle métier va dans `core/` (avec ses tests), jamais dans un composant.

## 3. Données

- Fichier unique `sakura-data.json` : `{ schemaVersion, deviceId, tasks, sessions, settings, timer }`
  (types : `src/core/types.ts`).
- **Lecture tolérante** (`schema.ts`) : un champ manquant prend sa valeur par défaut, un ancien
  format est converti à la lecture (ex. `expectedPomodoros` → `minutes`, ancienne langue de
  Rai). On ajoute des champs **sans migration**.
- Écriture atomique (temporaire + `fsync` + renommage), copie de la veille avant la première
  écriture du jour.
- Minuteur = horodatages en ms epoch, jamais un compteur qui tourne.

## 4. Flux d'une action

```
clic « Démarrer » (vue complète)
  → action envoyée au widget (transport)
  → réducteur pur actions.ts → nouvelles données + effets (son, pétales, notification)
  → widget écrit le fichier, joue les effets, diffuse l'état
  → les deux fenêtres se redessinent
```

## 5. Rai (mascotte)

- `engine.step(état, tick, événements)` est appelé **une fois par seconde** (le tick existant,
  pas de minuterie en plus) et renvoie humeur, pose, bulle éventuelle.
- Images : `assets/rai/source/` → `scripts/rai-assets.py` (détourage, échelle, WebP 256 px) →
  `src/assets/rai/`.
- Voix : `src/assets/rai/voice/voice.json` (ID de voix ElevenLabs) → workflow **Voix de Rai**
  (`scripts/rai-voice.mjs`, secret `ELEVENLABS_API_KEY`) → clips `src/assets/rai/voice/<langue>/`
  + `manifest.json`. L'app joue un clip seulement si le manifeste confirme qu'il dit le texte
  actuel ; sinon voix de macOS (`voice.rs`).

## 6. Qualité et livraison

| Vérification | Commande |
|---|---|
| Format, lint, types | `npm run format:check && npm run lint && npm run typecheck` |
| Tests (domaine, stockage, Rai, CSP…) | `npm test` |
| Rust | `cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test` |
| Code macOS depuis Linux | `bash scripts/check-macos.sh` |
| Aperçu sans Tauri | `npm run dev` → `/?view=widget&seed=1` et `/` dans deux onglets |

GitHub Actions : **CI** (tout ce qui précède) et **Build macOS** (`.dmg` universel en artefact ;
publié en Release sur un tag `v*`) à chaque push ; **Voix de Rai** quand les répliques ou la voix
changent.

## 7. Pièges connus

- **CSP** (`src-tauri/tauri.conf.json`) : tout nouveau type de ressource chargé par la page
  (fetch, audio…) doit y être autorisé, sinon il échoue **sans bruit** dans l'app alors qu'il
  marche dans le navigateur. Un test le vérifie pour les clips (D-049).
- **Casse des noms de fichiers** : macOS ne distingue pas `Rai.tsx` et `rai.ts` ; deux fichiers
  qui ne diffèrent que par la casse cassent la build `.dmg`.
- **Commits du robot GitHub** : ils ne relancent pas la build ; la build qui les embarque part
  du commit suivant.
- **Fenêtre transparente** : elle bloque les clics sur toute sa surface ; les zones opaques
  doivent porter `data-hit` pour rester cliquables (D-045).
