package store

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type DigestUser struct {
	ID          uuid.UUID
	Email, Name string
}

// DigestUsers lists digest-mode users with alerts on who got no digest since `since`.
func (s *Store) DigestUsers(ctx context.Context, since time.Time) ([]DigestUser, error) {
	rows, err := s.Pool.Query(ctx, `SELECT u.id, u.email, u.name FROM users u JOIN profiles p ON p.user_id=u.id
		WHERE p.alert_mode='digest' AND p.email_alerts
		  AND NOT EXISTS (SELECT 1 FROM email_log e WHERE e.user_id=u.id AND e.kind IN ('digest','digest_empty') AND e.sent_at >= $1)`, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []DigestUser
	for rows.Next() {
		var u DigestUser
		if err := rows.Scan(&u.ID, &u.Email, &u.Name); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

type Drop struct {
	Product  Product
	OldMinor int64
}

// DigestDrops returns wanted items whose price is below the highest price seen since `since`.
func (s *Store) DigestDrops(ctx context.Context, userID uuid.UUID, since time.Time) ([]Drop, error) {
	rows, err := s.Pool.Query(ctx, `SELECT p.id, p.canonical_url, p.retailer, p.title, p.image_url, p.currency, p.current_price_minor,
		p.original_price_minor, p.in_stock, p.last_checked_at, p.last_check_status, h.hi
		FROM items i JOIN products p ON p.id=i.product_id
		JOIN LATERAL (SELECT max(price_minor) hi FROM price_points WHERE product_id=p.id AND checked_at >= $2) h ON true
		WHERE i.user_id=$1 AND i.status='wanted' AND h.hi > p.current_price_minor
		ORDER BY (h.hi - p.current_price_minor) DESC`, userID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Drop
	for rows.Next() {
		var d Drop
		p := &d.Product
		if err := rows.Scan(&p.ID, &p.URL, &p.Retailer, &p.Title, &p.ImageURL, &p.Currency, &p.CurrentPriceMinor,
			&p.OriginalPriceMinor, &p.InStock, &p.LastCheckedAt, &p.LastCheckStatus, &d.OldMinor); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}
