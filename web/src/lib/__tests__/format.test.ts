import { afterEach, describe, expect, it, vi } from "vitest";
import {
  faviconUrl,
  formatMoney,
  formatTime,
  formatTotalHours,
  formatWork,
  incomeFromProfile,
  isCooling,
  retailerName,
  timeAgo,
  workHours,
} from "@/lib/format";
import type { Profile } from "@/lib/types";

const profile = (over: Partial<Profile> = {}): Profile => ({
  currency: "INR",
  monthly_income_minor: 15_000_000,
  hours_per_week: 45,
  income_storage: "server",
  alert_mode: "instant",
  email_alerts: true,
  ...over,
});

// ₹1,00,000 a month at 40 h/week → 173.33 h a month → ₹576.92 an hour.
const income = { monthly_income_minor: 10_000_000, hours_per_week: 40 };
const hourly = 10_000_000 / ((40 * 52) / 12);

describe("formatMoney", () => {
  it("uses Indian grouping and whole units", () => {
    expect(formatMoney(1_299_900)).toBe("₹12,999");
    expect(formatMoney(1_00_00_000_00)).toBe("₹1,00,00,000");
    expect(formatMoney(49_950)).toBe("₹500"); // rounds to whole rupees
    expect(formatMoney(0)).toBe("₹0");
  });
  it("formats other currencies", () => {
    expect(formatMoney(123_456, "USD")).toBe("$1,235");
  });
});

describe("incomeFromProfile", () => {
  const device = { monthly_income_minor: 1, hours_per_week: 2 };
  it("reads server income", () => {
    expect(incomeFromProfile(profile(), device)).toEqual({ monthly_income_minor: 15_000_000, hours_per_week: 45 });
  });
  it("uses the device income when storage is device", () => {
    expect(incomeFromProfile(profile({ income_storage: "device", monthly_income_minor: null }), device)).toBe(device);
    expect(incomeFromProfile(profile({ income_storage: "device" }), null)).toBeNull();
  });
  it("is null without a profile or with missing fields", () => {
    expect(incomeFromProfile(undefined, device)).toBeNull();
    expect(incomeFromProfile(profile({ monthly_income_minor: null }), device)).toBeNull();
    expect(incomeFromProfile(profile({ hours_per_week: null }), device)).toBeNull();
  });
});

describe("work time (CONTRACT.md time conversion)", () => {
  it("computes hours from the monthly income", () => {
    expect(workHours(hourly * 3, income)).toBeCloseTo(3);
  });
  it.each([
    [0.01, "1 min"],
    [0.5, "30 min"],
    [1, "1 h"],
    [6.5, "6 h 30 min"],
    [2.995, "3 h"], // 59.7 min rounds up into the next hour, never "2 h 60 min"
    [7.9, "7 h 54 min"],
    [8, "1 workday"], // a workday is hours_per_week / 5
    [34.65, "4.3 workdays"],
    [52, "6.5 workdays"],
  ])("%f h → %s", (hours, want) => {
    expect(formatWork(hours, 40)).toBe(want);
  });
  it("formats a price as time and a total as hours", () => {
    expect(formatTime(hourly * 6.5, income)).toBe("6 h 30 min");
    expect(formatTime(hourly * 12, income)).toBe("1.5 workdays");
    expect(formatTotalHours(hourly * 2300, income)).toBe("2,300 h of work");
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-10-03T12:00:00Z");
  const ago = (s: number) => new Date(now - s * 1000).toISOString();
  it.each([
    [10, "just now"],
    [60, "1 min ago"],
    [59 * 60, "59 min ago"],
    [3 * 3600, "3 h ago"],
    [47 * 3600, "47 h ago"],
    [3 * 86400, "3 days ago"],
  ])("%i s → %s", (s, want) => {
    expect(timeAgo(ago(s), now)).toBe(want);
  });
});

describe("retailerName and faviconUrl", () => {
  it("names known retailers and falls back to the host", () => {
    expect(retailerName("amazon_in", "https://www.amazon.in/dp/X")).toBe("Amazon.in");
    expect(retailerName("generic", "https://www.bluetokai.com/products/x")).toBe("bluetokai.com");
    expect(retailerName("shopify", "https://x.myshopify.com")).toBe("Shopify store");
    expect(retailerName("generic", "not a url")).toBe("Web");
  });
  it("builds a favicon URL only for valid URLs", () => {
    expect(faviconUrl("https://www.myntra.com/123")).toBe("https://www.google.com/s2/favicons?domain=www.myntra.com&sz=32");
    expect(faviconUrl("nope")).toBe("");
  });
});

describe("isCooling", () => {
  afterEach(() => vi.useRealTimers());
  it("is true only while the date is in the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-03T00:00:00Z"));
    expect(isCooling("2026-10-04T00:00:00Z")).toBe(true);
    expect(isCooling("2026-10-02T00:00:00Z")).toBe(false);
    expect(isCooling(null)).toBe(false);
    expect(isCooling(undefined)).toBe(false);
    expect(isCooling("")).toBe(false);
  });
});
