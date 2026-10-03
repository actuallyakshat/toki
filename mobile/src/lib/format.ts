import type { Profile } from "./types";

/**
 * Formatting shared with web (`web/src/lib/format.ts`). Hermes has Intl.NumberFormat and
 * DateTimeFormat but not RelativeTimeFormat, so relative times are written out by hand.
 */

const formatters = new Map<string, Intl.NumberFormat>();

/** Whole-unit currency string from minor units, e.g. 1299900 -> "₹12,999". */
export function formatMoney(minor: number, currency = "INR"): string {
  let f = formatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 });
    formatters.set(currency, f);
  }
  return f.format(minor / 100);
}

export interface Income {
  monthly_income_minor: number;
  hours_per_week: number;
}

export function incomeFromProfile(p: Profile | undefined, device: Income | null): Income | null {
  if (!p) return null;
  if (p.income_storage === "device") return device;
  if (p.monthly_income_minor && p.hours_per_week) {
    return { monthly_income_minor: p.monthly_income_minor, hours_per_week: p.hours_per_week };
  }
  return null;
}

/** Hours of work a price costs. hourly = monthly / (hours_per_week * 52 / 12). */
export function workHours(priceMinor: number, income: Income): number {
  const hourlyMinor = income.monthly_income_minor / ((income.hours_per_week * 52) / 12);
  return priceMinor / hourlyMinor;
}

const trim = (n: number) => String(Math.round(n * 10) / 10);

/** < 1 h -> "40 min"; < 48 h -> "12 h 30 min"; else working days "6.5 workdays". */
export function formatWork(hours: number, hoursPerWeek: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) {
    let h = Math.floor(hours);
    let m = Math.round((hours - h) * 60);
    if (m === 60) {
      h += 1;
      m = 0;
    }
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
  }
  return `${trim(hours / (hoursPerWeek / 5))} workdays`;
}

export function formatTime(priceMinor: number, income: Income): string {
  return formatWork(workHours(priceMinor, income), income.hours_per_week);
}

/** Header total in time mode, e.g. "2,300 h of work". */
export function formatTotalHours(priceMinor: number, income: Income): string {
  const h = Math.round(workHours(priceMinor, income));
  return `${new Intl.NumberFormat("en-IN").format(h)} h of work`;
}

/** "3 h ago" style text for the last check. */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.round((now - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

const DAY_MONTH = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
export const formatDayMonth = (iso: string) => DAY_MONTH.format(new Date(iso));

const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
export const formatDate = (iso: string) => DAY_MONTH_YEAR.format(new Date(iso));

export const RETAILER_NAMES: Record<string, string> = {
  amazon_in: "Amazon.in",
  flipkart: "Flipkart",
  myntra: "Myntra",
  shopify: "Shopify store",
  generic: "Web",
};

function hostname(url: string): string | null {
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#:]+)/i.exec(url.trim());
  return m ? m[1].toLowerCase() : null;
}

export function retailerName(retailer: string, url: string): string {
  if (retailer !== "generic" && RETAILER_NAMES[retailer]) return RETAILER_NAMES[retailer];
  return hostname(url)?.replace(/^www\./, "") ?? RETAILER_NAMES.generic;
}

export function faviconUrl(url: string): string {
  const host = hostname(url);
  return host ? `https://www.google.com/s2/favicons?domain=${host}&sz=32` : "";
}

/** True while a "wait 30 days" period is still running. */
export function isCooling(until: string | null | undefined): until is string {
  return Boolean(until) && Date.parse(until as string) > Date.now();
}
