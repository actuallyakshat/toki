import { describe, expect, it } from 'vitest';
import { timeAgo, timeCost } from '@/utils/time';
import type { Profile } from '@/utils/types';

// ₹1,50,000 a month at 45 h/week → 195 h/month → ₹769.23/h.
const profile = (over: Partial<Profile> = {}): Profile => ({
  currency: 'INR',
  monthly_income_minor: 15_000_000,
  hours_per_week: 45,
  income_storage: 'server',
  alert_mode: 'instant',
  email_alerts: true,
  ...over,
});

describe('timeCost (CONTRACT.md time conversion)', () => {
  it('returns null without income, hours or a positive price', () => {
    expect(timeCost(1000, null)).toBeNull();
    expect(timeCost(1000, profile({ monthly_income_minor: null }))).toBeNull();
    expect(timeCost(1000, profile({ hours_per_week: null }))).toBeNull();
    expect(timeCost(0, profile())).toBeNull();
    expect(timeCost(-5, profile())).toBeNull();
  });

  it('uses minutes under an hour, never less than 1', () => {
    expect(timeCost(50_000, profile())).toEqual({ kind: 'minutes', minutes: 39 }); // ₹500
    expect(timeCost(1, profile())).toEqual({ kind: 'minutes', minutes: 1 });
  });

  it('uses hours and minutes under one workday', () => {
    // ₹1,00,000 a month at 40 h/week: 173.33 h/month → hourly 57692.3 minor.
    const p = profile({ monthly_income_minor: 10_000_000, hours_per_week: 40 });
    expect(timeCost(57_693, p)).toEqual({ kind: 'hours', hours: 1, minutes: 0 });
    expect(timeCost(57_692 * 6.5, p)).toEqual({ kind: 'hours', hours: 6, minutes: 30 });
  });

  it('rounds 59.5+ minutes up into the next hour', () => {
    const p = profile({ monthly_income_minor: 10_000_000, hours_per_week: 40 });
    const hourly = 10_000_000 / ((40 * 52) / 12);
    expect(timeCost(hourly * 2.995, p)).toEqual({ kind: 'hours', hours: 3, minutes: 0 });
  });

  it('uses workdays of hours_per_week / 5 from one workday', () => {
    const p = profile({ monthly_income_minor: 10_000_000, hours_per_week: 40 });
    const hourly = 10_000_000 / ((40 * 52) / 12);
    expect(timeCost(hourly * 8, p)).toEqual({ kind: 'workdays', days: 1 });
    expect(timeCost(hourly * 34.65, p)).toEqual({ kind: 'workdays', days: 4.3 });
    expect(timeCost(hourly * 52, p)).toEqual({ kind: 'workdays', days: 6.5 });
  });
});

describe('timeAgo', () => {
  const now = 1_700_000_000_000;
  it.each([
    [0, 'just now'],
    [59_000, 'just now'],
    [60_000, '1 min ago'],
    [59 * 60_000, '59 min ago'],
    [60 * 60_000, '1 h ago'],
    [23 * 3_600_000, '23 h ago'],
    [24 * 3_600_000, '1 d ago'],
    [10 * 86_400_000, '10 d ago'],
  ])('%i ms ago → %s', (delta, want) => {
    expect(timeAgo(now - delta, now)).toBe(want);
  });
});
