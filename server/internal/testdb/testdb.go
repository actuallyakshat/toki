// Package testdb gives tests a migrated, isolated Postgres schema.
//
// Set TEST_DATABASE_URL to a database the tests may write to, for example
// postgres://toki:toki@localhost:5433/toki_test?sslmode=disable. Each call to
// New creates a fresh schema, runs the migrations in it and drops it when the
// test ends, so tests can run in parallel. Without TEST_DATABASE_URL the
// calling test is skipped (CI sets it, so skips there mean a broken setup).
package testdb

import (
	"context"
	"fmt"
	"math/rand/v2"
	"net/url"
	"os"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/pressly/goose/v3"

	"github.com/actuallyakshat/toki/server/internal/store"
)

const EnvVar = "TEST_DATABASE_URL"

// migrateMu serialises Migrate: goose keeps its settings in globals.
var migrateMu sync.Mutex

// New returns a Store connected to a new, migrated schema.
func New(t testing.TB) *store.Store {
	t.Helper()
	base := os.Getenv(EnvVar)
	if base == "" {
		if os.Getenv("CI") != "" {
			t.Fatalf("%s is not set", EnvVar)
		}
		t.Skipf("%s is not set; skipping database test", EnvVar)
	}
	ctx := context.Background()
	schema := fmt.Sprintf("test_%d", rand.Uint64())

	admin, err := pgx.Connect(ctx, base)
	if err != nil {
		t.Fatalf("connect to %s: %v", EnvVar, err)
	}
	defer admin.Close(ctx)
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatalf("create schema: %v", err)
	}
	t.Cleanup(func() {
		c, err := pgx.Connect(context.Background(), base)
		if err != nil {
			t.Logf("cleanup connect: %v", err)
			return
		}
		defer c.Close(context.Background())
		if _, err := c.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE"); err != nil {
			t.Logf("drop schema %s: %v", schema, err)
		}
	})

	u, err := url.Parse(base)
	if err != nil {
		t.Fatalf("parse %s: %v", EnvVar, err)
	}
	q := u.Query()
	q.Set("search_path", schema)
	u.RawQuery = q.Encode()

	st, err := store.Open(ctx, u.String())
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(st.Close)
	migrateMu.Lock()
	goose.SetLogger(goose.NopLogger())
	err = st.Migrate(ctx)
	migrateMu.Unlock()
	if err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return st
}
