// Package pricecheck validates price check results, evaluates alerts and
// sends emails. Results come from extensions; the server only runs the
// weekly digest job in the background.
package pricecheck

import (
	"errors"
	"strings"

	"github.com/actuallyakshat/toki/server/internal/extract"
	"github.com/actuallyakshat/toki/server/internal/store"
)

var ErrInvalidResult = errors.New("invalid price check result")

// Validate applies the contract rules: price > 0, same currency, non-empty title.
func Validate(productCurrency string, c *extract.Capture) error {
	switch {
	case c == nil:
		return errors.Join(ErrInvalidResult, errors.New("no capture"))
	case c.PriceMinor <= 0:
		return errors.Join(ErrInvalidResult, errors.New("price must be greater than 0"))
	case !strings.EqualFold(c.Currency, productCurrency):
		return errors.Join(ErrInvalidResult, errors.New("currency does not match the product"))
	case strings.TrimSpace(c.Title) == "":
		return errors.Join(ErrInvalidResult, errors.New("title is empty"))
	}
	return nil
}

const (
	KindDrop        = "drop"
	KindBackInStock = "back_in_stock"
)

// Decide returns the alert kind for one wanted item, or "". Drops need the
// product in stock and a price below the last alerted price; back_in_stock
// fires when stock goes from false to true.
func Decide(c store.Candidate, prevPrice int64, prevInStock bool, chk store.Check) string {
	if chk.InStock && isDrop(c, prevPrice, chk.PriceMinor) &&
		(c.LastAlertedMinor == nil || chk.PriceMinor < *c.LastAlertedMinor) {
		return KindDrop
	}
	if chk.InStock && !prevInStock {
		return KindBackInStock
	}
	return ""
}

func isDrop(c store.Candidate, prev, price int64) bool {
	switch c.Rule.Type {
	case "below_target":
		return c.TargetMinor != nil && price <= *c.TargetMinor
	case "percent_drop":
		p := int64(c.Rule.Percent)
		return p > 0 && p < 100 && price*100 <= c.AddedMinor*(100-p)
	default: // any_drop
		return price < prev
	}
}
