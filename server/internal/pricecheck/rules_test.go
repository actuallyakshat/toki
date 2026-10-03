package pricecheck

import (
	"testing"
	"time"

	"github.com/actuallyakshat/toki/server/internal/extract"
	"github.com/actuallyakshat/toki/server/internal/store"
)

func i64(n int64) *int64 { return &n }

func TestValidate(t *testing.T) {
	ok := &extract.Capture{Title: "Phone", PriceMinor: 100, Currency: "INR"}
	if err := Validate("INR", ok); err != nil {
		t.Fatal(err)
	}
	bad := map[string]*extract.Capture{
		"nil":      nil,
		"zero":     {Title: "x", PriceMinor: 0, Currency: "INR"},
		"negative": {Title: "x", PriceMinor: -5, Currency: "INR"},
		"currency": {Title: "x", PriceMinor: 5, Currency: "USD"},
		"title":    {Title: "  ", PriceMinor: 5, Currency: "INR"},
	}
	for name, c := range bad {
		if err := Validate("INR", c); err == nil {
			t.Errorf("%s accepted", name)
		}
	}
	if Validate("INR", &extract.Capture{Title: "x", PriceMinor: 5, Currency: "inr"}) != nil {
		t.Error("currency compare must ignore case")
	}
}

func TestDecide(t *testing.T) {
	// Item added at 10000, product was 9000 before this check.
	base := store.Candidate{AddedMinor: 10000, Rule: store.AlertRule{Type: "any_drop"}}
	with := func(f func(*store.Candidate)) store.Candidate { c := base; f(&c); return c }
	chk := func(price int64, stock bool) store.Check { return store.Check{PriceMinor: price, InStock: stock} }

	tests := []struct {
		name  string
		c     store.Candidate
		prev  int64
		prevS bool
		chk   store.Check
		want  string
	}{
		{"any_drop fires", base, 9000, true, chk(8500, true), KindDrop},
		{"any_drop same price", base, 9000, true, chk(9000, true), ""},
		{"any_drop rise", base, 9000, true, chk(9500, true), ""},
		{"any_drop dedupe same alerted price", with(func(c *store.Candidate) { c.LastAlertedMinor = i64(8500) }), 9000, true, chk(8500, true), ""},
		{"any_drop below last alerted", with(func(c *store.Candidate) { c.LastAlertedMinor = i64(8500) }), 8600, true, chk(8400, true), KindDrop},
		{"below_target hit", with(func(c *store.Candidate) { c.Rule.Type = "below_target"; c.TargetMinor = i64(8000) }), 9000, true, chk(8000, true), KindDrop},
		{"below_target miss", with(func(c *store.Candidate) { c.Rule.Type = "below_target"; c.TargetMinor = i64(8000) }), 9000, true, chk(8001, true), ""},
		{"below_target no target", with(func(c *store.Candidate) { c.Rule.Type = "below_target" }), 9000, true, chk(1, true), ""},
		{"below_target fires when already below, once", with(func(c *store.Candidate) {
			c.Rule.Type = "below_target"
			c.TargetMinor = i64(8000)
			c.LastAlertedMinor = i64(7500)
		}), 7500, true, chk(7500, true), ""},
		{"percent_drop hit", with(func(c *store.Candidate) { c.Rule = store.AlertRule{Type: "percent_drop", Percent: 10} }), 9500, true, chk(9000, true), KindDrop},
		{"percent_drop miss", with(func(c *store.Candidate) { c.Rule = store.AlertRule{Type: "percent_drop", Percent: 10} }), 9500, true, chk(9001, true), ""},
		{"back in stock", base, 9000, false, chk(9000, true), KindBackInStock},
		{"still out of stock", base, 9000, false, chk(8000, false), ""},
		{"drop while out of stock", base, 9000, true, chk(8000, false), ""},
		{"drop and back in stock sends drop", base, 9000, false, chk(8000, true), KindDrop},
		{"stayed in stock", base, 9000, true, chk(9000, true), ""},
	}
	for _, tc := range tests {
		if got := Decide(tc.c, tc.prev, tc.prevS, tc.chk); got != tc.want {
			t.Errorf("%s: got %q, want %q", tc.name, got, tc.want)
		}
	}
}

func TestLastDigestSlot(t *testing.T) {
	ist := time.FixedZone("IST", 5*3600+1800)
	tests := []struct{ now, want time.Time }{
		{time.Date(2026, 10, 5, 9, 0, 0, 0, ist), time.Date(2026, 10, 5, 9, 0, 0, 0, ist)},       // Monday 09:00
		{time.Date(2026, 10, 5, 8, 59, 0, 0, ist), time.Date(2026, 9, 28, 9, 0, 0, 0, ist)},      // Monday 08:59
		{time.Date(2026, 10, 2, 12, 0, 0, 0, ist), time.Date(2026, 9, 28, 9, 0, 0, 0, ist)},      // Friday
		{time.Date(2026, 10, 4, 23, 0, 0, 0, time.UTC), time.Date(2026, 9, 28, 9, 0, 0, 0, ist)}, // Monday 04:30 IST, before the slot
	}
	for _, tc := range tests {
		if got := LastDigestSlot(tc.now); !got.Equal(tc.want) {
			t.Errorf("LastDigestSlot(%v) = %v, want %v", tc.now, got, tc.want)
		}
	}
}
