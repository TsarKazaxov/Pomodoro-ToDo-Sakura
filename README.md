# Sakura

Minuteur Pomodoro, tâches du jour et heatmap d'effort, dans une petite fenêtre toujours visible sur macOS.

- **Widget** dans un coin de l'écran : un ensō qui se dessine pendant le focus, la tâche en cours, tes priorités du jour, ta mini heatmap. Il se déploie quand tu poses le curseur dessus.
- **Tâches** avec une taille T-shirt (XS à XL) : ajoute-les en une ligne, `Relire la spec #M`.
- **Activité** : une heatmap façon GitHub remplie par l'effort accompli (les points des tâches terminées), et la **calibration** : est-ce que tes M prennent vraiment 4 pomodoros ?

Tes données restent chez toi, dans un fichier JSON sur iCloud Drive. Pas de compte, pas de serveur.

---

## Installer

1. Télécharge le dernier `Sakura_x.y.z_universal.dmg` :
   - version publiée : page **Releases** du dépôt ;
   - version en cours : onglet **Actions** → workflow **Build macOS** → dernière exécution verte → artefact **Sakura-macOS-dmg** (un `.zip` qui contient le `.dmg`).
2. Ouvre le `.dmg` et glisse **Sakura** dans **Applications**.
3. Sakura n'est pas signée par un compte Apple Developer (99 $/an). macOS refuse donc de l'ouvrir la première fois (« Sakura est endommagé » ou « développeur non identifié »). Dans le Terminal :

   ```bash
   xattr -cr /Applications/Sakura.app
   ```

   Puis ouvre Sakura normalement. À faire une seule fois par installation.

4. Au premier lancement : choisis la durée du focus, le coin de l'écran, ta première tâche. Le widget apparaît dans le coin choisi.
5. À la première fin de focus, macOS demande l'autorisation d'afficher des notifications : accepte-la pour être prévenu quand le widget est replié.

Le `.dmg` est **universel** : il fonctionne sur les Mac Apple Silicon (M1 et suivants) et Intel. macOS 11 Big Sur minimum.

## Utiliser

| Où | Quoi |
|---|---|
| Widget replié | Temps restant, tâche en cours, état (Focus · Pause · Suspendu · Arrêté) |
| Widget déployé (curseur immobile 0,3 s dessus) | Démarrer/Suspendre, Passer, Réinitialiser (↻), tâche en cours, priorités du jour à cocher, ajout rapide, mini heatmap, « Ouvrir Sakura » |
| Barre de menu (ensō) | Temps restant, Démarrer/Suspendre, Ouvrir Sakura, Quitter |
| Vue complète | Onglets **Tâches** (glisser-déposer, filtres, édition), **Activité** (heatmap 26 semaines, calibration), **Réglages** |

**Raccourcis globaux** (depuis n'importe quelle app) :

| Raccourci | Action |
|---|---|
| ⌥⌘P | Démarrer / suspendre le minuteur |
| ⌥⌘N | Ajouter une tâche (le widget s'ouvre, le curseur est dans le champ) |
| ⌥⌘S | Ouvrir la vue complète |

**Ajout rapide** : `Titre #XS`, `#S`, `#M`, `#L` ou `#XL`. Sans taille, la tâche est une S.

**Barème** (modifiable dans Réglages) :

| Taille | Points | Pomodoros attendus |
|---|---|---|
| XS | 1 | 1 |
| S | 2 | 2 |
| M | 3 | 4 |
| L | 5 | 8 |
| XL | 8 | 12+ (Sakura te conseille de la découper) |

**Récompense** : cocher des tâches à moins de 10 minutes d'intervalle fait monter une série (×2, ×3, ×4) : plus de pétales, un son plus riche, et au 4ᵉ une pluie sur tout l'écran. « Mouvement réduit » (Réglages Système → Accessibilité → Affichage) coupe les pétales.

**Calibration** : par taille, pomodoros réels ÷ attendus. En dessous de 0,8 tu surestimes, au-dessus de 1,2 tu sous-estimes. Elle s'affiche dès 5 tâches terminées (avec au moins un pomodoro) dans une taille.

## Tes données

| Quoi | Où |
|---|---|
| Fichier de données | `iCloud Drive/Sakura/sakura-data.json` (si iCloud Drive est activé), sinon `~/Library/Application Support/dev.sakura.pomodoro/` |
| Sauvegardes | Dossier `backups/` à côté : une par jour, les 7 dernières |
| Emplacement choisi sur ce Mac | `~/Library/Application Support/dev.sakura.pomodoro/location.json` |

- Chaque écriture est **atomique** : une coupure de courant ou une fermeture forcée laisse l'ancienne version ou la nouvelle, jamais un fichier abîmé.
- **Fichier illisible** : Sakura ne l'écrase pas et propose de restaurer la dernière sauvegarde.
- **Autre Mac** : installe Sakura sur le nouveau Mac, connecte-toi au même iCloud. Tes données y sont. Sakura est conçue pour un usage d'un Mac **à la fois** : si un autre Mac a modifié le fichier, Sakura relit sa version avant d'écrire.
- **Changer de dossier, exporter, importer** : Réglages → Données.

## Mettre à jour

Télécharge le nouveau `.dmg`, quitte Sakura (barre de menu → Quitter Sakura), remplace l'app dans Applications, relance `xattr -cr /Applications/Sakura.app`. Tes données ne bougent pas.

## Désinstaller

Quitte Sakura, mets `/Applications/Sakura.app` à la corbeille. Pour tout effacer : supprime aussi `iCloud Drive/Sakura` et `~/Library/Application Support/dev.sakura.pomodoro`. Si tu avais activé « Lancer au démarrage », désactive-le d'abord dans Réglages (ou supprime l'élément dans Réglages Système → Général → Ouverture).

## En cas de souci

| Symptôme | Que faire |
|---|---|
| « Sakura est endommagé et ne peut pas être ouvert » | `xattr -cr /Applications/Sakura.app` |
| Pas de notification | Réglages Système → Notifications → Sakura → autoriser |
| Un raccourci ne répond pas | Une autre app l'utilise déjà ; Sakura l'ignore sans planter |
| Le widget ne s'affiche pas par-dessus une app en plein écran | Quitte et relance Sakura ; si le problème persiste, signale-le (D-032) |
| « Téléchargement de tes données depuis iCloud Drive… » qui dure | Ouvre le dossier Sakura dans le Finder pour forcer le téléchargement |

---

## Développer

Prérequis sur le Mac : Xcode Command Line Tools (`xcode-select --install`), Rust (`rustup`), Node 20+.

```bash
npm install
npm run tauri dev       # lance l'app avec rechargement à chaud
npm test                # 147 tests : minuteur, calculs, stockage, synchronisation, fuseaux
npm run lint && npm run typecheck && npm run format:check
cd src-tauri && cargo test && cargo clippy --all-targets -- -D warnings
```

- **Aperçu sans Tauri** : `npm run dev`, puis `http://localhost:1420/?view=widget&seed=1` (widget + données de démonstration) dans un onglet et `http://localhost:1420/` (vue complète) dans un autre. `&load=1000` ajoute 1 000 tâches.
- **Vérifier le code macOS depuis Linux** : `scripts/check-macos.sh`.
- **Construire le `.dmg` universel** : `rustup target add aarch64-apple-darwin x86_64-apple-darwin` puis `npm run tauri build -- --target universal-apple-darwin`.
- **Publier une version** : mets à jour la version dans `package.json`, `src-tauri/Cargo.toml` et `src-tauri/tauri.conf.json`, puis `git tag v1.0.1 && git push origin v1.0.1`. Le workflow **Build macOS** construit le `.dmg` et l'attache à une Release.

| Dossier | Contenu |
|---|---|
| `src/core/` | Logique pure, sans Tauri : minuteur, calculs, tâches, schéma du fichier |
| `src/storage/` | Fichier de données, sauvegardes, emplacement |
| `src/state/` | État partagé entre fenêtres : actions, réducteur, transport |
| `src/widget/`, `src/main/`, `src/overlay/` | Les trois fenêtres : widget, vue complète, pluie de pétales |
| `src-tauri/` | App macOS (Rust) : fenêtres, barre de menu, raccourcis, natif macOS, accès disque |
| `tests/` | Tests d'intégration sur le vrai disque, fuseaux horaires |
| `design/` | Prototype validé en Phase 1 |
| `docs/QA.md` | Résultats de la passe qualité et checklist de test sur Mac |

Décisions : [`DECISIONS.md`](DECISIONS.md). Hors périmètre V1 : [`BACKLOG.md`](BACKLOG.md).
