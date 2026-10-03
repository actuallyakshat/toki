package config

import (
	"slices"
	"testing"
	"time"
)

func TestLoadDefaults(t *testing.T) {
	for _, k := range []string{"DATABASE_URL", "PORT", "APP_URL", "SESSION_SECURE", "RESEND_API_KEY", "EMAIL_FROM", "WORKER_ENABLED", "CHECK_INTERVAL", "EXTENSION_ORIGINS"} {
		t.Setenv(k, "")
	}
	c := Load()
	if c.Port != "8080" || c.AppURL != "http://localhost:3000" || c.SessionSecure || !c.WorkerEnabled ||
		c.CheckInterval != 6*time.Hour || len(c.ExtensionOrigins) != 0 || c.DatabaseURL == "" {
		t.Errorf("defaults = %+v", c)
	}
}

func TestLoadFromEnv(t *testing.T) {
	t.Setenv("APP_URL", "https://toki.example/")
	t.Setenv("SESSION_SECURE", "true")
	t.Setenv("WORKER_ENABLED", "false")
	t.Setenv("CHECK_INTERVAL", "90m")
	t.Setenv("EXTENSION_ORIGINS", " chrome-extension://a , ,chrome-extension://b")
	c := Load()
	if c.AppURL != "https://toki.example" {
		t.Errorf("AppURL = %q; want the trailing slash trimmed", c.AppURL)
	}
	if !c.SessionSecure || c.WorkerEnabled || c.CheckInterval != 90*time.Minute {
		t.Errorf("config = %+v", c)
	}
	if !slices.Equal(c.ExtensionOrigins, []string{"chrome-extension://a", "chrome-extension://b"}) {
		t.Errorf("origins = %q", c.ExtensionOrigins)
	}
}

func TestLoadIgnoresBadInterval(t *testing.T) {
	for _, v := range []string{"soon", "-1h", "0s"} {
		t.Setenv("CHECK_INTERVAL", v)
		if got := Load().CheckInterval; got != 6*time.Hour {
			t.Errorf("CHECK_INTERVAL=%q gave %v, want the 6h default", v, got)
		}
	}
}
