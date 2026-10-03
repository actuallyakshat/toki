package store

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const productSelect = `SELECT id, canonical_url, retailer, title, image_url, currency, current_price_minor, original_price_minor,
	in_stock, last_checked_at, last_check_status FROM products `

func scanProduct(r pgx.Row) (Product, error) {
	var p Product
	err := r.Scan(&p.ID, &p.URL, &p.Retailer, &p.Title, &p.ImageURL, &p.Currency, &p.CurrentPriceMinor, &p.OriginalPriceMinor,
		&p.InStock, &p.LastCheckedAt, &p.LastCheckStatus)
	return p, notFound(err)
}

func (s *Store) ProductByURL(ctx context.Context, canonical string) (Product, error) {
	return scanProduct(s.Pool.QueryRow(ctx, productSelect+`WHERE canonical_url=$1`, canonical))
}

type NewProduct struct {
	URL, Retailer, Title, ImageURL, Currency string
	PriceMinor                               int64
	OriginalMinor                            *int64
	InStock                                  bool
	NextCheckAt                              time.Time
	Source                                   string // price point source: api | fetch | extension
}

// CreateProduct inserts a product with its first price point. When another
// request created the same canonical URL first, that product is returned.
func (s *Store) CreateProduct(ctx context.Context, n NewProduct) (Product, error) {
	id := newID()
	err := s.tx(ctx, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `INSERT INTO products (id, canonical_url, retailer, title, image_url, currency, current_price_minor,
			original_price_minor, in_stock, last_checked_at, last_check_status, next_check_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now(), 'ok', $10) ON CONFLICT (canonical_url) DO NOTHING`,
			id, n.URL, n.Retailer, n.Title, n.ImageURL, n.Currency, n.PriceMinor, n.OriginalMinor, n.InStock, n.NextCheckAt)
		if err != nil || tag.RowsAffected() == 0 {
			return err
		}
		_, err = tx.Exec(ctx, `INSERT INTO price_points (product_id, price_minor, currency, in_stock, source) VALUES ($1,$2,$3,$4,$5)`,
			id, n.PriceMinor, n.Currency, n.InStock, n.Source)
		return err
	})
	if err != nil {
		return Product{}, err
	}
	return s.ProductByURL(ctx, n.URL)
}

// UserTracksProduct reports whether the user has a wanted item for the product.
func (s *Store) UserTracksProduct(ctx context.Context, userID, productID uuid.UUID) (bool, error) {
	var ok bool
	err := s.Pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM items WHERE user_id=$1 AND product_id=$2 AND status='wanted')`,
		userID, productID).Scan(&ok)
	return ok, err
}

type Task struct {
	ProductID uuid.UUID `json:"product_id"`
	URL       string    `json:"url"`
	Retailer  string    `json:"retailer"`
	dueAt     time.Time
}

// LeaseTasks claims up to limit due products the user tracks, oldest first,
// and leases them for 10 minutes so a second extension skips them.
func (s *Store) LeaseTasks(ctx context.Context, userID uuid.UUID, limit int) ([]Task, error) {
	rows, err := s.Pool.Query(ctx, `
		WITH due AS (
			SELECT p.id FROM products p
			WHERE p.next_check_at <= now() AND (p.leased_until IS NULL OR p.leased_until <= now())
			  AND EXISTS (SELECT 1 FROM items i WHERE i.product_id=p.id AND i.user_id=$1 AND i.status='wanted')
			ORDER BY p.next_check_at LIMIT $2
			FOR UPDATE OF p SKIP LOCKED)
		UPDATE products SET leased_until = now() + interval '10 minutes'
		FROM due WHERE products.id = due.id
		RETURNING products.id, products.canonical_url, products.retailer, products.next_check_at`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	tasks := []Task{}
	for rows.Next() {
		var t Task
		if err := rows.Scan(&t.ProductID, &t.URL, &t.Retailer, &t.dueAt); err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	// RETURNING order is not guaranteed.
	for i := 1; i < len(tasks); i++ {
		for j := i; j > 0 && tasks[j].dueAt.Before(tasks[j-1].dueAt); j-- {
			tasks[j], tasks[j-1] = tasks[j-1], tasks[j]
		}
	}
	return tasks, rows.Err()
}

// RequestRefresh makes the product due now and clears its lease.
func (s *Store) RequestRefresh(ctx context.Context, userID, itemID uuid.UUID) error {
	tag, err := s.Pool.Exec(ctx, `UPDATE products SET next_check_at=now(), leased_until=NULL
		WHERE id = (SELECT product_id FROM items WHERE id=$1 AND user_id=$2)`, itemID, userID)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}

// Check is a validated price-check result.
type Check struct {
	Title, ImageURL, Currency string
	PriceMinor                int64
	OriginalMinor             *int64
	InStock                   bool
}

// Candidate is a wanted item that may receive an alert for a check.
type Candidate struct {
	ItemID, UserID   uuid.UUID
	Email, Name      string
	AddedMinor       int64
	TargetMinor      *int64
	LastAlertedMinor *int64
	Rule             AlertRule
	AlertMode        string
}

// Alert is an email to send after a check was committed.
type Alert struct {
	Candidate
	Kind     string // drop | back_in_stock
	Product  Product
	OldMinor int64
}

// Decider returns "drop", "back_in_stock" or "" for a candidate.
type Decider func(c Candidate, prevPrice int64, prevInStock bool, chk Check) string

// RecordCheck stores a valid check in one transaction: product update, price
// point, and last_alerted bookkeeping for instant users. It returns the
// alerts to send. Digest users get no alert here; the digest job reads history.
func (s *Store) RecordCheck(ctx context.Context, productID uuid.UUID, chk Check, source string, next time.Time, decide Decider) ([]Alert, error) {
	var alerts []Alert
	err := s.tx(ctx, func(tx pgx.Tx) error {
		var prev Product
		if err := tx.QueryRow(ctx, `SELECT current_price_minor, in_stock FROM products WHERE id=$1 FOR UPDATE`, productID).
			Scan(&prev.CurrentPriceMinor, &prev.InStock); err != nil {
			return notFound(err)
		}
		if _, err := tx.Exec(ctx, `UPDATE products SET title=$2, image_url=COALESCE(NULLIF($3,''), image_url), current_price_minor=$4,
			original_price_minor=$5, in_stock=$6, last_checked_at=now(), last_check_status='ok', fail_count=0,
			next_check_at=$7, leased_until=NULL WHERE id=$1`,
			productID, chk.Title, chk.ImageURL, chk.PriceMinor, chk.OriginalMinor, chk.InStock, next); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO price_points (product_id, price_minor, currency, in_stock, source) VALUES ($1,$2,$3,$4,$5)`,
			productID, chk.PriceMinor, chk.Currency, chk.InStock, source); err != nil {
			return err
		}
		rows, err := tx.Query(ctx, `SELECT i.id, i.user_id, u.email, u.name, i.added_price_minor, i.target_price_minor,
			i.last_alerted_price_minor, i.alert_rule, pr.alert_mode
			FROM items i JOIN users u ON u.id=i.user_id JOIN profiles pr ON pr.user_id=i.user_id
			WHERE i.product_id=$1 AND i.status='wanted' AND pr.email_alerts
			  AND (i.cooling_until IS NULL OR i.cooling_until <= now())
			ORDER BY i.id FOR UPDATE OF i`, productID)
		if err != nil {
			return err
		}
		var cands []Candidate
		for rows.Next() {
			var c Candidate
			var rule []byte
			if err := rows.Scan(&c.ItemID, &c.UserID, &c.Email, &c.Name, &c.AddedMinor, &c.TargetMinor, &c.LastAlertedMinor, &rule, &c.AlertMode); err != nil {
				rows.Close()
				return err
			}
			c.Rule = parseRule(rule)
			cands = append(cands, c)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return err
		}
		var product Product
		for _, c := range cands {
			kind := decide(c, prev.CurrentPriceMinor, prev.InStock, chk)
			if kind == "" || c.AlertMode != "instant" {
				continue
			}
			if kind == "drop" {
				if _, err := tx.Exec(ctx, `UPDATE items SET last_alerted_price_minor=$2 WHERE id=$1`, c.ItemID, chk.PriceMinor); err != nil {
					return err
				}
			}
			if product.ID == uuid.Nil {
				product, err = scanProduct(tx.QueryRow(ctx, productSelect+`WHERE id=$1`, productID))
				if err != nil {
					return err
				}
			}
			alerts = append(alerts, Alert{Candidate: c, Kind: kind, Product: product, OldMinor: prev.CurrentPriceMinor})
		}
		return nil
	})
	return alerts, err
}

// RecordFailure marks a failed check and backs off exponentially: 30 min,
// 1 h, 2 h, ... capped at 24 h.
func (s *Store) RecordFailure(ctx context.Context, productID uuid.UUID) error {
	_, err := s.Pool.Exec(ctx, `UPDATE products SET last_check_status='failed', last_checked_at=now(),
		next_check_at = now() + LEAST(interval '24 hours', interval '30 minutes' * power(2, LEAST(fail_count, 10))),
		fail_count = fail_count + 1, leased_until=NULL WHERE id=$1`, productID)
	return err
}

func (s *Store) ProductCurrency(ctx context.Context, productID uuid.UUID) (string, error) {
	var c string
	err := s.Pool.QueryRow(ctx, `SELECT currency FROM products WHERE id=$1`, productID).Scan(&c)
	return c, notFound(err)
}

func (s *Store) LogEmail(ctx context.Context, userID uuid.UUID, itemID *uuid.UUID, kind string, price *int64) error {
	_, err := s.Pool.Exec(ctx, `INSERT INTO email_log (user_id, item_id, kind, price_minor) VALUES ($1,$2,$3,$4)`, userID, itemID, kind, price)
	return err
}
