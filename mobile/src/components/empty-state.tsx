import { router } from "expo-router";
import { Link2 } from "lucide-react-native";
import { View } from "react-native";
import { useTheme } from "@/theme/theme";
import { Button } from "./button";
import { T } from "./text";

/** One direction, as on the website. */
export function EmptyState() {
  const { c } = useTheme();
  return (
    <View style={{ paddingVertical: 48, alignItems: "flex-start" }}>
      <T style={{ fontSize: 46, lineHeight: 50, color: c.border }} importantForAccessibility="no">
        時
      </T>
      <T size="title" weight="semibold" style={{ marginTop: 16 }}>
        Nothing here yet.
      </T>
      <T size="lead" tone="muted" style={{ marginTop: 12, lineHeight: 24 }}>
        Paste a product link, or install the extension and press Add on any store.
      </T>
      <T tone="muted" style={{ marginTop: 8 }}>
        Prices update when the Toki extension runs in your browser.
      </T>
      <Button icon={Link2} onPress={() => router.push("/add")} style={{ marginTop: 24 }}>
        Paste a link
      </Button>
    </View>
  );
}
