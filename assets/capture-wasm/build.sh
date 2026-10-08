#!/usr/bin/env bash
# assets/capture-wasm/build.sh
# ------------------------------------------------------------
# Пересобирает capture.wasm из assembly/capture.ts.
# Требует: npm install --save-dev assemblyscript (см. package.json).
set -euo pipefail
cd "$(dirname "$0")"

npx asc assembly/capture.ts \
  --target release \
  --outFile capture.wasm \
  --exportRuntime \
  --runtime stub \
  --optimize \
  --noAssert

echo "OK: $(wc -c < capture.wasm) байт → capture.wasm"
