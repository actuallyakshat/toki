package httpapi_test

import (
	"io"
	"log/slog"
	"os"
	"testing"
)

// TestMain silences request logs; run with -v and TOKI_TEST_LOGS=1 to see them.
func TestMain(m *testing.M) {
	if os.Getenv("TOKI_TEST_LOGS") == "" {
		slog.SetDefault(slog.New(slog.NewTextHandler(io.Discard, nil)))
	}
	os.Exit(m.Run())
}
