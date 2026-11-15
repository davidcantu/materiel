#!/usr/bin/env bash
# Linux packaging smoke: build test AppImage + unpacked dir, then launch briefly.
# Headless/CI friendly. Does not publish or sign.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TIMEOUT_SECS="${SMOKE_TIMEOUT_SECS:-8}"
USER_DATA="${SMOKE_USER_DATA_DIR:-/tmp/materiel-smoke-userdata}"
BINARY="${SMOKE_BINARY:-$ROOT/dist/linux-unpacked/materiel}"

# Throwaway key for environments without Electron safeStorage / OS keyring.
export MATERIEL_DB_KEY="${MATERIEL_DB_KEY:-smoke-test-key-do-not-use-in-prod}"

echo "==> build:test:linux"
npm run build:test:linux

if [[ ! -x "$BINARY" ]]; then
  echo "error: missing executable $BINARY" >&2
  exit 1
fi

rm -rf "$USER_DATA"
mkdir -p "$USER_DATA"

echo "==> launch $BINARY (${TIMEOUT_SECS}s timeout, userData=$USER_DATA)"
set +e
timeout "${TIMEOUT_SECS}s" "$BINARY" \
  --no-sandbox \
  --disable-gpu \
  --disable-gpu-compositing \
  --disable-software-rasterizer \
  --disable-dev-shm-usage \
  --in-process-gpu \
  --user-data-dir="$USER_DATA"
EXIT=$?
set -e

# 124 = timeout killed a still-running process (success for smoke).
if [[ "$EXIT" -eq 124 ]]; then
  echo "PASS: packaged app stayed up until timeout (${TIMEOUT_SECS}s)"
  exit 0
fi

echo "FAIL: packaged app exited early with code $EXIT (expected 124 from timeout)" >&2
exit "$EXIT"
