#!/usr/bin/env bash
# Runs every test suite: Go API (against Postgres), web and extension.
#
#   ./test.sh                  all suites
#   ./test.sh server web       only the named suites (server, web, extension)
#
# The Go tests need Postgres. By default this starts the docker compose
# database and uses a separate "toki_test" database in it, so your dev data
# is never touched. Set TEST_DATABASE_URL to use another database instead.
set -euo pipefail

root="$(cd "$(dirname "$0")" && pwd)"
suites=("$@")
[ ${#suites[@]} -eq 0 ] && suites=(server web extension)

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

run_server() {
  if [ -z "${TEST_DATABASE_URL:-}" ]; then
    step "Starting Postgres (docker compose)"
    docker compose -f "$root/docker-compose.yml" up -d --wait
    if ! docker compose -f "$root/docker-compose.yml" exec -T db \
      psql -U toki -tAc "SELECT 1 FROM pg_database WHERE datname='toki_test'" | grep -q 1; then
      docker compose -f "$root/docker-compose.yml" exec -T db createdb -U toki toki_test
    fi
    export TEST_DATABASE_URL="postgres://toki:toki@localhost:5433/toki_test?sslmode=disable"
  fi
  step "server: go vet"
  (cd "$root/server" && go vet ./...)
  step "server: go test"
  (cd "$root/server" && go test -race -count=1 ./...)
}

run_js() {
  local dir="$1"
  shift
  if [ ! -d "$root/$dir/node_modules" ]; then
    step "$dir: pnpm install"
    (cd "$root/$dir" && pnpm install --frozen-lockfile)
  fi
  for script in "$@"; do
    step "$dir: pnpm $script"
    (cd "$root/$dir" && pnpm "$script")
  done
}

for suite in "${suites[@]}"; do
  case "$suite" in
    server) run_server ;;
    web) run_js web typecheck lint test ;;
    extension) run_js extension compile test ;;
    *)
      echo "unknown suite '$suite' (use server, web or extension)" >&2
      exit 2
      ;;
  esac
done

step "All tests passed (${suites[*]})"
