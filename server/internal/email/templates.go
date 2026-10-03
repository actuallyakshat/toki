package email

import (
	"bytes"
	"fmt"
	"html/template"
	"strings"
)

// Item is one product in an email.
type Item struct {
	Title, ImageURL, URL, Currency string
	OldMinor, NewMinor             int64
}

var page = template.Must(template.New("page").Funcs(template.FuncMap{"money": Money}).Parse(`<!doctype html>
<html><body style="margin:0;background:#eef0f4;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1b1f3b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f4"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px">
<tr><td style="padding:20px 24px;font-size:20px;font-weight:700;color:#1b1f3b">Toki <span style="font-weight:400;color:#1f8a70">時</span></td></tr>
<tr><td style="padding:0 24px 8px;font-size:16px">{{.Heading}}</td></tr>
{{range .Items}}<tr><td style="padding:12px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
{{if .ImageURL}}<td width="96" valign="top"><img src="{{.ImageURL}}" width="88" height="88" alt="" style="border-radius:8px;object-fit:contain;background:#eef0f4"></td>{{end}}
<td valign="top"><a href="{{.URL}}" style="color:#1b1f3b;font-weight:600;text-decoration:none">{{.Title}}</a>
<div style="margin-top:6px;font-size:15px"><span style="color:#6b7089;text-decoration:line-through">{{money .OldMinor .Currency}}</span>
&rarr; <span style="color:#1f8a70;font-weight:700;font-size:18px">{{money .NewMinor .Currency}}</span></div></td>
</tr></table></td></tr>{{end}}
<tr><td style="padding:16px 24px 24px"><a href="{{.AppURL}}" style="display:inline-block;background:#1f8a70;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Open your wishlist</a></td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #eef0f4;font-size:12px;color:#6b7089">You get this email because you track prices on Toki.
<a href="{{.Unsubscribe}}" style="color:#6b7089">Change email settings or unsubscribe</a>.</td></tr>
</table></td></tr></table></body></html>`))

func build(appURL, to, subject, heading string, items []Item) Message {
	unsub := appURL + "/settings"
	var html bytes.Buffer
	if err := page.Execute(&html, map[string]any{"Heading": heading, "Items": items, "AppURL": appURL, "Unsubscribe": unsub}); err != nil {
		panic(err) // template and data are fixed
	}
	var text strings.Builder
	text.WriteString(heading + "\n\n")
	for _, it := range items {
		fmt.Fprintf(&text, "%s\n%s -> %s\n%s\n\n", it.Title, Money(it.OldMinor, it.Currency), Money(it.NewMinor, it.Currency), it.URL)
	}
	fmt.Fprintf(&text, "Open your wishlist: %s\nEmail settings and unsubscribe: %s\n", appURL, unsub)
	return Message{To: to, Subject: subject, Text: text.String(), HTML: html.String(), UnsubscribeURL: unsub}
}

func Drop(appURL, to, name string, it Item) Message {
	return build(appURL, to, fmt.Sprintf("Price drop: %s is now %s", short(it.Title), Money(it.NewMinor, it.Currency)),
		fmt.Sprintf("Hi %s, the price dropped.", name), []Item{it})
}

func BackInStock(appURL, to, name string, it Item) Message {
	return build(appURL, to, fmt.Sprintf("Back in stock: %s", short(it.Title)),
		fmt.Sprintf("Hi %s, this item is back in stock.", name), []Item{it})
}

func Digest(appURL, to, name string, items []Item) Message {
	return build(appURL, to, fmt.Sprintf("Your weekly Toki digest: %d price drop(s)", len(items)),
		fmt.Sprintf("Hi %s, these items got cheaper this week.", name), items)
}

func short(s string) string {
	if r := []rune(s); len(r) > 60 {
		return string(r[:57]) + "..."
	}
	return s
}
