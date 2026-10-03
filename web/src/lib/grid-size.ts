"use client";

import { useSyncExternalStore } from "react";

export type GridSize = "small" | "medium" | "large";

const KEY = "toki.grid";
const listeners = new Set<() => void>();
let current: GridSize | null = null;

function read(): GridSize {
  if (current) return current;
  try {
    const saved = localStorage.getItem(KEY);
    current = saved === "small" || saved === "medium" ? saved : "large";
  } catch {
    current = "large";
  }
  return current;
}

export function setGridSize(size: GridSize) {
  current = size;
  try {
    localStorage.setItem(KEY, size);
  } catch {}
  listeners.forEach((l) => l());
}

/** The card size chosen for every product grid (wishlist, all items, bought). Saved per browser. */
export function useGridSize(): GridSize {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => "large",
  );
}

/** Column counts per size. Large is the original grid. */
export const GRID_CLASS: Record<GridSize, string> = {
  large: "grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  medium: "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6",
  small: "grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8",
};
