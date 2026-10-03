package extract

import (
	"errors"
	"net/url"
	"regexp"
	"strings"
)

// Retailer identifiers used in Product.retailer.
const (
	RetailerAmazon   = "amazon_in"
	RetailerFlipkart = "flipkart"
	RetailerMyntra   = "myntra"
	RetailerShopify  = "shopify"
	RetailerGeneric  = "generic"
)

var ErrUnsupportedURL = errors.New("unsupported url")

var (
	asinRe     = regexp.MustCompile(`/(?:dp|gp/product|gp/aw/d|product)/([A-Za-z0-9]{10})(?:[/?]|$)`)
	flipkartRe = regexp.MustCompile(`^(.*?/p/itm[a-z0-9]+)`)
	myntraRe   = regexp.MustCompile(`/(\d{4,})(?:/buy)?/?$`)
)

// Canonicalize returns the deduplication key for a product URL and the
// retailer detected from its host. Query strings are dropped except where
// the retailer needs them to identify the product (Flipkart pid).
// Tracking parameters (utm_*, ref, tag, psc, smid, pf_rd_*, ...) never survive.
func Canonicalize(raw string) (canonical, retailer string, err error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" {
		return "", "", ErrUnsupportedURL
	}
	host := strings.TrimPrefix(strings.ToLower(u.Hostname()), "www.")
	path := strings.TrimRight(u.EscapedPath(), "/")

	switch {
	case host == "amazon.in":
		m := asinRe.FindStringSubmatch(path + "/")
		if m == nil {
			return "", "", ErrUnsupportedURL
		}
		return "https://www.amazon.in/dp/" + strings.ToUpper(m[1]), RetailerAmazon, nil
	case host == "flipkart.com":
		out := "https://www.flipkart.com" + path
		if m := flipkartRe.FindStringSubmatch(path); m != nil {
			out = "https://www.flipkart.com" + m[1]
		}
		if pid := u.Query().Get("pid"); pid != "" {
			out += "?pid=" + url.QueryEscape(pid)
		}
		return out, RetailerFlipkart, nil
	case host == "myntra.com":
		if m := myntraRe.FindStringSubmatch(path); m != nil {
			return "https://www.myntra.com/" + m[1], RetailerMyntra, nil
		}
		return "https://www.myntra.com" + path, RetailerMyntra, nil
	}
	if port := u.Port(); port != "" {
		host += ":" + port
	}
	return "https://" + host + path, RetailerGeneric, nil
}
