"use client";

import { useSyncExternalStore } from "react";
import type { Income } from "./format";

const KEY = "toki.income";
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedValue: Income | null = null;

function read(): Income | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    const v = raw ? JSON.parse(raw) : null;
    cachedValue = v && v.monthly_income_minor > 0 && v.hours_per_week > 0 ? v : null;
  } catch {
    cachedValue = null;
  }
  return cachedValue;
}

export function saveDeviceIncome(income: Income | null) {
  try {
    if (income) localStorage.setItem(KEY, JSON.stringify(income));
    else localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((l) => l());
}

export function useDeviceIncome(): Income | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => null,
  );
}
