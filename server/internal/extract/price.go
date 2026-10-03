package extract

import (
	"regexp"
	"strings"
)

// zeroDecimal lists currencies without a minor unit.
var zeroDecimal = map[string]bool{"JPY": true, "KRW": true, "VND": true}

var symbols = []struct{ sym, code string }{
	{"₹", "INR"}, {"Rs.", "INR"}, {"Rs", "INR"}, {"INR", "INR"},
	{"$", "USD"}, {"USD", "USD"}, {"€", "EUR"}, {"EUR", "EUR"}, {"£", "GBP"}, {"GBP", "GBP"},
}

var numRe = regexp.MustCompile(`\d[\d.,\s]*`)

// ParseMoney parses a displayed price such as "₹1,29,999.00" or "Rs. 1,299"
// into minor units. The currency is empty when the text has no known symbol.
func ParseMoney(s string) (minor int64, currency string, ok bool) {
	return parseMoney(s, "")
}

// parseMoney is ParseMoney with a currency hint used when the text has no symbol.
func parseMoney(s, hint string) (minor int64, currency string, ok bool) {
	s = strings.TrimSpace(s)
	for _, c := range symbols {
		if strings.Contains(s, c.sym) {
			currency = c.code
			break
		}
	}
	m := numRe.FindString(s)
	m = strings.TrimSpace(m)
	if m == "" {
		return 0, currency, false
	}
	if currency == "" {
		currency = hint
	}
	minor, ok = DecimalToMinor(normalizeNumber(m), currencyOrDefault(currency))
	return minor, currency, ok
}

// normalizeNumber turns "1,29,999.50", "1.299,50" or "12,50" into "129999.50"-style text.
func normalizeNumber(m string) string {
	m = strings.ReplaceAll(m, " ", "")
	m = strings.TrimRight(m, ".,")
	lastDot, lastComma := strings.LastIndex(m, "."), strings.LastIndex(m, ",")
	switch {
	case lastDot >= 0 && lastComma >= 0:
		dec := ','
		if lastDot > lastComma {
			dec = '.'
		}
		if dec == ',' {
			m = strings.ReplaceAll(m, ".", "")
			m = strings.Replace(m, ",", ".", 1)
		} else {
			m = strings.ReplaceAll(m, ",", "")
		}
	case lastComma >= 0:
		// "12,50" is a decimal comma; "1,299" and "1,29,999" are thousands.
		if after := len(m) - lastComma - 1; strings.Count(m, ",") == 1 && after > 0 && after <= 2 {
			m = strings.Replace(m, ",", ".", 1)
		} else {
			m = strings.ReplaceAll(m, ",", "")
		}
	}
	return m
}

func currencyOrDefault(c string) string {
	if c == "" {
		return "INR"
	}
	return c
}

// DecimalToMinor converts "1299.50" to 129950 without floats. A third
// decimal digit rounds half up.
func DecimalToMinor(s, currency string) (int64, bool) {
	s = strings.TrimSpace(s)
	if s == "" || strings.HasPrefix(s, "-") {
		return 0, false
	}
	whole, frac, _ := strings.Cut(s, ".")
	digits := 2
	if zeroDecimal[currency] {
		digits = 0
	}
	for len(frac) < digits+1 {
		frac += "0"
	}
	round := frac[digits] >= '5'
	frac = frac[:digits]
	var n int64
	for _, r := range whole + frac {
		if r < '0' || r > '9' {
			return 0, false
		}
		if n > (1<<62)/10 {
			return 0, false
		}
		n = n*10 + int64(r-'0')
	}
	if round {
		n++
	}
	return n, true
}
