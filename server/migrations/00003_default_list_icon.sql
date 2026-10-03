-- +goose Up
-- The list made at signup now uses the shopping-bag icon instead of the ✨ emoji.
-- Only default lists nobody has renamed or re-iconed are converted.
UPDATE lists SET emoji = 'i:shopping-bag' WHERE name = 'Wishlist' AND emoji = '✨';

-- +goose Down
UPDATE lists SET emoji = '✨' WHERE name = 'Wishlist' AND emoji = 'i:shopping-bag';
