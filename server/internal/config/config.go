// Package config reads server settings from the environment.
package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	DatabaseURL      string
	Port             string
	AppURL           string
	SessionSecure    bool
	ResendAPIKey     string
	EmailFrom        string
	WorkerEnabled    bool
	CheckInterval    time.Duration
	ExtensionOrigins []string
}

func Load() Config {
	c := Config{
		DatabaseURL:   env("DATABASE_URL", "postgres://toki:toki@localhost:5433/toki?sslmode=disable"),
		Port:          env("PORT", "8080"),
		AppURL:        strings.TrimRight(env("APP_URL", "http://localhost:3000"), "/"),
		ResendAPIKey:  os.Getenv("RESEND_API_KEY"),
		EmailFrom:     env("EMAIL_FROM", "Toki <alerts@localhost>"),
		CheckInterval: 6 * time.Hour,
	}
	c.SessionSecure, _ = strconv.ParseBool(env("SESSION_SECURE", "false"))
	c.WorkerEnabled, _ = strconv.ParseBool(env("WORKER_ENABLED", "true"))
	if d, err := time.ParseDuration(os.Getenv("CHECK_INTERVAL")); err == nil && d > 0 {
		c.CheckInterval = d
	}
	for _, o := range strings.Split(os.Getenv("EXTENSION_ORIGINS"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			c.ExtensionOrigins = append(c.ExtensionOrigins, o)
		}
	}
	return c
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
