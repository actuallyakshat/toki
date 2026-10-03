"use client";

import { useSyncExternalStore } from "react";

export type Mode = "money" | "time";

const KEY = "toki.mode";
const listeners = new Set<() => void>();

function read(): Mode {
  return document.documentElement.dataset.mode === "time" ? "time" : "money";
}

export function setMode(mode: Mode, { persist = true } = {}) {
  const root = document.documentElement;
  if (mode === "time") root.dataset.mode = "time";
  else delete root.dataset.mode;
  if (persist) {
    try {
      localStorage.setItem(KEY, mode);
    } catch {}
  }
  listeners.forEach((l) => l());
}

/** Applies the saved choice. Called when the app shell mounts. */
export function restoreMode() {
  try {
    setMode(localStorage.getItem(KEY) === "time" ? "time" : "money", { persist: false });
  } catch {}
}

export function useMode(): Mode {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => "money",
  );
}
