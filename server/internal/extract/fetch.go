package extract

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"syscall"
	"time"
)

const (
	userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
	maxBody   = 3 << 20
)

var captchaMarkers = []string{"captcha", "robot check", "enter the characters you see"}

// Fetcher downloads product pages for one-off server-side extraction.
type Fetcher struct{ client *http.Client }

// NewFetcher returns a Fetcher that refuses to connect to private addresses.
func NewFetcher() *Fetcher { return newFetcher(false) }

func newFetcher(allowPrivate bool) *Fetcher {
	d := &net.Dialer{Timeout: 10 * time.Second}
	if !allowPrivate {
		d.Control = func(_, address string, _ syscall.RawConn) error {
			host, _, _ := net.SplitHostPort(address)
			if ip := net.ParseIP(host); ip == nil || ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() ||
				ip.IsLinkLocalMulticast() || ip.IsUnspecified() {
				return fmt.Errorf("blocked address %s", host)
			}
			return nil
		}
	}
	return &Fetcher{client: &http.Client{
		Timeout:   15 * time.Second,
		Transport: &http.Transport{DialContext: d.DialContext, ForceAttemptHTTP2: true, MaxIdleConns: 10, IdleConnTimeout: 30 * time.Second},
	}}
}

func (f *Fetcher) get(ctx context.Context, rawURL string) (body []byte, finalURL string, err error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, "", ErrUnsupportedURL
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept-Language", "en-IN,en;q=0.9")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8")
	resp, err := f.client.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("fetch failed: %w", err)
	}
	defer resp.Body.Close()
	body, err = io.ReadAll(io.LimitReader(resp.Body, maxBody))
	if err != nil {
		return nil, "", err
	}
	switch {
	case resp.StatusCode == 503 || resp.StatusCode == 429:
		return body, resp.Request.URL.String(), ErrBlocked
	case resp.StatusCode == 404 || resp.StatusCode == 410:
		return body, resp.Request.URL.String(), ErrNotFound
	case resp.StatusCode >= 400:
		return body, resp.Request.URL.String(), fmt.Errorf("the page returned HTTP %d", resp.StatusCode)
	}
	return body, resp.Request.URL.String(), nil
}

// Fetch downloads rawURL and extracts a Capture.
//
// Captcha markers are only checked when extraction finds no price: Myntra
// pages mention "captcha" in a feature-flag blob even when they are fine.
func (f *Fetcher) Fetch(ctx context.Context, rawURL string) (*Capture, error) {
	canonical, retailer, err := Canonicalize(rawURL)
	if err != nil {
		return nil, err
	}
	target := canonical
	if retailer == RetailerGeneric {
		target = strings.TrimSpace(rawURL) // generic pages may need the query string to load
	}
	body, finalURL, err := f.get(ctx, target)
	if err != nil {
		return nil, err
	}
	c, err := Parse(finalURL, body)
	if err == nil {
		c.SourceURL = canonical
		return c, nil
	}
	lower := strings.ToLower(string(body))
	for _, m := range captchaMarkers {
		if strings.Contains(lower, m) {
			return nil, ErrBlocked
		}
	}
	if isShopify(mustDoc(body), body) {
		if js, ok := ShopifyJSURL(finalURL); ok {
			if jb, _, jerr := f.get(ctx, js); jerr == nil {
				if sc, serr := ParseShopifyJS(finalURL, jb, body); serr == nil {
					sc.SourceURL = canonical
					return sc, nil
				}
			}
		}
	}
	return nil, err
}
