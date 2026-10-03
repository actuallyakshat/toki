import { Bell, Clock, Palette, Puzzle, SlidersHorizontal, type LucideIcon } from "lucide-react";

export type SettingsSectionId = "general" | "appearance" | "hours" | "alerts" | "extension";

export interface SettingsSection {
  id: SettingsSectionId;
  label: string;
  description: string;
  group: string;
  icon: LucideIcon;
}

/** Settings pages, in sidebar order. The settings sidebar groups them by `group`, after monocode. */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: "general", label: "General", description: "Your account and the currency Toki shows prices in.", group: "Account", icon: SlidersHorizontal },
  { id: "appearance", label: "Appearance", description: "Theme and how big product cards are.", group: "Account", icon: Palette },
  {
    id: "hours",
    label: "Hours of work",
    description: "Your monthly in-hand salary and weekly hours turn every price into time. The time switch on your wishlist uses these.",
    group: "Prices",
    icon: Clock,
  },
  {
    id: "alerts",
    label: "Email alerts",
    description: "Toki sends one email for each new drop. It never repeats a price it already told you about.",
    group: "Prices",
    icon: Bell,
  },
  {
    id: "extension",
    label: "Chrome extension",
    description: "Prices update when the Toki extension runs in your browser. Without it, your list keeps the price it had when you added it.",
    group: "Browser",
    icon: Puzzle,
  },
];

export const settingsHref = (id: SettingsSectionId) => `/app/settings/${id}`;

export function findSettingsSection(id: string | undefined): SettingsSection | undefined {
  return SETTINGS_SECTIONS.find((s) => s.id === id);
}
