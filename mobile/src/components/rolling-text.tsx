import { useEffect, useState } from "react";
import { Text, View, type StyleProp, type TextStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { easeOut } from "@/theme/theme";

interface Props {
  value: string;
  /** A change of key rolls the characters in; a change of value alone swaps quietly (e.g. a price refresh). */
  animationKey: string;
  style?: StyleProp<TextStyle>;
  /** Extra delay before the first character, used to ripple the toggle across the grid. */
  delay?: number;
  /** Per-character stagger in ms. */
  stagger?: number;
}

const ROLL_MS = 280;

/**
 * The time toggle's rolling digits (beUI Number Animation, native edition). When the mode flips,
 * every character rises into place one after the other, so "₹1,29,999" rolls into "86 h 40 min".
 * Honours the system's reduced-motion setting.
 */
export function RollingText({ value, animationKey, style, delay = 0, stagger = 18 }: Props) {
  // The key on first render; figures only roll once the mode has changed since they appeared.
  const [firstKey] = useState(animationKey);
  const reduce = useReducedMotion();

  if (firstKey === animationKey || reduce) {
    return (
      <Text numberOfLines={1} style={style}>
        {value}
      </Text>
    );
  }

  return (
    <View accessible accessibilityRole="text" accessibilityLabel={value} style={{ flexDirection: "row" }}>
      {Array.from(value).map((ch, i) => (
        // Keyed by mode so every character replays its roll on each toggle.
        <RollChar key={`${animationKey}:${i}`} ch={ch} delay={delay + i * stagger} style={style} />
      ))}
    </View>
  );
}

function RollChar({ ch, delay, style }: { ch: string; delay: number; style?: StyleProp<TextStyle> }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(withDelay(delay, withTiming(1, { duration: ROLL_MS, easing: easeOut })));
  }, [delay, progress]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * 10 }],
  }));

  return (
    <Animated.Text importantForAccessibility="no" style={[style, animated]}>
      {ch === " " ? " " : ch}
    </Animated.Text>
  );
}
