export type Currency = string;

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export type IncomeStorage = "server" | "device";
export type AlertMode = "instant" | "digest";

export interface Profile {
  currency: Currency;
  monthly_income_minor: number | null;
  hours_per_week: number | null;
  income_storage: IncomeStorage;
  alert_mode: AlertMode;
  email_alerts: boolean;
}

export type Retailer = "amazon_in" | "flipkart" | "myntra" | "shopify" | "generic";
export type CheckStatus = "ok" | "failed" | "pending";

export interface Product {
  id: string;
  url: string;
  retailer: Retailer;
  title: string;
  image_url: string;
  currency: Currency;
  current_price_minor: number;
  original_price_minor: number | null;
  in_stock: boolean;
  last_checked_at: string | null;
  last_check_status: CheckStatus;
}

export type AlertRule = { type: "any_drop" } | { type: "below_target" } | { type: "percent_drop"; percent: number };

export type ItemStatus = "wanted" | "bought" | "removed";

export interface ItemStats {
  lowest_minor: number;
  highest_minor: number;
  change_since_added_minor: number;
}

export interface Item {
  id: string;
  list_id: string;
  product: Product;
  added_price_minor: number;
  target_price_minor: number | null;
  alert_rule: AlertRule;
  note: string;
  position: number;
  status: ItemStatus;
  cooling_until: string | null;
  created_at: string;
  /** When it was marked bought; null for wanted items and for items bought before this was recorded. */
  bought_at: string | null;
  stats: ItemStats;
}

export type PublicItem = Omit<Item, "note" | "alert_rule" | "target_price_minor">;

export type Visibility = "private" | "link";

export interface List {
  id: string;
  name: string;
  /** `i:<key>` for a lucide icon (see lib/list-icon-value), or a plain emoji on older lists. */
  emoji: string;
  visibility: Visibility;
  share_slug: string;
  item_count: number;
  total_minor: number;
  currency: Currency;
  created_at: string;
}

export interface Capture {
  source_url: string;
  title: string;
  image_url: string;
  price_minor: number;
  currency: Currency;
  original_price_minor: number | null;
  in_stock: boolean;
  retailer: Retailer;
}

export interface PricePoint {
  price_minor: number;
  currency: Currency;
  in_stock: boolean;
  checked_at: string;
  source: "api" | "fetch" | "extension";
}

export interface Stats {
  currency: Currency;
  item_count: number;
  total_minor: number;
  saved_by_drops_minor: number;
  removed_value_minor: number;
}

export interface PublicList {
  list: { name: string; emoji: string; owner_name: string };
  items: PublicItem[];
}

export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_failed"
  | "email_taken"
  | "invalid_credentials"
  | "extract_failed"
  | "unsupported_url"
  | "internal";
