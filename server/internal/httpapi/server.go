// Package httpapi implements the /api routes from CONTRACT.md.
package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"runtime/debug"
	"slices"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/actuallyakshat/toki/server/internal/auth"
	"github.com/actuallyakshat/toki/server/internal/config"
	"github.com/actuallyakshat/toki/server/internal/extract"
	"github.com/actuallyakshat/toki/server/internal/pricecheck"
	"github.com/actuallyakshat/toki/server/internal/store"
)

type Server struct {
	cfg   config.Config
	store *store.Store
	check *pricecheck.Service
	fetch *extract.Fetcher
}

func New(cfg config.Config, st *store.Store, check *pricecheck.Service, fetch *extract.Fetcher) http.Handler {
	s := &Server{cfg: cfg, store: st, check: check, fetch: fetch}
	r := chi.NewRouter()
	r.Use(recoverer, s.cors, logRequests)
	r.NotFound(func(w http.ResponseWriter, _ *http.Request) { writeErr(w, 404, "not_found", "Route not found.") })
	r.MethodNotAllowed(func(w http.ResponseWriter, _ *http.Request) { writeErr(w, 405, "not_found", "Method not allowed.") })

	r.Route("/api", func(r chi.Router) {
		r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) { writeJSON(w, 200, map[string]bool{"ok": true}) })
		r.Post("/auth/signup", s.signup)
		r.Post("/auth/login", s.login)
		r.Post("/auth/token", s.token)
		r.Get("/public/lists/{slug}", s.publicList)

		r.Group(func(r chi.Router) {
			r.Use(s.requireAuth)
			r.Post("/auth/logout", s.logout)
			r.Get("/me", s.me)
			r.Patch("/me/profile", s.patchProfile)

			r.Get("/lists", s.lists)
			r.Post("/lists", s.createList)
			r.Patch("/lists/{id}", s.patchList)
			r.Delete("/lists/{id}", s.deleteList)
			r.Get("/lists/{id}/items", s.listItems)
			r.Post("/lists/{id}/reorder", s.reorder)

			r.Post("/items", s.createItem)
			r.Patch("/items/{id}", s.patchItem)
			r.Delete("/items/{id}", s.deleteItem)
			r.Get("/items/{id}/history", s.history)
			r.Post("/items/{id}/refresh", s.refresh)
			r.Post("/extract", s.extractURL)

			r.Get("/extension/refresh-tasks", s.refreshTasks)
			r.Post("/extension/refresh-results", s.refreshResults)
			r.Get("/stats", s.stats)
		})
	})
	return r
}

// --- helpers ---------------------------------------------------------------

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}

func writeErr(w http.ResponseWriter, status int, code, msg string) {
	writeJSON(w, status, map[string]any{"error": map[string]string{"code": code, "message": msg}})
}

func invalid(w http.ResponseWriter, msg string) { writeErr(w, 422, "validation_failed", msg) }

func internal(w http.ResponseWriter, err error) {
	slog.Error("request failed", "err", err)
	writeErr(w, 500, "internal", "Something went wrong.")
}

func notFound(w http.ResponseWriter) { writeErr(w, 404, "not_found", "Not found.") }

// storeErr maps store errors to responses.
func storeErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		notFound(w)
	case errors.Is(err, store.ErrConflict):
		invalid(w, "That item is already in the target list.")
	case errors.Is(err, store.ErrLastList):
		invalid(w, "You cannot delete your last list.")
	default:
		internal(w, err)
	}
}

func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		invalid(w, "Request body must be valid JSON.")
		return false
	}
	return true
}

func pathID(w http.ResponseWriter, r *http.Request, name string) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, name))
	if err != nil {
		notFound(w)
		return uuid.Nil, false
	}
	return id, true
}

// --- middleware ------------------------------------------------------------

type ctxKey struct{}

func userFrom(r *http.Request) store.User { return r.Context().Value(ctxKey{}).(store.User) }

func sessionToken(r *http.Request) string {
	if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
		return strings.TrimSpace(h[7:])
	}
	if c, err := r.Cookie(auth.CookieName); err == nil {
		return c.Value
	}
	return ""
}

func (s *Server) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tok := sessionToken(r)
		if tok == "" {
			writeErr(w, 401, "unauthorized", "Sign in to continue.")
			return
		}
		u, err := s.store.UserBySession(r.Context(), auth.HashToken(tok))
		if errors.Is(err, store.ErrNotFound) {
			writeErr(w, 401, "unauthorized", "Your session has expired. Sign in again.")
			return
		}
		if err != nil {
			internal(w, err)
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, u)))
	})
}

func recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				slog.Error("panic", "value", v, "stack", string(debug.Stack()))
				writeErr(w, 500, "internal", "Something went wrong.")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(c int) { w.status = c; w.ResponseWriter.WriteHeader(c) }

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(sw, r)
		slog.Info("request", "method", r.Method, "path", r.URL.Path, "status", sw.status, "ms", time.Since(start).Milliseconds())
	})
}

// cors allows the configured extension origins. Web traffic is same-origin.
func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if o := r.Header.Get("Origin"); o != "" && slices.Contains(s.cfg.ExtensionOrigins, o) {
			h := w.Header()
			h.Set("Access-Control-Allow-Origin", o)
			h.Set("Vary", "Origin")
			h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			h.Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
			if r.Method == http.MethodOptions {
				w.WriteHeader(204)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
