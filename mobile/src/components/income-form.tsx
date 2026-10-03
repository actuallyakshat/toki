import { useState } from "react";
import { Switch, View } from "react-native";
import { errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { useUpdateProfile } from "@/lib/hooks";
import { minorToInput, parseMinor } from "@/lib/money-input";
import { usePrefs } from "@/lib/prefs";
import { useTheme } from "@/theme/theme";
import { Button } from "./button";
import { Input } from "./input";
import { T } from "./text";

/** Monthly in-hand salary and weekly hours, with the option to keep both on this phone (as on the website). */
export function IncomeForm({ submitLabel, onSaved }: { submitLabel: string; onSaved?: () => void }) {
  const { c } = useTheme();
  const { profile, income } = useApp();
  const { deviceIncome, setDeviceIncome } = usePrefs();
  const update = useUpdateProfile();

  const [salary, setSalary] = useState(minorToInput(income?.monthly_income_minor));
  const [hours, setHours] = useState(String(income?.hours_per_week ?? 45));
  const [deviceOnly, setDeviceOnly] = useState(profile?.income_storage === "device" || (!income && deviceIncome !== null));
  const [errors, setErrors] = useState<{ salary?: string; hours?: string; form?: string }>({});

  async function submit() {
    const monthly = parseMinor(salary);
    const weekly = Number(hours);
    const next = {
      salary: monthly ? undefined : "Enter your monthly in-hand salary, for example 85000.",
      hours: weekly >= 1 && weekly <= 100 ? undefined : "Enter hours per week between 1 and 100.",
    };
    setErrors(next);
    if (!monthly || next.hours) return;
    try {
      await update.mutateAsync(
        deviceOnly
          ? { income_storage: "device", monthly_income_minor: null, hours_per_week: null }
          : { income_storage: "server", monthly_income_minor: monthly, hours_per_week: weekly },
      );
      setDeviceIncome(deviceOnly ? { monthly_income_minor: monthly, hours_per_week: weekly } : null);
      onSaved?.();
    } catch (e) {
      setErrors({ form: errorMessage(e, "Toki could not save your salary. Try again.") });
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <Input
        label="Monthly in-hand salary (₹)"
        keyboardType="number-pad"
        value={salary}
        onChangeText={setSalary}
        error={errors.salary}
        reserveErrorLine
        placeholder="85000"
      />
      <Input
        label="Hours you work per week"
        keyboardType="number-pad"
        value={hours}
        onChangeText={setHours}
        error={errors.hours}
        reserveErrorLine
      />
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 16 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T weight="medium">Keep my salary on this phone only</T>
          <T size="caption" tone="muted">
            Toki saves it on this device and works out hours here. The server stores no salary.
          </T>
        </View>
        <Switch
          value={deviceOnly}
          onValueChange={setDeviceOnly}
          trackColor={{ true: c.purple, false: c.raise }}
          thumbColor="#ffffff"
          ios_backgroundColor={c.raise}
          accessibilityLabel="Keep my salary on this phone only"
        />
      </View>
      {errors.form ? (
        <T size="caption" tone="up">
          {errors.form}
        </T>
      ) : null}
      <Button block size="lg" onPress={submit} loading={update.isPending}>
        {submitLabel}
      </Button>
    </View>
  );
}
