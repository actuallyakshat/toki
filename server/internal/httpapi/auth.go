package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/actuallyakshat/toki/server/internal/auth"
	"github.com/actuallyakshat/toki/server/internal/store"
)

type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

func (s *Server) startSession(w http.ResponseWriter, r *http.Request, u store.User, setCookie bool) (string, bool) {
	tok, hash := auth.NewToken()
	if err := s.store.CreateSession(r.Context(), u.ID, hash, time.Now().Add(auth.SessionTTL)); err != nil {
		internal(w, err)
		return "", false
	}
	if setCookie {
		http.SetCookie(w, &http.Cookie{Name: auth.CookieName, Value: tok, Path: "/", MaxAge: int(auth.SessionTTL.Seconds()),
			HttpOnly: true, SameSite: http.SameSiteLaxMode, Secure: s.cfg.SessionSecure})
	}
	return tok, true
}

func (s *Server) signup(w http.ResponseWriter, r *http.Request) {
	var in credentials
	if !decode(w, r, &in) {
		return
	}
	email, ok := auth.NormalizeEmail(in.Email)
	if !ok {
		invalid(w, "Enter a valid email address.")
		return
	}
	if len(in.Password) < 8 || len(in.Password) > 72 {
		invalid(w, "Password must be 8 to 72 characters.")
		return
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		name, _, _ = strings.Cut(email, "@")
	}
	if len([]rune(name)) > 100 {
		invalid(w, "Name is too long.")
		return
	}
	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		internal(w, err)
		return
	}
	u, err := s.store.CreateUser(r.Context(), email, name, hash)
	if errors.Is(err, store.ErrEmailTaken) {
		writeErr(w, 409, "email_taken", "An account with this email already exists.")
		return
	}
	if err != nil {
		internal(w, err)
		return
	}
	if _, ok := s.startSession(w, r, u, true); ok {
		writeJSON(w, 201, map[string]any{"user": u})
	}
}

// verify checks credentials; it writes the error response itself.
func (s *Server) verify(w http.ResponseWriter, r *http.Request) (store.User, bool) {
	var in credentials
	if !decode(w, r, &in) {
		return store.User{}, false
	}
	email, _ := auth.NormalizeEmail(in.Email)
	u, hash, err := s.store.UserWithHash(r.Context(), email)
	if errors.Is(err, store.ErrNotFound) {
		auth.DummyCheck(in.Password)
		writeErr(w, 401, "invalid_credentials", "Email or password is wrong.")
		return u, false
	}
	if err != nil {
		internal(w, err)
		return u, false
	}
	if !auth.CheckPassword(hash, in.Password) {
		writeErr(w, 401, "invalid_credentials", "Email or password is wrong.")
		return u, false
	}
	return u, true
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	u, ok := s.verify(w, r)
	if !ok {
		return
	}
	if _, ok := s.startSession(w, r, u, true); ok {
		writeJSON(w, 200, map[string]any{"user": u})
	}
}

func (s *Server) token(w http.ResponseWriter, r *http.Request) {
	u, ok := s.verify(w, r)
	if !ok {
		return
	}
	if tok, ok := s.startSession(w, r, u, false); ok {
		writeJSON(w, 200, map[string]any{"token": tok, "user": u})
	}
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteSession(r.Context(), auth.HashToken(sessionToken(r))); err != nil {
		internal(w, err)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: auth.CookieName, Value: "", Path: "/", MaxAge: -1, HttpOnly: true,
		SameSite: http.SameSiteLaxMode, Secure: s.cfg.SessionSecure})
	w.WriteHeader(204)
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	u := userFrom(r)
	p, err := s.store.Profile(r.Context(), u.ID)
	if err != nil {
		storeErr(w, err)
		return
	}
	writeJSON(w, 200, map[string]any{"user": u, "profile": p})
}

func (s *Server) patchProfile(w http.ResponseWriter, r *http.Request) {
	u := userFrom(r)
	var raw map[string]json.RawMessage
	if !decode(w, r, &raw) {
		return
	}
	p, err := s.store.Profile(r.Context(), u.ID)
	if err != nil {
		storeErr(w, err)
		return
	}
	for k, v := range raw {
		var err error
		switch k {
		case "currency":
			err = json.Unmarshal(v, &p.Currency)
			if len(p.Currency) != 3 {
				err = errors.New("bad currency")
			}
			p.Currency = strings.ToUpper(p.Currency)
		case "monthly_income_minor":
			err = json.Unmarshal(v, &p.MonthlyIncomeMinor)
			if err == nil && p.MonthlyIncomeMinor != nil && *p.MonthlyIncomeMinor < 0 {
				err = errors.New("negative")
			}
		case "hours_per_week":
			err = json.Unmarshal(v, &p.HoursPerWeek)
			if err == nil && p.HoursPerWeek != nil && (*p.HoursPerWeek < 1 || *p.HoursPerWeek > 168) {
				err = errors.New("range")
			}
		case "income_storage":
			err = json.Unmarshal(v, &p.IncomeStorage)
			if p.IncomeStorage != "server" && p.IncomeStorage != "device" {
				err = errors.New("bad storage")
			}
		case "alert_mode":
			err = json.Unmarshal(v, &p.AlertMode)
			if p.AlertMode != "instant" && p.AlertMode != "digest" {
				err = errors.New("bad mode")
			}
		case "email_alerts":
			err = json.Unmarshal(v, &p.EmailAlerts)
		}
		if err != nil {
			invalid(w, "Invalid value for "+k+".")
			return
		}
	}
	if p.IncomeStorage == "device" {
		p.MonthlyIncomeMinor = nil // device-only income is never stored on the server
	}
	if err := s.store.SetProfile(r.Context(), u.ID, p); err != nil {
		internal(w, err)
		return
	}
	writeJSON(w, 200, map[string]any{"profile": p})
}
