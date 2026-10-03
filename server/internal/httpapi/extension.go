package httpapi

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/actuallyakshat/toki/server/internal/extract"
)

func (s *Server) refreshTasks(w http.ResponseWriter, r *http.Request) {
	limit := 5
	if v := r.URL.Query().Get("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 20 {
			invalid(w, "limit must be between 1 and 20.")
			return
		}
		limit = n
	}
	tasks, err := s.store.LeaseTasks(r.Context(), userFrom(r).ID, limit)
	if err != nil {
		internal(w, err)
		return
	}
	writeJSON(w, 200, map[string]any{"tasks": tasks})
}

// refreshResults applies extension fetch results. Results for products the
// user does not track are ignored. `accepted` counts applied results,
// including error reports that were recorded as failed checks.
func (s *Server) refreshResults(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Results []struct {
			ProductID uuid.UUID        `json:"product_id"`
			Capture   *extract.Capture `json:"capture"`
			Error     string           `json:"error"`
		} `json:"results"`
	}
	if !decode(w, r, &in) {
		return
	}
	if len(in.Results) > 50 {
		invalid(w, "Send at most 50 results at once.")
		return
	}
	u, accepted := userFrom(r), 0
	for _, res := range in.Results {
		tracked, err := s.store.UserTracksProduct(r.Context(), u.ID, res.ProductID)
		if err != nil {
			internal(w, err)
			return
		}
		if !tracked {
			continue
		}
		if _, err := s.check.Apply(r.Context(), res.ProductID, res.Capture, "extension"); err != nil {
			internal(w, err)
			return
		}
		accepted++
	}
	writeJSON(w, 200, map[string]int{"accepted": accepted})
}

func (s *Server) stats(w http.ResponseWriter, r *http.Request) {
	st, err := s.store.Stats(r.Context(), userFrom(r).ID)
	if err != nil {
		storeErr(w, err)
		return
	}
	writeJSON(w, 200, st)
}

func (s *Server) publicList(w http.ResponseWriter, r *http.Request) {
	l, owner, err := s.store.PublicList(r.Context(), chi.URLParam(r, "slug"))
	if err != nil {
		storeErr(w, err)
		return
	}
	items, err := s.store.PublicItems(r.Context(), l.ID)
	if err != nil {
		internal(w, err)
		return
	}
	out := make([]map[string]any, len(items))
	for i, it := range items {
		b, _ := json.Marshal(it)
		var m map[string]any
		_ = json.Unmarshal(b, &m)
		delete(m, "note")
		delete(m, "alert_rule")
		delete(m, "target_price_minor")
		out[i] = m
	}
	writeJSON(w, 200, map[string]any{
		"list":  map[string]string{"name": l.Name, "emoji": l.Emoji, "owner_name": owner},
		"items": out,
	})
}
