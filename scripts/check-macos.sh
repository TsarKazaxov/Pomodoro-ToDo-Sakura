#!/usr/bin/env bash
# Vérifie depuis Linux que le code Rust compile pour macOS (Apple Silicon), sans éditer les liens.
# Prérequis : `rustup target add aarch64-apple-darwin` et clang. Les notifications sont exclues
# (leur crate exige les en-têtes Cocoa) ; leur permission est retirée le temps de la vérification.
set -euo pipefail
cd "$(dirname "$0")/../src-tauri"
cap=capabilities/default.json
cp "$cap" "$cap.bak"
trap 'mv "$cap.bak" "$cap"' EXIT
python3 -c "import json;c=json.load(open('$cap'));c['permissions']=[p for p in c['permissions'] if not p.startswith('notification')];json.dump(c,open('$cap','w'))"
CC_aarch64_apple_darwin=clang CFLAGS_aarch64_apple_darwin="--target=arm64-apple-macos11" \
  cargo clippy --target aarch64-apple-darwin --no-default-features -- -D warnings
