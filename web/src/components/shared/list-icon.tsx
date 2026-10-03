"use client";

import { List } from "lucide-react";
import { DynamicIcon, iconNames, type IconName } from "lucide-react/dynamic";
import { iconKey } from "@/lib/list-icon-value";
import { cn } from "@/lib/utils";

/**
 * List icons are any of lucide's ~1,800 monochrome icons, stored in the list's `emoji` field as
 * `i:<lucide-name>` and loaded one at a time on demand. Lists made before icons keep their emoji
 * until someone picks an icon in Edit list.
 */
const NAMES = new Set<string>(iconNames);

/** Short keys from the first, curated icon set, kept so lists saved with them still resolve. */
const LEGACY_KEYS: Record<string, IconName> = {
  bag: "shopping-bag",
  cart: "shopping-cart",
  home: "house",
  sofa: "armchair",
  plant: "sprout",
  kitchen: "utensils",
  party: "party-popper",
  diya: "flame",
  phone: "smartphone",
  gamepad: "gamepad-2",
  work: "briefcase",
  gym: "dumbbell",
  travel: "plane",
  camping: "tent",
  pet: "dog",
};

/** Shown first in the picker, before the full alphabetical set. */
export const SUGGESTED_ICONS: IconName[] = [
  "sparkles", "gift", "heart", "star", "tag", "shopping-bag", "shopping-cart", "wallet",
  "house", "armchair", "lamp", "sprout", "utensils", "coffee", "cake", "party-popper",
  "flame", "shirt", "glasses", "watch", "gem", "laptop", "smartphone", "monitor",
  "keyboard", "headphones", "camera", "tv", "gamepad-2", "music", "book", "palette",
  "briefcase", "dumbbell", "bike", "car", "plane", "tent", "baby", "dog",
];

/** Every lucide icon name, suggested ones first. */
export const ALL_ICON_NAMES: IconName[] = [...SUGGESTED_ICONS, ...iconNames.filter((n) => !SUGGESTED_ICONS.includes(n))];

/** The lucide name behind a stored value, or null for emoji, empty or unknown values. */
export function resolveIconName(value: string | undefined | null): IconName | null {
  const key = iconKey(value);
  if (!key) return null;
  const name = LEGACY_KEYS[key] ?? key;
  return NAMES.has(name) ? (name as IconName) : null;
}

/** "shopping-bag" → "Shopping bag". */
export function iconLabel(name: string) {
  const words = name.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A list's icon. Emoji show as they are; unknown icon names fall back to a plain list icon. */
export function ListIcon({ value, className }: { value: string | undefined | null; className?: string }) {
  if (value && iconKey(value) === null) {
    return (
      <span aria-hidden className={cn("grid size-4 place-items-center text-[13px] leading-none", className)}>
        {value}
      </span>
    );
  }
  const name = resolveIconName(value);
  if (!name) return <List aria-hidden className={cn("size-4", className)} />;
  return (
    <DynamicIcon
      name={name}
      aria-hidden
      className={cn("size-4", className)}
      // Same box while the icon's chunk loads, so nothing shifts.
      fallback={() => <span aria-hidden className={cn("inline-block size-4", className)} />}
    />
  );
}
