package store

import (
	"context"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/actuallyakshat/toki/server/internal/auth"
	"github.com/actuallyakshat/toki/server/internal/extract"
)

const (
	DemoEmail    = "demo@toki.dev"
	DemoPassword = "password123"
)

type step struct {
	daysAgo int   // the price applies from this many days ago until the next step
	rupees  int64 // whole rupees
}

type seedProduct struct {
	list          int // 0 = Wishlist, 1 = Diwali gifts
	url, retailer string
	title, image  string
	mrp           int64 // rupees, 0 = unknown
	steps         []step
	outOfStock    bool
	target        int64 // rupees, 0 = none
	rule          string
	addedDaysAgo  int
	live          bool // real product page: due now so the extension has a task
}

const unsplash = "https://images.unsplash.com/photo-"

var seedProducts = []seedProduct{
	{0, "https://www.amazon.in/dp/B09XS7JWHH", extract.RetailerAmazon, "Sony WH-1000XM5 Wireless Noise Cancelling Headphones, Black",
		unsplash + "1505740420928-5e560c06d30e?w=800", 34990,
		[]step{{90, 29990}, {62, 28990}, {38, 27990}, {21, 24990}, {18, 27990}, {8, 26990}}, false, 24990, "below_target", 75, false},
	{0, "https://www.amazon.in/dp/B0GQVL6STN", extract.RetailerAmazon, "Apple iPhone 17e 256 GB: 15.40 cm (6.1″) Super Retina XDR Display, A19 Chip, Black",
		"https://m.media-amazon.com/images/I/61ULimPWODL._SL1500_.jpg", 0,
		[]step{{90, 84900}, {55, 82900}, {28, 79900}}, false, 0, "any_drop", 60, true},
	{0, "https://www.amazon.in/dp/B0CP9ZJY3D", extract.RetailerAmazon, "Kindle Paperwhite (16 GB) - 6.8\" display, adjustable warm light, up to 12 weeks battery",
		unsplash + "1544716278-ca5e3f4abd8c?w=800", 16999,
		[]step{{90, 16999}, {45, 15999}, {12, 14999}}, false, 0, "percent_drop:10", 50, false},
	{0, "https://www.amazon.in/dp/B09P8GWPRN", extract.RetailerAmazon, "Keychron K2 Wireless Mechanical Keyboard, Gateron Brown Switches, Hot-Swappable",
		unsplash + "1587829741301-dc798b83add3?w=800", 10999,
		[]step{{90, 10999}, {33, 9499}, {10, 8499}}, false, 7999, "below_target", 40, false},
	{0, "https://www.flipkart.com/apple-airpods-pro-2nd-generation-magsafe-case-usb-c/p/itm0b7b8e1d7a1f2?pid=ACCGTGE5K9Z2YBPH", extract.RetailerFlipkart,
		"Apple AirPods Pro (2nd Generation) with MagSafe Case (USB-C)",
		unsplash + "1606220588913-b3aacb4d2f46?w=800", 26900,
		[]step{{90, 24900}, {70, 22900}, {40, 20990}, {15, 19490}, {3, 18990}}, false, 19500, "below_target", 45, false},
	{0, "https://www.myntra.com/2296012", extract.RetailerMyntra, "Roadster Men Navy Blue Slim Fit Mid-Rise Clean Look Jeans",
		"https://assets.myntassets.com/assets/images/2296012/2020/7/1/af25ec96-c79a-45b5-8fb2-bdac5d161a831593578913647-Roadster-Men-Blue-Slim-Fit-Mid-Rise-Clean-Look-Jeans-1071593-1.jpg", 1499,
		[]step{{90, 1499}, {35, 1049}, {25, 1499}}, true, 0, "any_drop", 30, true},
	{1, "https://www.myntra.com/31000123", extract.RetailerMyntra, "Nike Men Air Zoom Pegasus 41 Road Running Shoes",
		unsplash + "1542291026-7eec264c27ff?w=800", 11995,
		[]step{{90, 11995}, {40, 10795}, {14, 8996}}, false, 8500, "below_target", 35, false},
	{1, "https://bluetokai.com/products/diwali-coffee-gift-box", extract.RetailerShopify, "Blue Tokai Diwali Coffee Gift Box",
		unsplash + "1495474472287-4d71bcdd2085?w=800", 1499,
		[]step{{90, 1499}, {30, 1399}, {9, 1299}}, false, 0, "any_drop", 20, false},
	{1, "https://www.amazon.in/dp/B099TJGJ91", extract.RetailerAmazon, "Bose SoundLink Flex Bluetooth Portable Speaker, Waterproof, Black",
		unsplash + "1608043152269-423dbba4e7e1?w=800", 17900,
		[]step{{90, 15900}, {47, 14990}, {19, 12990}, {6, 11990}}, false, 0, "percent_drop:15", 55, false},
	{1, "https://www.amazon.in/dp/1847941834", extract.RetailerAmazon, "Atomic Habits: The Life-Changing Million-Copy Bestseller (Paperback)",
		unsplash + "1544947950-fa07a98d237f?w=800", 799,
		[]step{{90, 499}, {44, 449}, {13, 399}}, false, 0, "any_drop", 15, false},
}

// Seed resets the demo user's data. Seeded products with fake URLs get a
// far-future next_check_at so no extension is asked to fetch them; products
// with live URLs are due now.
func (s *Store) Seed(ctx context.Context) error {
	hash, err := auth.HashPassword(DemoPassword)
	if err != nil {
		return err
	}
	now := time.Now()
	return s.tx(ctx, func(tx pgx.Tx) error {
		urls := make([]string, len(seedProducts))
		for i, p := range seedProducts {
			urls[i] = p.url
		}
		if _, err := tx.Exec(ctx, `DELETE FROM users WHERE email=$1`, DemoEmail); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `DELETE FROM products WHERE canonical_url = ANY($1)`, urls); err != nil {
			return err
		}
		userID := newID()
		if _, err := tx.Exec(ctx, `INSERT INTO users (id, email, name, password_hash) VALUES ($1,$2,'Demo',$3)`, userID, DemoEmail, hash); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO profiles (user_id, monthly_income_minor, hours_per_week) VALUES ($1, 15000000, 45)`, userID); err != nil {
			return err
		}
		listIDs := [2]any{newID(), newID()}
		if _, err := tx.Exec(ctx, `INSERT INTO lists (id, user_id, name, emoji, share_slug, created_at) VALUES ($1,$2,'Wishlist','✨',$3, now() - interval '100 days')`,
			listIDs[0], userID, newSlug()); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO lists (id, user_id, name, emoji, visibility, share_slug, created_at) VALUES ($1,$2,'Diwali gifts','🪔','link','diwali26',  now() - interval '90 days')`,
			listIDs[1], userID); err != nil {
			return err
		}

		position := [2]int{}
		for _, p := range seedProducts {
			cur := p.steps[len(p.steps)-1].rupees * 100
			next, checked := now.AddDate(10, 0, 0), now.Add(-2*time.Hour)
			if p.live {
				next, checked = now.Add(-time.Hour), now.Add(-7*time.Hour)
			}
			var mrp *int64
			if p.mrp > cur/100 {
				m := p.mrp * 100
				mrp = &m
			}
			productID := newID()
			if _, err := tx.Exec(ctx, `INSERT INTO products (id, canonical_url, retailer, title, image_url, currency, current_price_minor,
				original_price_minor, in_stock, last_checked_at, last_check_status, next_check_at) VALUES ($1,$2,$3,$4,$5,'INR',$6,$7,$8,$9,'ok',$10)`,
				productID, p.url, p.retailer, p.title, p.image, cur, mrp, !p.outOfStock, checked, next); err != nil {
				return err
			}
			for _, pt := range history(p, now) {
				if _, err := tx.Exec(ctx, `INSERT INTO price_points (product_id, price_minor, currency, in_stock, source, checked_at) VALUES ($1,$2,'INR',$3,'api',$4)`,
					productID, pt.price, pt.inStock, pt.at); err != nil {
					return err
				}
			}
			var added int64
			for _, st := range p.steps {
				if st.daysAgo >= p.addedDaysAgo {
					added = st.rupees * 100
				}
			}
			var target *int64
			if p.target > 0 {
				t := p.target * 100
				target = &t
			}
			if _, err := tx.Exec(ctx, `INSERT INTO items (id, user_id, list_id, product_id, added_price_minor, target_price_minor, alert_rule, position, created_at)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
				newID(), userID, listIDs[p.list], productID, added, target, ruleJSON(p.rule), position[p.list], now.AddDate(0, 0, -p.addedDaysAgo)); err != nil {
				return err
			}
			position[p.list]++
		}
		return nil
	})
}

func ruleJSON(rule string) []byte {
	if len(rule) > len("percent_drop:") && rule[:len("percent_drop:")] == "percent_drop:" {
		return []byte(`{"type":"percent_drop","percent":` + rule[len("percent_drop:"):] + `}`)
	}
	return []byte(`{"type":"` + rule + `"}`)
}

type seedPoint struct {
	price   int64
	inStock bool
	at      time.Time
}

// history samples the price every 2 days for 90 days, ending with the current price now.
func history(p seedProduct, now time.Time) []seedPoint {
	steps := append([]step(nil), p.steps...)
	sort.Slice(steps, func(i, j int) bool { return steps[i].daysAgo > steps[j].daysAgo })
	var out []seedPoint
	for d := 90; d > 0; d -= 2 {
		price := steps[0].rupees
		for _, s := range steps {
			if s.daysAgo >= d {
				price = s.rupees
			}
		}
		at := now.AddDate(0, 0, -d).Add(-time.Duration((d*7)%11) * time.Hour)
		out = append(out, seedPoint{price * 100, !(p.outOfStock && d <= 6), at})
	}
	last := steps[len(steps)-1].rupees * 100
	return append(out, seedPoint{last, !p.outOfStock, now.Add(-2 * time.Hour)})
}
