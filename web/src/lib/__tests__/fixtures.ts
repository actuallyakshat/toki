import type { Item, List, Profile, User } from "@/lib/types";

export const item = (id: string, overrides: Partial<Item> = {}): Item => ({
  id,
  list_id: "l1",
  product: {
    id: `p-${id}`,
    url: `https://a.example/${id}`,
    retailer: "generic",
    title: `Item ${id}`,
    image_url: "",
    currency: "INR",
    current_price_minor: 1000,
    original_price_minor: null,
    in_stock: true,
    last_checked_at: null,
    last_check_status: "ok",
  },
  added_price_minor: 1000,
  target_price_minor: null,
  alert_rule: { type: "any_drop" },
  note: "",
  position: 0,
  status: "wanted",
  cooling_until: null,
  created_at: "2026-01-01T00:00:00.000Z",
  bought_at: null,
  stats: { lowest_minor: 1000, highest_minor: 1000, change_since_added_minor: 0 },
  ...overrides,
});

export const list = (id: string, overrides: Partial<List> = {}): List => ({
  id,
  name: `List ${id}`,
  emoji: "i:sparkles",
  visibility: "private",
  share_slug: `s-${id}`,
  item_count: 0,
  total_minor: 0,
  currency: "INR",
  created_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

export const user: User = { id: "u1", email: "a@example.com", name: "A", created_at: "2026-01-01T00:00:00.000Z" };

export const profile = (overrides: Partial<Profile> = {}): Profile => ({
  currency: "INR",
  monthly_income_minor: null,
  hours_per_week: null,
  income_storage: "server",
  alert_mode: "instant",
  email_alerts: true,
  ...overrides,
});

/** A promise the test resolves or rejects by hand, to inspect the cache mid-flight. */
export function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
