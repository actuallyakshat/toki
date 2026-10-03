package extract

import "testing"

func TestParseMoney(t *testing.T) {
	tests := []struct {
		in       string
		minor    int64
		currency string
	}{
		{"₹1,29,999.00", 12999900, "INR"},
		{"₹ 79,900", 7990000, "INR"},
		{"Rs. 1,299", 129900, "INR"},
		{"Rs 499.50", 49950, "INR"},
		{"INR 1299", 129900, "INR"},
		{"1299.00", 129900, ""},
		{"509.", 50900, ""},
		{"$1,299.99", 129999, "USD"},
		{"€1.299,50", 129950, "EUR"},
		{"12,50", 1250, ""},
		{"1,299", 129900, ""},
		{" ₹4,999.005 ", 499901, "INR"},
	}
	for _, tc := range tests {
		m, cur, ok := ParseMoney(tc.in)
		if !ok || m != tc.minor || cur != tc.currency {
			t.Errorf("ParseMoney(%q) = %d, %q, %v; want %d, %q", tc.in, m, cur, ok, tc.minor, tc.currency)
		}
	}
	for _, in := range []string{"", " ", "free"} {
		if m, _, ok := ParseMoney(in); ok && m != 0 {
			t.Errorf("ParseMoney(%q) = %d, want failure", in, m)
		}
	}
}

func TestDecimalToMinor(t *testing.T) {
	if m, ok := DecimalToMinor("1299.5", "INR"); !ok || m != 129950 {
		t.Errorf("got %d %v", m, ok)
	}
	if m, ok := DecimalToMinor("1299", "JPY"); !ok || m != 1299 {
		t.Errorf("JPY got %d %v", m, ok)
	}
	if _, ok := DecimalToMinor("12a", "INR"); ok {
		t.Error("accepted garbage")
	}
}
