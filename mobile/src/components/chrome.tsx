import { router } from "expo-router";
import { X } from "lucide-react-native";
import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";
import { IconButton } from "./button";
import { T } from "./text";

/** "Toki 時" — the wordmark. */
export function Wordmark({ size = 17 }: { size?: number }) {
  const { c } = useTheme();
  return (
    <View accessible accessibilityLabel="Toki" style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
      <T style={{ fontFamily: fonts.semibold, fontSize: size, lineHeight: size * 1.2, letterSpacing: -0.04 * size }}>Toki</T>
      <T style={{ fontSize: size * 0.76, color: c.textMuted }}>時</T>
    </View>
  );
}

/** Title, optional hint and a close button at the top of every sheet. */
export function SheetHeader({ title, hint, onClose }: { title: string; hint?: string; onClose?: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
      <View style={{ flex: 1 }}>
        <T size="price" weight="semibold" accessibilityRole="header">
          {title}
        </T>
        {hint ? (
          <T tone="muted" style={{ marginTop: 4 }}>
            {hint}
          </T>
        ) : null}
      </View>
      <IconButton icon={X} label="Close" onPress={onClose ?? (() => router.back())} size={32} />
    </View>
  );
}

/** A hairline, the only divider Toki uses. */
export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ height: 1, backgroundColor: c.border }, style]} />;
}

/** A settings-style row: title and hint on the left, controls on the right or below. */
export function Row({
  title,
  hint,
  children,
  stacked,
}: {
  title: string;
  hint?: string;
  children?: ReactNode;
  stacked?: boolean;
}) {
  return (
    <View
      style={{
        paddingVertical: 16,
        gap: 12,
        flexDirection: stacked ? "column" : "row",
        alignItems: stacked ? "stretch" : "center",
      }}
    >
      <View style={{ flex: stacked ? undefined : 1, gap: 2 }}>
        <T size="lead" weight="medium">
          {title}
        </T>
        {hint ? <T tone="muted">{hint}</T> : null}
      </View>
      {children}
    </View>
  );
}

/** A sunk well for stats and previews. */
export function Well({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ borderRadius: radius.image, backgroundColor: c.surfaceSunk, padding: 14 }, style]}>{children}</View>;
}

/** Error line with a retry, in Toki's voice: what happened and what to do. */
export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={{ paddingVertical: 48, gap: 6 }}>
      <T size="lead">{message}</T>
      {onRetry && (
        <T weight="medium" onPress={onRetry} style={{ textDecorationLine: "underline" }} accessibilityRole="button">
          Try again
        </T>
      )}
    </View>
  );
}
