import Constants from "expo-constants";
import { LogOut, Monitor, Moon, Sun } from "lucide-react-native";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { Hairline, Row } from "@/components/chrome";
import { IncomeForm } from "@/components/income-form";
import { Segmented } from "@/components/segmented";
import { Label, T } from "@/components/text";
import { useToast } from "@/components/toast";
import { errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { useUpdateProfile } from "@/lib/hooks";
import { usePrefs, type ThemePref } from "@/lib/prefs";
import { useSession } from "@/lib/session";
import type { AlertMode } from "@/lib/types";
import { useTheme } from "@/theme/theme";
import { space } from "@/theme/tokens";

/** Full-width rows grouped like the website's settings nav: Account, Prices, Device. */
export default function Settings() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const notify = useToast();
  const { user, profile } = useApp();
  const { theme, setTheme } = usePrefs();
  const { origin, signOut } = useSession();
  const update = useUpdateProfile();

  const savePref = (patch: { email_alerts?: boolean; alert_mode?: AlertMode }) =>
    update.mutate(patch, {
      onError: (e) =>
        notify({ status: "error", title: "Toki could not save that setting", description: errorMessage(e, "Try again.") }),
    });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: space.gutter, paddingBottom: 48 }}
      >
        <T size="title" weight="medium" accessibilityRole="header">
          Settings
        </T>

        <Group label="Account">
          <Row title={user?.name || "Your account"} hint={user?.email} />
          <Hairline />
          <Row title="Theme" hint="Follows your phone until you pick one." stacked>
            <Segmented<ThemePref>
              value={theme}
              onChange={setTheme}
              fill
              options={[
                { value: "system", label: "System", icon: Monitor },
                { value: "light", label: "Light", icon: Sun },
                { value: "dark", label: "Dark", icon: Moon },
              ]}
            />
          </Row>
        </Group>

        <Group label="Prices">
          <Row
            title="Hours of work"
            hint="Your monthly in-hand salary and weekly hours turn every price into time. The time switch on your wishlist uses these."
            stacked
          >
            {profile && (
              <IncomeForm
                submitLabel="Save"
                onSaved={() => notify({ status: "success", title: "Salary saved", description: "Hours of work are up to date." })}
              />
            )}
          </Row>
          <Hairline />
          <Row title="Email alerts" hint="One email for each new drop. Toki never repeats a price it already told you about.">
            <Switch
              value={profile?.email_alerts ?? true}
              onValueChange={(v) => savePref({ email_alerts: v })}
              trackColor={{ true: c.purple, false: c.raise }}
              thumbColor="#ffffff"
              ios_backgroundColor={c.raise}
              accessibilityLabel="Email alerts"
            />
          </Row>
          {profile?.email_alerts !== false && (
            <View style={{ paddingBottom: 16 }}>
              <Segmented<AlertMode>
                value={profile?.alert_mode ?? "instant"}
                onChange={(v) => savePref({ alert_mode: v })}
                fill
                options={[
                  { value: "instant", label: "Right away" },
                  { value: "digest", label: "Weekly digest" },
                ]}
              />
              <T size="caption" tone="faint" style={{ marginTop: 8 }}>
                {profile?.alert_mode === "digest"
                  ? "One email every Monday at 9:00 IST with the week's drops."
                  : "An email as soon as a price drops."}
              </T>
            </View>
          )}
        </Group>

        <Group label="Prices update from your browser">
          <T tone="muted" style={{ paddingVertical: 16, lineHeight: 20 }}>
            Prices update when the Toki Chrome extension runs on your computer. Without it, your list keeps the price it had when
            you added it. Refresh price on an item queues a check for the next run.
          </T>
        </Group>

        <Group label="Device">
          <Row title="Server" hint={origin.replace(/^https?:\/\//, "")} />
          <Hairline />
          <Row title="Version" hint={`Toki ${Constants.expoConfig?.version ?? ""}`} />
          <Hairline />
          <View style={{ paddingVertical: 16 }}>
            <Button
              variant="danger"
              icon={LogOut}
              style={{ alignSelf: "flex-start" }}
              onPress={() =>
                Alert.alert("Sign out of Toki?", "Your wishlist stays on your account.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Sign out", style: "destructive", onPress: () => void signOut() },
                ])
              }
            >
              Sign out
            </Button>
          </View>
        </Group>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ marginTop: 32 }}>
      <Label>{label}</Label>
      <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: c.border }}>{children}</View>
    </View>
  );
}
