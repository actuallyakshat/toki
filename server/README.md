# Toki server

Go API for Toki. One binary: HTTP API under `/api`, migrations on startup, and
a background job for the weekly digest email. See `../CONTRACT.md` for the API.

## Run

```sh
docker compose up -d            # from the repo root: Postgres on localhost:5433
cd server
go run ./cmd/toki migrate       # apply migrations (serve and seed also do this)
go run ./cmd/toki seed          # demo user demo@toki.dev / password123, 10 products, 90 days of history
go run ./cmd/toki               # serve on :8080
go test ./...
```

Settings come from environment variables; defaults match `../.env.example`.
With `RESEND_API_KEY` empty, emails print to stdout instead of being sent.

## Price tracking

The server does not scrape on a schedule. The Chrome extension fetches pages in
the user's browser:

1. `GET /api/extension/refresh-tasks` returns due products the user tracks
   (`next_check_at <= now()`, oldest first) and leases them for 10 minutes.
2. `POST /api/extension/refresh-results` sends captures back. Valid results
   insert a price point, update the product and send alerts. Invalid results
   (price <= 0, other currency, empty title, or an error) mark the product
   failed and back off 30 min, 1 h, 2 h ... up to 24 h.
3. `POST /api/items/{id}/refresh` sets `next_check_at = now()`.

`POST /api/extract` and `POST /api/items` without a `capture` fetch the page once
on the server (private addresses are refused).

`WORKER_ENABLED=true` starts the digest job: Monday 09:00 Asia/Kolkata, one email
per digest-mode user.

## Layout

```
cmd/toki           main: serve | seed | migrate
internal/config    env settings
internal/httpapi   routes and middleware
internal/store     all SQL (pgx), seed data
internal/auth      passwords, session tokens
internal/extract   URL canonicalisation, page extraction, retailer adapters
internal/pricecheck validation, alert rules, digest job
internal/email     Resend client and HTML templates
migrations         goose SQL, embedded in the binary
```

## Tests

`go test ./...` needs no database. Extractor tests read fixtures in
`internal/extract/testdata`. The Amazon.in and Myntra fixtures were trimmed from
live pages; the Flipkart adapter test uses hand-made markup.

## Docker

```sh
docker build -t toki-server .
docker run --rm -p 8080:8080 -e DATABASE_URL=... toki-server
```
