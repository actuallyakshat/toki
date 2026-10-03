import { describe, expect, it } from "vitest";
import { DEFAULT_LIST_ICON, iconKey, iconValue, listEmojiText } from "@/lib/list-icon-value";
import { minorToInput, parseMinor } from "@/lib/money-input";
import { findSettingsSection, SETTINGS_SECTIONS, settingsHref } from "@/lib/settings-sections";

describe("parseMinor", () => {
  it.each([
    ["12,999", 1_299_900],
    ["12999.50", 1_299_950],
    ["₹ 1,00,000", 10_000_000],
    ["0.015", 2],
  ])("%s → %i", (text, want) => {
    expect(parseMinor(text)).toBe(want);
  });
  it.each(["", "abc", "0", "0.00", "1.2.3"])("rejects %j", (text) => {
    expect(parseMinor(text)).toBeNull();
  });
  it("round-trips through minorToInput", () => {
    expect(minorToInput(1_299_950)).toBe("12999.5");
    expect(minorToInput(null)).toBe("");
    expect(minorToInput(0)).toBe("");
    expect(parseMinor(minorToInput(1_299_950))).toBe(1_299_950);
  });
});

describe("list icon values", () => {
  it("encodes and decodes icon keys", () => {
    expect(iconValue("gift")).toBe("i:gift");
    expect(iconKey("i:gift")).toBe("gift");
    expect(iconKey(DEFAULT_LIST_ICON)).toBe("sparkles");
    expect(iconKey("🎁")).toBeNull();
    expect(iconKey(undefined)).toBeNull();
  });
  it("shows text only for legacy emoji", () => {
    expect(listEmojiText("🎁")).toBe("🎁");
    expect(listEmojiText("i:gift")).toBe("");
    expect(listEmojiText(null)).toBe("");
  });
  it("keeps the default icon within the server's 64-character limit", () => {
    expect([...DEFAULT_LIST_ICON].length).toBeLessThanOrEqual(64);
  });
});

describe("settings sections", () => {
  it("has unique ids and finds each by id", () => {
    const ids = SETTINGS_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(findSettingsSection(id)?.id).toBe(id);
    expect(findSettingsSection("billing")).toBeUndefined();
    expect(findSettingsSection(undefined)).toBeUndefined();
    expect(settingsHref("alerts")).toBe("/app/settings/alerts");
  });
});
