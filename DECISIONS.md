# DECISIONS — Sakura

Journal des décisions prises quand le brief ne tranchait pas. Format : contexte → décision → raison. Les décisions marquées **(à valider)** dépendent d'une réponse aux questions ouvertes en bas de fichier.

---

## Phase 0 — Cadrage

### D-001 · Environnement de développement : cloud Linux, test réel sur ton Mac
- **Contexte** : ce dépôt est développé dans un conteneur Linux distant, pas sur ton Mac. Tout ce qui est propre à macOS (fenêtre transparente au premier plan sur tous les espaces, barre de menu, raccourcis globaux, notifications, iCloud Drive, veille) ne peut **pas** être exécuté ni observé ici.
- **Décision** :
  1. Tout ce qui est logique pure (minuteur, calculs, stockage, fusion) est développé en TypeScript testé par Vitest ici, indépendamment de Tauri.
  2. Le workflow GitHub Actions `macos-latest` (étape 24) est **avancé en Phase 2** : chaque push produit un `.dmg` universel téléchargeable en artefact de CI. C'est notre boucle de test macOS.
  3. Le prototype de la Phase 1 est publié en page web consultable depuis n'importe quel navigateur.
- **Raison** : sans ça, les phases 3 et 5 seraient du code écrit à l'aveugle.

### D-002 · Style : CSS Modules + variables CSS (pas Tailwind)
- **Raison** : les tokens du brief sont déjà des variables CSS ; le thème clair/sombre se fait en redéfinissant `:root`. Tailwind ajouterait une couche de configuration pour ~3 écrans. CSS Modules = zéro runtime, portée locale, lisible.

### D-003 · Polices : sous-ensemble latin embarqué en woff2
- **Contexte** : Shippori Mincho et Zen Kaku Gothic New complètes pèsent plusieurs Mo par graisse (jeu de caractères japonais).
- **Décision** : sous-ensemble Latin + Latin-1 Supplément (accents français) + chiffres + ponctuation, 2 graisses max par police, woff2. Repli sur `Hiragino Mincho ProN` / `Hiragino Sans` (présentes sur macOS) si un titre de tâche contient du japonais.
- **Raison** : respecte « polices embarquées, pas de réseau » sans gonfler le binaire. Licence SIL OFL : redistribution autorisée.

### D-004 · Langue de l'interface : français, chaînes centralisées
- Toutes les chaînes dans un seul module `src/i18n/fr.ts`. Pas de système i18n complet (hors V1).

### D-005 · Modèle de données : champs ajoutés au brief
Le modèle du brief ne permet ni la synchro entre deux Mac, ni un minuteur qui survit à un redémarrage. Ajouts :
```ts
interface Task {
  // … champs du brief …
  updatedAt: string;      // ISO — arbitrage de fusion entre deux Mac
}
interface Session {
  // … champs du brief …
  pausedMs: number;       // temps cumulé en pause (le minuteur est basé sur horodatages)
}
interface TimerState {    // persisté : le minuteur survit à une fermeture forcée
  phase: 'idle' | 'focus' | 'short_break' | 'long_break';
  startedAt?: string;
  pausedAt?: string;      // défini si en pause
  pausedMs: number;
  taskId?: string;
  focusCountInCycle: number;
}
interface DataFile {
  schemaVersion: number;
  deviceId: string;       // identifie le Mac auteur de la dernière écriture
  tasks: Task[]; sessions: Session[]; settings: Settings; timer: TimerState;
}
```

### D-006 · ~~Synchronisation iCloud : fusion par entité~~ → remplacée par D-014
_Conservé pour l'historique. Q4 a montré qu'il n'y a qu'un Mac aujourd'hui._

### D-006-old · Synchronisation iCloud : fusion par entité, pas « dernier qui écrit gagne »
- **Contexte** : un seul JSON réécrit en entier. Si les deux Mac écrivent à quelques secondes d'intervalle, le dernier écrase les tâches créées par l'autre. iCloud peut aussi créer des copies « conflit » (`sakura-data 2.json`).
- **Décision** : au rechargement (mtime changé), fusion par `id` — la version au `updatedAt` le plus récent gagne, les `deletedAt` se propagent, les sessions sont une union (append-only). Les fichiers de conflit iCloud détectés dans le dossier sont fusionnés puis archivés.
- **Garde-fou** : si le fichier est un placeholder `.icloud` (stockage optimisé), on demande le téléchargement et on affiche « synchronisation en cours » au lieu de croire le fichier absent.

### D-007 · Journée = date locale au moment de l'événement
- Une tâche compte pour le jour **local** où elle a été cochée. On stocke l'ISO avec décalage (`2026-10-05T14:03:00+02:00`) pour qu'un changement de fuseau ne déplace pas rétroactivement les cases de la heatmap.

### D-008 · Calibration : quelles tâches comptent
- Comptent : tâches `done` avec `pomodorosSpent ≥ 1`.
- Ne comptent pas : `dropped`, et tâches cochées sans aucun pomodoro (on ne sait pas ce qu'elles ont coûté ; les inclure tirerait tous les ratios vers « tu surestimes »).
- XL : attendu = 12 (borne basse du « 12+ »).
- Le seuil « 5 tâches » s'applique après ce filtre.

### D-009 · Pomodoro sans tâche sélectionnée
- Autorisé. Enregistré sans `taskId`. Compte dans « pomodoros du jour » et le taux terminés/interrompus, pas dans les points ni la calibration.

### D-010 · Décocher une tâche
- Repasse en `todo`, `completedAt` effacé : la heatmap se met à jour immédiatement dans les deux sens.

### D-011 · Tauri 2 : corrections techniques du brief
- `tray-icon` n'est pas un plugin en Tauri 2 mais une feature du crate `tauri` (`features = ["tray-icon"]`).
- `visibleOnAllWorkspaces: true` couvre les bureaux classiques ; l'affichage **par-dessus une app en plein écran** demande le comportement `NSWindowCollectionBehaviorFullScreenAuxiliary` (appel natif Objective-C côté Rust). À vérifier en Phase 3.
- Survol d'une fenêtre non active : on active `acceptFirstMouse` pour que le premier clic agisse sans d'abord donner le focus.

### D-012 · Redimensionnement du widget
- Une seule fenêtre `widget` redimensionnée (240×64 ↔ 360×520) ; quand l'ancrage est à droite/en bas, on déplace aussi l'origine pour que le coin reste fixe. Redimensionnement et déplacement envoyés dans le même appel Rust (`set_frame` natif) pour éviter un saut visuel d'une frame.

---

## Réponses au cadrage (Phase 0)

| Q | Réponse | Conséquence |
|---|---|---|
| Q1 Heatmap | Points des tâches terminées + point discret si pomodoros sans tâche terminée | D-013 |
| Q2 Test sur Mac | Oui, via le `.dmg` de la CI | D-001 confirmé |
| Q3 Raccourcis | Pas de conflit | ⌥⌘P / ⌥⌘N / ⌥⌘S gardés |
| Q4 Deux Mac | Un seul Mac aujourd'hui ; un éventuel 2ᵉ sera utilisé l'un après l'autre | D-014 |
| Q5 Prototype | Page web publiée | Le prototype sert à valider le design ; la fenêtre flottante réelle arrive en Phase 3 |

### D-013 · Heatmap : intensité = points, marque d'effort en cours
- Couleur de la case = somme des points des tâches terminées ce jour-là (brief inchangé).
- Si la case vaut 0 point mais compte ≥ 1 pomodoro terminé : petit point `--ink-muted` au centre. Un jour passé sur une XL non terminée n'apparaît plus comme vide.
- L'infobulle affiche toujours points, tâches et pomodoros.

### D-014 · iCloud : emplacement oui, fusion non
- **Contexte** : un seul Mac aujourd'hui. Un usage successif (jamais simultané) ne justifie pas un moteur de fusion.
- **Décision** :
  - Le fichier reste dans iCloud Drive par défaut : sauvegarde gratuite et migration vers un futur Mac sans rien faire.
  - Rechargement si la date de modification change (prévu au brief, peu coûteux) ; dernière écriture gagne.
  - Garde-fou unique : au démarrage, si le fichier iCloud est plus récent que la dernière lecture, on le relit **avant** toute écriture (évite d'écraser les données d'un autre Mac pas encore descendues).
  - Placeholders `.icloud` gérés (D-006-old, garde-fou conservé).
  - `updatedAt` conservé (coût nul). `deletedAt` et la fusion par entité → `BACKLOG.md`.
- **Impact sur « Terminé » V1** : le critère « synchro entre deux Mac » devient « survit à un changement de Mac via iCloud, en usage successif ».

---

## Phase 1 — Prototype

### D-015 · Contraste AA : deux tokens clairs ajustés
Mesures sur `--paper` (WCAG, texte < 18 px) :

| Token | Brief | Ratio | Corrigé | Ratio |
|---|---|---|---|---|
| `--ink-muted` clair | `#7A7068` | 4,26 ✗ | `#716860` | 4,80 ✓ |
| `--shu` clair | `#C8432F` | 4,30 ✗ | `#BD3F2C` | 4,73 ✓ |

Le reste passe : `--ink` 13,2 (clair) / 14,0 (sombre), `--ink-muted` sombre 5,6, `--shu` sombre 4,9. `--sakura` clair (1,8) ne porte jamais de texte : il sert de fond (texte `--ink` dessus : 7,2) ou de marque graphique.

### D-016 · Enchaînement des phases
- Fin d'un focus → la pause (courte ou longue) **démarre seule**.
- Fin d'une pause → le minuteur attend : le focus suivant ne démarre qu'au clic. Personne ne veut repartir en focus sans être revenu à son bureau.
- « Passer » termine la phase en cours comme **interrompue** (compte dans le taux d'interruption) et passe à la suivante.

### D-017 · Ajout rapide
- Syntaxe `Titre #M` (insensible à la casse). Sans `#taille` → **S**.
- Une tâche ajoutée depuis le widget est épinglée en priorité (on l'ajoute dans la liste « Priorités du jour »). Depuis l'onglet Tâches, elle ne l'est pas.

### D-018 · Vocabulaire
- **Pause** = la pause du Pomodoro (courte/longue). **Suspendu** = le minuteur arrêté par l'utilisateur. Les deux mots ne doivent jamais se croiser à l'écran.
