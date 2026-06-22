#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
IMAGE="liudonghua123/tauri-build:latest"
CARGO_TARGET_DIR="apps/desktop/src-tauri/target-linux"

ROOT_NM_VOLUME="omanote-root-node-modules"
DESKTOP_NM_VOLUME="omanote-desktop-node-modules"
CARGO_REG_VOLUME="omanote-cargo-registry"
CARGO_GIT_VOLUME="omanote-cargo-git"

docker volume create "$ROOT_NM_VOLUME" > /dev/null
docker volume create "$DESKTOP_NM_VOLUME" > /dev/null
docker volume create "$CARGO_REG_VOLUME" > /dev/null
docker volume create "$CARGO_GIT_VOLUME" > /dev/null

echo "=== Pulling Tauri build image ==="
docker pull "$IMAGE"

echo "=== Building Linux desktop app ==="
docker run --rm -i \
    -v "$PROJECT_DIR:/app" \
    -v "$ROOT_NM_VOLUME:/app/node_modules" \
    -v "$DESKTOP_NM_VOLUME:/app/apps/desktop/node_modules" \
    -v "$CARGO_REG_VOLUME:/root/.cargo/registry" \
    -v "$CARGO_GIT_VOLUME:/root/.cargo/git" \
    -e CARGO_TARGET_DIR="/app/$CARGO_TARGET_DIR" \
    "$IMAGE" \
    bash -euo pipefail -c '
        echo "--- Installing npm dependencies ---"
        npm ci
        npm ci --prefix apps/desktop

        echo "--- Building Tauri app (Linux) ---"
        npm run build --prefix apps/desktop
    '

echo ""
echo "=== Build complete! ==="
echo "Artifacts: $PROJECT_DIR/$CARGO_TARGET_DIR/release/bundle/"
ls -lh "$PROJECT_DIR/$CARGO_TARGET_DIR/release/bundle/" 2>/dev/null || echo "(no bundle output yet)"
