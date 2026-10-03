import type { LucideIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, View, type LayoutChangeEvent } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useTheme } from "@/theme/theme";
import { fonts, radius, timeAccent } from "@/theme/tokens";

export interface SegmentOption<V extends string> {
  value: V;
  label?: string;
  icon?: LucideIcon;
  accessibilityLabel?: string;
}

interface Props<V extends string> {
  value: V;
  options: SegmentOption<V>[];
  onChange: (value: V) => void;
  /** Stretch the options across the row. */
  fill?: boolean;
  size?: "sm" | "md";
}

const SPRING = { stiffness: 380, damping: 32 };

/**
 * The beUI segment: an 8px control with a hairline, and a 4px indicator in the accent colour that
 * slides between options. The indicator follows the accent, so it turns purple in time mode.
 */
export function Segmented<V extends string>({ value, options, onChange, fill, size = "md" }: Props<V>) {
  const { c, timeProgress } = useTheme();
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const current = layouts[value];
  const height = size === "sm" ? 30 : 34;

  const x = useSharedValue(0);
  const width = useSharedValue(0);

  // The first measurement places the indicator; later changes slide it.
  useEffect(() => {
    if (!current) return;
    const placed = width.get() > 0;
    x.set(placed ? withSpring(current.x, SPRING) : current.x);
    width.set(placed ? withSpring(current.width, SPRING) : current.width);
  }, [current, x, width]);

  const indicator = useAnimatedStyle(() => ({
    opacity: width.get() > 0 ? 1 : 0,
    width: width.get(),
    transform: [{ translateX: x.get() }],
    backgroundColor: interpolateColor(timeProgress.get(), [0, 1], [c.accent, timeAccent.accent]),
  }));

  const onLayout = (v: V) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => (prev[v]?.x === x && prev[v]?.width === width ? prev : { ...prev, [v]: { x, width } }));
  };

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        alignSelf: fill ? "stretch" : "flex-start",
        padding: 3,
        borderRadius: radius.control,
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      <Animated.View
        style={[
          { pointerEvents: "none", position: "absolute", top: 3, bottom: 3, left: 0, borderRadius: radius.chip },
          indicator,
        ]}
      />
      {options.map((o) => (
        <Segment
          key={o.value}
          option={o}
          selected={o.value === value}
          height={height}
          fill={fill}
          onLayout={onLayout(o.value)}
          onPress={() => onChange(o.value)}
        />
      ))}
    </View>
  );
}

function Segment<V extends string>({
  option,
  selected,
  height,
  fill,
  onLayout,
  onPress,
}: {
  option: SegmentOption<V>;
  selected: boolean;
  height: number;
  fill?: boolean;
  onLayout: (e: LayoutChangeEvent) => void;
  onPress: () => void;
}) {
  const { c, timeProgress } = useTheme();
  const color = useAnimatedStyle(() => ({
    color: selected ? interpolateColor(timeProgress.value, [0, 1], [c.accentContrast, timeAccent.accentContrast]) : c.textMuted,
  }));
  const { accentContrast } = useTheme();
  const Icon = option.icon;
  return (
    <Pressable
      onLayout={onLayout}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={option.accessibilityLabel ?? option.label}
      hitSlop={4}
      style={{
        flex: fill ? 1 : undefined,
        height,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      {Icon && <Icon size={15} color={selected ? accentContrast : c.textMuted} />}
      {option.label !== undefined && (
        <Animated.Text style={[{ fontFamily: fonts.medium, fontSize: 13 }, color]}>{option.label}</Animated.Text>
      )}
    </Pressable>
  );
}
