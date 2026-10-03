package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/actuallyakshat/toki/server/internal/extract"
	"github.com/actuallyakshat/toki/server/internal/pricecheck"
	"github.com/actuallyakshat/toki/server/internal/store"
)

// extractErr writes the response for a failed extraction or fetch.
func extractErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, extract.ErrUnsupportedURL):
		writeErr(w, 422, "unsupported_url", "Enter a full product link that starts with http:// or https://.")
	case errors.Is(err, extract.ErrBlocked):
		writeErr(w, 422, "extract_failed", "The store blocked the request. Add the item with the Toki extension instead.")
	case errors.Is(err, extract.ErrNotFound):
		writeErr(w, 422, "extract_failed", "The store says this page does not exist.")
	case errors.Is(err, extract.ErrNoPrice):
		writeErr(w, 422, "extract_failed", "Toki could not find a price on that page.")
	default:
		writeErr(w, 422, "extract_failed", "Toki could not read that page.")
	}
}

func (s *Server) extractURL(w http.ResponseWriter, r *http.Request) {
	var in struct {
		URL string `json:"url"`
	}
	if !decode(w, r, &in) {
		return
	}
	c, err := s.fetch.Fetch(r.Context(), in.URL)
	if err != nil {
		extractErr(w, err)
		return
	}
	writeJSON(w, 200, map[string]any{"capture": c})
}

type createItemReq struct {
	URL              string           `json:"url"`
	ListID           *uuid.UUID       `json:"list_id"`
	Capture          *extract.Capture `json:"capture"`
	TargetPriceMinor *int64           `json:"target_price_minor"`
}

func (s *Server) createItem(w http.ResponseWriter, r *http.Request) {
	ctx, u := r.Context(), userFrom(r)
	var in createItemReq
	if !decode(w, r, &in) {
		return
	}
	if in.TargetPriceMinor != nil && *in.TargetPriceMinor <= 0 {
		invalid(w, "target_price_minor must be greater than 0.")
		return
	}
	rawURL := in.URL
	if rawURL == "" && in.Capture != nil {
		rawURL = in.Capture.SourceURL
	}
	canonical, retailer, err := extract.Canonicalize(rawURL)
	if err != nil {
		extractErr(w, err)
		return
	}
	var listID uuid.UUID
	if in.ListID != nil {
		if _, err := s.store.List(ctx, u.ID, *in.ListID); err != nil {
			storeErr(w, err)
			return
		}
		listID = *in.ListID
	} else if listID, err = s.store.DefaultListID(ctx, u.ID); err != nil {
		storeErr(w, err)
		return
	}
	if c := in.Capture; c != nil {
		c.Currency = strings.ToUpper(strings.TrimSpace(c.Currency))
		if c.PriceMinor <= 0 || len(c.Currency) != 3 || strings.TrimSpace(c.Title) == "" {
			invalid(w, "capture needs a title, a positive price_minor and a 3-letter currency.")
			return
		}
		if retailer == extract.RetailerGeneric && c.Retailer == extract.RetailerShopify {
			retailer = extract.RetailerShopify
		}
	}

	prod, err := s.store.ProductByURL(ctx, canonical)
	switch {
	case errors.Is(err, store.ErrNotFound):
		prod, err = s.newProduct(ctx, canonical, retailer, in.URL, in.Capture)
		if err != nil {
			var fe *fetchError
			if errors.As(err, &fe) {
				extractErr(w, fe.err)
			} else {
				internal(w, err)
			}
			return
		}
	case err != nil:
		internal(w, err)
		return
	case in.Capture != nil && pricecheck.Validate(prod.Currency, in.Capture) == nil:
		// The capture is a fresh price for a shared product: record it for everyone.
		if _, err := s.check.Apply(ctx, prod.ID, in.Capture, "extension"); err != nil {
			internal(w, err)
			return
		}
		prod.CurrentPriceMinor = in.Capture.PriceMinor
	}

	if existing, err := s.store.ItemByProduct(ctx, listID, prod.ID); err == nil {
		if existing.Status == "removed" {
			existing, err = s.store.UpdateItem(ctx, u.ID, existing.ID, map[string]any{"status": "wanted"})
			if err != nil {
				storeErr(w, err)
				return
			}
		}
		writeJSON(w, 200, existing)
		return
	} else if !errors.Is(err, store.ErrNotFound) {
		internal(w, err)
		return
	}

	rule := json.RawMessage(`{"type":"any_drop"}`)
	if in.TargetPriceMinor != nil {
		rule = json.RawMessage(`{"type":"below_target"}`)
	}
	it, err := s.store.AddItem(ctx, store.NewItem{UserID: u.ID, ListID: listID, ProductID: prod.ID,
		AddedPriceMinor: prod.CurrentPriceMinor, TargetPriceMinor: in.TargetPriceMinor, AlertRule: rule})
	if err != nil {
		storeErr(w, err)
		return
	}
	writeJSON(w, 201, it)
}

type fetchError struct{ err error }

func (e *fetchError) Error() string { return e.err.Error() }

// newProduct creates a product from the capture, or from a one-off server fetch.
func (s *Server) newProduct(ctx context.Context, canonical, retailer, rawURL string, c *extract.Capture) (store.Product, error) {
	source := "extension"
	if c == nil {
		var err error
		if c, err = s.fetch.Fetch(ctx, rawURL); err != nil {
			return store.Product{}, &fetchError{err}
		}
		retailer, source = c.Retailer, "fetch"
	}
	return s.store.CreateProduct(ctx, store.NewProduct{
		URL: canonical, Retailer: retailer, Title: strings.TrimSpace(c.Title), ImageURL: c.ImageURL, Currency: c.Currency,
		PriceMinor: c.PriceMinor, OriginalMinor: c.OriginalPriceMinor, InStock: c.InStock,
		NextCheckAt: time.Now().Add(s.cfg.CheckInterval), Source: source,
	})
}

func (s *Server) patchItem(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	u := userFrom(r)
	var raw map[string]json.RawMessage
	if !decode(w, r, &raw) {
		return
	}
	fields := map[string]any{}
	for k, v := range raw {
		var err error
		switch k {
		case "target_price_minor":
			var t *int64
			if err = json.Unmarshal(v, &t); err == nil && t != nil && *t <= 0 {
				err = errors.New("must be positive")
			}
			fields[k] = t
		case "alert_rule":
			var rule store.AlertRule
			if err = json.Unmarshal(v, &rule); err == nil {
				switch rule.Type {
				case "any_drop", "below_target":
					rule.Percent = 0
				case "percent_drop":
					if rule.Percent < 1 || rule.Percent > 99 {
						err = errors.New("percent must be 1 to 99")
					}
				default:
					err = errors.New("unknown rule type")
				}
			}
			b, _ := json.Marshal(rule)
			fields[k] = b
		case "note":
			var n string
			if err = json.Unmarshal(v, &n); err == nil && len([]rune(n)) > 1000 {
				err = errors.New("too long")
			}
			fields[k] = n
		case "status":
			var st string
			if err = json.Unmarshal(v, &st); err == nil && st != "wanted" && st != "bought" && st != "removed" {
				err = errors.New("bad status")
			}
			fields[k] = st
		case "cooling_until":
			var t *time.Time
			err = json.Unmarshal(v, &t)
			fields[k] = t
		case "list_id":
			var l uuid.UUID
			if err = json.Unmarshal(v, &l); err == nil {
				if _, lerr := s.store.List(r.Context(), u.ID, l); lerr != nil {
					err = lerr
				}
			}
			fields[k] = l
		}
		if err != nil {
			invalid(w, "Invalid value for "+k+".")
			return
		}
	}
	it, err := s.store.UpdateItem(r.Context(), u.ID, id, fields)
	if err != nil {
		storeErr(w, err)
		return
	}
	writeJSON(w, 200, it)
}

func (s *Server) deleteItem(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	if err := s.store.DeleteItem(r.Context(), userFrom(r).ID, id); err != nil {
		storeErr(w, err)
		return
	}
	w.WriteHeader(204)
}

func (s *Server) history(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	days := 90
	if v := r.URL.Query().Get("days"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 3650 {
			invalid(w, "days must be between 1 and 3650.")
			return
		}
		days = n
	}
	u := userFrom(r)
	if _, err := s.store.Item(r.Context(), u.ID, id); err != nil {
		storeErr(w, err)
		return
	}
	pts, err := s.store.History(r.Context(), u.ID, id, days)
	if err != nil {
		internal(w, err)
		return
	}
	writeJSON(w, 200, map[string]any{"points": pts})
}

// refresh does not fetch. It makes the product due so the next extension poll takes it.
func (s *Server) refresh(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	u := userFrom(r)
	if err := s.store.RequestRefresh(r.Context(), u.ID, id); err != nil {
		storeErr(w, err)
		return
	}
	it, err := s.store.Item(r.Context(), u.ID, id)
	if err != nil {
		storeErr(w, err)
		return
	}
	writeJSON(w, 200, it)
}
