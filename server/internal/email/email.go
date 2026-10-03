// Package email builds and sends Toki's emails.
package email

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

type Message struct {
	To, Subject, Text, HTML string
	UnsubscribeURL          string
}

type Sender interface {
	Send(ctx context.Context, m Message) error
}

// New returns a Resend sender, or a stdout logger when apiKey is empty.
func New(apiKey, from string) Sender {
	if apiKey == "" {
		return logSender{from: from}
	}
	return &resend{key: apiKey, from: from, client: &http.Client{Timeout: 15 * time.Second}}
}

type logSender struct{ from string }

func (l logSender) Send(_ context.Context, m Message) error {
	fmt.Printf("---- email (RESEND_API_KEY empty, not sent) ----\nFrom: %s\nTo: %s\nSubject: %s\nList-Unsubscribe: <%s>\n\n%s\n---- end email ----\n",
		l.from, m.To, m.Subject, m.UnsubscribeURL, m.Text)
	return nil
}

type resend struct {
	key, from string
	client    *http.Client
}

func (r *resend) Send(ctx context.Context, m Message) error {
	payload, _ := json.Marshal(map[string]any{
		"from": r.from, "to": []string{m.To}, "subject": m.Subject, "html": m.HTML, "text": m.Text,
		"headers": map[string]string{"List-Unsubscribe": "<" + m.UnsubscribeURL + ">"},
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+r.key)
	req.Header.Set("Content-Type", "application/json")
	resp, err := r.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		slog.Warn("resend rejected email", "status", resp.StatusCode, "body", string(b))
		return fmt.Errorf("resend: HTTP %d", resp.StatusCode)
	}
	return nil
}

// Money formats minor units, with Indian digit grouping for INR.
func Money(minor int64, currency string) string {
	neg := minor < 0
	if neg {
		minor = -minor
	}
	whole, paise := minor/100, minor%100
	digits := fmt.Sprint(whole)
	var grouped string
	if currency == "INR" || currency == "" {
		grouped = groupIndian(digits)
	} else {
		grouped = groupThousands(digits)
	}
	if paise != 0 {
		grouped += fmt.Sprintf(".%02d", paise)
	}
	sym := map[string]string{"INR": "₹", "": "₹", "USD": "$", "EUR": "€", "GBP": "£"}[currency]
	if sym == "" {
		sym = currency + " "
	}
	if neg {
		return "-" + sym + grouped
	}
	return sym + grouped
}

func groupIndian(d string) string {
	if len(d) <= 3 {
		return d
	}
	head, tail := d[:len(d)-3], d[len(d)-3:]
	var parts []string
	for len(head) > 2 {
		parts = append([]string{head[len(head)-2:]}, parts...)
		head = head[:len(head)-2]
	}
	if head != "" {
		parts = append([]string{head}, parts...)
	}
	return strings.Join(append(parts, tail), ",")
}

func groupThousands(d string) string {
	var parts []string
	for len(d) > 3 {
		parts = append([]string{d[len(d)-3:]}, parts...)
		d = d[:len(d)-3]
	}
	return strings.Join(append([]string{d}, parts...), ",")
}
