# Toki — shared engineering contract

Toki (時, "time") is an open-source wishlist with live price tracking, price-drop
emails, a Chrome extension for one-click capture, and a toggle that shows every
price as hours of work.

This file is the single source of truth for all three apps. Do not change a
shape here without updating every app that uses it.

## Repository layout

```
toki/
  CONTRACT.md            this file
  DESIGN.md              visual design system (tokens, type, motion)
  design/tokens.css      shared CSS variables (copy into web/ and extension/)
  docker-compose.yml     Postgres for development (host port 5433)
  .env.example
  server/                Go API + price-check worker (one binary)
  web/                   Next.js App Router website
  extension/             WXT (Manifest V3) Chrome extension
```

Each app is independent: its own `go.mod` / `package.json` / lockfile. There is
no root workspace yet. Use `pnpm` for JS apps.

## Ports and environment

| Service  | Port | Notes |
|----------|------|-------|
| Postgres | 5433 (host) → 5432 | `docker compose up -d` |
| Go API   | 8080 | `cd server && go run ./cmd/toki` |
| Web      | 3000 | Next rewrites `/api/*` → `http://localhost:8080/api/*` |

Server env (see `.env.example`):

| Var | Default | Meaning |
|-----|---------|---------|
| `DATABASE_URL` | `postgres://toki:toki@localhost:5433/toki?sslmode=disable` | |
| `PORT` | `8080` | |
| `APP_URL` | `http://localhost:3000` | used in email links |
| `SESSION_SECURE` | `false` | `true` in production (Secure cookie) |
| `RESEND_API_KEY` | empty | empty → emails are logged to stdout |
| `EMAIL_FROM` | `Toki <alerts@localhost>` | |
| `WORKER_ENABLED` | `true` | run the price-check loop in-process |
| `CHECK_INTERVAL` | `6h` | target interval between checks of one product |
| `EXTENSION_ORIGINS` | empty | comma list of `chrome-extension://<id>` allowed by CORS (extension pages with host_permissions do not need it) |

## Conventions

- **Money** is always an integer in minor units (paise for INR) plus an ISO-4217
  currency code. Field names end in `_minor`. Never use floats for money.
- Default currency: `INR`. Format with `Intl.NumberFormat('en-IN', {style:'currency', currency})`.
- IDs are UUIDv7 strings. Timestamps are RFC 3339 UTC strings.
- JSON keys are `snake_case`.
- Every error response: HTTP status + body `{"error": {"code": "snake_code", "message": "Human sentence."}}`.
  Codes used: `unauthorized`, `forbidden`, `not_found`, `validation_failed`,
  `email_taken`, `invalid_credentials`, `extract_failed`, `unsupported_url`, `internal`.

## Authentication

Email + password (bcrypt). Sessions are rows in Postgres (`sessions` table,
random 32-byte token, stored as SHA-256 hash). Two ways to send a session:

1. **Web**: cookie `toki_session` — HttpOnly, SameSite=Lax, Path=/, 30 days,
   Secure when `SESSION_SECURE=true`. The browser sees it as same-origin
   because Next rewrites `/api/*` to Go. No CORS needed for web.
2. **Extension**: `Authorization: Bearer <token>` from `POST /api/auth/token`.
   The extension stores the token in `chrome.storage.local`. The extension's
   manifest has `host_permissions` for the API origin, so extension pages and
   the service worker can call the API without CORS.

Middleware accepts either. A signup creates a default list named "Wishlist".

## Objects

```jsonc
// User
{ "id": "…", "email": "a@b.in", "name": "Akshat", "created_at": "…" }

// Profile (time-conversion + preferences)
{
  "currency": "INR",
  "monthly_income_minor": 15000000,      // in-hand monthly salary, null if unset or device-only
  "hours_per_week": 45,                   // null if unset
  "income_storage": "server",             // "server" | "device"  (device → web keeps salary in localStorage only, server stores null)
  "alert_mode": "instant",                // "instant" | "digest"
  "email_alerts": true
}

// Product (canonical, shared across users; deduplicated by canonical_url)
{
  "id": "…",
  "url": "https://www.amazon.in/dp/B0CHX1W1XY",
  "retailer": "amazon_in",                // amazon_in | flipkart | myntra | shopify | generic
  "title": "…",
  "image_url": "https://…",
  "currency": "INR",
  "current_price_minor": 12999900,
  "original_price_minor": 14999900,       // MRP / strike-through, nullable
  "in_stock": true,
  "last_checked_at": "…",
  "last_check_status": "ok"               // ok | failed | pending
}

// Item (a user's saved product)
{
  "id": "…",
  "list_id": "…",
  "product": Product,
  "added_price_minor": 13499900,
  "target_price_minor": 11999900,         // nullable
  "alert_rule": { "type": "any_drop" },   // any_drop | below_target | percent_drop (+ "percent": 10)
  "note": "",
  "position": 3,                          // ordering inside the list, lower = higher priority
  "status": "wanted",                     // wanted | bought | removed
  "cooling_until": null,                  // nullable timestamp: "wait 30 days" feature
  "created_at": "…",
  "stats": {
    "lowest_minor": 12499900,
    "highest_minor": 14999900,
    "change_since_added_minor": -500000   // negative = cheaper now
  }
}

// List
{ "id": "…", "name": "Wishlist", "emoji": "i:shopping-bag", "visibility": "private",  // private | link
  "share_slug": "k3j9x2",  "item_count": 8, "total_minor": 34500000, "currency": "INR", "created_at": "…" }

// Capture (what the extension or the server extractor produces from a product page)
{
  "source_url": "https://…",
  "title": "…",
  "image_url": "https://…",
  "price_minor": 12999900,
  "currency": "INR",
  "original_price_minor": null,
  "in_stock": true,
  "retailer": "amazon_in"
}

// PricePoint
{ "price_minor": 12999900, "currency": "INR", "in_stock": true, "checked_at": "…", "source": "fetch" } // api | fetch | extension
```

## Endpoints

All under `/api`. 🔒 = requires session.

### Auth
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/auth/signup` | `{email, password, name}` | 201 `{user}` + cookie |
| POST | `/auth/login` | `{email, password}` | 200 `{user}` + cookie |
| POST | `/auth/logout` 🔒 | — | 204, clears cookie, deletes session |
| POST | `/auth/token` | `{email, password}` | 200 `{token, user}` (bearer for extension) |
| GET | `/me` 🔒 | — | `{user, profile}` |
| PATCH | `/me/profile` 🔒 | partial Profile | `{profile}` |

### Lists
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/lists` 🔒 | — | `{lists: [List]}` |
| POST | `/lists` 🔒 | `{name, emoji?}` | 201 List |
| PATCH | `/lists/{id}` 🔒 | `{name?, emoji?, visibility?}` | List |
| DELETE | `/lists/{id}` 🔒 | — | 204 (cannot delete the last list → 422 validation_failed) |
| GET | `/lists/{id}/items` 🔒 | query `status=wanted` (default) \| `bought` \| `removed` \| `all` | `{items: [Item]}` ordered by position |
| POST | `/lists/{id}/reorder` 🔒 | `{item_ids: [...]}` | 204 |

### Items
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/items` 🔒 | `{url, list_id?, capture?: Capture, target_price_minor?}` | 201 Item. With `capture` → used as first price point (source `extension`). Without → server extracts. Fails → 422 `extract_failed`. Same product already in that list → 200 existing Item. |
| GET | `/items/lookup` 🔒 | query `url` (any URL form of the product) | `{items: [Item]}` — the user's `wanted` items for that product across all lists, oldest first. Not a product URL or an unknown product → `{items: []}`. Used by the extension to offer Remove instead of Add. |
| PATCH | `/items/{id}` 🔒 | `{target_price_minor?, alert_rule?, note?, status?, cooling_until?, list_id?}` | Item |
| DELETE | `/items/{id}` 🔒 | — | 204 |
| GET | `/items/{id}/history` 🔒 | query `days=90` | `{points: [PricePoint]}` ascending |
| POST | `/items/{id}/refresh` 🔒 | — | Item after an immediate check (rate limit: once per 60 s per product) |
| POST | `/extract` 🔒 | `{url}` | `{capture}` or 422 `extract_failed` (used by web "paste a link" preview) |

### Extension fetcher (the only price tracker for now)
Large Indian retailers block datacenter IPs. **For now the server does not fetch
product pages on a schedule.** All periodic price checks come from users'
extensions, which fetch pages from the user's browser. Products are shared
(deduplicated by canonical URL), so one extension's result updates the price
for every user who tracks that product, and alerts go to all of them.
`POST /items` without a capture and `POST /extract` still fetch once on the
server (one-off, user-triggered). `POST /items/{id}/refresh` does not fetch on
the server; it sets `next_check_at = now()` so the next extension poll picks it up.

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/extension/refresh-tasks` 🔒 | query `limit=5` | `{tasks: [{product_id, url, retailer}]}` — products **this user tracks** (any retailer) with `next_check_at <= now()`, oldest first. The server leases each returned task for 10 min (sets `leased_until`) so two extensions do not fetch the same product at once. |
| POST | `/extension/refresh-results` 🔒 | `{results: [{product_id, capture?: Capture, error?: string}]}` | `{accepted: n}` — captures go through the same validation + alert path as server checks |

### Public / stats
| Method | Path | Response |
|---|---|---|
| GET | `/public/lists/{share_slug}` | `{list: {name, emoji, owner_name}, items: [Item without note/alert_rule/target]}` — 404 unless visibility = link |
| GET | `/stats` 🔒 | `{currency, item_count, total_minor, saved_by_drops_minor, removed_value_minor}` |
| GET | `/healthz` | `{ok: true}` |

## Price-check rules (server + extension results)

1. A check result is **valid** only if `price_minor > 0`, currency equals the
   product currency, and title is non-empty. Invalid result → mark
   `last_check_status = 'failed'`, increment `fail_count`, keep last good price,
   **do not** insert a price point, **do not** alert.
2. Captcha / robot pages (HTTP 503/429, or body contains "captcha",
   "Robot Check", "Enter the characters you see") count as failed.
3. A valid result inserts a `price_points` row and updates the product.
4. Alerts: for each `wanted` item of the product whose user has `email_alerts`:
   - `any_drop`: new price < previous price
   - `below_target`: new price ≤ target
   - `percent_drop`: new price ≤ added_price × (1 − percent/100)
   and new price < `items.last_alerted_price_minor` (or that is null). Then set
   `last_alerted_price_minor` = new price. One email per drop, never repeated.
   `back_in_stock` alert when `in_stock` goes false → true.
5. `instant` users get the email immediately. `digest` users get one email
   per week (Monday 09:00 IST) summarising drops.
6. Scheduling (no server fetching): `refresh-tasks` selects due products with
   `FOR UPDATE SKIP LOCKED` and leases them. On a result:
   `next_check_at = now() + CHECK_INTERVAL ± 20% jitter`; on failure use
   exponential backoff capped at 24 h. Keep the server-side fetch/extract code
   (used by `/extract` and `POST /items`); only the background loop is disabled.
   The in-process worker still runs the weekly digest email job.

## Time conversion (web + extension display)

India users know their monthly in-hand salary, not tax slabs.

```
hourly_minor = monthly_income_minor / (hours_per_week × 52 / 12)
hours        = price_minor / hourly_minor
```

A workday is `hours_per_week / 5` hours. Display: `< 1 h` → minutes ("40 min");
under one workday → "6 h 30 min"; otherwise working days ("1 workday", "4.3 workdays").
When `income_storage = device`, the web stores income only in
`localStorage["toki.income"]` and computes in the browser.
