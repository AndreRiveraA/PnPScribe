#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

printf "Installing root dependencies...\n"
( cd "$ROOT_DIR" && npm install )

printf "Installing apps/web dependencies...\n"
( cd "$ROOT_DIR/apps/web" && npm install )

printf "Installing services/ocr-worker dependencies...\n"
( cd "$ROOT_DIR/services/ocr-worker" && npm install )

printf "Installing services/entity-worker dependencies...\n"
( cd "$ROOT_DIR/services/entity-worker" && npm install )

printf "Setup complete.\n"
