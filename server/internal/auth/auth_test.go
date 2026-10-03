package auth

import "testing"

func TestToken(t *testing.T) {
	a, ha := NewToken()
	b, _ := NewToken()
	if a == b || len(ha) != 32 || string(HashToken(a)) != string(ha) {
		t.Error("token or hash wrong")
	}
}

func TestPassword(t *testing.T) {
	h, err := HashPassword("password123")
	if err != nil || !CheckPassword(h, "password123") || CheckPassword(h, "password124") {
		t.Error("bcrypt round trip failed")
	}
}

func TestNormalizeEmail(t *testing.T) {
	if e, ok := NormalizeEmail("  Demo@Toki.dev "); !ok || e != "demo@toki.dev" {
		t.Errorf("got %q %v", e, ok)
	}
	for _, bad := range []string{"", "a", "a@b", "a b@c.in", "Name <a@b.in>", "@b.in"} {
		if _, ok := NormalizeEmail(bad); ok {
			t.Errorf("%q accepted", bad)
		}
	}
}
