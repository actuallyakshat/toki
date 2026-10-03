package extract

import "testing"

func TestCanonicalize(t *testing.T) {
	tests := []struct{ in, want, retailer string }{
		{"https://www.amazon.in/Apple-iPhone/dp/B0GQVL6STN/ref=sr_1_1?crid=1&utm_source=x&tag=y&psc=1&smid=A1", "https://www.amazon.in/dp/B0GQVL6STN", RetailerAmazon},
		{"https://amazon.in/gp/product/B0GQVL6STN?pf_rd_p=abc", "https://www.amazon.in/dp/B0GQVL6STN", RetailerAmazon},
		{"https://www.amazon.in/gp/aw/d/b0gqvl6stn/", "https://www.amazon.in/dp/B0GQVL6STN", RetailerAmazon},
		{"HTTP://WWW.AMAZON.IN/dp/B0GQVL6STN", "https://www.amazon.in/dp/B0GQVL6STN", RetailerAmazon},
		{"https://www.flipkart.com/apple-iphone-15/p/itmbf14ef54f645d?pid=MOBGTAGPAQNVFZZY&lid=LSTx&marketplace=FLIPKART&utm_medium=a", "https://www.flipkart.com/apple-iphone-15/p/itmbf14ef54f645d?pid=MOBGTAGPAQNVFZZY", RetailerFlipkart},
		{"https://flipkart.com/x/p/itmabc123/more?foo=1", "https://www.flipkart.com/x/p/itmabc123", RetailerFlipkart},
		{"https://www.myntra.com/tshirts/roadster/roadster-men-tshirt/2296012/buy?utm_source=a", "https://www.myntra.com/2296012", RetailerMyntra},
		{"https://www.myntra.com/2296012", "https://www.myntra.com/2296012", RetailerMyntra},
		{"https://www.myntra.com/shoes/nike/some-shoe?x=1", "https://www.myntra.com/shoes/nike/some-shoe", RetailerMyntra},
		{"http://www.Example.com/products/shoe/?utm_campaign=a&variant=3#top", "https://example.com/products/shoe", RetailerGeneric},
		{"https://bluetokai.com", "https://bluetokai.com", RetailerGeneric},
	}
	for _, tc := range tests {
		got, retailer, err := Canonicalize(tc.in)
		if err != nil || got != tc.want || retailer != tc.retailer {
			t.Errorf("Canonicalize(%q) = %q, %q, %v; want %q, %q", tc.in, got, retailer, err, tc.want, tc.retailer)
		}
	}
}

func TestCanonicalizeRejects(t *testing.T) {
	for _, in := range []string{"", "ftp://example.com/a", "not a url", "javascript:alert(1)", "https://www.amazon.in/gp/help"} {
		if _, _, err := Canonicalize(in); err == nil {
			t.Errorf("Canonicalize(%q) accepted", in)
		}
	}
}
