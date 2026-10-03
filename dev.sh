#!/usr/bin/env bash
# Starts Postgres, the Go API (:8080) and the Next.js app (:3000). Ctrl+C stops both apps.
set -euo pipefail

root="$(cd "$(dirname "$0")" && pwd)"

echo "Starting Postgres..."
docker compose -f "$root/docker-compose.yml" up -d --wait

if [ ! -d "$root/web/node_modules" ]; then
  echo "Installing web dependencies..."
  (cd "$root/web" && pnpm install)
fi

if [ "${1:-}" = "--seed" ]; then
  echo "Seeding demo data..."
  (cd "$root/server" && go run ./cmd/toki seed)
fi

pids=()
cleanup() {
  trap - INT TERM EXIT
  echo
  echo "Stopping..."
  for pid in "${pids[@]}"; do
    # Kill the whole process group so `go run` and `next dev` children stop too.
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

# Each app runs in its own process group (set -m) and prefixes its output.
set -m
(cd "$root/server" && go run ./cmd/toki 2>&1 | sed -u 's/^/[api] /') &
pids+=($!)
(cd "$root/web" && pnpm dev 2>&1 | sed -u 's/^/[web] /') &
pids+=($!)
set +m

echo "API: http://localhost:8080   Web: http://localhost:3000   (Ctrl+C to stop)"

# Exit when either app stops, so a crash does not leave the other one running alone.
# (macOS ships bash 3.2, which has no `wait -n`.)
while kill -0 "${pids[0]}" 2>/dev/null && kill -0 "${pids[1]}" 2>/dev/null; do
  sleep 1
done
