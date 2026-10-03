import { router } from "expo-router";
import { ChevronDown, Clock, LayoutGrid, ListOrdered, Plus } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useApp } from "@/lib/app-state";
import { formatMoney, formatTotalHours } from "@/lib/format";
import { usePrefs, type Mode, type ViewKind } from "@/lib/prefs";
import { useTheme } from "@/theme/theme";
import { fonts } from "@/theme/tokens";
import { Button } from "./button";
import { ListIcon } from "./list-icon";
import { RollingText } from "./rolling-text";
import { Segmented } from "./segmented";
import { T } from "./text";

/**
 * List name (tap to switch lists), the total that rolls into hours of work, the ₹ ⇄ Hours toggle
 * and the Grid / Priority switch. Mirrors the website's wishlist header.
 */
export function WishlistHeader({ count, total }: { count: number; total: number }) {
  const { c } = useTheme();
  const { list, mode, income, currency, requestMode } = useApp();
  const { view, setView } = usePrefs();
  const text = mode === "time" && income ? formatTotalHours(total, income) : formatMoney(total, currency);

  return (
    <View style={{ paddingTop: 8, paddingBottom: 16, gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Pressable
            onPress={() => router.push("/lists")}
            accessibilityRole="button"
            accessibilityLabel={`${list?.name ?? "Wishlist"}. Switch lists`}
            hitSlop={8}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, opacity: pressed ? 0.6 : 1 })}
          >
            {list ? <ListIcon value={list.emoji} size={20} color={c.textMuted} /> : null}
            <T size="title" weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>
              {list?.name ?? " "}
            </T>
            <ChevronDown size={18} color={c.textFaint} />
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 6, marginTop: 4 }}>
            <RollingText
              value={text}
              animationKey={mode}
              style={{ fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22, color: c.text, fontVariant: ["tabular-nums"] }}
            />
            <T size="lead" tone="muted">
              across {count} {count === 1 ? "thing" : "things"}
            </T>
          </View>
        </View>
        <Button icon={Plus} onPress={() => router.push("/add")} accessibilityLabel="Add an item">
          Add
        </Button>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Segmented<Mode>
          value={mode}
          onChange={requestMode}
          options={[
            { value: "money", label: "₹", accessibilityLabel: "Show prices in rupees" },
            { value: "time", label: "Hours", icon: Clock, accessibilityLabel: "Show prices in hours of work" },
          ]}
        />
        <Segmented<ViewKind>
          value={view}
          onChange={setView}
          options={[
            { value: "grid", icon: LayoutGrid, accessibilityLabel: "Grid" },
            { value: "priority", icon: ListOrdered, accessibilityLabel: "Priority" },
          ]}
        />
      </View>
    </View>
  );
}
