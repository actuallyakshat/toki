-- +goose Up
-- When the item was marked bought. Cleared when it goes back to the wishlist.
-- Items bought before this column existed keep NULL: their purchase date is unknown.
ALTER TABLE items ADD COLUMN bought_at timestamptz;

-- +goose Down
ALTER TABLE items DROP COLUMN bought_at;
