package pricecheck

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"github.com/actuallyakshat/toki/server/internal/email"
	"github.com/actuallyakshat/toki/server/internal/extract"
	"github.com/actuallyakshat/toki/server/internal/store"
)

type Service struct {
	Store    *store.Store
	Mail     email.Sender
	AppURL   string
	Interval time.Duration
}

// Apply is the single entry point for check results (extension results and
// captures sent with POST /items). A valid result is recorded and may send
// alerts. An invalid result marks the product failed and changes nothing else.
// It returns whether the result was valid.
func (s *Service) Apply(ctx context.Context, productID uuid.UUID, c *extract.Capture, source string) (bool, error) {
	cur, err := s.Store.ProductCurrency(ctx, productID)
	if err != nil {
		return false, err
	}
	if Validate(cur, c) != nil {
		return false, s.Store.RecordFailure(ctx, productID)
	}
	chk := store.Check{Title: c.Title, ImageURL: c.ImageURL, Currency: cur, PriceMinor: c.PriceMinor, OriginalMinor: c.OriginalPriceMinor, InStock: c.InStock}
	alerts, err := s.Store.RecordCheck(ctx, productID, chk, source, store.NextCheck(s.Interval), Decide)
	if err != nil {
		return false, err
	}
	for _, a := range alerts {
		s.sendAlert(ctx, a, chk)
	}
	return true, nil
}

func (s *Service) sendAlert(ctx context.Context, a store.Alert, chk store.Check) {
	it := email.Item{Title: a.Product.Title, ImageURL: a.Product.ImageURL, URL: a.Product.URL, Currency: chk.Currency, OldMinor: a.OldMinor, NewMinor: chk.PriceMinor}
	var msg email.Message
	if a.Kind == KindBackInStock {
		msg = email.BackInStock(s.AppURL, a.Email, a.Name, it)
	} else {
		msg = email.Drop(s.AppURL, a.Email, a.Name, it)
	}
	if err := s.Mail.Send(ctx, msg); err != nil {
		slog.Error("send alert", "to", a.Email, "err", err)
		return
	}
	price := chk.PriceMinor
	if err := s.Store.LogEmail(ctx, a.UserID, &a.ItemID, a.Kind, &price); err != nil {
		slog.Error("log email", "err", err)
	}
}
