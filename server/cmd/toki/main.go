// Command toki runs the Toki API server. Subcommands: serve (default), seed, migrate.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/actuallyakshat/toki/server/internal/config"
	"github.com/actuallyakshat/toki/server/internal/email"
	"github.com/actuallyakshat/toki/server/internal/extract"
	"github.com/actuallyakshat/toki/server/internal/httpapi"
	"github.com/actuallyakshat/toki/server/internal/pricecheck"
	"github.com/actuallyakshat/toki/server/internal/store"
)

func main() {
	time.Local = time.UTC // JSON timestamps are UTC
	cmd := "serve"
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}
	if err := run(cmd); err != nil {
		slog.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run(cmd string) error {
	cfg := config.Load()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	st, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer st.Close()
	if err := st.Migrate(ctx); err != nil {
		return err
	}

	switch cmd {
	case "migrate":
		slog.Info("migrations applied")
		return nil
	case "seed":
		if err := st.Seed(ctx); err != nil {
			return err
		}
		slog.Info("seeded demo data", "email", store.DemoEmail, "password", store.DemoPassword)
		return nil
	case "serve":
		return serve(ctx, cfg, st)
	}
	return errors.New("unknown command " + cmd + " (use serve, seed or migrate)")
}

func serve(ctx context.Context, cfg config.Config, st *store.Store) error {
	svc := &pricecheck.Service{Store: st, Mail: email.New(cfg.ResendAPIKey, cfg.EmailFrom), AppURL: cfg.AppURL, Interval: cfg.CheckInterval}
	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           httpapi.New(cfg, st, svc, extract.NewFetcher()),
		ReadHeaderTimeout: 10 * time.Second,
		WriteTimeout:      60 * time.Second,
	}

	var wg sync.WaitGroup
	if cfg.WorkerEnabled {
		wg.Add(1)
		go func() { defer wg.Done(); svc.RunDigests(ctx) }()
	}
	errc := make(chan error, 1)
	go func() { errc <- srv.ListenAndServe() }()
	slog.Info("listening", "addr", srv.Addr, "worker", cfg.WorkerEnabled)

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}
	slog.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	err := srv.Shutdown(shutdownCtx)
	wg.Wait()
	return err // the deferred st.Close() closes the pool
}
