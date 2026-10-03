package email

import (
	"strings"
	"testing"
)

func TestMoney(t *testing.T) {
	tests := []struct {
		minor int64
		cur   string
		want  string
	}{
		{12999900, "INR", "₹1,29,999"}, {49950, "INR", "₹499.50"}, {99, "INR", "₹0.99"}, {10000000, "INR", "₹1,00,000"},
		{123456789, "USD", "$1,234,567.89"}, {-500000, "INR", "-₹5,000"}, {100, "CHF", "CHF 1"},
	}
	for _, tc := range tests {
		if got := Money(tc.minor, tc.cur); got != tc.want {
			t.Errorf("Money(%d, %s) = %q, want %q", tc.minor, tc.cur, got, tc.want)
		}
	}
}

func TestDropMessage(t *testing.T) {
	m := Drop("https://toki.test", "a@b.in", "Asha", Item{Title: "Sony <XM5>", ImageURL: "https://img/x.jpg", URL: "https://www.amazon.in/dp/B1", Currency: "INR", OldMinor: 2999000, NewMinor: 2699000})
	for _, want := range []string{"₹29,990", "₹26,990", "https://toki.test/settings", "https://img/x.jpg", "#1f8a70", "Sony &lt;XM5&gt;"} {
		if !strings.Contains(m.HTML, want) {
			t.Errorf("html missing %q", want)
		}
	}
	if m.UnsubscribeURL != "https://toki.test/settings" || !strings.Contains(m.Text, "₹26,990") || !strings.Contains(m.Subject, "₹26,990") {
		t.Errorf("bad message: %+v", m)
	}
}
