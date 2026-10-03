/**
 * List icons are stored in the list's `emoji` field as `i:<key>` (see components/shared/list-icon).
 * Keys stay short: the server allows 16 characters. Older lists hold a plain emoji instead.
 */
export const DEFAULT_LIST_ICON = "i:sparkles";

export function iconValue(key: string) {
  return `i:${key}`;
}

/** The icon key in a stored value, or null when the value is a legacy emoji or empty. */
export function iconKey(value: string | undefined | null): string | null {
  return value?.startsWith("i:") ? value.slice(2) : null;
}

/** Text for places that cannot draw an icon, like page titles: the emoji for legacy lists, nothing for icons. */
export function listEmojiText(value: string | undefined | null) {
  return value && iconKey(value) === null ? value : "";
}
