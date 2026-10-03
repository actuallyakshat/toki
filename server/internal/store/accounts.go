package store

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (s *Store) CreateUser(ctx context.Context, email, name, passwordHash string) (User, error) {
	u := User{ID: newID(), Email: email, Name: name}
	err := s.tx(ctx, func(tx pgx.Tx) error {
		if err := tx.QueryRow(ctx,
			`INSERT INTO users (id, email, name, password_hash) VALUES ($1,$2,$3,$4) RETURNING created_at`,
			u.ID, email, name, passwordHash).Scan(&u.CreatedAt); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO profiles (user_id) VALUES ($1)`, u.ID); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `INSERT INTO lists (id, user_id, name, emoji, share_slug) VALUES ($1,$2,'Wishlist','✨',$3)`,
			newID(), u.ID, newSlug())
		return err
	})
	if isUnique(err) {
		return User{}, ErrEmailTaken
	}
	return u, err
}

// UserWithHash returns the user and password hash for a login attempt.
func (s *Store) UserWithHash(ctx context.Context, email string) (User, string, error) {
	var u User
	var hash string
	err := s.Pool.QueryRow(ctx, `SELECT id, email, name, created_at, password_hash FROM users WHERE email=$1`, email).
		Scan(&u.ID, &u.Email, &u.Name, &u.CreatedAt, &hash)
	return u, hash, notFound(err)
}

func (s *Store) CreateSession(ctx context.Context, userID uuid.UUID, tokenHash []byte, expires time.Time) error {
	_, err := s.Pool.Exec(ctx, `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1,$2,$3)`, tokenHash, userID, expires)
	return err
}

func (s *Store) UserBySession(ctx context.Context, tokenHash []byte) (User, error) {
	var u User
	err := s.Pool.QueryRow(ctx, `SELECT u.id, u.email, u.name, u.created_at FROM sessions s JOIN users u ON u.id=s.user_id
		WHERE s.token_hash=$1 AND s.expires_at > now()`, tokenHash).Scan(&u.ID, &u.Email, &u.Name, &u.CreatedAt)
	return u, notFound(err)
}

func (s *Store) DeleteSession(ctx context.Context, tokenHash []byte) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM sessions WHERE token_hash=$1`, tokenHash)
	return err
}

func (s *Store) Profile(ctx context.Context, userID uuid.UUID) (Profile, error) {
	var p Profile
	err := s.Pool.QueryRow(ctx, `SELECT currency, monthly_income_minor, hours_per_week, income_storage, alert_mode, email_alerts
		FROM profiles WHERE user_id=$1`, userID).
		Scan(&p.Currency, &p.MonthlyIncomeMinor, &p.HoursPerWeek, &p.IncomeStorage, &p.AlertMode, &p.EmailAlerts)
	return p, notFound(err)
}

func (s *Store) SetProfile(ctx context.Context, userID uuid.UUID, p Profile) error {
	_, err := s.Pool.Exec(ctx, `UPDATE profiles SET currency=$2, monthly_income_minor=$3, hours_per_week=$4,
		income_storage=$5, alert_mode=$6, email_alerts=$7 WHERE user_id=$1`,
		userID, p.Currency, p.MonthlyIncomeMinor, p.HoursPerWeek, p.IncomeStorage, p.AlertMode, p.EmailAlerts)
	return err
}
