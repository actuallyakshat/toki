import * as Haptics from "expo-haptics";
import { Tabs, type BottomTabBarProps } from "expo-router/js-tabs";
import { CheckCheck, LayoutGrid, Settings, type LucideIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "@/components/text";
import { useTheme } from "@/theme/theme";

const ICONS: Record<string, LucideIcon> = { index: LayoutGrid, bought: CheckCheck, settings: Settings };

export default function AppTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: "Wishlist" }} />
      <Tabs.Screen name="bought" options={{ title: "Bought" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}

/** The website's icon rail, laid along the bottom: porcelain, a hairline on top, monochrome lucide icons. */
function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        backgroundColor: c.bg,
        borderTopWidth: 1,
        borderTopColor: c.border,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingTop: 6,
      }}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const Icon = ICONS[route.name] ?? LayoutGrid;
        const label = descriptors[route.key].options.title ?? route.name;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                void Haptics.selectionAsync();
                navigation.navigate(route.name, route.params);
              }
            }}
            style={{ flex: 1, alignItems: "center", gap: 3, paddingVertical: 6 }}
          >
            <Icon size={20} color={focused ? c.text : c.textFaint} strokeWidth={focused ? 2.1 : 1.75} />
            <T
              size="caption"
              weight={focused ? "medium" : "regular"}
              tone={focused ? "default" : "faint"}
              style={{ fontSize: 11 }}
            >
              {label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}
