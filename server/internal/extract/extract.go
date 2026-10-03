// Package extract turns a product page into a Capture.
package extract

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/url"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

// Capture is what the extension or the server extractor produces from a page.
type Capture struct {
	SourceURL          string `json:"source_url"`
	Title              string `json:"title"`
	ImageURL           string `json:"image_url"`
	PriceMinor         int64  `json:"price_minor"`
	Currency           string `json:"currency"`
	OriginalPriceMinor *int64 `json:"original_price_minor"`
	InStock            bool   `json:"in_stock"`
	Retailer           string `json:"retailer"`
}

var (
	ErrBlocked  = errors.New("the retailer blocked the request (captcha or rate limit)")
	ErrNoPrice  = errors.New("no price found on the page")
	ErrNotFound = errors.New("the page was not found")
)

// partial holds what one extraction stage found.
type partial struct {
	title, image, currency string
	price                  int64
	original               int64
	inStock                *bool
}

func (p *partial) hasPrice() bool { return p.price > 0 }

// merge fills empty fields of dst from src. Price fields come from the first
// stage that has a price, so they never mix between stages.
func (dst *partial) merge(src *partial) {
	if src == nil {
		return
	}
	if dst.title == "" {
		dst.title = src.title
	}
	if dst.image == "" {
		dst.image = src.image
	}
	if !dst.hasPrice() && src.hasPrice() {
		dst.price, dst.currency, dst.original, dst.inStock = src.price, src.currency, src.original, src.inStock
	}
}

func boolp(b bool) *bool { return &b }

// Parse extracts a Capture from page HTML. Known retailers try their adapter
// first because their generic markup often carries the wrong price.
func Parse(pageURL string, body []byte) (*Capture, error) {
	u, err := url.Parse(pageURL)
	if err != nil {
		return nil, ErrUnsupportedURL
	}
	doc, err := goquery.NewDocumentFromReader(bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	canonical, retailer, err := Canonicalize(pageURL)
	if err != nil {
		canonical, retailer = pageURL, RetailerGeneric
	}

	stages := []func() *partial{func() *partial { return jsonLD(doc, u) }, func() *partial { return openGraph(doc, u) }, func() *partial { return microdata(doc, u) }}
	switch retailer {
	case RetailerAmazon:
		stages = append([]func() *partial{func() *partial { return amazon(doc, u) }}, stages...)
	case RetailerFlipkart:
		stages = append([]func() *partial{func() *partial { return flipkart(doc, u) }}, stages...)
	case RetailerMyntra:
		stages = append([]func() *partial{func() *partial { return myntra(doc, u) }}, stages...)
	}

	var res partial
	for _, st := range stages {
		res.merge(st())
		if res.hasPrice() && res.title != "" && res.image != "" {
			break
		}
	}
	if res.title == "" {
		res.title = clean(doc.Find("title").First().Text())
	}
	if !res.hasPrice() {
		return nil, ErrNoPrice
	}
	if retailer == RetailerGeneric && isShopify(doc, body) {
		retailer = RetailerShopify
	}
	c := &Capture{
		SourceURL: canonical, Title: res.title, ImageURL: res.image, PriceMinor: res.price,
		Currency: currencyOrDefault(res.currency), InStock: res.inStock == nil || *res.inStock, Retailer: retailer,
	}
	if res.original > res.price {
		c.OriginalPriceMinor = &res.original
	}
	return c, nil
}

func isShopify(doc *goquery.Document, body []byte) bool {
	return doc.Find(`meta[name="shopify-checkout-api-token"], link[href*="cdn.shopify.com"], script[src*="cdn.shopify.com"]`).Length() > 0 ||
		bytes.Contains(body, []byte("Shopify.shop"))
}

func clean(s string) string { return strings.Join(strings.Fields(s), " ") }

func absURL(base *url.URL, ref string) string {
	ref = strings.TrimSpace(ref)
	if ref == "" || strings.HasPrefix(ref, "data:") {
		return ""
	}
	r, err := base.Parse(ref)
	if err != nil {
		return ""
	}
	return r.String()
}

func availabilityInStock(s string) *bool {
	s = strings.ToLower(s)
	switch {
	case s == "":
		return nil
	case strings.Contains(s, "outofstock"), strings.Contains(s, "soldout"), strings.Contains(s, "discontinued"),
		strings.Contains(s, "out of stock"), s == "oos":
		return boolp(false)
	case strings.Contains(s, "instock"), strings.Contains(s, "in stock"), strings.Contains(s, "limitedavailability"),
		strings.Contains(s, "preorder"), strings.Contains(s, "onlineonly"):
		return boolp(true)
	}
	return nil
}

// --- JSON-LD ---------------------------------------------------------------

func jsonLD(doc *goquery.Document, base *url.URL) *partial {
	var out partial
	doc.Find(`script[type="application/ld+json"]`).EachWithBreak(func(_ int, s *goquery.Selection) bool {
		dec := json.NewDecoder(strings.NewReader(s.Text()))
		dec.UseNumber()
		var v any
		if dec.Decode(&v) != nil {
			return true
		}
		walkLD(v, base, &out)
		return !(out.hasPrice() && out.title != "")
	})
	return &out
}

func walkLD(v any, base *url.URL, out *partial) {
	switch n := v.(type) {
	case []any:
		for _, e := range n {
			walkLD(e, base, out)
		}
	case map[string]any:
		if g, ok := n["@graph"]; ok {
			walkLD(g, base, out)
		}
		if hasType(n["@type"], "Product") || hasType(n["@type"], "ProductGroup") {
			productLD(n, base, out)
		}
	}
}

func hasType(t any, want string) bool {
	switch v := t.(type) {
	case string:
		return v == want
	case []any:
		for _, e := range v {
			if hasType(e, want) {
				return true
			}
		}
	}
	return false
}

func productLD(n map[string]any, base *url.URL, out *partial) {
	if out.title == "" {
		out.title = clean(str(n["name"]))
	}
	if out.image == "" {
		out.image = absURL(base, firstImage(n["image"]))
	}
	if out.hasPrice() {
		return
	}
	offers := n["offers"]
	if offers == nil {
		if vs, ok := n["hasVariant"].([]any); ok && len(vs) > 0 {
			if m, ok := vs[0].(map[string]any); ok {
				offers = m["offers"]
			}
		}
	}
	var list []any
	switch o := offers.(type) {
	case []any:
		list = o
	case map[string]any:
		list = []any{o}
	}
	var best int64
	var bestCur string
	var stock *bool
	for _, e := range list {
		o, ok := e.(map[string]any)
		if !ok {
			continue
		}
		raw := firstNonNil(o["price"], o["lowPrice"])
		if raw == nil {
			if ps, ok := o["priceSpecification"].(map[string]any); ok {
				raw = ps["price"]
			}
		}
		cur := strings.ToUpper(str(o["priceCurrency"]))
		p, ok := moneyFromJSON(raw, cur)
		if !ok || p <= 0 {
			continue
		}
		if best == 0 || p < best {
			best, bestCur = p, cur
			stock = availabilityInStock(str(o["availability"]))
		}
	}
	if best > 0 {
		out.price, out.currency, out.inStock = best, bestCur, stock
	}
}

func firstNonNil(vs ...any) any {
	for _, v := range vs {
		if v != nil {
			return v
		}
	}
	return nil
}

func firstImage(v any) string {
	switch i := v.(type) {
	case string:
		return i
	case []any:
		if len(i) > 0 {
			return firstImage(i[0])
		}
	case map[string]any:
		return str(firstNonNil(i["url"], i["contentUrl"]))
	}
	return ""
}

func str(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

// moneyFromJSON accepts a JSON number or a string like "12999.00" or "₹1,299".
func moneyFromJSON(v any, currency string) (int64, bool) {
	switch p := v.(type) {
	case json.Number:
		return DecimalToMinor(p.String(), currencyOrDefault(currency))
	case string:
		m, _, ok := parseMoney(p, currency)
		return m, ok
	}
	return 0, false
}

// --- OpenGraph -------------------------------------------------------------

func openGraph(doc *goquery.Document, base *url.URL) *partial {
	meta := func(names ...string) string {
		for _, n := range names {
			sel := doc.Find(`meta[property="` + n + `"], meta[name="` + n + `"]`).First()
			if v, ok := sel.Attr("content"); ok && strings.TrimSpace(v) != "" {
				return strings.TrimSpace(v)
			}
		}
		return ""
	}
	p := &partial{title: clean(meta("og:title")), image: absURL(base, meta("og:image", "og:image:secure_url"))}
	p.currency = strings.ToUpper(meta("product:price:currency", "og:price:currency"))
	p.price, _ = moneyFromJSON(meta("product:price:amount", "og:price:amount"), p.currency)
	p.original, _ = moneyFromJSON(meta("product:original_price:amount", "product:compare_at_price:amount"), p.currency)
	p.inStock = availabilityInStock(meta("product:availability", "og:availability"))
	return p
}

// --- microdata -------------------------------------------------------------

func microdata(doc *goquery.Document, base *url.URL) *partial {
	scope := doc.Find(`[itemtype*="schema.org/Product"]`).First()
	if scope.Length() == 0 {
		scope = doc.Selection
	}
	prop := func(name string) *goquery.Selection { return scope.Find(`[itemprop="` + name + `"]`).First() }
	val := func(s *goquery.Selection) string {
		for _, a := range []string{"content", "href", "src"} {
			if v, ok := s.Attr(a); ok && strings.TrimSpace(v) != "" {
				return strings.TrimSpace(v)
			}
		}
		return clean(s.Text())
	}
	p := &partial{}
	if s := prop("name"); s.Length() > 0 {
		p.title = val(s)
	}
	if s := prop("image"); s.Length() > 0 {
		p.image = absURL(base, val(s))
	}
	if s := prop("priceCurrency"); s.Length() > 0 {
		p.currency = strings.ToUpper(val(s))
	}
	if s := prop("price"); s.Length() > 0 {
		v := val(s)
		if m, cur, ok := parseMoney(v, p.currency); ok {
			p.price = m
			if p.currency == "" {
				p.currency = cur
			}
		}
	}
	if s := prop("availability"); s.Length() > 0 {
		p.inStock = availabilityInStock(val(s))
	}
	return p
}

func mustDoc(body []byte) *goquery.Document {
	doc, _ := goquery.NewDocumentFromReader(bytes.NewReader(body))
	return doc
}
