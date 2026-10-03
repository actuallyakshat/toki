import { router } from "expo-router";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SheetHeader } from "@/components/chrome";
import { IncomeForm } from "@/components/income-form";
import { usePrefs } from "@/lib/prefs";

/** Opened by the time toggle when no salary is set. Saving switches every price to hours. */
export default function IncomeSheet() {
  const insets = useSafeAreaInsets();
  const { setMode } = usePrefs();
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 20,
          paddingTop: Platform.OS === "android" ? insets.top + 16 : 20,
          paddingBottom: insets.bottom + 32,
        }}
      >
        <SheetHeader
          title="See prices as hours of work"
          hint="Toki divides each price by what you earn in an hour. Use your monthly in-hand salary."
        />
        <IncomeForm
          submitLabel="Show hours"
          onSaved={() => {
            router.back();
            // Let the sheet close first so the roll plays on the wishlist.
            setTimeout(() => setMode("time"), 350);
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
