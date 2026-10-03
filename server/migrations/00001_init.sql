-- +goose Up
CREATE TABLE users (
    id            uuid PRIMARY KEY,
    email         text NOT NULL UNIQUE,
    name          text NOT NULL,
    password_hash text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
    token_hash bytea PRIMARY KEY,
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE profiles (
    user_id              uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    currency             text NOT NULL DEFAULT 'INR',
    monthly_income_minor bigint,
    hours_per_week       integer,
    income_storage       text NOT NULL DEFAULT 'server' CHECK (income_storage IN ('server', 'device')),
    alert_mode           text NOT NULL DEFAULT 'instant' CHECK (alert_mode IN ('instant', 'digest')),
    email_alerts         boolean NOT NULL DEFAULT true
);

CREATE TABLE lists (
    id         uuid PRIMARY KEY,
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       text NOT NULL,
    emoji      text NOT NULL DEFAULT '',
    visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'link')),
    share_slug text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lists_user_idx ON lists (user_id);

CREATE TABLE products (
    id                    uuid PRIMARY KEY,
    canonical_url         text NOT NULL UNIQUE,
    retailer              text NOT NULL,
    title                 text NOT NULL,
    image_url             text NOT NULL DEFAULT '',
    currency              text NOT NULL DEFAULT 'INR',
    current_price_minor   bigint NOT NULL,
    original_price_minor  bigint,
    in_stock              boolean NOT NULL DEFAULT true,
    last_checked_at       timestamptz,
    last_check_status     text NOT NULL DEFAULT 'pending' CHECK (last_check_status IN ('ok', 'failed', 'pending')),
    fail_count            integer NOT NULL DEFAULT 0,
    next_check_at         timestamptz NOT NULL DEFAULT now(),
    leased_until          timestamptz,
    created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_due_idx ON products (next_check_at);

CREATE TABLE items (
    id                       uuid PRIMARY KEY,
    user_id                  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    list_id                  uuid NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    product_id               uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    added_price_minor        bigint NOT NULL,
    target_price_minor       bigint,
    alert_rule               jsonb NOT NULL DEFAULT '{"type":"any_drop"}',
    note                     text NOT NULL DEFAULT '',
    position                 integer NOT NULL DEFAULT 0,
    status                   text NOT NULL DEFAULT 'wanted' CHECK (status IN ('wanted', 'bought', 'removed')),
    cooling_until            timestamptz,
    last_alerted_price_minor bigint,
    created_at               timestamptz NOT NULL DEFAULT now(),
    UNIQUE (list_id, product_id)
);
CREATE INDEX items_user_idx ON items (user_id, status);
CREATE INDEX items_product_idx ON items (product_id);

CREATE TABLE price_points (
    id          bigserial PRIMARY KEY,
    product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price_minor bigint NOT NULL,
    currency    text NOT NULL,
    in_stock    boolean NOT NULL,
    source      text NOT NULL CHECK (source IN ('api', 'fetch', 'extension')),
    checked_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX price_points_product_idx ON price_points (product_id, checked_at);

-- Sent emails: dedupe record and digest bookkeeping.
CREATE TABLE email_log (
    id          bigserial PRIMARY KEY,
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id     uuid REFERENCES items(id) ON DELETE SET NULL,
    kind        text NOT NULL CHECK (kind IN ('drop', 'back_in_stock', 'digest', 'digest_empty')),
    price_minor bigint,
    sent_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_log_user_idx ON email_log (user_id, kind, sent_at);

-- +goose Down
DROP TABLE email_log, price_points, items, products, lists, profiles, sessions, users;
