package store

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const itemSelect = `SELECT i.id, i.list_id, i.added_price_minor, i.target_price_minor, i.alert_rule, i.note, i.position, i.status,
	i.cooling_until, i.created_at, i.bought_at,
	p.id, p.canonical_url, p.retailer, p.title, p.image_url, p.currency, p.current_price_minor, p.original_price_minor,
	p.in_stock, p.last_checked_at, p.last_check_status,
	COALESCE(s.lo, p.current_price_minor), COALESCE(s.hi, p.current_price_minor)
FROM items i JOIN products p ON p.id = i.product_id
LEFT JOIN LATERAL (SELECT min(price_minor) lo, max(price_minor) hi FROM price_points WHERE product_id = p.id) s ON true `

func scanItem(r pgx.Row) (Item, error) {
	var it Item
	var rule []byte
	p := &it.Product
	err := r.Scan(&it.ID, &it.ListID, &it.AddedPriceMinor, &it.TargetPriceMinor, &rule, &it.Note, &it.Position, &it.Status,
		&it.CoolingUntil, &it.CreatedAt, &it.BoughtAt,
		&p.ID, &p.URL, &p.Retailer, &p.Title, &p.ImageURL, &p.Currency, &p.CurrentPriceMinor, &p.OriginalPriceMinor,
		&p.InStock, &p.LastCheckedAt, &p.LastCheckStatus, &it.Stats.LowestMinor, &it.Stats.HighestMinor)
	it.AlertRule = rule
	it.Stats.ChangeSinceAddedMinor = p.CurrentPriceMinor - it.AddedPriceMinor
	return it, notFound(err)
}

func (s *Store) queryItems(ctx context.Context, sql string, args ...any) ([]Item, error) {
	rows, err := s.Pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Item{}
	for rows.Next() {
		it, err := scanItem(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, it)
	}
	return out, rows.Err()
}

// ItemsByList returns items of one of the user's lists. status "all" returns every status.
func (s *Store) ItemsByList(ctx context.Context, userID, listID uuid.UUID, status string) ([]Item, error) {
	return s.queryItems(ctx, itemSelect+`WHERE i.list_id=$1 AND i.user_id=$2 AND ($3='all' OR i.status=$3)
		ORDER BY i.position, i.created_at, i.id`, listID, userID, status)
}

// PublicItems returns the wanted items of a list, for the public share page.
func (s *Store) PublicItems(ctx context.Context, listID uuid.UUID) ([]Item, error) {
	return s.queryItems(ctx, itemSelect+`WHERE i.list_id=$1 AND i.status='wanted' ORDER BY i.position, i.created_at, i.id`, listID)
}

func (s *Store) Item(ctx context.Context, userID, id uuid.UUID) (Item, error) {
	return scanItem(s.Pool.QueryRow(ctx, itemSelect+`WHERE i.id=$1 AND i.user_id=$2`, id, userID))
}

// ItemByProduct finds the user's item for a product in a list.
func (s *Store) ItemByProduct(ctx context.Context, listID, productID uuid.UUID) (Item, error) {
	return scanItem(s.Pool.QueryRow(ctx, itemSelect+`WHERE i.list_id=$1 AND i.product_id=$2`, listID, productID))
}

type NewItem struct {
	UserID, ListID, ProductID uuid.UUID
	AddedPriceMinor           int64
	TargetPriceMinor          *int64
	AlertRule                 json.RawMessage
}

func (s *Store) AddItem(ctx context.Context, n NewItem) (Item, error) {
	id := newID()
	_, err := s.Pool.Exec(ctx, `INSERT INTO items (id, user_id, list_id, product_id, added_price_minor, target_price_minor, alert_rule, position)
		VALUES ($1,$2,$3,$4,$5,$6,$7, (SELECT COALESCE(max(position)+1, 0) FROM items WHERE list_id=$3))`,
		id, n.UserID, n.ListID, n.ProductID, n.AddedPriceMinor, n.TargetPriceMinor, []byte(n.AlertRule))
	if isUnique(err) {
		return Item{}, ErrConflict
	}
	if err != nil {
		return Item{}, err
	}
	return s.Item(ctx, n.UserID, id)
}

// UpdateItem applies the given columns. Allowed keys: target_price_minor,
// alert_rule, note, status, cooling_until, list_id. Changing the target or the
// rule clears last_alerted_price_minor so the new rule can fire. Changing the
// status sets or clears bought_at.
func (s *Store) UpdateItem(ctx context.Context, userID, id uuid.UUID, fields map[string]any) (Item, error) {
	allowed := map[string]bool{"target_price_minor": true, "alert_rule": true, "note": true, "status": true, "cooling_until": true, "list_id": true}
	sets := []string{}
	resetAlert := false
	args := []any{id, userID}
	for k, v := range fields {
		if !allowed[k] {
			return Item{}, fmt.Errorf("unknown item field %q", k)
		}
		args = append(args, v)
		sets = append(sets, fmt.Sprintf("%s=$%d", k, len(args)))
		if k == "list_id" {
			sets = append(sets, fmt.Sprintf("position=(SELECT COALESCE(max(position)+1, 0) FROM items WHERE list_id=$%d)", len(args)))
		}
		if k == "status" {
			// Keep the first purchase date if it is marked bought again; clear it once it leaves "bought".
			sets = append(sets, fmt.Sprintf("bought_at=CASE WHEN $%d::text='bought' THEN COALESCE(bought_at, now()) ELSE NULL END", len(args)))
		}
		resetAlert = resetAlert || k == "target_price_minor" || k == "alert_rule"
	}
	if resetAlert {
		sets = append(sets, "last_alerted_price_minor=NULL")
	}
	if len(sets) > 0 {
		tag, err := s.Pool.Exec(ctx, `UPDATE items SET `+strings.Join(sets, ", ")+` WHERE id=$1 AND user_id=$2`, args...)
		if isUnique(err) {
			return Item{}, ErrConflict
		}
		if err != nil {
			return Item{}, err
		}
		if tag.RowsAffected() == 0 {
			return Item{}, ErrNotFound
		}
	}
	return s.Item(ctx, userID, id)
}

func (s *Store) DeleteItem(ctx context.Context, userID, id uuid.UUID) error {
	tag, err := s.Pool.Exec(ctx, `DELETE FROM items WHERE id=$1 AND user_id=$2`, id, userID)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}

func (s *Store) Reorder(ctx context.Context, userID, listID uuid.UUID, ids []uuid.UUID) error {
	_, err := s.Pool.Exec(ctx, `UPDATE items i SET position = (t.ord - 1)::int FROM unnest($3::uuid[]) WITH ORDINALITY AS t(id, ord)
		WHERE i.id = t.id AND i.list_id=$1 AND i.user_id=$2`, listID, userID, ids)
	return err
}

func (s *Store) History(ctx context.Context, userID, itemID uuid.UUID, days int) ([]PricePoint, error) {
	rows, err := s.Pool.Query(ctx, `SELECT pp.price_minor, pp.currency, pp.in_stock, pp.checked_at, pp.source
		FROM items i JOIN price_points pp ON pp.product_id = i.product_id
		WHERE i.id=$1 AND i.user_id=$2 AND pp.checked_at >= now() - make_interval(days => $3)
		ORDER BY pp.checked_at, pp.id`, itemID, userID, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []PricePoint{}
	for rows.Next() {
		var p PricePoint
		if err := rows.Scan(&p.PriceMinor, &p.Currency, &p.InStock, &p.CheckedAt, &p.Source); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

type Stats struct {
	Currency          string `json:"currency"`
	ItemCount         int    `json:"item_count"`
	TotalMinor        int64  `json:"total_minor"`
	SavedByDropsMinor int64  `json:"saved_by_drops_minor"`
	RemovedValueMinor int64  `json:"removed_value_minor"`
}

// Stats totals the user's wanted items. Savings count wanted and bought items
// whose price is now below the price when they were added.
func (s *Store) Stats(ctx context.Context, userID uuid.UUID) (Stats, error) {
	var st Stats
	err := s.Pool.QueryRow(ctx, `SELECT pr.currency,
		count(*) FILTER (WHERE i.status='wanted'),
		COALESCE(sum(p.current_price_minor) FILTER (WHERE i.status='wanted'), 0),
		COALESCE(sum(i.added_price_minor - p.current_price_minor) FILTER (WHERE i.status IN ('wanted','bought') AND i.added_price_minor > p.current_price_minor), 0),
		COALESCE(sum(i.added_price_minor) FILTER (WHERE i.status='removed'), 0)
		FROM profiles pr LEFT JOIN items i ON i.user_id=pr.user_id LEFT JOIN products p ON p.id=i.product_id
		WHERE pr.user_id=$1 GROUP BY pr.currency`, userID).
		Scan(&st.Currency, &st.ItemCount, &st.TotalMinor, &st.SavedByDropsMinor, &st.RemovedValueMinor)
	return st, notFound(err)
}
