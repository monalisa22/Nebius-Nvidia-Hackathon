#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REVISION=9b904dcc22c23fe8b82834339bbdd96495072e59
cd "$ROOT"
command -v uv >/dev/null || { printf '%s\n' 'Install uv and Python 3.14 first.'; exit 1; }
if [[ ! -d .runtime/hermes-agent/.git ]]; then
  git clone --filter=blob:none --no-checkout https://github.com/NousResearch/hermes-agent.git .runtime/hermes-agent
  git -C .runtime/hermes-agent checkout --detach "$REVISION"
fi
[[ "$(git -C .runtime/hermes-agent rev-parse HEAD)" == "$REVISION" ]] || {
  printf '%s\n' 'The local Hermes checkout has a different revision. Review it before changing the pinned integration.'
  exit 1
}
UV_PROJECT_ENVIRONMENT="$ROOT/.runtime/hermes-venv" uv sync --project .runtime/hermes-agent --frozen --no-dev --python 3.14
printf '%s\n' 'Hermes library runtime installed. Enable TOGETHERLY_HERMES_ENABLED=true for both the web app and worker.'
