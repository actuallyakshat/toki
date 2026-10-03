package httpapi

import (
	"net/http"
	"strings"

	"github.com/google/uuid"
)

func (s *Server) lists(w http.ResponseWriter, r *http.Request) {
	ls, err := s.store.Lists(r.Context(), userFrom(r).ID)
	if err != nil {
		internal(w, err)
		return
	}
	writeJSON(w, 200, map[string]any{"lists": ls})
}

func validName(s string) bool { n := len([]rune(s)); return n >= 1 && n <= 100 }

// validEmoji accepts an emoji or a list icon name ("i:shopping-basket"). Lucide names run to ~40 characters.
func validEmoji(s string) bool { return len([]rune(s)) <= 64 }

func (s *Server) createList(w http.ResponseWriter, r *http.Request) {
	var in struct{ Name, Emoji string }
	if !decode(w, r, &in) {
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	if !validName(in.Name) || !validEmoji(in.Emoji) {
		invalid(w, "List name must be 1 to 100 characters.")
		return
	}
	l, err := s.store.CreateList(r.Context(), userFrom(r).ID, in.Name, in.Emoji)
	if err != nil {
		internal(w, err)
		return
	}
	writeJSON(w, 201, l)
}

func (s *Server) patchList(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	var in struct{ Name, Emoji, Visibility *string }
	if !decode(w, r, &in) {
		return
	}
	if in.Name != nil {
		n := strings.TrimSpace(*in.Name)
		in.Name = &n
		if !validName(n) {
			invalid(w, "List name must be 1 to 100 characters.")
			return
		}
	}
	if (in.Emoji != nil && !validEmoji(*in.Emoji)) || (in.Visibility != nil && *in.Visibility != "private" && *in.Visibility != "link") {
		invalid(w, "Invalid emoji or visibility.")
		return
	}
	l, err := s.store.UpdateList(r.Context(), userFrom(r).ID, id, in.Name, in.Emoji, in.Visibility)
	if err != nil {
		storeErr(w, err)
		return
	}
	writeJSON(w, 200, l)
}

func (s *Server) deleteList(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	if err := s.store.DeleteList(r.Context(), userFrom(r).ID, id); err != nil {
		storeErr(w, err)
		return
	}
	w.WriteHeader(204)
}

func (s *Server) listItems(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	status := r.URL.Query().Get("status")
	switch status {
	case "":
		status = "wanted"
	case "wanted", "bought", "removed", "all":
	default:
		invalid(w, "status must be wanted, bought, removed or all.")
		return
	}
	u := userFrom(r)
	if _, err := s.store.List(r.Context(), u.ID, id); err != nil {
		storeErr(w, err)
		return
	}
	items, err := s.store.ItemsByList(r.Context(), u.ID, id, status)
	if err != nil {
		internal(w, err)
		return
	}
	writeJSON(w, 200, map[string]any{"items": items})
}

func (s *Server) reorder(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	var in struct {
		ItemIDs []uuid.UUID `json:"item_ids"`
	}
	if !decode(w, r, &in) {
		return
	}
	u := userFrom(r)
	if _, err := s.store.List(r.Context(), u.ID, id); err != nil {
		storeErr(w, err)
		return
	}
	if err := s.store.Reorder(r.Context(), u.ID, id, in.ItemIDs); err != nil {
		internal(w, err)
		return
	}
	w.WriteHeader(204)
}
