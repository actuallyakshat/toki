"use client";

import type { Profile } from "./types";

/** Per user, so a shared browser asks each account once. */
const key = (userId: string) => `toki.onboarding.salary.${userId}`;

/**
 * True when this account has never given a salary and has not chosen
 * "I'll do it later" on this browser. A device-only profile has given one,
 * just not here, so the Hours switch asks for it instead.
 */
export function needsSalaryOnboarding(userId: string, profile: Profile): boolean {
  if (profile.income_storage === "device" || profile.monthly_income_minor) return false;
  try {
    return localStorage.getItem(key(userId)) === null;
  } catch {
    return false;
  }
}

export function deferSalaryOnboarding(userId: string) {
  try {
    localStorage.setItem(key(userId), "later");
  } catch {}
}
