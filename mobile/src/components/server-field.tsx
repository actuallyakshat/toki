import { Server } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { Input } from "./input";
import { T } from "./text";

/** Toki is open source; people who host their own server point the app at it here. */
export function ServerField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap" }}>
        <T size="caption" tone="faint">
          Server: {value.replace(/^https?:\/\//, "")}
        </T>
        <T size="caption" tone="highlight" onPress={() => setOpen(true)} accessibilityRole="button">
          Change
        </T>
      </View>
    );
  }
  return (
    <Input
      label="Toki server"
      hint="The address of your Toki API, for example https://api.toki.example"
      leftIcon={Server}
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType="url"
      value={value}
      onChangeText={onChange}
    />
  );
}
