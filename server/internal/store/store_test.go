package store_test

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/actuallyakshat/toki/server/internal/auth"
	"github.com/actuallyakshat/toki/server/internal/store"
	"github.com/actuallyakshat/toki/server/internal/testdb"
)

var ctx = context.Background()

func i64(n int64) *int64 { return &n }

func newUser(t *testing.T, st *store.Store, email string) store.User {
	t.Helper()
	u, err := st.CreateUser(ctx, email, strings.Split(email, "@")[0], "hash")
	if err != nil {
		t.Fatalf("CreateUser(%s): %v", email, err)
	}
	return u
}

func newProduct(t *testing.T, st *store.Store, url string, price int64, next time.Time) store.Product {
	t.Helper()
	p, err := st.CreateProduct(ctx, store.NewProduct{URL: url, Retailer: "generic", Title: "Thing " + url, Currency: "INR",
		PriceMinor: price, InStock: true, NextCheckAt: next, Source: "extension"})
	if err != nil {
		t.Fatalf("CreateProduct: %v", err)
	}
	return p
}

func defaultList(t *testing.T, st *store.Store, u store.User) uuid.UUID {
	t.Helper()
	id, err := st.DefaultListID(ctx, u.ID)
	if err != nil {
		t.Fatalf("DefaultListID: %v", err)
	}
	return id
}

func addItem(t *testing.T, st *store.Store, u store.User, list uuid.UUID, p store.Product, rule string) store.Item {
	t.Helper()
	if rule == "" {
		rule = `{"type":"any_drop"}`
	}
	it, err := st.AddItem(ctx, store.NewItem{UserID: u.ID, ListID: list, ProductID: p.ID, AddedPriceMinor: p.CurrentPriceMinor,
		AlertRule: json.RawMessage(rule)})
	if err != nil {
		t.Fatalf("AddItem: %v", err)
	}
	return it
}

func exec(t *testing.T, st *store.Store, sql string, args ...any) {
	t.Helper()
	if _, err := st.Pool.Exec(ctx, sql, args...); err != nil {
		t.Fatalf("exec %q: %v", sql, err)
	}
}

func approx(t *testing.T, what string, got time.Time, want time.Duration, tolerance time.Duration) {
	t.Helper()
	d := time.Until(got)
	if d < want-tolerance || d > want+tolerance {
		t.Errorf("%s is %v from now, want %v ± %v", what, d.Round(time.Second), want, tolerance)
	}
}

func TestCreateUserMakesProfileAndDefaultList(t *testing.T) {
	st := testdb.New(t)
	u := newUser(t, st, "asha@example.com")
	if u.ID == uuid.Nil || u.CreatedAt.IsZero() {
		t.Fatalf("user not filled in: %+v", u)
	}

	p, err := st.Profile(ctx, u.ID)
	if err != nil {
		t.Fatal(err)
	}
	want := store.Profile{Currency: "INR", IncomeStorage: "server", AlertMode: "instant", EmailAlerts: true}
	if p != want {
		t.Errorf("default profile = %+v, want %+v", p, want)
	}

	lists, err := st.Lists(ctx, u.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(lists) != 1 {
		t.Fatalf("got %d lists, want 1", len(lists))
	}
	l := lists[0]
	if l.Name != "Wishlist" || l.Emoji != "i:shopping-bag" || l.Visibility != "private" || len(l.ShareSlug) != 8 || l.Currency != "INR" {
		t.Errorf("default list = %+v", l)
	}
	if id := defaultList(t, st, u); id != l.ID {
		t.Errorf("DefaultListID = %s, want %s", id, l.ID)
	}

	if _, err := st.CreateUser(ctx, "asha@example.com", "Again", "hash"); !errors.Is(err, store.ErrEmailTaken) {
		t.Errorf("duplicate email: err = %v, want ErrEmailTaken", err)
	}
}

func TestUserWithHash(t *testing.T) {
	st := testdb.New(t)
	u := newUser(t, st, "a@example.com")
	got, hash, err := st.UserWithHash(ctx, "a@example.com")
	if err != nil || got.ID != u.ID || hash != "hash" {
		t.Errorf("UserWithHash = %+v, %q, %v", got, hash, err)
	}
	if _, _, err := st.UserWithHash(ctx, "nobody@example.com"); !errors.Is(err, store.ErrNotFound) {
		t.Errorf("unknown email: err = %v, want ErrNotFound", err)
	}
}

func TestSessions(t *testing.T) {
	st := testdb.New(t)
	u := newUser(t, st, "a@example.com")

	tok, hash := auth.NewToken()
	if err := st.CreateSession(ctx, u.ID, hash, time.Now().Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	got, err := st.UserBySession(ctx, auth.HashToken(tok))
	if err != nil || got.ID != u.ID {
		t.Fatalf("UserBySession = %+v, %v", got, err)
	}

	if err := st.DeleteSession(ctx, hash); err != nil {
		t.Fatal(err)
	}
	if _, err := st.UserBySession(ctx, hash); !errors.Is(err, store.ErrNotFound) {
		t.Errorf("deleted session: err = %v, want ErrNotFound", err)
	}

	_, expired := auth.NewToken()
	if err := st.CreateSession(ctx, u.ID, expired, time.Now().Add(-time.Minute)); err != nil {
		t.Fatal(err)
	}
	if _, err := st.UserBySession(ctx, expired); !errors.Is(err, store.ErrNotFound) {
		t.Errorf("expired session: err = %v, want ErrNotFound", err)
	}
}

func TestSetProfile(t *testing.T) {
	st := testdb.New(t)
	u := newUser(t, st, "a@example.com")
	hours := 40
	want := store.Profile{Currency: "USD", MonthlyIncomeMinor: i64(500000), HoursPerWeek: &hours, IncomeStorage: "server", AlertMode: "digest", EmailAlerts: false}
	if err := st.SetProfile(ctx, u.ID, want); err != nil {
		t.Fatal(err)
	}
	got, err := st.Profile(ctx, u.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Currency != "USD" || *got.MonthlyIncomeMinor != 500000 || *got.HoursPerWeek != 40 || got.AlertMode != "digest" || got.EmailAlerts {
		t.Errorf("profile = %+v", got)
	}
}

func TestListsCRUD(t *testing.T) {
	st := testdb.New(t)
	u := newUser(t, st, "a@example.com")
	other := newUser(t, st, "b@example.com")
	first := defaultList(t, st, u)

	if err := st.DeleteList(ctx, u.ID, first); !errors.Is(err, store.ErrLastList) {
		t.Fatalf("deleting the only list: err = %v, want ErrLastList", err)
	}

	l, err := st.CreateList(ctx, u.ID, "Gifts", "🎁")
	if err != nil {
		t.Fatal(err)
	}
	if l.Name != "Gifts" || l.Emoji != "🎁" || l.Visibility != "private" || l.ItemCount != 0 {
		t.Errorf("created list = %+v", l)
	}

	name, vis := "Diwali", "link"
	l, err = st.UpdateList(ctx, u.ID, l.ID, &name, nil, &vis)
	if err != nil {
		t.Fatal(err)
	}
	if l.Name != "Diwali" || l.Emoji != "🎁" || l.Visibility != "link" {
		t.Errorf("updated list = %+v (emoji must be unchanged)", l)
	}

	if _, err := st.UpdateList(ctx, other.ID, l.ID, &name, nil, nil); !errors.Is(err, store.ErrNotFound) {
		t.Errorf("updating another user's list: err = %v, want ErrNotFound", err)
	}
	if _, err := st.List(ctx, other.ID, l.ID); !errors.Is(err, store.ErrNotFound) {
		t.Errorf("reading another user's list: err = %v, want ErrNotFound", err)
	}
	// The other user has only one list, so this must say not found, not "last list".
	if err := st.DeleteList(ctx, other.ID, l.ID); !errors.Is(err, store.ErrNotFound) {
		t.Errorf("deleting another user's list: err = %v, want ErrNotFound", err)
	}
	if err := st.DeleteList(ctx, u.ID, uuid.New()); !errors.Is(err, store.ErrNotFound) {
		t.Errorf("deleting a missing list: err = %v, want ErrNotFound", err)
	}

	if err := st.DeleteList(ctx, u.ID, first); err != nil {
		t.Fatalf("deleting one of two lists: %v", err)
	}
	lists, _ := st.Lists(ctx, u.ID)
	if len(lists) != 1 || lists[0].ID != l.ID {
		t.Errorf("lists after delete = %+v", lists)
	}
	if id := defaultList(t, st, u); id != l.ID {
		t.Errorf("default list after delete = %s, want %s", id, l.ID)
	}
}

func TestListTotalsCountOnlyWantedItems(t *testing.T) {
	st := testdb.New(t)
	u := newUser(t, st, "a@example.com")
	list := defaultList(t, st, u)
	a := addItem(t, st, u, list, newProduct(t, st, "https://shop.test/a", 1000, time.Now()), "")
	addItem(t, st, u, list, newProduct(t, st, "https://shop.test/b", 2500, time.Now()), "")
	c := addItem(t, st, u, list, newProduct(t, st, "https://shop.test/c", 9999, time.Now()), "")
	if _, err := st.UpdateItem(ctx, u.ID, c.ID, map[string]any{"status": "bought"}); err != nil {
		t.Fatal(err)
	}
	l, err := st.List(ctx, u.ID, list)
	if err != nil {
		t.Fatal(err)
	}
	if l.ItemCount != 2 || l.TotalMinor != 3500 {
		t.Errorf("list count/total = %d/%d, want 2/3500", l.ItemCount, l.TotalMinor)
	}
	if a.Position != 0 {
		t.Errorf("first item position = %d, want 0", a.Position)
	}
}

func TestCreateProductDeduplicatesByURL(t *testing.T) {
	st := testdb.New(t)
	a := newProduct(t, st, "https://shop.test/x", 1000, time.Now())
	b := newProduct(t, st, "https://shop.test/x", 5000, time.Now())
	if a.ID != b.ID || b.CurrentPriceMinor != 1000 {
		t.Errorf("second create returned %+v, want the first product %+v", b, a)
	}
	if a.LastCheckStatus != "ok" || a.LastCheckedAt == nil {
		t.Errorf("new product check status = %q, checked at %v", a.LastCheckStatus, a.LastCheckedAt)
	}
	var n int
	if err := st.Pool.QueryRow(ctx, `SELECT count(*) FROM price_points WHERE product_id=$1`, a.ID).Scan(&n); err != nil || n != 1 {
		t.Errorf("price points = %d (%v), want 1", n, err)
	}
	if _, err := st.ProductByURL(ctx, "https://shop.test/missing"); !errors.Is(err, store.ErrNotFound) {
		t.Errorf("missing product: err = %v", err)
	}
}

func TestAddItemPositionsAndConflicts(t *testing.T) {
	st := testdb.New(t)
	u := newUser(t, st, "a@example.com")
	list := defaultList(t, st, u)
	p := newProduct(t, st, "https://shop.test/a", 1000, time.Now())
	q := newProduct(t, st, "https://shop.test/b", 2000, time.Now())

	a := addItem(t, st, u, list, p, "")
	b := addItem(t, st, u, list, q, "")
	if a.Position != 0 || b.Position != 1 {
		t.Errorf("positions = %d, %d; want 0, 1", a.Position, b.Position)
	}
	if a.Status != "wanted" || a.Product.ID != p.ID || a.AddedPriceMinor != 1000 || string(a.AlertRule) != `{"type": "any_drop"}` {
		t.Errorf("item = %+v (rule %s)", a, a.AlertRule)
	}
	_, err := st.AddItem(ctx, store.NewItem{UserID: u.ID, ListID: list, ProductID: p.ID, AddedPriceMinor: 1, AlertRule: json.RawMessage(`{}`)})
	if !errors.Is(err, store.ErrConflict) {
		t.Errorf("same product twice in one list: err = %v, want ErrConflict", err)
	}
	got, err := st.ItemByProduct(ctx, list, p.ID)
	if err != nil || got.ID != a.ID {
		t.Errorf("ItemByProduct = %v, %v", got.ID, err)
	}
}

func TestUpdateItem(t *testing.T) {
	st := testdb.New(t)
	u := newUser(t, st, "a@example.com")
	other := newUser(t, st, "b@example.com")
	list := defaultList(t, st, u)
	p := newProduct(t, st, "https://shop.test/a", 1000, time.Now())
	it := addItem(t, st, u, list, p, "")

	t.Run("bought_at follows status", func(t *testing.T) {
		got, err := st.UpdateItem(ctx, u.ID, it.ID, map[string]any{"status": "bought"})
		if err != nil {
			t.Fatal(err)
		}
		if got.Status != "bought" || got.BoughtAt == nil {
			t.Fatalf("after bought: status %q bought_at %v", got.Status, got.BoughtAt)
		}
		first := *got.BoughtAt
		again, _ := st.UpdateItem(ctx, u.ID, it.ID, map[string]any{"status": "bought"})
		if again.BoughtAt == nil || !again.BoughtAt.Equal(first) {
			t.Errorf("marking bought again changed bought_at from %v to %v", first, again.BoughtAt)
		}
		back, _ := st.UpdateItem(ctx, u.ID, it.ID, map[string]any{"status": "wanted"})
		if back.BoughtAt != nil {
			t.Errorf("back to wanted kept bought_at %v", back.BoughtAt)
		}
	})

	t.Run("changing target or rule clears last alerted price", func(t *testing.T) {
		for _, f := range []map[string]any{
			{"target_price_minor": i64(500)},
			{"alert_rule": []byte(`{"type":"percent_drop","percent":10}`)},
		} {
			exec(t, st, `UPDATE items SET last_alerted_price_minor=900 WHERE id=$1`, it.ID)
			if _, err := st.UpdateItem(ctx, u.ID, it.ID, f); err != nil {
				t.Fatal(err)
			}
			var last *int64
			if err := st.Pool.QueryRow(ctx, `SELECT last_alerted_price_minor FROM items WHERE id=$1`, it.ID).Scan(&last); err != nil {
				t.Fatal(err)
			}
			if last != nil {
				t.Errorf("after %v last_alerted_price_minor = %d, want NULL", f, *last)
			}
		}
		exec(t, st, `UPDATE items SET last_alerted_price_minor=900 WHERE id=$1`, it.ID)
		if _, err := st.UpdateItem(ctx, u.ID, it.ID, map[string]any{"note": "hi"}); err != nil {
			t.Fatal(err)
		}
		var last *int64
		_ = st.Pool.QueryRow(ctx, `SELECT last_alerted_price_minor FROM items WHERE id=$1`, it.ID).Scan(&last)
		if last == nil {
			t.Error("changing the note must keep last_alerted_price_minor")
		}
	})

	t.Run("moving lists puts the item last and rejects duplicates", func(t *testing.T) {
		gifts, err := st.CreateList(ctx, u.ID, "Gifts", "")
		if err != nil {
			t.Fatal(err)
		}
		q := newProduct(t, st, "https://shop.test/q", 10, time.Now())
		addItem(t, st, u, gifts.ID, q, "")
		moved, err := st.UpdateItem(ctx, u.ID, it.ID, map[string]any{"list_id": gifts.ID})
		if err != nil {
			t.Fatal(err)
		}
		if moved.ListID != gifts.ID || moved.Position != 1 {
			t.Errorf("moved item list %s position %d, want %s / 1", moved.ListID, moved.Position, gifts.ID)
		}
		dup := addItem(t, st, u, list, p, "") // same product back in the first list
		if _, err := st.UpdateItem(ctx, u.ID, dup.ID, map[string]any{"list_id": gifts.ID}); !errors.Is(err, store.ErrConflict) {
			t.Errorf("moving onto a duplicate: err = %v, want ErrConflict", err)
		}
	})

	t.Run("ownership and unknown fields", func(t *testing.T) {
		if _, err := st.UpdateItem(ctx, other.ID, it.ID, map[string]any{"note": "x"}); !errors.Is(err, store.ErrNotFound) {
			t.Errorf("other user's item: err = %v, want ErrNotFound", err)
		}
		if _, err := st.UpdateItem(ctx, u.ID, it.ID, map[string]any{"user_id": other.ID}); err == nil {
			t.Error("unknown field accepted")
		}
		if err := st.DeleteItem(ctx, other.ID, it.ID); !errors.Is(err, store.ErrNotFound) {
			t.Errorf("deleting other user's item: err = %v, want ErrNotFound", err)
		}
		if err := st.DeleteItem(ctx, u.ID, it.ID); err != nil {
			t.Fatal(err)
		}
		if _, err := st.Item(ctx, u.ID, it.ID); !errors.Is(err, store.ErrNotFound) {
			t.Errorf("deleted item: err = %v", err)
		}
	})
}

func TestReorder(t *testing.T) {
	st := testdb.New(t)
	u := newUser(t, st, "a@example.com")
	list := defaultList(t, st, u)
	gifts, _ := st.CreateList(ctx, u.ID, "Gifts", "")
	a := addItem(t, st, u, list, newProduct(t, st, "https://shop.test/a", 1, time.Now()), "")
	b := addItem(t, st, u, list, newProduct(t, st, "https://shop.test/b", 1, time.Now()), "")
	c := addItem(t, st, u, list, newProduct(t, st, "https://shop.test/c", 1, time.Now()), "")
	elsewhere := addItem(t, st, u, gifts.ID, newProduct(t, st, "https://shop.test/d", 1, time.Now()), "")

	if err := st.Reorder(ctx, u.ID, list, []uuid.UUID{c.ID, elsewhere.ID, a.ID, b.ID}); err != nil {
		t.Fatal(err)
	}
	items, err := st.ItemsByList(ctx, u.ID, list, "wanted")
	if err != nil {
		t.Fatal(err)
	}
	var order []uuid.UUID
	for _, it := range items {
		order = append(order, it.ID)
	}
	if len(order) != 3 || order[0] != c.ID || order[1] != a.ID || order[2] != b.ID {
		t.Errorf("order = %v, want c, a, b", order)
	}
	if got, _ := st.Item(ctx, u.ID, elsewhere.ID); got.Position != 0 {
		t.Errorf("item in another list moved to position %d", got.Position)
	}
}

func TestItemsByListStatusFilter(t *testing.T) {
	st := testdb.New(t)
	u := newUser(t, st, "a@example.com")
	list := defaultList(t, st, u)
	for i, status := range []string{"wanted", "bought", "removed"} {
		it := addItem(t, st, u, list, newProduct(t, st, "https://shop.test/"+status, int64(i+1), time.Now()), "")
		if _, err := st.UpdateItem(ctx, u.ID, it.ID, map[string]any{"status": status}); err != nil {
			t.Fatal(err)
		}
	}
	for status, want := range map[string]int{"wanted": 1, "bought": 1, "removed": 1, "all": 3} {
		items, err := st.ItemsByList(ctx, u.ID, list, status)
		if err != nil || len(items) != want {
			t.Errorf("status %s: %d items (%v), want %d", status, len(items), err, want)
		}
	}
	other := newUser(t, st, "b@example.com")
	if items, _ := st.ItemsByList(ctx, other.ID, list, "all"); len(items) != 0 {
		t.Errorf("another user sees %d items", len(items))
	}
}

func TestItemStatsAndHistory(t *testing.T) {
	st := testdb.New(t)
	u := newUser(t, st, "a@example.com")
	p := newProduct(t, st, "https://shop.test/a", 1000, time.Now())
	it := addItem(t, st, u, defaultList(t, st, u), p, "")
	exec(t, st, `INSERT INTO price_points (product_id, price_minor, currency, in_stock, source, checked_at) VALUES
		($1, 1500, 'INR', true, 'api', now() - interval '100 days'),
		($1, 1200, 'INR', true, 'api', now() - interval '10 days')`, p.ID)
	exec(t, st, `UPDATE products SET current_price_minor=800 WHERE id=$1`, p.ID)
	exec(t, st, `INSERT INTO price_points (product_id, price_minor, currency, in_stock, source) VALUES ($1, 800, 'INR', true, 'extension')`, p.ID)

	got, err := st.Item(ctx, u.ID, it.ID)
	if err != nil {
		t.Fatal(err)
	}
	want := store.ItemStats{LowestMinor: 800, HighestMinor: 1500, ChangeSinceAddedMinor: -200}
	if got.Stats != want {
		t.Errorf("stats = %+v, want %+v", got.Stats, want)
	}

	pts, err := st.History(ctx, u.ID, it.ID, 90)
	if err != nil {
		t.Fatal(err)
	}
	var prices []int64
	for _, pt := range pts {
		prices = append(prices, pt.PriceMinor)
	}
	// 100 days ago is outside the window; the rest is ascending by time.
	if len(prices) != 3 || prices[0] != 1200 || prices[1] != 1000 || prices[2] != 800 {
		t.Errorf("90-day history = %v, want [1200 1000 800]", prices)
	}
	if all, _ := st.History(ctx, u.ID, it.ID, 365); len(all) != 4 {
		t.Errorf("365-day history has %d points, want 4", len(all))
	}
	other := newUser(t, st, "b@example.com")
	if pts, _ := st.History(ctx, other.ID, it.ID, 365); len(pts) != 0 {
		t.Errorf("another user sees %d history points", len(pts))
	}
}

func TestLeaseTasks(t *testing.T) {
	st := testdb.New(t)
	u := newUser(t, st, "a@example.com")
	other := newUser(t, st, "b@example.com")
	list := defaultList(t, st, u)

	older := newProduct(t, st, "https://shop.test/older", 1, time.Now().Add(-2*time.Hour))
	newer := newProduct(t, st, "https://shop.test/newer", 1, time.Now().Add(-time.Hour))
	future := newProduct(t, st, "https://shop.test/future", 1, time.Now().Add(time.Hour))
	removed := newProduct(t, st, "https://shop.test/removed", 1, time.Now().Add(-time.Hour))
	addItem(t, st, u, list, newer, "")
	addItem(t, st, u, list, older, "")
	addItem(t, st, u, list, future, "")
	r := addItem(t, st, u, list, removed, "")
	if _, err := st.UpdateItem(ctx, u.ID, r.ID, map[string]any{"status": "removed"}); err != nil {
		t.Fatal(err)
	}

	if tasks, _ := st.LeaseTasks(ctx, other.ID, 5); len(tasks) != 0 {
		t.Errorf("a user who tracks nothing got %d tasks", len(tasks))
	}

	tasks, err := st.LeaseTasks(ctx, u.ID, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(tasks) != 1 || tasks[0].ProductID != older.ID || tasks[0].URL != older.URL {
		t.Fatalf("limit 1 tasks = %+v, want the oldest due product", tasks)
	}
	tasks, _ = st.LeaseTasks(ctx, u.ID, 5)
	if len(tasks) != 1 || tasks[0].ProductID != newer.ID {
		t.Fatalf("second lease = %+v, want only the newer product (the older one is leased)", tasks)
	}
	if tasks, _ := st.LeaseTasks(ctx, u.ID, 5); len(tasks) != 0 {
		t.Errorf("everything is leased, still got %+v", tasks)
	}

	var leased time.Time
	if err := st.Pool.QueryRow(ctx, `SELECT leased_until FROM products WHERE id=$1`, older.ID).Scan(&leased); err != nil {
		t.Fatal(err)
	}
	approx(t, "leased_until", leased, 10*time.Minute, time.Minute)

	// Expired leases are handed out again.
	exec(t, st, `UPDATE products SET leased_until = now() - interval '1 second' WHERE id=$1`, older.ID)
	if tasks, _ := st.LeaseTasks(ctx, u.ID, 5); len(tasks) != 1 || tasks[0].ProductID != older.ID {
		t.Errorf("after the lease expired got %+v", tasks)
	}
}

func TestRequestRefresh(t *testing.T) {
	st := testdb.New(t)
	u := newUser(t, st, "a@example.com")
	other := newUser(t, st, "b@example.com")
	p := newProduct(t, st, "https://shop.test/a", 1, time.Now().Add(6*time.Hour))
	it := addItem(t, st, u, defaultList(t, st, u), p, "")
	exec(t, st, `UPDATE products SET leased_until = now() + interval '5 minutes' WHERE id=$1`, p.ID)

	if err := st.RequestRefresh(ctx, other.ID, it.ID); !errors.Is(err, store.ErrNotFound) {
		t.Errorf("refresh of another user's item: err = %v, want ErrNotFound", err)
	}
	if err := st.RequestRefresh(ctx, u.ID, it.ID); err != nil {
		t.Fatal(err)
	}
	tasks, err := st.LeaseTasks(ctx, u.ID, 5)
	if err != nil || len(tasks) != 1 || tasks[0].ProductID != p.ID {
		t.Errorf("after refresh tasks = %+v, %v; want the product", tasks, err)
	}
}

func TestRecordFailureBacksOff(t *testing.T) {
	st := testdb.New(t)
	p := newProduct(t, st, "https://shop.test/a", 1000, time.Now())
	exec(t, st, `UPDATE products SET leased_until = now() + interval '5 minutes' WHERE id=$1`, p.ID)

	read := func() (status string, fails int, next time.Time, leased *time.Time, price int64) {
		t.Helper()
		if err := st.Pool.QueryRow(ctx, `SELECT last_check_status, fail_count, next_check_at, leased_until, current_price_minor FROM products WHERE id=$1`, p.ID).
			Scan(&status, &fails, &next, &leased, &price); err != nil {
			t.Fatal(err)
		}
		return
	}

	for i, want := range []time.Duration{30 * time.Minute, time.Hour, 2 * time.Hour, 4 * time.Hour} {
		if err := st.RecordFailure(ctx, p.ID); err != nil {
			t.Fatal(err)
		}
		status, fails, next, leased, price := read()
		if status != "failed" || fails != i+1 || leased != nil || price != 1000 {
			t.Errorf("failure %d: status %q fails %d leased %v price %d", i+1, status, fails, leased, price)
		}
		approx(t, "next_check_at", next, want, time.Minute)
	}
	for range 10 {
		_ = st.RecordFailure(ctx, p.ID)
	}
	_, _, next, _, _ := read()
	approx(t, "capped next_check_at", next, 24*time.Hour, time.Minute)
}

// alwaysDrop is a Decider that alerts every candidate.
func alwaysDrop(store.Candidate, int64, bool, store.Check) string { return "drop" }

func TestRecordCheck(t *testing.T) {
	st := testdb.New(t)
	instant := newUser(t, st, "instant@example.com")
	digest := newUser(t, st, "digest@example.com")
	muted := newUser(t, st, "muted@example.com")
	cooling := newUser(t, st, "cooling@example.com")
	exec(t, st, `UPDATE profiles SET alert_mode='digest' WHERE user_id=$1`, digest.ID)
	exec(t, st, `UPDATE profiles SET email_alerts=false WHERE user_id=$1`, muted.ID)

	p := newProduct(t, st, "https://shop.test/a", 1000, time.Now())
	exec(t, st, `UPDATE products SET leased_until = now() + interval '5 minutes', fail_count=3, last_check_status='failed' WHERE id=$1`, p.ID)
	inst := addItem(t, st, instant, defaultList(t, st, instant), p, "")
	addItem(t, st, digest, defaultList(t, st, digest), p, "")
	addItem(t, st, muted, defaultList(t, st, muted), p, "")
	cool := addItem(t, st, cooling, defaultList(t, st, cooling), p, "")
	future := time.Now().Add(24 * time.Hour)
	if _, err := st.UpdateItem(ctx, cooling.ID, cool.ID, map[string]any{"cooling_until": &future}); err != nil {
		t.Fatal(err)
	}

	var seen []store.Candidate
	decide := func(c store.Candidate, prev int64, prevStock bool, chk store.Check) string {
		if prev != 1000 || !prevStock || chk.PriceMinor != 900 {
			t.Errorf("decider got prev %d stock %v check %+v", prev, prevStock, chk)
		}
		seen = append(seen, c)
		return "drop"
	}
	next := time.Now().Add(6 * time.Hour)
	alerts, err := st.RecordCheck(ctx, p.ID, store.Check{Title: "New title", Currency: "INR", PriceMinor: 900, OriginalMinor: i64(1200), InStock: true},
		"extension", next, decide)
	if err != nil {
		t.Fatal(err)
	}

	// Muted and cooling items are never candidates; digest users are candidates but get no instant alert.
	if len(seen) != 2 {
		t.Errorf("decider saw %d candidates, want 2 (instant + digest)", len(seen))
	}
	if len(alerts) != 1 {
		t.Fatalf("got %d alerts, want 1: %+v", len(alerts), alerts)
	}
	a := alerts[0]
	if a.ItemID != inst.ID || a.Email != "instant@example.com" || a.Kind != "drop" || a.OldMinor != 1000 ||
		a.Product.CurrentPriceMinor != 900 || a.Product.Title != "New title" {
		t.Errorf("alert = %+v", a)
	}

	var last *int64
	_ = st.Pool.QueryRow(ctx, `SELECT last_alerted_price_minor FROM items WHERE id=$1`, inst.ID).Scan(&last)
	if last == nil || *last != 900 {
		t.Errorf("last_alerted_price_minor = %v, want 900", last)
	}

	got, _ := st.ProductByURL(ctx, p.URL)
	if got.CurrentPriceMinor != 900 || *got.OriginalPriceMinor != 1200 || got.LastCheckStatus != "ok" || got.Title != "New title" {
		t.Errorf("product after check = %+v", got)
	}
	var fails int
	var leased *time.Time
	var nextAt time.Time
	_ = st.Pool.QueryRow(ctx, `SELECT fail_count, leased_until, next_check_at FROM products WHERE id=$1`, p.ID).Scan(&fails, &leased, &nextAt)
	if fails != 0 || leased != nil || !nextAt.Round(time.Second).Equal(next.Round(time.Second)) {
		t.Errorf("fail_count %d leased %v next %v (want 0, nil, %v)", fails, leased, nextAt, next)
	}
	var points int
	_ = st.Pool.QueryRow(ctx, `SELECT count(*) FROM price_points WHERE product_id=$1 AND source='extension' AND price_minor=900`, p.ID).Scan(&points)
	if points != 1 {
		t.Errorf("new price points = %d, want 1", points)
	}

	// An empty image URL keeps the old image.
	exec(t, st, `UPDATE products SET image_url='https://img.test/a.jpg' WHERE id=$1`, p.ID)
	if _, err := st.RecordCheck(ctx, p.ID, store.Check{Title: "t", Currency: "INR", PriceMinor: 900, InStock: true}, "extension", next, alwaysDrop); err != nil {
		t.Fatal(err)
	}
	if got, _ := st.ProductByURL(ctx, p.URL); got.ImageURL != "https://img.test/a.jpg" {
		t.Errorf("image_url = %q, want the old image kept", got.ImageURL)
	}

	if _, err := st.RecordCheck(ctx, uuid.New(), store.Check{}, "extension", next, alwaysDrop); !errors.Is(err, store.ErrNotFound) {
		t.Errorf("missing product: err = %v, want ErrNotFound", err)
	}
}

func TestStats(t *testing.T) {
	st := testdb.New(t)
	u := newUser(t, st, "a@example.com")
	list := defaultList(t, st, u)

	empty, err := st.Stats(ctx, u.ID)
	if err != nil {
		t.Fatal(err)
	}
	if empty != (store.Stats{Currency: "INR"}) {
		t.Errorf("empty stats = %+v", empty)
	}

	cheaper := newProduct(t, st, "https://shop.test/cheaper", 1000, time.Now())
	pricier := newProduct(t, st, "https://shop.test/pricier", 2000, time.Now())
	bought := newProduct(t, st, "https://shop.test/bought", 3000, time.Now())
	gone := newProduct(t, st, "https://shop.test/gone", 4000, time.Now())
	addItem(t, st, u, list, cheaper, "")
	addItem(t, st, u, list, pricier, "")
	b := addItem(t, st, u, list, bought, "")
	g := addItem(t, st, u, list, gone, "")
	_, _ = st.UpdateItem(ctx, u.ID, b.ID, map[string]any{"status": "bought"})
	_, _ = st.UpdateItem(ctx, u.ID, g.ID, map[string]any{"status": "removed"})
	exec(t, st, `UPDATE products SET current_price_minor = CASE canonical_url
		WHEN 'https://shop.test/cheaper' THEN 700 WHEN 'https://shop.test/pricier' THEN 2500
		WHEN 'https://shop.test/bought' THEN 2900 ELSE current_price_minor END`)

	s, err := st.Stats(ctx, u.ID)
	if err != nil {
		t.Fatal(err)
	}
	want := store.Stats{Currency: "INR", ItemCount: 2, TotalMinor: 3200, SavedByDropsMinor: 300 + 100, RemovedValueMinor: 4000}
	if s != want {
		t.Errorf("stats = %+v, want %+v", s, want)
	}
}

func TestPublicList(t *testing.T) {
	st := testdb.New(t)
	u, err := st.CreateUser(ctx, "a@example.com", "Asha", "hash")
	if err != nil {
		t.Fatal(err)
	}
	lists, _ := st.Lists(ctx, u.ID)
	l := lists[0]
	if _, _, err := st.PublicList(ctx, l.ShareSlug); !errors.Is(err, store.ErrNotFound) {
		t.Errorf("private list: err = %v, want ErrNotFound", err)
	}
	vis := "link"
	if _, err := st.UpdateList(ctx, u.ID, l.ID, nil, nil, &vis); err != nil {
		t.Fatal(err)
	}
	got, owner, err := st.PublicList(ctx, l.ShareSlug)
	if err != nil || got.ID != l.ID || owner != "Asha" {
		t.Errorf("PublicList = %+v, %q, %v", got, owner, err)
	}

	wanted := addItem(t, st, u, l.ID, newProduct(t, st, "https://shop.test/a", 1, time.Now()), "")
	hidden := addItem(t, st, u, l.ID, newProduct(t, st, "https://shop.test/b", 1, time.Now()), "")
	_, _ = st.UpdateItem(ctx, u.ID, hidden.ID, map[string]any{"status": "bought"})
	items, err := st.PublicItems(ctx, l.ID)
	if err != nil || len(items) != 1 || items[0].ID != wanted.ID {
		t.Errorf("PublicItems = %+v, %v; want only the wanted item", items, err)
	}
}

func TestDigestQueries(t *testing.T) {
	st := testdb.New(t)
	d := newUser(t, st, "digest@example.com")
	newUser(t, st, "instant@example.com")
	off := newUser(t, st, "off@example.com")
	exec(t, st, `UPDATE profiles SET alert_mode='digest' WHERE user_id IN ($1, $2)`, d.ID, off.ID)
	exec(t, st, `UPDATE profiles SET email_alerts=false WHERE user_id=$1`, off.ID)

	since := time.Now().Add(-time.Hour)
	users, err := st.DigestUsers(ctx, since)
	if err != nil || len(users) != 1 || users[0].ID != d.ID {
		t.Fatalf("DigestUsers = %+v, %v; want only the digest user with alerts on", users, err)
	}
	if err := st.LogEmail(ctx, d.ID, nil, "digest_empty", nil); err != nil {
		t.Fatal(err)
	}
	if users, _ := st.DigestUsers(ctx, since); len(users) != 0 {
		t.Errorf("user already got this week's digest, still listed: %+v", users)
	}
	if users, _ := st.DigestUsers(ctx, time.Now().Add(time.Hour)); len(users) != 1 {
		t.Errorf("next week's slot should list the user again, got %+v", users)
	}

	list := defaultList(t, st, d)
	dropped := newProduct(t, st, "https://shop.test/dropped", 1000, time.Now())
	bigger := newProduct(t, st, "https://shop.test/bigger", 5000, time.Now())
	flat := newProduct(t, st, "https://shop.test/flat", 1000, time.Now())
	addItem(t, st, d, list, dropped, "")
	addItem(t, st, d, list, bigger, "")
	addItem(t, st, d, list, flat, "")
	exec(t, st, `UPDATE products SET current_price_minor=900 WHERE id=$1`, dropped.ID)
	exec(t, st, `UPDATE products SET current_price_minor=4000 WHERE id=$1`, bigger.ID)

	drops, err := st.DigestDrops(ctx, d.ID, time.Now().Add(-7*24*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if len(drops) != 2 || drops[0].Product.ID != bigger.ID || drops[0].OldMinor != 5000 || drops[1].Product.ID != dropped.ID {
		t.Errorf("DigestDrops = %+v; want bigger drop first, flat product excluded", drops)
	}
}

func TestSeedIsRepeatable(t *testing.T) {
	st := testdb.New(t)
	for i := range 2 {
		if err := st.Seed(ctx); err != nil {
			t.Fatalf("seed run %d: %v", i+1, err)
		}
	}
	u, hash, err := st.UserWithHash(ctx, store.DemoEmail)
	if err != nil {
		t.Fatal(err)
	}
	if !auth.CheckPassword(hash, store.DemoPassword) {
		t.Error("demo password does not match")
	}
	lists, _ := st.Lists(ctx, u.ID)
	if len(lists) != 2 {
		t.Fatalf("demo user has %d lists, want 2", len(lists))
	}
	total := 0
	for _, l := range lists {
		total += l.ItemCount
		items, err := st.ItemsByList(ctx, u.ID, l.ID, "all")
		if err != nil {
			t.Fatal(err)
		}
		for i, it := range items {
			if it.Position != i {
				t.Errorf("list %q item %d has position %d", l.Name, i, it.Position)
			}
		}
	}
	if total == 0 {
		t.Error("seeded lists are empty")
	}
	if _, _, err := st.PublicList(ctx, "diwali26"); err != nil {
		t.Errorf("seeded public list: %v", err)
	}
	if tasks, _ := st.LeaseTasks(ctx, u.ID, 20); len(tasks) == 0 {
		t.Error("seed should leave live products due for the extension")
	}
}
