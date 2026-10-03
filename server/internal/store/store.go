// Package store holds all SQL. Handlers and workers call these methods only.
package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand/v2"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"github.com/actuallyakshat/toki/server/migrations"
)

var (
	ErrNotFound   = errors.New("not found")
	ErrEmailTaken = errors.New("email taken")
	ErrConflict   = errors.New("already exists")
	ErrLastList   = errors.New("cannot delete the last list")
)

type Store struct{ Pool *pgxpool.Pool }

func Open(ctx context.Context, url string) (*Store, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, err
	}
	cfg.MaxConns = 8
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &Store{Pool: pool}, nil
}

func (s *Store) Close() { s.Pool.Close() }

// Migrate applies the embedded goose migrations.
func (s *Store) Migrate(ctx context.Context) error {
	db := stdlib.OpenDBFromPool(s.Pool)
	defer db.Close()
	goose.SetBaseFS(migrations.FS)
	if err := goose.SetDialect("postgres"); err != nil {
		return err
	}
	return goose.UpContext(ctx, db, ".")
}

func newID() uuid.UUID {
	id, err := uuid.NewV7()
	if err != nil {
		panic(err)
	}
	return id
}

const slugAlphabet = "abcdefghijkmnpqrstuvwxyz23456789"

func newSlug() string {
	b := make([]byte, 8)
	for i := range b {
		b[i] = slugAlphabet[rand.IntN(len(slugAlphabet))]
	}
	return string(b)
}

func isUnique(err error) bool {
	var pg *pgconn.PgError
	return errors.As(err, &pg) && pg.Code == "23505"
}

func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

// NextCheck returns now + interval with ±20% jitter.
func NextCheck(interval time.Duration) time.Time {
	j := 0.8 + rand.Float64()*0.4
	return time.Now().Add(time.Duration(float64(interval) * j))
}

func (s *Store) tx(ctx context.Context, fn func(pgx.Tx) error) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func errf(op string, err error) error { return fmt.Errorf("%s: %w", op, err) }

func parseRule(raw []byte) AlertRule {
	var r AlertRule
	if json.Unmarshal(raw, &r) != nil || r.Type == "" {
		r.Type = "any_drop"
	}
	return r
}
