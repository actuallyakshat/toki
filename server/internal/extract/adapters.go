package extract

import (
	"encoding/json"
	"net/url"
	"regexp"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

// firstText returns the first selector match whose text parses as a price.
func firstPrice(doc *goquery.Document, sels ...string) (int64, bool) {
	for _, sel := range sels {
		var found int64
		doc.Find(sel).EachWithBreak(func(_ int, s *goquery.Selection) bool {
			if m, _, ok := ParseMoney(s.Text()); ok && m > 0 {
				found = m
				return false
			}
			return true
		})
		if found > 0 {
			return found, true
		}
	}
	return 0, false
}

func firstTextOf(doc *goquery.Document, sels ...string) string {
	for _, sel := range sels {
		if t := clean(doc.Find(sel).First().Text()); t != "" {
			return t
		}
	}
	return ""
}

func firstAttrOf(doc *goquery.Document, attr string, sels ...string) string {
	for _, sel := range sels {
		if v, ok := doc.Find(sel).First().Attr(attr); ok && strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

// --- Amazon.in -------------------------------------------------------------

func amazon(doc *goquery.Document, base *url.URL) *partial {
	p := &partial{currency: "INR"}
	p.title = firstTextOf(doc, "#productTitle", "#title span", "h1#title")
	// The offscreen span is sometimes blank; the accessibility label and
	// the visible whole-number span carry the same price.
	p.price, _ = firstPrice(doc,
		"#corePriceDisplay_desktop_feature_div .a-price.priceToPay .a-offscreen",
		"#corePriceDisplay_desktop_feature_div .a-price .a-offscreen",
		"#apex-pricetopay-accessibility-label",
		"#priceblock_ourprice", "#priceblock_dealprice",
		"#corePrice_feature_div .a-price .a-offscreen",
		"#apex_desktop .a-price .a-offscreen",
		"#corePriceDisplay_desktop_feature_div .a-price-whole",
		"#corePrice_feature_div .a-price-whole",
		"#centerCol .a-price-whole",
	)
	p.original, _ = firstPrice(doc,
		"#corePriceDisplay_desktop_feature_div .basisPrice .a-offscreen",
		`#corePriceDisplay_desktop_feature_div .a-text-price[data-a-strike="true"] .a-offscreen`,
		"#listPrice", "#priceblock_listprice", "#centerCol .a-text-price .a-offscreen")

	img := firstAttrOf(doc, "data-old-hires", "#landingImage", "#imgBlkFront", "#main-image")
	if img == "" {
		img = firstAttrOf(doc, "src", "#landingImage", "#imgBlkFront")
	}
	if img == "" {
		if dyn := firstAttrOf(doc, "data-a-dynamic-image", "#landingImage", "#imgBlkFront"); dyn != "" {
			var m map[string][]int
			if json.Unmarshal([]byte(dyn), &m) == nil {
				best := 0
				for u, wh := range m {
					if len(wh) > 0 && wh[0] > best {
						best, img = wh[0], u
					}
				}
			}
		}
	}
	p.image = absURL(base, img)

	avail := strings.ToLower(firstTextOf(doc, "#availability", "#availability_feature_div"))
	switch {
	case doc.Find("#outOfStock").Length() > 0, strings.Contains(avail, "currently unavailable"), strings.Contains(avail, "out of stock"):
		p.inStock = boolp(false)
	case avail != "":
		p.inStock = boolp(true)
	}
	return p
}

// --- Flipkart --------------------------------------------------------------
// Flipkart class names are obfuscated and change often, and live pages were
// not reachable while writing this adapter, so it is unverified. Most
// Flipkart product pages also carry JSON-LD, which the generic path reads.

func flipkart(doc *goquery.Document, base *url.URL) *partial {
	p := &partial{currency: "INR"}
	p.title = firstTextOf(doc, "span.VU-ZEz", "span.B_NuCI", "h1 span", "h1")
	p.price, _ = firstPrice(doc, "div.Nx9bqj.CxhGGd", "div.Nx9bqj", "div._30jeq3._16Jk6d", "div._30jeq3")
	p.original, _ = firstPrice(doc, "div.yRaY8j.A6+E6v", "div.yRaY8j", "div._3I9_wc._2p6lqe", "div._3I9_wc")
	p.image = absURL(base, firstAttrOf(doc, "src", "img.DByuf4", "img._396cs4", "img._2r_T1I", "img.q6DClP"))
	body := strings.ToLower(doc.Find("body").Text())
	if strings.Contains(body, "sold out") || strings.Contains(body, "currently unavailable") {
		p.inStock = boolp(false)
	}
	return p
}

// --- Myntra ----------------------------------------------------------------

type myxData struct {
	PdpData struct {
		Name  string `json:"name"`
		Price struct {
			Discounted json.Number `json:"discounted"`
			MRP        json.Number `json:"mrp"`
		} `json:"price"`
		Media struct {
			Albums []struct {
				Images []struct {
					ImageURL  string `json:"imageURL"`
					SecureSrc string `json:"secureSrc"`
				} `json:"images"`
			} `json:"albums"`
		} `json:"media"`
		Sizes []struct {
			Available bool `json:"available"`
		} `json:"sizes"`
	} `json:"pdpData"`
}

var myntraImgRe = regexp.MustCompile(`^http://`)

func myntra(doc *goquery.Document, base *url.URL) *partial {
	p := &partial{currency: "INR"}
	doc.Find("script").EachWithBreak(func(_ int, s *goquery.Selection) bool {
		txt := s.Text()
		i := strings.Index(txt, "window.__myx = ")
		if i < 0 {
			return true
		}
		var d myxData
		if json.NewDecoder(strings.NewReader(txt[i+len("window.__myx = "):])).Decode(&d) != nil {
			return true
		}
		pd := d.PdpData
		p.title = clean(pd.Name)
		// Myntra prices are whole rupees.
		price := firstNonEmpty(pd.Price.Discounted.String(), pd.Price.MRP.String())
		p.price, _ = DecimalToMinor(price, "INR")
		p.original, _ = DecimalToMinor(pd.Price.MRP.String(), "INR")
		if len(pd.Media.Albums) > 0 && len(pd.Media.Albums[0].Images) > 0 {
			im := pd.Media.Albums[0].Images[0]
			p.image = myntraImgRe.ReplaceAllString(firstNonEmpty(im.ImageURL, im.SecureSrc), "https://")
		}
		if len(pd.Sizes) > 0 {
			any := false
			for _, sz := range pd.Sizes {
				any = any || sz.Available
			}
			p.inStock = boolp(any)
		}
		return false
	})
	return p
}

func firstNonEmpty(vs ...string) string {
	for _, v := range vs {
		if v != "" {
			return v
		}
	}
	return ""
}

// --- Shopify ---------------------------------------------------------------

var (
	shopifyHandleRe   = regexp.MustCompile(`^(.*?/products/[^/?#]+)`)
	shopifyCurrencyRe = regexp.MustCompile(`Shopify\.currency\s*=\s*\{"active":"([A-Z]{3})"`)
)

// ShopifyJSURL returns the /products/<handle>.js URL for a Shopify product page.
func ShopifyJSURL(pageURL string) (string, bool) {
	u, err := url.Parse(pageURL)
	if err != nil {
		return "", false
	}
	m := shopifyHandleRe.FindStringSubmatch(u.Path)
	if m == nil {
		return "", false
	}
	return u.Scheme + "://" + u.Host + strings.TrimSuffix(m[1], ".js") + ".js", true
}

// ParseShopifyJS reads Shopify's /products/<handle>.js JSON, where prices are
// integers in minor units.
func ParseShopifyJS(pageURL string, js []byte, pageHTML []byte) (*Capture, error) {
	var d struct {
		Title        string `json:"title"`
		Price        int64  `json:"price"`
		CompareAt    int64  `json:"compare_at_price"`
		Available    bool   `json:"available"`
		FeaturedImag string `json:"featured_image"`
	}
	if err := json.Unmarshal(js, &d); err != nil || d.Price <= 0 {
		return nil, ErrNoPrice
	}
	base, _ := url.Parse(pageURL)
	cur := "INR"
	if m := shopifyCurrencyRe.FindSubmatch(pageHTML); m != nil {
		cur = string(m[1])
	}
	canonical, _, err := Canonicalize(pageURL)
	if err != nil {
		canonical = pageURL
	}
	c := &Capture{SourceURL: canonical, Title: clean(d.Title), ImageURL: absURL(base, d.FeaturedImag),
		PriceMinor: d.Price, Currency: cur, InStock: d.Available, Retailer: RetailerShopify}
	if d.CompareAt > d.Price {
		c.OriginalPriceMinor = &d.CompareAt
	}
	return c, nil
}
