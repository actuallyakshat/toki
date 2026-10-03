package pricecheck

import (
	"context"
	"encoding/json"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/actuallyakshat/toki/server/internal/email"
	"github.com/actuallyakshat/toki/server/internal/extract"
	"github.com/actuallyakshat/toki/server/internal/store"
	"github.com/actuallyakshat/toki/server/internal/testdb"
)

// fakeMail records messages instead of sending them.
type fakeMail struct {
	mu   sync.Mutex
	sent []email.Message
}

func (f *fakeMail) Send(_ context.Context, m email.Message) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sent = append(f.sent, m)
	return nil
}

func (f *fakeMail) take() []email.Message {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := f.sent
	f.sent = nil
	return out
}

type fixture struct {
	t    *testing.T
	st   *store.Store
	mail *fakeMail
	svc  *Service
}

func newFixture(t *testing.T) *fixture {
	st := testdb.New(t)
	mail := &fakeMail{}
	return &fixture{t: t, st: st, mail: mail, svc: &Service{Store: st, Mail: mail, AppURL: "https://toki.test", Interval: 6 * time.Hour}}
}

// track creates a user who tracks a product at 1000 paise with the given rule.
func (f *fixture) track(email, url, rule string, target *int64) (store.User, store.Product, store.Item) {
	f.t.Helper()
	ctx := context.Background()
	u, err := f.st.CreateUser(ctx, email, "User", "hash")
	if err != nil {
		f.t.Fatal(err)
	}
	p, err := f.st.CreateProduct(ctx, store.NewProduct{URL: url, Retailer: "generic", Title: "Phone", Currency: "INR",
		PriceMinor: 1000, InStock: true, NextCheckAt: time.Now(), Source: "extension"})
	if err != nil {
		f.t.Fatal(err)
	}
	list, _ := f.st.DefaultListID(ctx, u.ID)
	it, err := f.st.AddItem(ctx, store.NewItem{UserID: u.ID, ListID: list, ProductID: p.ID, AddedPriceMinor: 1000,
		TargetPriceMinor: target, AlertRule: json.RawMessage(rule)})
	if err != nil {
		f.t.Fatal(err)
	}
	return u, p, it
}

func (f *fixture) apply(p store.Product, price int64, inStock bool) bool {
	f.t.Helper()
	ok, err := f.svc.Apply(context.Background(), p.ID, &extract.Capture{Title: "Phone", Currency: "INR", PriceMinor: price, InStock: inStock}, "extension")
	if err != nil {
		f.t.Fatal(err)
	}
	return ok
}

func (f *fixture) emailLog(kind string) int {
	f.t.Helper()
	var n int
	if err := f.st.Pool.QueryRow(context.Background(), `SELECT count(*) FROM email_log WHERE kind=$1`, kind).Scan(&n); err != nil {
		f.t.Fatal(err)
	}
	return n
}

func TestApplyAnyDropAlertsOncePerPrice(t *testing.T) {
	f := newFixture(t)
	_, p, _ := f.track("a@example.com", "https://shop.test/a", `{"type":"any_drop"}`, nil)

	if !f.apply(p, 900, true) {
		t.Fatal("valid capture reported invalid")
	}
	sent := f.mail.take()
	if len(sent) != 1 || sent[0].To != "a@example.com" || !strings.Contains(sent[0].Subject, "₹9") {
		t.Fatalf("first drop sent %+v", sent)
	}
	if f.emailLog("drop") != 1 {
		t.Error("drop email not logged")
	}

	f.apply(p, 950, true) // up: no email
	f.apply(p, 920, true) // down vs previous, but not below the last alerted price
	if sent := f.mail.take(); len(sent) != 0 {
		t.Errorf("no new low, still sent %d emails", len(sent))
	}
	f.apply(p, 850, true) // new low
	if sent := f.mail.take(); len(sent) != 1 {
		t.Errorf("new low sent %d emails, want 1", len(sent))
	}
}

func TestApplyBelowTargetAndPercentDrop(t *testing.T) {
	f := newFixture(t)
	target := int64(800)
	_, pt, _ := f.track("target@example.com", "https://shop.test/t", `{"type":"below_target"}`, &target)
	_, pp, _ := f.track("percent@example.com", "https://shop.test/p", `{"type":"percent_drop","percent":10}`, nil)

	f.apply(pt, 850, true)
	f.apply(pp, 910, true)
	if sent := f.mail.take(); len(sent) != 0 {
		t.Fatalf("above target / under 10%% drop sent %+v", sent)
	}
	f.apply(pt, 800, true)
	f.apply(pp, 900, true)
	sent := f.mail.take()
	if len(sent) != 2 {
		t.Fatalf("at target and at exactly 10%% off: sent %d emails, want 2", len(sent))
	}
}

func TestApplyBackInStock(t *testing.T) {
	f := newFixture(t)
	_, p, _ := f.track("a@example.com", "https://shop.test/a", `{"type":"any_drop"}`, nil)

	f.apply(p, 500, false) // cheaper but out of stock: no drop alert
	if sent := f.mail.take(); len(sent) != 0 {
		t.Fatalf("out-of-stock drop sent %+v", sent)
	}
	f.apply(p, 1000, true)
	sent := f.mail.take()
	if len(sent) != 1 || f.emailLog("back_in_stock") != 1 {
		t.Fatalf("back in stock sent %+v", sent)
	}
	if strings.Contains(strings.ToLower(sent[0].Subject), "drop") {
		t.Errorf("back-in-stock subject looks like a drop: %q", sent[0].Subject)
	}
}

func TestApplyInvalidCaptureRecordsFailure(t *testing.T) {
	f := newFixture(t)
	_, p, _ := f.track("a@example.com", "https://shop.test/a", `{"type":"any_drop"}`, nil)
	ctx := context.Background()

	bad := []*extract.Capture{
		nil,
		{Title: "Phone", Currency: "USD", PriceMinor: 10, InStock: true},
		{Title: "Phone", Currency: "INR", PriceMinor: 0, InStock: true},
		{Title: " ", Currency: "INR", PriceMinor: 10, InStock: true},
	}
	for i, c := range bad {
		ok, err := f.svc.Apply(ctx, p.ID, c, "extension")
		if err != nil || ok {
			t.Errorf("capture %d: ok=%v err=%v, want invalid without error", i, ok, err)
		}
	}
	got, _ := f.st.ProductByURL(ctx, p.URL)
	if got.LastCheckStatus != "failed" || got.CurrentPriceMinor != 1000 {
		t.Errorf("product after failures = %+v", got)
	}
	var points, fails int
	_ = f.st.Pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM price_points WHERE product_id=$1), fail_count FROM products WHERE id=$1`, p.ID).Scan(&points, &fails)
	if points != 1 || fails != len(bad) {
		t.Errorf("points %d fails %d, want 1 and %d", points, fails, len(bad))
	}
	if sent := f.mail.take(); len(sent) != 0 {
		t.Errorf("invalid captures sent %d emails", len(sent))
	}
}

func TestDigestUsersGetNoInstantEmail(t *testing.T) {
	f := newFixture(t)
	u, p, _ := f.track("d@example.com", "https://shop.test/a", `{"type":"any_drop"}`, nil)
	ctx := context.Background()
	if _, err := f.st.Pool.Exec(ctx, `UPDATE profiles SET alert_mode='digest' WHERE user_id=$1`, u.ID); err != nil {
		t.Fatal(err)
	}
	f.apply(p, 700, true)
	if sent := f.mail.take(); len(sent) != 0 {
		t.Fatalf("digest user got instant email %+v", sent)
	}

	// The digest for the current slot lists the drop and is sent once.
	f.svc.sendDigests(ctx, time.Now())
	sent := f.mail.take()
	if len(sent) != 1 || sent[0].To != "d@example.com" || f.emailLog("digest") != 1 {
		t.Fatalf("digest sent %+v", sent)
	}
	if !strings.Contains(sent[0].Text, "Phone") {
		t.Errorf("digest text does not mention the product:\n%s", sent[0].Text)
	}
	f.svc.sendDigests(ctx, time.Now())
	if sent := f.mail.take(); len(sent) != 0 {
		t.Errorf("second run in the same week sent %d digests", len(sent))
	}
}

func TestDigestWithoutDropsIsLoggedNotSent(t *testing.T) {
	f := newFixture(t)
	u, _, _ := f.track("d@example.com", "https://shop.test/a", `{"type":"any_drop"}`, nil)
	ctx := context.Background()
	if _, err := f.st.Pool.Exec(ctx, `UPDATE profiles SET alert_mode='digest' WHERE user_id=$1`, u.ID); err != nil {
		t.Fatal(err)
	}
	f.svc.sendDigests(ctx, time.Now())
	if sent := f.mail.take(); len(sent) != 0 {
		t.Errorf("empty digest was emailed: %+v", sent)
	}
	if f.emailLog("digest_empty") != 1 {
		t.Error("empty digest not logged, so the user would be retried every 10 minutes")
	}
}
