import type { LucideIcon } from "lucide-react-native";
import { forwardRef, useState, type ReactNode } from "react";
import { Platform, TextInput, View, type TextInputProps } from "react-native";
import { useTheme } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";
import { T } from "./text";

interface Props extends Omit<TextInputProps, "onChange" | "style"> {
  label?: string;
  hint?: string;
  error?: string;
  /** Keeps a line under the field for the error so the form does not jump. */
  reserveErrorLine?: boolean;
  leftIcon?: LucideIcon;
  right?: ReactNode;
  multiline?: boolean;
}

/** Inputs: 8px radius, a hairline that turns purple on focus, labels above in 12px muted text. */
export const Input = forwardRef<TextInput, Props>(function Input(
  { label, hint, error, reserveErrorLine, leftIcon: Icon, right, multiline, onFocus, onBlur, ...props },
  ref,
) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? c.up : focused ? c.focus : c.border;

  return (
    <View style={{ gap: 6 }}>
      {label && (
        <T size="caption" tone="muted">
          {label}
        </T>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: multiline ? "flex-start" : "center",
          gap: 8,
          minHeight: multiline ? 88 : 44,
          paddingHorizontal: 12,
          borderRadius: radius.control,
          borderWidth: focused ? 1.5 : 1,
          borderColor,
          backgroundColor: c.surface,
        }}
      >
        {Icon && <Icon size={16} color={c.textFaint} />}
        <TextInput
          ref={ref}
          {...props}
          multiline={multiline}
          placeholderTextColor={c.textFaint}
          selectionColor={c.highlight}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            {
              flex: 1,
              fontFamily: fonts.regular,
              fontSize: 16,
              color: c.text,
              paddingVertical: multiline ? 12 : 10,
              textAlignVertical: multiline ? "top" : "center",
            },
            // The wrapper draws the focus ring; drop the browser's own outline on web.
            Platform.OS === "web" && ({ outlineWidth: 0 } as object),
          ]}
        />
        {right}
      </View>
      {error ? (
        <T size="caption" tone="up" accessibilityLiveRegion="polite">
          {error}
        </T>
      ) : hint ? (
        <T size="caption" tone="faint">
          {hint}
        </T>
      ) : reserveErrorLine ? (
        <T size="caption"> </T>
      ) : null}
    </View>
  );
});
