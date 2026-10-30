#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -x "$ROOT/.runtime/node-v22.19.0-linux-x64/bin/node" ]]; then
  export PATH="$ROOT/.runtime/node-v22.19.0-linux-x64/bin:$PATH"
fi
cd "$ROOT"
node node_modules/tsx/dist/cli.mjs scripts/anubandh-worker.ts &
WORKER_PID=$!
cleanup() { kill "$WORKER_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port "${PORT:-3000}" "$@"
