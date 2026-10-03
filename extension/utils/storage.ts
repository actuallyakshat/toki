import { storage } from 'wxt/utils/storage';
import type { User } from './types';

export const DEFAULT_API_ORIGIN = 'http://localhost:8080';
export const DEFAULT_WEB_ORIGIN = 'http://localhost:3000';

export interface Settings {
  apiOrigin: string;
  webOrigin: string;
}

export interface Auth {
  token: string;
  user: User;
}

export interface Tracking {
  enabled: boolean;
  lastRun: { at: number; checked: number; failed: number } | null;
}

export const settingsItem = storage.defineItem<Settings>('local:settings', {
  fallback: { apiOrigin: DEFAULT_API_ORIGIN, webOrigin: DEFAULT_WEB_ORIGIN },
});
export const authItem = storage.defineItem<Auth | null>('local:auth', { fallback: null });
export const trackingItem = storage.defineItem<Tracking>('local:tracking', {
  fallback: { enabled: false, lastRun: null },
});

export function normaliseOrigin(input: string): string | null {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}
