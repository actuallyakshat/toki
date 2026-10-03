import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Check, Pencil, Plus } from "lucide-react-native";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { SheetHeader } from "@/components/chrome";
import { ListIcon } from "@/components/list-icon";
import { T } from "@/components/text";
import { useApp } from "@/lib/app-state";
import { formatMoney } from "@/lib/format";
import { useTheme } from "@/theme/theme";
import { radius } from "@/theme/tokens";

/** Every list as a hairline row; tap one to switch, or start a new one. */
export default function Lists() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { lists, list: current, setListId } = useApp();

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 20,
        paddingTop: Platform.OS === "android" ? insets.top + 16 : 20,
        paddingBottom: insets.bottom + 32,
      }}
    >
      <SheetHeader title="Lists" hint="Switch between your lists, or start a new one." />
      <View style={{ borderRadius: radius.card, borderWidth: 1, borderColor: c.border, overflow: "hidden" }}>
        {lists.map((l, i) => {
          const selected = l.id === current?.id;
          return (
            <Pressable
              key={l.id}
              onPress={() => {
                void Haptics.selectionAsync();
                setListId(l.id);
                router.back();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingHorizontal: 14,
                paddingVertical: 14,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: c.border,
                backgroundColor: pressed ? c.surfaceSunk : c.surface,
              })}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radius.control,
                  backgroundColor: c.surfaceSunk,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ListIcon value={l.emoji} size={16} color={c.text} />
              </View>
              <View style={{ flex: 1 }}>
                <T size="lead" weight="medium" numberOfLines={1}>
                  {l.name}
                </T>
                <T size="caption" tone="muted" tabular>
                  {l.item_count} {l.item_count === 1 ? "thing" : "things"} · {formatMoney(l.total_minor, l.currency)}
                  {l.visibility === "link" ? " · Shared" : ""}
                </T>
              </View>
              {selected && <Check size={18} color={c.text} />}
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
        <Button icon={Plus} onPress={() => router.replace("/list-edit")}>
          New list
        </Button>
        {current && (
          <Button
            variant="secondary"
            icon={Pencil}
            onPress={() => router.replace({ pathname: "/list-edit", params: { id: current.id } })}
          >
            Edit {current.name}
          </Button>
        )}
      </View>
    </ScrollView>
  );
}
