package httpapi_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/actuallyakshat/toki/server/internal/auth"
	"github.com/actuallyakshat/toki/server/internal/config"
	"github.com/actuallyakshat/toki/server/internal/email"
	"github.com/actuallyakshat/toki/server/internal/extract"
	"github.com/actuallyakshat/toki/server/internal/httpapi"
	"github.com/actuallyakshat/toki/server/internal/pricecheck"
	"github.com/actuallyakshat/toki/server/internal/store"
	"github.com/actuallyakshat/toki/server/internal/testdb"
)

// --- harness -----------------------------------------------------------------

type fakeMail struct {
	mu   sync.Mutex
	sent []email.Message
}

func (f *fakeMail) Send(_ context.Context, m email.Message) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sent = append(f.sent, m)
	return nil
}

func (f *fakeMail) count() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.sent)
}

type env struct {
	t    *testing.T
	srv  *httptest.Server
	st   *store.Store
	mail *fakeMail
}

const extOrigin = "chrome-extension://toki-test"

func newEnv(t *testing.T, mutate ...func(*config.Config)) *env {
	t.Helper()
	st := testdb.New(t)
	cfg := config.Config{AppURL: "https://toki.test", CheckInterval: 6 * time.Hour, ExtensionOrigins: []string{extOrigin}}
	for _, m := range mutate {
		m(&cfg)
	}
	mail := &fakeMail{}
	svc := &pricecheck.Service{Store: st, Mail: mail, AppURL: cfg.AppURL, Interval: cfg.CheckInterval}
	srv := httptest.NewServer(httpapi.New(cfg, st, svc, extract.NewFetcher()))
	t.Cleanup(srv.Close)
	return &env{t: t, srv: srv, st: st, mail: mail}
}

// client is one browser (cookie jar) or one extension (bearer token).
type client struct {
	e     *env
	http  *http.Client
	token string
}

func (e *env) anon() *client {
	jar, _ := cookiejar.New(nil)
	return &client{e: e, http: &http.Client{Jar: jar}}
}

// signup creates an account and returns a client holding its session cookie.
func (e *env) signup(addr string) *client {
	e.t.Helper()
	c := e.anon()
	r := c.do("POST", "/api/auth/signup", map[string]any{"email": addr, "password": "password123", "name": "Tester"})
	r.want(201)
	return c
}

type resp struct {
	t      *testing.T
	method string
	path   string
	status int
	header http.Header
	body   []byte
}

func (c *client) do(method, path string, body any) *resp {
	c.e.t.Helper()
	var rd io.Reader
	switch b := body.(type) {
	case nil:
	case string:
		rd = strings.NewReader(b)
	default:
		buf, err := json.Marshal(b)
		if err != nil {
			c.e.t.Fatal(err)
		}
		rd = bytes.NewReader(buf)
	}
	req, err := http.NewRequest(method, c.e.srv.URL+path, rd)
	if err != nil {
		c.e.t.Fatal(err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	res, err := c.http.Do(req)
	if err != nil {
		c.e.t.Fatal(err)
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)
	return &resp{t: c.e.t, method: method, path: path, status: res.StatusCode, header: res.Header, body: b}
}

func (r *resp) want(status int) *resp {
	r.t.Helper()
	if r.status != status {
		r.t.Fatalf("%s %s: status %d, want %d; body %s", r.method, r.path, r.status, status, r.body)
	}
	return r
}

// wantErr checks the contract error shape: {"error": {"code", "message"}}.
func (r *resp) wantErr(status int, code string) {
	r.t.Helper()
	r.want(status)
	var e struct {
		Error struct{ Code, Message string }
	}
	if err := json.Unmarshal(r.body, &e); err != nil || e.Error.Code != code || e.Error.Message == "" {
		r.t.Fatalf("%s %s: error body %s, want code %q with a message", r.method, r.path, r.body, code)
	}
}

func (r *resp) into(v any) {
	r.t.Helper()
	if err := json.Unmarshal(r.body, v); err != nil {
		r.t.Fatalf("%s %s: decode %s: %v", r.method, r.path, r.body, err)
	}
}

func (r *resp) m() map[string]any {
	r.t.Helper()
	var v map[string]any
	r.into(&v)
	return v
}

func (r *resp) cookie(name string) *http.Cookie {
	for _, c := range (&http.Response{Header: r.header}).Cookies() {
		if c.Name == name {
			return c
		}
	}
	return nil
}

func (c *client) defaultList() store.List {
	c.e.t.Helper()
	var out struct{ Lists []store.List }
	c.do("GET", "/api/lists", nil).want(200).into(&out)
	if len(out.Lists) == 0 {
		c.e.t.Fatal("no lists")
	}
	return out.Lists[0]
}

func capture(url string, price int64) map[string]any {
	return map[string]any{"source_url": url, "title": "Sony WH-1000XM5", "image_url": "https://img.test/x.jpg",
		"price_minor": price, "currency": "INR", "in_stock": true, "retailer": "amazon_in"}
}

// addItem saves a product from an extension capture.
func (c *client) addItem(url string, price int64, extra map[string]any) store.Item {
	c.e.t.Helper()
	body := map[string]any{"url": url, "capture": capture(url, price)}
	for k, v := range extra {
		body[k] = v
	}
	var it store.Item
	c.do("POST", "/api/items", body).want(201).into(&it)
	return it
}

const phoneURL = "https://www.amazon.in/Sony-Headphones/dp/B09XS7JWHH/ref=sr_1_1?tag=abc&psc=1"
const phoneCanonical = "https://www.amazon.in/dp/B09XS7JWHH"

// --- tests -----------------------------------------------------------------

func TestHealthAndRouting(t *testing.T) {
	e := newEnv(t)
	c := e.anon()
	if got := c.do("GET", "/api/healthz", nil).want(200).m(); got["ok"] != true {
		t.Errorf("healthz = %v", got)
	}
	c.do("GET", "/api/nope", nil).wantErr(404, "not_found")
	c.do("PUT", "/api/healthz", nil).wantErr(405, "not_found")
}

func TestProtectedRoutesNeedASession(t *testing.T) {
	e := newEnv(t)
	routes := [][2]string{
		{"POST", "/api/auth/logout"}, {"GET", "/api/me"}, {"PATCH", "/api/me/profile"},
		{"GET", "/api/lists"}, {"POST", "/api/lists"}, {"PATCH", "/api/lists/x"}, {"DELETE", "/api/lists/x"},
		{"GET", "/api/lists/x/items"}, {"POST", "/api/lists/x/reorder"},
		{"POST", "/api/items"}, {"PATCH", "/api/items/x"}, {"DELETE", "/api/items/x"},
		{"GET", "/api/items/x/history"}, {"POST", "/api/items/x/refresh"}, {"POST", "/api/extract"},
		{"GET", "/api/extension/refresh-tasks"}, {"POST", "/api/extension/refresh-results"}, {"GET", "/api/stats"},
	}
	anon := e.anon()
	forged := &client{e: e, http: http.DefaultClient, token: "not-a-real-token"}
	for _, r := range routes {
		anon.do(r[0], r[1], nil).wantErr(401, "unauthorized")
		forged.do(r[0], r[1], nil).wantErr(401, "unauthorized")
	}
}

func TestSignupLoginLogout(t *testing.T) {
	e := newEnv(t)
	c := e.anon()

	r := c.do("POST", "/api/auth/signup", map[string]any{"email": "  Asha@Example.COM ", "password": "password123"}).want(201)
	var out struct{ User store.User }
	r.into(&out)
	if out.User.Email != "asha@example.com" || out.User.Name != "asha" {
		t.Errorf("user = %+v; want normalised email and a name taken from it", out.User)
	}
	ck := r.cookie(auth.CookieName)
	if ck == nil || ck.Value == "" || !ck.HttpOnly || ck.SameSite != http.SameSiteLaxMode || ck.Path != "/" ||
		ck.MaxAge != int(auth.SessionTTL.Seconds()) || ck.Secure {
		t.Errorf("session cookie = %+v", ck)
	}

	var me struct {
		User    store.User
		Profile store.Profile
	}
	c.do("GET", "/api/me", nil).want(200).into(&me)
	if me.User.ID != out.User.ID || me.Profile.Currency != "INR" || !me.Profile.EmailAlerts {
		t.Errorf("me = %+v", me)
	}
	lists := c.do("GET", "/api/lists", nil).want(200).m()["lists"].([]any)
	if len(lists) != 1 || lists[0].(map[string]any)["name"] != "Wishlist" {
		t.Errorf("signup lists = %v; want one Wishlist", lists)
	}

	e.anon().do("POST", "/api/auth/signup", map[string]any{"email": "asha@example.com", "password": "password123"}).wantErr(409, "email_taken")

	for name, body := range map[string]map[string]any{
		"bad email":      {"email": "asha", "password": "password123"},
		"no tld":         {"email": "asha@localhost", "password": "password123"},
		"short password": {"email": "x@example.com", "password": "1234567"},
		"long password":  {"email": "x@example.com", "password": strings.Repeat("a", 73)},
		"long name":      {"email": "x@example.com", "password": "password123", "name": strings.Repeat("n", 101)},
	} {
		t.Run(name, func(t *testing.T) {
			e.anon().do("POST", "/api/auth/signup", body).wantErr(422, "validation_failed")
		})
	}
	e.anon().do("POST", "/api/auth/signup", "{not json").wantErr(422, "validation_failed")

	e.anon().do("POST", "/api/auth/login", map[string]any{"email": "asha@example.com", "password": "wrong-password"}).wantErr(401, "invalid_credentials")
	e.anon().do("POST", "/api/auth/login", map[string]any{"email": "nobody@example.com", "password": "password123"}).wantErr(401, "invalid_credentials")

	other := e.anon()
	r = other.do("POST", "/api/auth/login", map[string]any{"email": "ASHA@example.com", "password": "password123"}).want(200)
	if r.cookie(auth.CookieName) == nil {
		t.Error("login did not set a session cookie")
	}
	other.do("GET", "/api/me", nil).want(200)

	// Logout ends only this session and clears the cookie.
	stolen := ck.Value
	r = c.do("POST", "/api/auth/logout", nil).want(204)
	if cleared := r.cookie(auth.CookieName); cleared == nil || cleared.MaxAge >= 0 {
		t.Errorf("logout cookie = %+v; want it cleared", cleared)
	}
	c.do("GET", "/api/me", nil).wantErr(401, "unauthorized")
	(&client{e: e, http: http.DefaultClient, token: stolen}).do("GET", "/api/me", nil).wantErr(401, "unauthorized")
	other.do("GET", "/api/me", nil).want(200)
}

func TestSecureCookieInProduction(t *testing.T) {
	e := newEnv(t, func(c *config.Config) { c.SessionSecure = true })
	r := e.anon().do("POST", "/api/auth/signup", map[string]any{"email": "a@example.com", "password": "password123"}).want(201)
	if ck := r.cookie(auth.CookieName); ck == nil || !ck.Secure {
		t.Errorf("cookie = %+v; want Secure", ck)
	}
}

func TestBearerTokenForExtension(t *testing.T) {
	e := newEnv(t)
	e.signup("a@example.com")

	r := e.anon().do("POST", "/api/auth/token", map[string]any{"email": "a@example.com", "password": "password123"}).want(200)
	if r.cookie(auth.CookieName) != nil {
		t.Error("token endpoint must not set a cookie")
	}
	var out struct {
		Token string
		User  store.User
	}
	r.into(&out)
	if out.Token == "" || out.User.Email != "a@example.com" {
		t.Fatalf("token response = %s", r.body)
	}
	ext := &client{e: e, http: http.DefaultClient, token: out.Token}
	ext.do("GET", "/api/me", nil).want(200)
	ext.do("POST", "/api/auth/logout", nil).want(204)
	ext.do("GET", "/api/me", nil).wantErr(401, "unauthorized")

	e.anon().do("POST", "/api/auth/token", map[string]any{"email": "a@example.com", "password": "nope-nope"}).wantErr(401, "invalid_credentials")
}

func TestPatchProfile(t *testing.T) {
	e := newEnv(t)
	c := e.signup("a@example.com")

	var out struct{ Profile store.Profile }
	c.do("PATCH", "/api/me/profile", map[string]any{"currency": "usd", "monthly_income_minor": 15000000, "hours_per_week": 45,
		"alert_mode": "digest", "email_alerts": false, "ignored_key": 1}).want(200).into(&out)
	p := out.Profile
	if p.Currency != "USD" || p.MonthlyIncomeMinor == nil || *p.MonthlyIncomeMinor != 15000000 || *p.HoursPerWeek != 45 ||
		p.AlertMode != "digest" || p.EmailAlerts || p.IncomeStorage != "server" {
		t.Errorf("profile = %+v", p)
	}

	// Switching income to device-only drops the stored salary.
	c.do("PATCH", "/api/me/profile", map[string]any{"income_storage": "device", "monthly_income_minor": 99}).want(200).into(&out)
	if out.Profile.MonthlyIncomeMinor != nil || out.Profile.IncomeStorage != "device" {
		t.Errorf("device profile = %+v; income must not be stored", out.Profile)
	}
	var me struct{ Profile store.Profile }
	c.do("GET", "/api/me", nil).want(200).into(&me)
	if me.Profile.MonthlyIncomeMinor != nil || *me.Profile.HoursPerWeek != 45 {
		t.Errorf("stored profile = %+v", me.Profile)
	}

	for name, body := range map[string]map[string]any{
		"currency length":   {"currency": "RUPEE"},
		"negative income":   {"monthly_income_minor": -1},
		"zero hours":        {"hours_per_week": 0},
		"too many hours":    {"hours_per_week": 169},
		"storage":           {"income_storage": "cloud"},
		"alert mode":        {"alert_mode": "hourly"},
		"email_alerts type": {"email_alerts": "yes"},
	} {
		t.Run(name, func(t *testing.T) { c.do("PATCH", "/api/me/profile", body).wantErr(422, "validation_failed") })
	}
	c.do("PATCH", "/api/me/profile", map[string]any{"hours_per_week": nil}).want(200).into(&out)
	if out.Profile.HoursPerWeek != nil {
		t.Errorf("null hours_per_week was not cleared: %+v", out.Profile)
	}
}

func TestListsAPI(t *testing.T) {
	e := newEnv(t)
	c := e.signup("a@example.com")
	other := e.signup("b@example.com")
	first := c.defaultList()

	c.do("DELETE", "/api/lists/"+first.ID.String(), nil).wantErr(422, "validation_failed")

	var l store.List
	c.do("POST", "/api/lists", map[string]any{"name": "  Diwali gifts  ", "emoji": "i:gift"}).want(201).into(&l)
	if l.Name != "Diwali gifts" || l.Emoji != "i:gift" || l.Visibility != "private" || l.ShareSlug == "" {
		t.Errorf("created list = %+v", l)
	}
	for name, body := range map[string]map[string]any{
		"empty name": {"name": "   "},
		"long name":  {"name": strings.Repeat("x", 101)},
		"long emoji": {"name": "ok", "emoji": strings.Repeat("e", 65)},
	} {
		t.Run(name, func(t *testing.T) { c.do("POST", "/api/lists", body).wantErr(422, "validation_failed") })
	}

	path := "/api/lists/" + l.ID.String()
	c.do("PATCH", path, map[string]any{"visibility": "link", "name": "Gifts"}).want(200).into(&l)
	if l.Visibility != "link" || l.Name != "Gifts" || l.Emoji != "i:gift" {
		t.Errorf("patched list = %+v", l)
	}
	c.do("PATCH", path, map[string]any{"visibility": "public"}).wantErr(422, "validation_failed")
	c.do("PATCH", path, map[string]any{"name": ""}).wantErr(422, "validation_failed")

	other.do("PATCH", path, map[string]any{"name": "mine now"}).wantErr(404, "not_found")
	other.do("GET", path+"/items", nil).wantErr(404, "not_found")
	other.do("POST", path+"/reorder", map[string]any{"item_ids": []string{}}).wantErr(404, "not_found")
	other.do("DELETE", path, nil).wantErr(404, "not_found")
	c.do("GET", "/api/lists/not-a-uuid/items", nil).wantErr(404, "not_found")
	c.do("GET", path+"/items?status=deleted", nil).wantErr(422, "validation_failed")

	c.do("DELETE", "/api/lists/"+first.ID.String(), nil).want(204)
	c.do("DELETE", path, nil).wantErr(422, "validation_failed") // now the last one
}

func TestCreateItemFromCapture(t *testing.T) {
	e := newEnv(t)
	c := e.signup("a@example.com")

	it := c.addItem(phoneURL, 2999000, nil)
	if it.Product.URL != phoneCanonical || it.Product.Retailer != "amazon_in" || it.Product.CurrentPriceMinor != 2999000 ||
		it.AddedPriceMinor != 2999000 || it.Status != "wanted" || it.ListID != c.defaultList().ID {
		t.Errorf("item = %+v", it)
	}
	var rule store.AlertRule
	_ = json.Unmarshal(it.AlertRule, &rule)
	if rule.Type != "any_drop" {
		t.Errorf("default rule = %s", it.AlertRule)
	}

	// The same product again (another URL form) returns the existing item.
	var again store.Item
	c.do("POST", "/api/items", map[string]any{"url": "https://amazon.in/gp/product/B09XS7JWHH", "capture": capture(phoneURL, 2999000)}).want(200).into(&again)
	if again.ID != it.ID {
		t.Errorf("duplicate add created %s, want existing %s", again.ID, it.ID)
	}

	// A removed item comes back to the wishlist when added again.
	c.do("PATCH", "/api/items/"+it.ID.String(), map[string]any{"status": "removed"}).want(200)
	c.do("POST", "/api/items", map[string]any{"url": phoneURL, "capture": capture(phoneURL, 2999000)}).want(200).into(&again)
	if again.ID != it.ID || again.Status != "wanted" {
		t.Errorf("re-adding a removed item = %+v", again)
	}

	// With a target price the rule is below_target.
	withTarget := c.addItem("https://www.myntra.com/2296012", 149900, map[string]any{"target_price_minor": 99900})
	_ = json.Unmarshal(withTarget.AlertRule, &rule)
	if rule.Type != "below_target" || withTarget.TargetPriceMinor == nil || *withTarget.TargetPriceMinor != 99900 {
		t.Errorf("item with target = %+v rule %s", withTarget, withTarget.AlertRule)
	}

	// The URL can come from the capture alone.
	var fromCapture store.Item
	c.do("POST", "/api/items", map[string]any{"capture": capture("https://shop.test/products/mug", 50000)}).want(201).into(&fromCapture)
	if fromCapture.Product.URL != "https://shop.test/products/mug" {
		t.Errorf("product url = %q", fromCapture.Product.URL)
	}

	// Into a chosen list.
	var gifts store.List
	c.do("POST", "/api/lists", map[string]any{"name": "Gifts"}).want(201).into(&gifts)
	inGifts := c.addItem(phoneURL, 2999000, map[string]any{"list_id": gifts.ID})
	if inGifts.ListID != gifts.ID || inGifts.ID == it.ID {
		t.Errorf("item in gifts = %+v", inGifts)
	}
}

func TestCreateItemValidation(t *testing.T) {
	e := newEnv(t)
	c := e.signup("a@example.com")
	other := e.signup("b@example.com")

	cases := map[string]struct {
		body   map[string]any
		status int
		code   string
	}{
		"no price":          {map[string]any{"url": phoneURL, "capture": capture(phoneURL, 0)}, 422, "validation_failed"},
		"zero target":       {map[string]any{"url": phoneURL, "capture": capture(phoneURL, 100), "target_price_minor": 0}, 422, "validation_failed"},
		"ftp url":           {map[string]any{"url": "ftp://shop.test/x", "capture": capture("ftp://shop.test/x", 100)}, 422, "unsupported_url"},
		"no url":            {map[string]any{}, 422, "unsupported_url"},
		"other user's list": {map[string]any{"url": phoneURL, "capture": capture(phoneURL, 100), "list_id": other.defaultList().ID}, 404, "not_found"},
	}
	bad := capture(phoneURL, 100)
	bad["currency"] = "RUPEES"
	cases["bad currency"] = struct {
		body   map[string]any
		status int
		code   string
	}{map[string]any{"url": phoneURL, "capture": bad}, 422, "validation_failed"}
	noTitle := capture(phoneURL, 100)
	noTitle["title"] = "  "
	cases["no title"] = struct {
		body   map[string]any
		status int
		code   string
	}{map[string]any{"url": phoneURL, "capture": noTitle}, 422, "validation_failed"}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) { c.do("POST", "/api/items", tc.body).wantErr(tc.status, tc.code) })
	}
	if n := len(c.do("GET", fmt.Sprintf("/api/lists/%s/items", c.defaultList().ID), nil).want(200).m()["items"].([]any)); n != 0 {
		t.Errorf("failed requests created %d items", n)
	}
}

// The server-side fetcher must refuse private addresses (no SSRF into the host network).
func TestServerFetchRefusesPrivateAddresses(t *testing.T) {
	e := newEnv(t)
	c := e.signup("a@example.com")
	internalSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		t.Error("the fetcher reached a loopback address")
		fmt.Fprint(w, `<html><head><meta property="og:title" content="x"><meta property="product:price:amount" content="10"></head></html>`)
	}))
	defer internalSrv.Close()

	c.do("POST", "/api/extract", map[string]any{"url": internalSrv.URL + "/product"}).wantErr(422, "extract_failed")
	c.do("POST", "/api/items", map[string]any{"url": internalSrv.URL + "/product"}).wantErr(422, "extract_failed")
	c.do("POST", "/api/extract", map[string]any{"url": "file:///etc/passwd"}).wantErr(422, "unsupported_url")
}

func TestSharedProductPriceUpdatesForEveryone(t *testing.T) {
	e := newEnv(t)
	a := e.signup("a@example.com")
	b := e.signup("b@example.com")
	ai := a.addItem(phoneURL, 3000000, nil)

	// B saves the same product with a cheaper capture: A's item sees the new price and A gets a drop email.
	bi := b.addItem(phoneURL, 2700000, nil)
	if bi.Product.ID != ai.Product.ID {
		t.Fatalf("products not shared: %s vs %s", bi.Product.ID, ai.Product.ID)
	}
	if bi.AddedPriceMinor != 2700000 {
		t.Errorf("B's added price = %d, want the price B saw", bi.AddedPriceMinor)
	}
	var out struct{ Items []store.Item }
	a.do("GET", fmt.Sprintf("/api/lists/%s/items", ai.ListID), nil).want(200).into(&out)
	got := out.Items[0]
	if got.Product.CurrentPriceMinor != 2700000 || got.Stats.ChangeSinceAddedMinor != -300000 || got.Stats.HighestMinor != 3000000 {
		t.Errorf("A's item after B's capture = %+v", got)
	}
	if e.mail.count() != 1 {
		t.Errorf("sent %d emails, want 1 drop alert to A", e.mail.count())
	}
}

func TestPatchAndDeleteItem(t *testing.T) {
	e := newEnv(t)
	c := e.signup("a@example.com")
	other := e.signup("b@example.com")
	it := c.addItem(phoneURL, 2999000, nil)
	path := "/api/items/" + it.ID.String()

	cool := time.Now().Add(30 * 24 * time.Hour).UTC().Truncate(time.Second)
	var got store.Item
	c.do("PATCH", path, map[string]any{"note": "for Diwali", "target_price_minor": 2500000,
		"alert_rule": map[string]any{"type": "percent_drop", "percent": 15}, "cooling_until": cool}).want(200).into(&got)
	var rule store.AlertRule
	_ = json.Unmarshal(got.AlertRule, &rule)
	if got.Note != "for Diwali" || *got.TargetPriceMinor != 2500000 || rule != (store.AlertRule{Type: "percent_drop", Percent: 15}) ||
		got.CoolingUntil == nil || !got.CoolingUntil.Equal(cool) {
		t.Errorf("patched item = %+v rule %s", got, got.AlertRule)
	}

	// Percent is dropped for rules that do not use it; null clears the target.
	c.do("PATCH", path, map[string]any{"alert_rule": map[string]any{"type": "any_drop", "percent": 50}, "target_price_minor": nil}).want(200).into(&got)
	rule = store.AlertRule{}
	_ = json.Unmarshal(got.AlertRule, &rule)
	if rule != (store.AlertRule{Type: "any_drop"}) || got.TargetPriceMinor != nil {
		t.Errorf("rule %s target %v", got.AlertRule, got.TargetPriceMinor)
	}

	c.do("PATCH", path, map[string]any{"status": "bought"}).want(200).into(&got)
	if got.Status != "bought" || got.BoughtAt == nil {
		t.Errorf("bought item = %+v", got)
	}

	for name, body := range map[string]map[string]any{
		"zero target":     {"target_price_minor": 0},
		"rule type":       {"alert_rule": map[string]any{"type": "sometimes"}},
		"percent 0":       {"alert_rule": map[string]any{"type": "percent_drop", "percent": 0}},
		"percent 100":     {"alert_rule": map[string]any{"type": "percent_drop", "percent": 100}},
		"long note":       {"note": strings.Repeat("n", 1001)},
		"status":          {"status": "deleted"},
		"cooling_until":   {"cooling_until": "next week"},
		"other's list":    {"list_id": other.defaultList().ID},
		"list_id garbage": {"list_id": "nope"},
	} {
		t.Run(name, func(t *testing.T) { c.do("PATCH", path, body).wantErr(422, "validation_failed") })
	}

	var gifts store.List
	c.do("POST", "/api/lists", map[string]any{"name": "Gifts"}).want(201).into(&gifts)
	c.do("PATCH", path, map[string]any{"list_id": gifts.ID}).want(200).into(&got)
	if got.ListID != gifts.ID {
		t.Errorf("item list = %s, want %s", got.ListID, gifts.ID)
	}
	dup := c.addItem(phoneURL, 2999000, nil) // same product, default list
	c.do("PATCH", "/api/items/"+dup.ID.String(), map[string]any{"list_id": gifts.ID}).wantErr(422, "validation_failed")

	other.do("PATCH", path, map[string]any{"note": "x"}).wantErr(404, "not_found")
	other.do("DELETE", path, nil).wantErr(404, "not_found")
	c.do("PATCH", "/api/items/not-a-uuid", map[string]any{"note": "x"}).wantErr(404, "not_found")
	c.do("DELETE", path, nil).want(204)
	c.do("DELETE", path, nil).wantErr(404, "not_found")
}

func TestListItemsFilterAndReorder(t *testing.T) {
	e := newEnv(t)
	c := e.signup("a@example.com")
	a := c.addItem("https://shop.test/products/a", 1000, nil)
	b := c.addItem("https://shop.test/products/b", 2000, nil)
	d := c.addItem("https://shop.test/products/d", 3000, nil)
	c.do("PATCH", "/api/items/"+d.ID.String(), map[string]any{"status": "bought"}).want(200)
	listPath := fmt.Sprintf("/api/lists/%s", a.ListID)

	ids := func(q string) []string {
		var out struct{ Items []store.Item }
		c.do("GET", listPath+"/items"+q, nil).want(200).into(&out)
		var s []string
		for _, it := range out.Items {
			s = append(s, it.ID.String())
		}
		return s
	}
	if got := ids(""); len(got) != 2 || got[0] != a.ID.String() || got[1] != b.ID.String() {
		t.Errorf("wanted items = %v", got)
	}
	if got := ids("?status=bought"); len(got) != 1 || got[0] != d.ID.String() {
		t.Errorf("bought items = %v", got)
	}
	if got := ids("?status=all"); len(got) != 3 {
		t.Errorf("all items = %v", got)
	}

	c.do("POST", listPath+"/reorder", map[string]any{"item_ids": []string{b.ID.String(), a.ID.String()}}).want(204)
	if got := ids(""); got[0] != b.ID.String() || got[1] != a.ID.String() {
		t.Errorf("after reorder = %v", got)
	}
	c.do("POST", listPath+"/reorder", map[string]any{"item_ids": []string{"nope"}}).wantErr(422, "validation_failed")

	var lists struct{ Lists []store.List }
	c.do("GET", "/api/lists", nil).want(200).into(&lists)
	l := lists.Lists[0]
	if l.ItemCount != 2 || l.TotalMinor != 3000 {
		t.Errorf("list totals = %d / %d, want 2 / 3000", l.ItemCount, l.TotalMinor)
	}
}

func TestHistoryAndRefresh(t *testing.T) {
	e := newEnv(t)
	c := e.signup("a@example.com")
	other := e.signup("b@example.com")
	it := c.addItem(phoneURL, 2999000, nil)
	path := "/api/items/" + it.ID.String()

	var h struct{ Points []store.PricePoint }
	c.do("GET", path+"/history", nil).want(200).into(&h)
	if len(h.Points) != 1 || h.Points[0].PriceMinor != 2999000 || h.Points[0].Source != "extension" {
		t.Errorf("history = %+v", h.Points)
	}
	c.do("GET", path+"/history?days=365", nil).want(200)
	for _, q := range []string{"0", "3651", "ten"} {
		c.do("GET", path+"/history?days="+q, nil).wantErr(422, "validation_failed")
	}
	other.do("GET", path+"/history", nil).wantErr(404, "not_found")

	// A new product is not due for CHECK_INTERVAL; refresh makes it due for the extension.
	var tasks struct{ Tasks []store.Task }
	c.do("GET", "/api/extension/refresh-tasks", nil).want(200).into(&tasks)
	if len(tasks.Tasks) != 0 {
		t.Fatalf("new product already due: %+v", tasks.Tasks)
	}
	var got store.Item
	c.do("POST", path+"/refresh", nil).want(200).into(&got)
	if got.ID != it.ID {
		t.Errorf("refresh returned %+v", got)
	}
	c.do("GET", "/api/extension/refresh-tasks", nil).want(200).into(&tasks)
	if len(tasks.Tasks) != 1 || tasks.Tasks[0].ProductID != it.Product.ID || tasks.Tasks[0].URL != phoneCanonical || tasks.Tasks[0].Retailer != "amazon_in" {
		t.Errorf("tasks after refresh = %+v", tasks.Tasks)
	}
	other.do("POST", path+"/refresh", nil).wantErr(404, "not_found")
}

func TestExtensionRefreshFlow(t *testing.T) {
	e := newEnv(t)
	c := e.signup("a@example.com")
	other := e.signup("b@example.com")
	it := c.addItem(phoneURL, 3000000, nil)
	otherItem := other.addItem("https://shop.test/products/theirs", 1000, nil)

	for _, q := range []string{"0", "21", "x"} {
		c.do("GET", "/api/extension/refresh-tasks?limit="+q, nil).wantErr(422, "validation_failed")
	}

	c.do("POST", "/api/items/"+it.ID.String()+"/refresh", nil).want(200)
	var tasks struct{ Tasks []store.Task }
	c.do("GET", "/api/extension/refresh-tasks?limit=20", nil).want(200).into(&tasks)
	if len(tasks.Tasks) != 1 {
		t.Fatalf("tasks = %+v", tasks.Tasks)
	}
	c.do("GET", "/api/extension/refresh-tasks", nil).want(200).into(&tasks)
	if len(tasks.Tasks) != 0 {
		t.Errorf("leased task handed out twice: %+v", tasks.Tasks)
	}

	// Results for products the user does not track are ignored.
	results := []map[string]any{
		{"product_id": it.Product.ID, "capture": capture(phoneURL, 2500000)},
		{"product_id": otherItem.Product.ID, "capture": capture("https://shop.test/products/theirs", 1)},
	}
	if got := c.do("POST", "/api/extension/refresh-results", map[string]any{"results": results}).want(200).m(); got["accepted"] != float64(1) {
		t.Errorf("accepted = %v, want 1", got["accepted"])
	}
	var out struct{ Items []store.Item }
	c.do("GET", fmt.Sprintf("/api/lists/%s/items", it.ListID), nil).want(200).into(&out)
	mine := out.Items[0]
	if mine.Product.CurrentPriceMinor != 2500000 || mine.Product.LastCheckStatus != "ok" {
		t.Errorf("product after result = %+v", mine.Product)
	}
	other.do("GET", fmt.Sprintf("/api/lists/%s/items", otherItem.ListID), nil).want(200).into(&out)
	if out.Items[0].Product.CurrentPriceMinor != 1000 {
		t.Errorf("another user's product was changed to %d", out.Items[0].Product.CurrentPriceMinor)
	}
	if e.mail.count() != 1 {
		t.Errorf("sent %d emails, want 1 drop alert", e.mail.count())
	}

	// An error report counts as accepted and marks the check failed without changing the price.
	errRes := []map[string]any{{"product_id": it.Product.ID, "error": "captcha"}}
	if got := c.do("POST", "/api/extension/refresh-results", map[string]any{"results": errRes}).want(200).m(); got["accepted"] != float64(1) {
		t.Errorf("accepted = %v, want 1", got["accepted"])
	}
	c.do("GET", fmt.Sprintf("/api/lists/%s/items", it.ListID), nil).want(200).into(&out)
	if p := out.Items[0].Product; p.LastCheckStatus != "failed" || p.CurrentPriceMinor != 2500000 {
		t.Errorf("product after error = %+v", p)
	}

	tooMany := make([]map[string]any, 51)
	for i := range tooMany {
		tooMany[i] = map[string]any{"product_id": it.Product.ID, "error": "x"}
	}
	c.do("POST", "/api/extension/refresh-results", map[string]any{"results": tooMany}).wantErr(422, "validation_failed")
}

func TestPublicListHidesPrivateFields(t *testing.T) {
	e := newEnv(t)
	c := e.signup("a@example.com")
	it := c.addItem(phoneURL, 2999000, map[string]any{"target_price_minor": 2000000})
	c.do("PATCH", "/api/items/"+it.ID.String(), map[string]any{"note": "secret"}).want(200)
	bought := c.addItem("https://shop.test/products/bought", 100, nil)
	c.do("PATCH", "/api/items/"+bought.ID.String(), map[string]any{"status": "bought"}).want(200)
	l := c.defaultList()
	path := "/api/public/lists/" + l.ShareSlug

	e.anon().do("GET", path, nil).wantErr(404, "not_found")
	c.do("PATCH", "/api/lists/"+l.ID.String(), map[string]any{"visibility": "link"}).want(200)

	r := e.anon().do("GET", path, nil).want(200)
	var out struct {
		List  map[string]string
		Items []map[string]any
	}
	r.into(&out)
	if out.List["name"] != "Wishlist" || out.List["owner_name"] != "Tester" {
		t.Errorf("public list = %v", out.List)
	}
	if len(out.Items) != 1 {
		t.Fatalf("public items = %d, want only the wanted item", len(out.Items))
	}
	for _, k := range []string{"note", "alert_rule", "target_price_minor"} {
		if _, ok := out.Items[0][k]; ok {
			t.Errorf("public item exposes %q", k)
		}
	}
	if strings.Contains(string(r.body), "secret") {
		t.Error("public response contains the private note")
	}
	if _, ok := out.Items[0]["product"]; !ok {
		t.Error("public item has no product")
	}
	e.anon().do("GET", "/api/public/lists/unknown1", nil).wantErr(404, "not_found")
}

func TestStatsAPI(t *testing.T) {
	e := newEnv(t)
	c := e.signup("a@example.com")
	c.addItem(phoneURL, 3000000, nil)
	gone := c.addItem("https://shop.test/products/gone", 5000, nil)
	c.do("PATCH", "/api/items/"+gone.ID.String(), map[string]any{"status": "removed"}).want(200)
	// Another user's cheaper capture lowers the shared price.
	e.signup("b@example.com").addItem(phoneURL, 2800000, nil)

	var s store.Stats
	c.do("GET", "/api/stats", nil).want(200).into(&s)
	want := store.Stats{Currency: "INR", ItemCount: 1, TotalMinor: 2800000, SavedByDropsMinor: 200000, RemovedValueMinor: 5000}
	if s != want {
		t.Errorf("stats = %+v, want %+v", s, want)
	}
}

func TestCORSForExtensionOrigins(t *testing.T) {
	e := newEnv(t)
	preflight := func(origin string) *http.Response {
		req, _ := http.NewRequest("OPTIONS", e.srv.URL+"/api/me", nil)
		req.Header.Set("Origin", origin)
		req.Header.Set("Access-Control-Request-Method", "GET")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		return res
	}
	res := preflight(extOrigin)
	if res.StatusCode != 204 || res.Header.Get("Access-Control-Allow-Origin") != extOrigin ||
		!strings.Contains(res.Header.Get("Access-Control-Allow-Headers"), "Authorization") {
		t.Errorf("allowed origin preflight: %d %v", res.StatusCode, res.Header)
	}
	if res := preflight("https://evil.test"); res.Header.Get("Access-Control-Allow-Origin") != "" {
		t.Errorf("unknown origin got CORS headers: %v", res.Header)
	}
}
