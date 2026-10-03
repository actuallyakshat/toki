package store

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type Profile struct {
	Currency           string `json:"currency"`
	MonthlyIncomeMinor *int64 `json:"monthly_income_minor"`
	HoursPerWeek       *int   `json:"hours_per_week"`
	IncomeStorage      string `json:"income_storage"`
	AlertMode          string `json:"alert_mode"`
	EmailAlerts        bool   `json:"email_alerts"`
}

type List struct {
	ID         uuid.UUID `json:"id"`
	Name       string    `json:"name"`
	Emoji      string    `json:"emoji"`
	Visibility string    `json:"visibility"`
	ShareSlug  string    `json:"share_slug"`
	ItemCount  int       `json:"item_count"`
	TotalMinor int64     `json:"total_minor"`
	Currency   string    `json:"currency"`
	CreatedAt  time.Time `json:"created_at"`
}

type Product struct {
	ID                 uuid.UUID  `json:"id"`
	URL                string     `json:"url"`
	Retailer           string     `json:"retailer"`
	Title              string     `json:"title"`
	ImageURL           string     `json:"image_url"`
	Currency           string     `json:"currency"`
	CurrentPriceMinor  int64      `json:"current_price_minor"`
	OriginalPriceMinor *int64     `json:"original_price_minor"`
	InStock            bool       `json:"in_stock"`
	LastCheckedAt      *time.Time `json:"last_checked_at"`
	LastCheckStatus    string     `json:"last_check_status"`
}

type ItemStats struct {
	LowestMinor           int64 `json:"lowest_minor"`
	HighestMinor          int64 `json:"highest_minor"`
	ChangeSinceAddedMinor int64 `json:"change_since_added_minor"`
}

type Item struct {
	ID               uuid.UUID       `json:"id"`
	ListID           uuid.UUID       `json:"list_id"`
	Product          Product         `json:"product"`
	AddedPriceMinor  int64           `json:"added_price_minor"`
	TargetPriceMinor *int64          `json:"target_price_minor"`
	AlertRule        json.RawMessage `json:"alert_rule"`
	Note             string          `json:"note"`
	Position         int             `json:"position"`
	Status           string          `json:"status"`
	CoolingUntil     *time.Time      `json:"cooling_until"`
	CreatedAt        time.Time       `json:"created_at"`
	BoughtAt         *time.Time      `json:"bought_at"`
	Stats            ItemStats       `json:"stats"`
}

type PricePoint struct {
	PriceMinor int64     `json:"price_minor"`
	Currency   string    `json:"currency"`
	InStock    bool      `json:"in_stock"`
	CheckedAt  time.Time `json:"checked_at"`
	Source     string    `json:"source"`
}

// AlertRule is the parsed form of items.alert_rule.
type AlertRule struct {
	Type    string `json:"type"`
	Percent int    `json:"percent,omitempty"`
}
