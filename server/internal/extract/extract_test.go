package extract

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func fixture(t *testing.T, name string) []byte {
	t.Helper()
	b, err := os.ReadFile("testdata/" + name)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func ptr(n int64) *int64 { return &n }

func TestParseGeneric(t *testing.T) {
	tests := []struct {
		name, url, html string
		want            Capture
	}{
		{
			name: "jsonld product with offer string price",
			url:  "https://shop.example.in/products/shirt",
			html: `<html><head><title>Fallback</title><script type="application/ld+json">
			{"@context":"https://schema.org","@type":"Product","name":"Linen Shirt","image":["/img/a.jpg"],
			 "offers":{"@type":"Offer","price":"1,499.00","priceCurrency":"INR","availability":"https://schema.org/InStock"}}</script></head></html>`,
			want: Capture{Title: "Linen Shirt", ImageURL: "https://shop.example.in/img/a.jpg", PriceMinor: 149900, Currency: "INR", InStock: true, Retailer: RetailerGeneric},
		},
		{
			name: "jsonld graph with numeric price and out of stock",
			url:  "https://shop.example.in/p/1",
			html: `<script type="application/ld+json">{"@graph":[{"@type":"WebSite","name":"Shop"},
			 {"@type":["Product","Thing"],"name":"Mug","image":{"url":"https://cdn.example.in/m.png"},
			  "offers":[{"@type":"Offer","price":499.5,"priceCurrency":"INR","availability":"http://schema.org/OutOfStock"}]}]}</script>`,
			want: Capture{Title: "Mug", ImageURL: "https://cdn.example.in/m.png", PriceMinor: 49950, Currency: "INR", InStock: false, Retailer: RetailerGeneric},
		},
		{
			name: "jsonld array with aggregate offer",
			url:  "https://shop.example.in/p/2",
			html: `<script type="application/ld+json">[{"@type":"BreadcrumbList"},{"@type":"Product","name":"Lamp",
			 "offers":{"@type":"AggregateOffer","lowPrice":"799","highPrice":"999","priceCurrency":"INR"}}]</script>`,
			want: Capture{Title: "Lamp", PriceMinor: 79900, Currency: "INR", InStock: true, Retailer: RetailerGeneric},
		},
		{
			name: "opengraph product meta",
			url:  "https://shop.example.in/p/3",
			html: `<head><meta property="og:title" content="Desk"><meta property="og:image" content="https://cdn.example.in/d.jpg">
			 <meta property="product:price:amount" content="12999.00"><meta property="product:price:currency" content="INR">
			 <meta property="product:availability" content="out of stock"></head>`,
			want: Capture{Title: "Desk", ImageURL: "https://cdn.example.in/d.jpg", PriceMinor: 1299900, Currency: "INR", InStock: false, Retailer: RetailerGeneric},
		},
		{
			name: "microdata",
			url:  "https://shop.example.in/p/4",
			html: `<div itemscope itemtype="https://schema.org/Product"><h1 itemprop="name">Chair</h1>
			 <img itemprop="image" src="/c.png"><span itemprop="priceCurrency" content="INR"></span>
			 <span itemprop="price" content="3499.00">₹3,499</span><link itemprop="availability" href="https://schema.org/InStock"></div>`,
			want: Capture{Title: "Chair", ImageURL: "https://shop.example.in/c.png", PriceMinor: 349900, Currency: "INR", InStock: true, Retailer: RetailerGeneric},
		},
		{
			name: "jsonld without price falls back to opengraph and keeps jsonld title",
			url:  "https://shop.example.in/p/5",
			html: `<head><meta property="og:price:amount" content="250"><meta property="og:price:currency" content="INR">
			 <script type="application/ld+json">{"@type":"Product","name":"Pen"}</script></head>`,
			want: Capture{Title: "Pen", PriceMinor: 25000, Currency: "INR", InStock: true, Retailer: RetailerGeneric},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := Parse(tc.url, []byte(tc.html))
			if err != nil {
				t.Fatal(err)
			}
			tc.want.SourceURL = got.SourceURL
			if *got != tc.want {
				t.Errorf("got %+v\nwant %+v", *got, tc.want)
			}
		})
	}
}

func TestParseNoPrice(t *testing.T) {
	if _, err := Parse("https://x.example/p", []byte(`<title>About us</title><p>Hello</p>`)); err != ErrNoPrice {
		t.Errorf("err = %v, want ErrNoPrice", err)
	}
}

func TestParseAmazonLive(t *testing.T) {
	// Trimmed from a live amazon.in page. The offscreen price span was blank
	// there, so the price comes from the accessibility label.
	c, err := Parse("https://www.amazon.in/dp/B0GQVL6STN", fixture(t, "amazon_in_iphone.html"))
	if err != nil {
		t.Fatal(err)
	}
	if c.PriceMinor != 7990000 || c.Currency != "INR" || !c.InStock || c.Retailer != RetailerAmazon ||
		c.Title[:15] != "Apple iPhone 17" || c.SourceURL != "https://www.amazon.in/dp/B0GQVL6STN" {
		t.Errorf("unexpected capture %+v", *c)
	}
}

func TestParseAmazonSelectorFallbacks(t *testing.T) {
	tests := map[string]struct {
		html  string
		price int64
		orig  *int64
		stock bool
	}{
		"offscreen with strike price": {
			`<span id="productTitle"> Echo Dot </span><div id="corePriceDisplay_desktop_feature_div">
			 <span class="a-price priceToPay"><span class="a-offscreen">₹4,499.00</span></span>
			 <span class="basisPrice"><span class="a-offscreen">₹5,499.00</span></span></div>
			 <img id="landingImage" data-old-hires="https://m.media-amazon.com/images/I/a._SL1500_.jpg" src="https://x/small.jpg">`,
			449900, ptr(549900), true,
		},
		"old priceblock": {`<span id="productTitle">Book</span><span id="priceblock_dealprice">₹1,29,999.00</span>`, 12999900, nil, true},
		"whole only":     {`<span id="productTitle">Cable</span><div id="centerCol"><span class="a-price-whole">509<span class="a-price-decimal">.</span></span></div>`, 50900, nil, true},
		"unavailable":    {`<span id="productTitle">Gone</span><div id="corePriceDisplay_desktop_feature_div"><span class="a-price"><span class="a-offscreen">₹99.00</span></span></div><div id="availability"><span>Currently unavailable.</span></div>`, 9900, nil, false},
	}
	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			c, err := Parse("https://www.amazon.in/dp/B000000001", []byte(tc.html))
			if err != nil {
				t.Fatal(err)
			}
			if c.PriceMinor != tc.price || c.InStock != tc.stock || (tc.orig == nil) != (c.OriginalPriceMinor == nil) ||
				(tc.orig != nil && *tc.orig != *c.OriginalPriceMinor) {
				t.Errorf("got %+v", *c)
			}
		})
	}
}

func TestParseAmazonImageFromHires(t *testing.T) {
	c, err := Parse("https://www.amazon.in/dp/B000000001", []byte(`<span id="productTitle">T</span><span id="priceblock_ourprice">₹10</span>
		<img id="landingImage" data-old-hires="https://m.media-amazon.com/images/I/big.jpg">`))
	if err != nil || c.ImageURL != "https://m.media-amazon.com/images/I/big.jpg" {
		t.Errorf("%v %+v", err, c)
	}
}

func TestParseMyntraLive(t *testing.T) {
	// Trimmed from a live myntra.com page (every size was sold out that day).
	c, err := Parse("https://www.myntra.com/2296012", fixture(t, "myntra_jeans.html"))
	if err != nil {
		t.Fatal(err)
	}
	if c.PriceMinor != 149900 || c.Currency != "INR" || c.InStock || c.Retailer != RetailerMyntra ||
		c.Title != "Roadster Men Navy Blue Slim Fit Mid-Rise Clean Look Jeans" ||
		c.ImageURL == "" || c.ImageURL[:8] != "https://" {
		t.Errorf("unexpected capture %+v", *c)
	}
	if c.OriginalPriceMinor != nil {
		t.Errorf("mrp equals price, original must be nil: %v", *c.OriginalPriceMinor)
	}
}

func TestParseMyntraDiscount(t *testing.T) {
	html := `<script>window.__myx = {"pdpData":{"name":"Shoe","price":{"mrp":8995,"discounted":5397.5},
	  "media":{"albums":[{"images":[{"imageURL":"http://assets.myntassets.com/a.jpg"}]}]},"sizes":[{"available":false},{"available":true}]}}</script>`
	c, err := Parse("https://www.myntra.com/123456", []byte(html))
	if err != nil {
		t.Fatal(err)
	}
	if c.PriceMinor != 539750 || c.OriginalPriceMinor == nil || *c.OriginalPriceMinor != 899500 || !c.InStock || c.ImageURL != "https://assets.myntassets.com/a.jpg" {
		t.Errorf("%+v", *c)
	}
}

// The Flipkart adapter is NOT verified against a live page (flipkart.com
// returned HTTP 500 to curl). This test only checks the selectors against
// hand-made markup that mimics Flipkart's class names.
func TestParseFlipkartHandMade(t *testing.T) {
	html := `<span class="VU-ZEz">Apple iPhone 15 (Blue, 128 GB)</span><div class="Nx9bqj CxhGGd">₹69,999</div>
	  <div class="yRaY8j A6+E6v">₹79,900</div><img class="DByuf4" src="https://rukminim2.flixcart.com/image/a.jpeg">`
	c, err := Parse("https://www.flipkart.com/apple-iphone-15/p/itmbf14ef54f645d?pid=MOB1", []byte(html))
	if err != nil {
		t.Fatal(err)
	}
	if c.PriceMinor != 6999900 || *c.OriginalPriceMinor != 7990000 || c.Retailer != RetailerFlipkart || c.Title != "Apple iPhone 15 (Blue, 128 GB)" {
		t.Errorf("%+v", *c)
	}
}

func TestParseShopifyJS(t *testing.T) {
	js := `{"title":"Single Origin Beans 250g","price":59900,"compare_at_price":69900,"available":true,"featured_image":"//cdn.shopify.com/s/a.jpg"}`
	page := `<script>Shopify.currency = {"active":"INR","rate":"1.0"};</script>`
	c, err := ParseShopifyJS("https://shop.example.in/products/beans?variant=1", []byte(js), []byte(page))
	if err != nil {
		t.Fatal(err)
	}
	if c.PriceMinor != 59900 || *c.OriginalPriceMinor != 69900 || c.Currency != "INR" || !c.InStock ||
		c.ImageURL != "https://cdn.shopify.com/s/a.jpg" || c.Retailer != RetailerShopify {
		t.Errorf("%+v", *c)
	}
	if u, ok := ShopifyJSURL("https://shop.example.in/collections/x/products/beans?variant=1"); !ok || u != "https://shop.example.in/collections/x/products/beans.js" {
		t.Errorf("js url %q %v", u, ok)
	}
}

func TestFetchBlockedAndShopify(t *testing.T) {
	captcha := fixture(t, "amazon_captcha.html")
	mux := http.NewServeMux()
	mux.HandleFunc("/captcha", func(w http.ResponseWriter, _ *http.Request) { w.Write(captcha) })
	mux.HandleFunc("/limited", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(503) })
	mux.HandleFunc("/products/beans", func(w http.ResponseWriter, _ *http.Request) {
		w.Write([]byte(`<html><head><script src="https://cdn.shopify.com/x.js"></script></head><body>no markup</body></html>`))
	})
	mux.HandleFunc("/products/beans.js", func(w http.ResponseWriter, _ *http.Request) {
		w.Write([]byte(`{"title":"Beans","price":59900,"available":false}`))
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()
	f := newFetcher(true)

	for _, p := range []string{"/captcha", "/limited"} {
		if _, err := f.Fetch(context.Background(), srv.URL+p); err != ErrBlocked {
			t.Errorf("%s: err = %v, want ErrBlocked", p, err)
		}
	}
	c, err := f.Fetch(context.Background(), srv.URL+"/products/beans")
	if err != nil || c.PriceMinor != 59900 || c.InStock || c.Retailer != RetailerShopify {
		t.Errorf("shopify fallback: %v %+v", err, c)
	}
	if _, err := NewFetcher().Fetch(context.Background(), srv.URL+"/captcha"); err == nil || err == ErrBlocked {
		t.Errorf("private address must be refused, got %v", err)
	}
}
