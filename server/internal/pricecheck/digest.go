package pricecheck

import (
	"context"
	"log/slog"
	"time"

	"github.com/actuallyakshat/toki/server/internal/email"
)

var ist = time.FixedZone("IST", 5*3600+1800)

// LastDigestSlot returns the most recent Monday 09:00 Asia/Kolkata at or before now.
func LastDigestSlot(now time.Time) time.Time {
	t := now.In(ist)
	slot := time.Date(t.Year(), t.Month(), t.Day(), 9, 0, 0, 0, ist)
	slot = slot.AddDate(0, 0, -((int(slot.Weekday()) + 6) % 7)) // back to Monday
	if slot.After(t) {
		slot = slot.AddDate(0, 0, -7)
	}
	return slot
}

// RunDigests is the in-process background job. It checks every 10 minutes
// whether digest users are owed this week's email. It returns when ctx ends.
func (s *Service) RunDigests(ctx context.Context) {
	tick := time.NewTicker(10 * time.Minute)
	defer tick.Stop()
	for {
		s.sendDigests(ctx, time.Now())
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
		}
	}
}

func (s *Service) sendDigests(ctx context.Context, now time.Time) {
	slot := LastDigestSlot(now)
	users, err := s.Store.DigestUsers(ctx, slot)
	if err != nil {
		slog.Error("digest users", "err", err)
		return
	}
	for _, u := range users {
		drops, err := s.Store.DigestDrops(ctx, u.ID, slot.AddDate(0, 0, -7))
		if err != nil {
			slog.Error("digest drops", "err", err)
			continue
		}
		kind := "digest_empty"
		if len(drops) > 0 {
			items := make([]email.Item, len(drops))
			for i, d := range drops {
				items[i] = email.Item{Title: d.Product.Title, ImageURL: d.Product.ImageURL, URL: d.Product.URL,
					Currency: d.Product.Currency, OldMinor: d.OldMinor, NewMinor: d.Product.CurrentPriceMinor}
			}
			if err := s.Mail.Send(ctx, email.Digest(s.AppURL, u.Email, u.Name, items)); err != nil {
				slog.Error("send digest", "to", u.Email, "err", err)
				continue
			}
			kind = "digest"
		}
		if err := s.Store.LogEmail(ctx, u.ID, nil, kind, nil); err != nil {
			slog.Error("log digest", "err", err)
		}
	}
}
