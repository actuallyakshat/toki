# Toki

Toki (時, "time") is an open-source wishlist. Save products from any store with the
Chrome extension, track their prices from your own browser, get an email when a
price drops, and see every price as hours of your work — on the web or on your phone.

| Folder | What it is |
|---|---|
| `server/` | Go API and email worker (about 20 MB RAM) |
| `web/` | Next.js website |
| `extension/` | Chrome extension (WXT, Manifest V3) |
| `mobile/` | iOS and Android app (Expo, React Native) |

Specifications: [`CONTRACT.md`](CONTRACT.md) (API and price-check rules), [`DESIGN.md`](DESIGN.md) (design system).

## Run locally

```sh
./dev.sh            # Postgres + API (:8080) + website (:3000); Ctrl+C stops all
./dev.sh --seed     # same, after resetting the demo data
```

Or run each part yourself:

```sh
docker compose up -d                       # Postgres on localhost:5433
cd server && go run ./cmd/toki seed        # demo@toki.dev / password123
go run ./cmd/toki                          # API on :8080
cd ../web && pnpm install && pnpm dev      # website on :3000
cd ../extension && pnpm install && pnpm build
cd ../mobile && npm install && npm run emulator   # boots an emulator and opens the app
```

Load `extension/.output/chrome-mv3` in `chrome://extensions` with Developer mode on ("Load unpacked").

## Tests

Run every suite before you push:

```sh
./test.sh                  # server + web + extension
./test.sh server           # or pick suites: server, web, extension
```

| Suite | What it covers | Run it alone |
|---|---|---|
| `server` | Unit tests, plus store, price-check and HTTP API tests against a real Postgres | `cd server && go test ./...` (needs `TEST_DATABASE_URL`) |
| `web` | Typecheck, lint, Vitest tests for `src/lib` (formatting, API client, cache hooks, auth gate) | `cd web && pnpm test` |
| `extension` | Typecheck, Vitest tests for extraction, refresh, API client, tracking | `cd extension && pnpm test` |

The database tests use a separate `toki_test` database. `./test.sh` creates it in the
docker compose Postgres. Each test runs in its own throwaway schema, so tests never touch
your dev data. Without `TEST_DATABASE_URL`, `go test` skips the database tests (CI fails
instead). GitHub Actions runs all three suites on every push to `main` and every pull request
(`.github/workflows/test.yml`).
