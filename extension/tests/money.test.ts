import { describe, expect, it } from 'vitest';
import { parsePriceMinor, formatAmountInput } from '@/utils/money';
import { timeCost } from '@/utils/time';

describe('parsePriceMinor', () => {
  it.each([
    ['₹1,29,999.00', 12999900],
    ['Rs. 499', 49900],
    ['₹ 12,499', 1249900],
    ['1299.5', 129950],
    ['INR 89,999', 8999900],
    ['1.299,50', 129950],
    ['1,299', 129900],
    ['499,50', 49950],
    ['₹1,29,999.', 12999900],
  ])('parses %s', (raw, minor) => expect(parsePriceMinor(raw)).toBe(minor));

  it('accepts numbers and rejects junk', () => {
    expect(parsePriceMinor(1299.99)).toBe(129999);
    expect(parsePriceMinor('free')).toBeNull();
    expect(parsePriceMinor('0')).toBeNull();
    expect(parsePriceMinor(undefined)).toBeNull();
  });

  it('formats for the input field', () => {
    expect(formatAmountInput(12999900)).toBe('1,29,999');
    expect(formatAmountInput(49950)).toBe('499.50');
  });
});

describe('timeCost', () => {
  const profile = {
    currency: 'INR',
    monthly_income_minor: 15000000,
    hours_per_week: 45,
    income_storage: 'server' as const,
    alert_mode: 'instant' as const,
    email_alerts: true,
  };

  it('returns null without income', () => {
    expect(timeCost(100000, { ...profile, monthly_income_minor: null })).toBeNull();
    expect(timeCost(100000, null)).toBeNull();
  });

  it('uses minutes, hours and workdays', () => {
    // hourly = 150000 / (45 * 52 / 12) = 769.23 rupees
    expect(timeCost(30000, profile)).toEqual({ kind: 'minutes', minutes: 23 });
    expect(timeCost(500000, profile)).toEqual({ kind: 'hours', hours: 6, minutes: 30 });
    // 13 h at a 9 h workday (45 h / 5)
    expect(timeCost(1000000, profile)).toEqual({ kind: 'workdays', days: 1.4 });
    const days = timeCost(12999900, profile);
    expect(days).toEqual({ kind: 'workdays', days: 18.8 });
  });
});
