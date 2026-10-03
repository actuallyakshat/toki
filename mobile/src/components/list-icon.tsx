import { List as ListGlyph, type LucideIcon } from "lucide-react-native";
import * as icons from "lucide-react-native/icons";
import { Text } from "react-native";
import { iconKey } from "@/lib/list-icon-value";

/** Short keys from the website's first, curated icon set, kept so lists saved with them still resolve. */
const LEGACY_KEYS: Record<string, string> = {
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

/** Same order as the website's picker. */
export const SUGGESTED_ICONS = [
  "sparkles",
  "gift",
  "heart",
  "star",
  "tag",
  "shopping-bag",
  "shopping-cart",
  "wallet",
  "house",
  "armchair",
  "lamp",
  "sprout",
  "utensils",
  "coffee",
  "cake",
  "party-popper",
  "flame",
  "shirt",
  "glasses",
  "watch",
  "gem",
  "laptop",
  "smartphone",
  "monitor",
  "keyboard",
  "headphones",
  "camera",
  "tv",
  "gamepad-2",
  "music",
  "book",
  "palette",
  "briefcase",
  "dumbbell",
  "bike",
  "car",
  "plane",
  "tent",
  "baby",
  "dog",
];

/** "shopping-bag" -> "ShoppingBag", "gamepad-2" -> "Gamepad2". */
function pascal(name: string) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

const registry = icons as unknown as Record<string, LucideIcon | undefined>;

export function iconComponent(name: string): LucideIcon | null {
  return registry[pascal(LEGACY_KEYS[name] ?? name)] ?? null;
}

/** A list's icon: lucide icons are stored as `i:<name>`; lists made before icons keep their emoji. */
export function ListIcon({ value, size = 16, color }: { value: string | null | undefined; size?: number; color: string }) {
  if (value && iconKey(value) === null) {
    return <Text style={{ fontSize: size * 0.9, lineHeight: size * 1.15 }}>{value}</Text>;
  }
  const key = iconKey(value);
  const Icon = (key && iconComponent(key)) || ListGlyph;
  // Icons come from lucide's static registry, not created here, so the compiler's warning does not apply.
  // eslint-disable-next-line react-hooks/static-components
  return <Icon size={size} color={color} />;
}
