# CLAUDE.md — reprendre le projet Sakura

Lu automatiquement au début de chaque session Claude Code. À lire ensuite, dans l'ordre :
[`PRODUCT.md`](PRODUCT.md) (quoi, pour qui, principes), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
(comment), [`DECISIONS.md`](DECISIONS.md) (pourquoi, D-001 → D-049), [`BACKLOG.md`](BACKLOG.md).

## Travailler avec l'utilisateur

- **Langue : français**, phrases simples ; il n'est pas développeur, il teste sur son Mac.
- Le développement se fait dans un conteneur Linux distant : rien ne tourne sur son Mac. Il
  installe le `.dmg` produit par GitHub Actions (workflow **Build macOS**, section Artifacts).
- **À chaque nouveau `.dmg`, lui redonner la commande** (il l'a demandé explicitement) :
  ```
  xattr -cr /Applications/Sakura.app
  ```
- Lui donner le lien de la build verte, pas seulement « c'est poussé ».
- Ne jamais lui demander de coller une clé API dans le chat : les secrets vont dans
  GitHub → Settings → Secrets and variables → Actions.

## Règles de code

- Logique métier dans `src/core/` ou `src/companion/`, **pure et testée** ; les composants ne
  font qu'afficher et envoyer des actions. Le widget est le seul écrivain du fichier (D-026).
- Nouveau réglage ou champ : défaut dans `schema.ts`, lecture tolérante, pas de migration.
- Chaînes d'interface en français ; répliques de Rai dans les 5 langues (un test le vérifie).
- Rai ne parle pas pendant un focus, sauf réponse à un geste ou fin de focus (D-048).
- Toute décision non évidente → une entrée `D-0xx` dans `DECISIONS.md` (contexte, décision, raison).

## Avant chaque push

```bash
npm run format:check && npm run lint && npm run typecheck && npm test
bash scripts/check-macos.sh
cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
```
Pour un changement visible : vérifier dans le navigateur (`npm run dev`, `/?view=widget&seed=1`
et `/`, Playwright avec `/opt/pw-browsers`). Vérifier aussi qu'aucun fichier ne diffère d'un
autre que par la casse.

## Version

À chaque livraison : même version dans `package.json`, `src-tauri/Cargo.toml`,
`src-tauri/tauri.conf.json`, `src-tauri/Cargo.lock` (paquet `sakura`), puis
`npm install --package-lock-only`. Pas de tag `v*` sans l'accord de l'utilisateur (il publie
une Release).

## Git

- Le conteneur peut être réinitialisé entre deux messages : **toujours `git fetch` et vérifier
  l'état de la branche** avant de modifier quoi que ce soit.
- Pousser sur la branche de travail de la session ; ne pas ouvrir de PR sans demande.
