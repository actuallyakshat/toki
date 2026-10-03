import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";
import { Wordmark } from "./chrome";
import { T } from "./text";

/** Sign-in and sign-up: the wordmark, the 時 mark, a modest headline and the form on warm paper. */
export function AuthShell({
  title,
  lead,
  children,
  footer,
}: {
  title: string;
  lead: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 20,
        }}
      >
        <Wordmark />
        <View style={{ marginTop: 56 }}>
          <T style={{ fontSize: 46, lineHeight: 50, color: c.border }} accessibilityElementsHidden importantForAccessibility="no">
            時
          </T>
          <T size="title" weight="medium" style={{ marginTop: 16 }} accessibilityRole="header">
            {title}
          </T>
          <T size="lead" tone="muted" style={{ marginTop: 8, lineHeight: 24 }}>
            {lead}
          </T>
        </View>
        <View style={{ marginTop: 28, gap: 4 }}>{children}</View>
        <View style={{ flex: 1 }} />
        <View style={{ marginTop: 32 }}>{footer}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
