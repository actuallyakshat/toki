import type { Profile } from './types';

export type TimeCost =
  | { kind: 'minutes'; minutes: number }
  | { kind: 'hours'; hours: number; minutes: number }
  | { kind: 'workdays'; days: number };

/** CONTRACT.md "Time conversion". Returns null when the profile has no income. */
export function timeCost(priceMinor: number, profile: Profile | null): TimeCost | null {
  const income = profile?.monthly_income_minor;
  const weekly = profile?.hours_per_week;
  if (!income || !weekly || priceMinor <= 0) return null;

  const hourlyMinor = income / ((weekly * 52) / 12);
  const hours = priceMinor / hourlyMinor;
  const workday = weekly / 5;

  if (hours < 1) return { kind: 'minutes', minutes: Math.max(1, Math.round(hours * 60)) };
  if (hours < workday) {
    let whole = Math.floor(hours);
    let minutes = Math.round((hours - whole) * 60);
    if (minutes === 60) {
      whole += 1;
      minutes = 0;
    }
    return { kind: 'hours', hours: whole, minutes };
  }
  const days = Math.round((hours / workday) * 10) / 10;
  return { kind: 'workdays', days };
}

export function timeAgo(timestamp: number, now = Date.now()): string {
  const minutes = Math.floor((now - timestamp) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}
