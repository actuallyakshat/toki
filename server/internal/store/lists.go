package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const listSelect = `SELECT l.id, l.name, l.emoji, l.visibility, l.share_slug, l.created_at, pr.currency,
	COALESCE(c.n, 0), COALESCE(c.total, 0)
FROM lists l JOIN profiles pr ON pr.user_id = l.user_id
LEFT JOIN LATERAL (SELECT count(*) n, sum(p.current_price_minor) total FROM items i JOIN products p ON p.id=i.product_id
	WHERE i.list_id=l.id AND i.status='wanted') c ON true `

func scanList(r pgx.Row) (List, error) {
	var l List
	err := r.Scan(&l.ID, &l.Name, &l.Emoji, &l.Visibility, &l.ShareSlug, &l.CreatedAt, &l.Currency, &l.ItemCount, &l.TotalMinor)
	return l, notFound(err)
}

func (s *Store) Lists(ctx context.Context, userID uuid.UUID) ([]List, error) {
	rows, err := s.Pool.Query(ctx, listSelect+`WHERE l.user_id=$1 ORDER BY l.created_at, l.id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []List{}
	for rows.Next() {
		l, err := scanList(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func (s *Store) List(ctx context.Context, userID, id uuid.UUID) (List, error) {
	return scanList(s.Pool.QueryRow(ctx, listSelect+`WHERE l.id=$1 AND l.user_id=$2`, id, userID))
}

func (s *Store) DefaultListID(ctx context.Context, userID uuid.UUID) (uuid.UUID, error) {
	var id uuid.UUID
	err := s.Pool.QueryRow(ctx, `SELECT id FROM lists WHERE user_id=$1 ORDER BY created_at, id LIMIT 1`, userID).Scan(&id)
	return id, notFound(err)
}

func (s *Store) CreateList(ctx context.Context, userID uuid.UUID, name, emoji string) (List, error) {
	id := newID()
	if _, err := s.Pool.Exec(ctx, `INSERT INTO lists (id, user_id, name, emoji, share_slug) VALUES ($1,$2,$3,$4,$5)`,
		id, userID, name, emoji, newSlug()); err != nil {
		return List{}, err
	}
	return s.List(ctx, userID, id)
}

// UpdateList sets only the non-nil fields.
func (s *Store) UpdateList(ctx context.Context, userID, id uuid.UUID, name, emoji, visibility *string) (List, error) {
	tag, err := s.Pool.Exec(ctx, `UPDATE lists SET name=COALESCE($3,name), emoji=COALESCE($4,emoji), visibility=COALESCE($5,visibility)
		WHERE id=$1 AND user_id=$2`, id, userID, name, emoji, visibility)
	if err != nil {
		return List{}, err
	}
	if tag.RowsAffected() == 0 {
		return List{}, ErrNotFound
	}
	return s.List(ctx, userID, id)
}

func (s *Store) DeleteList(ctx context.Context, userID, id uuid.UUID) error {
	return s.tx(ctx, func(tx pgx.Tx) error {
		var n int
		if err := tx.QueryRow(ctx, `SELECT count(*) FROM lists WHERE user_id=$1`, userID).Scan(&n); err != nil {
			return err
		}
		tag, err := tx.Exec(ctx, `DELETE FROM lists WHERE id=$1 AND user_id=$2 AND $3 > 1`, id, userID, n)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			if n <= 1 {
				var exists bool
				_ = tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM lists WHERE id=$1 AND user_id=$2)`, id, userID).Scan(&exists)
				if exists {
					return ErrLastList
				}
			}
			return ErrNotFound
		}
		return nil
	})
}

// PublicList returns a link-visible list and its owner's name.
func (s *Store) PublicList(ctx context.Context, slug string) (List, string, error) {
	l, err := scanList(s.Pool.QueryRow(ctx, listSelect+`WHERE l.share_slug=$1 AND l.visibility='link'`, slug))
	if err != nil {
		return l, "", err
	}
	var owner string
	err = s.Pool.QueryRow(ctx, `SELECT u.name FROM lists l JOIN users u ON u.id=l.user_id WHERE l.id=$1`, l.ID).Scan(&owner)
	return l, owner, err
}
