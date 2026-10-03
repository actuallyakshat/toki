import { View, type StyleProp, type TextStyle } from "react-native";
import { formatMoney, formatTime, type Income } from "@/lib/format";
import type { Mode } from "@/lib/prefs";
import { useTheme } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";
import { RollingText } from "./rolling-text";
import { T } from "./text";

const STAGGER_MS = 25;
const MAX_STAGGER_STEPS = 24;

export function priceText(minor: number, currency: string, mode: Mode, income: Income | null): string {
  return mode === "time" && income ? formatTime(minor, income) : formatMoney(minor, currency);
}

interface PriceFigureProps {
  minor: number;
  currency: string;
  mode: Mode;
  income: Income | null;
  /** Position in the grid: each figure follows the toggle `index * 25 ms` late, so it ripples. */
  index?: number;
  size?: number;
  weight?: "regular" | "medium" | "semibold";
  color?: string;
  style?: StyleProp<TextStyle>;
}

/** A price that rolls between rupees and hours of work. Geist 500, tabular figures. */
export function PriceFigure({
  minor,
  currency,
  mode,
  income,
  index = 0,
  size = 17,
  weight = "medium",
  color,
  style,
}: PriceFigureProps) {
  const { c } = useTheme();
  return (
    <RollingText
      value={priceText(minor, currency, mode, income)}
      animationKey={mode}
      delay={Math.min(index, MAX_STAGGER_STEPS) * STAGGER_MS}
      style={[
        {
          fontFamily: fonts[weight],
          fontSize: size,
          lineHeight: Math.round(size * 1.25),
          letterSpacing: size >= 17 ? -0.02 * size : 0,
          color: color ?? c.text,
          fontVariant: ["tabular-nums"],
        },
        style,
      ]}
    />
  );
}

/** Jade when the price fell since added, kumkum when it rose. Hidden when unchanged. */
export function DeltaChip({ changeMinor, currency }: { changeMinor: number; currency: string }) {
  const { c } = useTheme();
  if (changeMinor === 0) return null;
  const down = changeMinor < 0;
  return (
    <View
      accessible
      accessibilityLabel={`${down ? "Down" : "Up"} ${formatMoney(Math.abs(changeMinor), currency)} since added`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: radius.chip,
        backgroundColor: down ? c.downWash : c.upWash,
        alignSelf: "flex-start",
      }}
    >
      <T style={{ fontSize: 8, lineHeight: 12 }} tone={down ? "down" : "up"}>
        {down ? "▼" : "▲"}
      </T>
      <T size="caption" weight="medium" tone={down ? "down" : "up"} tabular>
        {formatMoney(Math.abs(changeMinor), currency)}
      </T>
    </View>
  );
}
