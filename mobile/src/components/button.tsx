import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { easeOut, useTheme } from "@/theme/theme";
import { duration, fonts, radius, timeAccent } from "@/theme/tokens";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const HEIGHT: Record<Size, number> = { sm: 34, md: 40, lg: 48 };
const PAD: Record<Size, number> = { sm: 12, md: 16, lg: 20 };
const FONT: Record<Size, number> = { sm: 13, md: 14, lg: 15 };

interface Props {
  children: ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: Size;
  icon?: LucideIcon;
  /** A trailing icon, e.g. ArrowRight on buttons that move you forward. */
  trailingIcon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  /** Controls radius instead of a pill, for full-width form submits (as on the website). */
  block?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * The Toki button: an ink pill. Primary buttons follow the accent, so they turn purple with the
 * time toggle; the colour eases over 420 ms like the website's `--accent` transition.
 */
export function Button({
  children,
  onPress,
  variant = "primary",
  size = "md",
  icon: Icon,
  trailingIcon: Trailing,
  loading,
  disabled,
  block,
  style,
  accessibilityLabel,
}: Props) {
  const { c, timeProgress } = useTheme();
  const pressed = useSharedValue(0);
  const inactive = disabled || loading;

  const animated = useAnimatedStyle(() => {
    const scale = 1 - pressed.value * 0.03;
    if (variant === "primary") {
      return {
        transform: [{ scale }],
        backgroundColor: interpolateColor(timeProgress.value, [0, 1], [c.accent, timeAccent.accent]),
      };
    }
    return {
      transform: [{ scale }],
      backgroundColor: variant === "secondary" ? c.surface : pressed.value > 0 ? c.surfaceSunk : "transparent",
    };
  });
  const labelStyle = useAnimatedStyle(() => ({
    color:
      variant === "primary"
        ? interpolateColor(timeProgress.value, [0, 1], [c.accentContrast, timeAccent.accentContrast])
        : variant === "danger"
          ? c.up
          : c.text,
  }));
  const iconColor = variant === "primary" ? undefined : variant === "danger" ? c.up : c.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPressIn={() => pressed.set(withTiming(1, { duration: duration.fast, easing: easeOut }))}
      onPressOut={() => pressed.set(withTiming(0, { duration: duration.base, easing: easeOut }))}
      style={style}
    >
      <Animated.View
        style={[
          {
            height: HEIGHT[size],
            paddingHorizontal: PAD[size],
            borderRadius: block ? radius.control : radius.button,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            opacity: disabled ? 0.45 : 1,
            borderWidth: variant === "secondary" ? 1 : 0,
            borderColor: c.border,
          },
          animated,
        ]}
      >
        {loading ? (
          <PrimaryTint variant={variant}>{(color) => <ActivityIndicator size="small" color={color} />}</PrimaryTint>
        ) : (
          Icon && <PrimaryTint variant={variant}>{(color) => <Icon size={16} color={iconColor ?? color} />}</PrimaryTint>
        )}
        <Animated.Text numberOfLines={1} style={[{ fontFamily: fonts.medium, fontSize: FONT[size] }, labelStyle]}>
          {children}
        </Animated.Text>
        {Trailing && !loading && (
          <PrimaryTint variant={variant}>{(color) => <Trailing size={16} color={iconColor ?? color} />}</PrimaryTint>
        )}
      </Animated.View>
    </Pressable>
  );
}

/** Icons inside a primary button use the current accent contrast colour. */
function PrimaryTint({ variant, children }: { variant: ButtonVariant; children: (color: string) => ReactNode }) {
  const { accentContrast, c } = useTheme();
  return <View>{children(variant === "primary" ? accentContrast : c.text)}</View>;
}

/** A round, quiet icon button (close, overflow, back). */
export function IconButton({
  icon: Icon,
  onPress,
  label,
  size = 36,
  tone,
}: {
  icon: LucideIcon;
  onPress: () => void;
  label: string;
  size?: number;
  tone?: string;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? c.surfaceSunk : "transparent",
      })}
    >
      <Icon size={20} color={tone ?? c.textMuted} />
    </Pressable>
  );
}
